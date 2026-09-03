from __future__ import annotations

import math
import time
from dataclasses import dataclass

from app.core.config import settings

_memory_rate_limit_cache: dict[str, tuple[int, float]] = {}


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after_seconds: int


class RateLimitExceeded(Exception):
    def __init__(self, retry_after_seconds: int):
        super().__init__("Too many requests")
        self.retry_after_seconds = max(1, retry_after_seconds)


def clear_rate_limit_state() -> None:
    _memory_rate_limit_cache.clear()


def enforce_rate_limit(*, scope: str, subject: str, limit: int, window_seconds: int) -> None:
    result = reserve_rate_limit(scope=scope, subject=subject, limit=limit, window_seconds=window_seconds)
    if not result.allowed:
        raise RateLimitExceeded(result.retry_after_seconds)


def reserve_rate_limit(*, scope: str, subject: str, limit: int, window_seconds: int) -> RateLimitResult:
    key = f"{settings.redis_key_prefix}rate_limit:{scope}:{subject}"
    return _reserve_rate_limit_in_memory(key=key, limit=limit, window_seconds=window_seconds)


def _reserve_rate_limit_in_memory(*, key: str, limit: int, window_seconds: int) -> RateLimitResult:
    now = time.time()
    count, expires_at = _memory_rate_limit_cache.get(key, (0, now + window_seconds))
    if expires_at <= now:
        count = 0
        expires_at = now + window_seconds
    count += 1
    _memory_rate_limit_cache[key] = (count, expires_at)
    if count > limit:
        return RateLimitResult(allowed=False, retry_after_seconds=max(1, math.ceil(expires_at - now)))
    return RateLimitResult(allowed=True, retry_after_seconds=max(1, math.ceil(expires_at - now)))
