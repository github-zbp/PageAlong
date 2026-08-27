# File Resource and Job Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify durable file resources and async job handling around a single resource table plus a generic `generation_jobs` table, then surface the new download and task UX across the library, course detail, import, and tags pages.

**Architecture:** `file_resources` becomes the source of truth for any durable file byte stream and its direct URL. `generation_jobs` stops being TTS-only and becomes a generic async job ledger with a typed target reference and a produced-resource pointer. The API returns either a ready direct link or a pending job, the worker writes the artifact into object storage, and the web app uses that contract to show a task drawer instead of proxying bytes through the app server.

**Tech Stack:** FastAPI, SQLAlchemy, Celery, pydantic, Next.js 13, React 18, TypeScript, Playwright, pytest.

---

## Scope Check

- Keep the current course/library/tag/series domain model.
- Make file downloads, audio assets, file uploads, and image assets all point at the same durable resource storage row.
- Reuse `generation_jobs`, but widen the enum and add generic target/result fields.
- Keep the current local dev stack and existing fake TTS behavior.
- Do not add authentication, billing, OCR, or real TTS.

## Known Workspace Constraints

- Preserve unrelated local edits in `services/api/app/api/routes/courses.py`, `services/api/app/services/course_export_service.py`, `services/api/tests/test_course_exports.py`, and `services/api/tests/test_course_library_api.py`.
- Do not touch generated archives.
- Keep the API on port `8070` when you run it locally.

## File Structure

### Backend foundation

- Create `services/api/app/models/file_resource.py`: unified resource table and enums.
- Modify `services/api/app/models/course.py`: add `current_audio_resource_id` and resource references on image/audio assets.
- Modify `services/api/app/models/file_import.py`: add `resource_id` to file import items.
- Modify `services/api/app/models/generation_job.py`: generic target/result fields and broader job kinds.
- Modify `services/api/app/models/__init__.py`: export the new model.
- Modify `scripts/init_database.py`: create and upgrade the new columns and tables.
- Modify `services/api/tests/test_models.py`: model defaults and enum coverage.
- Modify `services/api/tests/test_init_database.py`: table/column backfill coverage.

### Backend resource/job flow

- Create `services/api/app/services/file_resource_service.py`: fingerprints, lookup, resource creation, direct URL resolution.
- Create `services/api/app/services/job_service.py`: generic job lookup, serialization, and dispatch helpers.
- Create `services/api/app/schemas/job.py`: job read/list responses for the drawer and jobs page.
- Create `services/api/app/api/routes/jobs.py`: global job list/detail endpoints.
- Modify `services/api/app/api/routes/courses.py`: download-request endpoints, current audio URL derivation, and compatibility redirects.
- Modify `services/api/app/api/routes/internal.py`: generic job runner dispatch.
- Modify `services/api/app/main.py`: register the new jobs router.
- Modify `services/api/app/worker_client.py`: enqueue the new generic job task.
- Create `services/api/app/cli/run_job.py`: CLI entry point for the generic job runner.
- Create `services/worker/app/tasks/run_job.py`: Celery task wrapper for the generic job runner.
- Modify `services/worker/app/celery_app.py`: register the new task.
- Modify `services/worker/tests/test_celery_app_registration.py`: assert the new task is loaded.
- Create `services/worker/tests/test_run_job_task.py`: task-to-CLI subprocess coverage.
- Create `services/api/tests/test_jobs_api.py`: job list/detail coverage.

### Existing resource producers

- Modify `services/api/app/services/audio_generation_service.py`: write audio resources and point courses at them.
- Modify `services/api/app/services/file_import_service.py`: write uploaded files into the unified resource table and link the import item.
- Modify `services/api/app/services/article_image_import.py`: write imported images into the unified resource table and link the image asset.
- Modify `services/api/app/services/course_service.py`: delete linked resources and derive current audio URLs from resources.
- Modify `services/api/tests/test_audio_generation_service.py`: audio resource linkage and direct URL coverage.
- Modify `services/api/tests/test_file_import_service.py`: file resource linkage coverage.
- Modify `services/api/tests/test_article_image_import.py`: image resource linkage coverage.
- Modify `services/api/tests/test_courses_api.py`: current audio URL and resource-driven download behavior.
- Modify `services/api/tests/test_course_exports.py`: download-request queueing and ready-link behavior.

### Web app

- Modify `apps/web/src/lib/types.ts`: add job and download result types.
- Modify `apps/web/src/lib/api.ts`: add request/download/job APIs and stop blob-fetching downloads.
- Modify `apps/web/src/lib/i18n.ts`: add download-task and queued-download copy.
- Create `apps/web/src/components/CourseActionMenu.tsx`: shared overflow menu for detail and library rows.
- Create `apps/web/src/components/CourseBulkActionBar.tsx`: selected-course toolbar.
- Create `apps/web/src/components/CourseMoveSeriesPanel.tsx`: move-to-series picker.
- Create `apps/web/src/components/ResourceJobDrawer.tsx`: shell-level jobs drawer.
- Create `apps/web/src/components/ResourceJobList.tsx`: drawer/page list view.
- Modify `apps/web/src/components/ConsoleShell.tsx`: add a drawer trigger and mount the jobs drawer.
- Modify `apps/web/src/components/CourseDownloadActions.tsx`: use the new request/ready contract.
- Modify `apps/web/src/components/CourseListItem.tsx`: selectable rows, shared menu, and row layout changes.
- Modify `apps/web/src/components/CourseCard.tsx`: forward selection/action props.
- Modify `apps/web/src/app/[locale]/courses/[courseId]/page.tsx`: add downloads to the overflow menu and keep the compact action strip in sync.
- Modify `apps/web/src/app/[locale]/library/page.tsx`: multi-select toolbar and move-to behavior.
- Modify `apps/web/src/app/[locale]/jobs/page.tsx`: real jobs page using the shared list.
- Modify `apps/web/src/app/[locale]/import/page.tsx`: vertical import-choice stack.
- Modify `apps/web/src/components/TagManagementPage.tsx`: inline aside becomes a drawer/modal.
- Modify `apps/web/tests/course-flow.spec.ts`: download actions, library actions, and course-detail menu coverage.
- Modify `apps/web/tests/file-import.spec.ts`: import-home layout coverage.
- Modify `apps/web/tests/tag-series-management.spec.ts`: tag drawer coverage.

---

## Task 1: Unified Resource and Job Schema

**Files:**
- Create: `services/api/app/models/file_resource.py`
- Modify: `services/api/app/models/course.py`
- Modify: `services/api/app/models/file_import.py`
- Modify: `services/api/app/models/generation_job.py`
- Modify: `services/api/app/models/__init__.py`
- Modify: `scripts/init_database.py`
- Modify: `services/api/tests/test_models.py`
- Modify: `services/api/tests/test_init_database.py`

- [ ] **Step 1: Write the failing tests**

Add coverage that proves the new model shape exists before implementation:

```python
def test_file_resource_defaults_are_stable():
    resource = FileResource(
        user_id="user_1",
        resource_kind=ResourceKind.EXPORT,
        resource_variant=ResourceVariant.PDF,
        source_fingerprint="abc123",
    )
    assert resource.status == ResourceStatus.PENDING
    assert resource.storage_backend == "local"
    assert resource.filename == ""

def test_generation_job_supports_generic_targets():
    job = GenerationJob(
        target_type="course",
        target_id="course_1",
        job_type=JobType.COURSE_EXPORT_PDF,
    )
    assert job.status == JobStatus.PENDING
    assert job.result_resource_id is None
```

Also add an init-database assertion that `file_resources` is created and that legacy tables receive the new reference columns:

```python
assert "file_resources" in inspect(engine).get_table_names()
assert "resource_id" in inspect(engine).get_columns("file_import_items")
assert "current_audio_resource_id" in inspect(engine).get_columns("courses")
```

- [ ] **Step 2: Run the targeted tests and confirm they fail**

Run:

```bash
pytest services/api/tests/test_models.py services/api/tests/test_init_database.py -q
```

Expected: fail because the new model and columns do not exist yet.

- [ ] **Step 3: Add the model and schema layer**

Implement:

- `FileResource` as the single durable resource row for upload/export/audio/image bytes
- `ResourceKind`, `ResourceVariant`, and `ResourceStatus` enums
- `Course.current_audio_resource_id`
- `FileImportItem.resource_id`
- `AudioAsset.resource_id`
- `ArticleImageAsset.resource_id`
- `GenerationJob.target_type`, `GenerationJob.target_id`, and `GenerationJob.result_resource_id`
- the wider `JobType` enum values for export/resource jobs
- `scripts/init_database.py` backfill logic for new columns and tables

Keep the old storage columns for now so the migration can be staged, but make the new resource id the authoritative pointer for new code.

- [ ] **Step 4: Run the targeted tests again**

Run:

```bash
pytest services/api/tests/test_models.py services/api/tests/test_init_database.py -q
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add services/api/app/models/file_resource.py services/api/app/models/course.py services/api/app/models/file_import.py services/api/app/models/generation_job.py services/api/app/models/__init__.py scripts/init_database.py services/api/tests/test_models.py services/api/tests/test_init_database.py
git commit -m "feat: add unified resource and job schema"
```

## Task 2: Resource Request and Generic Job API

**Files:**
- Create: `services/api/app/services/file_resource_service.py`
- Create: `services/api/app/services/job_service.py`
- Create: `services/api/app/schemas/job.py`
- Create: `services/api/app/api/routes/jobs.py`
- Modify: `services/api/app/api/routes/courses.py`
- Modify: `services/api/app/api/routes/internal.py`
- Modify: `services/api/app/main.py`
- Modify: `services/api/app/worker_client.py`
- Create: `services/api/app/cli/run_job.py`
- Create: `services/worker/app/tasks/run_job.py`
- Modify: `services/worker/app/celery_app.py`
- Modify: `services/worker/tests/test_celery_app_registration.py`
- Create: `services/worker/tests/test_run_job_task.py`
- Create: `services/api/tests/test_jobs_api.py`
- Modify: `services/api/tests/test_course_exports.py`

- [ ] **Step 1: Write the failing tests**

Add a request/response test that asserts the new download contract:

```python
def test_request_course_download_returns_pending_job(client, db_session):
    response = client.post(f"/courses/{course.id}/downloads/pdf")
    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "pending"
    assert body["job_type"] == "course_export_pdf"
    assert body["job_id"]
    assert body["resource_id"]
```

Add a jobs API test that asserts the drawer can list resource jobs:

```python
def test_jobs_api_lists_resource_jobs(client, db_session):
    response = client.get("/jobs", params={"scope": "resource"})
    assert response.status_code == 200
    assert "items" in response.json()
```

Add a worker task test that proves the new task shells out through the generic CLI:

```python
def test_run_job_task_calls_api_cli_subprocess(monkeypatch):
    result = run_job_for_generation.run("job_1")
    assert captured["command"] == ["/tmp/api-python", "-m", "app.cli.run_job", "job_1"]
```

Update `services/api/tests/test_course_exports.py` so it expects a pending/ready JSON response instead of a streamed attachment.

- [ ] **Step 2: Run the targeted tests and confirm they fail**

Run:

```bash
pytest services/api/tests/test_course_exports.py services/api/tests/test_jobs_api.py -q
cd services/worker && .venv/bin/python -m pytest -q tests/test_run_job_task.py tests/test_celery_app_registration.py
```

Expected: fail because the new API and task entry point are not wired yet.

- [ ] **Step 3: Implement the generic job/resource flow**

Add:

- `file_resource_service.py` for fingerprint lookup, resource creation, and direct URL resolution
- `job_service.py` for generic job serialization and lookup
- `schemas/job.py` for job read/list shapes
- `routes/jobs.py` for the global jobs list and detail endpoints
- `POST /courses/{course_id}/downloads/{format}` in `courses.py` to either return a ready direct link or queue a job
- `run_job.py` in `app/cli` to dispatch the job by `job_type`
- `run_job.py` in the worker task package to shell out to that CLI

Keep the existing audio/url/file worker task names as thin wrappers if they are still needed elsewhere, but have the new generic path own the resource-download flow.

- [ ] **Step 4: Run the targeted tests again**

Run:

```bash
pytest services/api/tests/test_course_exports.py services/api/tests/test_jobs_api.py -q
cd services/worker && .venv/bin/python -m pytest -q tests/test_run_job_task.py tests/test_celery_app_registration.py
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add services/api/app/services/file_resource_service.py services/api/app/services/job_service.py services/api/app/schemas/job.py services/api/app/api/routes/jobs.py services/api/app/api/routes/courses.py services/api/app/api/routes/internal.py services/api/app/main.py services/api/app/worker_client.py services/api/app/cli/run_job.py services/worker/app/tasks/run_job.py services/worker/app/celery_app.py services/api/tests/test_jobs_api.py services/api/tests/test_course_exports.py services/worker/tests/test_run_job_task.py services/worker/tests/test_celery_app_registration.py
git commit -m "feat: add generic resource job API"
```

## Task 3: Existing Resource Producers on the Unified Table

**Files:**
- Modify: `services/api/app/services/audio_generation_service.py`
- Modify: `services/api/app/services/file_import_service.py`
- Modify: `services/api/app/services/article_image_import.py`
- Modify: `services/api/app/services/course_service.py`
- Modify: `services/api/app/api/routes/courses.py`
- Modify: `services/api/tests/test_audio_generation_service.py`
- Modify: `services/api/tests/test_file_import_service.py`
- Modify: `services/api/tests/test_article_image_import.py`
- Modify: `services/api/tests/test_courses_api.py`
- Modify: `services/api/tests/test_url_import_service.py`

- [ ] **Step 1: Write the failing tests**

Update the producer tests so they assert resource linkage instead of only legacy storage fields:

```python
assert stored_course.current_audio_resource_id == assets[0].resource_id
assert assets[0].resource_id is not None
assert asset.resource_id is not None
assert valid_item.resource_id is not None
assert response.json()["current_audio_url"].startswith("https://")
```

For course deletion, assert that the linked resource rows or objects are cleaned up through the resource service rather than by reading storage columns directly.

- [ ] **Step 2: Run the targeted tests and confirm they fail**

Run:

```bash
pytest services/api/tests/test_audio_generation_service.py services/api/tests/test_file_import_service.py services/api/tests/test_article_image_import.py services/api/tests/test_courses_api.py -q
```

Expected: fail because the producer code still writes through the legacy storage fields.

- [ ] **Step 3: Redirect all existing producers and readers to `file_resources`**

Implement the following:

- audio generation stores the final audio object into `file_resources` and links `Course.current_audio_resource_id`
- file import uploads raw files into `file_resources` and links `FileImportItem.resource_id`
- article image import creates `file_resources` rows for uploaded images and links `ArticleImageAsset.resource_id`
- `current_audio_url_for_course` resolves from the resource row and returns an absolute public URL when the backend supports one
- course/image/audio download routes stop streaming object bytes through the API and instead redirect or resolve the public URL from the resource row
- `delete_course_with_resources` removes or tombstones the linked resource rows through the unified helper

Keep the legacy storage columns for backfill compatibility, but stop using them as the source of truth in new code.

- [ ] **Step 4: Run the targeted tests again**

Run:

```bash
pytest services/api/tests/test_audio_generation_service.py services/api/tests/test_file_import_service.py services/api/tests/test_article_image_import.py services/api/tests/test_courses_api.py -q
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add services/api/app/services/audio_generation_service.py services/api/app/services/file_import_service.py services/api/app/services/article_image_import.py services/api/app/services/course_service.py services/api/app/api/routes/courses.py services/api/tests/test_audio_generation_service.py services/api/tests/test_file_import_service.py services/api/tests/test_article_image_import.py services/api/tests/test_courses_api.py services/api/tests/test_url_import_service.py
git commit -m "feat: route existing file producers through unified resources"
```

## Task 4: Web Download Actions, Task Drawer, and Course Detail Menu

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/i18n.ts`
- Create: `apps/web/src/components/CourseActionMenu.tsx`
- Create: `apps/web/src/components/ResourceJobDrawer.tsx`
- Create: `apps/web/src/components/ResourceJobList.tsx`
- Modify: `apps/web/src/components/ConsoleShell.tsx`
- Modify: `apps/web/src/components/CourseDownloadActions.tsx`
- Modify: `apps/web/src/app/[locale]/courses/[courseId]/page.tsx`
- Modify: `apps/web/src/app/[locale]/jobs/page.tsx`
- Modify: `apps/web/tests/course-flow.spec.ts`

- [ ] **Step 1: Write the failing tests**

Extend `apps/web/tests/course-flow.spec.ts` so it verifies:

```ts
await page.getByRole("button", { name: "更多操作" }).click();
await expect(page.getByRole("menuitem", { name: "下载为Markdown" })).toBeVisible();
await expect(page.getByRole("menuitem", { name: "下载为Word" })).toBeVisible();
await expect(page.getByRole("menuitem", { name: "下载为PDF" })).toBeVisible();
await expect(page.getByRole("menuitem", { name: "下载音频" })).toBeVisible();
await expect(page.getByRole("button", { name: "下载任务" })).toBeVisible();
```

Also add an assertion that the download request route returns a ready link or a queued job message instead of a blob response.

- [ ] **Step 2: Run the targeted Playwright test and confirm it fails**

Run:

```bash
cd apps/web && npx playwright test tests/course-flow.spec.ts -g "course detail downloads content and audio files"
```

Expected: fail because the frontend still blob-fetches downloads and there is no jobs drawer yet.

- [ ] **Step 3: Implement the web-side resource contract**

Add:

- typed request/response helpers for resource downloads and jobs
- a shared `CourseActionMenu` so the course detail page and library rows use the same overflow items
- a shell-level jobs drawer backed by `GET /jobs`
- `CourseDownloadActions` logic that opens a direct storage URL when ready and shows the queued message when not
- `jobs` page content that reuses the same list component as the drawer
- course detail menu items for markdown, word, pdf, and audio downloads

The new copy should tell the user that the file is being generated and that progress is available from the task list.

- [ ] **Step 4: Run the targeted Playwright test again**

Run:

```bash
cd apps/web && npx playwright test tests/course-flow.spec.ts -g "course detail downloads content and audio files"
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/lib/i18n.ts apps/web/src/components/CourseActionMenu.tsx apps/web/src/components/ResourceJobDrawer.tsx apps/web/src/components/ResourceJobList.tsx apps/web/src/components/ConsoleShell.tsx apps/web/src/components/CourseDownloadActions.tsx apps/web/src/app/[locale]/courses/[courseId]/page.tsx apps/web/src/app/[locale]/jobs/page.tsx apps/web/tests/course-flow.spec.ts
git commit -m "feat: add download task drawer and resource-aware downloads"
```

## Task 5: Library Multi-Select, Move-To, and Row Layout

**Files:**
- Modify: `apps/web/src/components/CourseListItem.tsx`
- Modify: `apps/web/src/components/CourseCard.tsx`
- Modify: `apps/web/src/app/[locale]/library/page.tsx`
- Create: `apps/web/src/components/CourseBulkActionBar.tsx`
- Create: `apps/web/src/components/CourseMoveSeriesPanel.tsx`
- Modify: `apps/web/src/components/CourseActionMenu.tsx`
- Modify: `apps/web/tests/course-flow.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add or extend a Playwright test that asserts:

```ts
await page.getByRole("checkbox", { name: /select/i }).first().check();
await expect(page.getByRole("button", { name: /已选 1/ })).toBeVisible();
await expect(page.getByRole("button", { name: "删除" })).toBeVisible();
await expect(page.getByRole("button", { name: "取消星标" })).toBeVisible();
await expect(page.getByRole("button", { name: "转移至" })).toBeVisible();
await page.getByRole("button", { name: "更多操作: 可下载课程" }).click();
await expect(page.getByRole("menuitem", { name: "转移至" })).toBeVisible();
```

Also assert the row structure reflects the new ordering: playable status badge left of the title, overflow on the progress-bar side, and a `|` separator between the progress and the overflow control.

- [ ] **Step 2: Run the targeted Playwright test and confirm it fails**

Run:

```bash
cd apps/web && npx playwright test tests/course-flow.spec.ts -g "library course cards expose download actions"
```

Expected: fail because the row is still the old layout and there is no bulk toolbar.

- [ ] **Step 3: Implement the shared menu and bulk toolbar**

Build:

- selectable rows in `CourseListItem`
- the shared overflow menu in `CourseActionMenu`
- a selected-course toolbar in `CourseBulkActionBar`
- a `CourseMoveSeriesPanel` that reuses `SeriesAutocompleteField`
- bulk delete, bulk unstar, and bulk move-to-series actions in `library/page.tsx`

Use the existing single-course APIs in a loop for this iteration instead of inventing a new batch endpoint.

- [ ] **Step 4: Run the targeted Playwright test again**

Run:

```bash
cd apps/web && npx playwright test tests/course-flow.spec.ts -g "library course cards expose download actions"
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/CourseListItem.tsx apps/web/src/components/CourseCard.tsx apps/web/src/app/[locale]/library/page.tsx apps/web/src/components/CourseBulkActionBar.tsx apps/web/src/components/CourseMoveSeriesPanel.tsx apps/web/src/components/CourseActionMenu.tsx apps/web/tests/course-flow.spec.ts
git commit -m "feat: add bulk course actions to the library"
```

## Task 6: Import Home Layout and Tag Drawer

**Files:**
- Modify: `apps/web/src/app/[locale]/import/page.tsx`
- Modify: `apps/web/src/components/TagManagementPage.tsx`
- Modify: `apps/web/src/components/FloatingPanel.tsx` if the drawer needs a small responsive tweak
- Modify: `apps/web/tests/file-import.spec.ts`
- Modify: `apps/web/tests/tag-series-management.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add assertions that the import home page shows the four import choices as a single vertical stack and that the tag editor no longer consumes permanent layout width:

```ts
await expect(page.locator('section').first()).toHaveCount(4);
await expect(page.getByRole("dialog", { name: "编辑标签" })).toBeVisible();
```

The tag page test should confirm the selected tag opens a modal or right-side drawer instead of an inline aside.

- [ ] **Step 2: Run the targeted Playwright tests and confirm they fail**

Run:

```bash
cd apps/web && npx playwright test tests/file-import.spec.ts tests/tag-series-management.spec.ts
```

Expected: fail because the import home still uses a grid and the tag editor still renders inline.

- [ ] **Step 3: Implement the layout changes**

Change:

- `import/page.tsx` from the 2x2 grid to a single stacked column of import choices
- `TagManagementPage` from an always-visible aside to a drawer/modal flow driven by selection state
- the viewport selection so desktop opens a right drawer and narrow screens fall back to a modal

Keep the tag edit/create/delete behavior identical; only the presentation changes.

- [ ] **Step 4: Run the targeted Playwright tests again**

Run:

```bash
cd apps/web && npx playwright test tests/file-import.spec.ts tests/tag-series-management.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/import/page.tsx apps/web/src/components/TagManagementPage.tsx apps/web/src/components/FloatingPanel.tsx apps/web/tests/file-import.spec.ts apps/web/tests/tag-series-management.spec.ts
git commit -m "feat: update import layout and tag drawer"
```

## Task 7: Full Regression Sweep

**Files:**
- None if the previous tasks landed cleanly; only fixups if regressions appear.

- [ ] **Step 1: Run the backend test suite**

Run:

```bash
make test-api
```

Expected: pass.

- [ ] **Step 2: Run the worker test suite**

Run:

```bash
cd services/worker && .venv/bin/python -m pytest -q
```

Expected: pass.

- [ ] **Step 3: Run the web test suite**

Run:

```bash
make test-web
```

Expected: pass.

- [ ] **Step 4: Fix any regressions and rerun the failing suite**

If one of the suites fails, fix the smallest surface that caused the regression and rerun only that suite until it passes.

- [ ] **Step 5: Final commit**

If there are any remaining fixups after the regression sweep, commit them with a message that reflects the finished feature.
