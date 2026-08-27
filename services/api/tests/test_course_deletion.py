from app.models.course import ArticleImageAsset, ArticleText, AudioAsset, Course
from app.models.file_import import FileImportBatch, FileImportItem, FileImportSourceMode


def test_delete_course_removes_it_from_list(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    created = client.post(
        "/courses",
        json={"title": "课程", "source_type": "manual_text", "text": "第一句。"},
    ).json()

    response = client.delete(f"/courses/{created['id']}")

    assert response.status_code == 204
    assert client.get("/courses").json()["items"] == []


def test_delete_course_removes_associated_storage_objects(client, db_session, monkeypatch):
    deleted: list[str] = []

    class FakeStorage:
        def delete_object(self, object_key_or_path: str) -> None:
            deleted.append(object_key_or_path)

    monkeypatch.setattr(
        "app.services.object_storage.ObjectStorageService.from_settings",
        lambda backend=None: FakeStorage(),
    )

    monkeypatch.setattr(
        "app.services.object_storage.ObjectStorageService.from_file_import_settings",
        lambda: FakeStorage(),
    )

    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )

    created = client.post(
        "/courses",
        json={"title": "课程", "source_type": "manual_text", "text": "第一句。"},
    ).json()

    course = db_session.get(Course, created["id"])
    article_text = db_session.query(ArticleText).filter(ArticleText.course_id == course.id).one()

    audio_asset = AudioAsset(
        course_id=course.id,
        article_text_id=article_text.id,
        provider="fake",
        voice_id="voice",
        format="mp3",
        object_path="https://media.pagealong.test/audio/placeholder.mp3",
        storage_backend="r2",
        bucket="pagealong-media",
        object_key=f"audio/{course.id}/placeholder.mp3",
        content_type="audio/mpeg",
        duration_seconds=10,
        character_count=4,
        is_current=True,
    )
    image_asset = ArticleImageAsset(
        course_id=course.id,
        article_text_id=article_text.id,
        source_url="https://example.com/image.webp",
        storage_backend="r2",
        bucket="pagealong-media",
        object_key=f"articles/{course.id}/images/image-hash.webp",
        object_path="https://media.pagealong.test/articles/placeholder.webp",
        content_type="image/webp",
        checksum_sha256="a" * 64,
        status="imported",
    )
    batch = FileImportBatch(
        user_id="test_user",
        source_mode=FileImportSourceMode.SINGLE_FILE,
        total_count=1,
    )
    db_session.add_all([audio_asset, image_asset, batch])
    db_session.flush()
    file_item = FileImportItem(
        batch_id=batch.id,
        user_id="test_user",
        course_id=course.id,
        original_filename="chapter-1.pdf",
        relative_path="chapter-1.pdf",
        file_extension="pdf",
        content_type="application/pdf",
        byte_size=12,
        storage_backend="r2",
        bucket="pagealong-media",
        object_key=f"file-imports/{batch.id}/{batch.id}.pdf",
        object_path=f"https://media.pagealong.test/file-imports/{batch.id}/{batch.id}.pdf",
    )
    db_session.add(file_item)
    db_session.commit()

    audio_asset.object_key = f"audio/{course.id}/{audio_asset.id}.mp3"
    image_asset.object_key = f"articles/{course.id}/images/{image_asset.checksum_sha256}.webp"
    file_item.object_key = f"file-imports/{batch.id}/{file_item.id}/chapter-1.pdf"
    db_session.commit()

    response = client.delete(f"/courses/{created['id']}")

    assert response.status_code == 204
    assert set(deleted) == {
        audio_asset.object_key,
        image_asset.object_key,
        file_item.object_key,
    }
    db_session.expire_all()
    stored_course = db_session.get(Course, created["id"])
    assert stored_course.is_deleted is True
    assert client.get("/courses").json()["items"] == []
