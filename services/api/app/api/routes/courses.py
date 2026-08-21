import json
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id
from app.core.config import settings
from app.db.session import get_db
from app.models.course import ArticleImageAsset, ArticleText, AudioAsset, Course, CourseSeries, CourseStatus, Sentence
from app.models.file_import import FileImportBatch, FileImportItem, FileImportSourceMode
from app.models.generation_job import GenerationJob, JobStatus, JobType
from app.models.playback_progress import PlaybackProgress
from app.schemas.course import (
    CourseCreate,
    CourseExtensionSyncCreate,
    CourseLibraryUpdate,
    CourseList,
    CourseRead,
    CourseSectionRead,
    CourseSourceRead,
    CourseSummaryRead,
    CourseSeriesDetail,
    CourseSeriesList,
    CourseSeriesCreate,
    CourseSeriesRead,
    CourseSeriesUpdate,
    CourseUrlImportCreate,
    GenerationJobList,
    GenerationJobRead,
    SentenceRead,
    SeriesMoveResult,
    TagCreate,
    TagList,
    TagRead,
    TagUpdate,
)
from app.schemas.file_import import FileImportBatchRead, FileImportItemRead
from app.schemas.playback import PlaybackProgressRead, PlaybackProgressUpdate
from app.services.content_metrics import (
    CHINESE_READING_CHARS_PER_MINUTE,
    TextContentMetric,
    estimate_reading_seconds,
    measure_text_content,
)
from app.services.course_export_service import CourseExportService, safe_filename
from app.services.file_import_service import FileImportService, FileImportUploadInput
from app.services.url_import_service import ExtensionImageInput, ExtensionSyncInput, ImportUrlInput, UrlImportService
from app.services.course_service import (
    active_series_courses,
    course_is_starred,
    course_library_type,
    course_tags,
    create_retry_job_for_failed_stage,
    create_text_course,
    get_or_create_series,
    delete_series_with_courses,
    decode_tags,
    get_series_or_raise,
    list_courses,
    list_series,
    list_tags,
    move_series_to_fragments,
    request_audio_generation,
    update_course_library,
    update_series_metadata,
)
from app.services.tag_service import TagAlreadyExistsError, TagNotFoundError, create_tag, delete_tag, get_tag_by_id, update_tag
from app.services.tts_limits import TTSGenerationLimitExceeded
from app.worker_client import enqueue_audio_generation, enqueue_file_import, enqueue_url_import

router = APIRouter(prefix="/courses", tags=["courses"])


def get_s3_client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
    )


def get_user_course_or_404(db: Session, user_id: str, course_id: str) -> Course:
    course = db.scalar(
        select(Course).where(
            Course.id == course_id,
            Course.user_id == user_id,
            Course.is_deleted.is_(False),
        )
    )
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def get_user_series_or_404(db: Session, user_id: str, series_id: str) -> CourseSeries:
    try:
        return get_series_or_raise(db, user_id, series_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Series not found") from exc


def latest_generation_job(db: Session, course_id: str) -> GenerationJob | None:
    return db.scalar(
        select(GenerationJob)
        .where(GenerationJob.course_id == course_id, GenerationJob.job_type == JobType.TTS_GENERATE)
        .order_by(GenerationJob.created_at.desc().nullslast(), GenerationJob.started_at.desc().nullslast(), GenerationJob.id.desc())
    )


def latest_import_job(db: Session, course_id: str) -> GenerationJob | None:
    return db.scalar(
        select(GenerationJob)
        .where(GenerationJob.course_id == course_id, GenerationJob.job_type == JobType.URL_IMPORT)
        .order_by(GenerationJob.created_at.desc().nullslast(), GenerationJob.started_at.desc().nullslast(), GenerationJob.id.desc())
    )


def latest_article_text(course: Course) -> ArticleText | None:
    if not course.article_texts:
        return None
    return sorted(course.article_texts, key=lambda item: (item.version, item.created_at, item.id), reverse=True)[0]


def parse_source_summary(article_text: ArticleText | None) -> CourseSourceRead | None:
    if article_text is None or not article_text.source_metadata_json:
        return None
    try:
        payload = json.loads(article_text.source_metadata_json)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    return CourseSourceRead(**payload)


def is_absolute_http_url(value: str | None) -> bool:
    return bool(value and value.lower().startswith(("http://", "https://")))


def current_audio_url_for_course(course: Course) -> str | None:
    if course.status != CourseStatus.READY or course.current_audio_asset_id is None:
        return None
    current_asset = next(
        (asset for asset in course.audio_assets if asset.id == course.current_audio_asset_id and asset.is_current),
        None,
    )
    if current_asset is not None and is_absolute_http_url(current_asset.object_path):
        return current_asset.object_path
    return f"/courses/{course.id}/audio"


def attachment_disposition(filename: str) -> str:
    fallback = filename.encode("ascii", "ignore").decode("ascii") or "download"
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(filename)}"


def serialize_generation_job(job: GenerationJob) -> GenerationJobRead:
    return GenerationJobRead(
        id=job.id,
        course_id=job.course_id,
        job_type=job.job_type.value,
        status=job.status.value,
        provider=job.provider,
        fallback_provider=job.fallback_provider,
        tier=job.tier,
        progress_current=job.progress_current,
        progress_total=job.progress_total,
        error_code=job.error_code,
        error_message=job.error_message,
        started_at=job.started_at,
        finished_at=job.finished_at,
    )


def serialize_file_import_item(item: FileImportItem) -> FileImportItemRead:
    return FileImportItemRead(
        id=item.id,
        batch_id=item.batch_id,
        course_id=item.course_id,
        status=item.status.value,
        original_filename=item.original_filename,
        relative_path=item.relative_path,
        file_extension=item.file_extension,
        content_type=item.content_type,
        byte_size=item.byte_size,
        storage_backend=item.storage_backend,
        bucket=item.bucket,
        object_key=item.object_key,
        object_path=item.object_path,
        error_code=item.error_code,
        error_message=item.error_message,
        started_at=item.started_at,
        finished_at=item.finished_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def serialize_file_import_batch(batch: FileImportBatch, db: Session) -> FileImportBatchRead:
    items = list(
        db.scalars(
            select(FileImportItem)
            .where(FileImportItem.batch_id == batch.id)
            .order_by(FileImportItem.created_at, FileImportItem.id)
        )
    )
    return FileImportBatchRead(
        id=batch.id,
        status=batch.status.value,
        source_mode=batch.source_mode.value,
        series_id=batch.series_id,
        series_title=batch.series_title,
        total_count=batch.total_count,
        success_count=batch.success_count,
        failed_count=batch.failed_count,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        finished_at=batch.finished_at,
        items=[serialize_file_import_item(item) for item in items],
    )


def serialize_tag(tag, usage_count: int = 0) -> TagRead:
    return TagRead(
        id=tag.id,
        name=tag.name,
        color=tag.color,
        usage_count=usage_count,
        updated_at=tag.updated_at,
    )


def serialize_course(course: Course, db: Session | None = None) -> CourseRead:
    generation_job = latest_generation_job(db, course.id) if db is not None else None
    import_job = latest_import_job(db, course.id) if db is not None else None
    article_text = latest_article_text(course)
    text_metric = (
        measure_text_content(article_text.text)
        if article_text is not None
        else TextContentMetric(count=course.word_count, unit="characters", estimated_reading_seconds=0)
    )
    display_word_count = text_metric.count
    import_error_message = import_job.error_message if import_job is not None else None
    current_audio_url = current_audio_url_for_course(course)
    return CourseRead(
        id=course.id,
        title=course.title,
        source_type=course.source_type.value,
        status=course.status.value,
        word_count=display_word_count,
        word_count_unit=text_metric.unit,
        estimated_reading_seconds=text_metric.estimated_reading_seconds,
        duration_seconds=course.duration_seconds,
        current_audio_url=current_audio_url,
        last_playback_position_seconds=course.last_playback_position_seconds,
        library_type=course_library_type(course),
        series_id=course.series_id,
        series_title=course.series.title if course.series is not None else None,
        tags=[serialize_tag(tag) for tag in course_tags(course)],
        is_starred=course_is_starred(course),
        created_at=course.created_at,
        updated_at=course.updated_at,
        last_read_at=course.last_read_at,
        sentences=[
            SentenceRead(
                index=sentence.index,
                text=sentence.text,
                audio_start_seconds=sentence.audio_start_seconds,
                audio_end_seconds=sentence.audio_end_seconds,
            )
            for sentence in sorted(course.sentences, key=lambda item: item.index)
        ],
        sections=[
            CourseSectionRead(
                section_index=section.section_index,
                title=section.title,
                sentence_start_index=section.sentence_start_index,
                sentence_end_index=section.sentence_end_index,
                planned_duration_seconds=section.planned_duration_seconds,
                audio_start_seconds=section.audio_start_seconds,
                audio_end_seconds=section.audio_end_seconds,
                status=section.status,
            )
            for section in sorted(course.sections, key=lambda item: item.section_index)
        ],
        content_markdown=article_text.content_markdown if article_text is not None else None,
        source=parse_source_summary(article_text),
        import_status=import_job.status.value if import_job is not None else None,
        import_error_code=import_job.error_code if import_job is not None else None,
        import_error_message=import_error_message,
        current_generation_job_id=generation_job.id if generation_job is not None else None,
        generation_status=generation_job.status.value if generation_job is not None else None,
        generation_error_code=generation_job.error_code if generation_job is not None else None,
        failed_reason=generation_job.error_message if generation_job is not None else import_error_message,
    )


def sentence_counts_for_courses(db: Session, course_ids: list[str]) -> dict[str, int]:
    if not course_ids:
        return {}
    rows = db.execute(
        select(Sentence.course_id, func.count(Sentence.id))
        .where(Sentence.course_id.in_(course_ids))
        .group_by(Sentence.course_id)
    ).all()
    return {course_id: int(sentence_count) for course_id, sentence_count in rows}


def serialize_course_summary(course: Course, sentence_count: int) -> CourseSummaryRead:
    return CourseSummaryRead(
        id=course.id,
        title=course.title,
        source_type=course.source_type.value,
        status=course.status.value,
        word_count=course.word_count,
        word_count_unit="characters",
        estimated_reading_seconds=estimate_reading_seconds(course.word_count, CHINESE_READING_CHARS_PER_MINUTE),
        duration_seconds=course.duration_seconds,
        current_audio_url=f"/courses/{course.id}/audio"
        if course.status == CourseStatus.READY and course.current_audio_asset_id is not None
        else None,
        last_playback_position_seconds=course.last_playback_position_seconds,
        library_type=course_library_type(course),
        series_id=course.series_id,
        series_title=course.series.title if course.series is not None else None,
        tags=[serialize_tag(tag) for tag in course_tags(course)],
        is_starred=course_is_starred(course),
        created_at=course.created_at,
        updated_at=course.updated_at,
        last_read_at=course.last_read_at,
        sentence_count=sentence_count,
    )


def serialize_series(series: CourseSeries) -> CourseSeriesRead:
    courses = sorted(active_series_courses(series), key=series_sort_value_for_course, reverse=True)
    latest_course = courses[0] if courses else None
    return CourseSeriesRead(
        id=series.id,
        title=series.title,
        article_count=len(courses),
        tags=course_series_tags(series),
        is_starred=series.is_starred,
        updated_at=series.updated_at,
        last_read_at=series.last_read_at,
        last_read_course_id=series.last_read_course_id,
        latest_course_id=latest_course.id if latest_course is not None else None,
    )


def series_sort_value_for_course(course: Course) -> datetime:
    return course.last_read_at or course.updated_at or course.created_at


def course_series_tags(series: CourseSeries) -> list[str]:
    return decode_tags(series.tags_json)


def parse_relative_paths(relative_paths_json: str, file_count: int) -> list[str | None]:
    if not relative_paths_json.strip():
        return [None] * file_count
    try:
        parsed = json.loads(relative_paths_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="relative_paths_json must be valid JSON") from exc
    if not isinstance(parsed, list):
        raise HTTPException(status_code=422, detail="relative_paths_json must be a JSON array")
    if len(parsed) != file_count:
        raise HTTPException(status_code=422, detail="relative_paths_json length must match files length")
    return [str(item) if item is not None else None for item in parsed]


@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> CourseRead:
    payload_fields = payload.model_fields_set if hasattr(payload, "model_fields_set") else payload.__fields_set__
    has_series_target = bool(payload.series_id or (payload.series_title or "").strip())
    series_tags = None if has_series_target and "tags" not in payload_fields else payload.tags
    direct_tags = None if has_series_target else (payload.tags if "tags" in payload_fields else None)
    series_starred = None if has_series_target and "is_starred" not in payload_fields else payload.is_starred
    try:
        course = create_text_course(
            db,
            user_id,
            payload.title,
            payload.source_type,
            payload.text,
            series_id=payload.series_id,
            series_title=payload.series_title,
            tag_ids=payload.tag_ids or None,
            tags=direct_tags,
            series_tags=series_tags,
            is_starred=series_starred,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    try:
        request_audio_generation(db, course)
    except TTSGenerationLimitExceeded:
        db.refresh(course)
    return serialize_course(course, db)


@router.post("/import-url", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_url_import_course(
    payload: CourseUrlImportCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> CourseRead:
    payload_fields = payload.model_fields_set if hasattr(payload, "model_fields_set") else payload.__fields_set__
    has_series_target = bool(payload.series_id or (payload.series_title or "").strip())
    series_tags = None if has_series_target and "tags" not in payload_fields else payload.tags
    direct_tags = None if has_series_target else (payload.tags if "tags" in payload_fields else None)
    series_starred = None if has_series_target and "is_starred" not in payload_fields else payload.is_starred
    try:
        course, job = UrlImportService(db).create_import_course(
            user_id,
            ImportUrlInput(
                url=payload.url,
                title=payload.title,
                series_id=payload.series_id,
                series_title=payload.series_title,
                tag_ids=payload.tag_ids or None,
                tags=direct_tags,
                series_tags=series_tags,
                is_starred=series_starred if series_starred is not None else False,
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    try:
        enqueue_url_import(course.id, job.id)
    except Exception as exc:
        UrlImportService(db).mark_queue_failed(job.id, str(exc))
        raise HTTPException(status_code=503, detail="URL import queue is unavailable") from exc
    return serialize_course(course, db)


@router.post("/import-url/extension-sync", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_extension_sync_course(
    payload: CourseExtensionSyncCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> CourseRead:
    payload_fields = payload.model_fields_set if hasattr(payload, "model_fields_set") else payload.__fields_set__
    has_series_target = bool(payload.series_id or (payload.series_title or "").strip())
    series_tags = None if has_series_target and "tags" not in payload_fields else payload.tags
    direct_tags = None if has_series_target else (payload.tags if "tags" in payload_fields else None)
    series_starred = None if has_series_target and "is_starred" not in payload_fields else payload.is_starred
    try:
        course, job = UrlImportService(db).create_extension_sync_course(
            user_id,
            ExtensionSyncInput(
                url=payload.url,
                title=payload.title,
                article_html=payload.article_html,
                text_excerpt=payload.text_excerpt,
                images=[
                    ExtensionImageInput(
                        url=image.url,
                        alt=image.alt,
                        width=image.width,
                        height=image.height,
                        nearby_text=image.nearby_text,
                    )
                    for image in payload.images
                ],
                series_id=payload.series_id,
                series_title=payload.series_title,
                tag_ids=payload.tag_ids or None,
                tags=direct_tags,
                series_tags=series_tags,
                is_starred=series_starred if series_starred is not None else False,
                client_metadata=payload.client_metadata,
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    try:
        enqueue_url_import(course.id, job.id)
    except Exception as exc:
        UrlImportService(db).mark_queue_failed(job.id, str(exc))
        raise HTTPException(status_code=503, detail="Extension sync queue is unavailable") from exc
    return serialize_course(course, db)


@router.post("/import-files", response_model=FileImportBatchRead, status_code=status.HTTP_202_ACCEPTED)
async def create_file_import_batch(
    files: list[UploadFile] = File(...),
    source_mode: str = Form(...),
    relative_paths_json: str = Form("[]"),
    series_id: str | None = Form(None),
    series_title: str | None = Form(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> FileImportBatchRead:
    if not files:
        raise HTTPException(status_code=422, detail="At least one file is required")
    try:
        source_mode_enum = FileImportSourceMode(source_mode)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="source_mode must be single_file, multiple_files, or folder") from exc

    relative_paths = parse_relative_paths(relative_paths_json, len(files))
    uploads = [
        FileImportUploadInput(
            filename=upload.filename or "untitled",
            content_type=upload.content_type or "",
            data=await upload.read(),
            relative_path=relative_paths[index],
        )
        for index, upload in enumerate(files)
    ]
    try:
        service = FileImportService(db)
        batch = service.create_batch(
            user_id=user_id,
            uploads=uploads,
            source_mode=source_mode_enum,
            series_id=series_id,
            series_title=series_title,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    for item in service.pending_items_for_batch(batch.id):
        try:
            enqueue_file_import(item.id)
        except Exception as exc:
            service.mark_item_failed(item.id, "queue_unavailable", str(exc))

    refreshed_batch = db.get(FileImportBatch, batch.id)
    if refreshed_batch is None:
        raise HTTPException(status_code=404, detail="File import batch not found")
    return serialize_file_import_batch(refreshed_batch, db)


@router.get("", response_model=CourseList)
def get_courses(
    library_type: str | None = None,
    query: str | None = None,
    tag: str | None = None,
    starred: bool | None = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> CourseList:
    if library_type not in {None, "all", "fragmented", "series"}:
        raise HTTPException(status_code=422, detail="library_type must be all, fragmented, or series")
    normalized_library_type = None if library_type in {None, "all"} else library_type
    courses = list_courses(
        db,
        user_id,
        library_type=normalized_library_type,
        query=query,
        tag=tag,
        starred=starred,
    )
    sentence_counts = sentence_counts_for_courses(db, [course.id for course in courses])
    return CourseList(
        items=[
            serialize_course_summary(course, sentence_counts.get(course.id, 0))
            for course in courses
        ]
    )


@router.get("/series", response_model=CourseSeriesList)
def get_course_series(
    query: str | None = None,
    tag: str | None = None,
    starred: bool | None = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> CourseSeriesList:
    return CourseSeriesList(
        items=[
            serialize_series(series)
            for series in list_series(db, user_id, query=query, tag=tag, starred=starred)
        ]
    )


@router.post("/series", response_model=CourseSeriesRead, status_code=status.HTTP_201_CREATED)
def create_course_series(
    payload: CourseSeriesCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> CourseSeriesRead:
    series = get_or_create_series(
        db,
        user_id,
        series_title=payload.title,
        tags=None,
        is_starred=payload.is_starred,
    )
    if series is None:
        raise HTTPException(status_code=422, detail="Series title is required")
    return serialize_series(series)


@router.get("/series/{series_id}", response_model=CourseSeriesDetail)
def get_course_series_detail(
    series_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> CourseSeriesDetail:
    series = get_user_series_or_404(db, user_id, series_id)
    summary = serialize_series(series)
    summary_payload = summary.model_dump() if hasattr(summary, "model_dump") else summary.dict()
    return CourseSeriesDetail(
        **summary_payload,
        courses=[
            serialize_course(course, db)
            for course in list_courses(db, user_id, library_type="series", series_id=series.id)
        ],
    )


@router.patch("/series/{series_id}", response_model=CourseSeriesRead)
def patch_course_series(
    series_id: str,
    payload: CourseSeriesUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> CourseSeriesRead:
    series = get_user_series_or_404(db, user_id, series_id)
    return serialize_series(
        update_series_metadata(
            db,
            series,
            title=payload.title,
            tags=payload.tags,
            is_starred=payload.is_starred,
        )
    )


@router.post("/series/{series_id}/move-to-fragments", response_model=SeriesMoveResult)
def move_course_series_to_fragments(
    series_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> SeriesMoveResult:
    series = get_user_series_or_404(db, user_id, series_id)
    return SeriesMoveResult(moved_count=move_series_to_fragments(db, series))


@router.delete("/series/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_series(
    series_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    series = get_user_series_or_404(db, user_id, series_id)
    if active_series_courses(series):
        raise HTTPException(status_code=409, detail="Series still has courses")
    series.is_deleted = True
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/tags", response_model=TagList)
def get_course_tags(
    query: str | None = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> TagList:
    return TagList(items=list_tags(db, user_id, query=query))


@router.post("/tags", response_model=TagRead, status_code=status.HTTP_201_CREATED)
def create_course_tag(
    payload: TagCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> TagRead:
    try:
        tag = create_tag(db, user_id, payload.name, color=payload.color)
    except TagAlreadyExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return serialize_tag(tag)


@router.patch("/tags/{tag_id}", response_model=TagRead)
def patch_course_tag(
    tag_id: str,
    payload: TagUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> TagRead:
    try:
        tag = get_tag_by_id(db, user_id, tag_id)
    except TagNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    try:
        return serialize_tag(update_tag(db, tag, name=payload.name, color=payload.color))
    except TagAlreadyExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_tag(
    tag_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    try:
        tag = get_tag_by_id(db, user_id, tag_id)
    except TagNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    delete_tag(db, tag)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/file-import-batches/{batch_id}", response_model=FileImportBatchRead)
def get_file_import_batch(
    batch_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> FileImportBatchRead:
    batch = db.scalar(
        select(FileImportBatch).where(
            FileImportBatch.id == batch_id,
            FileImportBatch.user_id == user_id,
        )
    )
    if batch is None:
        raise HTTPException(status_code=404, detail="File import batch not found")
    return serialize_file_import_batch(batch, db)


@router.get("/{course_id}", response_model=CourseRead)
def get_course(
    course_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> CourseRead:
    return serialize_course(get_user_course_or_404(db, user_id, course_id), db)


@router.get("/{course_id}/generation-jobs", response_model=GenerationJobList)
def get_course_generation_jobs(
    course_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> GenerationJobList:
    course = get_user_course_or_404(db, user_id, course_id)
    jobs = list(
        db.scalars(
            select(GenerationJob)
            .where(GenerationJob.course_id == course.id, GenerationJob.job_type == JobType.TTS_GENERATE)
            .order_by(
                GenerationJob.created_at.desc().nullslast(),
                GenerationJob.started_at.desc().nullslast(),
                GenerationJob.id.desc(),
            )
        )
    )
    return GenerationJobList(items=[serialize_generation_job(job) for job in jobs])


@router.get("/{course_id}/images/{image_asset_id}")
def get_course_image(
    course_id: str,
    image_asset_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    course = get_user_course_or_404(db, user_id, course_id)
    image_asset = db.get(ArticleImageAsset, image_asset_id)
    if image_asset is None or image_asset.course_id != course.id or image_asset.status != "imported":
        raise HTTPException(status_code=404, detail="Course image not found")

    if is_absolute_http_url(image_asset.object_path):
        return RedirectResponse(image_asset.object_path)

    if image_asset.storage_backend in {"s3", "minio", "r2"}:
        return build_object_storage_image_response(image_asset)

    image_path = Path(image_asset.object_path)
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Course image file not found")
    return FileResponse(image_path, media_type=image_asset.content_type, filename=image_path.name)


@router.get("/{course_id}/exports/{export_format}")
def export_course_content(
    course_id: str,
    export_format: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    course = get_user_course_or_404(db, user_id, course_id)
    try:
        exported = CourseExportService(db).export_content(course, export_format)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(
        content=exported.data,
        media_type=exported.media_type,
        headers={"Content-Disposition": attachment_disposition(exported.filename)},
    )


@router.post("/{course_id}/audio-generation", response_model=GenerationJobRead, status_code=status.HTTP_202_ACCEPTED)
def retry_course_audio_generation(
    course_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> GenerationJobRead:
    course = get_user_course_or_404(db, user_id, course_id)
    try:
        job = request_audio_generation(db, course)
    except TTSGenerationLimitExceeded as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return serialize_generation_job(job)


@router.post("/{course_id}/retry-failed-job", response_model=GenerationJobRead, status_code=status.HTTP_202_ACCEPTED)
def retry_failed_course_job(
    course_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> GenerationJobRead:
    course = get_user_course_or_404(db, user_id, course_id)
    try:
        retry = create_retry_job_for_failed_stage(db, course)
    except TTSGenerationLimitExceeded as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    try:
        if retry.stage == JobType.URL_IMPORT:
            enqueue_url_import(course.id, retry.job.id)
        else:
            enqueue_audio_generation(course.id, retry.job.id)
    except Exception as exc:
        if retry.stage == JobType.URL_IMPORT:
            UrlImportService(db).mark_queue_failed(retry.job.id, str(exc))
        else:
            db.refresh(retry.job)
            db.refresh(course)
            retry.job.status = JobStatus.FAILED
            retry.job.error_code = "queue_unavailable"
            retry.job.error_message = str(exc)[:2000]
            retry.job.finished_at = datetime.utcnow()
            course.status = CourseStatus.FAILED
            db.commit()
        raise HTTPException(status_code=503, detail="Retry queue is unavailable") from exc

    db.refresh(retry.job)
    return serialize_generation_job(retry.job)


@router.patch("/{course_id}/library", response_model=CourseRead)
def patch_course_library(
    course_id: str,
    payload: CourseLibraryUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> CourseRead:
    course = get_user_course_or_404(db, user_id, course_id)
    try:
        return serialize_course(
            update_course_library(
                db,
                user_id,
                course,
                library_type=payload.library_type,
                series_id=payload.series_id,
                series_title=payload.series_title,
                tag_ids=payload.tag_ids,
                tags=payload.tags,
                is_starred=payload.is_starred,
            ),
            db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{course_id}/audio")
def get_course_audio(
    course_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    course = get_user_course_or_404(db, user_id, course_id)
    if course.current_audio_asset_id is None:
        raise HTTPException(status_code=404, detail="Course audio not found")

    audio_asset = db.get(AudioAsset, course.current_audio_asset_id)
    if audio_asset is None or not audio_asset.is_current:
        raise HTTPException(status_code=404, detail="Course audio not found")

    if audio_asset.storage_backend in {"s3", "minio", "r2"}:
        return build_object_storage_audio_response(audio_asset, request)

    audio_path = Path(audio_asset.object_path)
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Course audio file not found")

    return FileResponse(
        audio_path,
        media_type=f"audio/{audio_asset.format}",
        filename=audio_path.name,
    )


@router.get("/{course_id}/audio-download")
def download_course_audio(
    course_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    course = get_user_course_or_404(db, user_id, course_id)
    audio_asset = current_audio_asset_or_404(db, course)
    filename = f"{safe_filename(course.title)}.{audio_asset.format or 'mp3'}"

    if audio_asset.storage_backend in {"s3", "minio", "r2"}:
        return build_object_storage_audio_response(audio_asset, request, filename=filename)

    audio_path = Path(audio_asset.object_path)
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Course audio file not found")
    return FileResponse(
        audio_path,
        media_type=audio_asset.content_type or f"audio/{audio_asset.format}",
        filename=filename,
    )


def current_audio_asset_or_404(db: Session, course: Course) -> AudioAsset:
    if course.current_audio_asset_id is None:
        raise HTTPException(status_code=404, detail="Course audio not found")

    audio_asset = db.get(AudioAsset, course.current_audio_asset_id)
    if audio_asset is None or not audio_asset.is_current:
        raise HTTPException(status_code=404, detail="Course audio not found")
    return audio_asset


def build_object_storage_audio_response(
    audio_asset: AudioAsset,
    request: Request,
    filename: str | None = None,
) -> Response:
    bucket = audio_asset.bucket or settings.s3_bucket
    object_key = audio_asset.object_key or audio_asset.object_path
    params = {"Bucket": bucket, "Key": object_key}
    range_header = request.headers.get("range")
    if range_header:
        params["Range"] = range_header

    try:
        object_response = get_s3_client().get_object(**params)
        body = object_response["Body"].read()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Course audio object storage read failed") from exc

    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": f"private, max-age={settings.tts_signed_url_ttl_seconds}",
    }
    if object_response.get("ContentRange"):
        headers["Content-Range"] = object_response["ContentRange"]
    if object_response.get("ContentLength") is not None:
        headers["Content-Length"] = str(object_response["ContentLength"])
    if object_response.get("ETag"):
        headers["ETag"] = object_response["ETag"]
    if filename:
        headers["Content-Disposition"] = attachment_disposition(filename)

    media_type = audio_asset.content_type or f"audio/{audio_asset.format}"
    return Response(
        content=body,
        media_type=media_type,
        headers=headers,
        status_code=status.HTTP_206_PARTIAL_CONTENT if range_header else status.HTTP_200_OK,
    )


def build_object_storage_image_response(image_asset: ArticleImageAsset) -> Response:
    bucket = image_asset.bucket or settings.s3_bucket
    object_key = image_asset.object_key or image_asset.object_path
    try:
        object_response = get_s3_client().get_object(Bucket=bucket, Key=object_key)
        body = object_response["Body"].read()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Course image object storage read failed") from exc

    headers = {
        "Cache-Control": f"private, max-age={settings.tts_signed_url_ttl_seconds}",
    }
    if object_response.get("ContentLength") is not None:
        headers["Content-Length"] = str(object_response["ContentLength"])
    if object_response.get("ETag"):
        headers["ETag"] = object_response["ETag"]
    return Response(content=body, media_type=image_asset.content_type, headers=headers)


@router.put("/{course_id}/progress", response_model=PlaybackProgressRead)
def update_progress(
    course_id: str,
    payload: PlaybackProgressUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> PlaybackProgressRead:
    course = get_user_course_or_404(db, user_id, course_id)
    progress = db.get(PlaybackProgress, {"user_id": user_id, "course_id": course_id})
    if progress is None:
        progress = PlaybackProgress(user_id=user_id, course_id=course_id)
        db.add(progress)
    progress.position_seconds = payload.position_seconds
    progress.sentence_index = payload.sentence_index
    now = datetime.utcnow()
    course.last_playback_position_seconds = payload.position_seconds
    course.last_read_at = now
    if course.series is not None:
        course.series.last_read_at = now
        course.series.last_read_course_id = course.id
    db.commit()
    return PlaybackProgressRead(
        position_seconds=progress.position_seconds,
        sentence_index=progress.sentence_index,
    )


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    course = get_user_course_or_404(db, user_id, course_id)
    course.is_deleted = True
    course.status = CourseStatus.DELETED
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
