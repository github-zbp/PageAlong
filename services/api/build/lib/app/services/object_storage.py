from __future__ import annotations

import hashlib
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings

IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"
S3_COMPATIBLE_BACKENDS = {"s3", "minio", "r2"}


@dataclass(frozen=True)
class StoredObject:
    storage_backend: str
    bucket: str | None
    object_key: str
    object_path: str
    content_type: str
    byte_size: int
    etag: str | None
    checksum_sha256: str


class ObjectStorageService:
    def __init__(
        self,
        *,
        backend: str,
        bucket: str,
        endpoint_url: str,
        access_key_id: str,
        secret_access_key: str,
        public_base_url: str,
        local_root: Path,
        client_factory: Callable[[], object] | None = None,
    ):
        self.backend = backend.strip().lower() or "local"
        self.bucket = bucket
        self.endpoint_url = endpoint_url
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self.public_base_url = public_base_url.rstrip("/")
        self.local_root = local_root
        self.client_factory = client_factory

    @classmethod
    def from_settings(cls, backend: str | None = None) -> "ObjectStorageService":
        return cls(
            backend=backend or settings.tts_storage_backend,
            bucket=settings.s3_bucket,
            endpoint_url=settings.s3_endpoint_url,
            access_key_id=settings.s3_access_key_id,
            secret_access_key=settings.s3_secret_access_key,
            public_base_url=settings.media_public_base_url,
            local_root=Path(settings.local_media_dir),
        )

    def upload_file(self, source_path: Path, *, object_key: str, content_type: str) -> StoredObject:
        data = source_path.read_bytes()
        return self.upload_bytes(data, object_key=object_key, content_type=content_type)

    def upload_bytes(self, data: bytes, *, object_key: str, content_type: str) -> StoredObject:
        checksum = hashlib.sha256(data).hexdigest()
        byte_size = len(data)
        normalized_key = object_key.lstrip("/")

        if self.backend == "local":
            destination = self.local_root / normalized_key
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
            return StoredObject(
                storage_backend="local",
                bucket=None,
                object_key=normalized_key,
                object_path=str(destination),
                content_type=content_type,
                byte_size=byte_size,
                etag=None,
                checksum_sha256=checksum,
            )

        if self.backend not in S3_COMPATIBLE_BACKENDS:
            raise ValueError(f"Unsupported object storage backend: {self.backend}")

        response = self._client().put_object(
            Bucket=self.bucket,
            Key=normalized_key,
            Body=data,
            ContentType=content_type,
            CacheControl=IMMUTABLE_CACHE_CONTROL,
        )
        return StoredObject(
            storage_backend=self.backend,
            bucket=self.bucket,
            object_key=normalized_key,
            object_path=self.public_url_for_key(normalized_key),
            content_type=content_type,
            byte_size=byte_size,
            etag=response.get("ETag") if isinstance(response, dict) else None,
            checksum_sha256=checksum,
        )

    def public_url_for_key(self, object_key: str) -> str:
        normalized_key = object_key.lstrip("/")
        if self.public_base_url:
            return f"{self.public_base_url}/{normalized_key}"
        return normalized_key

    def _client(self):
        if self.client_factory is not None:
            return self.client_factory()

        import boto3

        return boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
        )


def is_s3_compatible_backend(backend: str | None) -> bool:
    return (backend or "").strip().lower() in S3_COMPATIBLE_BACKENDS
