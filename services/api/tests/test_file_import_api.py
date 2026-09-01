from app.models.file_import import FileImportBatch, FileImportBatchStatus, FileImportItem, FileImportItemStatus, FileImportSourceMode


def test_lists_current_user_file_import_batches(client):
    response = client.get("/courses/file-import-batches")

    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["pagination"]["page"] == 1
    assert body["pagination"]["total"] == 0


def test_import_files_returns_batch_with_per_file_failures(client, db_session, monkeypatch):
    enqueued: list[str] = []
    monkeypatch.setattr("app.api.routes.courses.enqueue_file_import", lambda item_id: enqueued.append(item_id) or "task_1")

    response = client.post(
        "/courses/import-files",
        files=[
            ("files", ("ok.txt", "第一句。第二句。".encode(), "text/plain")),
            ("files", ("slides.pptx", b"fake", "application/vnd.ms-powerpoint")),
        ],
        data={
            "source_mode": "multiple_files",
            "relative_paths_json": '["ok.txt","slides.pptx"]',
        },
    )

    assert response.status_code == 202
    body = response.json()
    assert body["source_mode"] == "multiple_files"
    assert body["total_count"] == 2
    assert body["failed_count"] == 1
    assert len(body["items"]) == 2
    assert body["items"][0]["status"] == "pending"
    assert body["items"][1]["status"] == "failed"
    assert body["items"][1]["error_code"] == "unsupported_file_type"
    assert "PPT import is not supported yet" in body["items"][1]["error_message"]
    assert len(enqueued) == 1


def test_import_files_uses_folder_name_as_default_series_title(client, monkeypatch):
    monkeypatch.setattr("app.api.routes.courses.enqueue_file_import", lambda item_id: "task_1")

    response = client.post(
        "/courses/import-files",
        files=[("files", ("chapter.txt", "第一句。第二句。".encode(), "text/plain"))],
        data={
            "source_mode": "folder",
            "relative_paths_json": '["课程文件夹/chapter.txt"]',
        },
    )

    assert response.status_code == 202
    assert response.json()["series_title"] == "课程文件夹"


def test_import_files_marks_oversized_file_failed(client, monkeypatch):
    monkeypatch.setattr("app.api.routes.courses.settings.file_import_max_file_bytes", 4)

    response = client.post(
        "/courses/import-files",
        files=[("files", ("large.txt", b"12345", "text/plain"))],
        data={
            "source_mode": "single_file",
            "relative_paths_json": '["large.txt"]',
        },
    )

    assert response.status_code == 202
    item = response.json()["items"][0]
    assert item["status"] == "failed"
    assert item["error_code"] == "file_too_large"


def test_get_file_import_batch_returns_user_owned_batch(client, db_session):
    batch = FileImportBatch(
        user_id="test_user",
        source_mode=FileImportSourceMode.MULTIPLE_FILES,
        total_count=1,
        failed_count=1,
    )
    db_session.add(batch)
    db_session.flush()
    db_session.add(
        FileImportItem(
            batch_id=batch.id,
            user_id="test_user",
            status=FileImportItemStatus.FAILED,
            original_filename="book.azw3",
            relative_path="book.azw3",
            file_extension="azw3",
            content_type="application/octet-stream",
            byte_size=10,
            storage_backend="local",
            object_key="",
            object_path="",
            error_code="unsupported_file_type",
            error_message="AZW3 import is not supported yet.",
        )
    )
    db_session.commit()

    response = client.get(f"/courses/file-import-batches/{batch.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == batch.id
    assert body["items"][0]["original_filename"] == "book.azw3"
    assert body["items"][0]["error_message"] == "AZW3 import is not supported yet."


def test_retries_failed_file_import_batch(client, db_session, monkeypatch, tmp_path):
    from app.api.routes import courses

    enqueued: list[str] = []
    monkeypatch.setattr(courses, "enqueue_file_import", lambda item_id: enqueued.append(item_id) or "task_1")

    batch = FileImportBatch(
        user_id="test_user",
        source_mode=FileImportSourceMode.SINGLE_FILE,
        status=FileImportBatchStatus.FAILED,
        total_count=1,
        failed_count=1,
    )
    db_session.add(batch)
    db_session.flush()
    item = FileImportItem(
        batch_id=batch.id,
        user_id="test_user",
        status=FileImportItemStatus.FAILED,
        original_filename="book.md",
        relative_path="book.md",
        file_extension="md",
        content_type="text/markdown",
        byte_size=8,
        storage_backend="local",
        object_key="book.md",
        object_path=str(tmp_path / "book.md"),
        error_code="queue_unavailable",
        error_message="queue unavailable",
    )
    db_session.add(item)
    db_session.commit()

    response = client.post(f"/courses/file-import-batches/{batch.id}/retry")

    assert response.status_code == 202
    assert enqueued == [item.id]
    body = response.json()
    assert body["status"] in {"pending", "running"}
    assert body["failed_count"] == 0
    assert body["items"][0]["status"] == "pending"
