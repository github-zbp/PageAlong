from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.pagination import PaginatedList


class StoryCommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=300)


class StoryCommentRead(BaseModel):
    id: str
    content: str
    author_email: str
    created_at: datetime


class StoryCommentList(PaginatedList[StoryCommentRead]):
    pass
