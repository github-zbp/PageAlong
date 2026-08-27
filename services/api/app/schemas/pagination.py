from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginationRead(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
    has_previous: bool
    has_next: bool


class PaginatedList(BaseModel, Generic[T]):
    items: list[T]
    pagination: PaginationRead
