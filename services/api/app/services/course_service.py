import json
from datetime import datetime, time, timedelta, timezone
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.course import ArticleImageAsset, ArticleText, AudioAsset, Course, CourseSeries, CourseStatus, Sentence, SourceType
from app.models.file_import import FileImportItem
from app.models.generation_job import GenerationJob, JobStatus, JobType
from app.models.tag import Tag
from app.services.content_metrics import TextContentMetric, measure_text_content
from app.services.object_storage import ObjectStorageService, is_s3_compatible_backend
from app.services.file_resource_service import FileResourceService
from app.services.tts_limits import TTSDailyCourseLimitExceeded, enforce_route_metric_limit
from app.services.tts_router import ProviderHealth, TTSRouter
from app.services.content_normalization import derive_tts_text
from app.services.sentence_service import split_into_sentences
from app.services.tag_service import (
    list_tags as list_tag_models,
    resolve_tags_by_ids,
    sync_course_tags,
    sync_series_courses_tags,
)
from app.worker_client import enqueue_audio_generation

LOCAL_QUOTA_TIMEZONE = ZoneInfo("Asia/Shanghai")


def normalize_tags(tags: list[str] | None) -> list[str]:
    normalized_tags: list[str] = []
    seen: set[str] = set()
    for tag in tags or []:
        normalized = tag.strip()
        if not normalized or normalized in seen:
            continue
        normalized_tags.append(normalized[:128])
        seen.add(normalized)
    return normalized_tags[:20]


def encode_tags(tags: list[str] | None) -> str:
    return json.dumps(normalize_tags(tags), ensure_ascii=False)


def decode_tags(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return normalize_tags([str(item) for item in parsed])


def course_library_type(course: Course) -> str:
    return "series" if course.series_id else "fragmented"


def course_tags(course: Course) -> list[Tag]:
    return list(course.tags)


def course_is_starred(course: Course) -> bool:
    if course.series is not None and not course.series.is_deleted:
        return course.series.is_starred
    return course.is_starred


def get_series_or_raise(db: Session, user_id: str, series_id: str) -> CourseSeries:
    series = db.scalar(
        select(CourseSeries).where(
            CourseSeries.id == series_id,
            CourseSeries.user_id == user_id,
            CourseSeries.is_deleted.is_(False),
        )
    )
    if series is None:
        raise ValueError("Series not found")
    return series


def get_or_create_series(
    db: Session,
    user_id: str,
    series_id: str | None = None,
    series_title: str | None = None,
    tags: list[str] | None = None,
    is_starred: bool | None = None,
) -> CourseSeries | None:
    if series_id:
        series = get_series_or_raise(db, user_id, series_id)
        if tags is not None:
            series.tags_json = encode_tags(tags)
            sync_series_courses_tags(db, series)
        if is_starred is not None:
            series.is_starred = is_starred
        return series

    title = (series_title or "").strip()
    if not title:
        return None

    existing_series = db.scalar(
        select(CourseSeries).where(
            CourseSeries.user_id == user_id,
            CourseSeries.title == title,
            CourseSeries.is_deleted.is_(False),
        )
    )
    if existing_series is not None:
        if tags is not None:
            existing_series.tags_json = encode_tags(tags)
            sync_series_courses_tags(db, existing_series)
        if is_starred is not None:
            existing_series.is_starred = is_starred
        return existing_series

    series = CourseSeries(
        user_id=user_id,
        title=title,
        tags_json=encode_tags(tags),
        is_starred=bool(is_starred),
    )
    db.add(series)
    db.flush()
    return series


def create_text_course(
    db: Session,
    user_id: str,
    title: str,
    source_type: str,
    text: str,
    series_id: str | None = None,
    series_title: str | None = None,
    tag_ids: list[str] | None = None,
    tags: list[str] | None = None,
    series_tags: list[str] | None = None,
    is_starred: bool | None = False,
) -> Course:
    tts_text = derive_tts_text(text) or text.strip()
    series = get_or_create_series(
        db,
        user_id,
        series_id=series_id,
        series_title=series_title,
        tags=series_tags,
        is_starred=is_starred if series_id or series_title else None,
    )
    course = Course(
        user_id=user_id,
        title=title,
        source_type=SourceType(source_type),
        status=CourseStatus.TEXT_READY,
        word_count=measure_text_content(tts_text).count,
        series_id=series.id if series is not None else None,
        tags_json=encode_tags(tags if tag_ids is None else []),
        is_starred=False if series is not None else bool(is_starred),
    )
    db.add(course)
    db.flush()
    sync_course_tags(
        db,
        course,
        direct_tag_ids=tag_ids,
        direct_tag_names=tags,
        series_tag_names=series_tags if series is not None else None,
    )

    article_text = ArticleText(
        course_id=course.id,
        version=1,
        text=tts_text,
        content_markdown=text,
        confirmed_by_user=True,
    )
    db.add(article_text)
    db.flush()

    for index, sentence_text in enumerate(split_into_sentences(tts_text)):
        db.add(
            Sentence(
                course_id=course.id,
                article_text_id=article_text.id,
                index=index,
                paragraph_index=0,
                text=sentence_text,
            )
        )

    db.commit()
    db.refresh(course)
    return course


class AudioGenerationQueueUnavailable(RuntimeError):
    pass


def request_audio_generation(db: Session, course: Course) -> GenerationJob:
    latest_article_text = latest_article_text_for_course(course)
    if latest_article_text is not None and not latest_article_text.confirmed_by_user:
        latest_article_text.confirmed_by_user = True

    existing_job = db.scalar(
        select(GenerationJob)
        .where(
            GenerationJob.course_id == course.id,
            GenerationJob.job_type == JobType.TTS_GENERATE,
            GenerationJob.status.in_([JobStatus.PENDING, JobStatus.RUNNING]),
        )
        .order_by(
            GenerationJob.created_at.desc().nullslast(),
            GenerationJob.started_at.desc().nullslast(),
            GenerationJob.id.desc(),
        )
    )
    if existing_job is not None:
        course.status = CourseStatus.AUDIO_GENERATING
        db.commit()
        db.refresh(course)
        db.refresh(existing_job)
        return existing_job

    ensure_audio_generation_within_limits(db, course)
    course.status = CourseStatus.AUDIO_GENERATING
    job = GenerationJob(
        course_id=course.id,
        job_type=JobType.TTS_GENERATE,
        status=JobStatus.PENDING,
    )
    db.add(job)
    db.commit()
    db.refresh(course)
    db.refresh(job)
    try:
        enqueue_audio_generation(course.id, job.id)
    except Exception as exc:
        _mark_audio_generation_queue_failed(db, job, course, str(exc))
        raise AudioGenerationQueueUnavailable(str(exc)) from exc
    return job


def _mark_audio_generation_queue_failed(db: Session, job: GenerationJob, course: Course, message: str) -> None:
    job.status = JobStatus.FAILED
    job.error_code = "queue_unavailable"
    job.error_message = message[:2000]
    job.finished_at = datetime.utcnow()
    course.status = CourseStatus.FAILED
    db.commit()


@dataclass(frozen=True)
class FailedJobRetry:
    job: GenerationJob
    stage: JobType


def latest_failed_job_for_course(db: Session, course: Course) -> GenerationJob | None:
    return db.scalar(
        select(GenerationJob)
        .where(
            GenerationJob.course_id == course.id,
            GenerationJob.job_type.in_([JobType.URL_IMPORT, JobType.TTS_GENERATE]),
            GenerationJob.status == JobStatus.FAILED,
        )
        .order_by(
            GenerationJob.finished_at.desc().nullslast(),
            GenerationJob.created_at.desc().nullslast(),
            GenerationJob.id.desc(),
        )
    )


def create_retry_job_for_failed_stage(db: Session, course: Course) -> FailedJobRetry:
    failed_job = latest_failed_job_for_course(db, course)
    if failed_job is None:
        raise ValueError("No failed job found for this course")

    if failed_job.job_type == JobType.URL_IMPORT:
        retry_job = GenerationJob(
            course_id=course.id,
            job_type=JobType.URL_IMPORT,
            status=JobStatus.PENDING,
            input_json=failed_job.input_json,
            attempt_count=failed_job.attempt_count + 1,
        )
        course.status = CourseStatus.EXTRACTING_TEXT
        db.add(retry_job)
        db.commit()
        db.refresh(course)
        db.refresh(retry_job)
        return FailedJobRetry(job=retry_job, stage=JobType.URL_IMPORT)

    ensure_audio_generation_within_limits(db, course)
    latest_article_text = latest_article_text_for_course(course)
    if latest_article_text is not None and not latest_article_text.confirmed_by_user:
        latest_article_text.confirmed_by_user = True
    course.status = CourseStatus.AUDIO_GENERATING
    retry_job = GenerationJob(
        course_id=course.id,
        job_type=JobType.TTS_GENERATE,
        status=JobStatus.PENDING,
        attempt_count=failed_job.attempt_count + 1,
    )
    db.add(retry_job)
    db.commit()
    db.refresh(course)
    db.refresh(retry_job)
    return FailedJobRetry(job=retry_job, stage=JobType.TTS_GENERATE)


def estimate_course_tts_characters(course: Course) -> int:
    if course.sentences:
        return sum(len(sentence.text) for sentence in course.sentences)

    latest_article_text = latest_article_text_for_course(course)
    if latest_article_text is None:
        return 0
    return len(latest_article_text.text)


def estimate_course_text_metric(course: Course) -> TextContentMetric:
    if course.sentences:
        return measure_text_content("".join(sentence.text for sentence in course.sentences))

    latest_article_text = latest_article_text_for_course(course)
    if latest_article_text is None:
        return measure_text_content("")
    return measure_text_content(latest_article_text.text)


def ensure_audio_generation_within_limits(db: Session, course: Course) -> None:
    metric = estimate_course_text_metric(course)
    route = TTSRouter().route_for_user(
        user_id=course.user_id,
        estimated_characters=metric.count,
        provider_health=ProviderHealth(),
    )
    enforce_route_metric_limit(route, metric)
    enforce_free_daily_audio_generation_limit(db, course, route.tier)


def enforce_free_daily_audio_generation_limit(db: Session, course: Course, tier: str) -> None:
    limit = settings.free_tts_daily_course_limit
    if tier != "free" or limit <= 0:
        return

    period_start, period_end = local_day_utc_bounds()
    generated_count = db.scalar(
        select(func.count(GenerationJob.id))
        .join(Course, Course.id == GenerationJob.course_id)
        .where(
            Course.user_id == course.user_id,
            Course.is_deleted.is_(False),
            GenerationJob.job_type == JobType.TTS_GENERATE,
            GenerationJob.created_at >= period_start,
            GenerationJob.created_at < period_end,
        )
    )
    if int(generated_count or 0) >= limit:
        raise TTSDailyCourseLimitExceeded(f"免费版每天最多生成 {limit} 次音频")


def local_day_utc_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    current_utc = now or datetime.now(timezone.utc)
    if current_utc.tzinfo is None:
        current_utc = current_utc.replace(tzinfo=timezone.utc)
    local_now = current_utc.astimezone(LOCAL_QUOTA_TIMEZONE)
    local_start = datetime.combine(local_now.date(), time.min, tzinfo=LOCAL_QUOTA_TIMEZONE)
    local_end = local_start + timedelta(days=1)
    return (
        local_start.astimezone(timezone.utc).replace(tzinfo=None),
        local_end.astimezone(timezone.utc).replace(tzinfo=None),
    )


def create_import_placeholder_course(
    db: Session,
    user_id: str,
    title: str,
    source_type: SourceType,
    series_id: str | None = None,
    series_title: str | None = None,
    tag_ids: list[str] | None = None,
    tags: list[str] | None = None,
    series_tags: list[str] | None = None,
    is_starred: bool | None = False,
) -> Course:
    series = get_or_create_series(
        db,
        user_id,
        series_id=series_id,
        series_title=series_title,
        tags=series_tags,
        is_starred=is_starred if series_id or series_title else None,
    )
    course = Course(
        user_id=user_id,
        title=title,
        source_type=source_type,
        status=CourseStatus.EXTRACTING_TEXT,
        series_id=series.id if series is not None else None,
        tags_json=encode_tags(tags if tag_ids is None else []),
        is_starred=False if series is not None else bool(is_starred),
    )
    db.add(course)
    db.flush()
    sync_course_tags(
        db,
        course,
        direct_tag_ids=tag_ids,
        direct_tag_names=tags,
        series_tag_names=series_tags if series is not None else None,
    )
    return course


def create_url_import_job(db: Session, course: Course, input_json: str) -> GenerationJob:
    job = GenerationJob(
        course_id=course.id,
        job_type=JobType.URL_IMPORT,
        status=JobStatus.PENDING,
        input_json=input_json,
    )
    db.add(job)
    db.flush()
    return job


def persist_article_content(
    db: Session,
    course: Course,
    *,
    title: str,
    tts_text: str,
    content_markdown: str,
    content_hash: str,
    source_metadata_json: str,
    extraction_metadata_json: str,
    source_quality: str = "extracted",
    confirmed_by_user: bool = False,
    course_status: CourseStatus = CourseStatus.TEXT_READY,
) -> ArticleText:
    course.title = title[:512]
    course.word_count = measure_text_content(tts_text).count
    course.status = course_status
    article_text = ArticleText(
        course_id=course.id,
        version=len(course.article_texts) + 1,
        text=tts_text,
        content_markdown=content_markdown,
        content_hash=content_hash,
        source_metadata_json=source_metadata_json,
        extraction_metadata_json=extraction_metadata_json,
        source_quality=source_quality,
        confirmed_by_user=confirmed_by_user,
    )
    db.add(article_text)
    db.flush()
    for index, sentence_text in enumerate(split_into_sentences(tts_text)):
        db.add(
            Sentence(
                course_id=course.id,
                article_text_id=article_text.id,
                index=index,
                paragraph_index=0,
                text=sentence_text,
            )
        )
    db.flush()
    return article_text


def latest_article_text_for_course(course: Course) -> ArticleText | None:
    if not course.article_texts:
        return None
    return sorted(
        course.article_texts,
        key=lambda item: (item.version, item.created_at or datetime.min, item.id),
        reverse=True,
    )[0]


def course_sort_value(course: Course) -> datetime:
    return course.last_read_at or course.updated_at or course.created_at


def course_matches_query(course: Course, query: str | None) -> bool:
    normalized_query = (query or "").strip().lower()
    if not normalized_query:
        return True
    sentence_text = " ".join(sentence.text for sentence in course.sentences)
    series_title = course.series.title if course.series is not None else ""
    return normalized_query in f"{course.title} {series_title} {sentence_text}".lower()


def course_matches_tag(course: Course, tag: str | None) -> bool:
    normalized_tag = (tag or "").strip()
    if not normalized_tag:
        return True
    return normalized_tag in {item.name for item in course_tags(course)}


def list_courses(
    db: Session,
    user_id: str,
    library_type: str | None = None,
    query: str | None = None,
    tag: str | None = None,
    starred: bool | None = None,
    series_id: str | None = None,
) -> list[Course]:
    courses = list(
        db.scalars(
            select(Course)
            .options(selectinload(Course.series), selectinload(Course.tags))
            .where(
                Course.user_id == user_id,
                Course.is_deleted.is_(False),
            )
        )
    )

    filtered_courses = []
    for course in courses:
        if course.series is not None and course.series.is_deleted:
            continue
        if series_id is not None and course.series_id != series_id:
            continue
        if library_type == "fragmented" and course.series_id is not None:
            continue
        if library_type == "series" and course.series_id is None:
            continue
        if starred is not None and course_is_starred(course) != starred:
            continue
        if not course_matches_tag(course, tag):
            continue
        if not course_matches_query(course, query):
            continue
        filtered_courses.append(course)

    return sorted(filtered_courses, key=course_sort_value, reverse=True)


def active_series_courses(series: CourseSeries) -> list[Course]:
    return [course for course in series.courses if not course.is_deleted]


def series_sort_value(series: CourseSeries) -> datetime:
    last_course_read_at = max(
        (course.last_read_at for course in active_series_courses(series) if course.last_read_at is not None),
        default=None,
    )
    return series.last_read_at or last_course_read_at or series.updated_at or series.created_at


def series_matches_query(series: CourseSeries, query: str | None) -> bool:
    normalized_query = (query or "").strip().lower()
    if not normalized_query:
        return True
    course_titles = " ".join(course.title for course in active_series_courses(series))
    return normalized_query in f"{series.title} {course_titles}".lower()


def series_matches_tag(series: CourseSeries, tag: str | None) -> bool:
    normalized_tag = (tag or "").strip()
    if not normalized_tag:
        return True
    return normalized_tag in decode_tags(series.tags_json)


def list_series(
    db: Session,
    user_id: str,
    query: str | None = None,
    tag: str | None = None,
    starred: bool | None = None,
) -> list[CourseSeries]:
    series_items = list(
        db.scalars(
            select(CourseSeries).where(
                CourseSeries.user_id == user_id,
                CourseSeries.is_deleted.is_(False),
            )
        )
    )
    filtered_series = []
    for series in series_items:
        if starred is not None and series.is_starred != starred:
            continue
        if not series_matches_tag(series, tag):
            continue
        if not series_matches_query(series, query):
            continue
        filtered_series.append(series)
    return sorted(filtered_series, key=series_sort_value, reverse=True)


def update_course_library(
    db: Session,
    user_id: str,
    course: Course,
    library_type: str | None = None,
    series_id: str | None = None,
    series_title: str | None = None,
    tag_ids: list[str] | None = None,
    tags: list[str] | None = None,
    is_starred: bool | None = None,
) -> Course:
    moving_to_series = library_type == "series" or series_id is not None or bool((series_title or "").strip())
    moving_to_fragmented = library_type == "fragmented"

    if moving_to_fragmented:
        if course.series is not None:
            if tag_ids is None and tags is None:
                tags = normalize_tags(decode_tags(course.tags_json) + decode_tags(course.series.tags_json))
            if is_starred is None:
                course.is_starred = course.series.is_starred
        course.series_id = None
        course.series = None

    if moving_to_series:
        series = get_or_create_series(
            db,
            user_id,
            series_id=series_id,
            series_title=series_title,
            tags=tags,
            is_starred=is_starred,
        )
        if series is None and course.series is None:
            raise ValueError("series_id or series_title is required")
        if series is not None:
            course.series_id = series.id
            course.series = series
            if tags is not None:
                course.series.tags_json = encode_tags(tags)
                sync_series_courses_tags(db, course.series)

    if tag_ids is not None:
        resolved_tags = resolve_tags_by_ids(db, user_id, tag_ids)
        course.tags_json = encode_tags([tag.name for tag in resolved_tags])
        sync_course_tags(db, course, direct_tag_ids=tag_ids)
    elif tags is not None and not moving_to_series:
        course.tags_json = encode_tags(tags)
        sync_course_tags(db, course, direct_tag_names=tags)
    elif course.series is None:
        sync_course_tags(db, course, direct_tag_names=decode_tags(course.tags_json))

    if course.series is not None and is_starred is not None:
        course.series.is_starred = is_starred
    elif course.series is None and is_starred is not None:
        course.is_starred = is_starred

    db.commit()
    db.refresh(course)
    return course


def update_series_metadata(
    db: Session,
    series: CourseSeries,
    title: str | None = None,
    tags: list[str] | None = None,
    is_starred: bool | None = None,
) -> CourseSeries:
    normalized_title = (title or "").strip()
    if normalized_title:
        series.title = normalized_title
    if tags is not None:
        series.tags_json = encode_tags(tags)
        sync_series_courses_tags(db, series)
    if is_starred is not None:
        series.is_starred = is_starred
    db.commit()
    db.refresh(series)
    return series


def move_series_to_fragments(db: Session, series: CourseSeries) -> int:
    courses = active_series_courses(series)
    for course in courses:
        direct_tag_names = normalize_tags(decode_tags(course.tags_json) + decode_tags(series.tags_json))
        course.series_id = None
        course.series = None
        course.tags_json = encode_tags(direct_tag_names)
        sync_course_tags(db, course, direct_tag_names=direct_tag_names)
        course.is_starred = series.is_starred
    series.last_read_course_id = None
    db.commit()
    return len(courses)


def delete_series_with_courses(db: Session, series: CourseSeries) -> int:
    courses = active_series_courses(series)
    for course in courses:
        course.is_deleted = True
        course.status = CourseStatus.DELETED
    series.is_deleted = True
    db.commit()
    return len(courses)


def delete_stored_object(storage_backend: str, object_key: str | None, object_path: str | None) -> int:
    backend = storage_backend.strip().lower()
    if backend == "local":
        if not object_path:
            return 0
        path = Path(object_path)
        path.unlink(missing_ok=True)
        return 1
    if is_s3_compatible_backend(backend):
        if not object_key:
            return 0
        ObjectStorageService.from_settings(backend).delete_object(object_key)
        return 1
    return 0


def delete_course_with_resources(db: Session, course: Course) -> int:
    deleted_objects = 0
    resource_service = FileResourceService(db)
    for audio_asset in db.scalars(select(AudioAsset).where(AudioAsset.course_id == course.id)):
        if audio_asset.resource_id is not None:
            resource = resource_service.get_resource(audio_asset.resource_id)
            if resource is not None:
                deleted_objects += resource_service.delete_resource(resource)
                continue
        deleted_objects += delete_stored_object(audio_asset.storage_backend, audio_asset.object_key, audio_asset.object_path)
    for image_asset in db.scalars(select(ArticleImageAsset).where(ArticleImageAsset.course_id == course.id)):
        if image_asset.resource_id is not None:
            resource = resource_service.get_resource(image_asset.resource_id)
            if resource is not None:
                deleted_objects += resource_service.delete_resource(resource)
                continue
        deleted_objects += delete_stored_object(image_asset.storage_backend, image_asset.object_key, image_asset.object_path)
    for file_item in db.scalars(select(FileImportItem).where(FileImportItem.course_id == course.id)):
        if file_item.resource_id is not None:
            resource = resource_service.get_resource(file_item.resource_id)
            if resource is not None:
                deleted_objects += resource_service.delete_resource(resource)
                continue
        deleted_objects += delete_stored_object(file_item.storage_backend, file_item.object_key, file_item.object_path)

    course.is_deleted = True
    course.status = CourseStatus.DELETED
    db.commit()
    return deleted_objects


def list_tags(db: Session, user_id: str, query: str | None = None):
    return list_tag_models(db, user_id, query=query)
