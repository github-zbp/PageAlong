# Reader Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/reader_admin` administrator console with user management, blog management, course management, and announcement board management.

**Architecture:** Keep all cross-user management behavior behind `/admin/*` FastAPI endpoints guarded by `get_current_admin_user`. Add focused SQLAlchemy models and services for admin-managed content, keep public blog/announcement reads separate from admin writes, and replace the old locale-prefixed admin UI with a dedicated Next.js admin shell. Blog and announcement Markdown is the source of truth; sanitized HTML is stored as render cache.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, PostgreSQL/SQLite test DB, Next.js 13 App Router, React 18, TypeScript, Playwright, Vditor, Markdown, Bleach.

---

## File Structure

Create backend model and service files:

- `services/api/app/models/admin_content.py`: blog, announcement, and impersonation-token SQLAlchemy models.
- `services/api/app/schemas/admin.py`: admin response/request schemas for users, blogs, courses, announcements, impersonation, and pagination.
- `services/api/app/services/admin_content_service.py`: Markdown rendering and HTML sanitization shared by blogs and announcements.
- `services/api/app/services/admin_blog_service.py`: blog CRUD, list filtering, bulk actions, public published reads.
- `services/api/app/services/admin_announcement_service.py`: announcement CRUD, list filtering, reorder, public dashboard reads.
- `services/api/app/services/admin_course_service.py`: cross-user course listing, resource counts, detail reads, soft delete, bulk delete.
- `services/api/app/services/admin_impersonation_service.py`: short-lived admin-created impersonation tokens.

Modify backend files:

- `services/api/pyproject.toml`: add Markdown and Bleach dependencies.
- `services/api/app/models/__init__.py`: export new models and enums.
- `services/api/app/models/user.py`: add dashboard activity fields.
- `services/api/app/api/deps.py`: recognize impersonation tokens for normal user requests while preserving admin checks.
- `services/api/app/api/routes/auth.py`: serialize dashboard activity fields and add dashboard activity endpoint.
- `services/api/app/api/routes/admin.py`: keep or aggregate admin routes.
- `services/api/app/api/router.py`: include public blog and announcement routes if split into new route modules.
- `scripts/init_database.py`: create/upgrade new tables and user activity columns.

Create or modify frontend files:

- `apps/web/src/app/reader_admin/page.tsx`: redirect to `/reader_admin/users`.
- `apps/web/src/app/reader_admin/users/page.tsx`: admin user list and impersonation entry.
- `apps/web/src/app/reader_admin/blogs/page.tsx`: blog list and bulk actions.
- `apps/web/src/app/reader_admin/blogs/new/page.tsx`: create blog page.
- `apps/web/src/app/reader_admin/blogs/[blogId]/page.tsx`: edit blog page.
- `apps/web/src/app/reader_admin/courses/page.tsx`: course management list.
- `apps/web/src/app/reader_admin/courses/[courseId]/page.tsx`: course detail.
- `apps/web/src/app/reader_admin/announcements/page.tsx`: announcement list and reorder.
- `apps/web/src/app/reader_admin/announcements/new/page.tsx`: create announcement page.
- `apps/web/src/app/reader_admin/announcements/[announcementId]/page.tsx`: edit announcement page.
- `apps/web/src/app/[locale]/admin/page.tsx`: redirect to `/reader_admin/users`.
- `apps/web/src/app/[locale]/admin/users/page.tsx`: redirect to `/reader_admin/users`.
- `apps/web/src/app/blog/page.tsx`: replace coming-soon card with published blog listing.
- `apps/web/src/app/blog/[slug]/page.tsx`: public blog detail.
- `apps/web/src/components/AdminShell.tsx`: dedicated admin layout and guard.
- `apps/web/src/components/AdminMarkdownEditor.tsx`: Vditor client-only editor wrapper.
- `apps/web/src/components/ImpersonationBanner.tsx`: visible banner for impersonated user sessions.
- `apps/web/src/components/DashboardAnnouncements.tsx`: dashboard announcement display.
- `apps/web/src/lib/api.ts`: admin, blog, announcement, impersonation, activity API functions.
- `apps/web/src/lib/types.ts`: admin data types.
- `apps/web/src/lib/i18n.ts`: admin UI copy.

Test files:

- `services/api/tests/test_admin_users_api.py`
- `services/api/tests/test_admin_blogs_api.py`
- `services/api/tests/test_admin_courses_api.py`
- `services/api/tests/test_admin_announcements_api.py`
- `services/api/tests/test_init_database.py`
- `apps/web/tests/reader-admin.spec.ts`

---

### Task 1: Backend Admin Content Foundation

**Files:**
- Modify: `services/api/pyproject.toml`
- Create: `services/api/app/models/admin_content.py`
- Modify: `services/api/app/models/__init__.py`
- Create: `services/api/app/services/admin_content_service.py`
- Modify: `services/api/app/models/user.py`
- Modify: `scripts/init_database.py`
- Modify: `services/api/tests/test_init_database.py`
- Test: `services/api/tests/test_admin_blogs_api.py`
- Test: `services/api/tests/test_admin_announcements_api.py`

- [ ] **Step 1: Add backend dependency entries**

Modify `services/api/pyproject.toml` dependencies:

```toml
  "bleach>=6.1.0",
  "markdown>=3.6",
```

Run: `cd services/api && .venv/bin/pip install -e ".[dev]"`
Expected: dependencies install without resolver errors.

- [ ] **Step 2: Write failing model and sanitizer tests**

Create `services/api/tests/test_admin_blogs_api.py` with this initial test:

```python
from app.models.admin_content import BlogPost, BlogPostStatus
from app.services.admin_content_service import render_markdown_to_safe_html


def test_blog_model_defaults_and_html_sanitizer(db_session):
    html = render_markdown_to_safe_html("# 标题\n\n<script>alert(1)</script>\n\n<a href=\"javascript:alert(1)\">bad</a>")

    assert "<h1" in html
    assert "<script" not in html
    assert "javascript:" not in html

    post = BlogPost(
        title="后台规划",
        slug="reader-admin",
        language="zh",
        body_markdown="# 正文",
        body_html="<h1>正文</h1>",
        author_user_id="admin_1",
    )
    db_session.add(post)
    db_session.commit()

    assert post.status == BlogPostStatus.DRAFT
    assert post.deleted_at is None
```

Create `services/api/tests/test_admin_announcements_api.py` with this initial test:

```python
from app.models.admin_content import Announcement, AnnouncementRoadmapStatus, AnnouncementStatus


def test_announcement_model_defaults(db_session):
    announcement = Announcement(
        title="文件导入优化",
        language="zh",
        body_markdown="正在开发文件导入体验。",
        body_html="<p>正在开发文件导入体验。</p>",
        display_position="dashboard",
    )
    db_session.add(announcement)
    db_session.commit()

    assert announcement.status == AnnouncementStatus.DRAFT
    assert announcement.roadmap_status == AnnouncementRoadmapStatus.PLANNED
    assert announcement.sort_order == 0
    assert announcement.is_pinned is False
```

Run: `cd services/api && .venv/bin/python -m pytest tests/test_admin_blogs_api.py tests/test_admin_announcements_api.py -q`
Expected: FAIL because `app.models.admin_content` does not exist.

- [ ] **Step 3: Create admin content models**

Create `services/api/app/models/admin_content.py`:

```python
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
```

- [ ] **Step 4: Export models and add user activity columns**

Modify `services/api/app/models/user.py` `User` model:

```python
    last_dashboard_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_dashboard_locale: Mapped[str] = mapped_column(String(16), default="")
```

Add this default in `User.__init__`:

```python
        if self.last_dashboard_locale is None:
            self.last_dashboard_locale = ""
```

Modify `services/api/app/models/__init__.py` imports:

```python
from app.models.admin_content import (
    AdminImpersonationToken,
    Announcement,
    AnnouncementRoadmapStatus,
    AnnouncementStatus,
    BlogPost,
    BlogPostStatus,
)
```

Add those names to `__all__`.

- [ ] **Step 5: Create Markdown sanitize service**

Create `services/api/app/services/admin_content_service.py`:

```python
from __future__ import annotations

import bleach
import markdown

ALLOWED_TAGS = [
    "a", "abbr", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3",
    "h4", "h5", "h6", "hr", "img", "li", "ol", "p", "pre", "span", "strong",
    "table", "tbody", "td", "th", "thead", "tr", "ul",
]
ALLOWED_ATTRIBUTES = {
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "title"],
    "th": ["align"],
    "td": ["align"],
}
ALLOWED_PROTOCOLS = ["http", "https", "mailto"]


def sanitize_html(html: str) -> str:
    cleaned = bleach.clean(
        html or "",
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
    )
    return bleach.linkify(cleaned, callbacks=[_safe_link_attrs])


def render_markdown_to_safe_html(markdown_text: str) -> str:
    raw_html = markdown.markdown(
        markdown_text or "",
        extensions=["extra", "sane_lists", "nl2br"],
        output_format="html5",
    )
    return sanitize_html(raw_html)


def _safe_link_attrs(attrs, new=False):
    href_key = (None, "href")
    if href_key in attrs:
        attrs[(None, "target")] = "_blank"
        attrs[(None, "rel")] = "noopener noreferrer"
    return attrs
```

- [ ] **Step 6: Upgrade database initializer**

Modify `scripts/init_database.py`:

```python
def create_application_tables(engine: Engine) -> None:
    import app.models  # noqa: F401
    from app.db.base import Base
    from app.services.tag_service import backfill_legacy_tags

    Base.metadata.create_all(bind=engine)
    ensure_course_library_schema(engine)
    ensure_article_text_schema(engine)
    ensure_tts_schema(engine)
    ensure_media_schema(engine)
    ensure_file_import_schema(engine)
    ensure_auth_schema(engine)
    ensure_admin_content_schema(engine)
    with Session(engine) as session:
        seed_initial_admin(session)
        backfill_legacy_tags(session)
```

Add:

```python
def ensure_admin_content_schema(engine: Engine) -> None:
    with engine.begin() as connection:
        table_names = set(inspect(connection).get_table_names())
        dialect_name = connection.dialect.name
        timestamp_type = "TIMESTAMP WITHOUT TIME ZONE" if dialect_name == "postgresql" else "DATETIME"
        boolean_default_false = "BOOLEAN NOT NULL DEFAULT FALSE" if dialect_name == "postgresql" else "BOOLEAN NOT NULL DEFAULT 0"

        if "users" in table_names:
            _ensure_columns(
                connection,
                "users",
                {
                    "last_dashboard_at": timestamp_type,
                    "last_dashboard_locale": "VARCHAR(16) NOT NULL DEFAULT ''",
                },
            )

        if "blog_posts" in table_names:
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_blog_posts_slug ON blog_posts (slug)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_blog_posts_language ON blog_posts (language)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_blog_posts_status ON blog_posts (status)"))

        if "announcements" in table_names:
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_announcements_language ON announcements (language)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_announcements_status ON announcements (status)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_announcements_display_position ON announcements (display_position)"))

        if "admin_impersonation_tokens" in table_names:
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_admin_impersonation_tokens_token_hash "
                    "ON admin_impersonation_tokens (token_hash)"
                )
            )
```

Also add `last_dashboard_at` and `last_dashboard_locale` to `ensure_auth_schema`.

- [ ] **Step 7: Extend init database test**

Modify `services/api/tests/test_init_database.py` expected table names in `test_create_application_tables_registers_current_models`:

```python
        "admin_impersonation_tokens",
        "announcements",
        "blog_posts",
```

Add assertions:

```python
    user_columns = {column["name"] for column in inspect(engine).get_columns("users")}
    assert {"last_dashboard_at", "last_dashboard_locale"}.issubset(user_columns)
```

Run: `cd services/api && .venv/bin/python -m pytest tests/test_init_database.py tests/test_admin_blogs_api.py tests/test_admin_announcements_api.py -q`
Expected: PASS.

- [ ] **Step 8: Commit backend foundation**

```bash
git add services/api/pyproject.toml services/api/app/models services/api/app/services/admin_content_service.py scripts/init_database.py services/api/tests/test_init_database.py services/api/tests/test_admin_blogs_api.py services/api/tests/test_admin_announcements_api.py
git commit -m "feat: add admin content foundations"
```

---

### Task 2: Admin Users, Dashboard Activity, and Impersonation API

**Files:**
- Modify: `services/api/app/schemas/auth.py`
- Create or modify: `services/api/app/schemas/admin.py`
- Modify: `services/api/app/services/auth_service.py`
- Create: `services/api/app/services/admin_impersonation_service.py`
- Modify: `services/api/app/api/deps.py`
- Modify: `services/api/app/api/routes/auth.py`
- Modify: `services/api/app/api/routes/admin.py`
- Test: `services/api/tests/test_admin_users_api.py`

- [ ] **Step 1: Write failing admin users tests**

Create `services/api/tests/test_admin_users_api.py`:

```python
from __future__ import annotations

from datetime import datetime

from app.models.user import User, UserRole, UserStatus
from app.services.auth_security import hash_password
from app.services.auth_service import AuthService


def create_user(db_session, *, email: str, role: UserRole = UserRole.USER) -> User:
    user = User(
        email=email,
        password_hash=hash_password("abc12345"),
        role=role,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.flush()
    return user


def issue_token(db_session, user: User) -> str:
    result = AuthService().create_session(db_session, user=user, user_agent="pytest", ip_address="127.0.0.1")
    db_session.commit()
    return result.token


def test_admin_users_are_paginated_and_include_dashboard_activity(client, db_session):
    admin = create_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    reader = create_user(db_session, email="reader@example.com")
    reader.last_dashboard_at = datetime(2026, 8, 26, 10, 0, 0)
    reader.last_dashboard_locale = "zh"
    db_session.commit()
    token = issue_token(db_session, admin)

    response = client.get("/admin/users?query=reader&page=1&page_size=10", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["email"] == "reader@example.com"
    assert body["items"][0]["last_dashboard_at"] == "2026-08-26T10:00:00"
    assert body["items"][0]["last_dashboard_locale"] == "zh"
    assert body["pagination"]["total"] == 1


def test_dashboard_activity_endpoint_updates_user_locale(client, db_session):
    user = create_user(db_session, email="reader@example.com")
    token = issue_token(db_session, user)

    response = client.post("/auth/me/dashboard-activity", json={"locale": "en"}, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 204
    db_session.refresh(user)
    assert user.last_dashboard_at is not None
    assert user.last_dashboard_locale == "en"


def test_admin_can_create_impersonation_token_and_read_as_target_user(client, db_session):
    admin = create_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    reader = create_user(db_session, email="reader@example.com")
    admin_token = issue_token(db_session, admin)

    response = client.post(
        "/admin/impersonation",
        json={"target_user_id": reader.id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 201
    impersonation_token = response.json()["token"]
    me_response = client.get("/auth/me", headers={"Authorization": f"Bearer {impersonation_token}"})
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "reader@example.com"
```

Run: `cd services/api && .venv/bin/python -m pytest tests/test_admin_users_api.py -q`
Expected: FAIL because schemas and endpoints are missing.

- [ ] **Step 2: Extend user schemas**

Modify `services/api/app/schemas/auth.py` `UserRead`:

```python
    last_dashboard_at: datetime | None = None
    last_dashboard_locale: str = ""
```

Create `services/api/app/schemas/admin.py`:

```python
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
```

- [ ] **Step 3: Update user serialization and dashboard endpoint**

Modify `services/api/app/api/routes/auth.py`:

```python
from app.schemas.admin import DashboardActivityUpdate
```

Update `serialize_user`:

```python
        last_dashboard_at=user.last_dashboard_at,
        last_dashboard_locale=user.last_dashboard_locale or "",
```

Add route:

```python
@router.post("/me/dashboard-activity", status_code=status.HTTP_204_NO_CONTENT)
def record_dashboard_activity(
    payload: DashboardActivityUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    current_user.last_dashboard_at = datetime.utcnow()
    current_user.last_dashboard_locale = payload.locale
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 4: Add impersonation service**

Create `services/api/app/services/admin_impersonation_service.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.admin_content import AdminImpersonationToken
from app.models.user import User, UserRole, UserStatus
from app.services.auth_security import generate_session_token, hash_token


@dataclass(frozen=True)
class ImpersonationResult:
    token: str
    target_user: User
    expires_at: datetime


class ImpersonationError(ValueError):
    pass


class AdminImpersonationService:
    def create_token(self, db: Session, *, admin: User, target_user_id: str) -> ImpersonationResult:
        if admin.role != UserRole.ADMIN:
            raise ImpersonationError("Admin access required")
        target = db.get(User, target_user_id)
        if target is None or target.status != UserStatus.ACTIVE:
            raise ImpersonationError("Target user not found")
        token = generate_session_token()
        expires_at = datetime.utcnow() + timedelta(minutes=30)
        db.add(
            AdminImpersonationToken(
                token_hash=hash_token(token),
                admin_user_id=admin.id,
                target_user_id=target.id,
                expires_at=expires_at,
            )
        )
        db.commit()
        return ImpersonationResult(token=token, target_user=target, expires_at=expires_at)

    def authenticate_token(self, db: Session, token: str) -> tuple[User, AdminImpersonationToken] | None:
        stored = db.scalar(
            select(AdminImpersonationToken).where(
                AdminImpersonationToken.token_hash == hash_token(token),
                AdminImpersonationToken.revoked_at.is_(None),
                AdminImpersonationToken.expires_at > datetime.utcnow(),
            )
        )
        if stored is None:
            return None
        target = db.get(User, stored.target_user_id)
        if target is None or target.status != UserStatus.ACTIVE:
            return None
        stored.last_used_at = datetime.utcnow()
        return target, stored
```

- [ ] **Step 5: Teach deps to accept impersonation tokens**

Modify `services/api/app/api/deps.py`:

```python
from app.services.admin_impersonation_service import AdminImpersonationService
```

Change `CurrentSession`:

```python
@dataclass
class CurrentSession:
    user: User
    session: AuthSession | None
    impersonated_by_admin_id: str | None = None
```

In `get_current_session`, after normal session auth fails, try impersonation:

```python
    try:
        user, session = AuthService().authenticate_token(db, token)
        return CurrentSession(user=user, session=session)
    except AccountDisabled as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except InvalidCredentials:
        impersonation = AdminImpersonationService().authenticate_token(db, token)
        if impersonation is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        user, impersonation_token = impersonation
        db.commit()
        return CurrentSession(
            user=user,
            session=None,
            impersonated_by_admin_id=impersonation_token.admin_user_id,
        )
```

In `get_current_admin_user`, keep checking `current_user.role == UserRole.ADMIN`. This prevents impersonated normal users from calling admin endpoints.

Update `/auth/logout` to handle `session is None` by returning 204 after clearing cookie.

- [ ] **Step 6: Paginate admin users and create impersonation route**

Modify `services/api/app/api/routes/admin.py` imports:

```python
from app.schemas.admin import AdminUserList, ImpersonationCreate, ImpersonationRead
from app.services.admin_impersonation_service import AdminImpersonationService, ImpersonationError
from app.services.pagination import paginate_sequence
```

Update `list_admin_users`:

```python
@router.get("/users", response_model=AdminUserList)
def list_admin_users(
    query: str = "",
    role: str = Query(default="", pattern="^(|user|admin)$"),
    status_filter: str = Query(default="", alias="status", pattern="^(|active|disabled)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AdminUserList:
    users = get_admin_service().list_users(db, query=query, role=role, status=status_filter)
    items, pagination = paginate_sequence(users, page, page_size)
    return AdminUserList(items=[serialize_user(user) for user in items], pagination=pagination)
```

Add:

```python
@router.post("/impersonation", response_model=ImpersonationRead, status_code=status.HTTP_201_CREATED)
def create_impersonation_token(
    payload: ImpersonationCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> ImpersonationRead:
    try:
        result = AdminImpersonationService().create_token(db, admin=admin, target_user_id=payload.target_user_id)
    except ImpersonationError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return ImpersonationRead(
        token=result.token,
        target_user=serialize_user(result.target_user),
        expires_at=result.expires_at,
    )
```

- [ ] **Step 7: Run backend user tests**

Run: `cd services/api && .venv/bin/python -m pytest tests/test_admin_api.py tests/test_admin_users_api.py tests/test_auth_api.py -q`
Expected: PASS.

- [ ] **Step 8: Commit users and impersonation**

```bash
git add services/api/app/schemas services/api/app/services/admin_impersonation_service.py services/api/app/api/deps.py services/api/app/api/routes/auth.py services/api/app/api/routes/admin.py services/api/tests/test_admin_users_api.py services/api/tests/test_admin_api.py
git commit -m "feat: add reader admin user controls"
```

---

### Task 3: Blog Admin and Public Blog API

**Files:**
- Modify: `services/api/app/schemas/admin.py`
- Create: `services/api/app/services/admin_blog_service.py`
- Modify: `services/api/app/api/routes/admin.py`
- Create: `services/api/app/api/routes/blogs.py`
- Modify: `services/api/app/api/router.py`
- Test: `services/api/tests/test_admin_blogs_api.py`

- [ ] **Step 1: Add failing blog API tests**

Append to `services/api/tests/test_admin_blogs_api.py`:

```python
from datetime import datetime

from app.models.user import User, UserRole, UserStatus
from app.services.auth_security import hash_password
from app.services.auth_service import AuthService


def create_admin(db_session):
    user = User(
        email="admin@example.com",
        password_hash=hash_password("abc12345"),
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.flush()
    token = AuthService().create_session(db_session, user=user, user_agent="pytest", ip_address="127.0.0.1").token
    db_session.commit()
    return user, token


def test_admin_blog_crud_list_omits_body_and_public_only_shows_published(client, db_session):
    _admin, token = create_admin(db_session)

    create_response = client.post(
        "/admin/blogs",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "后台规划",
            "slug": "reader-admin",
            "language": "zh",
            "summary": "后台模块规划",
            "body_markdown": "# 后台规划\n\n正文 <script>alert(1)</script>",
            "seo_title": "后台规划",
            "seo_description": "后台模块规划",
        },
    )
    assert create_response.status_code == 201
    post_id = create_response.json()["id"]

    list_response = client.get("/admin/blogs", headers={"Authorization": f"Bearer {token}"})
    assert list_response.status_code == 200
    item = list_response.json()["items"][0]
    assert item["title"] == "后台规划"
    assert "body_markdown" not in item
    assert "body_html" not in item

    detail_response = client.get(f"/admin/blogs/{post_id}", headers={"Authorization": f"Bearer {token}"})
    assert detail_response.status_code == 200
    assert "<script" not in detail_response.json()["body_html"]

    assert client.get("/blogs?lang=zh").json()["items"] == []

    publish_response = client.post(f"/admin/blogs/{post_id}/publish", headers={"Authorization": f"Bearer {token}"})
    assert publish_response.status_code == 200
    public_response = client.get("/blogs?lang=zh")
    assert public_response.json()["items"][0]["slug"] == "reader-admin"


def test_admin_blog_bulk_offline_and_soft_delete(client, db_session):
    _admin, token = create_admin(db_session)
    first = client.post(
        "/admin/blogs",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "一", "slug": "one", "language": "zh", "body_markdown": "正文"},
    ).json()
    second = client.post(
        "/admin/blogs",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "二", "slug": "two", "language": "zh", "body_markdown": "正文"},
    ).json()

    bulk_response = client.post(
        "/admin/blogs/bulk",
        headers={"Authorization": f"Bearer {token}"},
        json={"ids": [first["id"], second["id"]], "action": "delete"},
    )

    assert bulk_response.status_code == 200
    assert bulk_response.json()["updated_count"] == 2
    assert client.get("/admin/blogs", headers={"Authorization": f"Bearer {token}"}).json()["items"] == []
```

Run: `cd services/api && .venv/bin/python -m pytest tests/test_admin_blogs_api.py -q`
Expected: FAIL because routes are missing.

- [ ] **Step 2: Add blog schemas**

Append to `services/api/app/schemas/admin.py`:

```python
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
    status: str
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime


class BlogDetail(BlogListItem):
    cover_image_url: str
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
```

- [ ] **Step 3: Create blog service**

Create `services/api/app/services/admin_blog_service.py` with:

```python
from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.admin_content import BlogPost, BlogPostStatus
from app.models.user import User
from app.services.admin_content_service import render_markdown_to_safe_html


def normalize_slug(value: str) -> str:
    return value.strip().lower().replace(" ", "-")


def list_blog_posts(db: Session, *, query: str = "", status: str = "", language: str = "") -> list[BlogPost]:
    statement = select(BlogPost).where(BlogPost.status != BlogPostStatus.DELETED)
    if query.strip():
        statement = statement.where(func.lower(BlogPost.title).contains(query.strip().lower()))
    if status:
        statement = statement.where(BlogPost.status == BlogPostStatus(status))
    if language:
        statement = statement.where(BlogPost.language == language)
    return list(db.scalars(statement.order_by(BlogPost.updated_at.desc(), BlogPost.created_at.desc())).all())


def list_public_blog_posts(db: Session, *, language: str) -> list[BlogPost]:
    return list(
        db.scalars(
            select(BlogPost)
            .where(BlogPost.status == BlogPostStatus.PUBLISHED, BlogPost.language == language, BlogPost.deleted_at.is_(None))
            .order_by(BlogPost.published_at.desc().nullslast(), BlogPost.created_at.desc())
        )
    )


def get_blog_or_raise(db: Session, blog_id: str) -> BlogPost:
    post = db.get(BlogPost, blog_id)
    if post is None or post.status == BlogPostStatus.DELETED:
        raise ValueError("Blog post not found")
    return post


def get_public_blog_by_slug(db: Session, *, slug: str, language: str) -> BlogPost:
    post = db.scalar(
        select(BlogPost).where(
            BlogPost.slug == normalize_slug(slug),
            BlogPost.language == language,
            BlogPost.status == BlogPostStatus.PUBLISHED,
            BlogPost.deleted_at.is_(None),
        )
    )
    if post is None:
        raise ValueError("Blog post not found")
    return post


def create_blog_post(db: Session, *, actor: User, payload) -> BlogPost:
    post = BlogPost(
        title=payload.title.strip(),
        slug=normalize_slug(payload.slug),
        language=payload.language,
        summary=payload.summary.strip(),
        cover_image_url=payload.cover_image_url.strip(),
        body_markdown=payload.body_markdown,
        body_html=render_markdown_to_safe_html(payload.body_markdown),
        author_user_id=actor.id,
        seo_title=payload.seo_title.strip(),
        seo_description=payload.seo_description.strip(),
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def update_blog_post(db: Session, post: BlogPost, payload) -> BlogPost:
    for field in ["title", "language", "summary", "cover_image_url", "seo_title", "seo_description"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(post, field, value.strip() if isinstance(value, str) else value)
    if payload.slug is not None:
        post.slug = normalize_slug(payload.slug)
    if payload.body_markdown is not None:
        post.body_markdown = payload.body_markdown
        post.body_html = render_markdown_to_safe_html(payload.body_markdown)
    db.commit()
    db.refresh(post)
    return post


def set_blog_status(db: Session, post: BlogPost, status: BlogPostStatus) -> BlogPost:
    post.status = status
    if status == BlogPostStatus.PUBLISHED and post.published_at is None:
        post.published_at = datetime.utcnow()
    if status == BlogPostStatus.DELETED:
        post.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(post)
    return post


def bulk_blog_action(db: Session, *, ids: list[str], action: str) -> tuple[int, list[str]]:
    updated_count = 0
    failed_ids: list[str] = []
    status_by_action = {
        "publish": BlogPostStatus.PUBLISHED,
        "offline": BlogPostStatus.OFFLINE,
        "delete": BlogPostStatus.DELETED,
    }
    for blog_id in ids:
        post = db.get(BlogPost, blog_id)
        if post is None or post.status == BlogPostStatus.DELETED:
            failed_ids.append(blog_id)
            continue
        set_blog_status(db, post, status_by_action[action])
        updated_count += 1
    return updated_count, failed_ids
```

- [ ] **Step 4: Add admin blog routes and serializers**

Add route functions to `services/api/app/api/routes/admin.py` or a mounted admin subrouter. Use these serializers:

```python
def blog_author_email(db: Session, post: BlogPost) -> str:
    author = db.get(User, post.author_user_id)
    return author.email if author is not None else ""


def serialize_blog_item(db: Session, post: BlogPost) -> BlogListItem:
    return BlogListItem(
        id=post.id,
        title=post.title,
        slug=post.slug,
        language=post.language,
        author_email=blog_author_email(db, post),
        summary=post.summary,
        status=post.status.value,
        published_at=post.published_at,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def serialize_blog_detail(db: Session, post: BlogPost) -> BlogDetail:
    item = serialize_blog_item(db, post)
    return BlogDetail(
        **item.model_dump(),
        cover_image_url=post.cover_image_url,
        body_markdown=post.body_markdown,
        body_html=post.body_html,
        seo_title=post.seo_title,
        seo_description=post.seo_description,
    )
```

Add endpoints:

```python
@router.get("/blogs", response_model=BlogList)
def list_admin_blogs(
    query: str = "",
    status_filter: str = Query(default="", alias="status", pattern="^(|draft|published|offline)$"),
    language: str = Query(default="", pattern="^(|zh|en)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> BlogList:
    posts = list_blog_posts(db, query=query, status=status_filter, language=language)
    page_posts, pagination = paginate_sequence(posts, page, page_size)
    return BlogList(items=[serialize_blog_item(db, post) for post in page_posts], pagination=pagination)
```

Add `POST /admin/blogs`, `GET /admin/blogs/{blog_id}`, `PATCH /admin/blogs/{blog_id}`, `POST /admin/blogs/{blog_id}/publish`, `POST /admin/blogs/{blog_id}/offline`, `DELETE /admin/blogs/{blog_id}`, and `POST /admin/blogs/bulk` using the service functions from Step 3.

- [ ] **Step 5: Add public blog routes**

Create `services/api/app/api/routes/blogs.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.admin import BlogDetail, BlogList, BlogListItem
from app.services.admin_blog_service import get_public_blog_by_slug, list_public_blog_posts
from app.services.pagination import paginate_sequence

router = APIRouter(prefix="/blogs", tags=["blogs"])


@router.get("", response_model=BlogList)
def list_public_blogs(
    lang: str = Query(default="zh", pattern="^(zh|en)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> BlogList:
    posts = list_public_blog_posts(db, language=lang)
    page_posts, pagination = paginate_sequence(posts, page, page_size)
    return BlogList(
        items=[
            BlogListItem(
                id=post.id,
                title=post.title,
                slug=post.slug,
                language=post.language,
                author_email="",
                summary=post.summary,
                status=post.status.value,
                published_at=post.published_at,
                created_at=post.created_at,
                updated_at=post.updated_at,
            )
            for post in page_posts
        ],
        pagination=pagination,
    )


@router.get("/{slug}", response_model=BlogDetail)
def get_public_blog(slug: str, lang: str = Query(default="zh", pattern="^(zh|en)$"), db: Session = Depends(get_db)) -> BlogDetail:
    try:
        post = get_public_blog_by_slug(db, slug=slug, language=lang)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return BlogDetail(
        id=post.id,
        title=post.title,
        slug=post.slug,
        language=post.language,
        author_email="",
        summary=post.summary,
        status=post.status.value,
        published_at=post.published_at,
        created_at=post.created_at,
        updated_at=post.updated_at,
        cover_image_url=post.cover_image_url,
        body_markdown=post.body_markdown,
        body_html=post.body_html,
        seo_title=post.seo_title,
        seo_description=post.seo_description,
    )
```

Modify `services/api/app/api/router.py`:

```python
from app.api.routes import admin, auth, blogs, courses, feedback, health, internal, jobs
api_router.include_router(blogs.router)
```

- [ ] **Step 6: Run blog tests**

Run: `cd services/api && .venv/bin/python -m pytest tests/test_admin_blogs_api.py -q`
Expected: PASS.

- [ ] **Step 7: Commit blog API**

```bash
git add services/api/app/schemas/admin.py services/api/app/services/admin_blog_service.py services/api/app/api/routes/admin.py services/api/app/api/routes/blogs.py services/api/app/api/router.py services/api/tests/test_admin_blogs_api.py
git commit -m "feat: add admin blog management api"
```

---

### Task 4: Admin Course Management API

**Files:**
- Modify: `services/api/app/schemas/admin.py`
- Create: `services/api/app/services/admin_course_service.py`
- Modify: `services/api/app/api/routes/admin.py`
- Test: `services/api/tests/test_admin_courses_api.py`

- [ ] **Step 1: Write failing admin course tests**

Create `services/api/tests/test_admin_courses_api.py`:

```python
from datetime import datetime

from app.models.course import ArticleText, Course, CourseStatus, SourceType
from app.models.file_resource import FileResource, ResourceKind, ResourceStatus, ResourceVariant
from app.models.user import User, UserRole, UserStatus
from app.services.auth_security import hash_password
from app.services.auth_service import AuthService


def create_user(db_session, *, email: str, role: UserRole = UserRole.USER):
    user = User(
        email=email,
        password_hash=hash_password("abc12345"),
        role=role,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.flush()
    return user


def token_for(db_session, user: User) -> str:
    token = AuthService().create_session(db_session, user=user, user_agent="pytest", ip_address="127.0.0.1").token
    db_session.commit()
    return token


def create_course(db_session, *, user_id: str, title: str) -> Course:
    course = Course(user_id=user_id, title=title, source_type=SourceType.MANUAL_TEXT, status=CourseStatus.READY)
    db_session.add(course)
    db_session.flush()
    db_session.add(ArticleText(course_id=course.id, version=1, text="正文", content_markdown="正文"))
    db_session.add(
        FileResource(
            user_id=user_id,
            owner_type="course",
            owner_id=course.id,
            resource_kind=ResourceKind.EXPORT,
            resource_variant=ResourceVariant.PDF,
            status=ResourceStatus.READY,
            title=title,
            filename=f"{title}.pdf",
            object_path="/tmp/course.pdf",
            content_type="application/pdf",
        )
    )
    db_session.commit()
    return course


def test_admin_course_list_searches_title_and_email_without_body(client, db_session):
    admin = create_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    reader = create_user(db_session, email="reader@example.com")
    create_course(db_session, user_id=reader.id, title="英语阅读")
    token = token_for(db_session, admin)

    response = client.get("/admin/courses?query=英语&email=reader&page=1&page_size=20", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["title"] == "英语阅读"
    assert body["items"][0]["user_email"] == "reader@example.com"
    assert body["items"][0]["resource_counts"]["pdf"] == 1
    assert "content_markdown" not in body["items"][0]
    assert body["pagination"]["total"] == 1


def test_admin_course_detail_returns_body_and_delete_soft_deletes(client, db_session):
    admin = create_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    reader = create_user(db_session, email="reader@example.com")
    course = create_course(db_session, user_id=reader.id, title="英语阅读")
    token = token_for(db_session, admin)

    detail = client.get(f"/admin/courses/{course.id}", headers={"Authorization": f"Bearer {token}"})
    assert detail.status_code == 200
    assert detail.json()["content_markdown"] == "正文"

    delete_response = client.delete(f"/admin/courses/{course.id}", headers={"Authorization": f"Bearer {token}"})
    assert delete_response.status_code == 204
    db_session.refresh(course)
    assert course.is_deleted is True
```

Run: `cd services/api && .venv/bin/python -m pytest tests/test_admin_courses_api.py -q`
Expected: FAIL because admin course routes are missing.

- [ ] **Step 2: Add course admin schemas**

Append to `services/api/app/schemas/admin.py`:

```python
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
```

- [ ] **Step 3: Create admin course service**

Create `services/api/app/services/admin_course_service.py`:

```python
from __future__ import annotations

from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.course import ArticleImageAsset, ArticleText, AudioAsset, Course
from app.models.file_resource import FileResource, ResourceKind, ResourceStatus, ResourceVariant
from app.models.user import User


def list_admin_courses(db: Session, *, query: str = "", email: str = "") -> list[Course]:
    statement = (
        select(Course)
        .options(selectinload(Course.article_texts))
        .where(Course.is_deleted.is_(False))
        .order_by(Course.created_at.desc(), Course.id.desc())
    )
    if query.strip():
        statement = statement.where(func.lower(Course.title).contains(query.strip().lower()))
    if email.strip():
        matching_user_ids = select(User.id).where(func.lower(User.email).contains(email.strip().lower()))
        statement = statement.where(Course.user_id.in_(matching_user_ids))
    return list(db.scalars(statement).all())


def get_admin_course_or_raise(db: Session, course_id: str) -> Course:
    course = db.scalar(select(Course).where(Course.id == course_id, Course.is_deleted.is_(False)))
    if course is None:
        raise ValueError("Course not found")
    return course


def latest_course_markdown(course: Course) -> str | None:
    if not course.article_texts:
        return None
    latest = sorted(course.article_texts, key=lambda item: (item.version, item.created_at, item.id), reverse=True)[0]
    return latest.content_markdown


def resource_counts_for_course(db: Session, course: Course) -> dict[str, int]:
    counts = Counter({"image": 0, "audio": 0, "pdf": 0, "docx": 0, "markdown": 0})
    image_count = db.scalar(select(func.count()).select_from(ArticleImageAsset).where(ArticleImageAsset.course_id == course.id))
    audio_count = db.scalar(select(func.count()).select_from(AudioAsset).where(AudioAsset.course_id == course.id))
    counts["image"] = int(image_count or 0)
    counts["audio"] = int(audio_count or 0)
    rows = db.execute(
        select(FileResource.resource_variant, func.count(FileResource.id))
        .where(FileResource.owner_type == "course", FileResource.owner_id == course.id, FileResource.status == ResourceStatus.READY)
        .group_by(FileResource.resource_variant)
    ).all()
    for variant, total in rows:
        if variant == ResourceVariant.PDF:
            counts["pdf"] += int(total)
        elif variant == ResourceVariant.DOCX:
            counts["docx"] += int(total)
        elif variant == ResourceVariant.MARKDOWN:
            counts["markdown"] += int(total)
        elif variant == ResourceVariant.AUDIO:
            counts["audio"] += int(total)
    return dict(counts)


def user_email_for_course(db: Session, course: Course) -> str:
    user = db.get(User, course.user_id)
    return user.email if user is not None else ""


def soft_delete_admin_course(db: Session, course: Course) -> None:
    course.is_deleted = True
    db.commit()
```

- [ ] **Step 4: Add admin course routes**

Add serializers to `services/api/app/api/routes/admin.py`:

```python
def serialize_admin_course_item(db: Session, course: Course) -> AdminCourseListItem:
    counts = resource_counts_for_course(db, course)
    return AdminCourseListItem(
        id=course.id,
        title=course.title,
        user_email=user_email_for_course(db, course),
        source_type=course.source_type.value,
        status=course.status.value,
        created_at=course.created_at,
        updated_at=course.updated_at,
        resource_counts=AdminCourseResourceCounts(**counts),
        audio_download_url=f"/admin/courses/{course.id}/downloads/audio" if counts["audio"] > 0 else None,
        pdf_download_url=f"/admin/courses/{course.id}/downloads/pdf",
        docx_download_url=f"/admin/courses/{course.id}/downloads/docx",
        markdown_download_url=f"/admin/courses/{course.id}/downloads/markdown",
    )
```

Add endpoints:

```python
@router.get("/courses", response_model=AdminCourseList)
def list_admin_courses_route(
    query: str = "",
    email: str = "",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AdminCourseList:
    courses = list_admin_courses(db, query=query, email=email)
    page_courses, pagination = paginate_sequence(courses, page, page_size)
    return AdminCourseList(items=[serialize_admin_course_item(db, course) for course in page_courses], pagination=pagination)
```

Add:

- `GET /admin/courses/{course_id}` returning `AdminCourseDetail` and `content_markdown`.
- `DELETE /admin/courses/{course_id}` setting `is_deleted=True`.
- `POST /admin/courses/bulk-delete` looping over IDs and soft deleting found courses.
- `POST /admin/courses/{course_id}/downloads/{format}` that reuses `request_course_download(db, course, format)` and returns `DownloadRequestRead`.

- [ ] **Step 5: Run admin course tests**

Run: `cd services/api && .venv/bin/python -m pytest tests/test_admin_courses_api.py tests/test_course_deletion.py -q`
Expected: PASS.

- [ ] **Step 6: Commit admin course API**

```bash
git add services/api/app/schemas/admin.py services/api/app/services/admin_course_service.py services/api/app/api/routes/admin.py services/api/tests/test_admin_courses_api.py
git commit -m "feat: add admin course management api"
```

---

### Task 5: Announcement Admin and Dashboard API

**Files:**
- Modify: `services/api/app/schemas/admin.py`
- Create: `services/api/app/services/admin_announcement_service.py`
- Modify: `services/api/app/api/routes/admin.py`
- Create: `services/api/app/api/routes/announcements.py`
- Modify: `services/api/app/api/router.py`
- Test: `services/api/tests/test_admin_announcements_api.py`

- [ ] **Step 1: Add failing announcement API tests**

Append to `services/api/tests/test_admin_announcements_api.py`:

```python
from datetime import datetime

from app.models.user import User, UserRole, UserStatus
from app.services.auth_security import hash_password
from app.services.auth_service import AuthService


def create_admin_token(db_session) -> str:
    admin = User(
        email="admin@example.com",
        password_hash=hash_password("abc12345"),
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(admin)
    db_session.flush()
    token = AuthService().create_session(db_session, user=admin, user_agent="pytest", ip_address="127.0.0.1").token
    db_session.commit()
    return token


def test_admin_announcement_crud_list_omits_body_and_dashboard_only_shows_published(client, db_session):
    token = create_admin_token(db_session)
    create_response = client.post(
        "/admin/announcements",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "文件导入优化",
            "language": "zh",
            "body_markdown": "正在开发 <script>alert(1)</script>",
            "roadmap_status": "in_progress",
            "display_position": "dashboard",
            "sort_order": 3,
            "is_pinned": True,
        },
    )
    assert create_response.status_code == 201
    announcement_id = create_response.json()["id"]

    list_response = client.get("/admin/announcements", headers={"Authorization": f"Bearer {token}"})
    item = list_response.json()["items"][0]
    assert item["title"] == "文件导入优化"
    assert "body_markdown" not in item
    assert "body_html" not in item

    assert client.get("/announcements/dashboard?lang=zh").json()["items"] == []
    publish_response = client.post(f"/admin/announcements/{announcement_id}/publish", headers={"Authorization": f"Bearer {token}"})
    assert publish_response.status_code == 200
    dashboard_response = client.get("/announcements/dashboard?lang=zh")
    assert dashboard_response.json()["items"][0]["title"] == "文件导入优化"


def test_admin_announcement_reorder(client, db_session):
    token = create_admin_token(db_session)
    first = client.post(
        "/admin/announcements",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "一", "language": "zh", "body_markdown": "正文", "sort_order": 1},
    ).json()
    second = client.post(
        "/admin/announcements",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "二", "language": "zh", "body_markdown": "正文", "sort_order": 2},
    ).json()

    response = client.post(
        "/admin/announcements/reorder",
        headers={"Authorization": f"Bearer {token}"},
        json={"items": [{"id": second["id"], "sort_order": 1}, {"id": first["id"], "sort_order": 2}]},
    )

    assert response.status_code == 204
```

Run: `cd services/api && .venv/bin/python -m pytest tests/test_admin_announcements_api.py -q`
Expected: FAIL because routes are missing.

- [ ] **Step 2: Add announcement schemas**

Append to `services/api/app/schemas/admin.py`:

```python
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
```

- [ ] **Step 3: Create announcement service**

Create `services/api/app/services/admin_announcement_service.py`:

```python
from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.admin_content import Announcement, AnnouncementRoadmapStatus, AnnouncementStatus
from app.services.admin_content_service import render_markdown_to_safe_html


def list_announcements(db: Session, *, query: str = "", status: str = "", language: str = "") -> list[Announcement]:
    statement = select(Announcement).where(Announcement.status != AnnouncementStatus.DELETED)
    if query.strip():
        statement = statement.where(func.lower(Announcement.title).contains(query.strip().lower()))
    if status:
        statement = statement.where(Announcement.status == AnnouncementStatus(status))
    if language:
        statement = statement.where(Announcement.language == language)
    return list(
        db.scalars(
            statement.order_by(
                Announcement.is_pinned.desc(),
                Announcement.sort_order.asc(),
                Announcement.updated_at.desc(),
            )
        ).all()
    )


def list_public_dashboard_announcements(db: Session, *, language: str) -> list[Announcement]:
    return list(
        db.scalars(
            select(Announcement)
            .where(
                Announcement.status == AnnouncementStatus.PUBLISHED,
                Announcement.language == language,
                Announcement.display_position == "dashboard",
                Announcement.deleted_at.is_(None),
            )
            .order_by(
                Announcement.is_pinned.desc(),
                Announcement.sort_order.asc(),
                Announcement.published_at.desc().nullslast(),
                Announcement.created_at.desc(),
            )
        )
    )


def get_announcement_or_raise(db: Session, announcement_id: str) -> Announcement:
    announcement = db.get(Announcement, announcement_id)
    if announcement is None or announcement.status == AnnouncementStatus.DELETED:
        raise ValueError("Announcement not found")
    return announcement


def create_announcement(db: Session, *, payload) -> Announcement:
    announcement = Announcement(
        title=payload.title.strip(),
        language=payload.language,
        body_markdown=payload.body_markdown,
        body_html=render_markdown_to_safe_html(payload.body_markdown),
        roadmap_status=AnnouncementRoadmapStatus(payload.roadmap_status),
        display_position=payload.display_position,
        sort_order=payload.sort_order,
        is_pinned=payload.is_pinned,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return announcement


def update_announcement(db: Session, announcement: Announcement, payload) -> Announcement:
    if payload.title is not None:
        announcement.title = payload.title.strip()
    if payload.language is not None:
        announcement.language = payload.language
    if payload.body_markdown is not None:
        announcement.body_markdown = payload.body_markdown
        announcement.body_html = render_markdown_to_safe_html(payload.body_markdown)
    if payload.roadmap_status is not None:
        announcement.roadmap_status = AnnouncementRoadmapStatus(payload.roadmap_status)
    if payload.display_position is not None:
        announcement.display_position = payload.display_position
    if payload.sort_order is not None:
        announcement.sort_order = payload.sort_order
    if payload.is_pinned is not None:
        announcement.is_pinned = payload.is_pinned
    db.commit()
    db.refresh(announcement)
    return announcement


def set_announcement_status(db: Session, announcement: Announcement, status: AnnouncementStatus) -> Announcement:
    announcement.status = status
    if status == AnnouncementStatus.PUBLISHED and announcement.published_at is None:
        announcement.published_at = datetime.utcnow()
    if status == AnnouncementStatus.DELETED:
        announcement.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(announcement)
    return announcement


def reorder_announcements(db: Session, *, items) -> None:
    for item in items:
        announcement = get_announcement_or_raise(db, item.id)
        announcement.sort_order = item.sort_order
    db.commit()
```

- [ ] **Step 4: Add admin and public announcement routes**

Add admin endpoints:

- `GET /admin/announcements`
- `POST /admin/announcements`
- `GET /admin/announcements/{announcement_id}`
- `PATCH /admin/announcements/{announcement_id}`
- `POST /admin/announcements/{announcement_id}/publish`
- `POST /admin/announcements/{announcement_id}/offline`
- `DELETE /admin/announcements/{announcement_id}`
- `POST /admin/announcements/reorder`

Create `services/api/app/api/routes/announcements.py` with:

```python
@router.get("/dashboard", response_model=AnnouncementList)
def list_dashboard_announcements(lang: str = Query(default="zh", pattern="^(zh|en)$"), db: Session = Depends(get_db)) -> AnnouncementList:
    announcements = list_public_dashboard_announcements(db, language=lang)
    return AnnouncementList(
        items=[serialize_public_announcement(item) for item in announcements],
        pagination=PaginationRead(
            page=1,
            page_size=len(announcements),
            total=len(announcements),
            total_pages=1,
            has_previous=False,
            has_next=False,
        ),
    )
```

Mount it in `services/api/app/api/router.py`:

```python
from app.api.routes import admin, announcements, auth, blogs, courses, feedback, health, internal, jobs
api_router.include_router(announcements.router)
```

- [ ] **Step 5: Run announcement tests**

Run: `cd services/api && .venv/bin/python -m pytest tests/test_admin_announcements_api.py -q`
Expected: PASS.

- [ ] **Step 6: Commit announcement API**

```bash
git add services/api/app/schemas/admin.py services/api/app/services/admin_announcement_service.py services/api/app/api/routes/admin.py services/api/app/api/routes/announcements.py services/api/app/api/router.py services/api/tests/test_admin_announcements_api.py
git commit -m "feat: add admin announcement management api"
```

---

### Task 6: Frontend Admin API Types, Shell, Guard, and Deprecated Routes

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/components/AdminShell.tsx`
- Create: `apps/web/src/app/reader_admin/page.tsx`
- Modify: `apps/web/src/app/[locale]/admin/page.tsx`
- Modify: `apps/web/src/app/[locale]/admin/users/page.tsx`
- Test: `apps/web/tests/reader-admin.spec.ts`

- [ ] **Step 1: Add failing Playwright tests for admin entry**

Create `apps/web/tests/reader-admin.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

const apiHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};

async function routeMe(page: Page, token: string, role: "user" | "admin") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("pagealong_auth_token", value);
  }, token);
  await page.route(/http:\/\/localhost:(8000|8070)\/auth\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        id: role === "admin" ? "admin_1" : "user_1",
        email: role === "admin" ? "admin@example.com" : "reader@example.com",
        role,
        status: "active",
        email_verified_at: "2026-08-26T00:00:00",
        must_change_password_at_next_login: false,
        last_login_at: "2026-08-26T00:00:00",
        last_dashboard_at: null,
        last_dashboard_locale: "",
        created_at: "2026-08-26T00:00:00"
      })
    });
  });
}

test("reader admin redirects to users for admins", async ({ page }) => {
  await routeMe(page, "admin-token", "admin");
  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/users(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({ items: [], pagination: { page: 1, page_size: 20, total: 0, total_pages: 1, has_previous: false, has_next: false } })
    });
  });

  await page.goto("/reader_admin");
  await expect(page).toHaveURL(/\/reader_admin\/users$/);
  await expect(page.getByRole("heading", { name: "用户管理" })).toBeVisible();
});

test("reader admin blocks normal users", async ({ page }) => {
  await routeMe(page, "user-token", "user");
  await page.goto("/reader_admin/users");
  await expect(page.getByText("需要管理员权限")).toBeVisible();
});

test("old locale admin route redirects to reader admin", async ({ page }) => {
  await routeMe(page, "admin-token", "admin");
  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/users(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({ items: [], pagination: { page: 1, page_size: 20, total: 0, total_pages: 1, has_previous: false, has_next: false } })
    });
  });

  await page.goto("/zh/admin/users");
  await expect(page).toHaveURL(/\/reader_admin\/users$/);
});
```

Run: `cd apps/web && npm test -- reader-admin.spec.ts`
Expected: FAIL because routes do not exist.

- [ ] **Step 2: Add admin types**

Modify `apps/web/src/lib/types.ts`:

```ts
export type AdminUser = AuthUser & {
  last_dashboard_at: string | null;
  last_dashboard_locale: "zh" | "en" | "";
};

export type AdminResourceCounts = {
  image: number;
  audio: number;
  pdf: number;
  docx: number;
  markdown: number;
};

export type AdminCourseListItem = {
  id: string;
  title: string;
  user_email: string;
  source_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  resource_counts: AdminResourceCounts;
  audio_download_url: string | null;
  pdf_download_url: string | null;
  docx_download_url: string | null;
  markdown_download_url: string | null;
};

export type AdminCourseDetail = AdminCourseListItem & {
  content_markdown: string | null;
};

export type AdminBlogListItem = {
  id: string;
  title: string;
  slug: string;
  language: "zh" | "en";
  author_email: string;
  summary: string;
  status: "draft" | "published" | "offline" | "deleted";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminBlogDetail = AdminBlogListItem & {
  cover_image_url: string;
  body_markdown: string;
  body_html: string;
  seo_title: string;
  seo_description: string;
};

export type AdminAnnouncementListItem = {
  id: string;
  title: string;
  language: "zh" | "en";
  status: "draft" | "published" | "offline" | "deleted";
  roadmap_status: "planned" | "in_progress" | "shipped";
  display_position: "dashboard" | "announcement_page" | "global_banner";
  sort_order: number;
  is_pinned: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminAnnouncementDetail = AdminAnnouncementListItem & {
  body_markdown: string;
  body_html: string;
};
```

- [ ] **Step 3: Add API functions**

Modify `apps/web/src/lib/api.ts` imports from types and add functions:

```ts
export async function listReaderAdminUsers(input: {
  query?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedList<AdminUser>> {
  return apiJson<PaginatedList<AdminUser>>(
    `/admin/users${queryString({ query: input.query, page: input.page ?? 1, page_size: input.pageSize ?? 20 })}`,
    { cache: "no-store" },
    "Failed to load users"
  );
}

export async function recordDashboardActivity(locale: "zh" | "en"): Promise<void> {
  await apiNoContent(
    "/auth/me/dashboard-activity",
    { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ locale }) },
    "Failed to record dashboard activity"
  );
}

export async function createAdminImpersonation(targetUserId: string): Promise<{ token: string; target_user: AdminUser; expires_at: string }> {
  return apiJson(
    "/admin/impersonation",
    { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ target_user_id: targetUserId }) },
    "Failed to enter user page"
  );
}
```

Add blog, course, and announcement API functions in later frontend module tasks.

- [ ] **Step 4: Create AdminShell**

Create `apps/web/src/components/AdminShell.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { clearAuthToken, getCurrentUser, hasAuthToken, logoutCurrentSession } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

const navItems = [
  { href: "/reader_admin/users", label: "用户管理" },
  { href: "/reader_admin/blogs", label: "博客管理" },
  { href: "/reader_admin/courses", label: "课程管理" },
  { href: "/reader_admin/announcements", label: "公告板" }
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!hasAuthToken()) {
        router.replace(`/zh/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      try {
        const current = await getCurrentUser();
        if (cancelled) {
          return;
        }
        if (current.role !== "admin") {
          setDenied(true);
          return;
        }
        setUser(current);
      } catch {
        clearAuthToken();
        router.replace(`/zh/login?next=${encodeURIComponent(pathname)}`);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  async function signOut() {
    await logoutCurrentSession().catch(() => clearAuthToken());
    clearAuthToken();
    router.replace("/zh/login");
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--pa-muted)]">加载中</div>;
  }
  if (denied) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--pa-error)]">需要管理员权限</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--pa-bg)] text-[var(--pa-ink)]">
      <header className="border-b border-[var(--pa-line)] bg-[var(--pa-surface)] px-5 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link className="text-base font-semibold" href="/reader_admin/users">PageAlong Admin</Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[var(--pa-muted)]">{user?.email}</span>
            <Link className="rounded-md border border-[var(--pa-line)] px-3 py-1.5" href="/zh/dashboard">返回工作台</Link>
            <button className="rounded-md border border-[var(--pa-line)] px-3 py-1.5" type="button" onClick={signOut}>退出</button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5 md:grid-cols-[200px_1fr]">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                className={`block rounded-md px-3 py-2 text-sm ${active ? "bg-[var(--pa-green)] text-white" : "hover:bg-[var(--pa-green-soft)]"}`}
                href={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main>{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add routes and deprecated redirects**

Create `apps/web/src/app/reader_admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function ReaderAdminPage() {
  redirect("/reader_admin/users");
}
```

Modify old route files:

```tsx
import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/reader_admin/users");
}
```

- [ ] **Step 6: Create minimal users page for shell test**

Create `apps/web/src/app/reader_admin/users/page.tsx` with a simple `AdminShell`, heading, and `listReaderAdminUsers` call. The full users UI is Task 7.

- [ ] **Step 7: Run frontend admin shell test**

Run: `cd apps/web && npm test -- reader-admin.spec.ts`
Expected: PASS for the three tests in Step 1.

- [ ] **Step 8: Commit frontend shell**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/components/AdminShell.tsx apps/web/src/app/reader_admin apps/web/src/app/[locale]/admin apps/web/tests/reader-admin.spec.ts
git commit -m "feat: add reader admin shell"
```

---

### Task 7: Frontend User Management and Impersonation

**Files:**
- Modify: `apps/web/src/app/reader_admin/users/page.tsx`
- Create: `apps/web/src/components/ImpersonationBanner.tsx`
- Modify: `apps/web/src/components/ConsoleShell.tsx`
- Modify: `apps/web/src/app/[locale]/dashboard/page.tsx`
- Modify: `apps/web/tests/reader-admin.spec.ts`

- [ ] **Step 1: Extend Playwright tests for users page**

Append to `apps/web/tests/reader-admin.spec.ts`:

```ts
test("admin user page searches paginated users and enters user page", async ({ page }) => {
  await routeMe(page, "admin-token", "admin");
  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/users(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        items: [{
          id: "user_1",
          email: "reader@example.com",
          role: "user",
          status: "active",
          email_verified_at: "2026-08-26T00:00:00",
          must_change_password_at_next_login: false,
          last_login_at: "2026-08-26T00:00:00",
          last_dashboard_at: "2026-08-26T10:00:00",
          last_dashboard_locale: "zh",
          created_at: "2026-08-26T00:00:00"
        }],
        pagination: { page: 1, page_size: 20, total: 1, total_pages: 1, has_previous: false, has_next: false }
      })
    });
  });
  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/impersonation$/, async (route) => {
    await route.fulfill({
      status: 201,
      headers: apiHeaders,
      body: JSON.stringify({
        token: "impersonation-token",
        target_user: {
          id: "user_1",
          email: "reader@example.com",
          role: "user",
          status: "active",
          email_verified_at: "2026-08-26T00:00:00",
          must_change_password_at_next_login: false,
          last_login_at: "2026-08-26T00:00:00",
          last_dashboard_at: "2026-08-26T10:00:00",
          last_dashboard_locale: "zh",
          created_at: "2026-08-26T00:00:00"
        },
        expires_at: "2026-08-26T10:30:00"
      })
    });
  });

  await page.goto("/reader_admin/users");
  await page.getByPlaceholder("搜索邮箱").fill("reader");
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByText("reader@example.com")).toBeVisible();
  await page.getByRole("button", { name: "进入用户页面" }).click();
  expect(await page.evaluate(() => window.localStorage.getItem("pagealong_impersonation_return"))).toBe("/reader_admin/users");
});
```

Run: `cd apps/web && npm test -- reader-admin.spec.ts`
Expected: FAIL because the complete users UI is not present.

- [ ] **Step 2: Build the full users table**

Implement `apps/web/src/app/reader_admin/users/page.tsx`:

- Use `AdminShell`.
- Keep local state for `query`, `page`, `pageSize`, `users`, `pagination`, `loading`, `error`.
- Call `listReaderAdminUsers({ query, page, pageSize })`.
- Show columns: email, created_at, last_dashboard_at, last_dashboard_locale, role.
- Add buttons: `设置为管理员`, `进入用户页面`.
- Use existing `updateAdminUserRole(user.id, "promote")` for promotion.
- Use `createAdminImpersonation(user.id)` for user entry.
- Store current path in `localStorage.pagealong_impersonation_return`.
- Store returned token in `localStorage.pagealong_auth_token`.
- Redirect to `/${target.last_dashboard_locale || "zh"}/dashboard`.

- [ ] **Step 3: Add dashboard activity recording**

Modify `apps/web/src/app/[locale]/dashboard/page.tsx`:

```tsx
import { deleteCourse, listCourses, recordDashboardActivity } from "@/lib/api";
```

Inside `useEffect`:

```tsx
  useEffect(() => {
    void recordDashboardActivity(locale);
    void refresh();
  }, [locale]);
```

- [ ] **Step 4: Add impersonation banner**

Create `apps/web/src/components/ImpersonationBanner.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function ImpersonationBanner() {
  const router = useRouter();
  const [returnPath, setReturnPath] = useState("");

  useEffect(() => {
    setReturnPath(window.localStorage.getItem("pagealong_impersonation_return") ?? "");
  }, []);

  if (!returnPath) {
    return null;
  }

  function exitImpersonation() {
    window.localStorage.removeItem("pagealong_impersonation_return");
    router.replace(returnPath);
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      正在以用户身份查看。
      <button className="ml-3 underline underline-offset-2" type="button" onClick={exitImpersonation}>返回后台</button>
    </div>
  );
}
```

Render it near the top of `ConsoleShell`.

- [ ] **Step 5: Run user page tests**

Run: `cd apps/web && npm test -- reader-admin.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit frontend users**

```bash
git add apps/web/src/app/reader_admin/users/page.tsx apps/web/src/components/ImpersonationBanner.tsx apps/web/src/components/ConsoleShell.tsx apps/web/src/app/[locale]/dashboard/page.tsx apps/web/tests/reader-admin.spec.ts
git commit -m "feat: add reader admin users page"
```

---

### Task 8: Frontend Blog Editor, Admin Blog Pages, and Public Blog Pages

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/package-lock.json`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/components/AdminMarkdownEditor.tsx`
- Create: `apps/web/src/app/reader_admin/blogs/page.tsx`
- Create: `apps/web/src/app/reader_admin/blogs/new/page.tsx`
- Create: `apps/web/src/app/reader_admin/blogs/[blogId]/page.tsx`
- Modify: `apps/web/src/app/blog/page.tsx`
- Create: `apps/web/src/app/blog/[slug]/page.tsx`
- Modify: `apps/web/tests/reader-admin.spec.ts`

- [ ] **Step 1: Install Vditor**

Run: `cd apps/web && npm install vditor`
Expected: `package.json` and `package-lock.json` include `vditor`.

- [ ] **Step 2: Add blog API client functions**

Modify `apps/web/src/lib/api.ts`:

```ts
export async function listAdminBlogs(input: { query?: string; status?: string; language?: string; page?: number; pageSize?: number } = {}) {
  return apiJson<PaginatedList<AdminBlogListItem>>(
    `/admin/blogs${queryString({ query: input.query, status: input.status, language: input.language, page: input.page ?? 1, page_size: input.pageSize ?? 20 })}`,
    { cache: "no-store" },
    "Failed to load blogs"
  );
}

export async function getAdminBlog(blogId: string): Promise<AdminBlogDetail> {
  return apiJson<AdminBlogDetail>(`/admin/blogs/${blogId}`, { cache: "no-store" }, "Failed to load blog");
}

export async function createAdminBlog(input: Partial<AdminBlogDetail> & { title: string; slug: string; language: "zh" | "en"; body_markdown: string }) {
  return apiJson<AdminBlogDetail>("/admin/blogs", { method: "POST", headers: jsonHeaders(), body: JSON.stringify(input) }, "Failed to create blog");
}

export async function updateAdminBlog(blogId: string, input: Partial<AdminBlogDetail>) {
  return apiJson<AdminBlogDetail>(`/admin/blogs/${blogId}`, { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify(input) }, "Failed to save blog");
}

export async function publishAdminBlog(blogId: string) {
  return apiJson<AdminBlogDetail>(`/admin/blogs/${blogId}/publish`, { method: "POST" }, "Failed to publish blog");
}

export async function offlineAdminBlog(blogId: string) {
  return apiJson<AdminBlogDetail>(`/admin/blogs/${blogId}/offline`, { method: "POST" }, "Failed to offline blog");
}

export async function deleteAdminBlog(blogId: string) {
  await apiNoContent(`/admin/blogs/${blogId}`, { method: "DELETE" }, "Failed to delete blog");
}

export async function bulkAdminBlogs(ids: string[], action: "publish" | "offline" | "delete") {
  return apiJson<{ updated_count: number; failed_ids: string[] }>(
    "/admin/blogs/bulk",
    { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ ids, action }) },
    "Failed to update blogs"
  );
}

export async function listPublicBlogs(locale: "zh" | "en") {
  return apiJson<PaginatedList<AdminBlogListItem>>(`/blogs${queryString({ lang: locale })}`, { cache: "no-store" }, "Failed to load blogs", false);
}

export async function getPublicBlog(slug: string, locale: "zh" | "en") {
  return apiJson<AdminBlogDetail>(`/blogs/${slug}${queryString({ lang: locale })}`, { cache: "no-store" }, "Failed to load blog", false);
}
```

- [ ] **Step 3: Create Vditor wrapper**

Create `apps/web/src/components/AdminMarkdownEditor.tsx`:

```tsx
"use client";

import "vditor/dist/index.css";
import { useEffect, useRef } from "react";

export function AdminMarkdownEditor({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const Vditor = (await import("vditor")).default;
      if (!containerRef.current || cancelled) {
        return;
      }
      editorRef.current = new Vditor(containerRef.current, {
        value,
        mode: "ir",
        height: 420,
        cache: { enable: false },
        input: (nextValue: string) => onChange(nextValue),
        preview: { markdown: { toc: true } }
      });
    }
    void load();
    return () => {
      cancelled = true;
      editorRef.current?.destroy?.();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  return <div ref={containerRef} />;
}
```

- [ ] **Step 4: Add admin blog pages**

Create list, create, and edit pages under `/reader_admin/blogs`. Each page must use `AdminShell`, show Chinese labels, and call functions from Step 2.

List page required UI:

- title `博客管理`
- search input `按标题搜索`
- status filter
- language filter
- table fields from spec
- checkbox selection
- batch publish/offline/delete buttons
- row edit, publish/offline, delete buttons

Create/edit form required fields:

- title
- slug
- language
- summary
- body editor
- SEO title
- SEO description
- save button
- preview pane using `dangerouslySetInnerHTML` only with server-returned `body_html`

- [ ] **Step 5: Replace public blog coming-soon pages**

Modify `apps/web/src/app/blog/page.tsx` to call `listPublicBlogs(locale)` and render published posts in `SiteChrome`.

Create `apps/web/src/app/blog/[slug]/page.tsx` to call `getPublicBlog(params.slug, locale)` and render `body_html`.

- [ ] **Step 6: Add and run Playwright blog tests**

Append tests to `reader-admin.spec.ts` that route `/admin/blogs`, create a blog with raw HTML in markdown, and assert the editor page can save.

Run: `cd apps/web && npm test -- reader-admin.spec.ts marketing-pages.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit frontend blogs**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/src/lib/api.ts apps/web/src/components/AdminMarkdownEditor.tsx apps/web/src/app/reader_admin/blogs apps/web/src/app/blog apps/web/tests/reader-admin.spec.ts
git commit -m "feat: add reader admin blog pages"
```

---

### Task 9: Frontend Course Management Pages

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/app/reader_admin/courses/page.tsx`
- Create: `apps/web/src/app/reader_admin/courses/[courseId]/page.tsx`
- Modify: `apps/web/tests/reader-admin.spec.ts`

- [ ] **Step 1: Add admin course API functions**

Modify `apps/web/src/lib/api.ts`:

```ts
export async function listAdminCourses(input: { query?: string; email?: string; page?: number; pageSize?: number } = {}) {
  return apiJson<PaginatedList<AdminCourseListItem>>(
    `/admin/courses${queryString({ query: input.query, email: input.email, page: input.page ?? 1, page_size: input.pageSize ?? 20 })}`,
    { cache: "no-store" },
    "Failed to load courses"
  );
}

export async function getAdminCourse(courseId: string): Promise<AdminCourseDetail> {
  return apiJson<AdminCourseDetail>(`/admin/courses/${courseId}`, { cache: "no-store" }, "Failed to load course");
}

export async function deleteAdminCourse(courseId: string): Promise<void> {
  await apiNoContent(`/admin/courses/${courseId}`, { method: "DELETE" }, "Failed to delete course");
}

export async function bulkDeleteAdminCourses(ids: string[]) {
  return apiJson<{ updated_count: number; failed_ids: string[] }>(
    "/admin/courses/bulk-delete",
    { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ ids }) },
    "Failed to delete courses"
  );
}
```

- [ ] **Step 2: Build course list page**

Create `/reader_admin/courses/page.tsx`:

- Use `AdminShell`.
- Search by course title and user email.
- Render fields: course title, user email, created_at, resource counts, download links.
- Provide row `查看` and `删除`.
- Provide checkbox selection and batch delete.
- Do not render `content_markdown`.

- [ ] **Step 3: Build course detail page**

Create `/reader_admin/courses/[courseId]/page.tsx`:

- Use `AdminShell`.
- Load `getAdminCourse(courseId)`.
- Show base fields and resource counts.
- Show download links.
- Show `content_markdown` in a preformatted reading area.
- Provide soft delete button.

- [ ] **Step 4: Add Playwright course tests**

Append tests to `reader-admin.spec.ts` routing `/admin/courses` and `/admin/courses/course_1`, asserting:

- list shows course title and user email
- list does not show body text
- detail shows body text
- delete calls `DELETE /admin/courses/course_1`

Run: `cd apps/web && npm test -- reader-admin.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit frontend courses**

```bash
git add apps/web/src/lib/api.ts apps/web/src/app/reader_admin/courses apps/web/tests/reader-admin.spec.ts
git commit -m "feat: add reader admin course pages"
```

---

### Task 10: Frontend Announcement Pages and Dashboard Display

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/app/reader_admin/announcements/page.tsx`
- Create: `apps/web/src/app/reader_admin/announcements/new/page.tsx`
- Create: `apps/web/src/app/reader_admin/announcements/[announcementId]/page.tsx`
- Create: `apps/web/src/components/DashboardAnnouncements.tsx`
- Modify: `apps/web/src/app/[locale]/dashboard/page.tsx`
- Modify: `apps/web/tests/reader-admin.spec.ts`
- Modify: `apps/web/tests/course-flow.spec.ts`

- [ ] **Step 1: Add announcement API functions**

Modify `apps/web/src/lib/api.ts`:

```ts
export async function listAdminAnnouncements(input: {
  query?: string;
  status?: string;
  language?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedList<AdminAnnouncementListItem>> {
  return apiJson<PaginatedList<AdminAnnouncementListItem>>(
    `/admin/announcements${queryString({
      query: input.query,
      status: input.status,
      language: input.language,
      page: input.page ?? 1,
      page_size: input.pageSize ?? 20
    })}`,
    { cache: "no-store" },
    "Failed to load announcements"
  );
}

export async function getAdminAnnouncement(announcementId: string): Promise<AdminAnnouncementDetail> {
  return apiJson<AdminAnnouncementDetail>(
    `/admin/announcements/${announcementId}`,
    { cache: "no-store" },
    "Failed to load announcement"
  );
}

export async function createAdminAnnouncement(input: {
  title: string;
  language: "zh" | "en";
  body_markdown: string;
  roadmap_status: "planned" | "in_progress" | "shipped";
  display_position: "dashboard" | "announcement_page" | "global_banner";
  sort_order: number;
  is_pinned: boolean;
}): Promise<AdminAnnouncementDetail> {
  return apiJson<AdminAnnouncementDetail>(
    "/admin/announcements",
    { method: "POST", headers: jsonHeaders(), body: JSON.stringify(input) },
    "Failed to create announcement"
  );
}

export async function updateAdminAnnouncement(
  announcementId: string,
  input: Partial<AdminAnnouncementDetail>
): Promise<AdminAnnouncementDetail> {
  return apiJson<AdminAnnouncementDetail>(
    `/admin/announcements/${announcementId}`,
    { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify(input) },
    "Failed to save announcement"
  );
}

export async function publishAdminAnnouncement(announcementId: string): Promise<AdminAnnouncementDetail> {
  return apiJson<AdminAnnouncementDetail>(
    `/admin/announcements/${announcementId}/publish`,
    { method: "POST" },
    "Failed to publish announcement"
  );
}

export async function offlineAdminAnnouncement(announcementId: string): Promise<AdminAnnouncementDetail> {
  return apiJson<AdminAnnouncementDetail>(
    `/admin/announcements/${announcementId}/offline`,
    { method: "POST" },
    "Failed to offline announcement"
  );
}

export async function deleteAdminAnnouncement(announcementId: string): Promise<void> {
  await apiNoContent(`/admin/announcements/${announcementId}`, { method: "DELETE" }, "Failed to delete announcement");
}

export async function reorderAdminAnnouncements(items: Array<{ id: string; sort_order: number }>): Promise<void> {
  await apiNoContent(
    "/admin/announcements/reorder",
    { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ items }) },
    "Failed to reorder announcements"
  );
}

export async function listDashboardAnnouncements(locale: "zh" | "en"): Promise<PaginatedList<AdminAnnouncementListItem>> {
  return apiJson<PaginatedList<AdminAnnouncementListItem>>(
    `/announcements/dashboard${queryString({ lang: locale })}`,
    { cache: "no-store" },
    "Failed to load announcements",
    false
  );
}
```

`listDashboardAnnouncements(locale)` must call `/announcements/dashboard?lang=${locale}` with `auth=false`.

- [ ] **Step 2: Build announcement admin pages**

Create list/create/edit pages under `/reader_admin/announcements`.

Required UI:

- title `公告板`
- filters for status and language
- list fields from spec
- publish/offline/delete buttons
- sort_order numeric input
- pinned checkbox
- roadmap status select with `planned`, `in_progress`, `shipped`
- display position select
- Markdown editor using `AdminMarkdownEditor`

- [ ] **Step 3: Add dashboard display component**

Create `apps/web/src/components/DashboardAnnouncements.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { listDashboardAnnouncements } from "@/lib/api";
import type { AdminAnnouncementListItem } from "@/lib/types";

export function DashboardAnnouncements({ locale }: { locale: "zh" | "en" }) {
  const [items, setItems] = useState<AdminAnnouncementListItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await listDashboardAnnouncements(locale);
        if (!cancelled) {
          setItems(response.items);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mb-5 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
      <h2 className="text-base font-semibold text-[var(--pa-ink)]">公告</h2>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <article key={item.id} className="border-t border-[var(--pa-line)] pt-3 first:border-t-0 first:pt-0">
            <p className="text-sm font-medium text-[var(--pa-ink)]">{item.title}</p>
            <p className="mt-1 text-xs text-[var(--pa-muted)]">{item.roadmap_status}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

Render `<DashboardAnnouncements locale={locale} />` below `PageHeader` in dashboard.

- [ ] **Step 4: Add Playwright announcement tests**

Append tests to `reader-admin.spec.ts`:

- list announcements
- edit Markdown
- publish
- reorder

Modify dashboard route mocks in existing tests so `/announcements/dashboard?lang=zh` returns:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "page_size": 0,
    "total": 0,
    "total_pages": 1,
    "has_previous": false,
    "has_next": false
  }
}
```

Run: `cd apps/web && npm test -- reader-admin.spec.ts course-flow.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit frontend announcements**

```bash
git add apps/web/src/lib/api.ts apps/web/src/app/reader_admin/announcements apps/web/src/components/DashboardAnnouncements.tsx apps/web/src/app/[locale]/dashboard/page.tsx apps/web/tests
git commit -m "feat: add reader admin announcement pages"
```

---

### Task 11: Final Verification and Cleanup

**Files:**
- Modify only files needed to fix verification failures.

- [ ] **Step 1: Run backend tests**

Run: `make test-api`
Expected: PASS.

- [ ] **Step 2: Run frontend tests**

Run: `make test-web`
Expected: PASS.

- [ ] **Step 3: Run frontend build if route/API imports changed**

Run: `cd apps/web && npm run build`
Expected: PASS.

- [ ] **Step 4: Check worktree**

Run: `git status --short`
Expected: only intentional modified files or clean worktree.

- [ ] **Step 5: Review admin scope**

Confirm these routes exist:

```text
/reader_admin/users
/reader_admin/blogs
/reader_admin/courses
/reader_admin/announcements
```

Confirm these routes are deprecated:

```text
/zh/admin
/zh/admin/users
/en/admin
/en/admin/users
```

Confirm these modules are not added:

```text
task queue admin
resource storage admin
feedback ticket admin
TTS quota admin
operations overview admin
system configuration admin
```

- [ ] **Step 6: Commit final verification fixes**

If Step 1, 2, or 3 required fixes:

```bash
git add <changed-files>
git commit -m "fix: stabilize reader admin verification"
```

If no fixes were needed, do not create an empty commit.
