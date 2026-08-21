import json
from pathlib import Path
import wave

from app.models.course import AudioAsset, Course, CourseSection, CourseStatus, Sentence
from app.models.generation_job import GenerationJob, JobStatus, JobType
from app.models.tts import TTSSegment, TTSUsageEvent
from app.services.audio_generation_service import AudioGenerationService
from app.services.course_service import create_text_course
from app.services.media_compression import MediaCompressionService
from app.services.object_storage import StoredObject
from app.services.tts_router import TTSRouter
from app.services.tts_types import TTSSegmentResult, TTSSentenceTiming, TTSProviderError


def test_audio_generation_service_writes_asset_and_sentence_timeline(db_session, tmp_path):
    course = create_text_course(
        db_session,
        user_id="test_user",
        title="生成音频",
        source_type="manual_text",
        text="第一句。第二句。",
    )
    course.status = CourseStatus.AUDIO_GENERATING
    job = GenerationJob(course_id=course.id, job_type=JobType.TTS_GENERATE)
    db_session.add(job)
    db_session.commit()

    service = AudioGenerationService(
        db_session,
        output_dir=tmp_path,
        media_compression=make_media_compression_service(),
    )
    result = service.generate_for_job(job.id)

    db_session.expire_all()
    stored_course = db_session.get(Course, course.id)
    stored_job = db_session.get(GenerationJob, job.id)
    sentences = (
        db_session.query(Sentence)
        .filter(Sentence.course_id == course.id)
        .order_by(Sentence.index)
        .all()
    )
    assets = db_session.query(AudioAsset).filter(AudioAsset.course_id == course.id).all()

    assert result.course_id == course.id
    assert stored_course.status == CourseStatus.READY
    assert stored_course.duration_seconds > 0
    assert stored_course.current_audio_asset_id == assets[0].id
    assert stored_job.status == JobStatus.SUCCEEDED
    assert stored_job.started_at is not None
    assert stored_job.finished_at is not None
    assert len(assets) == 1
    assert assets[0].provider == "fake"
    assert assets[0].format == "mp3"
    assert assets[0].content_type == "audio/mpeg"
    assert json.loads(assets[0].metadata_json)["compression"]["status"] == "compressed"
    assert Path(assets[0].object_path).exists()
    assert [sentence.generation_status for sentence in sentences] == ["succeeded", "succeeded"]
    assert sentences[0].audio_start_seconds == 0
    assert sentences[0].audio_end_seconds <= sentences[1].audio_start_seconds


def test_auto_provider_mode_uses_default_segment_providers(db_session, tmp_path, monkeypatch):
    course = create_text_course(
        db_session,
        user_id="free_user",
        title="自动真实路由",
        source_type="manual_text",
        text="第一句。第二句。",
    )
    job = GenerationJob(course_id=course.id, job_type=JobType.TTS_GENERATE)
    db_session.add(job)
    db_session.commit()

    edge_provider = ConfigurableStubSegmentProvider(
        output_dir=tmp_path,
        provider_id="edge_tts",
        response_format="mp3",
    )
    monkeypatch.setattr(
        "app.services.audio_generation_service.build_default_segment_providers",
        lambda output_dir: {"edge_tts": edge_provider},
    )

    service = AudioGenerationService(
        db_session,
        output_dir=tmp_path,
        provider_mode="auto",
        media_compression=make_media_compression_service(),
    )
    service.generate_for_job(job.id)

    asset = db_session.query(AudioAsset).filter(AudioAsset.course_id == course.id).one()
    assert asset.provider == "edge_tts"
    assert len(edge_provider.calls) == 1


class FailingSegmentProvider:
    provider_id = "tencent_cloud_tts"

    def synthesize_segment(self, request):
        raise TTSProviderError("simulated upstream timeout", code="upstream_timeout", retryable=True)


class StubSegmentProvider:
    provider_id = "aws_polly_standard"

    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.calls = []

    def synthesize_segment(self, request):
        self.calls.append(request)
        audio_path = self.output_dir / f"{request.course_id}-{request.segment_index}.wav"
        _write_silent_wav(audio_path, duration_seconds=1)
        return TTSSegmentResult(
            provider_id=self.provider_id,
            model_id=request.model_id,
            voice_id=request.voice_id,
            audio_path=audio_path,
            duration_seconds=1,
            character_count=len(request.text),
            byte_size=audio_path.stat().st_size,
            response_format="wav",
        )


class ConfigurableFailingSegmentProvider:
    def __init__(self, provider_id: str):
        self.provider_id = provider_id

    def synthesize_segment(self, request):
        raise TTSProviderError("simulated upstream timeout", code="upstream_timeout", retryable=True)


class ConfigurableStubSegmentProvider:
    def __init__(self, *, output_dir: Path, provider_id: str, response_format: str):
        self.output_dir = output_dir
        self.provider_id = provider_id
        self.response_format = response_format
        self.calls = []

    def synthesize_segment(self, request):
        self.calls.append(request)
        audio_path = self.output_dir / f"{request.course_id}-{request.segment_index}.{request.response_format}"
        _write_silent_wav(audio_path, duration_seconds=1)
        return TTSSegmentResult(
            provider_id=self.provider_id,
            model_id=request.model_id,
            voice_id=request.voice_id,
            audio_path=audio_path,
            duration_seconds=1,
            character_count=len(request.text),
            byte_size=audio_path.stat().st_size,
            response_format=request.response_format,
        )


class TimedEdgeSegmentProvider:
    provider_id = "edge_tts"

    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.calls = []

    def synthesize_segment(self, request):
        self.calls.append(request)
        audio_path = self.output_dir / f"{request.course_id}-{request.segment_index}.mp3"
        _write_silent_wav(audio_path, duration_seconds=5)
        return TTSSegmentResult(
            provider_id=self.provider_id,
            model_id=request.model_id,
            voice_id=request.voice_id,
            audio_path=audio_path,
            duration_seconds=5,
            character_count=len(request.text),
            byte_size=audio_path.stat().st_size,
            response_format=request.response_format,
            sentence_timings=(
                TTSSentenceTiming(sentence_index=0, start_seconds=0.0, end_seconds=3.5),
                TTSSentenceTiming(sentence_index=1, start_seconds=3.5, end_seconds=5.0),
            ),
        )


class RecordingObjectStorage:
    def __init__(self):
        self.calls = []

    def upload_file(self, source_path: Path, *, object_key: str, content_type: str) -> StoredObject:
        self.calls.append({"source_path": source_path, "object_key": object_key, "content_type": content_type})
        return StoredObject(
            storage_backend="r2",
            bucket="pagealong-media",
            object_key=object_key,
            object_path=f"https://media.pagealong.test/{object_key}",
            content_type=content_type,
            byte_size=123,
            etag='"etag-audio"',
            checksum_sha256="a" * 64,
        )


def test_audio_generation_falls_back_and_records_segment_usage(db_session, tmp_path):
    course = create_text_course(
        db_session,
        user_id="paid_user",
        title="真实路由",
        source_type="manual_text",
        text="第一句。第二句。",
    )
    course.status = CourseStatus.AUDIO_GENERATING
    job = GenerationJob(course_id=course.id, job_type=JobType.TTS_GENERATE)
    db_session.add(job)
    db_session.commit()

    fallback_provider = StubSegmentProvider(tmp_path)
    service = AudioGenerationService(
        db_session,
        output_dir=tmp_path,
        provider_mode="real",
        router=TTSRouter(paid_user_ids={"paid_user"}),
        segment_providers={
            "tencent_cloud_tts": FailingSegmentProvider(),
            "aws_polly_standard": fallback_provider,
        },
        media_compression=make_media_compression_service(),
    )

    result = service.generate_for_job(job.id)

    db_session.expire_all()
    stored_job = db_session.get(GenerationJob, job.id)
    assets = db_session.query(AudioAsset).filter(AudioAsset.course_id == course.id).all()
    sections = db_session.query(CourseSection).filter(CourseSection.course_id == course.id).all()
    segments = db_session.query(TTSSegment).filter(TTSSegment.job_id == job.id).order_by(TTSSegment.provider).all()
    usage_events = db_session.query(TTSUsageEvent).filter(TTSUsageEvent.job_id == job.id).all()

    assert result.course_id == course.id
    assert stored_job.status == JobStatus.SUCCEEDED
    assert stored_job.provider == "tencent_cloud_tts"
    assert stored_job.fallback_provider == "aws_polly_standard"
    assert stored_job.tier == "paid"
    assert len(assets) == 1
    assert assets[0].provider == "aws_polly_standard"
    assert assets[0].model_id == "standard"
    assert assets[0].tier == "paid"
    assert Path(assets[0].object_path).exists()
    assert len(sections) == 1
    assert len(segments) == 2
    assert {segment.status for segment in segments} == {"failed", "succeeded"}
    assert any(segment.provider == "aws_polly_standard" for segment in segments)
    assert len(usage_events) == 2
    assert {event.status for event in usage_events} == {"committed", "released"}
    assert len(fallback_provider.calls) == 1

    service.generate_for_job(job.id)
    db_session.expire_all()

    assert len(fallback_provider.calls) == 1
    assert db_session.query(TTSUsageEvent).filter(TTSUsageEvent.job_id == job.id).count() == 2


def test_edge_generation_uses_and_reuses_provider_sentence_timings(db_session, tmp_path):
    course = create_text_course(
        db_session,
        user_id="free_user",
        title="精确时间轴",
        source_type="manual_text",
        text="第一句。第二句。",
    )
    job = GenerationJob(course_id=course.id, job_type=JobType.TTS_GENERATE)
    db_session.add(job)
    db_session.commit()

    provider = TimedEdgeSegmentProvider(tmp_path)
    service = AudioGenerationService(
        db_session,
        output_dir=tmp_path,
        provider_mode="real",
        router=TTSRouter(paid_user_ids=set()),
        segment_providers={"edge_tts": provider},
        media_compression=make_media_compression_service(),
    )

    service.generate_for_job(job.id)

    sentences = (
        db_session.query(Sentence)
        .filter(Sentence.course_id == course.id)
        .order_by(Sentence.index)
        .all()
    )
    segment = db_session.query(TTSSegment).filter(TTSSegment.job_id == job.id).one()
    assert [(sentence.audio_start_seconds, sentence.audio_end_seconds) for sentence in sentences] == [
        (0.0, 3.5),
        (3.5, 5.0),
    ]
    assert json.loads(segment.timing_json) == [
        {"sentence_index": 0, "start_seconds": 0.0, "end_seconds": 3.5},
        {"sentence_index": 1, "start_seconds": 3.5, "end_seconds": 5.0},
    ]

    for sentence in sentences:
        sentence.audio_start_seconds = None
        sentence.audio_end_seconds = None
    db_session.commit()

    service.generate_for_job(job.id)
    db_session.expire_all()

    reused_sentences = (
        db_session.query(Sentence)
        .filter(Sentence.course_id == course.id)
        .order_by(Sentence.index)
        .all()
    )
    assert len(provider.calls) == 1
    assert [(sentence.audio_start_seconds, sentence.audio_end_seconds) for sentence in reused_sentences] == [
        (0.0, 3.5),
        (3.5, 5.0),
    ]


def test_free_edge_fallback_to_kokoro_uses_kokoro_wav_format(db_session, tmp_path, monkeypatch):
    course = create_text_course(
        db_session,
        user_id="free_user",
        title="免费回退",
        source_type="manual_text",
        text="第一句。第二句。",
    )
    job = GenerationJob(course_id=course.id, job_type=JobType.TTS_GENERATE)
    db_session.add(job)
    db_session.commit()
    monkeypatch.setattr("app.services.audio_generation_service.settings.media_compression_enabled", False)

    kokoro_provider = ConfigurableStubSegmentProvider(
        output_dir=tmp_path,
        provider_id="kokoro_onnx_cpu",
        response_format="wav",
    )
    service = AudioGenerationService(
        db_session,
        output_dir=tmp_path,
        provider_mode="real",
        router=TTSRouter(paid_user_ids=set()),
        segment_providers={
            "edge_tts": ConfigurableFailingSegmentProvider("edge_tts"),
            "kokoro_onnx_cpu": kokoro_provider,
        },
    )

    service.generate_for_job(job.id)

    asset = db_session.query(AudioAsset).filter(AudioAsset.course_id == course.id).one()
    assert asset.provider == "kokoro_onnx_cpu"
    assert asset.format == "wav"
    assert asset.content_type == "audio/wav"
    assert kokoro_provider.calls[0].response_format == "wav"
    assert kokoro_provider.calls[0].voice_id == "zf_xiaobei"


def test_generated_assets_upload_to_object_storage_when_configured(db_session, tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.audio_generation_service.settings.tts_storage_backend", "r2")
    course = create_text_course(
        db_session,
        user_id="paid_user",
        title="存储状态",
        source_type="manual_text",
        text="第一句。",
    )
    job = GenerationJob(course_id=course.id, job_type=JobType.TTS_GENERATE)
    db_session.add(job)
    db_session.commit()
    provider = ConfigurableStubSegmentProvider(
        output_dir=tmp_path,
        provider_id="aws_polly_standard",
        response_format="wav",
    )
    object_storage = RecordingObjectStorage()
    service = AudioGenerationService(
        db_session,
        output_dir=tmp_path,
        provider_mode="real",
        router=TTSRouter(paid_user_ids={"paid_user"}),
        segment_providers={"aws_polly_standard": provider},
        provider_health=None,
        object_storage=object_storage,
        media_compression=make_media_compression_service(),
    )
    service.provider_health = service.provider_health.__class__(tencent_capacity_available=False)

    service.generate_for_job(job.id)

    asset = db_session.query(AudioAsset).filter(AudioAsset.course_id == course.id).one()
    assert asset.storage_backend == "r2"
    assert asset.bucket == "pagealong-media"
    assert asset.object_key == f"audio/{course.id}/{asset.id}.mp3"
    assert asset.object_path == f"https://media.pagealong.test/audio/{course.id}/{asset.id}.mp3"
    assert asset.content_type == "audio/mpeg"
    assert asset.format == "mp3"
    assert asset.byte_size == 123
    assert asset.etag == '"etag-audio"'
    assert asset.checksum_sha256 == "a" * 64
    assert object_storage.calls[0]["source_path"].exists()
    assert object_storage.calls[0]["object_key"] == f"audio/{course.id}/{asset.id}.mp3"
    assert object_storage.calls[0]["content_type"] == "audio/mpeg"


def test_free_generation_blocks_text_over_free_character_cap(db_session, tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.audio_generation_service.settings.free_tts_max_course_characters", 4)
    course = create_text_course(
        db_session,
        user_id="free_user",
        title="超长免费文本",
        source_type="manual_text",
        text="第一句。第二句。",
    )
    job = GenerationJob(course_id=course.id, job_type=JobType.TTS_GENERATE)
    db_session.add(job)
    db_session.commit()
    provider = ConfigurableStubSegmentProvider(
        output_dir=tmp_path,
        provider_id="edge_tts",
        response_format="mp3",
    )
    service = AudioGenerationService(
        db_session,
        output_dir=tmp_path,
        provider_mode="real",
        router=TTSRouter(paid_user_ids=set()),
        segment_providers={"edge_tts": provider},
    )

    try:
        service.generate_for_job(job.id)
    except ValueError as exc:
        assert "超过了 4 个字" in str(exc)
    else:
        raise AssertionError("Expected free character limit to block generation")

    db_session.expire_all()
    stored_job = db_session.get(GenerationJob, job.id)
    assert stored_job.status == JobStatus.FAILED
    assert len(provider.calls) == 0


def _write_silent_wav(path: Path, *, duration_seconds: int) -> None:
    sample_rate = 8_000
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(b"\x00\x00" * sample_rate * duration_seconds)


def make_media_compression_service():
    def fake_run(cmd, check, capture_output, text, timeout):
        output = Path(cmd[-1])
        output.write_bytes(b"mp3-bytes")
        return type("Result", (), {"returncode": 0})()

    return MediaCompressionService(ffmpeg_runner=fake_run)
