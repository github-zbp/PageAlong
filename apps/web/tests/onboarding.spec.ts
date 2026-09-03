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

test("dashboard onboarding anchors to the sidebar and can be reopened", async ({ page }) => {
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

  const dialog = page.getByRole("dialog", { name: "开始使用 PageAlong" });
  const guideButton = page.getByRole("button", { name: "使用引导" });
  await expect(guideButton).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(page.getByText("先导入内容")).toBeVisible();
  await expect(page.getByRole("link", { name: "课程导入" })).toHaveAttribute("data-guide-active", "true");

  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByText("回到工作台继续")).toBeVisible();
  await expect(page.getByRole("link", { name: "工作台" })).toHaveAttribute("data-guide-active", "true");

  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByRole("heading", { name: "在课程库里整理" })).toBeVisible();
  await expect(page.getByRole("link", { name: "课程库" })).toHaveAttribute("data-guide-active", "true");

  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByRole("heading", { name: "系列课程怎么用" })).toBeVisible();
  await expect(page.getByRole("link", { name: "系列课程" })).toHaveAttribute("data-guide-active", "true");

  await page.getByRole("button", { name: "完成" }).click();

  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("pagealong.onboarding.dashboard.v1"))).toBe("1");

  await guideButton.click();
  await expect(dialog).toBeVisible();
  await expect(page.getByText("先导入内容")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
