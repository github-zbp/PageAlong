jest.mock("@/lib/session-store", () => ({
  clearSessionToken: jest.fn(),
  getSessionToken: jest.fn(() => "session-token"),
  setSessionToken: jest.fn()
}));

jest.mock("@/lib/auth-storage", () => ({
  clearAuthToken: jest.fn()
}));

import {
  getCourse,
  getCourseSeries,
  requestCourseAudioGeneration,
  savePlaybackProgress,
  updateCourseLibrary
} from "@/lib/api";

const mockedFetch = jest.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

beforeEach(() => {
  mockedFetch.mockReset();
  (global as typeof globalThis & { fetch: typeof mockedFetch }).fetch = mockedFetch;
});

function courseResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: "course-1",
    title: "课程标题",
    source_type: "manual_text",
    status: "ready",
    word_count: 12,
    duration_seconds: 120,
    current_audio_url: "/courses/course-1/audio",
    last_playback_position_seconds: 18,
    library_type: "fragmented",
    series_id: null,
    series_title: null,
    tags: [],
    is_starred: false,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    last_read_at: null,
    content_markdown: "正文",
    source: null,
    sentences: [],
    sections: [],
    outline: [],
    ...overrides
  };
}

it("loads a course detail record", async () => {
  mockedFetch.mockResolvedValueOnce(jsonResponse(courseResponse()));

  const result = await getCourse("course-1");

  expect(result.title).toBe("课程标题");
  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/courses/course-1",
    expect.objectContaining({ cache: "no-store" })
  );
});

it("loads a series detail record with courses", async () => {
  mockedFetch.mockResolvedValueOnce(
    jsonResponse({
      id: "series-1",
      title: "系列标题",
      article_count: 2,
      tags: ["标签"],
      is_starred: false,
      updated_at: "2026-08-27T00:00:00.000Z",
      last_read_at: null,
      last_read_course_id: null,
      latest_course_id: "course-2",
      courses: [courseResponse({ id: "course-2", title: "第二课" })]
    })
  );

  const result = await getCourseSeries("series-1");

  expect(result.title).toBe("系列标题");
  expect(result.courses[0].title).toBe("第二课");
  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/courses/series/series-1",
    expect.objectContaining({ cache: "no-store" })
  );
});

it("requests course audio generation", async () => {
  mockedFetch.mockResolvedValueOnce(
    jsonResponse({
      id: "job-1",
      course_id: "course-1",
      job_type: "tts_generate",
      status: "pending",
      provider: "fake",
      fallback_provider: null,
      tier: null,
      progress_current: 0,
      progress_total: 4,
      result_resource_id: null,
      download_url: null,
      error_code: null,
      error_message: null,
      started_at: null,
      finished_at: null,
      created_at: "2026-08-27T00:00:00.000Z",
      updated_at: "2026-08-27T00:00:00.000Z"
    }, 202)
  );

  const result = await requestCourseAudioGeneration("course-1");

  expect(result.job_type).toBe("tts_generate");
  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/courses/course-1/audio-generation",
    expect.objectContaining({ method: "POST" })
  );
});

it("saves playback progress with integer seconds", async () => {
  mockedFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

  await savePlaybackProgress({ courseId: "course-1", positionSeconds: 12.8, sentenceIndex: 3 });

  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/courses/course-1/progress",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({
        position_seconds: 12,
        sentence_index: 3
      })
    })
  );
});

it("updates course library metadata", async () => {
  mockedFetch.mockResolvedValueOnce(jsonResponse(courseResponse({ is_starred: true })));

  await updateCourseLibrary({ courseId: "course-1", isStarred: true });

  const init = mockedFetch.mock.calls[0]?.[1];
  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/courses/course-1/library",
    expect.objectContaining({
      method: "PATCH"
    })
  );
  expect(init?.body).toBe(JSON.stringify({ is_starred: true }));
});
