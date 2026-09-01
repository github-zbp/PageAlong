jest.mock("@/lib/session-store", () => ({
  clearSessionToken: jest.fn(),
  getSessionToken: jest.fn(() => "session-token")
}));

jest.mock("@/lib/auth-storage", () => ({
  clearAuthToken: jest.fn()
}));

import {
  deleteCourse,
  deleteCourseSeries,
  createCourseSeries,
  listCourseSeriesPage,
  listCoursesPage,
  updateCourseLibrary,
  updateCourseSeries
} from "@/lib/api";

const mockedFetch = jest.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

beforeEach(() => {
  mockedFetch.mockReset();
  (global as typeof globalThis & { fetch: typeof mockedFetch }).fetch = mockedFetch;
});

it("loads courses with pagination and sort", async () => {
  const course = {
    id: "course-1",
    title: "课程",
    source_type: "manual_text",
    status: "ready",
    word_count: 12,
    word_count_unit: "characters" as const,
    estimated_reading_seconds: 60,
    duration_seconds: 120,
    current_audio_url: null,
    last_playback_position_seconds: 0,
    library_type: "fragmented" as const,
    series_id: null,
    series_title: null,
    tags: [],
    is_starred: false,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    last_read_at: null,
    sentence_count: 0,
    import_status: null,
    import_error_code: null,
    import_error_message: null,
    current_generation_job_id: null,
    generation_status: null,
    generation_error_code: null,
    failed_reason: null
  };
  mockedFetch.mockResolvedValueOnce(
    jsonResponse({
      items: [course],
      pagination: { page: 2, page_size: 20, total: 25, total_pages: 2, has_previous: true, has_next: false }
    })
  );

  const result = await listCoursesPage({ libraryType: "fragmented", sort: "created_at", page: 2, pageSize: 20 });

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.stringContaining("/courses?library_type=fragmented&sort=created_at&page=2&page_size=20"),
    expect.any(Object)
  );
  expect(result.items[0]?.tags).toEqual([]);
  expect(result.items[0]?.last_read_at).toBeNull();
  expect(result.items[0]?.generation_status).toBeNull();
});

it("loads course series with pagination and sort", async () => {
  const pagination = { page: 2, page_size: 10, total: 11, total_pages: 2, has_previous: true, has_next: false };
  mockedFetch.mockResolvedValueOnce(jsonResponse({ items: [], pagination }));

  const result = await listCourseSeriesPage({ query: "读书", tag: "科技", starred: true, sort: "title", page: 2, pageSize: 10 });

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.stringContaining("/courses/series?query=%E8%AF%BB%E4%B9%A6&tag=%E7%A7%91%E6%8A%80&starred=true&sort=title&page=2&page_size=10"),
    expect.objectContaining({
      cache: "no-store",
      headers: expect.any(Headers)
    })
  );
  const requestInit = mockedFetch.mock.calls[0]?.[1] as RequestInit;
  expect((requestInit.headers as Headers).get("Authorization")).toBe("Bearer session-token");
  expect(result.pagination).toEqual(pagination);
});

it("stars a course through the library endpoint", async () => {
  mockedFetch.mockResolvedValueOnce(jsonResponse({ id: "course-1", title: "课程", tags: [], is_starred: true }));

  await updateCourseLibrary({ courseId: "course-1", isStarred: true });

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.stringContaining("/courses/course-1/library"),
    expect.objectContaining({ method: "PATCH", body: JSON.stringify({ is_starred: true }) })
  );
});

it("updates course series metadata with snake_case JSON", async () => {
  mockedFetch.mockResolvedValueOnce(jsonResponse({ id: "series-1", title: "系列", tags: [], is_starred: true }));

  await updateCourseSeries({ seriesId: "series-1", title: "系列", tags: ["科技"], isStarred: true });

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.stringContaining("/courses/series/series-1"),
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ title: "系列", tags: ["科技"], is_starred: true })
    })
  );
});

it("creates a course series with snake_case JSON", async () => {
  mockedFetch.mockResolvedValueOnce(
    jsonResponse({
      id: "series-1",
      title: "系列",
      article_count: 0,
      tags: [],
      is_starred: false,
      updated_at: "2026-08-27T00:00:00.000Z",
      last_read_at: null,
      last_read_course_id: null,
      latest_course_id: null
    })
  );

  await createCourseSeries({ title: "系列" });

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.stringContaining("/courses/series"),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ title: "系列" })
    })
  );
});

it("deletes a course", async () => {
  mockedFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

  await deleteCourse("course-1");

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.stringContaining("/courses/course-1"),
    expect.objectContaining({ method: "DELETE" })
  );
});

it("deletes a course series", async () => {
  mockedFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

  await deleteCourseSeries("series-1");

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.stringContaining("/courses/series/series-1"),
    expect.objectContaining({ method: "DELETE" })
  );
});
