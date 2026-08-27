import { expect, test, type Page } from "@playwright/test";

const apiHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "Content-Disposition",
  "Content-Type": "application/json"
};

async function routeConsoleBootstrap(page: Page, token: string, role: "user" | "admin" = "user") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("pagealong_auth_token", value);
  }, token);

  await page.route(/http:\/\/localhost:(8000|8070)\/auth\/me$/, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    expect(request.headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        id: role === "admin" ? "admin_1" : "user_1",
        email: role === "admin" ? "admin@example.com" : "reader@example.com",
        role,
        status: "active",
        email_verified_at: "2026-08-02T00:00:00",
        must_change_password_at_next_login: false,
        last_login_at: "2026-08-02T00:00:00",
        created_at: "2026-08-02T00:00:00"
      })
    });
  });

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\?.*)?$/, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ items: [] }) });
  });
}

test("user can sign in and reaches the protected console", async ({ page }) => {
  const token = "test-token";

  await page.route(/http:\/\/localhost:(8000|8070)\/auth\/login$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        token,
        user: {
          id: "user_1",
          email: "reader@example.com",
          role: "user",
          status: "active",
          email_verified_at: "2026-08-02T00:00:00",
          must_change_password_at_next_login: false,
          last_login_at: "2026-08-02T00:00:00",
          created_at: "2026-08-02T00:00:00"
        }
      })
    });
  });
  await routeConsoleBootstrap(page, token);

  await page.goto("/zh/login");
  await page.getByLabel("邮箱").fill("reader@example.com");
  await page.getByLabel("密码").fill("abc12345");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).toHaveURL(/\/zh\/dashboard$/);
  await expect(page.getByText("reader@example.com")).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("pagealong_auth_token"))).toBe(token);
});

test("user can start registration from email code", async ({ page }) => {
  const token = "register-token";

  await page.route(/http:\/\/localhost:(8000|8070)\/auth\/email\/code$/, async (route) => {
    await route.fulfill({ status: 204, headers: apiHeaders });
  });
  await page.route(/http:\/\/localhost:(8000|8070)\/auth\/register$/, async (route) => {
    await route.fulfill({
      status: 201,
      headers: apiHeaders,
      body: JSON.stringify({
        token,
        user: {
          id: "user_2",
          email: "new@example.com",
          role: "user",
          status: "active",
          email_verified_at: "2026-08-02T00:00:00",
          must_change_password_at_next_login: false,
          last_login_at: "2026-08-02T00:00:00",
          created_at: "2026-08-02T00:00:00"
        }
      })
    });
  });
  await routeConsoleBootstrap(page, token);

  await page.goto("/zh/register");
  await page.getByLabel("邮箱").fill("new@example.com");
  await page.getByLabel("密码").fill("abc12345");
  await page.getByRole("button", { name: "发送验证码" }).click();
  await page.getByLabel("验证码").fill("123456");
  await page.getByRole("button", { name: "注册" }).click();

  await expect(page).toHaveURL(/\/zh\/dashboard$/, { timeout: 10000 });
});

test("admin can open the user management page", async ({ page }) => {
  const token = "admin-token";

  await routeConsoleBootstrap(page, token, "admin");
  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/users(\?.*)?$/, async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        items: [
          {
            id: "user_1",
            email: "reader@example.com",
            role: "user",
            status: "active",
            email_verified_at: "2026-08-02T00:00:00",
            must_change_password_at_next_login: false,
            last_login_at: "2026-08-02T00:00:00",
            created_at: "2026-08-02T00:00:00"
          }
        ]
      })
    });
  });

  await page.goto("/zh/admin/users");
  await expect(page.getByText("reader@example.com")).toBeVisible();
});

test("marketing homepage switches between Chinese and English", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "把读不完的网页、文章和课件变成通勤也能继续听的有声课程" })).toBeVisible();
  await page.getByRole("link", { name: "English" }).click();

  await expect(page).toHaveURL(/\/\?lang=en$/);
  await expect(
    page.getByRole("heading", { name: "A fragmented reader that turns saved content into downloadable audio courses" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "中文" })).toBeVisible();
});

test("login and registration pages expose locale switchers", async ({ page }) => {
  await page.goto("/zh/login?next=%2Fzh%2Fdashboard");

  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Fdashboard$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.goto("/en/register");
  await page.getByRole("link", { name: "中文" }).click();
  await expect(page).toHaveURL(/\/zh\/register$/);
  await expect(page.getByRole("heading", { name: "注册" })).toBeVisible();
});

test("login and registration pages link back to the homepage", async ({ page }) => {
  await page.goto("/zh/login");
  await expect(page.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
  await page.getByRole("link", { name: "返回首页" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/en/register");
  await expect(page.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/?lang=en");
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page).toHaveURL(/\/\?lang=en$/);
});
