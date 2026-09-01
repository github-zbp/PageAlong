jest.mock("@/lib/session-store", () => ({
  clearSessionToken: jest.fn(),
  getSessionToken: jest.fn(() => "session-token"),
  setSessionToken: jest.fn()
}));

jest.mock("@/lib/auth-storage", () => ({
  clearAuthToken: jest.fn()
}));

import {
  createExtensionSyncCourse,
  createFileImportBatch,
  createTextCourse,
  createUrlCourse,
  getFileImportBatch,
  getGenerationJob,
  listFileImportBatchesPage,
  listGenerationJobsPage,
  requestCourseDownload,
  retryFailedCourseJob,
  retryFileImportBatch
} from "@/lib/api";
import { getSessionToken } from "@/lib/session-store";

const mockedFetch = jest.fn();
const mockedGetSessionToken = getSessionToken as jest.MockedFunction<typeof getSessionToken>;

beforeAll(() => {
  if (typeof globalThis.Blob === "undefined") {
    (globalThis as typeof globalThis & { Blob: typeof Blob }).Blob = class Blob {} as typeof Blob;
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function courseFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "course-1",
    title: "课程",
    source_type: "manual_text",
    status: "ready",
    word_count: 12,
    duration_seconds: 0,
    current_audio_url: null,
    last_playback_position_seconds: 0,
    library_type: "fragmented",
    series_id: null,
    series_title: null,
    tags: [],
    is_starred: false,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    last_read_at: null,
    content_markdown: null,
    source: null,
    sentences: [],
    ...overrides
  };
}

function batchFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "batch-1",
    status: "pending",
    source_mode: "single_file",
    series_id: null,
    series_title: null,
    total_count: 1,
    success_count: 0,
    failed_count: 0,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    finished_at: null,
    items: [],
    ...overrides
  };
}

function jobFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    course_id: "course-1",
    target_type: "course",
    target_id: "course-1",
    target_label: "音频",
    job_type: "tts_generate",
    status: "running",
    progress_current: 1,
    progress_total: 4,
    result_resource_id: null,
    download_url: null,
    error_code: null,
    error_message: null,
    started_at: null,
    finished_at: null,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    ...overrides
  };
}

function pageFixture<T>(items: T[]) {
  return {
    items,
    pagination: {
      page: 2,
      page_size: 10,
      total: 12,
      total_pages: 2,
      has_previous: true,
      has_next: false
    }
  };
}

beforeEach(() => {
  mockedFetch.mockReset();
  (global as typeof globalThis & { fetch: typeof mockedFetch }).fetch = mockedFetch;
  mockedGetSessionToken.mockReturnValue("session-token");
});

it("creates text courses with manual-text source metadata", async () => {
  mockedFetch.mockResolvedValueOnce(jsonResponse(courseFixture({ id: "course-text", title: "剪藏" }), 201));

  const result = await createTextCourse({ title: "剪藏", text: "正文内容", seriesTitle: "学习资料" });

  expect(result.id).toBe("course-text");
  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/courses",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        title: "剪藏",
        text: "正文内容",
        source_type: "manual_text",
        series_title: "学习资料"
      })
    })
  );
});

it("submits URL imports to the backend import queue", async () => {
  mockedFetch.mockResolvedValueOnce(jsonResponse(courseFixture({ id: "course-url", source_type: "url" }), 201));

  await createUrlCourse({ url: "https://example.com/a", title: "网页", seriesTitle: "网页课" });

  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/courses/import-url",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/a",
        title: "网页",
        series_title: "网页课"
      })
    })
  );
});

it("can request background audio generation for URL imports", async () => {
  mockedFetch.mockResolvedValueOnce(jsonResponse(courseFixture({ id: "course-url", source_type: "url" }), 201));

  await createUrlCourse({
    url: "https://example.com/a",
    title: "网页",
    seriesTitle: "网页课",
    autoGenerateAudio: true
  });

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
  );
});

it("submits mobile URL import through extension sync metadata", async () => {
  mockedFetch.mockResolvedValueOnce(jsonResponse(courseFixture({ id: "course-sync", title: "网页" }), 201));

  await createExtensionSyncCourse({ url: "https://example.com/a", title: "网页" });

  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/courses/import-url/extension-sync",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/a",
        title: "网页",
        article_html: "",
        text_excerpt: "",
        images: [],
        client_metadata: {
          source: "mobile_web_entry"
        }
      })
    })
  );
});

it("uploads selected files as multipart form data", async () => {
  mockedFetch.mockResolvedValueOnce(jsonResponse(batchFixture(), 202));

  await createFileImportBatch({
    files: [{ uri: "file:///a.md", name: "a.md", type: "text/markdown", relativePath: "notes/a.md" }],
    sourceMode: "single_file",
    seriesTitle: "文件课"
  });

  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/courses/import-files",
    expect.objectContaining({ method: "POST", body: expect.any(FormData) })
  );
  const init = mockedFetch.mock.calls[0][1];
  expect(init.headers).toBeInstanceOf(Headers);
  expect((init.headers as Headers).get("Content-Type")).toBeNull();
  expect((init.headers as Headers).get("Authorization")).toBe("Bearer session-token");
});

it("loads paginated file batches and generation jobs", async () => {
  mockedFetch
    .mockResolvedValueOnce(jsonResponse(pageFixture([batchFixture()])))
    .mockResolvedValueOnce(jsonResponse(pageFixture([jobFixture()])));

  const batches = await listFileImportBatchesPage({ page: 2, pageSize: 10 });
  const jobs = await listGenerationJobsPage({ scope: "all", page: 2, pageSize: 10 });

  expect(batches.pagination.total).toBe(12);
  expect(jobs.items[0].id).toBe("job-1");
  expect(mockedFetch).toHaveBeenNthCalledWith(
    1,
    "http://10.0.2.2:8070/courses/file-import-batches?page=2&page_size=10",
    expect.objectContaining({ cache: "no-store" })
  );
  expect(mockedFetch).toHaveBeenNthCalledWith(
    2,
    "http://10.0.2.2:8070/jobs?scope=all&page=2&page_size=10",
    expect.objectContaining({ cache: "no-store" })
  );
});

it("loads task details and posts retry requests", async () => {
  mockedFetch
    .mockResolvedValueOnce(jsonResponse(batchFixture({ id: "batch-detail" })))
    .mockResolvedValueOnce(jsonResponse(jobFixture({ id: "job-detail" })))
    .mockResolvedValueOnce(jsonResponse(batchFixture({ id: "batch-detail", status: "running" }), 202))
    .mockResolvedValueOnce(jsonResponse(jobFixture({ id: "job-retry", status: "pending" }), 202));

  await getFileImportBatch("batch-detail");
  await getGenerationJob("job-detail");
  await retryFileImportBatch("batch-detail");
  await retryFailedCourseJob("course-1");

  expect(mockedFetch).toHaveBeenNthCalledWith(
    1,
    "http://10.0.2.2:8070/courses/file-import-batches/batch-detail",
    expect.objectContaining({ cache: "no-store" })
  );
  expect(mockedFetch).toHaveBeenNthCalledWith(
    2,
    "http://10.0.2.2:8070/jobs/job-detail",
    expect.objectContaining({ cache: "no-store" })
  );
  expect(mockedFetch).toHaveBeenNthCalledWith(
    3,
    "http://10.0.2.2:8070/courses/file-import-batches/batch-detail/retry",
    expect.objectContaining({ method: "POST" })
  );
  expect(mockedFetch).toHaveBeenNthCalledWith(
    4,
    "http://10.0.2.2:8070/courses/course-1/retry-failed-job",
    expect.objectContaining({ method: "POST" })
  );
});

it("requests course downloads by format", async () => {
  mockedFetch.mockResolvedValueOnce(
    jsonResponse({
      status: "ready",
      job_id: null,
      job_type: "course_export_pdf",
      resource_id: "resource-1",
      download_url: "/courses/course-1/exports/pdf",
      message: null
    })
  );

  const result = await requestCourseDownload("course-1", "pdf");

  expect(result.status).toBe("ready");
  expect(result.download_url).toBe("/courses/course-1/exports/pdf");
  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/courses/course-1/downloads/pdf",
    expect.objectContaining({ method: "POST" })
  );
});
