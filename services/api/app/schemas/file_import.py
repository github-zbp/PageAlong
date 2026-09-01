from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.pagination import PaginatedList


class FileImportItemRead(BaseModel):
    id: str
    batch_id: str
    course_id: str | None = None
    status: str
    original_filename: str
    relative_path: str | None = None
    file_extension: str
    content_type: str
    byte_size: int
    storage_backend: str
    bucket: str | None = None
    object_key: str
    object_path: str
    error_code: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class FileImportBatchRead(BaseModel):
    id: str
    status: str
    source_mode: str
    series_id: str | None = None
    series_title: str | None = None
    total_count: int
    success_count: int
    failed_count: int
    created_at: datetime
    updated_at: datetime
    finished_at: datetime | None = None
    items: list[FileImportItemRead] = Field(default_factory=list)


class FileImportBatchList(PaginatedList[FileImportBatchRead]):
    pass
