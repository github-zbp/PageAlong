from app.models.course import Course, CourseStatus, SourceType
from app.models.file_import import (
    FileImportBatch,
    FileImportItem,
    FileImportItemStatus,
    FileImportSourceMode,
)
from app.models.generation_job import GenerationJob, JobType
from app.services.file_import_service import FileImportService


def test_file_import_service_skips_failed_items_and_continues(db_session, tmp_path):
    source = tmp_path / "ok.txt"
    source.write_text("第一句正文。第二句正文。", encoding="utf-8")
    batch = FileImportBatch(
        user_id="user_1",
        source_mode=FileImportSourceMode.MULTIPLE_FILES,
        total_count=2,
    )
    db_session.add(batch)
    db_session.flush()
    valid_item = FileImportItem(
        batch_id=batch.id,
        user_id="user_1",
        original_filename="ok.txt",
        relative_path="ok.txt",
        file_extension="txt",
        content_type="text/plain",
        byte_size=source.stat().st_size,
        storage_backend="local",
        object_key="ok.txt",
        object_path=str(source),
    )
    failed_item = FileImportItem(
        batch_id=batch.id,
        user_id="user_1",
        status=FileImportItemStatus.FAILED,
        original_filename="slides.pptx",
        relative_path="slides.pptx",
        file_extension="pptx",
        content_type="application/vnd.ms-powerpoint",
        byte_size=6,
        storage_backend="local",
        object_key="slides.pptx",
        object_path=str(tmp_path / "slides.pptx"),
        error_code="unsupported_file_type",
        error_message="PPT import is not supported yet.",
    )
    db_session.add_all([valid_item, failed_item])
    db_session.commit()

    result = FileImportService(db_session).process_item(valid_item.id)

    db_session.expire_all()
    batch = db_session.get(FileImportBatch, batch.id)
    valid_item = db_session.get(FileImportItem, valid_item.id)
    failed_item = db_session.get(FileImportItem, failed_item.id)
    course = db_session.get(Course, valid_item.course_id)

    assert result.item_id == valid_item.id
    assert batch.success_count == 1
    assert batch.failed_count == 1
    assert failed_item.error_code == "unsupported_file_type"
    assert course.source_type == SourceType.FILE_UPLOAD
    assert course.status == CourseStatus.TEXT_READY
    assert course.word_count > 0
    assert (
        db_session.query(GenerationJob)
        .filter(GenerationJob.course_id == course.id, GenerationJob.job_type == JobType.TTS_GENERATE)
        .count()
        == 0
    )


def test_file_import_service_marks_single_item_failed_without_blocking_batch(db_session, tmp_path):
    source = tmp_path / "scan.pdf"
    source.write_bytes(b"not a useful pdf")
    batch = FileImportBatch(user_id="user_1", source_mode=FileImportSourceMode.SINGLE_FILE, total_count=1)
    db_session.add(batch)
    db_session.flush()
    item = FileImportItem(
        batch_id=batch.id,
        user_id="user_1",
        original_filename="scan.pdf",
        relative_path="scan.pdf",
        file_extension="pdf",
        content_type="application/pdf",
        byte_size=source.stat().st_size,
        storage_backend="local",
        object_key="scan.pdf",
        object_path=str(source),
    )
    db_session.add(item)
    db_session.commit()

    FileImportService(db_session).process_item(item.id)

    db_session.expire_all()
    item = db_session.get(FileImportItem, item.id)
    batch = db_session.get(FileImportBatch, batch.id)
    assert item.status == FileImportItemStatus.FAILED
    assert item.error_code is not None
    assert batch.failed_count == 1
