from __future__ import annotations

import hashlib
import hmac
import secrets
import time

from fastapi import HTTPException, Request, status

from app.core.config import settings

TIMESTAMP_HEADER = "X-Internal-Timestamp"
NONCE_HEADER = "X-Internal-Nonce"
SIGNATURE_HEADER = "X-Internal-Signature"

_memory_nonce_cache: dict[str, float] = {}


def sign_internal_request(
    *,
    method: str,
    path_with_query: str,
    body: bytes,
    secret: str,
    timestamp: str | None = None,
    nonce: str | None = None,
) -> dict[str, str]:
    request_timestamp = timestamp or str(int(time.time()))
    request_nonce = nonce or secrets.token_urlsafe(24)
    signature = compute_internal_signature(
        method=method,
        path_with_query=path_with_query,
        timestamp=request_timestamp,
        nonce=request_nonce,
        body=body,
        secret=secret,
    )
    return {
        TIMESTAMP_HEADER: request_timestamp,
        NONCE_HEADER: request_nonce,
        SIGNATURE_HEADER: signature,
    }


def compute_internal_signature(
    *,
    method: str,
    path_with_query: str,
    timestamp: str,
    nonce: str,
    body: bytes,
    secret: str,
) -> str:
    payload = build_internal_signature_payload(
        method=method,
        path_with_query=path_with_query,
        timestamp=timestamp,
        nonce=nonce,
        body=body,
    )
    digest = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def build_internal_signature_payload(
    *,
    method: str,
    path_with_query: str,
    timestamp: str,
    nonce: str,
    body: bytes,
) -> str:
    body_hash = hashlib.sha256(body).hexdigest()
    return "\n".join([method.upper(), path_with_query, timestamp, nonce, body_hash])


async def verify_internal_request_signature(request: Request) -> None:
    secret = settings.internal_api_hmac_secret
    if not secret:
        if settings.internal_api_token:
            raise _unauthorized()
        return

    timestamp = request.headers.get(TIMESTAMP_HEADER)
    nonce = request.headers.get(NONCE_HEADER)
    provided_signature = request.headers.get(SIGNATURE_HEADER)
    if not timestamp or not nonce or not provided_signature:
        raise _unauthorized()

    if not _timestamp_is_fresh(timestamp):
        raise _unauthorized()

    body = await request.body()
    expected_signature = compute_internal_signature(
        method=request.method,
        path_with_query=_path_with_query(request),
        timestamp=timestamp,
        nonce=nonce,
        body=body,
        secret=secret,
    )
    if not hmac.compare_digest(provided_signature, expected_signature):
        raise _unauthorized()
    if not _reserve_nonce(nonce, timestamp):
        raise _unauthorized()


def clear_internal_replay_cache() -> None:
    _memory_nonce_cache.clear()


def _timestamp_is_fresh(timestamp: str) -> bool:
    try:
        request_time = int(timestamp)
    except ValueError:
        return False
    ttl = max(1, settings.internal_api_signature_ttl_seconds)
    age = int(time.time()) - request_time
    return 0 <= age <= ttl


def _reserve_nonce(nonce: str, timestamp: str) -> bool:
    replay_store = settings.internal_api_replay_store.lower()
    if replay_store == "memory":
        return _reserve_memory_nonce(nonce, timestamp)
    if replay_store == "redis":
        return _reserve_redis_nonce(nonce, timestamp)
    raise _unauthorized()


def _reserve_memory_nonce(nonce: str, timestamp: str) -> bool:
    _prune_nonce_cache()
    cache_key = f"{timestamp}:{nonce}"
    if cache_key in _memory_nonce_cache:
        return False
    _memory_nonce_cache[cache_key] = time.time() + max(1, settings.internal_api_signature_ttl_seconds)
    return True


def _reserve_redis_nonce(nonce: str, timestamp: str) -> bool:
    ttl = max(1, settings.internal_api_signature_ttl_seconds)
    cache_key = f"{settings.redis_key_prefix}internal:nonce:{timestamp}:{nonce}"
    return bool(get_redis_client().set(cache_key, "1", ex=ttl, nx=True))


def get_redis_client():
    try:
        import redis
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis replay store unavailable",
        ) from exc
    return redis.Redis.from_url(settings.redis_url)


def _prune_nonce_cache() -> None:
    now = time.time()
    expired = [cache_key for cache_key, expires_at in _memory_nonce_cache.items() if expires_at < now]
    for cache_key in expired:
        _memory_nonce_cache.pop(cache_key, None)


def _path_with_query(request: Request) -> str:
    path = request.url.path
    if request.url.query:
        return f"{path}?{request.url.query}"
    return path


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal request signature")
