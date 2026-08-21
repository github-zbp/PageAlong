from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.course import CourseStatus, SourceType
from app.models.file_import import (
    FileImportBatch,
    FileImportBatchStatus,
    FileImportItem,
    FileImportItemStatus,
    FileImportSourceMode,
)
from app.services.course_service import create_import_placeholder_course, persist_article_content
from app.services.course_export_service import safe_filename
from app.services.file_import_extraction import (
    SUPPORTED_EXTENSIONS,
    UNSUPPORTED_FORMAT_MESSAGES,
    FileImportExtractionError,
    extract_file_content,
    file_extension,
)
from app.services.object_storage import ObjectStorageService


@dataclass(frozen=True)
class FileImportResult:
    item_id: str
    batch_id: str
    course_id: str | None
    status: str


@dataclass(frozen=True)
class FileImportUploadInput:
    filename: str
    content_type: str
    data: bytes
    relative_path: str | None = None


class FileImportService:
    def __init__(self, db: Session):
        self.db = db

    def create_batch(
        self,
        *,
        user_id: str,
        uploads: list[FileImportUploadInput],
        source_mode: FileImportSourceMode,
        series_id: str | None = None,
        series_title: str | None = None,
    ) -> FileImportBatch:
        if not uploads:
            raise ValueError("At least one file is required")
        if len(uploads) > settings.file_import_max_files_per_batch:
            raise ValueError(f"At most {settings.file_import_max_files_per_batch} files can be imported at once")

        batch = FileImportBatch(
            user_id=user_id,
            source_mode=source_mode,
            series_id=series_id,
            series_title=self._default_series_title(source_mode, uploads, series_title),
            total_count=len(uploads),
        )
        self.db.add(batch)
        self.db.flush()

        storage = ObjectStorageService.from_file_import_settings()
        for upload in uploads:
            item = self._build_item_for_upload(batch, upload, storage)
            self.db.add(item)

        self.db.flush()
        self._recompute_batch(batch.id)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def process_item(self, item_id: str) -> FileImportResult:
        item = self._get_item(item_id)
        if item.status in {FileImportItemStatus.SUCCEEDED, FileImportItemStatus.FAILED}:
            return FileImportResult(item.id, item.batch_id, item.course_id, item.status.value)

        item.status = FileImportItemStatus.RUNNING
        item.started_at = datetime.utcnow()
        item.batch.status = FileImportBatchStatus.RUNNING
        self.db.commit()

        try:
            if item.byte_size > settings.file_import_max_file_bytes:
                raise FileImportExtractionError(
                    f"File exceeds the {settings.file_import_max_file_bytes} byte upload limit.",
                    code="file_too_large",
                )
            data = self._read_item_bytes(item)
            extracted = extract_file_content(
                data,
                filename=item.original_filename,
                content_type=item.content_type,
                relative_path=item.relative_path,
            )
            text_count = len(re.sub(r"\s+", "", extracted.normalized.tts_text))
            if text_count <= 0:
                raise FileImportExtractionError("Extracted text is empty.", code="empty_extracted_text")
            if text_count > settings.file_import_max_text_characters:
                raise FileImportExtractionError(
                    f"Extracted text exceeds the {settings.file_import_max_text_characters} character limit.",
                    code="text_too_long",
                )

            course = create_import_placeholder_course(
                self.db,
                item.user_id,
                title=extracted.title,
                source_type=SourceType.FILE_UPLOAD,
                series_id=item.batch.series_id,
                series_title=item.batch.series_title,
            )
            source_metadata = {
                **extracted.source_metadata,
                "byte_size": item.byte_size,
                "storage_backend": item.storage_backend,
                "object_key": item.object_key,
            }
            persist_article_content(
                self.db,
                course,
                title=extracted.title,
                tts_text=extracted.normalized.tts_text,
                content_markdown=extracted.normalized.content_markdown,
                content_hash=extracted.normalized.content_hash,
                source_metadata_json=json.dumps(source_metadata, ensure_ascii=False),
                extraction_metadata_json=json.dumps(extracted.extraction_metadata, ensure_ascii=False),
                source_quality="extracted",
                confirmed_by_user=True,
                course_status=CourseStatus.TEXT_READY,
            )
            item.course_id = course.id
            item.status = FileImportItemStatus.SUCCEEDED
            item.error_code = None
            item.error_message = None
            item.finished_at = datetime.utcnow()
            self._recompute_batch(item.batch_id)
            self.db.commit()
            return FileImportResult(item.id, item.batch_id, item.course_id, item.status.value)
        except FileImportExtractionError as exc:
            self.db.rollback()
            return self._mark_failed(item_id, exc.code, str(exc))
        except Exception as exc:
            self.db.rollback()
            return self._mark_failed(item_id, "file_import_failed", str(exc))

    def mark_item_failed(self, item_id: str, code: str, message: str) -> FileImportResult:
        return self._mark_failed(item_id, code, message)

    def pending_items_for_batch(self, batch_id: str) -> list[FileImportItem]:
        return list(
            self.db.scalars(
                select(FileImportItem)
                .where(
                    FileImportItem.batch_id == batch_id,
                    FileImportItem.status == FileImportItemStatus.PENDING,
                )
                .order_by(FileImportItem.created_at, FileImportItem.id)
            )
        )

    def _get_item(self, item_id: str) -> FileImportItem:
        item = self.db.get(FileImportItem, item_id)
        if item is None:
            raise ValueError(f"File import item not found: {item_id}")
        return item

    def _read_item_bytes(self, item: FileImportItem) -> bytes:
        storage = ObjectStorageService(
            backend=item.storage_backend,
            bucket=item.bucket or settings.s3_bucket,
            endpoint_url=settings.s3_endpoint_url,
            access_key_id=settings.s3_access_key_id,
            secret_access_key=settings.s3_secret_access_key,
            public_base_url=settings.media_public_base_url,
            local_root=Path(settings.file_import_local_dir),
        )
        locator = item.object_path if item.storage_backend == "local" else item.object_key
        return storage.download_bytes(locator)

    def _default_series_title(
        self,
        source_mode: FileImportSourceMode,
        uploads: list[FileImportUploadInput],
        explicit_series_title: str | None,
    ) -> str | None:
        title = (explicit_series_title or "").strip()
        if title:
            return title[:512]
        if source_mode != FileImportSourceMode.FOLDER:
            return None
        first_path = (uploads[0].relative_path or uploads[0].filename).strip().replace("\\", "/")
        top_level = first_path.split("/", 1)[0].strip()
        return top_level[:512] if top_level and top_level != first_path else None

    def _build_item_for_upload(
        self,
        batch: FileImportBatch,
        upload: FileImportUploadInput,
        storage: ObjectStorageService,
    ) -> FileImportItem:
        original_filename = filename_basename(upload.filename)
        extension = file_extension(original_filename)
        relative_path = (upload.relative_path or upload.filename).strip() or original_filename
        byte_size = len(upload.data)
        item = FileImportItem(
            id=str(uuid.uuid4()),
            batch_id=batch.id,
            user_id=batch.user_id,
            original_filename=original_filename,
            relative_path=relative_path,
            file_extension=extension,
            content_type=upload.content_type or "",
            byte_size=byte_size,
            storage_backend=storage.backend,
            bucket=storage.bucket if storage.backend != "local" else None,
            object_key="",
            object_path="",
        )

        if extension not in SUPPORTED_EXTENSIONS:
            item.status = FileImportItemStatus.FAILED
            item.error_code = "unsupported_file_type"
            item.error_message = UNSUPPORTED_FORMAT_MESSAGES.get(extension, "This file type is not supported yet.")
            item.finished_at = datetime.utcnow()
            return item

        if byte_size > settings.file_import_max_file_bytes:
            item.status = FileImportItemStatus.FAILED
            item.error_code = "file_too_large"
            item.error_message = f"File exceeds the {settings.file_import_max_file_bytes} byte upload limit."
            item.finished_at = datetime.utcnow()
            return item

        stored = storage.upload_bytes(
            upload.data,
            object_key=f"file-imports/{batch.id}/{item.id}/{safe_filename(original_filename)}",
            content_type=item.content_type,
        )
        item.storage_backend = stored.storage_backend
        item.bucket = stored.bucket
        item.object_key = stored.object_key
        item.object_path = stored.object_path
        return item

    def _mark_failed(self, item_id: str, code: str, message: str) -> FileImportResult:
        item = self._get_item(item_id)
        item.status = FileImportItemStatus.FAILED
        item.error_code = code
        item.error_message = message[:2000]
        item.finished_at = datetime.utcnow()
        self._recompute_batch(item.batch_id)
        self.db.commit()
        return FileImportResult(item.id, item.batch_id, item.course_id, item.status.value)

    def _recompute_batch(self, batch_id: str) -> None:
        batch = self.db.get(FileImportBatch, batch_id)
        if batch is None:
            return
        items = list(self.db.scalars(select(FileImportItem).where(FileImportItem.batch_id == batch_id)))
        success_count = sum(1 for item in items if item.status == FileImportItemStatus.SUCCEEDED)
        failed_count = sum(1 for item in items if item.status == FileImportItemStatus.FAILED)
        running_count = sum(1 for item in items if item.status == FileImportItemStatus.RUNNING)
        batch.success_count = success_count
        batch.failed_count = failed_count
        if success_count + failed_count >= batch.total_count:
            batch.finished_at = datetime.utcnow()
            if failed_count == 0:
                batch.status = FileImportBatchStatus.SUCCEEDED
            elif success_count > 0:
                batch.status = FileImportBatchStatus.COMPLETED_WITH_FAILURES
            else:
                batch.status = FileImportBatchStatus.FAILED
            return
        batch.status = FileImportBatchStatus.RUNNING if running_count else FileImportBatchStatus.PENDING


def filename_basename(filename: str) -> str:
    normalized = (filename or "untitled").replace("\\", "/").rstrip("/")
    return normalized.rsplit("/", 1)[-1] or "untitled"
