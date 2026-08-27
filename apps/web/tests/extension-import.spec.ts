import { expect, test } from "@playwright/test";

const apiHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};

const authToken = "extension-import-token";
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

test("mobile extension import redirects unauthenticated users to login", async ({ page }) => {
  await page.route(/http:\/\/localhost:(8000|8070)\/auth\/me$/, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    await route.fulfill({ status: 401, headers: apiHeaders, body: JSON.stringify({ detail: "Authentication required" }) });
  });

  await page.goto("/zh/extension/import?url=https%3A%2F%2Fexample.com%2Fa");

  await expect(page).toHaveURL(/\/zh\/login\?next=/);
});

test("mobile extension import submits URL sync and opens course", async ({ page }) => {
  let requestBody: Record<string, unknown> | null = null;
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
  await page.route(/http:\/\/localhost:(8000|8070)\/courses\/import-url\/extension-sync$/, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    requestBody = JSON.parse(route.request().postData() || "{}") as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      headers: apiHeaders,
      body: JSON.stringify({
        id: "course_mobile_1",
        title: "移动同步",
        source_type: "chrome_extension",
        status: "extracting_text",
        word_count: 0,
        word_count_unit: "characters",
        estimated_reading_seconds: 0,
        duration_seconds: 0,
        current_audio_url: null,
        last_playback_position_seconds: 0,
        library_type: "fragmented",
        series_id: null,
        series_title: null,
        tags: [],
        is_starred: false,
        created_at: "2026-08-04T00:00:00",
        updated_at: "2026-08-04T00:00:00",
        last_read_at: null,
        content_markdown: null,
        source: null,
        sentences: []
      })
    });
  });

  await page.goto("/zh/extension/import?url=https%3A%2F%2Fexample.com%2Fa&title=%E7%A7%BB%E5%8A%A8%E5%90%8C%E6%AD%A5");
  await page.getByRole("button", { name: "同步到 PageAlong" }).click();

  expect(requestBody?.url).toBe("https://example.com/a");
  expect(requestBody?.title).toBe("移动同步");
  await expect(page.getByRole("link", { name: "去 PageAlong 查看课程" })).toHaveAttribute(
    "href",
    "/zh/courses/course_mobile_1"
  );
});
