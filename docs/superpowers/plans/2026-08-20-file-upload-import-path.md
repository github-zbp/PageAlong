# File Upload Import Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first file-upload import path for PageAlong. Users can upload HTML, PDF, Word, EPUB, or TXT files; the backend extracts text into courses; failed files are skipped and reported; imported courses do not generate audio until the user clicks play.

**Architecture:** The API accepts multipart uploads, stores raw files durably, creates a batch record plus per-file items, and enqueues one worker task per file item. The worker loads the raw file, extracts normalized Markdown/TTS text with format-specific parsers, writes `file_upload` courses at `text_ready`, and leaves audio generation idle. Playback on the course list or detail page triggers the existing audio-generation endpoint lazily and auto-plays when the course becomes ready.

**Tech Stack:** FastAPI, SQLAlchemy, Celery, pydantic-settings, pypdf, python-docx, EbookLib, Next.js 13, React 18, Playwright, pytest.

---

## Scope Check

- Support HTML, PDF, DOCX, legacy DOC, EPUB, and TXT.
- Reject PPT, MOBI, and AZW3 with explicit user-facing failure reasons.
- No OCR. Scanned or image-only PDFs must fail fast with a clear message.
- Raw file size is checked before storage or queueing.
- Normalized non-whitespace character count is checked after extraction.
- File import continues after individual file failures and reports the reason per file.
- Imported courses stay `text_ready` until the user clicks play.
- Audio generation must be idempotent and continue after the user leaves the page.
- Existing URL import and text import flows stay intact.

## Known Workspace Constraints

- Preserve unrelated local edits, especially the existing tag-series changes in the working tree.
- Do not update `web_reader-src.tar.gz`.
- Use the repo's current Python `venv + pip` and frontend npm workflow.
- If manual local runs are needed, keep the API on port `8070` with command-level overrides.

## File Structure

### Backend

- Modify `services/api/app/core/config.py`: add file-import size, text, storage, batch, and DOC converter settings.
- Modify `services/api/pyproject.toml`: add runtime deps for `pypdf` and `EbookLib`.
- Create `services/api/app/models/file_import.py`: file import batch/item models and enums.
- Modify `services/api/app/models/__init__.py`: export the new file import models.
- Modify `services/api/app/services/object_storage.py`: add raw-byte download support and file-import storage construction.
- Create `services/api/app/services/file_import_extraction.py`: HTML/PDF/DOCX/DOC/EPUB/TXT extraction and PDF scan detection.
- Create `services/api/app/services/file_import_service.py`: batch creation, item processing, status recomputation, and course persistence.
- Modify `services/api/app/services/course_service.py`: make `request_audio_generation` idempotent for pending/running jobs.
- Create `services/api/app/schemas/file_import.py`: batch and item response schemas.
- Modify `services/api/app/schemas/course.py`: extend source summary fields for file metadata.
- Modify `services/api/app/api/routes/courses.py`: add file import endpoints and reuse idempotent audio generation.
- Create `services/api/app/cli/import_file.py`: CLI entry point for one file-import item.
- Modify `services/api/app/worker_client.py`: enqueue file-import tasks.
- Modify `.env.example`: document the new file-import env vars.
- Modify `services/api/tests/test_models.py`: cover file import model defaults.
- Modify `services/api/tests/test_settings.py`: cover file-import env defaults and `.env.example`.
- Modify `services/api/tests/test_object_storage.py`: cover raw-byte download behavior.
- Modify `services/api/tests/test_init_database.py`: cover the new file-import tables in metadata.
- Create `services/api/tests/test_file_import_extraction.py`: parser and PDF scan detection coverage.
- Create `services/api/tests/test_file_import_service.py`: batch/item orchestration coverage.
- Create `services/api/tests/test_file_import_api.py`: multipart upload and batch polling coverage.
- Create `services/api/tests/test_file_import_cli.py`: CLI wrapper coverage.
- Modify `services/api/tests/test_courses_api.py`: cover lazy audio-generation idempotency and file source summary.

### Worker

- Create `services/worker/app/tasks/import_file.py`: Celery task for one file import item.
- Modify `services/worker/app/celery_app.py`: register the new task.
- Modify `services/worker/tests/test_celery_app_registration.py`: assert the task is registered.
- Create `services/worker/tests/test_file_import_task.py`: task-to-CLI subprocess coverage.

### Web

- Modify `apps/web/src/lib/types.ts`: add file import batch/item/source types.
- Modify `apps/web/src/lib/api.ts`: add multipart upload and batch polling helpers.
- Modify `apps/web/src/lib/i18n.ts`: add file upload copy, failure copy, and lazy-play messages.
- Create `apps/web/src/components/ImportFileForm.tsx`: file upload form, progress, and per-file failures.
- Modify `apps/web/src/components/CourseListItem.tsx`: carry autoplay intent from playable list rows.
- Modify `apps/web/src/components/CoursePlayer.tsx`: lazy generate audio on play and auto-play when ready.
- Modify `apps/web/src/app/[locale]/courses/[courseId]/page.tsx`: pass autoplay intent into the player.
- Modify `apps/web/src/app/[locale]/import/[tab]/page.tsx`: render the file upload surface instead of the coming-soon panel.
- Modify `apps/web/tests/course-flow.spec.ts`: cover list/detail lazy-play behavior.
- Create `apps/web/tests/file-import.spec.ts`: cover file upload batch progress and failure reporting.

---

## Task 1: Storage, Settings, and Models

**Files:**
- Modify: `services/api/app/core/config.py`
- Modify: `services/api/pyproject.toml`
- Create: `services/api/app/models/file_import.py`
- Modify: `services/api/app/models/__init__.py`
- Modify: `services/api/app/services/object_storage.py`
- Modify: `.env.example`
- Modify: `services/api/tests/test_models.py`
- Modify: `services/api/tests/test_settings.py`
- Modify: `services/api/tests/test_object_storage.py`
- Modify: `services/api/tests/test_init_database.py`

- [ ] **Step 1: Write failing tests**

Add coverage like this:

```python
def test_file_import_models_default_to_pending():
    from app.models.file_import import FileImportBatch, FileImportItem, FileImportBatchStatus, FileImportItemStatus, FileImportSourceMode

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
    assert item.status == FileImportItemStatus.PENDING
```

```python
def test_file_import_settings_have_safe_defaults():
    settings = Settings()

    assert settings.file_import_max_file_bytes == 5 * 1024 * 1024
    assert settings.file_import_max_text_characters == 50_000
    assert settings.file_import_storage_backend == "local"
    assert settings.file_import_local_dir == "storage/import_uploads"
    assert settings.file_import_max_files_per_batch == 100
    assert settings.file_import_doc_converter_command == ""
```

```python
def test_local_object_storage_can_round_trip_raw_bytes(tmp_path):
    service = ObjectStorageService(
        backend="local",
        bucket="local",
        endpoint_url="",
        access_key_id="",
        secret_access_key="",
        public_base_url="",
        local_root=tmp_path / "imports",
    )
    stored = service.upload_bytes(b"raw-bytes", object_key="imports/a.txt", content_type="text/plain")

    assert service.download_bytes(stored.object_path) == b"raw-bytes"
```

```python
def test_create_application_tables_registers_file_import_tables():
    engine = create_engine("sqlite://")
    init_database.create_application_tables(engine)

    assert "file_import_batches" in inspect(engine).get_table_names()
    assert "file_import_items" in inspect(engine).get_table_names()
```

And assert the `.env.example` file contains the file-import env vars.

- [ ] **Step 2: Run the failing tests**

Run:

```bash
cd services/api && .venv/bin/python -m pytest -q \
  tests/test_models.py::test_file_import_models_default_to_pending \
  tests/test_settings.py::test_file_import_settings_have_safe_defaults \
  tests/test_object_storage.py::test_local_object_storage_can_round_trip_raw_bytes \
  tests/test_init_database.py::test_create_application_tables_registers_file_import_tables
```

Expected: fail because the new models, settings, and raw-byte read path do not exist yet.

- [ ] **Step 3: Implement storage and schema foundations**

Add the new settings and pyproject deps, create `FileImportBatch` / `FileImportItem` / enums, export them from `app.models`, and extend `ObjectStorageService` with raw-byte reads plus a file-import constructor that uses the new storage settings.

Keep the file-import storage keys durable and stable, for example:

```python
object_key = f"file-imports/{batch_id}/{item_id}/{safe_filename}"
```

Use the existing `NormalizedContent` quality metadata later for the text-count limit, so the storage layer only needs to move bytes.

- [ ] **Step 4: Run the targeted tests again**

Run the same pytest command from Step 2.

Expected: PASS.

---

## Task 2: File Extraction and Batch Worker

**Files:**
- Create: `services/api/app/services/file_import_extraction.py`
- Create: `services/api/app/services/file_import_service.py`
- Create: `services/api/app/cli/import_file.py`
- Modify: `services/api/app/worker_client.py`
- Create: `services/worker/app/tasks/import_file.py`
- Modify: `services/worker/app/celery_app.py`
- Modify: `services/worker/tests/test_celery_app_registration.py`
- Create: `services/worker/tests/test_file_import_task.py`
- Create: `services/api/tests/test_file_import_extraction.py`
- Create: `services/api/tests/test_file_import_service.py`
- Create: `services/api/tests/test_file_import_cli.py`

- [ ] **Step 1: Write failing tests**

Add tests that exercise the parser and the worker bridge:

```python
def test_extract_pdf_rejects_scanned_or_image_only_pdf():
    with pytest.raises(FileImportExtractionError) as exc_info:
        extract_pdf_file_content(pdf_bytes=b"%PDF-1.4 fake scan", filename="scan.pdf", original_name="scan.pdf")

    assert exc_info.value.code == "scanned_pdf_without_text_layer"
```

```python
def test_file_import_service_skips_failed_items_and_continues(db_session, monkeypatch):
    # one valid TXT file plus one unsupported PPT file
    assert batch.success_count == 1
    assert batch.failed_count == 1
    assert failed_item.error_code == "unsupported_file_type"
    assert course.source_type == SourceType.FILE_UPLOAD
    assert course.status == CourseStatus.TEXT_READY
```

```python
def test_import_file_job_calls_api_cli_subprocess(monkeypatch):
    captured = {}

    class FakeCompletedProcess:
        stdout = '{"item_id":"item_1","status":"succeeded"}'
        stderr = ""

    def fake_run(command, *, cwd, env, check, capture_output, text):
        captured["command"] = command
        captured["cwd"] = str(cwd)
        captured["pythonpath"] = env["PYTHONPATH"]
        captured["check"] = check
        captured["capture_output"] = capture_output
        captured["text"] = text
        return FakeCompletedProcess()

    monkeypatch.setenv("API_CLI_PYTHON", "/tmp/api-python")
    monkeypatch.setattr("app.tasks.import_file.subprocess.run", fake_run)

    result = import_file_for_course.run("course_1", "item_1")

    assert captured["command"] == ["/tmp/api-python", "-m", "app.cli.import_file", "item_1"]
    assert result == {"item_id": "item_1", "status": "succeeded"}
```

Update the Celery registration assertion to expect `import_file_for_course` alongside the existing tasks.

- [ ] **Step 2: Run the failing tests**

Run:

```bash
cd services/api && .venv/bin/python -m pytest -q \
  tests/test_file_import_extraction.py \
  tests/test_file_import_service.py \
  tests/test_file_import_cli.py

cd services/worker && .venv/bin/python -m pytest -q \
  tests/test_celery_app_registration.py \
  tests/test_file_import_task.py
```

Expected: fail because the parser module, batch service, CLI, and worker task are not implemented yet.

- [ ] **Step 3: Implement the extraction and worker pipeline**

Implement a format-dispatch extraction service with these rules:

- HTML: reuse the existing article-cleanup pipeline where possible.
- TXT: decode UTF-8 / UTF-8-SIG first, then fall back to GB18030.
- DOCX: extract paragraphs and table cell text with `python-docx`, ignore images.
- DOC: call the configured converter command in a temp directory; fail only that file if the converter is missing or fails.
- EPUB: use `EbookLib`, read spine order, and convert readable HTML to Markdown.
- PDF: use `pypdf`, count page text-layer output, and reject scanned or image-only PDFs without OCR.

Make the worker task own one file item at a time. The CLI should load the item, read the raw bytes through `ObjectStorageService`, call the parser, enforce the normalized non-whitespace character limit, create the course with `SourceType.FILE_UPLOAD`, and persist article text plus sentences with no audio job.

Use the existing `persist_article_content(...)` helper so the course lands in `text_ready` with `confirmed_by_user=True`.

- [ ] **Step 4: Run the targeted tests again**

Run the same pytest commands from Step 2.

Expected: PASS.

---

## Task 3: File Import API and Lazy Audio Generation

**Files:**
- Create: `services/api/app/schemas/file_import.py`
- Modify: `services/api/app/schemas/course.py`
- Modify: `services/api/app/api/routes/courses.py`
- Modify: `services/api/app/services/course_service.py`
- Modify: `services/api/tests/test_file_import_api.py`
- Modify: `services/api/tests/test_courses_api.py`

- [ ] **Step 1: Write failing tests**

Add coverage for the batch endpoints and the lazy-play flow:

```python
def test_import_files_returns_batch_with_per_file_failures(client):
    files = [
        ("files", ("ok.txt", b"第一句。第二句。", "text/plain")),
        ("files", ("slides.ppt", b"fake", "application/vnd.ms-powerpoint")),
    ]
    data = {
        "source_mode": "multiple_files",
        "relative_paths_json": "[\"ok.txt\", \"slides.ppt\"]",
    }

    response = client.post("/courses/import-files", files=files, data=data)

    assert response.status_code == 202
    body = response.json()
    assert body["failed_count"] == 1
    assert body["items"][1]["error_code"] == "unsupported_file_type"
```

```python
def test_request_audio_generation_is_idempotent_for_text_ready_course(client, db_session):
    course = Course(user_id="test_user", title="文件课程", source_type=SourceType.FILE_UPLOAD, status=CourseStatus.TEXT_READY)
    db_session.add(course)
    db_session.flush()
    db_session.add(ArticleText(course_id=course.id, version=1, text="第一句。"))
    db_session.commit()

    first = client.post(f"/courses/{course.id}/audio-generation")
    second = client.post(f"/courses/{course.id}/audio-generation")

    assert first.status_code == 202
    assert second.status_code == 202
    assert first.json()["id"] == second.json()["id"]
```

```python
def test_get_course_returns_file_source_summary(client, db_session):
    course = Course(user_id="test_user", title="文件课程", source_type=SourceType.FILE_UPLOAD, status=CourseStatus.TEXT_READY)
    db_session.add(course)
    db_session.flush()
    article_text = ArticleText(
        course_id=course.id,
        version=1,
        text="第一句。",
        source_metadata_json='{"source_kind":"file","relative_path":"notes/chapter-1.txt","original_filename":"chapter-1.txt","content_type":"text/plain","byte_size":12}',
    )
    db_session.add(article_text)
    db_session.commit()

    response = client.get(f"/courses/{course.id}")

    assert response.status_code == 200
    assert response.json()["source"]["source_kind"] == "file"
    assert response.json()["source"]["relative_path"] == "notes/chapter-1.txt"
```

Also cover batch polling with `GET /courses/file-import-batches/{batch_id}`.

- [ ] **Step 2: Run the failing tests**

Run:

```bash
cd services/api && .venv/bin/python -m pytest -q \
  tests/test_file_import_api.py \
  tests/test_courses_api.py::test_request_audio_generation_is_idempotent_for_text_ready_course
```

Expected: fail because the batch endpoints, source serialization, and idempotent audio-generation behavior are not wired yet.

- [ ] **Step 3: Implement the API and playback changes**

Add the multipart upload endpoint and the batch polling endpoint in `courses.py`.

Behavior to keep:

- Validate `files` is non-empty.
- Validate the `relative_paths_json` order matches the uploaded files.
- Enforce `FILE_IMPORT_MAX_FILE_BYTES` before queuing or storing the file.
- Derive the default series title from the top-level folder when `source_mode == folder` and no series is provided.
- Return `202 Accepted` even when some items fail, as long as the batch itself was created.
- Keep failed items visible with `error_code` and `error_message`.

Update `request_audio_generation(...)` so it returns an existing pending/running TTS job instead of creating duplicates. The audio-generation route should still confirm the latest unconfirmed article text and then reuse the same job.

Extend `CourseSourceRead` so file-imported courses can show file metadata in the detail page.

- [ ] **Step 4: Run the targeted tests again**

Run the same pytest command from Step 2.

Expected: PASS.

---

## Task 4: Web Upload Surface and Auto-Play UX

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/i18n.ts`
- Create: `apps/web/src/components/ImportFileForm.tsx`
- Modify: `apps/web/src/components/CourseListItem.tsx`
- Modify: `apps/web/src/components/CoursePlayer.tsx`
- Modify: `apps/web/src/app/[locale]/courses/[courseId]/page.tsx`
- Modify: `apps/web/src/app/[locale]/import/[tab]/page.tsx`
- Modify: `apps/web/tests/course-flow.spec.ts`
- Create: `apps/web/tests/file-import.spec.ts`

- [ ] **Step 1: Write failing tests**

Add Playwright coverage for both upload and playback:

```ts
test("file import shows per-file failures and keeps successes", async ({ page }) => {
  await page.goto("/zh/import/file");
  await page.setInputFiles('input[type="file"]', [
    { name: "ok.txt", mimeType: "text/plain", buffer: Buffer.from("第一句。第二句。") },
    { name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 fake") }
  ]);
  await page.getByRole("button", { name: "上传文件" }).click();

  await expect(page.getByText("scan.pdf")).toBeVisible();
  await expect(page.getByText("PDF appears to be scanned")).toBeVisible();
});
```

```ts
test("text-ready courses request audio on play and auto-play when ready", async ({ page }) => {
  await page.goto("/zh/courses/file_1?autoplay=1");
  await page.getByRole("button", { name: "播放" }).click();

  await expect(page.getByText("音频尚未生成，系统现在正在生成，完成后将自动播放。")).toBeVisible();
});
```

If you add a direct list-play route, include a test that clicks the library card and verifies it reaches the same autoplay flow.

- [ ] **Step 2: Run the failing tests**

Run:

```bash
cd apps/web && npx playwright test tests/file-import.spec.ts tests/course-flow.spec.ts
```

Expected: fail because the file upload tab is still a placeholder and the player does not yet lazy-generate audio.

- [ ] **Step 3: Implement the UI**

Add a real file upload form with:

- single, multi-file, and folder selection
- batch progress
- per-file failure rows
- a resume key in local storage so returning users can continue polling

Wire the detail page and list-row autoplay path so a click on a `text_ready` course carries an autoplay intent into the player. In the player:

- if audio already exists, play immediately
- if audio does not exist and the course is `text_ready`, request generation, show `音频尚未生成，系统现在正在生成，完成后将自动播放。`, poll until `ready`, and then call `play()`
- if playback is blocked by the browser, stop at the ready state and ask the user to click play again

Keep the existing review path for URL imports separate from the lazy-play path.

- [ ] **Step 4: Run the targeted tests again**

Run the same Playwright command from Step 2.

Expected: PASS.

---

## Final Verification and Commit

- [ ] Run the focused backend and worker tests from Tasks 1-3.
- [ ] Run `make test-api`.
- [ ] Run `cd services/worker && .venv/bin/python -m pytest -q`.
- [ ] Run `make test-web`.
- [ ] Run `cd apps/web && npm run build` if the route or API client shape changed.
- [ ] Run `git diff --check`.
- [ ] Commit the plan document itself once the content is stable:

```bash
git add docs/superpowers/plans/2026-08-20-file-upload-import-path.md
git commit -m "docs: add file upload import plan"
```
