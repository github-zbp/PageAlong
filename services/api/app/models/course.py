from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CourseStatus(str, enum.Enum):
    IMPORTING = "importing"
    EXTRACTING_TEXT = "extracting_text"
    OCR_PROCESSING = "ocr_processing"
    NEEDS_REVIEW = "needs_review"
    TEXT_READY = "text_ready"
    AUDIO_GENERATING = "audio_generating"
    READY = "ready"
    FAILED = "failed"
    DELETED = "deleted"


class SourceType(str, enum.Enum):
    CHROME_EXTENSION = "chrome_extension"
    URL_IMPORT = "url_import"
    FILE_UPLOAD = "file_upload"
    MANUAL_TEXT = "manual_text"


class CourseSeries(Base):
    __tablename__ = "course_series"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    title: Mapped[str] = mapped_column(String(512))
    tags_json: Mapped[str] = mapped_column(Text, default="[]")
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    last_read_course_id: Mapped[str | None] = mapped_column(ForeignKey("courses.id"), nullable=True, index=True)
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    courses: Mapped[list[Course]] = relationship(back_populates="series", foreign_keys="Course.series_id")
    last_read_course: Mapped[Course | None] = relationship("Course", foreign_keys=[last_read_course_id], post_update=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.tags_json is None:
            self.tags_json = "[]"
        if self.is_starred is None:
            self.is_starred = False
        if self.is_deleted is None:
            self.is_deleted = False


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    title: Mapped[str] = mapped_column(String(512))
    source_type: Mapped[SourceType] = mapped_column(Enum(SourceType))
    status: Mapped[CourseStatus] = mapped_column(Enum(CourseStatus), default=CourseStatus.IMPORTING)
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    current_audio_asset_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    last_playback_position_seconds: Mapped[int] = mapped_column(Integer, default=0)
    series_id: Mapped[str | None] = mapped_column(ForeignKey("course_series.id"), nullable=True, index=True)
    tags_json: Mapped[str] = mapped_column(Text, default="[]")
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    series: Mapped[CourseSeries | None] = relationship(back_populates="courses", foreign_keys=[series_id])
    tags: Mapped[list["Tag"]] = relationship(
        "Tag",
        secondary="course_tags",
        back_populates="courses",
        order_by="CourseTag.created_at",
    )
    article_texts: Mapped[list[ArticleText]] = relationship(back_populates="course")
    sentences: Mapped[list[Sentence]] = relationship(back_populates="course")
    sections: Mapped[list[CourseSection]] = relationship(back_populates="course")
    audio_assets: Mapped[list[AudioAsset]] = relationship(back_populates="course")
    image_assets: Mapped[list[ArticleImageAsset]] = relationship(back_populates="course")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.status is None:
            self.status = CourseStatus.IMPORTING
        if self.word_count is None:
            self.word_count = 0
        if self.duration_seconds is None:
            self.duration_seconds = 0
        if self.last_playback_position_seconds is None:
            self.last_playback_position_seconds = 0
        if self.tags_json is None:
            self.tags_json = "[]"
        if self.is_starred is None:
            self.is_starred = False
        if self.is_deleted is None:
            self.is_deleted = False


class ArticleText(Base):
    __tablename__ = "article_texts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    text: Mapped[str] = mapped_column(Text)
    content_markdown: Mapped[str] = mapped_column(Text, default="")
    content_hash: Mapped[str] = mapped_column(String(128), default="")
    source_metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    extraction_metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    source_quality: Mapped[str] = mapped_column(String(64), default="trusted")
    confirmed_by_user: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    course: Mapped[Course] = relationship(back_populates="article_texts")
    image_assets: Mapped[list[ArticleImageAsset]] = relationship(back_populates="article_text")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.content_markdown is None or self.content_markdown == "":
            self.content_markdown = self.text or ""
        if self.content_hash is None:
            self.content_hash = ""
        if self.source_metadata_json is None:
            self.source_metadata_json = "{}"
        if self.extraction_metadata_json is None:
            self.extraction_metadata_json = "{}"
        if self.source_quality is None:
            self.source_quality = "trusted"
        if self.confirmed_by_user is None:
            self.confirmed_by_user = True


class Sentence(Base):
    __tablename__ = "sentences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    article_text_id: Mapped[str] = mapped_column(ForeignKey("article_texts.id"), index=True)
    index: Mapped[int] = mapped_column(Integer)
    paragraph_index: Mapped[int] = mapped_column(Integer, default=0)
    text: Mapped[str] = mapped_column(Text)
    audio_start_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    audio_end_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    generation_status: Mapped[str] = mapped_column(String(64), default="pending")

    course: Mapped[Course] = relationship(back_populates="sentences")


class CourseSection(Base):
    __tablename__ = "course_sections"
    __table_args__ = (UniqueConstraint("course_id", "article_text_id", "section_index", name="uq_course_section_index"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    article_text_id: Mapped[str] = mapped_column(ForeignKey("article_texts.id"), index=True)
    section_index: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(512))
    sentence_start_index: Mapped[int] = mapped_column(Integer)
    sentence_end_index: Mapped[int] = mapped_column(Integer)
    planned_duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    audio_start_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    audio_end_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(64), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course: Mapped[Course] = relationship(back_populates="sections")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.planned_duration_seconds is None:
            self.planned_duration_seconds = 0
        if self.status is None:
            self.status = "pending"


class AudioAsset(Base):
    __tablename__ = "audio_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    article_text_id: Mapped[str] = mapped_column(ForeignKey("article_texts.id"), index=True)
    generation_job_id: Mapped[str | None] = mapped_column(ForeignKey("generation_jobs.id"), nullable=True, index=True)
    provider: Mapped[str] = mapped_column(String(64))
    model_id: Mapped[str] = mapped_column(String(128), default="")
    tier: Mapped[str] = mapped_column(String(32), default="free")
    voice_id: Mapped[str] = mapped_column(String(128))
    speed: Mapped[float] = mapped_column(Float, default=1.0)
    format: Mapped[str] = mapped_column(String(16), default="mp3")
    object_path: Mapped[str] = mapped_column(String(1024))
    storage_backend: Mapped[str] = mapped_column(String(32), default="local")
    bucket: Mapped[str | None] = mapped_column(String(255), nullable=True)
    object_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    content_type: Mapped[str] = mapped_column(String(128), default="audio/mpeg")
    byte_size: Mapped[int] = mapped_column(Integer, default=0)
    etag: Mapped[str | None] = mapped_column(String(255), nullable=True)
    checksum_sha256: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    duration_seconds: Mapped[int] = mapped_column(Integer)
    character_count: Mapped[int] = mapped_column(Integer)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    course: Mapped[Course] = relationship(back_populates="audio_assets")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.model_id is None:
            self.model_id = ""
        if self.tier is None:
            self.tier = "free"
        if self.storage_backend is None:
            self.storage_backend = "local"
        if self.content_type is None:
            self.content_type = "audio/mpeg"
        if self.byte_size is None:
            self.byte_size = 0
        if self.metadata_json is None:
            self.metadata_json = "{}"


class ArticleImageAsset(Base):
    __tablename__ = "article_image_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    article_text_id: Mapped[str] = mapped_column(ForeignKey("article_texts.id"), index=True)
    source_url: Mapped[str] = mapped_column(String(2048))
    alt_text: Mapped[str] = mapped_column(String(512), default="")
    storage_backend: Mapped[str] = mapped_column(String(32), default="local")
    bucket: Mapped[str | None] = mapped_column(String(255), nullable=True)
    object_key: Mapped[str] = mapped_column(String(1024))
    object_path: Mapped[str] = mapped_column(String(2048))
    content_type: Mapped[str] = mapped_column(String(128))
    byte_size: Mapped[int] = mapped_column(Integer, default=0)
    checksum_sha256: Mapped[str] = mapped_column(String(128), default="")
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(64), default="imported")
    error_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    course: Mapped[Course] = relationship(back_populates="image_assets")
    article_text: Mapped[ArticleText] = relationship(back_populates="image_assets")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.alt_text is None:
            self.alt_text = ""
        if self.storage_backend is None:
            self.storage_backend = "local"
        if self.byte_size is None:
            self.byte_size = 0
        if self.checksum_sha256 is None:
            self.checksum_sha256 = ""
        if self.metadata_json is None:
            self.metadata_json = "{}"
        if self.status is None:
            self.status = "imported"
