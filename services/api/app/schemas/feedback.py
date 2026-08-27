from __future__ import annotations

from pydantic import BaseModel, Field


class FeedbackSubmitRequest(BaseModel):
    category: str = Field(pattern="^(suggestion|bug|feature)$")
    summary: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=4000)
    page_path: str | None = Field(default=None, max_length=200)
