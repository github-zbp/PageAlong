from __future__ import annotations

from math import ceil

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.story_comment import StoryComment
from app.models.user import User
from app.schemas.pagination import PaginationRead


def list_story_comments(db: Session, *, page: int, page_size: int) -> tuple[list[StoryComment], PaginationRead]:
    total = int(db.scalar(select(func.count()).select_from(StoryComment)) or 0)
    comments = list(
        db.scalars(
            select(StoryComment)
            .options(joinedload(StoryComment.user))
            .order_by(StoryComment.created_at.desc(), StoryComment.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    total_pages = max(1, ceil(total / page_size))
    return comments, PaginationRead(
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
        has_previous=page > 1,
        has_next=page < total_pages,
    )


def create_story_comment(db: Session, *, user: User, content: str) -> StoryComment:
    normalized_content = content.strip()
    if not normalized_content:
        raise ValueError("Comment cannot be empty")
    comment = StoryComment(user_id=user.id, content=normalized_content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def mask_email(email: str) -> str:
    local_part, separator, domain = email.partition("@")
    if not separator or not local_part:
        return "Anonymous"
    visible = local_part[:1]
    return f"{visible}***@{domain}"
