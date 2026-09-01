# PageAlong Android Shell and Global Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Android app shell entry points: default top bar, title-only search overlay, import entry route, bottom-tab integration, and global back behavior.

**Architecture:** Extend the existing `apps/mobile` shell instead of replacing it. Backend search gets one small query-scope addition so the app can honor the product requirement that global search only matches course titles; the mobile app then uses a shared `TopAppBar`/`AppFrame` contract with icon-first actions and a modal search surface.

**Tech Stack:** Expo Router, React Native, TypeScript, React Query, FastAPI, SQLAlchemy, pytest, @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-08-27-pagealong-android-app-design.md` (Spec 3: App 壳与全局入口)

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

- Default top bar with search on the left and import on the right.
- Search overlay that only searches course titles and opens the selected course.
- Import entry route scaffold; URL/text/file import internals are owned by Spec 6.
- Shared icon button, empty state, and bottom-sheet primitives needed by later specs.
- Back behavior for modal overlay, import route, and tab shell.

Out of scope:

- Login gating; owned by `2026-08-27-pagealong-android-auth-login.md`.
- Course library data views; owned by Spec 4.
- Reading/player screens; owned by Spec 5.
- Real import implementations and task center; owned by Spec 6.

## Design Direction

- Default app surface should feel closer to the Cubox screenshots than to the current Web console: dark mode uses a near-black page, large screen title, quiet icon controls, and compact grouped rows.
- Light mode must still be supported through the existing theme tokens, but every component added here must be visually checked in dark mode first.
- Use icon-only buttons for global search, import, close, clear, and back actions. Text appears inside rows and form fields, not inside global chrome.
- Search copy stays low-noise: `"搜索标题"` placeholder, `"没有找到相关课程"` empty state, no feature explanation.

## File Structure

### Backend

- Modify `services/api/app/services/course_service.py`: add title-only query matching while preserving default existing search behavior.
- Modify `services/api/app/api/routes/courses.py`: add `search_scope=title|all` to `GET /courses`.
- Modify `services/api/tests/test_course_library_api.py`: cover title-only search and invalid search scope.

### Mobile

- Modify `apps/mobile/src/lib/api.ts`: add `CourseSummary`, pagination types, and `searchCoursesByTitle`.
- Create `apps/mobile/src/components/IconButton.tsx`: reusable 44px icon-only pressable with accessibility label.
- Create `apps/mobile/src/components/EmptyState.tsx`: compact empty/error/loading surface.
- Create `apps/mobile/src/components/BottomSheet.tsx`: shared modal bottom sheet primitive.
- Modify `apps/mobile/src/components/TopAppBar.tsx`: support left/right icon actions and large-title mode.
- Modify `apps/mobile/src/components/AppFrame.tsx`: own the global search state and default import navigation action.
- Create `apps/mobile/src/components/GlobalSearchOverlay.tsx`: full-screen title search overlay.
- Create `apps/mobile/src/components/SearchResultRow.tsx`: compact course result row.
- Create `apps/mobile/app/import/index.tsx`: import entry placeholder route for Spec 6 to complete.
- Modify `apps/mobile/tests/app-frame.test.tsx`: cover global actions.
- Create `apps/mobile/tests/search-overlay.test.tsx`: cover search overlay behavior.
- Create `apps/mobile/tests/mobile-api.test.ts`: cover title-only search URL generation.

---

### Task 1: Add title-only course search on the backend

**Files:**
- Modify: `services/api/app/services/course_service.py`
- Modify: `services/api/app/api/routes/courses.py`
- Test: `services/api/tests/test_course_library_api.py`

**Interfaces:**
- Consumes: existing `GET /courses` list endpoint.
- Produces: `GET /courses?query=<value>&search_scope=title`, where `search_scope` defaults to `"all"` for Web compatibility.

- [ ] **Step 1: Write failing backend tests**

Add tests that prove title-only search does not match body sentence content:

```python
def test_course_title_search_does_not_match_sentence_text(client, db_session):
    first = client.post(
        "/courses",
        json={"title": "电池寿命研究", "source_type": "manual_text", "text": "这篇正文提到了芯片。"},
    ).json()
    client.post(
        "/courses",
        json={"title": "芯片访谈", "source_type": "manual_text", "text": "普通正文。"},
    )

    response = client.get("/courses", params={"query": "芯片", "search_scope": "title"})

    assert response.status_code == 200
    titles = [item["title"] for item in response.json()["items"]]
    assert titles == ["芯片访谈"]
    assert first["title"] not in titles
```

Add invalid-scope coverage:

```python
def test_course_search_rejects_unknown_search_scope(client):
    response = client.get("/courses", params={"query": "a", "search_scope": "body"})

    assert response.status_code == 422
    assert "search_scope" in response.json()["detail"]
```

- [ ] **Step 2: Run the failing backend tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_course_library_api.py -k "search_scope or title_search"
```

Expected: fail because `search_scope` is not implemented.

- [ ] **Step 3: Implement scoped query matching**

Change `course_matches_query` to accept a scope:

```python
def course_matches_query(course: Course, query: str | None, search_scope: str = "all") -> bool:
    normalized_query = (query or "").strip().lower()
    if not normalized_query:
        return True
    if search_scope == "title":
        return normalized_query in course.title.lower()
    sentence_text = " ".join(sentence.text for sentence in course.sentences)
    series_title = course.series.title if course.series is not None else ""
    return normalized_query in f"{course.title} {series_title} {sentence_text}".lower()
```

Thread `search_scope` through `list_courses(...)` and `get_courses(...)`. Keep the default `"all"` so Web behavior does not change:

```python
if search_scope not in {"all", "title"}:
    raise HTTPException(status_code=422, detail="search_scope must be all or title")
```

- [ ] **Step 4: Re-run the backend tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_course_library_api.py -k "search_scope or title_search"
```

Expected: pass.

- [ ] **Step 5: Commit the backend search contract**

```bash
git add services/api/app/services/course_service.py services/api/app/api/routes/courses.py services/api/tests/test_course_library_api.py
git commit -m "feat: add mobile title search scope"
```

---

### Task 2: Add shared mobile shell primitives

**Files:**
- Create: `apps/mobile/src/components/IconButton.tsx`
- Create: `apps/mobile/src/components/EmptyState.tsx`
- Create: `apps/mobile/src/components/BottomSheet.tsx`
- Modify: `apps/mobile/src/components/TopAppBar.tsx`
- Modify: `apps/mobile/tests/app-frame.test.tsx`

**Interfaces:**
- Consumes: `useTheme()` tokens from `apps/mobile/src/providers/ThemeProvider.tsx`.
- Produces: `IconButton`, `EmptyState`, `BottomSheet`, and a `TopAppBar` that supports `leftAction`, `rightAction`, `largeTitle`, and `subtitle`.

- [ ] **Step 1: Write failing component tests**

Extend `apps/mobile/tests/app-frame.test.tsx`:

```tsx
it("renders shell icon actions with accessible names", async () => {
  const left = jest.fn();
  const right = jest.fn();

  const screen = render(
    <TopAppBar
      title="工作台"
      leftAction={{ icon: "search", label: "搜索标题", onPress: left }}
      rightAction={{ icon: "plus", label: "导入", onPress: right }}
    />
  );

  screen.getByLabelText("搜索标题").props.onClick?.();
  screen.getByLabelText("导入").props.onClick?.();

  expect(screen.getByText("工作台")).toBeTruthy();
});
```

- [ ] **Step 2: Run the failing mobile test**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- app-frame.test.tsx
```

Expected: fail because the new props/components do not exist.

- [ ] **Step 3: Implement `IconButton`**

Create a 44x44 touch target:

```tsx
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";

export function IconButton({
  icon,
  label,
  onPress,
  muted = false
}: {
  icon: ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  muted?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        height: 44,
        justifyContent: "center",
        opacity: pressed ? 0.58 : 1,
        width: 44
      })}
    >
      <Feather name={icon} size={24} color={muted ? tokens.mutedText : tokens.text} />
    </Pressable>
  );
}
```

- [ ] **Step 4: Implement `EmptyState` and `BottomSheet`**

Use the existing theme tokens. `BottomSheet` must use React Native `Modal`, a dim overlay, a drag-handle pill, and `presentationStyle="overFullScreen"` so later menus are not clipped by scroll containers.

- [ ] **Step 5: Update `TopAppBar`**

Replace the single `rightAction` API with an action object while keeping backward compatibility if possible:

```tsx
type TopBarAction = {
  icon: TabIconName;
  label: string;
  onPress: () => void;
};
```

Render left action, large title, optional subtitle, and right action. Keep padding below the status bar from `useSafeAreaInsets()`.

- [ ] **Step 6: Re-run the mobile tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- app-frame.test.tsx
```

Expected: pass.

- [ ] **Step 7: Commit the shell primitives**

```bash
git add apps/mobile/src/components/IconButton.tsx apps/mobile/src/components/EmptyState.tsx apps/mobile/src/components/BottomSheet.tsx apps/mobile/src/components/TopAppBar.tsx apps/mobile/tests/app-frame.test.tsx
git commit -m "feat: add mobile shell primitives"
```

---

### Task 3: Add the global search overlay

**Files:**
- Modify: `apps/mobile/src/lib/api.ts`
- Create: `apps/mobile/src/components/GlobalSearchOverlay.tsx`
- Create: `apps/mobile/src/components/SearchResultRow.tsx`
- Create: `apps/mobile/tests/search-overlay.test.tsx`
- Create: `apps/mobile/tests/mobile-api.test.ts`

**Interfaces:**
- Consumes: backend `GET /courses?query=<value>&search_scope=title&page=1&page_size=20`.
- Produces: `searchCoursesByTitle(query: string): Promise<CourseSummary[]>`.

- [ ] **Step 1: Write failing API helper test**

Mock `global.fetch` and assert the URL includes title scope:

```ts
it("searches courses by title scope", async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ items: [], pagination: { page: 1, page_size: 20, total: 0, total_pages: 1, has_previous: false, has_next: false } })
  })) as jest.Mock;

  await searchCoursesByTitle("电池");

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/courses?query=%E7%94%B5%E6%B1%A0&search_scope=title"),
    expect.any(Object)
  );
});
```

- [ ] **Step 2: Write failing overlay behavior test**

```tsx
it("opens a selected course from search results", async () => {
  const onClose = jest.fn();
  const onOpenCourse = jest.fn();
  jest.spyOn(api, "searchCoursesByTitle").mockResolvedValueOnce([
    {
      id: "course-1",
      title: "为什么手机最后1%的电可以用很久？",
      source_type: "url",
      status: "ready",
      word_count: 1200,
      word_count_unit: "characters",
      estimated_reading_seconds: 360,
      duration_seconds: 420,
      current_audio_url: null,
      last_playback_position_seconds: 0,
      library_type: "fragmented",
      tags: [],
      is_starred: false,
      created_at: "2026-08-27T00:00:00",
      updated_at: "2026-08-27T00:00:00",
      sentence_count: 20
    }
  ]);

  const screen = render(<GlobalSearchOverlay visible onClose={onClose} onOpenCourse={onOpenCourse} />);

  fireEvent.changeText(screen.getByPlaceholderText("搜索标题"), "手机");
  expect(await screen.findByText("为什么手机最后1%的电可以用很久？")).toBeTruthy();
  fireEvent.press(screen.getByText("为什么手机最后1%的电可以用很久？"));

  expect(onOpenCourse).toHaveBeenCalledWith("course-1");
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the failing tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- mobile-api.test.ts search-overlay.test.tsx
```

Expected: fail because helpers and components do not exist.

- [ ] **Step 4: Implement API types and helper**

Add `Pagination`, `PaginatedList<T>`, and `CourseSummary` to `apps/mobile/src/lib/api.ts`. Add a local `queryString` helper and:

```ts
export async function searchCoursesByTitle(query: string): Promise<CourseSummary[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const response = await apiJson<PaginatedList<CourseSummary>>(
    `/courses${queryString({ query: trimmed, search_scope: "title", page: 1, page_size: 20 })}`,
    { cache: "no-store" },
    "Failed to search courses"
  );
  return response.items;
}
```

- [ ] **Step 5: Implement overlay UI**

`GlobalSearchOverlay` should:

- Open as a full-screen `Modal`.
- Place a search input at the top, with a close icon on the right.
- Debounce query changes by 250 ms.
- Show skeleton rows while loading.
- Show compact `SearchResultRow` items: title, status/progress meta, source/series line if available.
- Close on Android back via `Modal.onRequestClose`.

- [ ] **Step 6: Re-run overlay tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- mobile-api.test.ts search-overlay.test.tsx
```

Expected: pass.

- [ ] **Step 7: Commit global search**

```bash
git add apps/mobile/src/lib/api.ts apps/mobile/src/components/GlobalSearchOverlay.tsx apps/mobile/src/components/SearchResultRow.tsx apps/mobile/tests/search-overlay.test.tsx apps/mobile/tests/mobile-api.test.ts
git commit -m "feat: add mobile title search overlay"
```

---

### Task 4: Wire the app frame to search and import

**Files:**
- Modify: `apps/mobile/src/components/AppFrame.tsx`
- Modify: `apps/mobile/app/(tabs)/workbench.tsx`
- Modify: `apps/mobile/app/(tabs)/library.tsx`
- Modify: `apps/mobile/app/(tabs)/downloads.tsx`
- Create: `apps/mobile/app/import/index.tsx`
- Modify: `apps/mobile/tests/app-frame.test.tsx`

**Interfaces:**
- Consumes: `GlobalSearchOverlay`, `TopAppBar`, and Expo Router navigation.
- Produces: all default tab screens show the same search/import top actions.

- [ ] **Step 1: Write failing app-frame test**

```tsx
it("mounts the global search overlay from AppFrame", async () => {
  const screen = render(
    <AppFrame title="工作台">
      <></>
    </AppFrame>
  );

  fireEvent.press(screen.getByLabelText("搜索标题"));

  expect(screen.getByPlaceholderText("搜索标题")).toBeTruthy();
});
```

- [ ] **Step 2: Run the failing test**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- app-frame.test.tsx
```

Expected: fail because `AppFrame` does not own search state yet.

- [ ] **Step 3: Update `AppFrame`**

Add:

```tsx
const [searchVisible, setSearchVisible] = useState(false);
const router = useRouter();
```

Render:

```tsx
<TopAppBar
  title={title}
  subtitle={subtitle}
  largeTitle
  leftAction={{ icon: "search", label: "搜索标题", onPress: () => setSearchVisible(true) }}
  rightAction={{ icon: "plus", label: "导入", onPress: () => router.push("/import") }}
/>
<GlobalSearchOverlay
  visible={searchVisible}
  onClose={() => setSearchVisible(false)}
  onOpenCourse={(courseId) => router.push({ pathname: "/courses/[courseId]", params: { courseId } })}
/>
```

- [ ] **Step 4: Add the import placeholder route**

Create `apps/mobile/app/import/index.tsx` with an `AppFrame`-compatible full-screen route that says only `"导入"` and an empty-state message `"导入入口将在下一步接入"`. Spec 6 replaces this placeholder with the real URL/text/file import screen.

- [ ] **Step 5: Re-run tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- app-frame.test.tsx search-overlay.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit the frame wiring**

```bash
git add apps/mobile/src/components/AppFrame.tsx apps/mobile/app/(tabs)/workbench.tsx apps/mobile/app/(tabs)/library.tsx apps/mobile/app/(tabs)/downloads.tsx apps/mobile/app/import/index.tsx apps/mobile/tests/app-frame.test.tsx
git commit -m "feat: wire mobile search and import entry"
```

---

### Task 5: Verify the shell

**Files:**
- All files changed by Tasks 1-4.

- [ ] **Step 1: Run backend API tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_course_library_api.py -k "search_scope or title_search"
```

- [ ] **Step 2: Run mobile unit tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- app-frame.test.tsx search-overlay.test.tsx mobile-api.test.ts
```

- [ ] **Step 3: Run mobile typecheck**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm run typecheck
```

- [ ] **Step 4: Manual Android check**

Start local API on port 8070 and Expo Android:

```bash
API_PORT=8070 make api
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8070 npm run android
```

Check:

- Workbench, library, downloads, and me tabs show the same top search/import actions.
- Search overlay opens, closes with the close icon and Android back button, and only matches course titles.
- Import plus opens `/import`.
- Dark mode has large titles, black page background, compact search rows, and no visual overlap.

- [ ] **Step 5: Commit verification fixes if needed**

```bash
git status --short
git add <only-files-touched-for-this-plan>
git commit -m "fix: polish mobile shell entry behavior"
```
