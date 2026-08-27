# Library, Series, and Job Pagination Design

Date: 2026-08-24

## Goal

Add page-based pagination to the course library list, series list, and download task list so each surface can render bounded result sets and move between pages without loading everything at once.

## Current Context

- `GET /courses` and `GET /courses/series` currently return full filtered arrays.
- `GET /jobs` currently returns a full filtered array of download tasks.
- `apps/web/src/app/[locale]/library/page.tsx`, `apps/web/src/components/SeriesManagementPage.tsx`, and `apps/web/src/app/[locale]/jobs/page.tsx` render those arrays directly.
- The course-detail generation-job history endpoint exists separately, but it is not a user-facing list page and is out of scope for this change.

## Confirmed Decisions

- Use common page pagination with 1-based `page` and `page_size`.
- Default `page_size` is 20.
- Backend maximum `page_size` is 100.
- The UI does not expose a page-size selector; it uses the fixed page size from the API contract.
- Pagination is applied after the existing filter and sort rules, so current list ordering stays the same.
- The response shape is `items` plus a `pagination` object.
- Frontend page state is page-local; changing filters resets back to page 1.
- Selection on paginated list pages is page-local and clears when the page changes.
- Do not add cursor pagination or infinite scroll.

## Scope

### In scope

- `/courses` course library list
- `/courses/series` series list
- `/jobs` download task list

### Out of scope

- `/courses/{course_id}/generation-jobs`
- search/indexing changes
- new list surfaces
- changing the existing import, playback, or download flows

## API Contract

Each paginated list endpoint returns:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 0,
    "total_pages": 1,
    "has_previous": false,
    "has_next": false
  }
}
```

Rules:

- `page` is 1-based.
- The endpoints accept `page` and `page_size` as query parameters.
- `page < 1` or `page_size < 1` returns 422.
- `page_size > 100` returns 422.
- Empty result sets still report `total_pages: 1` so the UI can stay on page 1.
- Requests past the end of the result set return an empty `items` array and the computed pagination metadata.

## Backend Design

Use a shared pagination helper over the already-filtered, already-sorted sequence for all three endpoints.

That keeps the current filter behavior intact:

- library filters: `library_type`, `query`, `tag`, `starred`
- series filters: `query`, `tag`, `starred`
- job filters: `scope`

The helper should:

- compute `total`
- compute `total_pages`
- slice the current page from the filtered list
- emit `has_previous` and `has_next`

The route layer should validate `page` and `page_size`, call the service helper, and return the new paginated response model.
The item payloads themselves stay unchanged; only the envelope around them changes.

## Frontend Design

Add one shared pagination control and use it on all three list pages.

- Library page: pager at the bottom of the list, filters reset to page 1, and selection clears when the page changes.
- Series page: same paging behavior, with page-local multi-select delete.
- Jobs page: same paging behavior, defaulting to the existing resource-job scope.

The control should show:

- current page
- total pages
- previous / next buttons
- nearby numbered pages, with first/last page links and ellipses when the range is truncated
- current result range or total count

## Error Handling

- Invalid page inputs return 422 from the API.
- Empty pages render the existing empty-state surfaces.
- If a destructive action makes the current page empty, the UI should step back to the nearest valid page and refetch.
- Load failures keep the current page and reuse the existing error banners.

## Testing

Backend tests will cover:

- first and second pages for course library results
- first and second pages for series results
- first and second pages for download tasks
- filtering combined with pagination
- invalid `page` and `page_size` values

Frontend tests will cover:

- library page pagination and filter reset
- series page pagination
- jobs page pagination
- selection clearing when page changes

## File Structure

- Add `services/api/app/schemas/pagination.py` for shared pagination metadata.
- Modify `services/api/app/schemas/course.py` and `services/api/app/schemas/job.py` to return paginated list envelopes.
- Modify `services/api/app/services/course_service.py` and `services/api/app/services/job_service.py` to slice filtered results and compute pagination metadata.
- Modify `services/api/app/api/routes/courses.py` and `services/api/app/api/routes/jobs.py` to accept `page` and `page_size`.
- Modify `apps/web/src/lib/types.ts` and `apps/web/src/lib/api.ts` to carry pagination metadata.
- Add a shared pagination UI component under `apps/web/src/components/`.
- Modify `apps/web/src/app/[locale]/library/page.tsx`, `apps/web/src/components/SeriesManagementPage.tsx`, and `apps/web/src/app/[locale]/jobs/page.tsx` to request pages and render controls.
- Update the Playwright and API tests for the three paginated lists.
