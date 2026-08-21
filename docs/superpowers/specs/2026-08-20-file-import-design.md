# File Import Design

## Goal

Build the first complete file-upload import path for PageAlong course import. Users can upload one file, multiple files, or a folder; the backend extracts text into courses; failed files are skipped with visible reasons; imported courses do not generate audio until the user asks to play them.

## Scope

This iteration supports these file types:

- HTML: `.html`, `.htm`
- PDF: `.pdf`
- Word: `.docx`, plus legacy `.doc` only when a configured converter is available
- EPUB: `.epub`
- TXT: `.txt`

This iteration does not support PPT, MOBI, or AZW3. These formats should be rejected with explicit unsupported-format messages and should not block other files in the same upload batch.

File import does not introduce OCR, authentication changes, payment logic, or a new TTS provider. Scanned PDF and image-only PDF files are detected and reported as unsupported for this iteration.

## User Experience

The existing file-upload tab on the course import page becomes a usable upload surface. It supports:

- single file selection
- multi-file selection
- folder selection through browser directory upload
- optional series name
- upload progress at the batch level
- per-file status and failure reason
- links to successfully imported courses

When the user uploads a folder and does not choose a series, the backend creates or reuses a series named after the top-level folder and puts successful courses into that series. When the user uploads single or multiple loose files without a series, successful courses remain fragmented courses. When the user specifies a series, all successful files are added to that series.

The upload result must show failed files without hiding successful imports. Example failure rows:

- `scan.pdf`: PDF appears to be scanned or image-only. OCR is not supported yet.
- `large.epub`: File exceeds the 5 MB upload limit.
- `slides.pptx`: PPT import is not supported yet.
- `book.azw3`: AZW3 import is not supported yet.

## Lazy Audio Generation

File-imported courses are created with `source_type=file_upload` and `status=text_ready`. They have parsed text, sentence records, and readable content, but no audio generation job is created during import.

When the user clicks play from the course list or course detail page:

1. If the course is already `ready`, play the existing audio.
2. If the course is `text_ready` and has no audio, call `POST /courses/{course_id}/audio-generation`.
3. Show a message: "音频尚未生成，系统正在生成，完成后将自动播放。"
4. Poll the course detail API until `status=ready` and `current_audio_url` is present.
5. Attempt to start playback automatically.

The audio-generation request must be idempotent. If a pending or running TTS job already exists for the course, the API returns that job instead of creating another. This prevents repeated clicks from creating duplicate audio jobs.

Leaving the current page must not interrupt generation because the job is owned by Celery and the API database state, not by frontend component lifetime. If the user remains on the page, the frontend auto-plays when generation completes. If the browser blocks programmatic playback after a long async wait, the UI should show that audio is ready and ask the user to click play again.

Existing URL review behavior remains separate: URL imports that are `needs_review` still require confirmation before audio generation. The lazy-play path applies to courses that are already `text_ready`.

## Backend Model

Add a dedicated file import batch model instead of forcing multi-file state into `generation_jobs`.

`file_import_batches`

- `id`
- `user_id`
- `status`: `pending`, `running`, `succeeded`, `completed_with_failures`, `failed`
- `series_id`, nullable
- `series_title`, nullable snapshot for display
- `source_mode`: `single_file`, `multiple_files`, `folder`
- `total_count`
- `success_count`
- `failed_count`
- `created_at`, `updated_at`, `finished_at`

`file_import_items`

- `id`
- `batch_id`
- `user_id`
- `course_id`, nullable until success
- `status`: `pending`, `running`, `succeeded`, `failed`
- `original_filename`
- `relative_path`, nullable
- `file_extension`
- `content_type`
- `byte_size`
- `storage_backend`
- `bucket`, nullable
- `object_key`
- `object_path`
- `error_code`, nullable
- `error_message`, nullable
- `started_at`, `finished_at`, `created_at`, `updated_at`

The raw uploaded file must be stored durably before the API returns. Local development can use local disk. Production can use the existing S3-compatible object storage path after adding read/download support to the object-storage helper.

## Settings

Add environment-controlled settings with conservative defaults. The Python `Settings` fields are lower-case; the `.env` names are the corresponding upper-case names.

| Settings field | Environment variable | Default |
| --- | --- | --- |
| `file_import_max_file_bytes` | `FILE_IMPORT_MAX_FILE_BYTES` | `5242880` |
| `file_import_max_text_characters` | `FILE_IMPORT_MAX_TEXT_CHARACTERS` | `50000` |
| `file_import_storage_backend` | `FILE_IMPORT_STORAGE_BACKEND` | `local` |
| `file_import_local_dir` | `FILE_IMPORT_LOCAL_DIR` | `storage/import_uploads` |
| `file_import_max_files_per_batch` | `FILE_IMPORT_MAX_FILES_PER_BATCH` | `100` |
| `file_import_doc_converter_command` | `FILE_IMPORT_DOC_CONVERTER_COMMAND` | empty |

The file-size limit is checked before storing or queueing the item. The text-character limit is checked after extraction and normalization, using non-whitespace characters. These limits are separate from existing TTS quota limits.

## API

`POST /courses/import-files`

Request: `multipart/form-data`

- `files`: one or more files
- `relative_paths_json`: JSON string array matching the `files` order; empty strings are allowed for loose files
- `source_mode`: `single_file`, `multiple_files`, or `folder`
- `series_id`, optional
- `series_title`, optional

Response: `202 Accepted`

```json
{
  "id": "batch_id",
  "status": "pending",
  "source_mode": "folder",
  "total_count": 3,
  "success_count": 0,
  "failed_count": 1,
  "items": [
    {
      "id": "item_id",
      "course_id": null,
      "relative_path": "notes/a.pdf",
      "original_filename": "a.pdf",
      "status": "pending",
      "error_code": null,
      "error_message": null
    },
    {
      "id": "item_id_2",
      "course_id": null,
      "relative_path": "notes/deck.pptx",
      "original_filename": "deck.pptx",
      "status": "failed",
      "error_code": "unsupported_file_type",
      "error_message": "PPT import is not supported yet."
    }
  ]
}
```

`GET /courses/file-import-batches/{batch_id}`

Returns the current batch and item statuses. The frontend polls this endpoint after submitting an upload.

The API should reject an empty file list with `422`. A batch with only invalid files can still return `202` with all item rows failed, because the user needs the per-file failure report.

## Worker Flow

Add a Celery task named `import_file_for_course` that accepts a file import item id. The task invokes an API CLI command, matching the existing worker pattern for URL import and audio generation.

Flow for each file item:

1. Load the item and mark it `running`.
2. Read the raw file from configured storage.
3. Validate extension and byte size if not already failed by the API.
4. Extract normalized markdown and TTS text.
5. Validate non-whitespace text length is greater than zero and no more than `file_import_max_text_characters`.
6. Resolve the course title from extracted metadata, first heading, or file stem.
7. Resolve series placement using batch rules.
8. Create a `file_upload` course with `status=text_ready`.
9. Persist `ArticleText`, sentences, source metadata, and extraction metadata through the existing course content persistence helper.
10. Mark the item `succeeded` and attach `course_id`.
11. Recompute the batch counters and batch status.

If any file fails during parsing or validation, only that item is marked failed. The batch continues processing other pending items.

## Extraction Rules

All extractors return the same internal shape:

- `title`
- `content_markdown`
- `tts_text`
- `content_hash`
- `source_metadata`
- `extraction_metadata`

HTML:

- Use the existing HTML article extraction path where useful.
- If article extraction has low confidence, fall back to converting the full body to markdown.
- Strip scripts, styles, navigation-like boilerplate where possible through existing normalization.

TXT:

- Decode as `utf-8` or `utf-8-sig` first.
- Fall back to `gb18030` for common Chinese text files.
- Preserve paragraphs and normalize line endings.

DOCX:

- Use the existing `python-docx` dependency.
- Extract paragraphs.
- Extract table cell text.
- Ignore embedded images.

DOC:

- Legacy `.doc` cannot be parsed by `python-docx`.
- If `file_import_doc_converter_command` is configured and available, run it in a bounded temporary directory and parse its text output.
- If no converter is configured or conversion fails, mark only that file failed with `legacy_doc_converter_unavailable` or `legacy_doc_conversion_failed`.

PDF:

- Use a text-layer extractor such as `pypdf`.
- For each page, extract selectable text and count non-whitespace characters.
- If total extracted text is empty, mark the file failed as `scanned_pdf_without_text_layer`.
- If most pages have no text and total extracted text is below the useful threshold, mark the file failed as `scanned_pdf_low_text_layer`.
- Do not OCR image-only pages in this iteration.

This is how scanned PDFs are detected: the system checks whether the PDF contains a usable text layer. A scanned PDF usually stores each page as an image, so `page.extract_text()` returns empty or near-empty text across the document. The system treats that as a scan/image-only PDF and asks the user for another source format.

EPUB:

- Add `EbookLib`.
- Read document items in spine/order where possible.
- Convert HTML content to markdown.
- Concatenate readable sections with heading boundaries.
- Ignore cover images and embedded media.

## Course Metadata

Successful file imports set:

- `Course.source_type = file_upload`
- `Course.status = text_ready`
- `ArticleText.confirmed_by_user = true`
- `ArticleText.source_quality = extracted`

`source_metadata_json` should include:

- `source_kind = file`
- `locator = original filename or relative path`
- `canonical_locator = relative path when present`
- `source_domain = ""`
- `file_extension`
- `content_type`
- `byte_size`

`extraction_metadata_json` should include:

- `extractor`
- parser version or library name when available
- page count for PDF
- document item count for EPUB
- original character count
- normalized character count

## Frontend Changes

Add a new `ImportFileForm` component and mount it in the existing file tab.

The component owns:

- file picker for loose files
- folder picker using directory upload attributes
- selected-file summary
- optional series-name input
- submit state
- batch polling
- per-file result table

The API client adds:

- `createFileImportBatch(input): Promise<FileImportBatch>`
- `getFileImportBatch(batchId): Promise<FileImportBatch>`

The course list and detail playback path adds a playback intent:

- From list: the play/open action for `text_ready` or `ready` courses opens the detail page with playback intent.
- From detail: the player dock shows a play button even when a `text_ready` course has no audio.
- When clicked, the player requests audio generation, shows the generating message, polls course state, then attempts autoplay.

## Error Handling

Use stable error codes for backend tests and localized messages for UI display:

- `unsupported_file_type`
- `file_too_large`
- `file_empty`
- `text_too_large`
- `text_empty`
- `scanned_pdf_without_text_layer`
- `scanned_pdf_low_text_layer`
- `encrypted_pdf`
- `legacy_doc_converter_unavailable`
- `legacy_doc_conversion_failed`
- `parser_failed`
- `queue_unavailable`

The API should store the backend error message on the item. The frontend can display that message directly for the first version, with i18n mapping added for known codes.

## Testing

Backend API tests:

- create a single-file TXT batch and enqueue one item
- reject empty file lists
- mark oversized files failed using `file_import_max_file_bytes`
- skip unsupported PPT, MOBI, and AZW3 while accepting supported files in the same batch
- preserve relative paths for folder uploads
- create a series from top-level folder name when no series is provided
- attach successful parsed files to a provided series

Backend service/parser tests:

- TXT decoding and normalization
- HTML extraction fallback
- DOCX paragraph and table extraction
- DOC converter unavailable failure
- PDF text-layer success
- PDF scan/image-only failure
- EPUB document extraction
- text length limit using `file_import_max_text_characters`
- per-file failure does not fail sibling items
- batch status becomes `completed_with_failures` when at least one file fails and at least one succeeds

Worker tests:

- Celery app registers `import_file_for_course`
- worker task invokes `app.cli.import_file` with item id

Audio-generation tests:

- requesting audio for `text_ready` creates one TTS job
- repeated request while pending/running returns the existing job
- generated job continues independently of frontend polling

Frontend tests:

- file tab renders upload controls instead of coming-soon panel
- upload submits FormData with files and relative paths
- batch polling displays successful courses and failed file reasons
- clicking play on a text-ready course requests audio generation and shows the generating message
- polling transitions to ready and attempts playback

## Implementation Notes

Do not update `Makefile` defaults, `.env.example` API port defaults, or production docs for local port preferences. Follow the existing API port override instructions during local verification.

Do not describe OCR, MOBI, AZW3, PPT, real TTS changes, authentication, or payments as implemented by this feature.

The implementation plan should keep parser logic in focused files under `services/api/app/services/`, API HTTP handling under `services/api/app/api/routes/`, worker orchestration under `services/worker/app/tasks/`, and frontend API functions in `apps/web/src/lib/api.ts`.
