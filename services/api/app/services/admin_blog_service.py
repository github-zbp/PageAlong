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
            .where(
                BlogPost.status == BlogPostStatus.PUBLISHED,
                BlogPost.language == language,
                BlogPost.deleted_at.is_(None),
            )
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
