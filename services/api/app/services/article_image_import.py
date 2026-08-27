from __future__ import annotations

import json
import re
from dataclasses import dataclass
from urllib.parse import urljoin

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.course import ArticleImageAsset, ArticleText, Course
from app.models.file_resource import ResourceKind, ResourceVariant
from app.services.file_resource_service import FileResourceService
from app.services.object_storage import ObjectStorageService
from app.services.media_compression import MediaCompressionService
from app.services.url_safety import UnsafeUrlError, validate_public_http_url
from app.services.web_fetcher import WebFetchError, fetch_resolved_url

IMAGE_MARKDOWN_PATTERN = re.compile(r"!\[([^\]]*)\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}


class ImageImportError(RuntimeError):
    def __init__(self, message: str, code: str = "image_import_failed"):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class DownloadedImage:
    url: str
    content: bytes
    content_type: str


@dataclass(frozen=True)
class ArticleImageImportResult:
    rewritten_markdown: str
    imported_count: int
    failed_count: int
    skipped_count: int


def import_article_images(
    db: Session,
    *,
    course: Course,
    article_text: ArticleText,
    markdown: str,
    base_url: str,
    object_storage: ObjectStorageService | None = None,
    fetch_image=None,
    max_images: int | None = None,
    media_compression: MediaCompressionService | None = None,
) -> ArticleImageImportResult:
    storage = object_storage or ObjectStorageService.from_settings(article_image_storage_backend())
    resource_service = FileResourceService(db, object_storage=storage)
    image_fetcher = fetch_image or download_image
    compressor = media_compression or MediaCompressionService.from_settings()
    limit = settings.url_import_image_max_count if max_images is None else max_images
    attempted_count = 0
    imported_count = 0
    failed_count = 0
    skipped_count = 0

    def replace_image(match: re.Match[str]) -> str:
        nonlocal attempted_count, imported_count, failed_count, skipped_count
        alt_text = match.group(1).strip()
        raw_url = match.group(2).strip()
        if attempted_count >= limit:
            skipped_count += 1
            return ""
        attempted_count += 1

        resolved_url = urljoin(base_url, raw_url)
        try:
            image = image_fetcher(resolved_url, settings.url_import_image_max_bytes)
            compressed = compressor.compress_image(image.content, image.content_type)
            resource = resource_service.create_pending_resource(
                user_id=course.user_id,
                owner_type="article_image_asset",
                owner_id=course.id,
                resource_kind=ResourceKind.IMAGE,
                resource_variant=ResourceVariant.IMAGE,
                title=alt_text or course.title,
                filename=f"{compressed.checksum_sha256}.{compressed.format}",
                source_fingerprint=resource_service.build_fingerprint(
                    "article-image",
                    course.id,
                    article_text.id,
                    image.url,
                    resolved_url,
                    compressed.checksum_sha256,
                ),
                metadata_json=json.dumps(compressed.metadata, ensure_ascii=False),
            )
            stored = resource_service.store_bytes(
                resource,
                compressed.data,
                object_key=f"articles/{course.id}/images/{compressed.checksum_sha256}.{compressed.format}",
                content_type=compressed.content_type,
            )
        except ImageImportError:
            failed_count += 1
            return ""
        except Exception:
            failed_count += 1
            return ""

        stored_object = stored.stored_object
        asset = ArticleImageAsset(
            course_id=course.id,
            article_text_id=article_text.id,
            source_url=image.url,
            alt_text=alt_text,
            storage_backend=stored_object.storage_backend,
            bucket=stored_object.bucket,
            object_key=stored_object.object_key,
            object_path=stored_object.object_path,
            content_type=stored_object.content_type,
            byte_size=stored_object.byte_size,
            checksum_sha256=stored_object.checksum_sha256,
            metadata_json=json.dumps(compressed.metadata, ensure_ascii=False),
            status="imported",
            resource_id=resource.id,
        )
        db.add(asset)
        db.flush()
        imported_count += 1
        render_url = (
            stored_object.object_path
            if is_absolute_http_url(stored_object.object_path)
            else f"/courses/{course.id}/images/{asset.id}"
        )
        return f"![{alt_text}]({render_url})"

    rewritten = IMAGE_MARKDOWN_PATTERN.sub(replace_image, markdown)
    article_text.content_markdown = rewritten
    db.flush()
    return ArticleImageImportResult(
        rewritten_markdown=rewritten,
        imported_count=imported_count,
        failed_count=failed_count,
        skipped_count=skipped_count,
    )


def article_image_storage_backend() -> str:
    return settings.url_import_image_storage_backend or settings.tts_storage_backend


def download_image(url: str, max_bytes: int) -> DownloadedImage:
    try:
        current_url = validate_public_http_url(url)
        response = None
        for _ in range(6):
            response = fetch_resolved_url(current_url, timeout_seconds=10.0, max_bytes=max_bytes)
            if response.status_code not in {301, 302, 303, 307, 308}:
                break
            location = response.headers.get("location")
            if not location:
                break
            current_url = validate_public_http_url(urljoin(current_url.url, location))
        if response is None:
            raise ImageImportError("Image download failed", code="image_download_failed")
        if response.status_code >= 400:
            raise ImageImportError(f"Image returned HTTP {response.status_code}", code=f"image_http_{response.status_code}")
    except UnsafeUrlError as exc:
        raise ImageImportError(str(exc), code=exc.code) from exc
    except WebFetchError as exc:
        raise ImageImportError(str(exc), code=exc.code) from exc

    content_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise ImageImportError("Image content type is not supported", code="unsupported_image_type")
    return DownloadedImage(url=str(response.url), content=response.content, content_type=content_type)


def is_absolute_http_url(value: str) -> bool:
    return value.lower().startswith(("http://", "https://"))
