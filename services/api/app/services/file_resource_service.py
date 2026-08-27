from __future__ import annotations

import atexit
import hashlib
import json
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.file_resource import FileResource, ResourceKind, ResourceStatus, ResourceVariant
from app.services.object_storage import ObjectStorageService, StoredObject, is_s3_compatible_backend

SAFE_FILENAME_PATTERN = re.compile(r"[^\w\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff.-]+", re.UNICODE)


@dataclass(frozen=True)
class ResourceUploadResult:
    resource: FileResource
    stored_object: StoredObject

    @property
    def storage_backend(self) -> str:
        return self.stored_object.storage_backend

    @property
    def bucket(self) -> str | None:
        return self.stored_object.bucket

    @property
    def object_key(self) -> str:
        return self.stored_object.object_key

    @property
    def object_path(self) -> str:
        return self.stored_object.object_path

    @property
    def content_type(self) -> str:
        return self.stored_object.content_type

    @property
    def byte_size(self) -> int:
        return self.stored_object.byte_size

    @property
    def etag(self) -> str | None:
        return self.stored_object.etag

    @property
    def checksum_sha256(self) -> str:
        return self.stored_object.checksum_sha256


class FileResourceService:
    def __init__(self, db: Session, object_storage: ObjectStorageService | None = None):
        self.db = db
        self.object_storage = object_storage or ObjectStorageService.from_settings()

    def build_fingerprint(self, *parts: Any) -> str:
        payload = json.dumps(parts, ensure_ascii=False, sort_keys=True, default=str)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def get_resource(self, resource_id: str) -> FileResource | None:
        return self.db.get(FileResource, resource_id)

    def get_resource_by_fingerprint(self, fingerprint: str) -> FileResource | None:
        return self.db.scalar(
            select(FileResource)
            .where(FileResource.source_fingerprint == fingerprint)
            .order_by(FileResource.created_at.desc(), FileResource.id.desc())
        )

    def get_owner_resource(
        self,
        *,
        owner_type: str,
        owner_id: str,
        resource_kind: ResourceKind | None = None,
        resource_variant: ResourceVariant | None = None,
        status: ResourceStatus | None = None,
    ) -> FileResource | None:
        query = select(FileResource).where(
            FileResource.owner_type == owner_type,
            FileResource.owner_id == owner_id,
        )
        if resource_kind is not None:
            query = query.where(FileResource.resource_kind == resource_kind)
        if resource_variant is not None:
            query = query.where(FileResource.resource_variant == resource_variant)
        if status is not None:
            query = query.where(FileResource.status == status)
        return self.db.scalar(query.order_by(FileResource.created_at.desc(), FileResource.id.desc()))

    def create_pending_resource(
        self,
        *,
        user_id: str,
        owner_type: str,
        owner_id: str,
        resource_kind: ResourceKind,
        resource_variant: ResourceVariant,
        title: str = "",
        filename: str = "",
        source_fingerprint: str | None = None,
        metadata_json: str = "{}",
    ) -> FileResource:
        resource = FileResource(
            user_id=user_id,
            owner_type=owner_type,
            owner_id=owner_id,
            resource_kind=resource_kind,
            resource_variant=resource_variant,
            title=title[:512],
            filename=filename[:512],
            source_fingerprint=source_fingerprint,
            metadata_json=metadata_json,
        )
        self.db.add(resource)
        self.db.flush()
        return resource

    def store_bytes(
        self,
        resource: FileResource,
        data: bytes,
        *,
        content_type: str,
        object_key: str | None = None,
        storage_backend: str | None = None,
    ) -> ResourceUploadResult:
        stored = self._upload_bytes(
            data,
            owner_type=resource.owner_type,
            owner_id=resource.owner_id,
            resource_kind=resource.resource_kind,
            resource_variant=resource.resource_variant,
            resource_id=resource.id,
            filename=resource.filename or resource.title or resource.id,
            content_type=content_type,
            object_key=object_key,
            storage_backend=storage_backend,
        )
        resource.storage_backend = stored.storage_backend
        resource.bucket = stored.bucket
        resource.object_key = stored.object_key
        resource.object_path = stored.object_path
        resource.content_type = stored.content_type
        resource.byte_size = stored.byte_size
        resource.etag = stored.etag
        resource.checksum_sha256 = stored.checksum_sha256
        resource.status = ResourceStatus.READY
        self.db.flush()
        return ResourceUploadResult(resource=resource, stored_object=stored)

    def create_resource_from_bytes(
        self,
        *,
        user_id: str,
        owner_type: str,
        owner_id: str,
        resource_kind: ResourceKind,
        resource_variant: ResourceVariant,
        data: bytes,
        content_type: str,
        title: str = "",
        filename: str = "",
        source_fingerprint: str | None = None,
        metadata_json: str = "{}",
        object_key: str | None = None,
        storage_backend: str | None = None,
    ) -> FileResource:
        resource = self.create_pending_resource(
            user_id=user_id,
            owner_type=owner_type,
            owner_id=owner_id,
            resource_kind=resource_kind,
            resource_variant=resource_variant,
            title=title,
            filename=filename,
            source_fingerprint=source_fingerprint,
            metadata_json=metadata_json,
        )
        self.store_bytes(
            resource,
            data,
            content_type=content_type,
            object_key=object_key,
            storage_backend=storage_backend,
        )
        self.db.commit()
        self.db.refresh(resource)
        return resource

    def register_existing_resource(
        self,
        *,
        user_id: str,
        owner_type: str,
        owner_id: str,
        resource_kind: ResourceKind,
        resource_variant: ResourceVariant,
        storage_backend: str,
        bucket: str | None,
        object_key: str | None,
        object_path: str,
        content_type: str,
        byte_size: int,
        title: str = "",
        filename: str = "",
        source_fingerprint: str | None = None,
        metadata_json: str = "{}",
        etag: str | None = None,
        checksum_sha256: str | None = None,
    ) -> FileResource:
        resource = FileResource(
            user_id=user_id,
            owner_type=owner_type,
            owner_id=owner_id,
            resource_kind=resource_kind,
            resource_variant=resource_variant,
            status=ResourceStatus.READY,
            source_fingerprint=source_fingerprint,
            title=title,
            filename=filename,
            storage_backend=storage_backend,
            bucket=bucket,
            object_key=object_key,
            object_path=object_path,
            content_type=content_type,
            byte_size=byte_size,
            etag=etag,
            checksum_sha256=checksum_sha256,
            metadata_json=metadata_json,
        )
        self.db.add(resource)
        self.db.flush()
        return resource

    def update_resource_failure(self, resource: FileResource, message: str | None = None) -> FileResource:
        resource.status = ResourceStatus.FAILED
        if message:
            metadata = self._load_metadata(resource.metadata_json)
            metadata["error_message"] = message
            resource.metadata_json = json.dumps(metadata, ensure_ascii=False)
        self.db.flush()
        return resource

    def resource_download_url(
        self,
        resource: FileResource,
        *,
        fallback_path: str | None = None,
    ) -> str:
        if resource.object_path and resource.object_path.lower().startswith(("http://", "https://")):
            return resource.object_path
        if fallback_path:
            return fallback_path
        return resource.object_path or ""

    def resource_storage_path(self, resource: FileResource) -> str:
        return resource.object_path

    def resource_is_public(self, resource: FileResource) -> bool:
        return bool(resource.object_path and resource.object_path.lower().startswith(("http://", "https://")))

    def resource_object_locator(self, resource: FileResource) -> str:
        if resource.storage_backend == "local":
            return resource.object_path
        return resource.object_key or resource.object_path

    def delete_resource(self, resource: FileResource) -> int:
        locator = self.resource_object_locator(resource)
        if not locator:
            resource.status = ResourceStatus.DELETED
            self.db.flush()
            return 0
        deleted = self._delete_object(resource.storage_backend, locator)
        resource.status = ResourceStatus.DELETED
        self.db.flush()
        return deleted

    def _upload_bytes(
        self,
        data: bytes,
        *,
        owner_type: str,
        owner_id: str,
        resource_kind: ResourceKind,
        resource_variant: ResourceVariant,
        resource_id: str,
        filename: str,
        content_type: str,
        object_key: str | None = None,
        storage_backend: str | None = None,
    ) -> StoredObject:
        storage = ObjectStorageService.from_settings(storage_backend) if storage_backend else self.object_storage
        normalized_filename = self._safe_filename(filename)
        normalized_key = object_key or (
            f"resources/{owner_type}/{owner_id}/{resource_kind.value}/{resource_variant.value}/{resource_id}/{normalized_filename}"
        )
        if hasattr(storage, "upload_bytes"):
            return storage.upload_bytes(data, object_key=normalized_key, content_type=content_type)
        if hasattr(storage, "upload_file"):
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                temp_file.write(data)
                temp_path = Path(temp_file.name)
            atexit.register(temp_path.unlink, missing_ok=True)
            return storage.upload_file(temp_path, object_key=normalized_key, content_type=content_type)
        raise AttributeError("Object storage service must provide upload_bytes or upload_file")

    def _delete_object(self, storage_backend: str, object_locator: str) -> int:
        backend = storage_backend.strip().lower()
        if backend == "local":
            path = Path(object_locator)
            if path.exists():
                path.unlink(missing_ok=True)
                return 1
            return 0
        if is_s3_compatible_backend(backend):
            storage = ObjectStorageService.from_settings(backend)
            storage.delete_object(object_locator)
            return 1
        return 0

    def _safe_filename(self, value: str) -> str:
        normalized = SAFE_FILENAME_PATTERN.sub("_", (value or "resource").strip())
        normalized = normalized.strip("._")
        return (normalized or "resource")[:80]

    def _load_metadata(self, value: str | None) -> dict[str, Any]:
        if not value:
            return {}
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
