from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.story_comment import StoryComment
from app.models.user import User
from app.schemas.story_comment import StoryCommentCreate, StoryCommentList, StoryCommentRead
from app.services.story_comment_service import create_story_comment, list_story_comments, mask_email
from app.services.rate_limit import RateLimitExceeded, enforce_rate_limit

router = APIRouter(prefix="/story/comments", tags=["story-comments"])
COMMENT_RATE_LIMIT = 5
COMMENT_RATE_LIMIT_WINDOW_SECONDS = 60


def serialize_comment(comment: StoryComment) -> StoryCommentRead:
    return StoryCommentRead(
        id=comment.id,
        content=comment.content,
        author_email=mask_email(comment.user.email if comment.user is not None else ""),
        created_at=comment.created_at,
    )


@router.get("", response_model=StoryCommentList)
def get_story_comments(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> StoryCommentList:
    comments, pagination = list_story_comments(db, page=page, page_size=page_size)
    return StoryCommentList(
        items=[serialize_comment(comment) for comment in comments],
        pagination=pagination,
    )


@router.post("", response_model=StoryCommentRead, status_code=status.HTTP_201_CREATED)
def post_story_comment(
    payload: StoryCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StoryCommentRead:
    try:
        enforce_rate_limit(
            scope="story_comments",
            subject=current_user.id,
            limit=COMMENT_RATE_LIMIT,
            window_seconds=COMMENT_RATE_LIMIT_WINDOW_SECONDS,
        )
        comment = create_story_comment(db, user=current_user, content=payload.content)
    except RateLimitExceeded as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests",
            headers={"Retry-After": str(exc.retry_after_seconds)},
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return serialize_comment(comment)
