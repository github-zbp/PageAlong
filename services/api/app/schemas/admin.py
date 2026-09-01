from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.auth import UserRead
from app.schemas.pagination import PaginatedList


class AdminUserRead(UserRead):
    last_dashboard_at: datetime | None = None
    last_dashboard_locale: str = ""


class AdminUserList(PaginatedList[AdminUserRead]):
    pass


class DashboardActivityUpdate(BaseModel):
    locale: Literal["zh", "en"]


class ImpersonationCreate(BaseModel):
    target_user_id: str = Field(min_length=1)


class ImpersonationRead(BaseModel):
    token: str
    target_user: AdminUserRead
    expires_at: datetime


class BlogCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    slug: str = Field(min_length=1, max_length=255)
    language: Literal["zh", "en"] = "zh"
    summary: str = ""
    cover_image_url: str = ""
    body_markdown: str = Field(min_length=1)
    seo_title: str = ""
    seo_description: str = ""


class BlogUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    language: Literal["zh", "en"] | None = None
    summary: str | None = None
    cover_image_url: str | None = None
    body_markdown: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None


class BlogListItem(BaseModel):
    id: str
    title: str
    slug: str
    language: str
    author_email: str
    summary: str
    cover_image_url: str
    status: str
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime


class BlogDetail(BlogListItem):
    body_markdown: str
    body_html: str
    seo_title: str
    seo_description: str


class BlogList(PaginatedList[BlogListItem]):
    pass


class BulkBlogAction(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=100)
    action: Literal["publish", "offline", "delete"]


class BulkActionResult(BaseModel):
    updated_count: int
    failed_ids: list[str] = Field(default_factory=list)


class AdminCourseResourceCounts(BaseModel):
    image: int = 0
    audio: int = 0
    pdf: int = 0
    docx: int = 0
    markdown: int = 0


class AdminCourseListItem(BaseModel):
    id: str
    title: str
    user_email: str
    source_type: str
    status: str
    created_at: datetime
    updated_at: datetime
    resource_counts: AdminCourseResourceCounts
    audio_download_url: str | None = None
    pdf_download_url: str | None = None
    docx_download_url: str | None = None
    markdown_download_url: str | None = None


class AdminCourseDetail(AdminCourseListItem):
    content_markdown: str | None = None


class AdminCourseList(PaginatedList[AdminCourseListItem]):
    pass


class CourseBulkDelete(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=100)


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    language: Literal["zh", "en"] = "zh"
    body_markdown: str = Field(min_length=1)
    roadmap_status: Literal["planned", "in_progress", "shipped"] = "planned"
    display_position: Literal["dashboard", "announcement_page", "global_banner"] = "dashboard"
    sort_order: int = 0
    is_pinned: bool = False


class AnnouncementUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    language: Literal["zh", "en"] | None = None
    body_markdown: str | None = None
    roadmap_status: Literal["planned", "in_progress", "shipped"] | None = None
    display_position: Literal["dashboard", "announcement_page", "global_banner"] | None = None
    sort_order: int | None = None
    is_pinned: bool | None = None


class AnnouncementListItem(BaseModel):
    id: str
    title: str
    language: str
    status: str
    roadmap_status: str
    display_position: str
    sort_order: int
    is_pinned: bool
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AnnouncementDetail(AnnouncementListItem):
    body_markdown: str
    body_html: str


class AnnouncementList(PaginatedList[AnnouncementListItem]):
    pass


class AnnouncementReorderItem(BaseModel):
    id: str
    sort_order: int


class AnnouncementReorder(BaseModel):
    items: list[AnnouncementReorderItem] = Field(min_length=1, max_length=100)
