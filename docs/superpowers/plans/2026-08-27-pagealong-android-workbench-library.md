# PageAlong Android Workbench and Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Android workbench and course library screens with continue-learning, recent courses, course/series tabs, pagination, sorting, starring, delete, move-to-series, and multi-select actions.

**Architecture:** Reuse the existing course and series APIs, adding only a small server-side sort parameter so pagination remains correct across pages. The mobile app owns display density, bottom-sheet controls, optimistic local selection state, and row-level actions while the backend remains the source of truth for course metadata and series semantics.

**Tech Stack:** Expo Router, React Native, TypeScript, React Query, FastAPI, SQLAlchemy, pytest, @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-08-27-pagealong-android-app-design.md` (Spec 4: 工作台与课程库)

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

- Workbench default tab content: continue-learning card, recent course list, light statistics.
- Course library tabs: `"课程"` and `"系列课程"`.
- Infinite pagination via pull-to-refresh and scroll-to-load-more.
- Sort by created date, updated date, title, and starred.
- Compact rows, progress line, tags, more menu, star/delete/move-to-series.
- Long-press multi-select and bulk actions.

Out of scope:

- Search overlay and import top action; owned by Spec 3.
- Full reader route implementation; owned by Spec 5.
- Real offline downloads; owned by Spec 6.

## Design Direction

- Workbench and library should inherit the Cubox-style hierarchy: very large page title, low top chrome, tight section headers, compact rows, and bottom sheets for sort/more actions.
- Course rows should be the default list shape. Card treatment is reserved for the single continue-learning item and not repeated for every course.
- Progress indicators are thin horizontal bars, not large circular charts.
- Copy stays short: `"继续学习"`, `"最近阅读"`, `"课程"`, `"系列课程"`, `"从新到旧"`, `"转移至"`, `"已选择 3 项"`.

## File Structure

### Backend

- Modify `services/api/app/services/course_service.py`: add sort helpers for courses and series.
- Modify `services/api/app/api/routes/courses.py`: add `sort` query parameter to `GET /courses` and `GET /courses/series`.
- Modify `services/api/tests/test_course_library_api.py`: cover course and series sort behavior.

### Mobile

- Modify `apps/mobile/src/lib/api.ts`: add course/series list, update, delete, and pagination helpers.
- Create `apps/mobile/src/lib/library.ts`: sort constants, grouping helpers, and display format helpers.
- Create `apps/mobile/src/components/ProgressLine.tsx`: compact progress bar.
- Create `apps/mobile/src/components/CourseListRow.tsx`: course row with long-press selection and more action.
- Create `apps/mobile/src/components/CourseSeriesRow.tsx`: series row.
- Create `apps/mobile/src/components/LibrarySegmentedTabs.tsx`: `"课程"` / `"系列课程"` segmented control.
- Create `apps/mobile/src/components/LibrarySortSheet.tsx`: sort bottom sheet.
- Create `apps/mobile/src/components/LibraryMoreSheet.tsx`: row action bottom sheet.
- Create `apps/mobile/src/components/MultiSelectActionBar.tsx`: selected-count and bulk actions.
- Modify `apps/mobile/app/(tabs)/workbench.tsx`: real workbench content.
- Modify `apps/mobile/app/(tabs)/library.tsx`: real library content.
- Create `apps/mobile/tests/library-api.test.ts`: API helper tests.
- Create `apps/mobile/tests/workbench-screen.test.tsx`: workbench render tests.
- Create `apps/mobile/tests/library-screen.test.tsx`: library render/action tests.

## Mobile Test Fixture Notes

When a test snippet below calls `courseFixture`, `seriesFixture`, `pageOfCourses`, or `pageOfSeries`, define those helpers at the top of that same test file. They should return complete `CourseSummary`, `CourseSeries`, and `PaginatedList<T>` objects with sane defaults, then shallow-merge the overrides passed by each test.

---

### Task 1: Add server-side library sorting

**Files:**
- Modify: `services/api/app/services/course_service.py`
- Modify: `services/api/app/api/routes/courses.py`
- Test: `services/api/tests/test_course_library_api.py`

**Interfaces:**
- Consumes: existing `list_courses(...)` and `list_series(...)`.
- Produces: `sort` query values `"recent"`, `"created_at"`, `"updated_at"`, `"title"`, and `"starred"` for both course and series lists.

- [ ] **Step 1: Write failing backend tests**

Add course sort coverage:

```python
def test_courses_can_sort_by_title(client):
    client.post("/courses", json={"title": "B 课程", "source_type": "manual_text", "text": "正文"})
    client.post("/courses", json={"title": "A 课程", "source_type": "manual_text", "text": "正文"})

    response = client.get("/courses", params={"sort": "title"})

    assert response.status_code == 200
    assert [item["title"] for item in response.json()["items"]][:2] == ["A 课程", "B 课程"]
```

Add starred sort coverage:

```python
def test_courses_can_sort_starred_first(client):
    client.post("/courses", json={"title": "普通课程", "source_type": "manual_text", "text": "正文"})
    client.post(
        "/courses",
        json={"title": "星标课程", "source_type": "manual_text", "text": "正文", "is_starred": True},
    )

    response = client.get("/courses", params={"sort": "starred"})

    assert response.status_code == 200
    assert response.json()["items"][0]["title"] == "星标课程"
```

Add invalid sort coverage:

```python
def test_courses_reject_unknown_sort(client):
    response = client.get("/courses", params={"sort": "duration"})

    assert response.status_code == 422
    assert "sort" in response.json()["detail"]
```

- [ ] **Step 2: Run the failing backend tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_course_library_api.py -k "sort"
```

Expected: fail because `sort` is ignored.

- [ ] **Step 3: Implement sort helpers**

Add:

```python
SUPPORTED_LIBRARY_SORTS = {"recent", "created_at", "updated_at", "title", "starred"}
```

Implement:

```python
def sort_courses(courses: list[Course], sort: str = "recent") -> list[Course]:
    if sort == "created_at":
        return sorted(courses, key=lambda item: (item.created_at, item.id), reverse=True)
    if sort == "updated_at":
        return sorted(courses, key=lambda item: (item.updated_at, item.id), reverse=True)
    if sort == "title":
        return sorted(courses, key=lambda item: (item.title.lower(), item.id))
    if sort == "starred":
        return sorted(courses, key=lambda item: (course_is_starred(item), course_sort_value(item), item.id), reverse=True)
    return sorted(courses, key=course_sort_value, reverse=True)
```

Add a matching `sort_series(series_items, sort="recent")` using `series.is_starred`, `series.title.lower()`, `series.created_at`, `series.updated_at`, and existing `series_sort_value`.

- [ ] **Step 4: Thread sort through routes**

`get_courses(...)` and `get_course_series(...)` should validate:

```python
if sort not in {None, *SUPPORTED_LIBRARY_SORTS}:
    raise HTTPException(status_code=422, detail="sort must be recent, created_at, updated_at, title, or starred")
```

Then pass `sort=sort or "recent"` into `list_courses` / `list_series`.

- [ ] **Step 5: Re-run backend tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_course_library_api.py -k "sort"
```

Expected: pass.

- [ ] **Step 6: Commit backend sorting**

```bash
git add services/api/app/services/course_service.py services/api/app/api/routes/courses.py services/api/tests/test_course_library_api.py
git commit -m "feat: add library sort parameters"
```

---

### Task 2: Add mobile library API helpers

**Files:**
- Modify: `apps/mobile/src/lib/api.ts`
- Create: `apps/mobile/tests/library-api.test.ts`

**Interfaces:**
- Consumes: `GET /courses`, `GET /courses/series`, `PATCH /courses/{course_id}/library`, `DELETE /courses/{course_id}`, `PATCH /courses/series/{series_id}`, and `DELETE /courses/series/{series_id}`.
- Produces: `listCoursesPage`, `listCourseSeriesPage`, `updateCourseLibrary`, `deleteCourse`, `updateCourseSeries`, `deleteCourseSeries`.

- [ ] **Step 1: Write failing API tests**

```ts
it("loads courses with pagination and sort", async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      items: [],
      pagination: { page: 2, page_size: 20, total: 25, total_pages: 2, has_previous: true, has_next: false }
    })
  })) as jest.Mock;

  await listCoursesPage({ libraryType: "fragmented", sort: "created_at", page: 2, pageSize: 20 });

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/courses?library_type=fragmented&sort=created_at&page=2&page_size=20"),
    expect.any(Object)
  );
});
```

```ts
it("stars a course through the library endpoint", async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ id: "course-1", title: "课程", tags: [], is_starred: true })
  })) as jest.Mock;

  await updateCourseLibrary({ courseId: "course-1", isStarred: true });

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/courses/course-1/library"),
    expect.objectContaining({ method: "PATCH" })
  );
});
```

- [ ] **Step 2: Run the failing API tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- library-api.test.ts
```

Expected: fail because the helpers are missing.

- [ ] **Step 3: Implement API helpers**

Add:

```ts
export type LibrarySort = "recent" | "created_at" | "updated_at" | "title" | "starred";
```

Add list helpers using the same `PaginatedList<T>` type introduced in Spec 3:

```ts
export async function listCoursesPage(input: {
  libraryType?: "all" | "fragmented" | "series";
  query?: string;
  tag?: string;
  starred?: boolean;
  sort?: LibrarySort;
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedList<CourseSummary>> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  return apiJson<PaginatedList<CourseSummary>>(
    `/courses${queryString({
      library_type: input.libraryType,
      query: input.query,
      tag: input.tag,
      starred: input.starred,
      sort: input.sort,
      page,
      page_size: pageSize
    })}`,
    { cache: "no-store" },
    "Failed to load courses"
  );
}
```

Add mutation helpers for course/series star, move, and delete. Keep the property names in camelCase on the mobile side and snake_case in JSON payloads.

- [ ] **Step 4: Re-run API tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- library-api.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit mobile API helpers**

```bash
git add apps/mobile/src/lib/api.ts apps/mobile/tests/library-api.test.ts
git commit -m "feat: add mobile library api helpers"
```

---

### Task 3: Build the workbench screen

**Files:**
- Create: `apps/mobile/src/lib/library.ts`
- Create: `apps/mobile/src/components/ProgressLine.tsx`
- Create: `apps/mobile/src/components/CourseListRow.tsx`
- Modify: `apps/mobile/app/(tabs)/workbench.tsx`
- Create: `apps/mobile/tests/workbench-screen.test.tsx`

**Interfaces:**
- Consumes: `listCoursesPage({ sort: "recent", pageSize: 6 })`.
- Produces: a workbench screen with continue-learning and recent-reading sections.

- [ ] **Step 1: Write failing workbench test**

```tsx
it("renders continue learning before recent courses", async () => {
  jest.spyOn(api, "listCoursesPage").mockResolvedValueOnce({
    items: [
      courseFixture({ id: "a", title: "正在学习的课程", last_playback_position_seconds: 60, duration_seconds: 300 }),
      courseFixture({ id: "b", title: "最近阅读课程", last_playback_position_seconds: 0, duration_seconds: 200 })
    ],
    pagination: { page: 1, page_size: 6, total: 2, total_pages: 1, has_previous: false, has_next: false }
  });

  const screen = render(<WorkbenchScreen />);

  expect(await screen.findByText("继续学习")).toBeTruthy();
  expect(screen.getByText("正在学习的课程")).toBeTruthy();
  expect(screen.getByText("最近阅读")).toBeTruthy();
});
```

- [ ] **Step 2: Run the failing test**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- workbench-screen.test.tsx
```

Expected: fail because the screen is still a scaffold.

- [ ] **Step 3: Add display helpers**

`apps/mobile/src/lib/library.ts` should include:

```ts
export function courseProgress(course: Pick<CourseSummary, "duration_seconds" | "last_playback_position_seconds">): number {
  if (course.duration_seconds <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, course.last_playback_position_seconds / course.duration_seconds));
}
```

Add `formatCourseMeta(course)` that returns compact strings such as `"1,200 字 · 20 句"` and `formatUpdatedDate(value)`.

- [ ] **Step 4: Implement `ProgressLine` and `CourseListRow`**

`CourseListRow` must support:

- `selected?: boolean`
- `selectionMode?: boolean`
- `onPress(courseId)`
- `onLongPress(courseId)`
- `onMorePress(course)`
- `onToggleStar(course)`

Keep the row height stable and use a thin unread dot for unread/in-progress state.

- [ ] **Step 5: Implement the workbench screen**

Use `useQuery`:

```tsx
const coursesQuery = useQuery({
  queryKey: ["mobile", "workbench", "courses"],
  queryFn: () => listCoursesPage({ sort: "recent", pageSize: 6 })
});
```

Render:

- Continue-learning card from the first item with progress > 0; fall back to first item.
- Recent list from remaining items.
- Tiny stat line only after the main card, e.g. `"共 12 门课程"` if total is available.

- [ ] **Step 6: Re-run workbench test**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- workbench-screen.test.tsx
```

Expected: pass.

- [ ] **Step 7: Commit workbench**

```bash
git add apps/mobile/src/lib/library.ts apps/mobile/src/components/ProgressLine.tsx apps/mobile/src/components/CourseListRow.tsx apps/mobile/app/(tabs)/workbench.tsx apps/mobile/tests/workbench-screen.test.tsx
git commit -m "feat: build mobile workbench"
```

---

### Task 4: Build the library screen with pagination and sorting

**Files:**
- Create: `apps/mobile/src/components/CourseSeriesRow.tsx`
- Create: `apps/mobile/src/components/LibrarySegmentedTabs.tsx`
- Create: `apps/mobile/src/components/LibrarySortSheet.tsx`
- Modify: `apps/mobile/app/(tabs)/library.tsx`
- Create: `apps/mobile/tests/library-screen.test.tsx`

**Interfaces:**
- Consumes: `listCoursesPage(...)`, `listCourseSeriesPage(...)`, and `LibrarySort`.
- Produces: a library screen with course/series tabs, infinite loading, pull refresh, and bottom-sheet sort selection.

- [ ] **Step 1: Write failing library tests**

```tsx
it("switches between course and series columns", async () => {
  jest.spyOn(api, "listCoursesPage").mockResolvedValueOnce(pageOfCourses([courseFixture({ title: "碎片课程" })]));
  jest.spyOn(api, "listCourseSeriesPage").mockResolvedValueOnce(pageOfSeries([seriesFixture({ title: "系列课程" })]));

  const screen = render(<LibraryScreen />);

  expect(await screen.findByText("碎片课程")).toBeTruthy();
  fireEvent.press(screen.getByText("系列课程"));
  expect(await screen.findByText("系列课程")).toBeTruthy();
});
```

```tsx
it("opens the sort sheet and applies title sort", async () => {
  const listCoursesPage = jest.spyOn(api, "listCoursesPage").mockResolvedValue(pageOfCourses([]));
  const screen = render(<LibraryScreen />);

  fireEvent.press(await screen.findByLabelText("排序"));
  fireEvent.press(screen.getByText("按标题"));

  expect(listCoursesPage).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "title" }));
});
```

- [ ] **Step 2: Run the failing tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- library-screen.test.tsx
```

Expected: fail because the screen and components are missing.

- [ ] **Step 3: Implement tabs and sort sheet**

`LibrarySegmentedTabs` renders two equal-width buttons with selected state. `LibrarySortSheet` uses `BottomSheet` and these exact labels:

```ts
[
  ["recent", "最近阅读"],
  ["created_at", "按创建日期"],
  ["updated_at", "按更新日期"],
  ["title", "按标题"],
  ["starred", "按星标"]
]
```

- [ ] **Step 4: Implement list pagination**

Use `useInfiniteQuery` with `getNextPageParam` from `pagination.has_next`:

```tsx
getNextPageParam: (lastPage) => (lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined)
```

Use `FlatList` with:

- `onEndReachedThreshold={0.45}`
- `refreshing`
- `onRefresh`
- stable `keyExtractor`.

- [ ] **Step 5: Render compact course and series rows**

Course row:

- Title.
- Word/sentence meta.
- Thin progress line.
- Tags as small muted chips.
- Star state and more icon.

Series row:

- Title.
- Article count.
- Last-read/updated line.
- Star state and more icon.

- [ ] **Step 6: Re-run library tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- library-screen.test.tsx
```

Expected: pass.

- [ ] **Step 7: Commit library list**

```bash
git add apps/mobile/src/components/CourseSeriesRow.tsx apps/mobile/src/components/LibrarySegmentedTabs.tsx apps/mobile/src/components/LibrarySortSheet.tsx apps/mobile/app/(tabs)/library.tsx apps/mobile/tests/library-screen.test.tsx
git commit -m "feat: build mobile library lists"
```

---

### Task 5: Add row actions and multi-select

**Files:**
- Create: `apps/mobile/src/components/LibraryMoreSheet.tsx`
- Create: `apps/mobile/src/components/MultiSelectActionBar.tsx`
- Modify: `apps/mobile/app/(tabs)/library.tsx`
- Modify: `apps/mobile/tests/library-screen.test.tsx`

**Interfaces:**
- Consumes: `updateCourseLibrary`, `deleteCourse`, `updateCourseSeries`, `deleteCourseSeries`.
- Produces: row action bottom sheets, swipe-equivalent actions through explicit buttons, and long-press multi-select.

- [ ] **Step 1: Write failing action tests**

```tsx
it("stars a course from the row action sheet", async () => {
  jest.spyOn(api, "listCoursesPage").mockResolvedValue(pageOfCourses([courseFixture({ id: "course-1", title: "课程" })]));
  const update = jest.spyOn(api, "updateCourseLibrary").mockResolvedValue(courseFixture({ id: "course-1", is_starred: true }));
  const screen = render(<LibraryScreen />);

  fireEvent.press(await screen.findByLabelText("更多操作"));
  fireEvent.press(screen.getByText("星标"));

  expect(update).toHaveBeenCalledWith({ courseId: "course-1", isStarred: true });
});
```

```tsx
it("enters multi-select on long press", async () => {
  jest.spyOn(api, "listCoursesPage").mockResolvedValue(pageOfCourses([courseFixture({ id: "course-1", title: "课程" })]));
  const screen = render(<LibraryScreen />);

  fireEvent(screen.getByText("课程"), "longPress");

  expect(screen.getByText("已选择 1 项")).toBeTruthy();
});
```

- [ ] **Step 2: Run failing action tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- library-screen.test.tsx
```

Expected: fail because action sheets and selection do not exist.

- [ ] **Step 3: Implement `LibraryMoreSheet`**

Course actions:

- `"下载 PDF"`
- `"下载 Word"`
- `"下载 Markdown"`
- `"下载音频"`
- `"转移至"`
- `"星标"` or `"取消星标"`
- `"删除"`

Series actions:

- `"星标"` or `"取消星标"`
- `"清空课程"`
- `"删除系列"`

Download actions can call `requestCourseDownload` if already present from Spec 5/6; otherwise leave them disabled with label `"下载将在任务中心接入"` until Spec 6. Do not fake a successful download.

- [ ] **Step 4: Implement multi-select**

State:

```ts
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const selectionMode = selectedIds.size > 0;
```

Actions:

- Clear selection.
- Unstar selected via `Promise.all(selectedIds.map((id) => updateCourseLibrary({ courseId: id, isStarred: false })))`.
- Delete selected via `Promise.all(selectedIds.map(deleteCourse))`.
- Move selected to a typed series title using a bottom sheet.

- [ ] **Step 5: Re-run action tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- library-screen.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit actions**

```bash
git add apps/mobile/src/components/LibraryMoreSheet.tsx apps/mobile/src/components/MultiSelectActionBar.tsx apps/mobile/app/(tabs)/library.tsx apps/mobile/tests/library-screen.test.tsx
git commit -m "feat: add mobile library actions"
```

---

### Task 6: Verify workbench and library

**Files:**
- All files changed by Tasks 1-5.

- [ ] **Step 1: Run targeted backend tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_course_library_api.py -k "sort or pagination or library"
```

- [ ] **Step 2: Run targeted mobile tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- library-api.test.ts workbench-screen.test.tsx library-screen.test.tsx
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

- Workbench opens by default and the continue-learning card is above recent courses.
- Course library switches between courses and series without losing scroll state unexpectedly.
- Infinite load appends rows without reordering existing rows.
- Sort sheet appears from the bottom and changes backend query params.
- Long-press enters selection mode; clear, unstar, delete, and move actions update the list.
- Dark mode matches the Cubox reference direction: black base, large title, compact rows, restrained accents.

- [ ] **Step 5: Commit verification fixes if needed**

```bash
git status --short
git add <only-files-touched-for-this-plan>
git commit -m "fix: polish mobile library behavior"
```
