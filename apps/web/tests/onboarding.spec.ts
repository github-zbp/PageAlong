import { expect, test } from "@playwright/test";

const apiHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};

const authToken = "onboarding-token";

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

  await page.route(/http:\/\/localhost:(8000|8070)\/auth\/me\/dashboard-activity$/, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    await route.fulfill({ status: 204, headers: apiHeaders, body: "" });
  });
});

test("dashboard onboarding walks through the first-use steps once", async ({ page }) => {
  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\?.*)?$/, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({ items: [] })
    });
  });

  await page.goto("/zh/dashboard");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByText("先导入内容")).toBeVisible();

  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByText("回到工作台继续")).toBeVisible();

  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByRole("heading", { name: "在课程库里整理" })).toBeVisible();

  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "完成" }).click();

  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("pagealong.onboarding.dashboard.v1"))).toBe("1");

  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
