from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ResourceStatus(str, enum.Enum):
    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"
    DELETED = "deleted"


class ResourceKind(str, enum.Enum):
    EXPORT = "export"
    AUDIO = "audio"
    IMPORT = "import"
    IMAGE = "image"


class ResourceVariant(str, enum.Enum):
    MARKDOWN = "markdown"
    DOCX = "docx"
    PDF = "pdf"
    AUDIO = "audio"
    FILE = "file"
    IMAGE = "image"


class FileResource(Base):
    __tablename__ = "file_resources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    owner_type: Mapped[str] = mapped_column(String(64), index=True)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    resource_kind: Mapped[ResourceKind] = mapped_column(Enum(ResourceKind), index=True)
    resource_variant: Mapped[ResourceVariant] = mapped_column(Enum(ResourceVariant), index=True)
    status: Mapped[ResourceStatus] = mapped_column(Enum(ResourceStatus), default=ResourceStatus.PENDING)
    source_fingerprint: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(512), default="")
    filename: Mapped[str] = mapped_column(String(512), default="")
    storage_backend: Mapped[str] = mapped_column(String(32), default="local")
    bucket: Mapped[str | None] = mapped_column(String(255), nullable=True)
    object_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    object_path: Mapped[str] = mapped_column(String(2048), default="")
    content_type: Mapped[str] = mapped_column(String(128), default="")
    byte_size: Mapped[int] = mapped_column(Integer, default=0)
    etag: Mapped[str | None] = mapped_column(String(255), nullable=True)
    checksum_sha256: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.status is None:
            self.status = ResourceStatus.PENDING
        if self.title is None:
            self.title = ""
        if self.filename is None:
            self.filename = ""
        if self.storage_backend is None:
            self.storage_backend = "local"
        if self.object_path is None:
            self.object_path = ""
        if self.content_type is None:
            self.content_type = ""
        if self.byte_size is None:
            self.byte_size = 0
        if self.metadata_json is None:
            self.metadata_json = "{}"
