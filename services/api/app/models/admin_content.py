from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BlogPostStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    OFFLINE = "offline"
    DELETED = "deleted"


class AnnouncementStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    OFFLINE = "offline"
    DELETED = "deleted"


class AnnouncementRoadmapStatus(str, enum.Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    SHIPPED = "shipped"


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(512))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    language: Mapped[str] = mapped_column(String(16), default="zh", index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    cover_image_url: Mapped[str] = mapped_column(String(2048), default="")
    body_markdown: Mapped[str] = mapped_column(Text)
    body_html: Mapped[str] = mapped_column(Text)
    status: Mapped[BlogPostStatus] = mapped_column(Enum(BlogPostStatus), default=BlogPostStatus.DRAFT, index=True)
    author_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    seo_title: Mapped[str] = mapped_column(String(512), default="")
    seo_description: Mapped[str] = mapped_column(Text, default="")
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.language is None:
            self.language = "zh"
        if self.summary is None:
            self.summary = ""
        if self.cover_image_url is None:
            self.cover_image_url = ""
        if self.status is None:
            self.status = BlogPostStatus.DRAFT
        if self.seo_title is None:
            self.seo_title = ""
        if self.seo_description is None:
            self.seo_description = ""


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(512))
    language: Mapped[str] = mapped_column(String(16), default="zh", index=True)
    body_markdown: Mapped[str] = mapped_column(Text)
    body_html: Mapped[str] = mapped_column(Text)
    status: Mapped[AnnouncementStatus] = mapped_column(Enum(AnnouncementStatus), default=AnnouncementStatus.DRAFT, index=True)
    roadmap_status: Mapped[AnnouncementRoadmapStatus] = mapped_column(
        Enum(AnnouncementRoadmapStatus),
        default=AnnouncementRoadmapStatus.PLANNED,
        index=True,
    )
    display_position: Mapped[str] = mapped_column(String(64), default="dashboard", index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.language is None:
            self.language = "zh"
        if self.status is None:
            self.status = AnnouncementStatus.DRAFT
        if self.roadmap_status is None:
            self.roadmap_status = AnnouncementRoadmapStatus.PLANNED
        if self.display_position is None:
            self.display_position = "dashboard"
        if self.sort_order is None:
            self.sort_order = 0
        if self.is_pinned is None:
            self.is_pinned = False


class AdminImpersonationToken(Base):
    __tablename__ = "admin_impersonation_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    admin_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    target_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
