# PageAlong Android Share Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Android system share opens a dedicated processing page, imports the shared URL, auto-generates audio in the background, and navigates to the course reader only after text parsing is complete.

**Architecture:** Add one Android incoming-share entry, one dedicated `/share/receive` route, and one small AsyncStorage-backed share helper. Reuse the existing `POST /courses/import-url` pipeline by adding an `auto_generate_audio` flag through the API schema and service payload; the worker already knows how to honor that flag, so the reader and task center stay unchanged.

**Tech Stack:** Expo Router, `expo-sharing`, React Native, TypeScript, AsyncStorage, React Query, FastAPI, SQLAlchemy, pytest.

**Spec:** `docs/superpowers/specs/2026-08-31-pagealong-android-share-import-design.md`

## Global Constraints

- 只做 Android，不做 iOS。
- 接收 Android 系统分享。
- 接收网页 URL 分享。
- 接收 `text/plain` 和 `text/uri-list` 类型的分享。
- 处理单条分享和多条分享中的第一个有效 URL。
- 使用分享页作为独立中转页，不进入任务中心。
- 跳转阅读页只看正文是否已经可读，不等音频完成。
- 不新增新的课程来源类型，继续使用 `source_type=url_import`。
- 除非任务明确要求接入真实音频生成，否则保留当前 fake TTS 流程。
- 前端 API 访问集中在 `apps/mobile/src/lib/api.ts`，界面文案集中在 `apps/mobile/src/lib/i18n.ts`。

## File Structure

### Backend

- `services/api/app/schemas/course.py`: add the request flag for URL import.
- `services/api/app/api/routes/courses.py`: pass the new flag from the HTTP payload into the import service.
- `services/api/app/services/url_import_service.py`: persist the flag into the URL import job input JSON.
- `services/api/tests/test_url_import_api.py`: cover the API contract and job payload.
- `services/api/tests/test_url_import_service.py`: cover the service path that auto-requests audio.

### Mobile

- `apps/mobile/package.json` and `apps/mobile/package-lock.json`: install `expo-sharing`.
- `apps/mobile/app.config.ts`: enable Android incoming-share support for the MIME types in the spec.
- `apps/mobile/src/lib/url.ts`: host the shared web-URL normalization rule used by both the import bar and share flow.
- `apps/mobile/src/lib/share.ts`: extract a valid shared URL, persist pending share state, resolve post-login routing, and normalize incoming share redirects.
- `apps/mobile/src/lib/api.ts`: add the `auto_generate_audio` field to the URL import request.
- `apps/mobile/src/lib/i18n.ts`: add share-page copy in zh/en.
- `apps/mobile/src/components/UrlImportBar.tsx`: switch to the shared URL normalizer.
- `apps/mobile/app/+native-intent.ts`: redirect Expo Sharing incoming URLs to `/share/receive`.
- `apps/mobile/app/share/receive.tsx`: own the dedicated share processing page.
- `apps/mobile/app/(auth)/credentials.tsx` and `apps/mobile/app/(auth)/register.tsx`: resume the pending share after login.
- `apps/mobile/tests/share.test.ts`: cover URL normalization and pending-share persistence.
- `apps/mobile/tests/import-api.test.ts`: cover the new URL import request field.
- `apps/mobile/tests/url-import-bar.test.tsx`: guard the refactor that moves normalization into a shared helper.
- `apps/mobile/tests/native-intent.test.ts`: cover the native-intent redirect.
- `apps/mobile/tests/share-receive.test.tsx`: cover the page state flow.
- `apps/mobile/tests/auth-login.test.tsx` and `apps/mobile/tests/auth-register.test.tsx`: cover post-login routing back into the share flow.

## Scope Check

In scope:

- Android share entry and `/share/receive` processing page.
- URL-only import from `text/plain` and `text/uri-list`.
- Pending share persistence across login.
- `auto_generate_audio` on `POST /courses/import-url`.
- Redirect to the reader as soon as text is readable.

Out of scope:

- iOS share extensions.
- Image, file, PDF, or note-body sharing.
- New course source types.
- Task center changes.
- Reader/player changes; the current reader already knows how to handle `text_ready` and `audio_generating`.

---

### Task 1: Extend the backend URL import contract

**Files:**
- Modify: `services/api/app/schemas/course.py`
- Modify: `services/api/app/api/routes/courses.py`
- Modify: `services/api/app/services/url_import_service.py`
- Modify: `services/api/tests/test_url_import_api.py`
- Modify: `services/api/tests/test_url_import_service.py`

**Interfaces:**
- Consumes: `CourseUrlImportCreate.auto_generate_audio` from `POST /courses/import-url`.
- Produces: `ImportUrlInput.auto_generate_audio` and a URL import job payload that always includes `auto_generate_audio`.

- [ ] **Step 1: Write the failing backend tests**

Add an API test that proves the default stays off and the field is preserved in job input JSON:

```python
def test_create_url_import_course_defaults_auto_generate_audio_false(client, db_session, monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.courses.enqueue_url_import",
        lambda course_id, job_id: "celery-import-id",
    )

    response = client.post("/courses/import-url", json={"url": "https://example.com/article"})

    assert response.status_code == 201
    course = db_session.get(Course, response.json()["id"])
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == course.id).one()
    assert json.loads(job.input_json) == {
        "url": "https://example.com/article",
        "auto_generate_audio": False,
    }
```

Add a service test that proves the worker path requests audio when the flag is true:

```python
def test_run_import_job_with_auto_generate_audio_requests_tts(db_session, monkeypatch):
    requested = []

    monkeypatch.setattr(
        "app.services.url_import_service.fetch_public_html",
        lambda url: type(
            "Fetch",
            (),
            {
                "original_url": url,
                "final_url": url,
                "status_code": 200,
                "content_type": "text/html",
                "html": "<html></html>",
                "elapsed_ms": 1,
            },
        )(),
    )
    monkeypatch.setattr(
        "app.services.url_import_service.extract_article_content",
        lambda html, original_url, final_url: type(
            "Extracted",
            (),
            {
                "title": "网页标题",
                "normalized": type(
                    "Normalized",
                    (),
                    {
                        "content_markdown": "# 网页标题\n\n第一句。",
                        "tts_text": "网页标题\n\n第一句。",
                        "content_hash": "hash_1",
                    },
                )(),
                "source_metadata": {"source_kind": "url", "locator": original_url, "final_url": final_url},
                "extraction_metadata": {},
            },
        )(),
    )
    monkeypatch.setattr(
        "app.services.url_import_service.request_audio_generation",
        lambda db, course: requested.append(course.id),
    )

    course, job = UrlImportService(db_session).create_import_course(
        "user_1",
        ImportUrlInput(url="https://example.com/a", auto_generate_audio=True),
    )

    UrlImportService(db_session).run_import_job(job.id)

    assert requested == [course.id]
```

- [ ] **Step 2: Run the failing backend tests**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_url_import_api.py tests/test_url_import_service.py
```

Expected: the new assertions fail because the schema and import payload do not carry `auto_generate_audio` yet.

- [ ] **Step 3: Implement the schema, route, and service plumbing**

Add the field in the request model and thread it through to the job payload:

```python
class CourseUrlImportCreate(BaseModel):
    url: str = Field(min_length=1, max_length=4096)
    title: str | None = Field(default=None, max_length=512)
    series_id: str | None = None
    series_title: str | None = Field(default=None, max_length=512)
    tags: list[str] = Field(default_factory=list)
    tag_ids: list[str] = Field(default_factory=list)
    is_starred: bool = False
    auto_generate_audio: bool = False
```

```python
@dataclass(frozen=True)
class ImportUrlInput:
    url: str
    title: str | None = None
    series_id: str | None = None
    series_title: str | None = None
    tags: list[str] | None = None
    tag_ids: list[str] | None = None
    series_tags: list[str] | None = None
    is_starred: bool = False
    auto_generate_audio: bool = False
```

```python
job = create_url_import_job(
    self.db,
    course,
    json.dumps(
        {
            "url": payload.url,
            "auto_generate_audio": payload.auto_generate_audio,
        },
        ensure_ascii=False,
    ),
)
```

And pass the new field from the route:

```python
ImportUrlInput(
    url=payload.url,
    title=payload.title,
    series_id=payload.series_id,
    series_title=payload.series_title,
    tag_ids=payload.tag_ids or None,
    tags=direct_tags,
    series_tags=series_tags,
    is_starred=series_starred if series_starred is not None else False,
    auto_generate_audio=payload.auto_generate_audio,
)
```

- [ ] **Step 4: Re-run the backend tests**

Run the same pytest command again and expect both new tests to pass.

- [ ] **Step 5: Commit the backend contract change**

```bash
git add services/api/app/schemas/course.py services/api/app/api/routes/courses.py services/api/app/services/url_import_service.py services/api/tests/test_url_import_api.py services/api/tests/test_url_import_service.py
git commit -m "feat: add auto audio flag to url imports"
```

---

### Task 2: Add shared URL and share plumbing on mobile

**Files:**
- Modify: `apps/mobile/src/components/UrlImportBar.tsx`
- Create: `apps/mobile/src/lib/url.ts`
- Create: `apps/mobile/src/lib/share.ts`
- Modify: `apps/mobile/src/lib/api.ts`
- Modify: `apps/mobile/src/lib/i18n.ts`
- Modify: `apps/mobile/app.config.ts`
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/package-lock.json`
- Modify: `apps/mobile/tests/import-api.test.ts`
- Create: `apps/mobile/tests/share.test.ts`
- Modify: `apps/mobile/tests/url-import-bar.test.tsx`

**Interfaces:**
- Produces: `normalizeWebUrl(value: string): string | null` in `src/lib/url.ts`.
- Produces: `extractSharedUrl(...)`, `savePendingShare(...)`, `loadPendingShare(...)`, `clearPendingShare(...)`, `getPostLoginRedirect()`, and `resolveIncomingSharePath(...)` in `src/lib/share.ts`.
- Produces: `CreateUrlCoursePayload.autoGenerateAudio?: boolean` in `src/lib/api.ts`.
- Produces: `getShareCopy(locale)` in `src/lib/i18n.ts`.

- [ ] **Step 1: Write the failing mobile tests**

Add a helper test that proves the shared URL normalizer is the same rule used by the import bar:

```ts
expect(normalizeWebUrl("pagealong.app/article")).toBe("https://pagealong.app/article")
expect(normalizeWebUrl("  https://example.com/a  ")).toBe("https://example.com/a")
expect(normalizeWebUrl("mailto:test@example.com")).toBeNull()
```

Add share-helper coverage for the first valid URL and AsyncStorage round-trip:

```ts
expect(
  extractSharedUrl([
    { text: "not a link" },
    { text: "https://example.com/article" }
  ])
).toEqual({ url: "https://example.com/article" })

await savePendingShare({ url: "https://example.com/article" })
await expect(getPostLoginRedirect()).resolves.toBe("/share/receive")
```

Add an API client test that proves the mobile URL import request can ask for background audio generation:

```ts
await createUrlCourse({
  url: "https://example.com/a",
  title: "网页",
  seriesTitle: "网页课",
  autoGenerateAudio: true
})

expect(mockedFetch).toHaveBeenCalledWith(
  "http://10.0.2.2:8070/courses/import-url",
  expect.objectContaining({
    method: "POST",
    body: JSON.stringify({
      url: "https://example.com/a",
      title: "网页",
      series_title: "网页课",
      auto_generate_audio: true
    })
  })
)
```

- [ ] **Step 2: Run the failing mobile tests**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- share.test.ts import-api.test.ts url-import-bar.test.tsx
```

Expected: the new helper imports, the shared URL normalizer, and the `auto_generate_audio` request body do not exist yet.

- [ ] **Step 3: Install Expo Sharing and wire the shared helpers**

Install the native dependency and update the app config:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npx expo install expo-sharing
```

Then add the Android share support plugin to `app.config.ts`:

```ts
plugins: [
  "expo-router",
  [
    "expo-sharing",
    {
      android: {
        enabled: true,
        singleShareMimeTypes: ["text/plain", "text/uri-list"],
        multipleShareMimeTypes: ["text/plain", "text/uri-list"]
      }
    }
  ],
  "expo-secure-store",
  ...
]
```

Move the existing URL normalization rule out of `UrlImportBar.tsx` into `src/lib/url.ts`, then import it back into the bar and the share helper:

```ts
export function normalizeWebUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (!/^https?:$/.test(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
```

Create `src/lib/share.ts` with the pending-share helpers and the post-login redirect helper:

```ts
export type PendingShare = {
  url: string;
  title?: string;
};

export function extractSharedUrl(...): PendingShare | null;
export async function savePendingShare(share: PendingShare): Promise<void>;
export async function loadPendingShare(): Promise<PendingShare | null>;
export async function clearPendingShare(): Promise<void>;
export async function getPostLoginRedirect(): Promise<"/share/receive" | "/(tabs)/workbench">;
export function resolveIncomingSharePath(path: string): string;
```

Update `CreateUrlCoursePayload` and `createUrlCourse()` so the mobile client sends `auto_generate_audio` explicitly and keeps `createExtensionSyncCourse()` unchanged.

Add the new share-page copy in `src/lib/i18n.ts` instead of hardcoding strings in the screen.

- [ ] **Step 4: Re-run the mobile helper and API tests**

Run the same test command again and expect the URL helper, share helper, and URL import request assertions to pass.

- [ ] **Step 5: Commit the shared plumbing**

```bash
git add apps/mobile/src/components/UrlImportBar.tsx apps/mobile/src/lib/url.ts apps/mobile/src/lib/share.ts apps/mobile/src/lib/api.ts apps/mobile/src/lib/i18n.ts apps/mobile/app.config.ts apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/tests/import-api.test.ts apps/mobile/tests/share.test.ts apps/mobile/tests/url-import-bar.test.tsx
git commit -m "feat: add mobile share plumbing"
```

---

### Task 3: Add the native-intent redirect and the share receive page

**Files:**
- Create: `apps/mobile/app/+native-intent.ts`
- Create: `apps/mobile/app/share/receive.tsx`
- Modify: `apps/mobile/src/lib/share.ts` if the route helper needs a small follow-up adjustment
- Create: `apps/mobile/tests/native-intent.test.ts`
- Create: `apps/mobile/tests/share-receive.test.tsx`

**Interfaces:**
- Consumes: `resolveIncomingSharePath(path: string)` from `src/lib/share.ts`.
- Consumes: `extractSharedUrl(...)`, `loadPendingShare(...)`, `savePendingShare(...)`, `clearPendingShare(...)`, and `getPostLoginRedirect()` from `src/lib/share.ts`.
- Consumes: `createUrlCourse()` and `getCourse()` from `src/lib/api.ts`.
- Produces: a dedicated `/share/receive` route that imports the page and then replaces to `"/courses/[courseId]"`.

- [ ] **Step 1: Write the failing route and screen tests**

Add a native-intent test that proves Expo Sharing URLs are rewritten into the dedicated route:

```ts
expect(redirectSystemPath("exp://expo-sharing?something=1")).toBe("/share/receive")
expect(redirectSystemPath("/courses/abc")).toBe("/courses/abc")
```

Add a share-page test for the signed-in flow:

```tsx
jest.spyOn(api, "createUrlCourse").mockResolvedValueOnce({
  id: "course-1",
  title: "网页",
  status: "extracting_text",
  content_markdown: null,
  sentences: []
})
jest.spyOn(api, "getCourse")
  .mockResolvedValueOnce({
    id: "course-1",
    title: "网页",
    status: "extracting_text",
    content_markdown: null,
    sentences: []
  })
  .mockResolvedValueOnce({
    id: "course-1",
    title: "网页",
    status: "text_ready",
    content_markdown: "# Title",
    sentences: [{ index: 0, text: "第一句。", audio_start_seconds: null, audio_end_seconds: null }]
  })

render(<ShareReceiveScreen />)

await waitFor(() => {
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: "/courses/[courseId]",
    params: { courseId: "course-1" }
  })
})
```

Add a signed-out test that proves the page preserves the share and routes to login:

```tsx
jest.mock("@/lib/share", () => ({
  savePendingShare: jest.fn(),
  loadPendingShare: jest.fn(),
  clearPendingShare: jest.fn(),
  extractSharedUrl: jest.fn(() => ({ url: "https://example.com/article" }))
}))
```

Then assert:

```tsx
expect(savePendingShare).toHaveBeenCalledWith({ url: "https://example.com/article" })
expect(mockReplace).toHaveBeenCalledWith("/(auth)/login")
```

Add an invalid-share test that keeps the page in place and shows the localized error copy.

- [ ] **Step 2: Run the failing screen tests**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- native-intent.test.ts share-receive.test.tsx
```

Expected: the redirect file and the share page do not exist yet.

- [ ] **Step 3: Implement the native-intent shim and the share page**

Create a tiny `app/+native-intent.ts` wrapper that delegates all path decisions to `resolveIncomingSharePath()` and returns `/share/receive` when Expo Sharing opens the app.

Build `app/share/receive.tsx` around three states:

1. Resolve the incoming share payload or the pending share saved in AsyncStorage.
2. If the user is signed out, save the pending share and `router.replace("/(auth)/login")`.
3. If the user is signed in, call `createUrlCourse({ url, title, autoGenerateAudio: true })`, clear the shared payloads only after the import returns a `courseId`, then poll `getCourse(courseId)` until text is readable.

Keep the polling condition aligned with the spec and the existing reader:

```ts
const ready =
  course.content_markdown != null ||
  course.sentences.length > 0 ||
  course.status !== "extracting_text";
```

When `ready` becomes true, replace to the reader route:

```ts
router.replace({ pathname: "/courses/[courseId]", params: { courseId } });
```

If import fails, stay on the share page and allow retry. If polling times out, keep the page in a processing state and allow retrying the poll without re-sharing.

- [ ] **Step 4: Re-run the screen tests**

Run the same Jest command again and expect the native-intent redirect, login handoff, import/poll flow, and invalid-share state to pass.

- [ ] **Step 5: Commit the share entry flow**

```bash
git add apps/mobile/app/+native-intent.ts apps/mobile/app/share/receive.tsx apps/mobile/src/lib/share.ts apps/mobile/tests/native-intent.test.ts apps/mobile/tests/share-receive.test.tsx
git commit -m "feat: add android share receive flow"
```

---

### Task 4: Resume pending shares after sign-in

**Files:**
- Modify: `apps/mobile/app/(auth)/credentials.tsx`
- Modify: `apps/mobile/app/(auth)/register.tsx`
- Modify: `apps/mobile/tests/auth-login.test.tsx`
- Modify: `apps/mobile/tests/auth-register.test.tsx`

**Interfaces:**
- Consumes: `getPostLoginRedirect()` from `src/lib/share.ts`.
- Produces: a post-login redirect that goes to `/share/receive` when a pending share exists and to `/(tabs)/workbench` otherwise.

- [ ] **Step 1: Write the failing login-routing tests**

Mock the helper and prove the auth screens follow it after a successful sign-in:

```tsx
jest.mock("@/lib/share", () => ({
  getPostLoginRedirect: jest.fn()
}))

(getPostLoginRedirect as jest.Mock).mockResolvedValueOnce("/share/receive")
```

Then assert:

```tsx
expect(mockSignInWithToken).toHaveBeenCalledWith("login-token")
expect(mockReplace).toHaveBeenCalledWith("/share/receive")
```

Also keep the current workbench redirect test, but point it at the no-pending-share branch:

```tsx
(getPostLoginRedirect as jest.Mock).mockResolvedValueOnce("/(tabs)/workbench")
```

- [ ] **Step 2: Run the failing auth tests**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- auth-login.test.tsx auth-register.test.tsx
```

Expected: the sign-in screens still hardcode the workbench route.

- [ ] **Step 3: Swap the hardcoded workbench redirect for the shared helper**

Replace the current `router.replace("/(tabs)/workbench")` branch with:

```ts
const destination = await getPostLoginRedirect();
router.replace(destination);
```

Do this in both `credentials.tsx` and `register.tsx` so password login, email-code login, and register all resume the share flow the same way.

- [ ] **Step 4: Re-run the auth tests**

Run the same Jest command again and expect both the workbench path and the share-resume path to pass.

- [ ] **Step 5: Commit the post-login resume change**

```bash
git add apps/mobile/app/(auth)/credentials.tsx apps/mobile/app/(auth)/register.tsx apps/mobile/tests/auth-login.test.tsx apps/mobile/tests/auth-register.test.tsx
git commit -m "feat: resume pending share after login"
```

---

### Task 5: Verify the full Android share flow

**Files:**
- None. This is the final validation pass.

**Interfaces:**
- Consumes: all code from Tasks 1 to 4.
- Produces: a verified Android share flow that imports a URL, resumes after login, and navigates to the reader only after text is ready.

- [ ] **Step 1: Run the backend tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_url_import_api.py tests/test_url_import_service.py
```

- [ ] **Step 2: Run the mobile tests and typecheck**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- share.test.ts import-api.test.ts url-import-bar.test.tsx native-intent.test.ts share-receive.test.tsx auth-login.test.tsx auth-register.test.tsx
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm run typecheck
```

- [ ] **Step 3: Smoke test the Android share path**

Run the API and Metro side by side, then share a real web page from Chrome on an Android emulator or device:

```bash
cd /Users/jqsf/Desktop/code/web_reader && API_PORT=8070 make api
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npx expo start --android
```

Check the end-to-end behavior:

1. The share opens `/share/receive`.
2. Signed-out users preserve the share, sign in, and continue automatically.
3. The app lands on `/courses/[courseId]` only after text parsing is done.
4. Audio keeps generating in the background and the reader page does not wait for it.
