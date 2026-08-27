import { expect, test } from "@playwright/test";

const apiHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};

const authToken = "library-page-token";
const authUser = {
  id: "user_1",
  email: "reader@example.com",
  role: "user",
  status: "active",
  email_verified_at: "2026-08-02T00:00:00",
  must_change_password_at_next_login: false,
  last_login_at: "2026-08-02T00:00:00",
  created_at: "2026-08-02T00:00:00"
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((token) => {
    window.localStorage.setItem("pagealong_auth_token", token);
  }, authToken);

  await page.route(/http:\/\/localhost:(8000|8070)\/auth\/me$/, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify(authUser) });
  });

  await page.route(/http:\/\/localhost:(8000|8070)\/auth\/me\/preferences$/, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({ theme_id: "newspaper", background_color: "white" })
    });
  });
});

test("library page supports multi-select move to series", async ({ page }) => {
  let moveCalls = 0;
  let courses = [
    {
      id: "course_1",
      title: "晨读一",
      source_type: "manual_text",
      status: "ready",
      word_count: 120,
      word_count_unit: "characters",
      estimated_reading_seconds: 300,
      duration_seconds: 300,
      current_audio_url: "https://media.pagealong.test/course_1.mp3",
      last_playback_position_seconds: 0,
      library_type: "fragmented",
      series_id: null,
      series_title: null,
      tags: [],
      is_starred: false,
      created_at: "2026-08-20T10:00:00Z",
      updated_at: "2026-08-20T10:00:00Z",
      last_read_at: null,
      sentence_count: 2,
      content_markdown: null,
      source: null,
      sentences: []
    },
    {
      id: "course_2",
      title: "晨读二",
      source_type: "manual_text",
      status: "ready",
      word_count: 90,
      word_count_unit: "characters",
      estimated_reading_seconds: 260,
      duration_seconds: 260,
      current_audio_url: "https://media.pagealong.test/course_2.mp3",
      last_playback_position_seconds: 0,
      library_type: "fragmented",
      series_id: null,
      series_title: null,
      tags: [],
      is_starred: true,
      created_at: "2026-08-20T10:00:00Z",
      updated_at: "2026-08-20T10:00:00Z",
      last_read_at: null,
      sentence_count: 2,
      content_markdown: null,
      source: null,
      sentences: []
    }
  ];

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    if (url.pathname === "/courses/tags") {
      await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ items: [] }) });
      return;
    }

    if (url.pathname === "/courses/series") {
      await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ items: [] }) });
      return;
    }

    if (request.method() === "GET") {
      const libraryType = url.searchParams.get("library_type");
      const items = libraryType === "fragmented" ? courses.filter((course) => course.library_type === "fragmented") : courses;
      await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ items }) });
      return;
    }

    if (request.method() === "PATCH" && url.pathname.endsWith("/library")) {
      moveCalls += 1;
      const payload = request.postDataJSON() as { library_type?: string; series_title?: string };
      courses = courses.map((course) =>
        course.id === url.pathname.split("/")[2]
          ? {
              ...course,
              library_type: payload.library_type ?? course.library_type,
              series_title: payload.series_title ?? course.series_title,
              series_id: payload.library_type === "series" ? "series_1" : course.series_id,
              updated_at: "2026-08-24T10:00:00Z"
            }
          : course
      );
      const updated = courses.find((course) => course.id === url.pathname.split("/")[2]);
      await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify(updated) });
      return;
    }

    await route.fulfill({ status: 404, headers: apiHeaders, body: JSON.stringify({ detail: "not found" }) });
  });

  await page.goto("/zh/library");

  await page.getByRole("checkbox", { name: "已选: 晨读一" }).click();
  await page.getByRole("checkbox", { name: "已选: 晨读二" }).click();
  await expect(page.getByText("已选 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "转移至" })).toBeVisible();
  await page.getByRole("button", { name: "转移至" }).click();
  await expect(page.getByRole("dialog", { name: "转移至" })).toBeVisible();

  const seriesDialog = page.getByRole("dialog", { name: "转移至" });
  await seriesDialog.getByRole("textbox").fill("晨读训练");
  await seriesDialog.getByRole("button", { name: "转移至" }).click();

  await expect.poll(() => moveCalls).toBe(2);
  await expect(page.getByRole("dialog", { name: "转移至" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "转移至" })).toHaveCount(0);
  await expect(page.getByText("没有课程")).toBeVisible();
});

test("library page paginates and resets to the first page when filters change", async ({ page }) => {
  const requestedPages: number[] = [];
  const courses = [
    {
      id: "course_a",
      title: "课程 A",
      source_type: "manual_text",
      status: "ready",
      word_count: 100,
      word_count_unit: "characters",
      estimated_reading_seconds: 240,
      duration_seconds: 240,
      current_audio_url: "https://media.pagealong.test/course_a.mp3",
      last_playback_position_seconds: 0,
      library_type: "fragmented",
      series_id: null,
      series_title: null,
      tags: [],
      is_starred: false,
      created_at: "2026-08-22T10:00:00Z",
      updated_at: "2026-08-22T10:00:00Z",
      last_read_at: null,
      sentence_count: 2,
      content_markdown: null,
      source: null,
      sentences: []
    },
    {
      id: "course_b",
      title: "课程 B",
      source_type: "manual_text",
      status: "ready",
      word_count: 110,
      word_count_unit: "characters",
      estimated_reading_seconds: 250,
      duration_seconds: 250,
      current_audio_url: "https://media.pagealong.test/course_b.mp3",
      last_playback_position_seconds: 0,
      library_type: "fragmented",
      series_id: null,
      series_title: null,
      tags: [],
      is_starred: false,
      created_at: "2026-08-23T10:00:00Z",
      updated_at: "2026-08-23T10:00:00Z",
      last_read_at: null,
      sentence_count: 2,
      content_markdown: null,
      source: null,
      sentences: []
    },
    {
      id: "course_c",
      title: "课程 C",
      source_type: "manual_text",
      status: "ready",
      word_count: 120,
      word_count_unit: "characters",
      estimated_reading_seconds: 260,
      duration_seconds: 260,
      current_audio_url: "https://media.pagealong.test/course_c.mp3",
      last_playback_position_seconds: 0,
      library_type: "fragmented",
      series_id: null,
      series_title: null,
      tags: [],
      is_starred: false,
      created_at: "2026-08-24T10:00:00Z",
      updated_at: "2026-08-24T10:00:00Z",
      last_read_at: null,
      sentence_count: 2,
      content_markdown: null,
      source: null,
      sentences: []
    }
  ];

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    if (url.pathname === "/courses/tags") {
      await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ items: [] }) });
      return;
    }

    if (request.method() === "GET") {
      const pageNumber = Number(url.searchParams.get("page") ?? "1");
      const filtered = (url.searchParams.get("query") ?? "").trim()
        ? courses.filter((course) => course.title.includes(url.searchParams.get("query") ?? ""))
        : courses;
      const sorted = [...filtered].sort((left, right) => right.updated_at.localeCompare(left.updated_at));
      const pageSize = 2;
      requestedPages.push(pageNumber);
      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const start = (pageNumber - 1) * pageSize;
      const items = sorted.slice(start, start + pageSize);
      await route.fulfill({
        status: 200,
        headers: apiHeaders,
        body: JSON.stringify({
          items,
          pagination: {
            page: pageNumber,
            page_size: pageSize,
            total,
            total_pages: totalPages,
            has_previous: pageNumber > 1,
            has_next: pageNumber < totalPages
          }
        })
      });
      return;
    }

    await route.fulfill({ status: 404, headers: apiHeaders, body: JSON.stringify({ detail: "not found" }) });
  });

  await page.goto("/zh/library");
  await expect(page.getByRole("link", { name: /课程 C/ })).toBeVisible();
  await page.getByRole("checkbox", { name: "已选: 课程 C" }).click();
  await expect(page.getByText("已选 1")).toBeVisible();

  await page.getByRole("button", { name: "2" }).click();
  await expect(page.getByRole("link", { name: /课程 A/ })).toBeVisible();
  await expect(page.getByText("已选 1")).toHaveCount(0);

  await page.goto("/zh/library?query=%E8%AF%BE%E7%A8%8B");
  await expect.poll(() => requestedPages.at(-1)).toBe(1);
  await expect(page.getByRole("link", { name: /课程 C/ })).toBeVisible();
});
