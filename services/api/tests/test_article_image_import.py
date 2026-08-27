import importlib.util
import json
from io import BytesIO

from PIL import Image

from app.models.course import ArticleImageAsset, ArticleText, Course, CourseStatus, SourceType
from app.services.object_storage import StoredObject


def test_import_article_images_rewrites_markdown_to_uploaded_urls(db_session):
    spec = importlib.util.find_spec("app.services.article_image_import")
    assert spec is not None

    from app.services.article_image_import import DownloadedImage, import_article_images

    course, article_text = create_url_article(db_session, "![配图](/hero.png)\n\n第一句。")
    object_storage = RecordingImageStorage()
    image_bytes = make_png_bytes()

    result = import_article_images(
        db_session,
        course=course,
        article_text=article_text,
        markdown=article_text.content_markdown,
        base_url="https://example.com/articles/a",
        object_storage=object_storage,
        fetch_image=lambda url, max_bytes: DownloadedImage(
            url=url,
            content=image_bytes,
            content_type="image/png",
        ),
        max_images=20,
    )

    asset = db_session.query(ArticleImageAsset).filter(ArticleImageAsset.course_id == course.id).one()
    assert result.imported_count == 1
    assert result.failed_count == 0
    assert result.rewritten_markdown == f"![配图](https://media.pagealong.test/{asset.object_key})\n\n第一句。"
    assert article_text.content_markdown == result.rewritten_markdown
    assert asset.source_url == "https://example.com/hero.png"
    assert asset.alt_text == "配图"
    assert asset.storage_backend == "r2"
    assert asset.bucket == "pagealong-media"
    assert asset.object_key.startswith(f"articles/{course.id}/images/")
    assert asset.object_key.endswith(".webp")
    assert asset.content_type == "image/webp"
    assert asset.byte_size == len(object_storage.calls[0]["content"])
    assert len(asset.checksum_sha256) == 64
    assert asset.resource_id is not None
    assert json.loads(asset.metadata_json)["compression"]["status"] == "compressed"
    assert object_storage.calls[0]["object_key"] == asset.object_key
    assert object_storage.calls[0]["content_type"] == "image/webp"


def test_import_article_images_omits_failed_images_without_failing_article(db_session):
    spec = importlib.util.find_spec("app.services.article_image_import")
    assert spec is not None

    from app.services.article_image_import import ImageImportError, import_article_images

    course, article_text = create_url_article(db_session, "开头\n\n![坏图](https://example.com/broken.png)\n\n结尾")

    def fail_fetch(url, max_bytes):
        raise ImageImportError("download failed", code="download_failed")

    result = import_article_images(
        db_session,
        course=course,
        article_text=article_text,
        markdown=article_text.content_markdown,
        base_url="https://example.com/articles/a",
        object_storage=RecordingImageStorage(),
        fetch_image=fail_fetch,
        max_images=20,
    )

    assert result.imported_count == 0
    assert result.failed_count == 1
    assert article_text.content_markdown == "开头\n\n\n\n结尾"
    assert db_session.query(ArticleImageAsset).filter(ArticleImageAsset.course_id == course.id).count() == 0


def test_import_article_images_treats_upload_errors_as_image_failures(db_session):
    spec = importlib.util.find_spec("app.services.article_image_import")
    assert spec is not None

    from app.services.article_image_import import DownloadedImage, import_article_images

    course, article_text = create_url_article(db_session, "开头\n\n![配图](https://example.com/image.png)\n\n结尾")
    image_bytes = make_png_bytes()

    result = import_article_images(
        db_session,
        course=course,
        article_text=article_text,
        markdown=article_text.content_markdown,
        base_url="https://example.com/articles/a",
        object_storage=FailingImageStorage(),
        fetch_image=lambda url, max_bytes: DownloadedImage(
            url=url,
            content=image_bytes,
            content_type="image/png",
        ),
        max_images=20,
    )

    assert result.imported_count == 0
    assert result.failed_count == 1
    assert article_text.content_markdown == "开头\n\n\n\n结尾"
    assert db_session.query(ArticleImageAsset).filter(ArticleImageAsset.course_id == course.id).count() == 0


def test_import_article_images_uses_course_image_route_for_local_storage(db_session):
    spec = importlib.util.find_spec("app.services.article_image_import")
    assert spec is not None

    from app.services.article_image_import import DownloadedImage, import_article_images

    course, article_text = create_url_article(db_session, "![本地图](https://example.com/image.png)")
    image_bytes = make_png_bytes()

    result = import_article_images(
        db_session,
        course=course,
        article_text=article_text,
        markdown=article_text.content_markdown,
        base_url="https://example.com/articles/a",
        object_storage=LocalImageStorage(),
        fetch_image=lambda url, max_bytes: DownloadedImage(
            url=url,
            content=image_bytes,
            content_type="image/png",
        ),
        max_images=20,
    )

    asset = db_session.query(ArticleImageAsset).filter(ArticleImageAsset.course_id == course.id).one()
    assert result.rewritten_markdown == f"![本地图](/courses/{course.id}/images/{asset.id})"
    assert asset.object_path == "/tmp/pagealong-local-image.png"
    assert asset.content_type == "image/webp"
    assert asset.resource_id is not None
    assert json.loads(asset.metadata_json)["compression"]["status"] == "compressed"


def create_url_article(db_session, markdown: str):
    course = Course(
        user_id="test_user",
        title="网页标题",
        source_type=SourceType.URL_IMPORT,
        status=CourseStatus.NEEDS_REVIEW,
    )
    db_session.add(course)
    db_session.flush()
    article_text = ArticleText(
        course_id=course.id,
        version=1,
        text="第一句。",
        content_markdown=markdown,
        confirmed_by_user=False,
    )
    db_session.add(article_text)
    db_session.flush()
    return course, article_text


def make_png_bytes() -> bytes:
    raw = BytesIO()
    Image.new("RGBA", (64, 64), (255, 0, 0, 255)).save(raw, format="PNG")
    return raw.getvalue()


class RecordingImageStorage:
    def __init__(self):
        self.calls = []

    def upload_bytes(self, content: bytes, *, object_key: str, content_type: str) -> StoredObject:
        self.calls.append({"content": content, "object_key": object_key, "content_type": content_type})
        return StoredObject(
            storage_backend="r2",
            bucket="pagealong-media",
            object_key=object_key,
            object_path=f"https://media.pagealong.test/{object_key}",
            content_type=content_type,
            byte_size=len(content),
            etag='"etag-image"',
            checksum_sha256="b" * 64,
        )


class FailingImageStorage:
    def upload_bytes(self, content: bytes, *, object_key: str, content_type: str) -> StoredObject:
        raise RuntimeError("object storage unavailable")


class LocalImageStorage:
    def upload_bytes(self, content: bytes, *, object_key: str, content_type: str) -> StoredObject:
        return StoredObject(
            storage_backend="local",
            bucket=None,
            object_key=object_key,
            object_path="/tmp/pagealong-local-image.png",
            content_type=content_type,
            byte_size=len(content),
            etag=None,
            checksum_sha256="c" * 64,
        )
