# PageAlong Android Import and Task Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Android URL/text/file import flows and a unified task center that tracks import, audio generation, export download, retry, progress, and failure states.

**Architecture:** Reuse the existing Web backend import/download/job endpoints, adding only the missing file-import batch list/retry contract needed for a mobile task center. The mobile app owns import UI, WebView clipping, document picking, FormData upload, and a normalized task-view model that merges generation jobs with file import batches.

**Tech Stack:** Expo Router, React Native, TypeScript, React Query, expo-document-picker, react-native-webview, FastAPI, SQLAlchemy, pytest, @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-08-27-pagealong-android-app-design.md` (Spec 6: 导入与任务中心)

## Global Constraints

- 只做 Android，不做 iOS。
- 不做 `Sign in with Apple`。
- 不做手机短信验证码登录。
- 微信登录保留，但仅在国内用户可见。
- 手机一键登录保留为可选能力，前提是没有直接金钱成本且接入路径明确。
- 主题只保留白天和夜间两种，不做动态色或额外主题。
- 后端接口优先复用 Web 端现有接口，只有确实无法复用时才补新接口。
- 播放器在应用切到后台后不能停止。
- 下载逻辑要和 Web 端一致：文件已准备好就立即下载，未准备好则提示生成中并引导去任务页。
- 设计、交互、组件、文字风格参考 `/Users/jqsf/Downloads/cubox` 下的竞品截图，只借深色底、强留白、超大标题、紧凑分组、底部抽屉和图标优先的界面语法，不照搬品牌元素。

---

## Scope Check

In scope:

- Import page with URL input at the top.
- App-internal WebView browsing for a URL.
- Save/current-page action that triggers existing URL import.
- Text import bottom sheet.
- Android document picker and file import upload.
- Unified task center in the `"下载资源"` tab, grouped by `进行中 / 待处理 / 已完成 / 失败`.
- Failure reason expansion and retry.
- Download request behavior: open ready URL or guide to task center when pending.

Out of scope:

- DOM-level article extraction from WebView. The first version may send URL/title through the existing URL import flow.
- OCR.
- Folder import from Android storage tree unless `expo-document-picker` returns usable relative paths; otherwise keep `folder` as a later enhancement.
- Full offline download manager and local file cache.

## Design Direction

- Import page follows the reference screenshots: large `"导入"` title, URL field as the primary first-screen object, then two compact icon entries for `"文本导入"` and `"文件导入"`.
- WebView browser chrome must stay lean: back, URL/title, save icon. Do not turn it into a full browser.
- Task center rows should look like compact grouped list items, not dashboard cards. Status is conveyed by small labels, progress line, and icon state.
- Bottom sheets are used for text import, retry details, and download-format choice.

## File Structure

### Backend

- Modify `services/api/app/schemas/file_import.py`: add `FileImportBatchList`.
- Modify `services/api/app/services/file_import_service.py`: add list and retry helpers.
- Modify `services/api/app/api/routes/courses.py`: add `GET /courses/file-import-batches` and `POST /courses/file-import-batches/{batch_id}/retry`.
- Modify `services/api/tests/test_file_import_api.py`: cover batch list and retry.

### Mobile

- Modify `apps/mobile/package.json`: add `expo-document-picker` and `react-native-webview`.
- Modify `apps/mobile/package-lock.json`: lock new mobile dependencies.
- Modify `apps/mobile/src/lib/api.ts`: add import, file batch, job, retry, and download helpers.
- Create `apps/mobile/src/lib/tasks.ts`: normalize jobs and file batches into grouped task rows.
- Replace `apps/mobile/app/import/index.tsx`: real import page.
- Create `apps/mobile/app/import/web.tsx`: WebView browser/import route.
- Create `apps/mobile/src/components/UrlImportBar.tsx`: URL field and open action.
- Create `apps/mobile/src/components/TextImportSheet.tsx`: text import bottom sheet.
- Create `apps/mobile/src/components/FileImportButton.tsx`: document-picker upload entry.
- Create `apps/mobile/src/components/TaskStatusPill.tsx`: status badge.
- Create `apps/mobile/src/components/TaskRow.tsx`: unified task row.
- Create `apps/mobile/src/components/TaskGroup.tsx`: grouped task section.
- Create `apps/mobile/src/components/TaskRetrySheet.tsx`: failure details and retry.
- Modify `apps/mobile/app/(tabs)/downloads.tsx`: unified task center.
- Create `apps/mobile/tests/import-api.test.ts`: import API tests.
- Create `apps/mobile/tests/tasks.test.ts`: task normalization tests.
- Create `apps/mobile/tests/import-screen.test.tsx`: import UI tests.
- Create `apps/mobile/tests/task-center-screen.test.tsx`: task center tests.

## Mobile Test Fixture Notes

When a test snippet below calls `courseFixture`, `jobFixture`, `batchFixture`, `pageOfJobs`, `pageOfBatches`, or `mockRouterPush`, define those helpers at the top of that same test file. The fixture helpers should return complete mobile API objects with sensible defaults and shallow-merge overrides. `mockRouterPush` should mock Expo Router's `useRouter()` return value for that test file only.

---

### Task 1: Add file-import batch list and retry endpoints

**Files:**
- Modify: `services/api/app/schemas/file_import.py`
- Modify: `services/api/app/services/file_import_service.py`
- Modify: `services/api/app/api/routes/courses.py`
- Test: `services/api/tests/test_file_import_api.py`

**Interfaces:**
- Consumes: existing file import batch/item models and `enqueue_file_import(item.id)`.
- Produces:
  - `GET /courses/file-import-batches?page=1&page_size=20`
  - `POST /courses/file-import-batches/{batch_id}/retry`

- [ ] **Step 1: Write failing backend list test**

```python
def test_lists_current_user_file_import_batches(client, tmp_path):
    response = client.get("/courses/file-import-batches")

    assert response.status_code == 200
    assert response.json()["items"] == []
    assert response.json()["pagination"]["page"] == 1
```

- [ ] **Step 2: Write failing backend retry test**

```python
def test_retries_failed_file_import_batch(client, db_session, monkeypatch):
    from app.api.routes import courses
    from app.models.file_import import FileImportBatch, FileImportBatchStatus, FileImportItem, FileImportItemStatus, FileImportSourceMode

    enqueued = []
    monkeypatch.setattr(courses, "enqueue_file_import", lambda item_id: enqueued.append(item_id))
    batch = FileImportBatch(user_id="demo-user", source_mode=FileImportSourceMode.SINGLE_FILE, status=FileImportBatchStatus.FAILED, total_count=1, failed_count=1)
    db_session.add(batch)
    db_session.flush()
    item = FileImportItem(
        batch_id=batch.id,
        user_id="demo-user",
        status=FileImportItemStatus.FAILED,
        original_filename="a.md",
        file_extension=".md",
        byte_size=8,
        storage_backend="local",
        object_key="a.md",
        object_path=str(tmp_path / "a.md"),
    )
    db_session.add(item)
    db_session.commit()

    response = client.post(f"/courses/file-import-batches/{batch.id}/retry")

    assert response.status_code == 202
    assert enqueued == [item.id]
    assert response.json()["status"] in {"pending", "running"}
```

- [ ] **Step 3: Run the failing backend tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_file_import_api.py -k "batch"
```

Expected: fail because list and retry routes do not exist.

- [ ] **Step 4: Add schema list type**

Add:

```python
from app.schemas.pagination import PaginatedList

class FileImportBatchList(PaginatedList[FileImportBatchRead]):
    pass
```

- [ ] **Step 5: Add service helpers**

Add to `FileImportService`:

```python
def list_batches(self, user_id: str) -> list[FileImportBatch]:
    return list(
        self.db.scalars(
            select(FileImportBatch)
            .where(FileImportBatch.user_id == user_id)
            .order_by(FileImportBatch.created_at.desc(), FileImportBatch.id.desc())
        )
    )
```

Add:

```python
def reset_retryable_items_for_batch(self, batch_id: str) -> list[FileImportItem]:
    batch = self.db.get(FileImportBatch, batch_id)
    if batch is None:
        raise ValueError("File import batch not found")
    retryable = [
        item for item in self.db.scalars(select(FileImportItem).where(FileImportItem.batch_id == batch_id))
        if item.status in {FileImportItemStatus.FAILED, FileImportItemStatus.PENDING}
    ]
    for item in retryable:
        item.status = FileImportItemStatus.PENDING
        item.error_code = None
        item.error_message = None
        item.started_at = None
        item.finished_at = None
    self._recompute_batch(batch_id)
    self.db.commit()
    return retryable
```

- [ ] **Step 6: Add routes**

Import `FileImportBatchList` and `paginate_sequence`. Add:

```python
@router.get("/file-import-batches", response_model=FileImportBatchList)
def list_file_import_batches(...):
    service = FileImportService(db)
    batches = service.list_batches(user_id)
    paginated_batches, pagination = paginate_sequence(batches, page, page_size)
    return FileImportBatchList(items=[serialize_file_import_batch(batch, db) for batch in paginated_batches], pagination=pagination)
```

Add retry route that calls `reset_retryable_items_for_batch`, enqueues each returned item, marks enqueue failure through `mark_item_failed`, then returns the refreshed batch with `202`.

- [ ] **Step 7: Re-run backend tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_file_import_api.py -k "batch"
```

Expected: pass.

- [ ] **Step 8: Commit backend task batch endpoints**

```bash
git add services/api/app/schemas/file_import.py services/api/app/services/file_import_service.py services/api/app/api/routes/courses.py services/api/tests/test_file_import_api.py
git commit -m "feat: add file import batch task endpoints"
```

---

### Task 2: Add mobile import and task API helpers

**Files:**
- Modify: `apps/mobile/src/lib/api.ts`
- Create: `apps/mobile/tests/import-api.test.ts`

**Interfaces:**
- Consumes: existing and new backend endpoints for courses, file batches, jobs, retries, and downloads.
- Produces: `createTextCourse`, `createUrlCourse`, `createExtensionSyncCourse`, `createFileImportBatch`, `listFileImportBatchesPage`, `getFileImportBatch`, `retryFileImportBatch`, `listGenerationJobsPage`, `getGenerationJob`, `retryFailedCourseJob`, and `requestCourseDownload`.

- [ ] **Step 1: Write failing API tests**

```ts
it("submits mobile URL import through extension sync metadata", async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ id: "course-1", title: "网页", tags: [] })
  })) as jest.Mock;

  await createExtensionSyncCourse({ url: "https://example.com/a", title: "网页" });

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/courses/import-url/extension-sync"),
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("mobile_web_entry")
    })
  );
});
```

```ts
it("uploads selected files as multipart form data", async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ id: "batch-1", status: "pending", items: [] })
  })) as jest.Mock;

  await createFileImportBatch({
    files: [{ uri: "file:///a.md", name: "a.md", type: "text/markdown" }],
    sourceMode: "single_file"
  });

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/courses/import-files"),
    expect.objectContaining({ method: "POST", body: expect.any(FormData) })
  );
});
```

- [ ] **Step 2: Run failing API tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- import-api.test.ts
```

Expected: fail because helpers are missing.

- [ ] **Step 3: Add import/task types**

Add:

```ts
export type FileImportUpload = { uri: string; name: string; type?: string | null; relativePath?: string | null };
export type FileImportBatch = { id: string; status: string; source_mode: string; total_count: number; success_count: number; failed_count: number; created_at: string; updated_at: string; finished_at: string | null; items: FileImportItem[] };
export type GenerationJob = { id: string; course_id: string; target_label?: string | null; job_type: string; status: string; progress_current: number; progress_total: number; error_message?: string | null; download_url?: string | null; created_at?: string; updated_at?: string };
```

- [ ] **Step 4: Implement API helpers**

For React Native FormData files, append:

```ts
formData.append("files", {
  uri: file.uri,
  name: file.name,
  type: file.type || "application/octet-stream"
} as unknown as Blob);
```

Set:

```ts
formData.set("relative_paths_json", JSON.stringify(input.files.map((file) => file.relativePath ?? null)));
```

Do not set `Content-Type` manually for multipart requests.

- [ ] **Step 5: Re-run API tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- import-api.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit mobile import API helpers**

```bash
git add apps/mobile/src/lib/api.ts apps/mobile/tests/import-api.test.ts
git commit -m "feat: add mobile import task api helpers"
```

---

### Task 3: Build task normalization helpers

**Files:**
- Create: `apps/mobile/src/lib/tasks.ts`
- Create: `apps/mobile/tests/tasks.test.ts`

**Interfaces:**
- Consumes: `GenerationJob[]` and `FileImportBatch[]`.
- Produces: `TaskRowModel[]` grouped into `running`, `pending`, `completed`, and `failed`.

- [ ] **Step 1: Write failing helper tests**

```ts
it("groups generation jobs and file batches into task sections", () => {
  const groups = groupTasks([
    taskFromJob({ id: "job-1", job_type: "tts_generate", status: "running", progress_current: 1, progress_total: 4 }),
    taskFromFileBatch({ id: "batch-1", status: "failed", failed_count: 1, total_count: 1 })
  ]);

  expect(groups.running).toHaveLength(1);
  expect(groups.failed).toHaveLength(1);
});
```

- [ ] **Step 2: Run failing helper tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- tasks.test.ts
```

Expected: fail because `src/lib/tasks.ts` does not exist.

- [ ] **Step 3: Implement normalized task model**

```ts
export type TaskGroupKey = "running" | "pending" | "completed" | "failed";

export type TaskRowModel = {
  id: string;
  source: "job" | "file_batch";
  title: string;
  subtitle: string;
  typeLabel: string;
  status: string;
  group: TaskGroupKey;
  progress: number;
  errorMessage: string | null;
  updatedAt: string;
  downloadUrl?: string | null;
  courseId?: string | null;
};
```

Map job statuses:

- `running` -> running.
- `pending` -> pending.
- `succeeded` -> completed.
- `failed` -> failed.

Map file batch statuses:

- `running` -> running.
- `pending` -> pending.
- `succeeded` and `completed_with_failures` -> completed unless `failed_count > 0`, in which case failed details remain expandable.
- `failed` -> failed.

- [ ] **Step 4: Re-run helper tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- tasks.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit task normalization**

```bash
git add apps/mobile/src/lib/tasks.ts apps/mobile/tests/tasks.test.ts
git commit -m "feat: normalize mobile task center rows"
```

---

### Task 4: Build the import page

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/package-lock.json`
- Replace: `apps/mobile/app/import/index.tsx`
- Create: `apps/mobile/src/components/UrlImportBar.tsx`
- Create: `apps/mobile/src/components/TextImportSheet.tsx`
- Create: `apps/mobile/src/components/FileImportButton.tsx`
- Create: `apps/mobile/tests/import-screen.test.tsx`

**Interfaces:**
- Consumes: `createTextCourse`, `createFileImportBatch`, Expo Router, `expo-document-picker`.
- Produces: `/import` route with URL, text, and file entry points.

- [ ] **Step 1: Add mobile dependencies**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm install expo-document-picker react-native-webview
```

- [ ] **Step 2: Write failing import screen tests**

```tsx
it("opens text import from the import page", () => {
  const screen = render(<ImportScreen />);

  fireEvent.press(screen.getByText("文本导入"));

  expect(screen.getByPlaceholderText("粘贴要转成课程的文本")).toBeTruthy();
});
```

```tsx
it("opens a URL inside the app browser route", () => {
  const push = jest.fn();
  mockRouterPush(push);
  const screen = render(<ImportScreen />);

  fireEvent.changeText(screen.getByPlaceholderText("输入网址"), "https://example.com");
  fireEvent.press(screen.getByLabelText("打开网页"));

  expect(push).toHaveBeenCalledWith({ pathname: "/import/web", params: { url: "https://example.com" } });
});
```

- [ ] **Step 3: Run failing import screen tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- import-screen.test.tsx
```

Expected: fail because the real import page is missing.

- [ ] **Step 4: Implement `UrlImportBar`**

Behavior:

- Placeholder `"输入网址"`.
- Prefix missing scheme with `https://`.
- Open button accessibility label `"打开网页"`.
- Invalid URL shows `"请输入有效网址"`.

- [ ] **Step 5: Implement `TextImportSheet`**

Fields:

- Title input placeholder `"标题，可选"`.
- Text input placeholder `"粘贴要转成课程的文本"`.
- Done button `"完成"`.

On submit:

```ts
await createTextCourse({ title: title.trim() || text.trim().slice(0, 32), text });
router.replace("/(tabs)/downloads");
```

- [ ] **Step 6: Implement `FileImportButton`**

Use:

```ts
const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
```

If canceled, do nothing. If one file, `sourceMode="single_file"`, otherwise `"multiple_files"`. Submit and route to downloads.

- [ ] **Step 7: Re-run import screen tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- import-screen.test.tsx
```

Expected: pass.

- [ ] **Step 8: Commit import page**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/app/import/index.tsx apps/mobile/src/components/UrlImportBar.tsx apps/mobile/src/components/TextImportSheet.tsx apps/mobile/src/components/FileImportButton.tsx apps/mobile/tests/import-screen.test.tsx
git commit -m "feat: build mobile import page"
```

---

### Task 5: Build WebView import browser

**Files:**
- Create: `apps/mobile/app/import/web.tsx`
- Modify: `apps/mobile/tests/import-screen.test.tsx`

**Interfaces:**
- Consumes: `react-native-webview`, `createExtensionSyncCourse`, and Expo Router params.
- Produces: `/import/web?url=<url>` route with browse and save behavior.

- [ ] **Step 1: Write failing WebView route test**

```tsx
it("saves the current WebView URL as a course", async () => {
  jest.spyOn(api, "createExtensionSyncCourse").mockResolvedValue(courseFixture({ id: "course-1", title: "网页标题" }));
  const screen = render(<ImportWebScreen />);

  fireEvent(screen.getByTestId("import-webview"), "navigationStateChange", {
    url: "https://example.com/article",
    title: "网页标题"
  });
  fireEvent.press(screen.getByLabelText("收藏网页"));

  await waitFor(() => {
    expect(api.createExtensionSyncCourse).toHaveBeenCalledWith({
      url: "https://example.com/article",
      title: "网页标题"
    });
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- import-screen.test.tsx
```

Expected: fail because the route does not exist.

- [ ] **Step 3: Implement WebView route**

Use `useLocalSearchParams<{ url: string }>()`. Track:

```ts
const [currentUrl, setCurrentUrl] = useState(initialUrl);
const [currentTitle, setCurrentTitle] = useState("");
```

Render top browser bar with:

- Back icon.
- Truncated title or URL.
- Save icon with label `"收藏网页"`.

Render:

```tsx
<WebView
  testID="import-webview"
  source={{ uri: initialUrl }}
  onNavigationStateChange={(state) => {
    setCurrentUrl(state.url);
    setCurrentTitle(state.title || "");
  }}
/>
```

On save, call `createExtensionSyncCourse({ url: currentUrl, title: currentTitle || undefined })`, then `router.replace("/(tabs)/downloads")`.

- [ ] **Step 4: Re-run WebView tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- import-screen.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit WebView import route**

```bash
git add apps/mobile/app/import/web.tsx apps/mobile/tests/import-screen.test.tsx
git commit -m "feat: add mobile webview import route"
```

---

### Task 6: Build the unified task center

**Files:**
- Create: `apps/mobile/src/components/TaskStatusPill.tsx`
- Create: `apps/mobile/src/components/TaskRow.tsx`
- Create: `apps/mobile/src/components/TaskGroup.tsx`
- Create: `apps/mobile/src/components/TaskRetrySheet.tsx`
- Modify: `apps/mobile/app/(tabs)/downloads.tsx`
- Create: `apps/mobile/tests/task-center-screen.test.tsx`

**Interfaces:**
- Consumes: `listGenerationJobsPage({ scope: "all" })`, `listFileImportBatchesPage`, `retryFailedCourseJob`, `retryFileImportBatch`, and `groupTasks`.
- Produces: `"下载资源"` tab as a unified task center.

- [ ] **Step 1: Write failing task-center tests**

```tsx
it("renders grouped task sections", async () => {
  jest.spyOn(api, "listGenerationJobsPage").mockResolvedValue(pageOfJobs([jobFixture({ id: "job-1", status: "running", job_type: "tts_generate" })]));
  jest.spyOn(api, "listFileImportBatchesPage").mockResolvedValue(pageOfBatches([batchFixture({ id: "batch-1", status: "failed" })]));

  const screen = render(<DownloadsScreen />);

  expect(await screen.findByText("进行中")).toBeTruthy();
  expect(screen.getByText("失败")).toBeTruthy();
});
```

```tsx
it("opens retry details for a failed task", async () => {
  jest.spyOn(api, "listGenerationJobsPage").mockResolvedValue(pageOfJobs([jobFixture({ id: "job-1", status: "failed", error_message: "队列不可用" })]));
  jest.spyOn(api, "listFileImportBatchesPage").mockResolvedValue(pageOfBatches([]));

  const screen = render(<DownloadsScreen />);

  fireEvent.press(await screen.findByText("队列不可用"));

  expect(screen.getByText("重试")).toBeTruthy();
});
```

- [ ] **Step 2: Run failing tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- task-center-screen.test.tsx
```

Expected: fail because task center components are missing.

- [ ] **Step 3: Implement task rows and groups**

`TaskRow` displays:

- Target title.
- Type label: `"导入"`, `"音频生成"`, `"PDF 导出"`, `"Word 导出"`, `"Markdown 导出"`.
- Status pill.
- Progress line when progress can be computed.
- Updated time.
- Failure reason line when failed.

`TaskGroup` renders only when its task list is non-empty.

- [ ] **Step 4: Implement downloads tab data flow**

Use two queries:

```tsx
const jobsQuery = useQuery({ queryKey: ["mobile", "tasks", "jobs"], queryFn: () => listGenerationJobsPage({ scope: "all", pageSize: 50 }) });
const batchesQuery = useQuery({ queryKey: ["mobile", "tasks", "file-batches"], queryFn: () => listFileImportBatchesPage({ pageSize: 50 }) });
```

Merge and group task rows. Default order inside each group is updated/created time descending.

- [ ] **Step 5: Implement retry sheet**

When a failed row is pressed:

- Show error details.
- Show `"重试"` button.
- If `source === "job"`, call `retryFailedCourseJob(task.courseId)`.
- If `source === "file_batch"`, call `retryFileImportBatch(task.id)`.
- Invalidate both task queries on success.

- [ ] **Step 6: Re-run task center tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- task-center-screen.test.tsx
```

Expected: pass.

- [ ] **Step 7: Commit task center**

```bash
git add apps/mobile/src/components/TaskStatusPill.tsx apps/mobile/src/components/TaskRow.tsx apps/mobile/src/components/TaskGroup.tsx apps/mobile/src/components/TaskRetrySheet.tsx apps/mobile/app/(tabs)/downloads.tsx apps/mobile/tests/task-center-screen.test.tsx
git commit -m "feat: build mobile task center"
```

---

### Task 7: Wire download request guidance

**Files:**
- Modify: `apps/mobile/src/components/LibraryMoreSheet.tsx`
- Modify: `apps/mobile/src/components/ReaderBottomBar.tsx`
- Modify: `apps/mobile/app/courses/[courseId].tsx`
- Modify: `apps/mobile/tests/task-center-screen.test.tsx`

**Interfaces:**
- Consumes: `requestCourseDownload(courseId, format)`.
- Produces: consistent download behavior from library and reader: ready opens URL, pending routes to task center.

- [ ] **Step 1: Write failing download guidance test**

```tsx
it("routes to task center when download is pending", async () => {
  jest.spyOn(api, "requestCourseDownload").mockResolvedValue({
    status: "pending",
    job_id: "job-1",
    job_type: "course_export_pdf",
    resource_id: null,
    download_url: null,
    message: "download_generation_queued"
  });
  const push = jest.fn();
  mockRouterPush(push);

  await requestDownloadAndOpenOrQueue({ courseId: "course-1", format: "pdf", router: { push } });

  expect(push).toHaveBeenCalledWith({ pathname: "/(tabs)/downloads", params: { jobId: "job-1" } });
});
```

- [ ] **Step 2: Run failing guidance test**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- task-center-screen.test.tsx
```

Expected: fail because the shared download helper does not exist.

- [ ] **Step 3: Implement shared download helper**

Add to `apps/mobile/src/lib/tasks.ts`:

```ts
export async function requestDownloadAndOpenOrQueue(input: {
  courseId: string;
  format: CourseDownloadFormat;
  router: { push: (href: unknown) => void };
}): Promise<DownloadRequest> {
  const request = await requestCourseDownload(input.courseId, input.format);
  if (request.status === "ready" && request.download_url) {
    await Linking.openURL(mediaUrl(request.download_url));
    return request;
  }
  input.router.push({ pathname: "/(tabs)/downloads", params: { jobId: request.job_id ?? "" } });
  return request;
}
```

- [ ] **Step 4: Wire library and reader download actions**

Replace any local download handling with the shared helper. Show `"文件正在生成中"` when the helper returns pending.

- [ ] **Step 5: Re-run guidance tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- task-center-screen.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit download guidance**

```bash
git add apps/mobile/src/lib/tasks.ts apps/mobile/src/components/LibraryMoreSheet.tsx apps/mobile/src/components/ReaderBottomBar.tsx apps/mobile/app/courses/[courseId].tsx apps/mobile/tests/task-center-screen.test.tsx
git commit -m "feat: guide pending downloads to task center"
```

---

### Task 8: Verify import and task center

**Files:**
- All files changed by Tasks 1-7.

- [ ] **Step 1: Run backend import tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_file_import_api.py
```

- [ ] **Step 2: Run mobile import/task tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- import-api.test.ts tasks.test.ts import-screen.test.tsx task-center-screen.test.tsx
```

- [ ] **Step 3: Run mobile typecheck**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm run typecheck
```

- [ ] **Step 4: Manual Android check**

```bash
API_PORT=8070 make api
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8070 npm run android
```

Check:

- Plus icon opens `/import`.
- URL field opens WebView route; save sends URL/title and then routes to task center.
- Text import sheet submits a course and routes to task center.
- File import opens Android picker, uploads one or multiple files, and shows a batch in task center.
- Task center groups running, pending, completed, and failed items.
- Failed task opens reason details and retry.
- Ready downloads open URL; pending downloads show generation message and navigate to task center.
- Dark mode uses compact grouped rows and bottom sheets consistent with Cubox reference.

- [ ] **Step 5: Commit verification fixes if needed**

```bash
git status --short
git add <only-files-touched-for-this-plan>
git commit -m "fix: polish mobile import task center"
```
