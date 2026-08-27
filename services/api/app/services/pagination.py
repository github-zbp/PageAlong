from __future__ import annotations

from collections.abc import Sequence
from math import ceil
from typing import TypeVar

from app.schemas.pagination import PaginationRead

T = TypeVar("T")


def paginate_sequence(items: Sequence[T], page: int, page_size: int) -> tuple[list[T], PaginationRead]:
    total = len(items)
    total_pages = max(1, ceil(total / page_size))
    start = (page - 1) * page_size
    end = start + page_size
    return list(items[start:end]), PaginationRead(
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
        has_previous=page > 1,
        has_next=page < total_pages,
    )
