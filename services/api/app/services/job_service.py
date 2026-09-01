from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.course import ArticleText, Course
from app.models.file_resource import FileResource, ResourceKind, ResourceStatus, ResourceVariant
from app.models.generation_job import GenerationJob, JobStatus, JobTargetType, JobType
from app.schemas.job import DownloadRequestRead, GenerationJobRead
from app.services.audio_generation_service import AudioGenerationService
from app.services.course_export_service import CourseExportService
from app.services.course_service import latest_article_text_for_course, request_audio_generation
from app.services.file_resource_service import FileResourceService
from app.services.url_import_service import UrlImportService
from app.worker_client import enqueue_generation_job

RESOURCE_JOB_TYPES = {
    JobType.TTS_GENERATE,
    JobType.COURSE_EXPORT_MARKDOWN,
    JobType.COURSE_EXPORT_DOCX,
    JobType.COURSE_EXPORT_PDF,
}


@dataclass(frozen=True)
class DownloadRequestResult:
    status: str
    job_id: str | None = None
    job_type: str | None = None
    resource_id: str | None = None
    download_url: str | None = None
    message: str | None = None


def course_export_job_type(export_format: str) -> JobType:
    normalized = export_format.strip().lower()
    if normalized in {"markdown", "md"}:
        return JobType.COURSE_EXPORT_MARKDOWN
    if normalized == "docx":
        return JobType.COURSE_EXPORT_DOCX
    if normalized == "pdf":
        return JobType.COURSE_EXPORT_PDF
    raise ValueError("Unsupported export format")


def course_export_variant(export_format: str) -> ResourceVariant:
    normalized = export_format.strip().lower()
    if normalized in {"markdown", "md"}:
        return ResourceVariant.MARKDOWN
    if normalized == "docx":
        return ResourceVariant.DOCX
    if normalized == "pdf":
        return ResourceVariant.PDF
    raise ValueError("Unsupported export format")


def job_format_for_job_type(job_type: JobType) -> str | None:
    if job_type == JobType.COURSE_EXPORT_MARKDOWN:
        return "markdown"
    if job_type == JobType.COURSE_EXPORT_DOCX:
        return "docx"
    if job_type == JobType.COURSE_EXPORT_PDF:
        return "pdf"
    return None


def is_resource_job(job_type: JobType) -> bool:
    return job_type in RESOURCE_JOB_TYPES


def build_course_export_fingerprint(course: Course, export_format: str, article_text: ArticleText | None) -> str:
    payload = json.dumps(
        [
            "course-export",
            course.id,
            course.title,
            export_format.strip().lower(),
            article_text.content_hash if article_text is not None else "",
            article_text.content_markdown if article_text is not None else "",
            article_text.version if article_text is not None else 0,
        ],
        ensure_ascii=False,
        sort_keys=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def get_job_or_none(db: Session, job_id: str) -> GenerationJob | None:
    return db.get(GenerationJob, job_id)


def get_job_or_raise(db: Session, job_id: str) -> GenerationJob:
    job = get_job_or_none(db, job_id)
    if job is None:
        raise ValueError(f"Generation job not found: {job_id}")
    return job


def serialize_job(db: Session, job: GenerationJob) -> GenerationJobRead:
    course = db.get(Course, job.course_id)
    resource = db.get(FileResource, job.result_resource_id) if job.result_resource_id else None
    download_url = None
    if resource is not None:
        fallback_path = job_download_fallback_path(job)
        if fallback_path is not None:
            download_url = resource_download_url(db, job, resource, fallback_path=fallback_path)
    return GenerationJobRead(
        id=job.id,
        course_id=job.course_id,
        target_type=job.target_type,
        target_id=job.target_id,
        target_label=course.title if course is not None else None,
        job_type=job.job_type.value,
        status=job.status.value,
        provider=job.provider,
        fallback_provider=job.fallback_provider,
        tier=job.tier,
        progress_current=job.progress_current,
        progress_total=job.progress_total,
        result_resource_id=job.result_resource_id,
        download_url=download_url,
        error_code=job.error_code,
        error_message=job.error_message,
        started_at=job.started_at,
        finished_at=job.finished_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def list_jobs(db: Session, *, user_id: str, scope: str | None = None) -> list[GenerationJobRead]:
    query = (
        select(GenerationJob)
        .join(Course, Course.id == GenerationJob.course_id)
        .where(Course.user_id == user_id, Course.is_deleted.is_(False))
    )
    if scope == "resource":
        query = query.where(GenerationJob.job_type.in_(RESOURCE_JOB_TYPES))
    jobs = list(
        db.scalars(
            query.order_by(
                GenerationJob.created_at.desc().nullslast(),
                GenerationJob.started_at.desc().nullslast(),
                GenerationJob.id.desc(),
            )
        )
    )
    return [serialize_job(db, job) for job in jobs]


def find_active_job_for_target(
    db: Session,
    *,
    course_id: str,
    job_type: JobType,
    fingerprint: str | None = None,
) -> GenerationJob | None:
    query = select(GenerationJob).where(
        GenerationJob.course_id == course_id,
        GenerationJob.job_type == job_type,
        GenerationJob.status.in_([JobStatus.PENDING, JobStatus.RUNNING]),
    )
    if fingerprint:
        query = query.where(GenerationJob.input_json.contains(fingerprint))
    return db.scalar(
        query.order_by(
            GenerationJob.created_at.desc().nullslast(),
            GenerationJob.started_at.desc().nullslast(),
            GenerationJob.id.desc(),
        )
    )


def request_course_download(db: Session, course: Course, export_format: str) -> DownloadRequestResult:
    normalized = export_format.strip().lower()
    resource_service = FileResourceService(db)

    if normalized == "audio":
        current_resource = None
        if course.current_audio_resource_id is not None:
            current_resource = db.get(FileResource, course.current_audio_resource_id)
        if current_resource is not None and current_resource.status == ResourceStatus.READY:
            return DownloadRequestResult(
                status="ready",
                resource_id=current_resource.id,
                download_url=resource_download_url(db, None, current_resource, fallback_path=f"/courses/{course.id}/audio-download"),
                job_type=JobType.TTS_GENERATE.value,
            )
        job = request_audio_generation(db, course)
        return DownloadRequestResult(
            status="pending",
            job_id=job.id,
            job_type=job.job_type.value,
            message="audio_generation_queued",
        )

    job_type = course_export_job_type(normalized)
    variant = course_export_variant(normalized)
    article_text = latest_article_text_for_course(course)
    fingerprint = build_course_export_fingerprint(course, normalized, article_text)
    existing_resource = resource_service.get_resource_by_fingerprint(fingerprint)
    if existing_resource is not None and existing_resource.status == ResourceStatus.READY:
        return DownloadRequestResult(
            status="ready",
            resource_id=existing_resource.id,
            download_url=resource_download_url(
                db,
                None,
                existing_resource,
                fallback_path=f"/courses/{course.id}/exports/{normalized}",
            ),
            job_type=job_type.value,
        )

    active_job = find_active_job_for_target(db, course_id=course.id, job_type=job_type, fingerprint=fingerprint)
    if active_job is None:
        job = GenerationJob(
            course_id=course.id,
            target_type=JobTargetType.COURSE.value,
            target_id=course.id,
            job_type=job_type,
            status=JobStatus.PENDING,
            input_json=json.dumps({"format": normalized, "fingerprint": fingerprint}, ensure_ascii=False),
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        enqueue_generation_job(job.id)
    else:
        job = active_job

    return DownloadRequestResult(
        status="pending",
        job_id=job.id,
        job_type=job.job_type.value,
        message="download_generation_queued",
    )


def run_generation_job(db: Session, job_id: str) -> dict[str, str]:
    job = get_job_or_raise(db, job_id)

    if job.job_type == JobType.URL_IMPORT:
        result = UrlImportService(db).run_import_job(job_id)
        return {"course_id": result.course_id, "job_id": result.job_id, "status": result.status}

    if job.job_type == JobType.TTS_GENERATE:
        result = AudioGenerationService(db).generate_for_job(job_id)
        return {"course_id": result.course_id, "job_id": result.job_id, "status": "succeeded"}

    if job.job_type in {JobType.COURSE_EXPORT_MARKDOWN, JobType.COURSE_EXPORT_DOCX, JobType.COURSE_EXPORT_PDF}:
        result = run_course_export_job(db, job)
        return {
            "course_id": result["course_id"],
            "job_id": result["job_id"],
            "status": result["status"],
        }

    raise ValueError(f"Unsupported job type: {job.job_type.value}")


def run_course_export_job(db: Session, job: GenerationJob) -> dict[str, str]:
    course = db.get(Course, job.course_id)
    if course is None or course.is_deleted:
        raise ValueError(f"Course not found: {job.course_id}")

    try:
        payload = json.loads(job.input_json or "{}")
    except json.JSONDecodeError as exc:
        job.status = JobStatus.FAILED
        job.error_code = "invalid_job_input"
        job.error_message = "Course export job input is invalid"
        job.finished_at = datetime.utcnow()
        db.commit()
        raise ValueError("Course export job input is invalid") from exc

    export_format = str(payload.get("format") or job_format_for_job_type(job.job_type) or "").strip().lower()
    if export_format not in {"markdown", "docx", "pdf"}:
        raise ValueError("Unsupported export format")

    fingerprint = str(payload.get("fingerprint") or "")
    resource_service = FileResourceService(db)
    existing_resource = resource_service.get_resource_by_fingerprint(fingerprint) if fingerprint else None
    if existing_resource is not None and existing_resource.status == ResourceStatus.READY:
        job.status = JobStatus.SUCCEEDED
        job.progress_current = 1
        job.progress_total = 1
        job.result_resource_id = existing_resource.id
        job.error_code = None
        job.error_message = None
        job.finished_at = datetime.utcnow()
        db.commit()
        return {"course_id": course.id, "job_id": job.id, "status": "succeeded"}

    job.status = JobStatus.RUNNING
    job.started_at = job.started_at or datetime.utcnow()
    job.progress_current = 0
    job.progress_total = 1
    db.flush()

    export = CourseExportService(db).export_content(course, export_format)
    resource = resource_service.create_resource_from_bytes(
        user_id=course.user_id,
        owner_type=JobTargetType.COURSE.value,
        owner_id=course.id,
        resource_kind=ResourceKind.EXPORT,
        resource_variant=course_export_variant(export_format),
        data=export.data,
        content_type=export.media_type,
        title=course.title,
        filename=export.filename,
        source_fingerprint=fingerprint or None,
        metadata_json=json.dumps(
            {
                "job_id": job.id,
                "course_id": course.id,
                "format": export_format,
            },
            ensure_ascii=False,
        ),
    )
    job.status = JobStatus.SUCCEEDED
    job.progress_current = 1
    job.progress_total = 1
    job.result_resource_id = resource.id
    job.error_code = None
    job.error_message = None
    job.finished_at = datetime.utcnow()
    db.commit()
    return {"course_id": course.id, "job_id": job.id, "status": "succeeded"}


def resource_download_url(
    db: Session,
    _job: GenerationJob | None,
    resource: FileResource,
    *,
    fallback_path: str,
) -> str:
    return FileResourceService(db).resource_download_url(resource, fallback_path=fallback_path)


def job_download_fallback_path(job: GenerationJob) -> str | None:
    if job.job_type == JobType.TTS_GENERATE:
        return f"/courses/{job.course_id}/audio-download"
    if job.job_type in {JobType.COURSE_EXPORT_MARKDOWN, JobType.COURSE_EXPORT_DOCX, JobType.COURSE_EXPORT_PDF}:
        export_format = job_format_for_job_type(job.job_type)
        if export_format is not None:
            return f"/courses/{job.course_id}/exports/{export_format}"
    return None
