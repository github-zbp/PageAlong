import { expect, test, type Page } from "@playwright/test";

type MockCourse = {
  id: string;
  title: string;
  source_type: string;
  status: string;
  word_count: number;
  word_count_unit: "characters" | "words";
  estimated_reading_seconds: number;
  duration_seconds: number;
  current_audio_url: string | null;
  last_playback_position_seconds: number;
  library_type: string;
  series_id: string | null;
  series_title: string | null;
  tags: string[];
  is_starred: boolean;
  created_at: string;
  updated_at: string;
  last_read_at: string | null;
  sentence_count: number;
  content_markdown: string | null;
  source: null | {
    source_kind?: string | null;
    locator?: string | null;
    canonical_locator?: string | null;
    final_url?: string | null;
    source_domain?: string | null;
    author?: string | null;
    published_at?: string | null;
  };
  import_status?: string | null;
  import_error_message?: string | null;
  generation_status?: string | null;
  generation_error_code?: string | null;
  failed_reason?: string | null;
  sentences: Array<{
    index: number;
    text: string;
    audio_start_seconds: number | null;
    audio_end_seconds: number | null;
  }>;
};

type MockCourseSeries = {
  id: string;
  title: string;
  article_count: number;
  tags: string[];
  is_starred: boolean;
  updated_at: string;
  last_read_at: string | null;
  last_read_course_id: string | null;
  latest_course_id: string | null;
};

const apiHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "Content-Disposition",
  "Content-Type": "application/json"
};

const authToken = "course-flow-token";
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
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    expect(request.headers().authorization).toBe(`Bearer ${authToken}`);
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify(authUser)
    });
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

function mockCourse(overrides: Partial<MockCourse>): MockCourse {
  const course = {
    id: "course_1",
    title: "测试课程",
    source_type: "manual_text",
    status: "text_ready",
    word_count: 4,
    word_count_unit: "characters",
    estimated_reading_seconds: 60,
    duration_seconds: 0,
    current_audio_url: null,
    last_playback_position_seconds: 0,
    library_type: "fragmented",
    series_id: null,
    series_title: null,
    tags: [],
    is_starred: false,
    created_at: "2026-07-10T10:00:00",
    updated_at: "2026-07-10T10:00:00",
    last_read_at: null,
    sentence_count: 0,
    content_markdown: null,
    source: null,
    sentences: [],
    ...overrides
  };
  return {
    ...course,
    sentence_count: overrides.sentence_count ?? course.sentences.length
  };
}

function mockReadyCourse(overrides: Partial<MockCourse> = {}): MockCourse {
  return mockCourse({
    id: "ready_1",
    title: "通勤听读",
    source_type: "manual_text",
    status: "ready",
    word_count: 18,
    duration_seconds: 42,
    current_audio_url: "https://media.pagealong.test/audio/ready_1.mp3",
    last_playback_position_seconds: 8,
    content_markdown: "# 通勤听读\n\n第一句。第二句。第三句。",
    source: {
      source_kind: "url",
      locator: "https://example.com/commute",
      canonical_locator: "https://example.com/commute",
      final_url: "https://example.com/commute",
      source_domain: "example.com",
      author: "PageAlong",
      published_at: "2026-07-10"
    },
    sentences: [
      {
        index: 0,
        text: "通勤听读",
        audio_start_seconds: 0,
        audio_end_seconds: 4
      },
      {
        index: 1,
        text: "第一句。",
        audio_start_seconds: 4,
        audio_end_seconds: 12
      },
      {
        index: 2,
        text: "第二句。",
        audio_start_seconds: 12,
        audio_end_seconds: 24
      },
      {
        index: 3,
        text: "第三句。",
        audio_start_seconds: 24,
        audio_end_seconds: 42
      }
    ],
    ...overrides
  });
}

async function routeReadyCourse(page: Page, course = mockReadyCourse()) {
  await page.route(/http:\/\/localhost:(8000|8070)\/courses\/ready_1(\/progress)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    if (url.pathname === "/courses/ready_1/progress" && request.method() === "PUT") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify(course) });
  });
}

async function routeSeriesWorkspace(page: Page, courses = [mockReadyCourse({ current_audio_url: "/courses/ready_1/audio" })]) {
  const series: MockCourseSeries = {
    id: "series_1",
    title: "精听训练",
    article_count: courses.length,
    tags: ["听读"],
    is_starred: false,
    updated_at: "2026-07-10T10:00:00",
    last_read_at: "2026-07-10T10:00:00",
    last_read_course_id: courses[0]?.id ?? null,
    latest_course_id: courses[0]?.id ?? null
  };
  const openedCourse = courses.find((course) => course.id === series.latest_course_id) ?? courses[0] ?? null;

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    if (url.pathname.endsWith("/progress") && request.method() === "PUT") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    if (url.pathname === "/courses/tags") {
      await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ items: ["听读"] }) });
      return;
    }

    if (url.pathname === "/courses/series") {
      await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ items: [series] }) });
      return;
    }

    if (url.pathname === "/courses/series/series_1") {
      await route.fulfill({
        status: 200,
        headers: apiHeaders,
        body: JSON.stringify({ ...series, courses })
      });
      return;
    }

    if (openedCourse !== null && url.pathname === `/courses/${openedCourse.id}` && request.method() === "GET") {
      await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify(openedCourse) });
      return;
    }

    if (openedCourse !== null && url.pathname === `/courses/${openedCourse.id}/audio` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        headers: {
          ...apiHeaders,
          "Content-Type": "audio/mpeg"
        },
        body: "audio-bytes"
      });
      return;
    }

    await route.fulfill({ status: 404, headers: apiHeaders, body: JSON.stringify({ detail: "not found" }) });
  });
}

test("user imports text from the localized console and sees it in the library", async ({ page }) => {
  const courses: MockCourse[] = [];

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/series|\/tags)?(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname === "/courses/tags") {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ items: [] }) });
      return;
    }

    if (url.pathname === "/courses/series") {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ items: [] }) });
      return;
    }

    if (url.pathname === "/courses" && request.method() === "GET") {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ items: courses }) });
      return;
    }

    const payload = request.postDataJSON() as { title: string; text: string; source_type: string };
    const course = mockCourse({
      id: "course_1",
      title: payload.title,
      source_type: payload.source_type,
      word_count: payload.text.length,
      sentences: [
        {
          index: 0,
          text: "第一句。",
          audio_start_seconds: null,
          audio_end_seconds: null
        }
      ]
    });
    courses.unshift(course);
    await route.fulfill({ status: 201, headers, body: JSON.stringify(course) });
  });

  await page.goto("/zh/import");

  await expect(page.getByRole("link", { name: "工作台" })).toBeVisible();
  await expect(page.getByText("我的课程")).toBeVisible();
  await expect(page.getByRole("link", { name: "课程库" })).toBeVisible();
  await expect(page.getByRole("link", { name: "课程导入" })).toBeVisible();
  await expect(page.locator("aside").getByRole("link", { name: "生成任务" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "粘贴文本" })).toBeVisible();
  await expect(page.getByRole("link", { name: "网页导入" })).toBeVisible();
  await expect(page.getByRole("link", { name: "文件上传" })).toBeVisible();
  await expect(page.getByRole("link", { name: "浏览器插件" })).toBeVisible();
  await page.getByRole("link", { name: "粘贴文本" }).click();
  await page.getByPlaceholder("课程标题").fill("通勤学习课程");
  await page.getByPlaceholder("粘贴文章、课程笔记或文档正文").fill("第一句。第二句。");
  await page.getByRole("button", { name: "创建课程" }).click();

  await expect(page).toHaveURL(/\/zh\/library$/);
  await expect(page.getByRole("link", { name: /通勤学习课程/ }).first()).toBeVisible();
  await expect(page.getByText("8 字").first()).toBeVisible();
});

test("reader detail uses the custom player and reader preferences", async ({ page }) => {
  await routeReadyCourse(page, mockReadyCourse({ estimated_reading_seconds: 120 }));

  await page.goto("/zh/courses/ready_1");

  await expect(page.locator("header").getByRole("heading", { name: "通勤听读" })).toBeVisible();
  await expect(page.getByText("18 字 · 4 句 · 约 2 分钟阅读")).toBeVisible();
  await expect(page.locator('[data-course-player="reading-dock"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "播放" })).toBeVisible();

  await page.getByRole("button", { name: "阅读偏好" }).click();
  await expect(page.getByRole("dialog", { name: "阅读偏好" })).toBeVisible();
  await page.getByRole("dialog", { name: "阅读偏好" }).getByRole("button", { name: "大字号" }).click();
  await expect(page.locator("[data-reader-preferences]")).toHaveAttribute("data-font-size", "large");
  await page.getByRole("dialog", { name: "阅读偏好" }).getByRole("button", { name: "关闭" }).click();
  await expect(page.getByRole("dialog", { name: "阅读偏好" })).toHaveCount(0);

  await page.getByRole("button", { name: "更多设置" }).click();
  await page.getByRole("menuitem", { name: "添加/删除标签" }).dispatchEvent("click");
  await expect(page.getByRole("dialog", { name: "添加/删除标签" })).toBeVisible();

  await page.reload();
  await expect(page.locator("[data-reader-preferences]")).toHaveAttribute("data-font-size", "large");
});

test("console shell sidebar can collapse and persist", async ({ page }) => {
  await routeReadyCourse(page);

  await page.goto("/zh/courses/ready_1");

  await expect(page.locator("aside")).toHaveAttribute("data-collapsed", "false");
  await page.getByRole("button", { name: "收起侧边栏" }).click();
  await expect(page.locator("aside")).toHaveAttribute("data-collapsed", "true");
  await expect(page.getByRole("button", { name: "展开侧边栏" })).toBeVisible();

  await page.reload();
  await expect(page.locator("aside")).toHaveAttribute("data-collapsed", "true");
});

test("course detail download menu queues the first request and links to tasks", async ({ page }) => {
  await routeReadyCourse(page);
  await page.route(/http:\/\/localhost:(8000|8070)\/courses\/ready_1\/downloads\/markdown$/, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        status: "pending",
        job_id: "job_markdown_1",
        job_type: "course_export_markdown",
        resource_id: null,
        download_url: null,
        message: "download_generation_queued"
      })
    });
  });

  await page.goto("/zh/courses/ready_1");
  await page.getByRole("button", { name: "更多设置" }).click();
  await page.getByRole("menuitem", { name: "下载为Markdown" }).dispatchEvent("click");

  await expect(page.getByText("文件已开始生成，可以到下载任务列表查看文件生成和下载进度。")).toBeVisible();
  await expect(page.getByRole("link", { name: "查看下载任务" }).first()).toHaveAttribute("href", "/zh/jobs");
});

test("course detail downloads content and audio files", async ({ page }) => {
  await routeReadyCourse(page);
  await page.route(/http:\/\/localhost:(8000|8070)\/courses\/ready_1\/downloads\/(markdown|audio)$/, async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    if (url.pathname.endsWith("/downloads/markdown")) {
      await route.fulfill({
        status: 200,
        headers: apiHeaders,
        body: JSON.stringify({
          status: "ready",
          job_id: null,
          job_type: "course_export_markdown",
          resource_id: "resource_markdown_1",
          download_url: "http://localhost:8070/courses/ready_1/exports/markdown",
          message: null
        })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        status: "ready",
        job_id: null,
        job_type: "tts_generate",
        resource_id: "resource_audio_1",
        download_url: "http://localhost:8070/courses/ready_1/audio-download",
        message: null
      })
    });
  });
  await page.route(/http:\/\/localhost:(8000|8070)\/courses\/ready_1\/exports\/markdown$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        ...apiHeaders,
        "Content-Disposition": "attachment; filename=\"commute.md\"",
        "Content-Type": "text/markdown; charset=utf-8"
      },
      body: "# 通勤听读\n\n第一句。"
    });
  });
  await page.route(/http:\/\/localhost:(8000|8070)\/courses\/ready_1\/audio-download$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        ...apiHeaders,
        "Content-Disposition": "attachment; filename=\"commute.mp3\"",
        "Content-Type": "audio/mpeg"
      },
      body: "audio-bytes"
    });
  });

  await page.goto("/zh/courses/ready_1");

  const markdownDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载为Markdown" }).click();
  expect((await markdownDownload).suggestedFilename()).toBe("commute.md");

  const audioDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载音频" }).click();
  expect((await audioDownload).suggestedFilename()).toBe("commute.mp3");
});

test("series courses navigate to the last-read course on desktop", async ({ page }) => {
  await routeSeriesWorkspace(page);

  await page.goto("/zh/series");
  await page.getByRole("article").filter({ hasText: "精听训练" }).getByRole("button", { name: "阅读" }).click();

  await expect(page).toHaveURL(/\/zh\/series\/series_1\/courses\/ready_1$/);
  await expect(page.locator("header h1").first()).toHaveText("通勤听读");
  await expect(page.locator("[data-reading-sidebar]")).toBeVisible();
  await expect(page.locator("[data-reading-sidebar]").getByRole("button", { name: "通勤听读" })).toBeVisible();
});

test("series courses navigate to the last-read course on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await routeSeriesWorkspace(page);

  await page.goto("/zh/series");
  await page.getByRole("article").filter({ hasText: "精听训练" }).getByRole("button", { name: "阅读" }).click();

  await expect(page).toHaveURL(/\/zh\/series\/series_1\/courses\/ready_1$/);
  await expect(page.locator("header h1").first()).toHaveText("通勤听读");
  await expect(page.locator("[data-reading-sidebar]")).toHaveCount(1);
});

test("series course detail reuses the course action menu", async ({ page }) => {
  await routeSeriesWorkspace(page);

  await page.goto("/zh/series");
  await page.getByRole("article").filter({ hasText: "精听训练" }).getByRole("button", { name: "阅读" }).click();

  await expect(page.getByRole("button", { name: "更多设置" })).toBeVisible();
  await page.getByRole("button", { name: "更多设置" }).click();
  await expect(page.getByRole("menuitem", { name: "添加/删除标签" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "转移至" })).toBeVisible();
});

test("user imports a public URL from the localized console", async ({ page }) => {
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };
  let urlCourse = mockCourse({
    id: "url_1",
    title: "正在提取网页",
    source_type: "url_import",
    status: "extracting_text",
    content_markdown: null,
    source: null
  });
  let audioRequested = false;

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname === "/courses/import-url") {
      const payload = request.postDataJSON() as { url: string };
      urlCourse = {
        ...urlCourse,
        source: {
          source_kind: "url",
          locator: payload.url,
          canonical_locator: payload.url,
          final_url: payload.url,
          source_domain: "example.com",
          author: null,
          published_at: null
        }
      };
      await route.fulfill({ status: 201, headers, body: JSON.stringify(urlCourse) });
      return;
    }

    if (url.pathname === "/courses/url_1" && request.method() === "GET") {
      urlCourse = {
        ...urlCourse,
        title: "网页标题",
        status: audioRequested ? "audio_generating" : "needs_review",
        word_count: 12,
        content_markdown: "# 网页标题\n\n![配图](https://media.pagealong.test/articles/url_1/images/hero.png)\n\n第一句。第二句。",
        sentences: [
          {
            index: 0,
            text: "网页标题",
            audio_start_seconds: null,
            audio_end_seconds: null
          },
          {
            index: 1,
            text: "第一句。",
            audio_start_seconds: null,
            audio_end_seconds: null
          },
          {
            index: 2,
            text: "第二句。",
            audio_start_seconds: null,
            audio_end_seconds: null
          }
        ]
      };
      await route.fulfill({ status: 200, headers, body: JSON.stringify(urlCourse) });
      return;
    }

    if (url.pathname === "/courses/url_1/audio-generation" && request.method() === "POST") {
      audioRequested = true;
      await route.fulfill({
        status: 202,
        headers,
        body: JSON.stringify({
          id: "job_audio_1",
          course_id: "url_1",
          job_type: "tts_generate",
          status: "pending"
        })
      });
      return;
    }

    await route.fulfill({
      status: 404,
      headers,
      body: JSON.stringify({ detail: "not found" })
    });
  });

  await page.goto("/zh/import");
  await page.getByRole("link", { name: "网页导入" }).click();
  await page.getByPlaceholder("粘贴公开网页 URL").fill("https://example.com/article");
  await page.getByRole("button", { name: "导入网页" }).click();

  await expect(page.getByRole("heading", { name: "确认生成内容" })).toBeVisible();
  await expect(page.getByRole("img", { name: "配图" })).toHaveAttribute(
    "src",
    "https://media.pagealong.test/articles/url_1/images/hero.png"
  );
  await expect(page.getByText("第一句。第二句。")).toBeVisible();
  await page.getByRole("button", { name: "确认并生成音频" }).click();

  await expect(page).toHaveURL(/\/zh\/courses\/url_1(?:\?autoplay=1)?$/);
  expect(audioRequested).toBe(true);
});

test("URL import resumes after leaving and returning to the import page", async ({ page }) => {
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };
  let detailRequests = 0;
  let urlCourse = mockCourse({
    id: "url_resume",
    title: "正在提取网页",
    source_type: "url_import",
    status: "extracting_text",
    content_markdown: null,
    source: null
  });

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname === "/courses/import-url") {
      await route.fulfill({ status: 201, headers, body: JSON.stringify(urlCourse) });
      return;
    }

    if (url.pathname === "/courses/url_resume" && request.method() === "GET") {
      detailRequests += 1;
      if (detailRequests >= 2) {
        urlCourse = {
          ...urlCourse,
          title: "恢复网页",
          status: "needs_review",
          import_status: "succeeded",
          word_count: 6,
          word_count_unit: "characters",
          estimated_reading_seconds: 60,
          content_markdown: "# 恢复网页\n\n第一句。第二句。",
          sentences: [
            { index: 0, text: "第一句。", audio_start_seconds: null, audio_end_seconds: null },
            { index: 1, text: "第二句。", audio_start_seconds: null, audio_end_seconds: null }
          ]
        };
      }
      await route.fulfill({ status: 200, headers, body: JSON.stringify(urlCourse) });
      return;
    }

    await route.fulfill({ status: 404, headers, body: JSON.stringify({ detail: "not found" }) });
  });

  await page.goto("/zh/import");
  await page.getByRole("link", { name: "网页导入" }).click();
  await page.getByPlaceholder("粘贴公开网页 URL").fill("https://example.com/resume");
  await page.getByRole("button", { name: "导入网页" }).click();
  await expect(page.getByText("正在抓取并清洗网页")).toBeVisible();

  await page.goto("/zh/import");
  await page.getByRole("link", { name: "网页导入" }).click();

  await expect(page.getByRole("heading", { name: "确认生成内容" })).toBeVisible();
  await expect(page.getByText("第一句。第二句。")).toBeVisible();
});

test("failed course detail can retry the failed generation stage", async ({ page }) => {
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };
  let retryRequested = false;
  let course = mockCourse({
    id: "failed_audio",
    title: "失败音频课程",
    status: "failed",
    failed_reason: "TTS timeout",
    generation_status: "failed",
    generation_error_code: "audio_generation_failed",
    sentences: [{ index: 0, text: "第一句。", audio_start_seconds: null, audio_end_seconds: null }]
  });

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname === "/courses/failed_audio/retry-failed-job" && request.method() === "POST") {
      retryRequested = true;
      course = { ...course, status: "audio_generating", failed_reason: null, generation_status: "pending" };
      await route.fulfill({
        status: 202,
        headers,
        body: JSON.stringify({
          id: "retry_audio_job",
          course_id: "failed_audio",
          job_type: "tts_generate",
          status: "pending"
        })
      });
      return;
    }

    if (url.pathname === "/courses/failed_audio" && request.method() === "GET") {
      await route.fulfill({ status: 200, headers, body: JSON.stringify(course) });
      return;
    }

    if (url.pathname === "/courses" && request.method() === "GET") {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ items: [course] }) });
      return;
    }

    await route.fulfill({ status: 404, headers, body: JSON.stringify({ detail: "not found" }) });
  });

  await page.goto("/zh/library");
  await page.getByRole("link", { name: /失败音频课程/ }).click();
  await expect(page).toHaveURL(/\/zh\/courses\/failed_audio(?:\?autoplay=1)?$/);
  await expect(page.getByText("TTS timeout")).toBeVisible();
  await page.getByRole("button", { name: "重试" }).click();

  expect(retryRequested).toBe(true);
  await expect(page.getByText("TTS timeout")).toHaveCount(0);
});

test("failed URL import can retry extraction from the import page", async ({ page }) => {
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };
  let retryRequested = false;
  let retryFinished = false;
  let course = mockCourse({
    id: "failed_url",
    title: "正在提取网页",
    source_type: "url_import",
    status: "extracting_text",
    import_status: "pending",
    content_markdown: null,
    source: null
  });

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname === "/courses/import-url") {
      await route.fulfill({ status: 201, headers, body: JSON.stringify(course) });
      return;
    }

    if (url.pathname === "/courses/failed_url/retry-failed-job" && request.method() === "POST") {
      retryRequested = true;
      course = { ...course, status: "extracting_text", import_status: "pending", import_error_message: null };
      await route.fulfill({
        status: 202,
        headers,
        body: JSON.stringify({
          id: "retry_import_job",
          course_id: "failed_url",
          job_type: "url_import",
          status: "pending"
        })
      });
      return;
    }

    if (url.pathname === "/courses/failed_url" && request.method() === "GET") {
      if (retryRequested) {
        if (retryFinished) {
          course = {
            ...course,
            title: "网页标题",
            status: "needs_review",
            import_status: "succeeded",
            import_error_message: null,
            word_count: 12,
            content_markdown: "# 网页标题\n\n第一句。",
            sentences: [{ index: 0, text: "第一句。", audio_start_seconds: null, audio_end_seconds: null }]
          };
        } else {
          retryFinished = true;
        }
      } else {
        course = {
          ...course,
          status: "failed",
          import_status: "failed",
          import_error_message: "Fetching URL failed"
        };
      }
      await route.fulfill({ status: 200, headers, body: JSON.stringify(course) });
      return;
    }

    await route.fulfill({ status: 404, headers, body: JSON.stringify({ detail: "not found" }) });
  });

  await page.goto("/zh/import");
  await page.getByRole("link", { name: "网页导入" }).click();
  await page.getByPlaceholder("粘贴公开网页 URL").fill("https://example.com/fails");
  await page.getByRole("button", { name: "导入网页" }).click();

  await expect(page.getByText("Fetching URL failed")).toBeVisible();
  await page.getByRole("button", { name: "重试" }).click();

  expect(retryRequested).toBe(true);
  await expect(page.getByRole("heading", { name: "确认生成内容" })).toBeVisible();
});

test("text import with a series name opens the series list", async ({ page }) => {
  const series: MockCourseSeries = {
    id: "series_1",
    title: "英语精听",
    article_count: 1,
    tags: [],
    is_starred: false,
    updated_at: "2026-07-10T10:00:00",
    last_read_at: null,
    latest_course_id: "course_1"
  };

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/series|\/tags)?(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    };

    if (url.pathname === "/courses/tags") {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ items: [] }) });
      return;
    }
    if (url.pathname === "/courses/series") {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ items: [series] }) });
      return;
    }
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (request.method() === "GET") {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ items: [] }) });
      return;
    }
    const payload = request.postDataJSON() as { title: string; text: string; series_title?: string };
    await route.fulfill({
      status: 201,
      headers,
      body: JSON.stringify(
        mockCourse({
          id: "course_1",
          title: payload.title,
          word_count: payload.text.length,
          library_type: "series",
          series_id: "series_1",
          series_title: payload.series_title ?? null
        })
      )
    });
  });

  await page.goto("/zh/import");
  await page.getByRole("link", { name: "粘贴文本" }).click();
  const textImportForm = page.locator("form").filter({ hasText: "创建课程" });
  await page.getByPlaceholder("课程标题").fill("英语第一课");
  await textImportForm.getByPlaceholder("系列名称（选填）").fill("英语精听");
  await page.getByPlaceholder("粘贴文章、课程笔记或文档正文").fill("第一句。");
  await page.getByRole("button", { name: "创建课程" }).click();

  await expect(page).toHaveURL(/\/zh\/series$/);
  await expect(page.getByRole("button", { name: "英语精听", exact: true })).toBeVisible();
});

test("english dashboard uses english navigation labels", async ({ page }) => {
  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/tags)?(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/courses/tags") {
      await route.fulfill({
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ items: [] })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ items: [] })
    });
  });

  await page.goto("/en/dashboard");

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("My courses")).toBeVisible();
  await expect(page.getByRole("link", { name: "Library", exact: true })).toBeVisible();
  await expect(page.locator("aside").getByRole("link", { name: "Course import", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
});

test("sidebar course search opens the library with a filtered list", async ({ page }) => {
  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const allCourses = [
      mockCourse({
        id: "course_1",
        title: "通勤学习课程",
        word_count: 8
      }),
      mockCourse({
        id: "course_2",
        title: "会议复盘",
        word_count: 4
      })
    ];
    const query = url.searchParams.get("query")?.toLowerCase() ?? "";
    const items = query
      ? allCourses.filter((course) => course.title.toLowerCase().includes(query))
      : allCourses;

    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ items })
    });
  });

  await page.goto("/zh/dashboard");
  await page.getByPlaceholder("搜索课程").fill("通勤");
  await page.getByPlaceholder("搜索课程").press("Enter");

  await expect(page).toHaveURL(/\/zh\/library\?query=/);
  await expect(page.getByRole("link", { name: /通勤学习课程/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /会议复盘/ })).toHaveCount(0);
});

test("console shell loads compiled Tailwind styles", async ({ page }) => {
  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ items: [] })
    });
  });

  await page.goto("/zh/dashboard");

  await expect(page.locator("aside").first()).toHaveCSS("background-color", "rgb(247, 247, 242)");
  await expect(page.getByRole("link", { name: "工作台", exact: true })).toHaveCSS(
    "background-color",
    "rgb(23, 23, 23)"
  );
});

test("dashboard course cards open the course detail route", async ({ page }) => {
  const course = mockCourse({
    id: "course_1",
    title: "继续学习课程",
    word_count: 8,
    last_playback_position_seconds: 12,
    sentences: [
      { index: 0, text: "继续一句。", audio_start_seconds: null, audio_end_seconds: null }
    ]
  });

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/courses/course_1") {
      await route.fulfill({
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(course)
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: [course]
      })
    });
  });

  await page.goto("/zh/dashboard");
  await page.getByRole("link", { name: /继续学习课程/ }).first().click();

  await expect(page).toHaveURL(/\/zh\/courses\/course_1(?:\?autoplay=1)?$/);
  await expect(page.getByRole("heading", { name: "继续学习课程" })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/zh\/courses\/course_1(?:\?autoplay=1)?$/);
  await expect(page.getByRole("heading", { name: "继续学习课程" })).toBeVisible();
});

test("course detail does not auto-play audio on page load", async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __playCalls?: number }).__playCalls = 0;
    HTMLMediaElement.prototype.play = function (...args) {
      (window as Window & { __playCalls?: number }).__playCalls =
        ((window as Window & { __playCalls?: number }).__playCalls ?? 0) + 1;
      return Promise.resolve();
    };
  });

  await page.route(/http:\/\/localhost:(8000|8070)\/courses\/ready_1\/audio$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        ...apiHeaders,
        "Content-Type": "audio/mpeg"
      },
      body: "audio-bytes"
    });
  });

  await routeReadyCourse(
    page,
    mockReadyCourse({
      current_audio_url: "/courses/ready_1/audio"
    })
  );

  await page.goto("/zh/courses/ready_1");
  await expect(page.getByRole("button", { name: "播放" })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => (window as Window & { __playCalls?: number }).__playCalls ?? 0)).toBe(0);
});

test("library courses open the course detail route", async ({ page }) => {
  const fragmentedCourses = [
    mockCourse({
      id: "frag_1",
      title: "通勤碎片",
      word_count: 8,
      last_playback_position_seconds: 18,
      tags: ["通勤"],
      content_markdown: "# 通勤碎片\n\n第一句。第二句。",
      sentences: [
        { index: 0, text: "第一句。", audio_start_seconds: 0, audio_end_seconds: 10 },
        { index: 1, text: "第二句。", audio_start_seconds: 10, audio_end_seconds: 30 }
      ]
    }),
    mockCourse({
      id: "frag_2",
      title: "会议复盘",
      word_count: 4,
      last_playback_position_seconds: 0,
      tags: ["工作"],
      content_markdown: "# 会议复盘\n\n复盘一句。复盘二句。",
      sentences: [
        { index: 0, text: "复盘一句。", audio_start_seconds: 0, audio_end_seconds: 10 },
        { index: 1, text: "复盘二句。", audio_start_seconds: 10, audio_end_seconds: 30 }
      ]
    })
  ];

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/courses/tags") {
      await route.fulfill({
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ items: ["工作", "通勤"] })
      });
      return;
    }
    if (url.pathname === "/courses/frag_1") {
      await route.fulfill({
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify(fragmentedCourses[0])
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ items: fragmentedCourses })
    });
  });

  await page.goto("/zh/library");
  await page.getByRole("link", { name: /通勤碎片/ }).click();

  await expect(page).toHaveURL(/\/zh\/courses\/frag_1(?:\?autoplay=1)?$/);
  await expect(page.locator("header").getByRole("heading", { name: "通勤碎片" })).toBeVisible();
  await expect(page.locator("[data-sentence-index='1']")).toContainText("第二句。");
  await expect(page.locator("[data-sentence-index='1']")).toHaveClass(/pa-sentence-active/);
  await page.reload();
  await expect(page).toHaveURL(/\/zh\/courses\/frag_1(?:\?autoplay=1)?$/);
  await expect(page.locator("header").getByRole("heading", { name: "通勤碎片" })).toBeVisible();
});

test("text-ready courses request audio on play and auto-play when ready", async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __playCalls?: number }).__playCalls = 0;
    HTMLMediaElement.prototype.play = function (...args) {
      (window as Window & { __playCalls?: number }).__playCalls =
        ((window as Window & { __playCalls?: number }).__playCalls ?? 0) + 1;
      return Promise.resolve();
    };
  });

  let generationRequested = false;
  let detailRequests = 0;
  let course = mockCourse({
    id: "text_ready_1",
    title: "等待生成课程",
    source_type: "file_upload",
    status: "text_ready",
    content_markdown: "# 等待生成课程\n\n第一句。第二句。",
    sentences: [
      { index: 0, text: "等待生成课程", audio_start_seconds: null, audio_end_seconds: null },
      { index: 1, text: "第一句。", audio_start_seconds: null, audio_end_seconds: null },
      { index: 2, text: "第二句。", audio_start_seconds: null, audio_end_seconds: null }
    ]
  });

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    if (url.pathname === "/courses/text_ready_1/audio-generation" && request.method() === "POST") {
      generationRequested = true;
      await route.fulfill({
        status: 202,
        headers: apiHeaders,
        body: JSON.stringify({
          id: "job_text_ready_1",
          course_id: "text_ready_1",
          job_type: "tts_generate",
          status: "pending"
        })
      });
      return;
    }

    if (url.pathname === "/courses/text_ready_1/audio" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        headers: {
          ...apiHeaders,
          "Content-Type": "audio/mpeg"
        },
        body: "audio-bytes"
      });
      return;
    }

    if (url.pathname === "/courses/text_ready_1" && request.method() === "GET") {
      detailRequests += 1;
      if (generationRequested && detailRequests >= 2) {
        course = {
          ...course,
          status: "ready",
          current_audio_url: "/courses/text_ready_1/audio",
          duration_seconds: 48
        };
      } else if (generationRequested) {
        course = {
          ...course,
          status: "audio_generating",
          current_audio_url: null
        };
      }
      await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify(course) });
      return;
    }

    await route.fulfill({ status: 404, headers: apiHeaders, body: JSON.stringify({ detail: "not found" }) });
  });

  await page.goto("/zh/courses/text_ready_1");
  await expect(page.getByRole("button", { name: "播放" })).toBeVisible();
  await page.getByRole("button", { name: "播放" }).click();

  await expect(page.getByRole("button", { name: "生成中" })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => (window as Window & { __playCalls?: number }).__playCalls ?? 0)).toBe(1);
  expect(generationRequested).toBe(true);
});

test("library course cards expose download actions", async ({ page }) => {
  const course = mockReadyCourse({
    id: "downloadable",
    title: "可下载课程",
    word_count: 6,
    content_markdown: "# 可下载课程\n\n第一句。"
  });

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/courses/tags") {
      await route.fulfill({
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ items: [course] })
    });
  });

  await page.goto("/zh/library");

  await page.getByRole("button", { name: "更多操作: 可下载课程" }).click();
  await expect(page.getByRole("menuitem", { name: "下载为Markdown" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "下载为Word" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "下载为PDF" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "下载音频" })).toBeVisible();
});

test("series courses open the latest article in the course URL", async ({ page }) => {
  const series: MockCourseSeries = {
    id: "series_1",
    title: "英语精听",
    article_count: 2,
    tags: ["英语"],
    is_starred: true,
    updated_at: "2026-07-10T10:00:00",
    last_read_at: null,
    latest_course_id: "series_course_1"
  };
  const seriesCourses = [
    mockCourse({
      id: "series_course_1",
      title: "英语第一课",
      library_type: "series",
      series_id: "series_1",
      series_title: "英语精听",
      current_audio_url: "/courses/series_course_1/audio",
      tags: ["英语"],
      sentences: [
        { index: 0, text: "Listen first.", audio_start_seconds: null, audio_end_seconds: null }
      ]
    }),
    mockCourse({
      id: "series_course_2",
      title: "英语第二课",
      library_type: "series",
      series_id: "series_1",
      series_title: "英语精听",
      current_audio_url: "/courses/series_course_2/audio",
      tags: ["英语"],
      sentences: [
        { index: 0, text: "Listen again.", audio_start_seconds: null, audio_end_seconds: null }
      ]
    })
  ];

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/courses/series/series_1") {
      await route.fulfill({
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ ...series, courses: seriesCourses })
      });
      return;
    }
    if (url.pathname === "/courses/series_course_1") {
      await route.fulfill({
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify(seriesCourses[0])
      });
      return;
    }
    if (url.pathname === "/courses/series_course_1/audio") {
      await route.fulfill({
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "audio/mpeg" },
        body: "audio-bytes"
      });
      return;
    }
    if (url.pathname === "/courses/series") {
      await route.fulfill({
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ items: [series] })
      });
      return;
    }
    if (url.pathname === "/courses/tags") {
      await route.fulfill({
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ items: ["英语"] })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] })
    });
  });

  await page.goto("/zh/series");
  await expect(page.getByText("更新")).toBeVisible();
  await expect(page.getByText("未阅读")).toBeVisible();
  await page.getByRole("article").filter({ hasText: "英语精听" }).getByRole("button", { name: "阅读" }).click();

  await expect(page).toHaveURL(/\/zh\/series\/series_1\/courses\/series_course_1$/);
  await expect(page.getByRole("heading", { name: "英语第一课" })).toBeVisible();
});

test("course detail uses markdown body for sentence highlighting and custom reading dock", async ({ page }) => {
  const course = mockCourse({
    id: "course_md",
    title: "Markdown 课程",
    status: "ready",
    current_audio_url: "/courses/course_md/audio",
    content_markdown: "# 一级标题\n\n**重点**第一句。第二句。\n\n* **列表重点**。\n* 要点二。\n\n```js\nalert('x')\n```",
    source: {
      source_kind: "url",
      locator: "https://example.com/article",
      canonical_locator: "https://example.com/article",
      final_url: "https://example.com/article",
      source_domain: "example.com",
      author: null,
      published_at: null
    },
    sentences: [
      { index: 0, text: "一级标题", audio_start_seconds: 0, audio_end_seconds: 2 },
      { index: 1, text: "重点第一句。", audio_start_seconds: 2, audio_end_seconds: 5 },
      { index: 2, text: "第二句。", audio_start_seconds: 5, audio_end_seconds: 8 },
      { index: 3, text: "列表重点。", audio_start_seconds: 8, audio_end_seconds: 11 },
      { index: 4, text: "要点二。", audio_start_seconds: 11, audio_end_seconds: 14 }
    ]
  });

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/courses/tags") {
      await route.fulfill({
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] })
      });
      return;
    }
    if (url.pathname === "/courses/course_md") {
      await route.fulfill({
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify(course)
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [course]
      })
    });
  });

  await page.goto("/zh/library");
  await page.getByRole("link", { name: /Markdown 课程/ }).click();

  await expect(page).toHaveURL(/\/zh\/courses\/course_md(?:\?autoplay=1)?$/);
  await expect(page.getByRole("heading", { name: "一级标题" })).toBeVisible();
  await expect(page.locator("article strong").filter({ hasText: /^重点$/ })).toBeVisible();
  await expect(page.locator("article ul > li", { hasText: "列表重点。" })).toBeVisible();
  await expect(page.locator("article ul > li strong", { hasText: "列表重点" })).toBeVisible();
  await expect(page.getByText("alert('x')")).toBeVisible();
  await expect(page.getByRole("link", { name: "https://example.com/article" })).toBeVisible();
  await expect(page.locator("[data-sentence-index='1']")).toContainText("重点第一句。");
  await expect(page.locator("article")).not.toContainText("**");
  await expect(page.locator("article")).not.toContainText("* 列表重点");
  await expect(page.locator("[data-course-player='reading-dock']")).toBeVisible();
  await expect(page.getByRole("button", { name: "播放" })).toBeVisible();
  await expect(page.locator("[data-sentence-list]")).toHaveCount(0);
});

test("markdown reader highlights backend-derived sentences across markdown syntax", async ({ page }) => {
  const course = mockCourse({
    id: "markdown_mapped",
    title: "真实导入",
    content_markdown: "# 标题\n\n[第一句](https://example.com)。第二句。",
    sentences: [
      { index: 0, text: "标题", audio_start_seconds: 0, audio_end_seconds: 2 },
      { index: 1, text: "第一句。", audio_start_seconds: 2, audio_end_seconds: 5 },
      { index: 2, text: "第二句。", audio_start_seconds: 5, audio_end_seconds: 8 }
    ]
  });

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/courses/tags") {
      await route.fulfill({
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] })
      });
      return;
    }
    if (url.pathname === "/courses/markdown_mapped") {
      await route.fulfill({
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify(course)
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [course]
      })
    });
  });

  await page.goto("/zh/library");
  await page.getByRole("link", { name: /真实导入/ }).click();

  await expect(page).toHaveURL(/\/zh\/courses\/markdown_mapped(?:\?autoplay=1)?$/);
  await expect(page.locator("[data-sentence-index='0']")).toContainText("标题");
  await expect(page.locator("[data-sentence-index='1']")).toContainText("第一句。");
  await expect(page.locator("[data-sentence-index='2']")).toContainText("第二句。");
});
