# File Resource and Job Unification Design

Date: 2026-08-21

## Goal

Unify all durable file resources in PageAlong around one storage table and one generic async job table.

This design covers:

- markdown / word / pdf / audio course downloads
- file-upload source storage
- R2 upload and link persistence
- first-download background generation
- repeated-download direct link reuse
- the related course library, course detail, import, and tag-management interactions

The core rule is: the API should stop streaming generated files through the app server once a resource already exists. The server should return or resolve a direct storage link instead.

## Current Context

- Course export currently generates markdown / docx / pdf synchronously and streams the bytes from the API response.
- Audio download still depends on the current audio asset path and can be proxied by the app server.
- `generation_jobs` already exists, but it is course-centric and mostly used for import and TTS workflows.
- `audio_assets`, `article_image_assets`, and `file_import_items` each carry their own storage columns, so file metadata is duplicated across tables.
- The current frontend download helper fetches blobs through the API, which forces file bytes to pass through the app server.
- The library page, import page, and tag-management page also need interaction updates in the same iteration.

## Confirmed Decisions

- Do not store generated file links as primary state on `courses`.
- Merge resource metadata and storage metadata into one table.
- Reuse `generation_jobs`, but broaden it into a generic job table.
- The first download request should enqueue a background job and show a task-state message.
- If a matching resource already exists, later requests should return its direct storage link.
- Repeated clicks while a job is pending or running should not create another job.
- The task UI should show generation progress and provide the final download link.
- `/library` gets bulk selection actions and a refined row layout.
- `/import` shows the four import methods as stacked rows, not a 2x2 grid.
- `/tags` replaces the permanent aside with a right-side drawer or modal pattern; this design uses a right drawer on desktop and a modal fallback on narrow screens.

## Scope

### In scope

- unified durable resource table
- generalized job table based on `generation_jobs`
- R2 / object-storage upload and direct-link resolution
- first-download queueing and later direct-link reuse
- download task drawer / sidebar
- course library multi-select operations
- course detail overflow menu download actions
- import page layout change
- tag management surface change

### Out of scope

- real TTS provider integration
- authentication changes
- payments
- OCR
- search/indexing changes unrelated to the download flow
- replacing the existing fake generation flow with a new media pipeline

## User Experience

### `/library`

The course list supports multi-select.

When one or more rows are selected, show bulk actions:

- delete
- unstar
- move to series

Each row overflow menu also includes `move to`.

The row layout changes:

- the playable-audio status badge moves to the left of the course title
- the overflow menu moves to the right side of the progress bar
- the progress bar and overflow menu are separated by `|`

The row actions and the bulk toolbar should resolve to the same course-move and delete behavior.

### `/courses/[courseId]`

The course detail page overflow menu adds:

- download markdown
- download word
- download pdf
- download audio

The existing download action area below the player should use the same action set as the overflow menu.

If the requested resource already exists, the action should resolve to a direct storage link.
If it does not exist, the action should create or reuse a background job and show the task-state message.

### `/import`

The four import-method blocks should render as a single vertical stack.

This page should not use a 2x2 grid on desktop.

### `/tags`

The fixed aside becomes a right-side drawer on desktop and a modal-style surface on narrow screens.

The drawer is for:

- browsing tags
- editing tag metadata
- deleting a tag

The drawer must not permanently consume layout width the way the current aside does.

### Download Task Drawer

A shell-level right drawer exposes resource-related jobs.

The drawer shows:

- course or resource name
- job type
- status
- progress
- failure reason when present
- the final download link when ready

The drawer defaults to jobs that produce or persist file resources:

- file upload persistence
- markdown / word / pdf generation
- audio generation
- file import storage jobs

User-facing copy:

- first request: `文件开始生成，请到下载任务列表查看文件生成和下载进度。`
- repeated click while running: `文件正在生成中，请到下载任务列表查看文件生成和下载进度。`

## Data Model

### Unified resource table

Use one durable resource table as the source of truth for file storage and file links.

Suggested table name: `file_resources`.

It stores:

- identity and ownership: `id`, `user_id`, optional `course_id`, optional `file_import_item_id`, optional `article_text_id`
- classification: `resource_kind` and `resource_variant`
- lifecycle: `status`, `created_at`, `updated_at`, `finished_at`
- dedupe identity: `source_fingerprint`
- storage metadata: `storage_backend`, `bucket`, `object_key`, `object_path`
- download metadata: `filename`, `content_type`, `byte_size`, `checksum_sha256`
- runtime metadata: `metadata_json`
- failure state: `error_code`, `error_message`
- job linkage: `created_by_job_id`

Recommended `status` values:

- `pending`
- `running`
- `ready`
- `failed`
- `deleted`

Recommended values:

- `resource_kind`: `upload`, `export`, `audio`
- `resource_variant`: `original`, `markdown`, `word`, `pdf`, `mp3`

Rules:

- the table is the source of truth for durable bytes and direct links
- `public_url` / `download_url` may be cached if helpful, but should be treated as a derived convenience, not the authoritative record
- a ready resource must be downloadable without proxying bytes through the API server
- a resource can be regenerated later if its source fingerprint changes, but the old row stays historical

### Generic job table

Reuse `generation_jobs`, but widen its meaning from course/TTS-specific jobs to generic async jobs.

Physical table name can remain `generation_jobs` for migration simplicity.

Suggested semantics:

- `job_type` becomes a generic job kind, not just TTS/import
- `target_type` and `target_id` identify the subject of the job
- `course_id` can remain as a nullable convenience FK for course-centric queries
- `input_json` stores generation parameters, source snapshot ids, and export options
- `result_resource_id` records the produced resource

Keep the existing runtime columns:

- `status`
- `attempt_count`
- `lease_owner`
- `lease_expires_at`
- `heartbeat_at`
- `progress_current`
- `progress_total`
- `error_code`
- `error_message`
- `started_at`
- `finished_at`

Suggested job kinds for this feature:

- `course_export_markdown`
- `course_export_word`
- `course_export_pdf`
- `course_audio_generate`
- `file_upload_persist`
- `file_import_process`

### Course pointers

`courses` should not store the file bytes or real links.

The only course-level pointer that needs to remain is the current playable audio reference, which should point at the unified resource table.

The API may continue to expose a derived `current_audio_url`, but it should come from the resource record, not a persisted URL on `courses`.

The existing `current_generation_job_id` response field may remain as a compatibility alias during migration, but its meaning becomes "current active job" rather than "TTS-only job".

### File import tables

Keep `file_import_batches` and `file_import_items` as workflow tables.

Storage metadata moves out of `file_import_items` and into `file_resources`.

The import item should keep operational state such as:

- batch membership
- filename
- relative path
- status
- error info
- timestamps

The import item should point at the unified resource row for the uploaded file.

## Resolution and Deduplication

Every resource-producing action computes a deterministic fingerprint from:

- source snapshot
- resource kind
- resource variant
- relevant generation parameters

Examples:

- markdown / word / pdf exports hash the current course content snapshot plus the export format
- audio hashes the current course text snapshot plus voice / speed / provider parameters
- file uploads hash the uploaded bytes plus normalization metadata

That fingerprint is the lookup key.

Lookup order:

1. find a ready resource with the same fingerprint
2. if found, return its direct download link
3. otherwise find a pending or running job with the same idempotency key
4. if found, return that job and show the in-progress message
5. otherwise create the resource placeholder and enqueue a new job

This is the main mechanism that prevents the second download from regenerating the same file.

## API Shape

The exact route names can stay close to the current course routes, but the behavior changes from streaming bytes to resolving or queuing a resource.

Suggested behavior:

- request a resource: return either `ready` with a direct link, or `pending` with a job id
- list jobs for the drawer: return recent resource-related jobs
- fetch one job: return live status and progress

Example response when ready:

```json
{
  "status": "ready",
  "resource_id": "res_123",
  "download_url": "https://r2.example.com/...",
  "filename": "course-notes.pdf",
  "content_type": "application/pdf"
}
```

Example response when queued:

```json
{
  "status": "pending",
  "job_id": "job_123",
  "resource_id": "res_123",
  "message": "文件开始生成，请到下载任务列表查看文件生成和下载进度。"
}
```

## Runtime Flows

### First download

1. User clicks a download action for markdown / word / pdf / audio.
2. API computes the source fingerprint.
3. API checks for a ready resource.
4. If none exists, API creates or reuses a job and a pending resource row.
5. The worker generates the file, uploads it to object storage, and updates the resource row.
6. The task drawer shows progress and then a final download link.

### Repeated download while running

1. User clicks the same action again.
2. API finds the active job by idempotency key.
3. API returns the existing job state, not a new job.
4. UI shows the in-progress message and points the user to the task drawer.

### Repeated download after ready

1. User clicks again after the resource is ready.
2. API resolves the existing resource row.
3. UI opens the direct storage link.
4. No file bytes flow through the app server.

### File upload

1. Upload writes the raw bytes to object storage and records the storage metadata in the unified resource table.
2. File import workflow rows point at that resource.
3. Later course generation can reuse the same storage record instead of creating another ad hoc storage row.

## Migration

Backfill the unified resource table from the current file-bearing tables:

- audio assets
- article image assets
- file import item storage records
- any generated export artifacts introduced by the new flow

Migration rules:

- preserve the existing business ids where possible
- keep legacy tables readable during rollout
- switch API reads to the unified table before removing legacy storage columns
- update the course pointer fields to point at resources instead of asset-specific tables

## Testing

Add tests for:

- resource lookup by fingerprint
- first download returns a queued job
- second download reuses the existing ready resource
- repeated click while running does not create another job
- direct-link resolution does not stream bytes through the API
- file import persists storage metadata through the unified table
- library bulk actions and row menu move-to behavior
- import page layout and tag drawer behavior

## Acceptance Criteria

- A user can request markdown / word / pdf / audio from course detail.
- The first request queues a job and shows a task-state message.
- The second request for the same snapshot returns the existing direct link.
- The API no longer needs to stream generated file bytes for ready resources.
- File uploads and generated artifacts share the same storage metadata model.
- The job table is generic enough to cover future file-related async work.
- The library, import, and tag-management interaction changes are visible in the UI.
