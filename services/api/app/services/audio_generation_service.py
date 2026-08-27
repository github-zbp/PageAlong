from __future__ import annotations

import json
import shutil
import uuid
import wave
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.course import ArticleText, AudioAsset, Course, CourseSection, CourseStatus, Sentence
from app.models.file_resource import ResourceKind, ResourceVariant
from app.models.generation_job import GenerationJob, JobStatus
from app.models.tts import TTSSegment
from app.services.content_metrics import measure_text_content
from app.services.providers import build_default_segment_providers
from app.services.file_resource_service import FileResourceService
from app.services.object_storage import ObjectStorageService, is_s3_compatible_backend
from app.services.media_compression import MediaCompressionService
from app.services.tts_limits import enforce_route_metric_limit
from app.services.tts_router import ProviderHealth, TTSRouter
from app.services.tts_segments import TextSegment, build_sentence_segments, tencent_speed_for_factor
from app.services.tts_service import FakeTTSProvider, SynthesisResult
from app.services.tts_types import (
    TTSSegmentRequest,
    TTSSegmentResult,
    TTSSentenceTiming,
    TTSProviderError,
    TTSRoutePlan,
)
from app.services.tts_usage_service import TTSUsageService


@dataclass(frozen=True)
class AudioGenerationResult:
    course_id: str
    job_id: str
    audio_asset_id: str
    audio_path: Path


class AudioGenerationService:
    def __init__(
        self,
        db: Session,
        output_dir: Path | None = None,
        provider: FakeTTSProvider | None = None,
        segment_providers: Mapping[str, Any] | None = None,
        router: TTSRouter | None = None,
        provider_health: ProviderHealth | None = None,
        provider_mode: str | None = None,
        object_storage: ObjectStorageService | None = None,
        media_compression: MediaCompressionService | None = None,
        voice_id: str = "fake-cn",
        speed: float = 1.0,
        max_provider_attempts: int = 2,
    ):
        self.db = db
        self.output_dir = output_dir or Path(settings.generated_audio_dir)
        self.provider = provider or FakeTTSProvider(self.output_dir)
        self.router = router or TTSRouter()
        self.provider_health = provider_health or ProviderHealth()
        self.provider_mode = provider_mode or settings.tts_provider_mode
        self.segment_providers = self._build_segment_providers(segment_providers)
        self.object_storage = object_storage
        self.file_resource_service = FileResourceService(db, object_storage=object_storage)
        self.media_compression = media_compression or MediaCompressionService.from_settings()
        self.voice_id = voice_id
        self.speed = speed
        self.max_provider_attempts = max(1, max_provider_attempts)
        self.usage_service = TTSUsageService(db)

    def _build_segment_providers(self, segment_providers: Mapping[str, Any] | None) -> dict[str, Any]:
        if segment_providers is not None:
            return dict(segment_providers)
        if self.provider_mode == "fake":
            return {}
        return build_default_segment_providers(self.output_dir)

    def generate_for_job(self, job_id: str) -> AudioGenerationResult:
        job = self._get_job(job_id)
        course = self._get_course(job.course_id)

        try:
            self._mark_running(job, course)
            article_text = self._get_current_article_text(course.id)
            sentences = self._get_ordered_sentences(course.id)
            if not self._should_use_segmented_generation():
                return self._generate_with_legacy_provider(job, course, article_text, sentences)

            return self._generate_with_segments(job, course, article_text, sentences)
        except Exception as exc:
            self.db.rollback()
            self._mark_failed(job_id, str(exc))
            raise

    def _should_use_segmented_generation(self) -> bool:
        if self.provider_mode == "fake":
            return False
        if self.provider_mode in {"auto", "real"}:
            return True
        return bool(self.segment_providers)

    def _generate_with_legacy_provider(
        self,
        job: GenerationJob,
        course: Course,
        article_text: ArticleText,
        sentences: list[Sentence],
    ) -> AudioGenerationResult:
        synthesis = self.provider.synthesize_article(
            course_id=course.id,
            sentences=[sentence.text for sentence in sentences],
            voice_id=self.voice_id,
            speed=self.speed,
        )
        asset = self._store_audio_asset(course, article_text, synthesis)
        self._write_sentence_timeline(sentences, synthesis)
        self._mark_succeeded(job, course, asset, synthesis)
        self.db.commit()
        return AudioGenerationResult(
            course_id=course.id,
            job_id=job.id,
            audio_asset_id=asset.id,
            audio_path=synthesis.audio_path,
        )

    def _generate_with_segments(
        self,
        job: GenerationJob,
        course: Course,
        article_text: ArticleText,
        sentences: list[Sentence],
    ) -> AudioGenerationResult:
        sentence_texts = [sentence.text for sentence in sentences]
        text_metric = measure_text_content("".join(sentence_texts))
        route = self.router.route_for_user(
            user_id=course.user_id,
            estimated_characters=text_metric.count,
            provider_health=self.provider_health,
            speed_factor=self.speed,
        )
        enforce_route_metric_limit(route, text_metric)
        job.provider = route.provider_id
        job.fallback_provider = route.fallback_provider_id
        job.tier = route.tier
        job.model_id = route.model_id
        job.voice_id = route.voice_id
        job.speed_factor = route.speed_factor

        sections = self._ensure_course_sections(course, article_text, sentences)
        text_segments = build_sentence_segments(sentence_texts, max_characters=route.segment_character_limit)
        if not text_segments:
            raise ValueError(f"Course has no synthesizeable text: {course.id}")
        job.progress_total = len(text_segments)
        self.db.flush()

        try:
            generated_segments = self._synthesize_text_segments_with_provider(
                course=course,
                article_text=article_text,
                job=job,
                route=route,
                sections=sections,
                text_segments=text_segments,
                provider_id=route.provider_id,
            )
        except Exception:
            if route.fallback_provider_id is None:
                raise
            generated_segments = self._synthesize_text_segments_with_provider(
                course=course,
                article_text=article_text,
                job=job,
                route=route,
                sections=sections,
                text_segments=text_segments,
                provider_id=route.fallback_provider_id,
            )

        audio_path = self._combine_segment_audio(course.id, [result for _, result in generated_segments])
        duration_seconds = max(1, round(sum(result.duration_seconds for _, result in generated_segments)))
        character_count = sum(result.character_count for _, result in generated_segments)
        asset = self._store_segmented_audio_asset(
            course=course,
            article_text=article_text,
            job=job,
            route_tier=route.tier,
            synthesis=generated_segments[-1][1],
            audio_path=audio_path,
            duration_seconds=duration_seconds,
            character_count=character_count,
        )
        self._write_estimated_sentence_timeline(sentences, generated_segments)
        self._write_section_timeline(sections, sentences)
        self._mark_segmented_succeeded(job, course, asset, duration_seconds)
        self.db.commit()
        return AudioGenerationResult(
            course_id=course.id,
            job_id=job.id,
            audio_asset_id=asset.id,
            audio_path=audio_path,
        )

    def _synthesize_text_segments_with_provider(
        self,
        *,
        course: Course,
        article_text: ArticleText,
        job: GenerationJob,
        route: TTSRoutePlan,
        sections: list[CourseSection],
        text_segments: list[TextSegment],
        provider_id: str,
    ) -> list[tuple[TextSegment, TTSSegmentResult]]:
        generated_segments: list[tuple[TextSegment, TTSSegmentResult]] = []
        for text_segment in text_segments:
            segment_result = self._synthesize_text_segment(
                course=course,
                article_text=article_text,
                job=job,
                route=route,
                sections=sections,
                text_segment=text_segment,
                provider_id=provider_id,
            )
            generated_segments.append((text_segment, segment_result))
            job.progress_current = max(job.progress_current, len(generated_segments))
            job.heartbeat_at = datetime.utcnow()
            self.db.commit()
        return generated_segments

    def _ensure_course_sections(
        self,
        course: Course,
        article_text: ArticleText,
        sentences: list[Sentence],
    ) -> list[CourseSection]:
        existing_sections = list(
            self.db.scalars(
                select(CourseSection)
                .where(
                    CourseSection.course_id == course.id,
                    CourseSection.article_text_id == article_text.id,
                )
                .order_by(CourseSection.section_index)
            )
        )
        if existing_sections:
            return existing_sections

        target_duration_seconds = 8 * 60
        max_duration_seconds = 10 * 60
        sections: list[CourseSection] = []
        section_start = sentences[0].index
        section_duration = 0.0

        for position, sentence in enumerate(sentences):
            estimated_duration = self._estimate_sentence_duration(sentence.text)
            should_flush = (
                position > 0
                and section_duration >= target_duration_seconds
                and section_duration + estimated_duration > max_duration_seconds
            )
            if should_flush:
                sections.append(
                    self._new_course_section(
                        course_id=course.id,
                        article_text_id=article_text.id,
                        section_index=len(sections),
                        sentence_start_index=section_start,
                        sentence_end_index=sentences[position - 1].index,
                        planned_duration_seconds=round(section_duration),
                    )
                )
                section_start = sentence.index
                section_duration = 0.0
            section_duration += estimated_duration

        sections.append(
            self._new_course_section(
                course_id=course.id,
                article_text_id=article_text.id,
                section_index=len(sections),
                sentence_start_index=section_start,
                sentence_end_index=sentences[-1].index,
                planned_duration_seconds=max(1, round(section_duration)),
            )
        )

        self.db.add_all(sections)
        self.db.flush()
        return sections

    def _new_course_section(
        self,
        *,
        course_id: str,
        article_text_id: str,
        section_index: int,
        sentence_start_index: int,
        sentence_end_index: int,
        planned_duration_seconds: int,
    ) -> CourseSection:
        return CourseSection(
            course_id=course_id,
            article_text_id=article_text_id,
            section_index=section_index,
            title=f"第 {section_index + 1} 节",
            sentence_start_index=sentence_start_index,
            sentence_end_index=sentence_end_index,
            planned_duration_seconds=planned_duration_seconds,
        )

    def _synthesize_text_segment(
        self,
        *,
        course: Course,
        article_text: ArticleText,
        job: GenerationJob,
        route: TTSRoutePlan,
        sections: list[CourseSection],
        text_segment: TextSegment,
        provider_id: str,
    ) -> TTSSegmentResult:
        reusable_result = self._reusable_successful_segment(job.id, text_segment, provider_id)
        if reusable_result is not None:
            return reusable_result

        provider = self.segment_providers.get(provider_id)
        if provider is None:
            raise TTSProviderError(f"TTS provider is not configured: {provider_id}", code="provider_missing")

        segment = self._get_or_create_tts_segment(
            job=job,
            course=course,
            article_text=article_text,
            route=route,
            provider_id=provider_id,
            sections=sections,
            text_segment=text_segment,
        )
        usage_event = self.usage_service.reserve_segment(
            idempotency_key=f"usage:{segment.id}",
            user_id=course.user_id,
            course_id=course.id,
            job_id=job.id,
            segment=segment,
            tier=route.tier,
            billable_characters=len(text_segment.text),
            input_bytes=len(text_segment.text.encode("utf-8")),
            estimated_cost_cents=self._estimate_segment_cost_cents(route.tier, provider_id, len(text_segment.text)),
            currency="CNY" if provider_id == "tencent_cloud_tts" else "USD",
        )

        last_error: Exception | None = None
        for attempt in range(1, self.max_provider_attempts + 1):
            segment.provider_attempt = attempt
            segment.started_at = segment.started_at or datetime.utcnow()
            segment.status = "running"
            usage_event.provider_attempt = attempt
            self.db.flush()
            try:
                request = self._build_segment_request(job, course, article_text, route, provider_id, segment, text_segment)
                result = provider.synthesize_segment(request)
                segment.status = "succeeded"
                segment.object_path = str(result.audio_path)
                segment.duration_seconds = result.duration_seconds
                segment.character_count = result.character_count
                segment.byte_size = result.byte_size
                segment.timing_json = self._serialize_sentence_timings(result.sentence_timings)
                segment.finished_at = datetime.utcnow()
                segment.committed_at = segment.finished_at
                segment.error_code = None
                segment.error_message = None
                self.usage_service.commit_event(usage_event, audio_seconds=result.duration_seconds)
                self.db.flush()
                return result
            except TTSProviderError as exc:
                last_error = exc
                segment.status = "failed"
                segment.error_code = exc.code
                segment.error_message = str(exc)[:2000]
                segment.finished_at = datetime.utcnow()
                self.db.flush()
                if not exc.retryable:
                    break
            except Exception as exc:
                last_error = exc
                segment.status = "failed"
                segment.error_code = "tts_provider_exception"
                segment.error_message = str(exc)[:2000]
                segment.finished_at = datetime.utcnow()
                self.db.flush()

        if last_error is not None:
            self.usage_service.release_event(usage_event)
            segment.released_at = datetime.utcnow()
            self.db.flush()
            raise last_error
        raise TTSProviderError("TTS provider could not synthesize the segment", code="provider_failed")

    def _reusable_successful_segment(
        self,
        job_id: str,
        text_segment: TextSegment,
        provider_id: str,
    ) -> TTSSegmentResult | None:
        segment = self.db.scalar(
            select(TTSSegment)
            .where(
                TTSSegment.job_id == job_id,
                TTSSegment.segment_index == text_segment.segment_index,
                TTSSegment.text_hash == text_segment.text_hash,
                TTSSegment.provider == provider_id,
                TTSSegment.status == "succeeded",
                TTSSegment.object_path.is_not(None),
            )
            .order_by(TTSSegment.committed_at.desc().nullslast())
        )
        if segment is None or not segment.object_path:
            return None

        audio_path = Path(segment.object_path)
        if not audio_path.exists():
            return None

        byte_size = segment.byte_size or audio_path.stat().st_size
        return TTSSegmentResult(
            provider_id=segment.provider,
            model_id=segment.model_id,
            voice_id=segment.voice_id,
            audio_path=audio_path,
            duration_seconds=segment.duration_seconds,
            character_count=segment.character_count,
            byte_size=byte_size,
            response_format=segment.response_format,
            sentence_timings=self._deserialize_sentence_timings(segment.timing_json),
        )

    def _get_or_create_tts_segment(
        self,
        *,
        job: GenerationJob,
        course: Course,
        article_text: ArticleText,
        route: TTSRoutePlan,
        provider_id: str,
        sections: list[CourseSection],
        text_segment: TextSegment,
    ) -> TTSSegment:
        idempotency_key = f"{job.id}:{provider_id}:{text_segment.segment_index}:{text_segment.text_hash}"
        existing = self.db.scalar(select(TTSSegment).where(TTSSegment.idempotency_key == idempotency_key))
        if existing is not None:
            return existing

        segment = TTSSegment(
            job_id=job.id,
            course_id=course.id,
            article_text_id=article_text.id,
            section_id=self._section_id_for_segment(sections, text_segment),
            segment_index=text_segment.segment_index,
            sentence_start_index=text_segment.sentence_start_index,
            sentence_end_index=text_segment.sentence_end_index,
            text=text_segment.text,
            text_hash=text_segment.text_hash,
            provider=provider_id,
            model_id=self._model_id_for_provider(route, provider_id),
            voice_id=self._voice_id_for_provider(route, provider_id),
            speed_factor=route.speed_factor,
            provider_speed=self._provider_speed_for_provider(provider_id, route.speed_factor),
            response_format=self._response_format_for_provider(route, provider_id),
            idempotency_key=idempotency_key,
            character_count=len(text_segment.text),
        )
        self.db.add(segment)
        self.db.flush()
        return segment

    def _build_segment_request(
        self,
        job: GenerationJob,
        course: Course,
        article_text: ArticleText,
        route: TTSRoutePlan,
        provider_id: str,
        segment: TTSSegment,
        text_segment: TextSegment,
    ) -> TTSSegmentRequest:
        return TTSSegmentRequest(
            job_id=job.id,
            course_id=course.id,
            article_text_id=article_text.id,
            section_id=segment.section_id,
            segment_index=text_segment.segment_index,
            sentence_start_index=text_segment.sentence_start_index,
            sentence_end_index=text_segment.sentence_end_index,
            text=text_segment.text,
            text_hash=text_segment.text_hash,
            provider_id=provider_id,
            model_id=segment.model_id,
            voice_id=segment.voice_id,
            speed_factor=route.speed_factor,
            provider_speed=segment.provider_speed,
            response_format=segment.response_format,
            idempotency_key=segment.idempotency_key,
        )

    def _section_id_for_segment(self, sections: list[CourseSection], text_segment: TextSegment) -> str | None:
        for section in sections:
            if section.sentence_start_index <= text_segment.sentence_start_index <= section.sentence_end_index:
                return section.id
        return sections[-1].id if sections else None

    def _model_id_for_provider(self, route: TTSRoutePlan, provider_id: str) -> str:
        if provider_id == "aws_polly_standard":
            return settings.tts_aws_polly_engine
        if provider_id == "kokoro_onnx_cpu":
            return "kokoro-82m-onnx-cpu"
        if provider_id == "edge_tts":
            return "edge-tts"
        return route.model_id

    def _voice_id_for_provider(self, route: TTSRoutePlan, provider_id: str) -> str:
        if provider_id == "aws_polly_standard":
            return settings.tts_aws_polly_voice_id
        if provider_id == "kokoro_onnx_cpu":
            return settings.tts_kokoro_voice or route.voice_id
        return route.voice_id

    def _provider_speed_for_provider(self, provider_id: str, speed_factor: float) -> str | None:
        if provider_id == "tencent_cloud_tts":
            return str(tencent_speed_for_factor(speed_factor))
        return None

    def _response_format_for_provider(self, route: TTSRoutePlan, provider_id: str) -> str:
        if provider_id == "kokoro_onnx_cpu":
            return "wav"
        if provider_id in {"edge_tts", "aws_polly_standard"}:
            return "mp3"
        if provider_id == "tencent_cloud_tts":
            return settings.tts_tencent_codec
        return route.response_format

    def _estimate_sentence_duration(self, text: str) -> float:
        return max(0.6, len(text.strip()) * 0.12 / max(self.speed, 0.5))

    def _estimate_segment_cost_cents(self, tier: str, provider_id: str, characters: int) -> int:
        if tier == "free":
            return 0
        if provider_id == "aws_polly_standard":
            return max(1, round(characters * 0.0004))
        if provider_id == "tencent_cloud_tts":
            return max(1, round(characters * 0.0002))
        return 0

    def _combine_segment_audio(self, course_id: str, segment_results: list[TTSSegmentResult]) -> Path:
        if not segment_results:
            raise ValueError("No generated audio segments to combine")

        output_format = segment_results[0].response_format or segment_results[0].audio_path.suffix.lstrip(".") or "mp3"
        output_path = self.output_dir / f"{course_id}.{output_format}"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        if len(segment_results) == 1:
            source = segment_results[0].audio_path
            if source != output_path:
                shutil.copyfile(source, output_path)
            return output_path

        if output_format == "wav":
            self._combine_wav_segments(output_path, [result.audio_path for result in segment_results])
            return output_path

        with output_path.open("wb") as output:
            for result in segment_results:
                with result.audio_path.open("rb") as audio_file:
                    shutil.copyfileobj(audio_file, output)
        return output_path

    def _combine_wav_segments(self, output_path: Path, audio_paths: list[Path]) -> None:
        params = None
        frames = bytearray()
        for audio_path in audio_paths:
            with wave.open(str(audio_path), "rb") as wav:
                if params is None:
                    params = wav.getparams()
                frames.extend(wav.readframes(wav.getnframes()))

        if params is None:
            raise ValueError("No WAV segments to combine")

        with wave.open(str(output_path), "wb") as output:
            output.setparams(params)
            output.writeframes(bytes(frames))

    def _store_segmented_audio_asset(
        self,
        *,
        course: Course,
        article_text: ArticleText,
        job: GenerationJob,
        route_tier: str,
        synthesis: TTSSegmentResult,
        audio_path: Path,
        duration_seconds: int,
        character_count: int,
    ) -> AudioAsset:
        compression = self.media_compression.compress_audio(audio_path)
        audio_asset_id = str(uuid.uuid4())
        fingerprint = self.file_resource_service.build_fingerprint(
            "course-audio",
            course.id,
            article_text.content_hash,
            course.title,
            route_tier,
            synthesis.provider_id,
            synthesis.model_id,
            synthesis.voice_id,
            self.speed,
            compression.format,
            compression.checksum_sha256,
        )
        resource = self.file_resource_service.create_pending_resource(
            user_id=course.user_id,
            owner_type="course",
            owner_id=course.id,
            resource_kind=ResourceKind.AUDIO,
            resource_variant=ResourceVariant.AUDIO,
            title=course.title,
            filename=f"{course.title}.{compression.format}",
            source_fingerprint=fingerprint,
            metadata_json=json.dumps(compression.metadata, ensure_ascii=False),
        )
        stored = self.file_resource_service.store_bytes(
            resource,
            compression.output_path.read_bytes(),
            content_type=compression.content_type,
            object_key=f"audio/{course.id}/{audio_asset_id}.{compression.format}",
        )
        for asset in course.audio_assets:
            asset.is_current = False

        audio_asset = AudioAsset(
            id=audio_asset_id,
            course_id=course.id,
            article_text_id=article_text.id,
            generation_job_id=job.id,
            provider=synthesis.provider_id,
            model_id=synthesis.model_id,
            tier=route_tier,
            voice_id=synthesis.voice_id,
            speed=self.speed,
            format=compression.format,
            object_path=stored.stored_object.object_path,
            storage_backend=stored.stored_object.storage_backend,
            bucket=stored.stored_object.bucket,
            object_key=stored.stored_object.object_key,
            content_type=stored.stored_object.content_type,
            byte_size=stored.stored_object.byte_size,
            etag=stored.stored_object.etag,
            checksum_sha256=stored.stored_object.checksum_sha256,
            metadata_json=json.dumps(compression.metadata, ensure_ascii=False),
            duration_seconds=duration_seconds,
            character_count=character_count,
            is_current=True,
            resource_id=resource.id,
        )
        self.db.add(audio_asset)
        self.db.flush()
        course.current_audio_resource_id = resource.id
        return audio_asset

    def _upload_audio_asset_if_configured(self, audio_asset: AudioAsset, audio_path: Path) -> None:
        if not is_s3_compatible_backend(settings.tts_storage_backend):
            return

        object_format = audio_asset.format or audio_path.suffix.lstrip(".") or "mp3"
        content_type = audio_asset.content_type or f"audio/{object_format}"
        stored = self._object_storage().upload_file(
            audio_path,
            object_key=f"audio/{audio_asset.course_id}/{audio_asset.id}.{object_format}",
            content_type=content_type,
        )
        audio_asset.storage_backend = stored.storage_backend
        audio_asset.bucket = stored.bucket
        audio_asset.object_key = stored.object_key
        audio_asset.object_path = stored.object_path
        audio_asset.content_type = stored.content_type
        audio_asset.byte_size = stored.byte_size
        audio_asset.etag = stored.etag
        audio_asset.checksum_sha256 = stored.checksum_sha256

    def _object_storage(self) -> ObjectStorageService:
        if self.object_storage is not None:
            return self.object_storage
        self.object_storage = ObjectStorageService.from_settings(settings.tts_storage_backend)
        return self.object_storage

    def _write_estimated_sentence_timeline(
        self,
        sentences: list[Sentence],
        generated_segments: list[tuple[TextSegment, TTSSegmentResult]],
    ) -> None:
        sentence_by_index = {sentence.index: sentence for sentence in sentences}
        ranges: dict[int, list[float]] = {}
        cursor = 0.0

        for text_segment, result in generated_segments:
            segment_sentences = [
                sentence_by_index[index]
                for index in range(text_segment.sentence_start_index, text_segment.sentence_end_index + 1)
                if index in sentence_by_index
            ]
            timing_by_index = {timing.sentence_index: timing for timing in result.sentence_timings}
            has_complete_provider_timing = bool(segment_sentences) and all(
                sentence.index in timing_by_index for sentence in segment_sentences
            )
            if has_complete_provider_timing:
                for sentence in segment_sentences:
                    timing = timing_by_index[sentence.index]
                    ranges.setdefault(sentence.index, []).extend(
                        [cursor + timing.start_seconds, cursor + timing.end_seconds]
                    )
                    sentence.generation_status = "succeeded"
            else:
                weights = [max(1, len(sentence.text.strip())) for sentence in segment_sentences]
                total_weight = sum(weights) or len(segment_sentences) or 1
                local_cursor = cursor
                for sentence, weight in zip(segment_sentences, weights):
                    duration = result.duration_seconds * (weight / total_weight)
                    sentence_start = local_cursor
                    sentence_end = local_cursor + duration
                    ranges.setdefault(sentence.index, []).extend([sentence_start, sentence_end])
                    sentence.generation_status = "succeeded"
                    local_cursor = sentence_end
            cursor += result.duration_seconds

        for sentence in sentences:
            values = ranges.get(sentence.index)
            if not values:
                raise ValueError(f"Missing timing for sentence {sentence.index}")
            sentence.audio_start_seconds = round(min(values), 3)
            sentence.audio_end_seconds = round(max(values), 3)

    def _serialize_sentence_timings(self, timings: tuple[TTSSentenceTiming, ...]) -> str:
        return json.dumps(
            [
                {
                    "sentence_index": timing.sentence_index,
                    "start_seconds": timing.start_seconds,
                    "end_seconds": timing.end_seconds,
                }
                for timing in timings
            ],
            ensure_ascii=False,
        )

    def _deserialize_sentence_timings(self, value: str | None) -> tuple[TTSSentenceTiming, ...]:
        try:
            payload = json.loads(value or "[]")
        except json.JSONDecodeError:
            return ()
        if not isinstance(payload, list):
            return ()

        timings: list[TTSSentenceTiming] = []
        for item in payload:
            if not isinstance(item, dict):
                continue
            try:
                timings.append(
                    TTSSentenceTiming(
                        sentence_index=int(item["sentence_index"]),
                        start_seconds=float(item["start_seconds"]),
                        end_seconds=float(item["end_seconds"]),
                    )
                )
            except (KeyError, TypeError, ValueError):
                continue
        return tuple(timings)

    def _write_section_timeline(self, sections: list[CourseSection], sentences: list[Sentence]) -> None:
        sentence_by_index = {sentence.index: sentence for sentence in sentences}
        for section in sections:
            section_sentences = [
                sentence_by_index[index]
                for index in range(section.sentence_start_index, section.sentence_end_index + 1)
                if index in sentence_by_index
            ]
            starts = [sentence.audio_start_seconds for sentence in section_sentences if sentence.audio_start_seconds is not None]
            ends = [sentence.audio_end_seconds for sentence in section_sentences if sentence.audio_end_seconds is not None]
            section.audio_start_seconds = min(starts) if starts else None
            section.audio_end_seconds = max(ends) if ends else None
            section.status = "succeeded" if starts and ends else "pending"

    def _mark_segmented_succeeded(
        self,
        job: GenerationJob,
        course: Course,
        audio_asset: AudioAsset,
        duration_seconds: int,
    ) -> None:
        course.status = CourseStatus.READY
        course.duration_seconds = duration_seconds
        course.current_audio_asset_id = audio_asset.id
        course.current_audio_resource_id = audio_asset.resource_id
        job.status = JobStatus.SUCCEEDED
        job.result_resource_id = audio_asset.resource_id
        job.finished_at = datetime.utcnow()

    def _get_job(self, job_id: str) -> GenerationJob:
        job = self.db.get(GenerationJob, job_id)
        if job is None:
            raise ValueError(f"Generation job not found: {job_id}")
        return job

    def _get_course(self, course_id: str) -> Course:
        course = self.db.get(Course, course_id)
        if course is None or course.is_deleted:
            raise ValueError(f"Course not found: {course_id}")
        return course

    def _mark_running(self, job: GenerationJob, course: Course) -> None:
        job.status = JobStatus.RUNNING
        job.attempt_count += 1
        job.started_at = datetime.utcnow()
        job.error_code = None
        job.error_message = None
        course.status = CourseStatus.AUDIO_GENERATING
        self.db.flush()

    def _get_current_article_text(self, course_id: str) -> ArticleText:
        article_text = self.db.scalar(
            select(ArticleText)
            .where(ArticleText.course_id == course_id)
            .order_by(ArticleText.version.desc(), ArticleText.created_at.desc())
        )
        if article_text is None:
            raise ValueError(f"Course has no article text: {course_id}")
        return article_text

    def _get_ordered_sentences(self, course_id: str) -> list[Sentence]:
        sentences = list(
            self.db.scalars(
                select(Sentence).where(Sentence.course_id == course_id).order_by(Sentence.index)
            )
        )
        if not sentences:
            raise ValueError(f"Course has no sentences: {course_id}")
        return sentences

    def _store_audio_asset(
        self,
        course: Course,
        article_text: ArticleText,
        synthesis: SynthesisResult,
    ) -> AudioAsset:
        compression = self.media_compression.compress_audio(synthesis.audio_path)
        audio_asset_id = str(uuid.uuid4())
        fingerprint = self.file_resource_service.build_fingerprint(
            "course-audio",
            course.id,
            article_text.content_hash,
            course.title,
            synthesis.provider,
            self.voice_id,
            self.speed,
            compression.format,
            compression.checksum_sha256,
        )
        resource = self.file_resource_service.create_pending_resource(
            user_id=course.user_id,
            owner_type="course",
            owner_id=course.id,
            resource_kind=ResourceKind.AUDIO,
            resource_variant=ResourceVariant.AUDIO,
            title=course.title,
            filename=f"{course.title}.{compression.format}",
            source_fingerprint=fingerprint,
            metadata_json=json.dumps(compression.metadata, ensure_ascii=False),
        )
        stored = self.file_resource_service.store_bytes(
            resource,
            compression.output_path.read_bytes(),
            content_type=compression.content_type,
            object_key=f"audio/{course.id}/{audio_asset_id}.{compression.format}",
        )
        for asset in course.audio_assets:
            asset.is_current = False

        audio_asset = AudioAsset(
            id=audio_asset_id,
            course_id=course.id,
            article_text_id=article_text.id,
            provider=synthesis.provider,
            voice_id=self.voice_id,
            speed=self.speed,
            format=compression.format,
            object_path=stored.stored_object.object_path,
            storage_backend=stored.stored_object.storage_backend,
            bucket=stored.stored_object.bucket,
            object_key=stored.stored_object.object_key,
            content_type=stored.stored_object.content_type,
            byte_size=stored.stored_object.byte_size,
            etag=stored.stored_object.etag,
            checksum_sha256=stored.stored_object.checksum_sha256,
            metadata_json=json.dumps(compression.metadata, ensure_ascii=False),
            duration_seconds=synthesis.duration_seconds,
            character_count=synthesis.character_count,
            is_current=True,
            resource_id=resource.id,
        )
        self.db.add(audio_asset)
        self.db.flush()
        course.current_audio_resource_id = resource.id
        return audio_asset

    def _write_sentence_timeline(
        self,
        sentences: list[Sentence],
        synthesis: SynthesisResult,
    ) -> None:
        timing_by_index = {timing.sentence_index: timing for timing in synthesis.timeline}
        for sentence in sentences:
            timing = timing_by_index.get(sentence.index)
            if timing is None:
                raise ValueError(f"Missing timing for sentence {sentence.index}")
            sentence.audio_start_seconds = timing.start_seconds
            sentence.audio_end_seconds = timing.end_seconds
            sentence.generation_status = "succeeded"

    def _mark_succeeded(
        self,
        job: GenerationJob,
        course: Course,
        audio_asset: AudioAsset,
        synthesis: SynthesisResult,
    ) -> None:
        course.status = CourseStatus.READY
        course.duration_seconds = synthesis.duration_seconds
        course.current_audio_asset_id = audio_asset.id
        course.current_audio_resource_id = audio_asset.resource_id
        job.status = JobStatus.SUCCEEDED
        job.result_resource_id = audio_asset.resource_id
        job.finished_at = datetime.utcnow()

    def _mark_failed(self, job_id: str, message: str) -> None:
        job = self.db.get(GenerationJob, job_id)
        if job is None:
            return
        course = self.db.get(Course, job.course_id)
        if course is not None and not course.is_deleted:
            course.status = CourseStatus.FAILED
        job.status = JobStatus.FAILED
        job.error_code = "audio_generation_failed"
        job.error_message = message[:2000]
        job.finished_at = datetime.utcnow()
        self.db.commit()
