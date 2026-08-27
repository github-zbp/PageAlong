from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.pagination import PaginatedList


class GenerationJobRead(BaseModel):
    id: str
    course_id: str
    target_type: str
    target_id: str
    target_label: str | None = None
    job_type: str
    status: str
    provider: str | None = None
    fallback_provider: str | None = None
    tier: str | None = None
    progress_current: int = 0
    progress_total: int = 0
    result_resource_id: str | None = None
    download_url: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class GenerationJobList(PaginatedList[GenerationJobRead]):
    pass


class DownloadRequestRead(BaseModel):
    status: Literal["ready", "pending"]
    job_id: str | None = None
    job_type: str
    resource_id: str | None = None
    download_url: str | None = None
    message: str | None = None
