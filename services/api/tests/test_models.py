from app.models.course import ArticleText, Course, CourseStatus, SourceType
from app.models.file_resource import FileResource, ResourceKind, ResourceStatus, ResourceVariant
from app.models.generation_job import GenerationJob, JobTargetType, JobType


def test_course_defaults_to_importing_status():
    course = Course(user_id="user_1", title="测试课程", source_type=SourceType.MANUAL_TEXT)

    assert course.status == CourseStatus.IMPORTING
    assert course.word_count == 0
    assert course.duration_seconds == 0


def test_article_text_defaults_support_normalized_content():
    article_text = ArticleText(course_id="course_1", text="正文")

    assert article_text.content_markdown == "正文"
    assert article_text.content_hash == ""
    assert article_text.source_metadata_json == "{}"
    assert article_text.extraction_metadata_json == "{}"


def test_generation_job_supports_url_import_type():
    assert JobType.URL_IMPORT.value == "url_import"


def test_generation_job_defaults_support_generic_input_payload():
    job = GenerationJob(course_id="course_1", job_type=JobType.URL_IMPORT)

    assert job.input_json == "{}"
    assert job.target_type == JobTargetType.COURSE.value
    assert job.target_id == "course_1"


def test_file_resource_defaults_support_ready_download_metadata():
    resource = FileResource(
        user_id="user_1",
        owner_type="course",
        owner_id="course_1",
        resource_kind=ResourceKind.EXPORT,
        resource_variant=ResourceVariant.PDF,
        source_fingerprint="abc123",
    )

    assert resource.status == ResourceStatus.PENDING
    assert resource.storage_backend == "local"
    assert resource.filename == ""
    assert resource.metadata_json == "{}"


def test_article_image_asset_defaults_support_import_metadata():
    import app.models.course as course_models

    assert hasattr(course_models, "ArticleImageAsset")
    asset = course_models.ArticleImageAsset(
        course_id="course_1",
        article_text_id="article_1",
        source_url="https://example.com/image.png",
        object_path="https://media.pagealong.test/articles/course_1/images/hash.png",
        object_key="articles/course_1/images/hash.png",
        content_type="image/png",
        byte_size=10,
        checksum_sha256="a" * 64,
    )

    assert asset.storage_backend == "local"
    assert asset.bucket is None
    assert asset.alt_text == ""
    assert asset.metadata_json == "{}"
    assert asset.status == "imported"
    assert asset.error_code is None
    assert asset.error_message is None
    assert asset.resource_id is None


def test_tag_models_are_exported_and_courses_expose_tag_relationships():
    import app.models as models

    assert hasattr(models, "Tag")
    assert hasattr(models, "CourseTag")
    assert hasattr(Course, "tags")


def test_file_import_models_default_to_pending():
    from app.models.file_import import (
        FileImportBatch,
        FileImportBatchStatus,
        FileImportItem,
        FileImportItemStatus,
        FileImportSourceMode,
    )

    batch = FileImportBatch(user_id="user_1", source_mode=FileImportSourceMode.FOLDER, total_count=2)
    item = FileImportItem(
        batch_id="batch_1",
        user_id="user_1",
        original_filename="notes.txt",
        file_extension="txt",
        content_type="text/plain",
        byte_size=12,
        storage_backend="local",
        object_key="imports/batch_1/item_1.txt",
        object_path="/tmp/item_1.txt",
    )

    assert batch.status == FileImportBatchStatus.PENDING
    assert batch.success_count == 0
    assert batch.failed_count == 0
    assert item.status == FileImportItemStatus.PENDING
    assert item.course_id is None
    assert item.error_code is None
    assert item.resource_id is None
