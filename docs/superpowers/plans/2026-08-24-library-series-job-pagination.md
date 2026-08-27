# Library, Series, and Job Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standard page-number pagination to the course library list, series list, and download task list without changing the existing course-detail generation-job history endpoint.

**Architecture:** The backend keeps the current filter/sort behavior, slices the filtered sequence with a shared pagination helper, and returns `items + pagination` envelopes for the three list surfaces. The web app gets page-aware helpers for those surfaces, while the existing all-items helpers stay as compatibility wrappers for the dashboard and series autocomplete. A shared pager component handles numbered pages, ellipses, and next/previous controls.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, Next.js 13, React 18, TypeScript, Playwright, pytest.

---

## Scope Check

- In scope: `/courses`, `/courses/series`, and `/jobs`.
- Out of scope: `/courses/{course_id}/generation-jobs`.
- Use 1-based page numbers with a fixed page size of 20 in the UI.
- Reject invalid `page` and `page_size` values with 422.
- Do not add cursor pagination, infinite scroll, or a page-size selector.
- Keep dashboard and series autocomplete behavior intact by preserving all-items compatibility helpers in `apps/web/src/lib/api.ts`.

## Known Workspace Constraints

- Preserve unrelated local edits if any exist.
- Keep the local API on port `8070` when running it manually.
- Do not touch generated archives or build outputs.

## File Structure

### Backend

- Create `services/api/app/schemas/pagination.py`: shared pagination metadata and generic list envelope.
- Create `services/api/app/services/pagination.py`: shared slice/metadata helper for already-filtered sequences.
- Modify `services/api/app/schemas/course.py`: paginate `CourseList` and `CourseSeriesList`; leave the course-detail generation-job list alone.
- Modify `services/api/app/schemas/job.py`: paginate the global jobs list.
- Modify `services/api/app/api/routes/courses.py`: accept `page` and `page_size` on `/courses` and `/courses/series`.
- Modify `services/api/app/api/routes/jobs.py`: accept `page` and `page_size` on `/jobs`.
- Modify `services/api/tests/test_course_library_api.py`: page metadata, filtering, and invalid parameter coverage.
- Modify `services/api/tests/test_jobs_api.py`: jobs pagination and invalid parameter coverage.

### Frontend

- Modify `apps/web/src/lib/types.ts`: add pagination metadata and paginated envelope types.
- Modify `apps/web/src/lib/api.ts`: add page-aware helpers and compatibility wrappers.
- Modify `apps/web/src/lib/i18n.ts`: add pager labels for Chinese and English.
- Create `apps/web/src/components/PaginationControls.tsx`: shared pager UI for the three list pages.
- Modify `apps/web/src/app/[locale]/library/page.tsx`: page state, pager, and page-local selection.
- Modify `apps/web/src/components/SeriesManagementPage.tsx`: page state, pager, and page-local selection.
- Modify `apps/web/src/app/[locale]/jobs/page.tsx`: page state, pager, and polling on the current page.
- Modify `apps/web/tests/library-page.spec.ts`: library pagination behavior.
- Modify `apps/web/tests/tag-series-management.spec.ts`: series pagination behavior.
- Modify `apps/web/tests/jobs-page.spec.ts`: jobs pagination behavior.

---

## Task 1: Backend Pagination Contract

**Files:**
- Create: `services/api/app/schemas/pagination.py`
- Create: `services/api/app/services/pagination.py`
- Modify: `services/api/app/schemas/course.py`
- Modify: `services/api/app/schemas/job.py`
- Modify: `services/api/app/api/routes/courses.py`
- Modify: `services/api/app/api/routes/jobs.py`
- Modify: `services/api/tests/test_course_library_api.py`
- Modify: `services/api/tests/test_jobs_api.py`

- [ ] **Step 1: Write the failing API tests**

Add coverage for the three paginated list endpoints and invalid inputs.

```python
def test_course_library_list_returns_pagination_metadata(client, monkeypatch):
    stub_audio_queue(monkeypatch)
    create_text_course(client, "课程 A", tags=["A"])
    create_text_course(client, "课程 B", tags=["B"])
    create_text_course(client, "课程 C", tags=["C"])

    first_page = client.get(
        "/courses",
        params={"library_type": "fragmented", "page": 1, "page_size": 2},
    )
    second_page = client.get(
        "/courses",
        params={"library_type": "fragmented", "page": 2, "page_size": 2},
    )

    assert first_page.status_code == 200
    assert first_page.json()["pagination"] == {
        "page": 1,
        "page_size": 2,
        "total": 3,
        "total_pages": 2,
        "has_previous": False,
        "has_next": True,
    }
    assert len(first_page.json()["items"]) == 2
    assert second_page.json()["pagination"]["page"] == 2
    assert len(second_page.json()["items"]) == 1
```

```python
def test_series_and_jobs_lists_reject_invalid_pagination(client, monkeypatch):
    stub_audio_queue(monkeypatch)
    create_text_course(client, "系列课程 A", series_title="系列 A")
    response = client.get("/courses/series", params={"page": 0})
    jobs_response = client.get("/jobs", params={"scope": "resource", "page_size": 101})

    assert response.status_code == 422
    assert jobs_response.status_code == 422
```

```python
def test_jobs_list_returns_empty_page_metadata(client, db_session, monkeypatch):
    course, _ = create_exportable_course(db_session)
    monkeypatch.setattr("app.services.job_service.enqueue_generation_job", lambda job_id: "queued-job-id")
    client.post(f"/courses/{course.id}/downloads/markdown")
    client.post(f"/courses/{course.id}/downloads/pdf")

    page = client.get("/jobs", params={"scope": "resource", "page": 3, "page_size": 1})

    assert page.status_code == 200
    assert page.json()["items"] == []
    assert page.json()["pagination"]["page"] == 3
    assert page.json()["pagination"]["total_pages"] == 2
```

- [ ] **Step 2: Run the targeted API tests and confirm they fail**

Run:

```bash
pytest services/api/tests/test_course_library_api.py services/api/tests/test_jobs_api.py -q
```

Expected: fail because the list endpoints still return only `items` and do not validate the new page contract yet.

- [ ] **Step 3: Implement the backend helper and response models**

Add a small shared pagination model layer and a slice helper.

```python
class PaginationRead(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
    has_previous: bool
    has_next: bool


class PaginatedList(BaseModel, Generic[T]):
    items: list[T]
    pagination: PaginationRead
```

```python
def paginate_sequence(items: Sequence[T], page: int, page_size: int) -> tuple[list[T], PaginationRead]:
    total = len(items)
    total_pages = max(1, math.ceil(total / page_size))
    start = (page - 1) * page_size
    end = start + page_size
    return list(items[start:end]), PaginationRead(
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
        has_previous=page > 1,
        has_next=page < total_pages,
    )
```

Then update the three routes to accept:

```python
page: int = Query(default=1, ge=1)
page_size: int = Query(default=20, ge=1, le=100)
```

Keep `/courses/{course_id}/generation-jobs` untouched so the out-of-scope endpoint still returns the current items-only shape.

- [ ] **Step 4: Run the targeted API tests again**

Run:

```bash
pytest services/api/tests/test_course_library_api.py services/api/tests/test_jobs_api.py -q
```

Expected: pass.

- [ ] **Step 5: Run the full backend suite and commit**

Run:

```bash
make test-api
```

Expected: pass.

Then commit:

```bash
git add services/api/app/schemas/pagination.py services/api/app/services/pagination.py services/api/app/schemas/course.py services/api/app/schemas/job.py services/api/app/api/routes/courses.py services/api/app/api/routes/jobs.py services/api/tests/test_course_library_api.py services/api/tests/test_jobs_api.py
git commit -m "feat: add backend list pagination"
```

---

## Task 2: Frontend Pagination Client and Shared Control

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/i18n.ts`
- Create: `apps/web/src/components/PaginationControls.tsx`
- Modify: `apps/web/tests/library-page.spec.ts`
- Modify: `apps/web/tests/tag-series-management.spec.ts`
- Modify: `apps/web/tests/jobs-page.spec.ts`

- [ ] **Step 1: Write the failing Playwright tests**

Add tests that expect page-aware requests and visible pager controls.

```ts
await page.route(/http:\/\/localhost:(8000|8070)\/courses(\?.*)?$/, async (route) => {
  const url = new URL(route.request().url());
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("page_size") ?? "20");
  const items = page === 1 ? firstPageItems : secondPageItems;

  await route.fulfill({
    status: 200,
    headers: apiHeaders,
    body: JSON.stringify({
      items,
      pagination: {
        page,
        page_size: pageSize,
        total: 3,
        total_pages: 2,
        has_previous: page > 1,
        has_next: page < 2
      }
    })
  });
});

await expect(page.getByRole("button", { name: "2" })).toBeVisible();
await page.getByRole("button", { name: "2" }).click();
await expect(page.getByRole("link", { name: /课程 C/ })).toBeVisible();
```

Add a second assertion on the library page that changes the search/filter state after paging and expects the next request to reset to `page=1`.

Add a series-page assertion that page changes clear the current selection.

Add a jobs-page assertion that the current page number changes in the request URL and the polling loop keeps using the current page.

- [ ] **Step 2: Run the targeted Playwright specs and confirm they fail**

Run:

```bash
cd apps/web && npx playwright test tests/library-page.spec.ts tests/tag-series-management.spec.ts tests/jobs-page.spec.ts
```

Expected: fail because the list pages still render plain arrays and do not expose a shared pager yet.

- [ ] **Step 3: Implement the frontend types, helpers, and pager**

Add a paginated envelope type and page-aware API helpers.

```ts
export type Pagination = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_previous: boolean;
  has_next: boolean;
};

export type PaginatedList<T> = {
  items: T[];
  pagination: Pagination;
};
```

Update `queryString` so it accepts numbers, then add:

- `listCoursesPage(...)`
- `listCourseSeriesPage(...)`
- `listGenerationJobsPage(...)`

Keep the existing `listCourses(...)` and `listCourseSeries(...)` helpers as compatibility wrappers that keep fetching pages until `pagination.has_next` is false, so the dashboard and series autocomplete still get full arrays.
Use `page_size=100` inside those wrappers so they converge quickly while still respecting the backend cap.

The shared pager component should:

- show previous/next buttons with icons
- show the current page and total pages
- show nearby numbered pages
- show first/last page buttons
- collapse the middle with ellipses when the page count is large
- render a range label from `pagination.page`, `pagination.page_size`, and `pagination.total`

Add `dictionary.pagination` entries in `apps/web/src/lib/i18n.ts` for the pager labels.

- [ ] **Step 4: Run typecheck and the targeted Playwright specs**

Run:

```bash
cd apps/web && npm run typecheck
cd apps/web && npx playwright test tests/library-page.spec.ts tests/tag-series-management.spec.ts tests/jobs-page.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/lib/i18n.ts apps/web/src/components/PaginationControls.tsx apps/web/tests/library-page.spec.ts apps/web/tests/tag-series-management.spec.ts apps/web/tests/jobs-page.spec.ts
git commit -m "feat: add paginated web client"
```

---

## Task 3: Wire the Three List Pages

**Files:**
- Modify: `apps/web/src/app/[locale]/library/page.tsx`
- Modify: `apps/web/src/components/SeriesManagementPage.tsx`
- Modify: `apps/web/src/app/[locale]/jobs/page.tsx`
- Modify: `apps/web/tests/library-page.spec.ts`
- Modify: `apps/web/tests/tag-series-management.spec.ts`
- Modify: `apps/web/tests/jobs-page.spec.ts`

- [ ] **Step 1: Strengthen the page behavior tests**

Extend the existing Playwright coverage so it proves the real page flows:

- library page: page 2 loads, then a filter change resets back to page 1, and page-local selection clears when the page changes
- series page: page 2 loads, selection clears on page change, and a create/delete flow snaps back to the nearest valid page when a page empties
- jobs page: next/previous paging works and the polling loop keeps the active page stable

Capture requested page numbers inside the route handler and assert on the last recorded value after each interaction.

```ts
const requestedPages: number[] = [];
await page.getByRole("button", { name: "2" }).click();
await page.getByPlaceholder("搜索课程").fill("通勤");
await expect.poll(() => requestedPages.at(-1)).toBe(1);
await expect(page.getByRole("checkbox", { name: /已选:/ })).toHaveCount(0);
```

- [ ] **Step 2: Implement the page-local state and fallback behavior**

Update the three page components to use the new page helpers.

Library page:

- add `page` state with a fixed page size of 20
- call `listCoursesPage(...)`
- clear selection and move-series state whenever the page or filters change
- after delete/move mutations, if the current page comes back empty and `pagination.page > 1`, set the page to `pagination.total_pages` and refetch
- render `PaginationControls` below the list

Series page:

- add `page` state with a fixed page size of 20
- call `listCourseSeriesPage(...)`
- clear selected series when the page or search query changes
- after create/delete/clear mutations, refresh the current page, and if the page is now out of range, jump to the nearest valid page
- render `PaginationControls` below the list

Jobs page:

- add `page` state with a fixed page size of 20
- call `listGenerationJobsPage({ scope: "resource", page })`
- keep the existing 5-second polling, but make it refetch the current page only
- clear `expandedJobId` when the page changes
- render `PaginationControls` below the list and above the empty-state links when there are multiple pages

Use `pagination.total_pages > 1` as the rule for showing the pager. Leave the existing empty-state cards in place when the result set is empty.

- [ ] **Step 3: Run the targeted frontend tests and the production build check**

Run:

```bash
cd apps/web && npx playwright test tests/library-page.spec.ts tests/tag-series-management.spec.ts tests/jobs-page.spec.ts
cd apps/web && npm run build
```

Expected: both pass.

- [ ] **Step 4: Run the full web test target and commit**

Run:

```bash
make test-web
```

Expected: pass.

Then commit:

```bash
git add apps/web/src/app/[locale]/library/page.tsx apps/web/src/components/SeriesManagementPage.tsx apps/web/src/app/[locale]/jobs/page.tsx apps/web/tests/library-page.spec.ts apps/web/tests/tag-series-management.spec.ts apps/web/tests/jobs-page.spec.ts
git commit -m "feat: wire paginated list pages"
```

---

## Final Verification

- Confirm the backend list endpoints return `pagination` metadata on the three in-scope routes.
- Confirm the course-detail generation-job history endpoint still returns the existing items-only shape.
- Confirm the dashboard and series autocomplete still receive full arrays through the compatibility helpers.
- Confirm the three paginated pages show page numbers, next/previous controls, and filter/page reset behavior.
