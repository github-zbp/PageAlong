from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class FileImportBatchStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    COMPLETED_WITH_FAILURES = "completed_with_failures"
    FAILED = "failed"


class FileImportItemStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class FileImportSourceMode(str, enum.Enum):
    SINGLE_FILE = "single_file"
    MULTIPLE_FILES = "multiple_files"
    FOLDER = "folder"


class FileImportBatch(Base):
    __tablename__ = "file_import_batches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    status: Mapped[FileImportBatchStatus] = mapped_column(
        Enum(FileImportBatchStatus),
        default=FileImportBatchStatus.PENDING,
    )
    series_id: Mapped[str | None] = mapped_column(ForeignKey("course_series.id"), nullable=True, index=True)
    series_title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    source_mode: Mapped[FileImportSourceMode] = mapped_column(Enum(FileImportSourceMode))
    total_count: Mapped[int] = mapped_column(Integer, default=0)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    items: Mapped[list["FileImportItem"]] = relationship(back_populates="batch")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.status is None:
            self.status = FileImportBatchStatus.PENDING
        if self.total_count is None:
            self.total_count = 0
        if self.success_count is None:
            self.success_count = 0
        if self.failed_count is None:
            self.failed_count = 0


class FileImportItem(Base):
    __tablename__ = "file_import_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    batch_id: Mapped[str] = mapped_column(ForeignKey("file_import_batches.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    course_id: Mapped[str | None] = mapped_column(ForeignKey("courses.id"), nullable=True, index=True)
    status: Mapped[FileImportItemStatus] = mapped_column(
        Enum(FileImportItemStatus),
        default=FileImportItemStatus.PENDING,
    )
    original_filename: Mapped[str] = mapped_column(String(512))
    relative_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    file_extension: Mapped[str] = mapped_column(String(32))
    content_type: Mapped[str] = mapped_column(String(128), default="")
    byte_size: Mapped[int] = mapped_column(Integer, default=0)
    storage_backend: Mapped[str] = mapped_column(String(32), default="local")
    bucket: Mapped[str | None] = mapped_column(String(255), nullable=True)
    object_key: Mapped[str] = mapped_column(String(1024))
    object_path: Mapped[str] = mapped_column(String(2048))
    resource_id: Mapped[str | None] = mapped_column(ForeignKey("file_resources.id"), nullable=True, index=True)
    error_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch: Mapped[FileImportBatch] = relationship(back_populates="items")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.status is None:
            self.status = FileImportItemStatus.PENDING
        if self.content_type is None:
            self.content_type = ""
        if self.byte_size is None:
            self.byte_size = 0
        if self.storage_backend is None:
            self.storage_backend = "local"
