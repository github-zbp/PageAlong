import { expect, test } from "@playwright/test";

const apiHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};

const authToken = "jobs-page-token";
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

test("download tasks page shows direct download links and failure reasons", async ({ page }) => {
  await page.route(/http:\/\/localhost:(8000|8070)\/jobs(\?.*)?$/, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        items: [
          {
            id: "job_ready_1",
            course_id: "course_1",
            target_type: "course",
            target_id: "course_1",
            target_label: "通勤听读",
            job_type: "course_export_markdown",
            status: "succeeded",
            provider: null,
            fallback_provider: null,
            tier: null,
            progress_current: 1,
            progress_total: 1,
            result_resource_id: "resource_1",
            download_url: "https://cdn.pagealong.test/course_1.md",
            error_code: null,
            error_message: null,
            started_at: "2026-08-24T00:00:00Z",
            finished_at: "2026-08-24T00:05:00Z",
            created_at: "2026-08-24T00:00:00Z",
            updated_at: "2026-08-24T00:05:00Z"
          },
          {
            id: "job_failed_1",
            course_id: "course_2",
            target_type: "course",
            target_id: "course_2",
            target_label: "精听训练",
            job_type: "tts_generate",
            status: "failed",
            provider: null,
            fallback_provider: null,
            tier: null,
            progress_current: 0,
            progress_total: 0,
            result_resource_id: null,
            download_url: null,
            error_code: "tts_provider_timeout",
            error_message: "TTS provider timed out.",
            started_at: "2026-08-24T00:10:00Z",
            finished_at: "2026-08-24T00:11:00Z",
            created_at: "2026-08-24T00:10:00Z",
            updated_at: "2026-08-24T00:11:00Z"
          }
        ]
      })
    });
  });

  await page.goto("/zh/jobs");

  await expect(page.getByRole("heading", { name: "下载任务", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "下载", exact: true })).toHaveAttribute(
    "href",
    "https://cdn.pagealong.test/course_1.md"
  );

  await page.getByRole("article").filter({ hasText: "精听训练" }).getByRole("button", { name: "失败原因" }).click();
  await expect(page.getByText("TTS provider timed out.")).toBeVisible();
});

test("download tasks page paginates by page number and switches pages cleanly", async ({ page }) => {
  const requestedPages: number[] = [];
  const jobs = Array.from({ length: 21 }, (_, index) => ({
    id: `job_${index + 1}`,
    course_id: `course_${index + 1}`,
    target_type: "course",
    target_id: `course_${index + 1}`,
    target_label: `课程 ${index + 1}`,
    job_type: index === 20 ? "tts_generate" : "course_export_markdown",
    status: index === 20 ? "failed" : "succeeded",
    provider: null,
    fallback_provider: null,
    tier: null,
    progress_current: index === 20 ? 0 : 1,
    progress_total: index === 20 ? 0 : 1,
    result_resource_id: index === 20 ? null : `resource_${index + 1}`,
    download_url: index === 20 ? null : `https://cdn.pagealong.test/course_${index + 1}.md`,
    error_code: index === 20 ? "tts_provider_timeout" : null,
    error_message: index === 20 ? "TTS provider timed out." : null,
    started_at: `2026-08-24T00:${String(index).padStart(2, "0")}:00Z`,
    finished_at: `2026-08-24T00:${String(index).padStart(2, "0")}:30Z`,
    created_at: `2026-08-24T00:${String(index).padStart(2, "0")}:00Z`,
    updated_at: `2026-08-24T00:${String(index).padStart(2, "0")}:30Z`
  }));

  await page.route(/http:\/\/localhost:(8000|8070)\/jobs(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    if (request.method() !== "GET") {
      await route.fulfill({ status: 404, headers: apiHeaders, body: JSON.stringify({ detail: "not found" }) });
      return;
    }

    const pageNumber = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("page_size") ?? "20");
    const total = jobs.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (pageNumber - 1) * pageSize;
    const items = jobs.slice(start, start + pageSize);
    requestedPages.push(pageNumber);

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
  });

  await page.goto("/zh/jobs");
  await expect(page.getByRole("button", { name: "1" })).toBeVisible();
  const firstJob = page.getByRole("article").first();
  await expect(firstJob.getByRole("link", { name: "下载", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "2" }).click();
  const lastJob = page.getByRole("article").first();
  await expect(lastJob.getByRole("link", { name: "下载", exact: true })).toHaveCount(0);
  await expect(lastJob.getByRole("button", { name: "失败原因" })).toBeVisible();
  await expect(page.getByText("课程 21")).toBeVisible();
  await expect.poll(() => requestedPages.at(-1)).toBe(2);
});
