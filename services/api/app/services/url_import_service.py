from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.course import Course, CourseStatus, SourceType
from app.models.generation_job import GenerationJob, JobStatus, JobType
from app.services.course_service import (
    create_import_placeholder_course,
    create_url_import_job,
    persist_article_content,
    request_audio_generation,
)
from app.services.article_image_import import import_article_images
from app.services.tts_limits import TTSGenerationLimitExceeded
from app.services.web_extraction import (
    ExtractionError,
    ExtractedArticle,
    extract_article_content,
    extract_extension_article_content,
)
from app.services.web_fetcher import WebFetchError, fetch_public_html


@dataclass(frozen=True)
class ImportUrlInput:
    url: str
    title: str | None = None
    series_id: str | None = None
    series_title: str | None = None
    tags: list[str] | None = None
    tag_ids: list[str] | None = None
    series_tags: list[str] | None = None
    is_starred: bool = False
    auto_generate_audio: bool = False


@dataclass(frozen=True)
class ExtensionImageInput:
    url: str
    alt: str = ""
    width: int | None = None
    height: int | None = None
    nearby_text: str = ""


@dataclass(frozen=True)
class ExtensionSyncInput:
    url: str
    title: str | None = None
    article_html: str = ""
    text_excerpt: str = ""
    images: list[ExtensionImageInput] | None = None
    series_id: str | None = None
    series_title: str | None = None
    tags: list[str] | None = None
    tag_ids: list[str] | None = None
    series_tags: list[str] | None = None
    is_starred: bool = False
    client_metadata: dict[str, object] | None = None


@dataclass(frozen=True)
class UrlImportResult:
    course_id: str
    job_id: str
    status: str


class UrlImportService:
    def __init__(self, db: Session):
        self.db = db

    def create_import_course(self, user_id: str, payload: ImportUrlInput) -> tuple[Course, GenerationJob]:
        title = (payload.title or "正在提取网页").strip() or "正在提取网页"
        course = create_import_placeholder_course(
            self.db,
            user_id,
            title=title,
            source_type=SourceType.URL_IMPORT,
            series_id=payload.series_id,
            series_title=payload.series_title,
            tag_ids=payload.tag_ids,
            tags=payload.tags,
            series_tags=payload.series_tags,
            is_starred=payload.is_starred,
        )
        job = create_url_import_job(
            self.db,
            course,
            json.dumps(
                {
                    "url": payload.url,
                    "auto_generate_audio": payload.auto_generate_audio,
                },
                ensure_ascii=False,
            ),
        )
        self.db.commit()
        self.db.refresh(course)
        self.db.refresh(job)
        return course, job

    def create_extension_sync_course(self, user_id: str, payload: ExtensionSyncInput) -> tuple[Course, GenerationJob]:
        title = (payload.title or "正在同步网页").strip() or "正在同步网页"
        course = create_import_placeholder_course(
            self.db,
            user_id,
            title=title,
            source_type=SourceType.CHROME_EXTENSION,
            series_id=payload.series_id,
            series_title=payload.series_title,
            tag_ids=payload.tag_ids,
            tags=payload.tags,
            series_tags=payload.series_tags,
            is_starred=payload.is_starred,
        )
        job_payload = {
            "mode": "extension_sync",
            "auto_generate_audio": True,
            "url": payload.url,
            "title": payload.title,
            "article_html": payload.article_html,
            "text_excerpt": payload.text_excerpt,
            "images": [
                {
                    "url": image.url,
                    "alt": image.alt,
                    "width": image.width,
                    "height": image.height,
                    "nearby_text": image.nearby_text,
                }
                for image in payload.images or []
            ],
            "client_metadata": payload.client_metadata or {},
        }
        job = create_url_import_job(self.db, course, json.dumps(job_payload, ensure_ascii=False))
        self.db.commit()
        self.db.refresh(course)
        self.db.refresh(job)
        return course, job

    def run_import_job(self, job_id: str) -> UrlImportResult:
        job = self._get_job(job_id)
        course = self._get_course(job.course_id)
        if job.status == JobStatus.SUCCEEDED:
            return UrlImportResult(course.id, job.id, course.status.value)
        if job.status == JobStatus.RUNNING and job.started_at is not None:
            return UrlImportResult(course.id, job.id, job.status.value)
        try:
            payload = json.loads(job.input_json or "{}")
        except json.JSONDecodeError as exc:
            self._mark_failed(job_id, "invalid_job_input", "URL import job input is invalid")
            raise ValueError("URL import job input is invalid") from exc

        url = str(payload.get("url") or "").strip()
        if not url:
            self._mark_failed(job_id, "missing_url", "URL import job input is missing url")
            raise ValueError("URL import job input is missing url")

        try:
            mode = str(payload.get("mode") or "console_url_import")
            auto_generate_audio = bool(payload.get("auto_generate_audio"))
            job.status = JobStatus.RUNNING
            job.started_at = datetime.utcnow()
            course.status = CourseStatus.EXTRACTING_TEXT
            self.db.flush()

            extracted, image_base_url, extra_metadata = self._extract_for_job(payload, url=url, mode=mode)
            extraction_metadata = {**extracted.extraction_metadata, **extra_metadata}
            article_text = persist_article_content(
                self.db,
                course,
                title=extracted.title,
                tts_text=extracted.normalized.tts_text,
                content_markdown=extracted.normalized.content_markdown,
                content_hash=extracted.normalized.content_hash,
                source_metadata_json=json.dumps(extracted.source_metadata, ensure_ascii=False),
                extraction_metadata_json=json.dumps(extraction_metadata, ensure_ascii=False),
                source_quality="extracted",
                confirmed_by_user=auto_generate_audio,
                course_status=CourseStatus.TEXT_READY if auto_generate_audio else CourseStatus.NEEDS_REVIEW,
            )
            image_result = import_article_images(
                self.db,
                course=course,
                article_text=article_text,
                markdown=article_text.content_markdown,
                base_url=image_base_url,
            )
            extraction_metadata["images"] = {
                "imported": image_result.imported_count,
                "failed": image_result.failed_count,
                "skipped": image_result.skipped_count,
            }
            article_text.extraction_metadata_json = json.dumps(extraction_metadata, ensure_ascii=False)
            job.status = JobStatus.SUCCEEDED
            job.error_code = None
            job.error_message = None
            job.finished_at = datetime.utcnow()
            self.db.commit()
            if auto_generate_audio:
                self.db.refresh(course)
                self._auto_request_audio_if_needed(course, auto_generate_audio)
            return UrlImportResult(course.id, job.id, course.status.value)
        except (WebFetchError, ExtractionError) as exc:
            self.db.rollback()
            self._mark_failed(job_id, getattr(exc, "code", "url_import_failed"), str(exc))
            raise
        except Exception as exc:
            self.db.rollback()
            self._mark_failed(job_id, "url_import_failed", str(exc))
            raise

    def _get_job(self, job_id: str) -> GenerationJob:
        job = self.db.get(GenerationJob, job_id)
        if job is None or job.job_type != JobType.URL_IMPORT:
            raise ValueError(f"URL import job not found: {job_id}")
        return job

    def _get_course(self, course_id: str) -> Course:
        course = self.db.get(Course, course_id)
        if course is None or course.is_deleted:
            raise ValueError(f"Course not found: {course_id}")
        return course

    def _mark_failed(self, job_id: str, code: str, message: str) -> None:
        job = self.db.get(GenerationJob, job_id)
        if job is None:
            return
        job.status = JobStatus.FAILED
        job.error_code = code
        job.error_message = message[:2000]
        job.finished_at = datetime.utcnow()
        course = self.db.get(Course, job.course_id)
        if course is not None:
            course.status = CourseStatus.FAILED
        self.db.commit()

    def mark_queue_failed(self, job_id: str, message: str) -> None:
        self._mark_failed(job_id, "queue_unavailable", message)

    def mark_queue_running(self, job_id: str) -> None:
        job = self._get_job(job_id)
        job.status = JobStatus.RUNNING
        self.db.commit()

    def _extract_for_job(
        self,
        payload: dict[str, object],
        *,
        url: str,
        mode: str,
    ) -> tuple[ExtractedArticle, str, dict[str, object]]:
        if mode == "extension_sync":
            try:
                extracted = extract_extension_article_content(
                    article_html=str(payload.get("article_html") or ""),
                    text_excerpt=str(payload.get("text_excerpt") or ""),
                    title=str(payload.get("title") or ""),
                    original_url=url,
                    final_url=url,
                    client_metadata=dict(payload.get("client_metadata") or {}),
                )
                return extracted, url, {"fallback_from_extension_payload": False}
            except ExtractionError:
                fetched = fetch_public_html(url)
                extracted = extract_article_content(
                    fetched.html,
                    original_url=fetched.original_url,
                    final_url=fetched.final_url,
                )
                return extracted, fetched.final_url, {
                    "http_status": fetched.status_code,
                    "content_type": fetched.content_type,
                    "fetch_elapsed_ms": fetched.elapsed_ms,
                    "fallback_from_extension_payload": True,
                }

        fetched = fetch_public_html(url)
        extracted = extract_article_content(
            fetched.html,
            original_url=fetched.original_url,
            final_url=fetched.final_url,
        )
        return extracted, fetched.final_url, {
            "http_status": fetched.status_code,
            "content_type": fetched.content_type,
            "fetch_elapsed_ms": fetched.elapsed_ms,
        }

    def _auto_request_audio_if_needed(self, course: Course, auto_generate_audio: bool) -> None:
        if not auto_generate_audio:
            return
        try:
            request_audio_generation(self.db, course)
        except TTSGenerationLimitExceeded:
            self.db.refresh(course)
            course.status = CourseStatus.TEXT_READY
            self.db.commit()
