import { expect, test, type Page } from "@playwright/test";

const apiHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};

async function routeMe(page: Page, token: string, role: "user" | "admin") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("pagealong_auth_token", value);
  }, token);
  await page.route(/http:\/\/localhost:(8000|8070)\/auth\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        id: role === "admin" ? "admin_1" : "user_1",
        email: role === "admin" ? "admin@example.com" : "reader@example.com",
        role,
        status: "active",
        email_verified_at: "2026-08-26T00:00:00",
        must_change_password_at_next_login: false,
        last_login_at: "2026-08-26T00:00:00",
        last_dashboard_at: null,
        last_dashboard_locale: "",
        created_at: "2026-08-26T00:00:00"
      })
    });
  });
}

test("reader admin redirects to users for admins", async ({ page }) => {
  await routeMe(page, "admin-token", "admin");
  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/users(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        items: [],
        pagination: {
          page: 1,
          page_size: 20,
          total: 0,
          total_pages: 1,
          has_previous: false,
          has_next: false
        }
      })
    });
  });

  await page.goto("/reader_admin");
  await expect(page).toHaveURL(/\/reader_admin\/users$/);
  await expect(page.getByRole("heading", { name: "用户管理" })).toBeVisible();
});

test("reader admin blocks normal users", async ({ page }) => {
  await routeMe(page, "user-token", "user");
  await page.goto("/reader_admin/users");
  await expect(page.getByText("需要管理员权限")).toBeVisible();
});

test("old locale admin route redirects to reader admin", async ({ page }) => {
  await routeMe(page, "admin-token", "admin");
  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/users(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        items: [],
        pagination: {
          page: 1,
          page_size: 20,
          total: 0,
          total_pages: 1,
          has_previous: false,
          has_next: false
        }
      })
    });
  });

  await page.goto("/zh/admin/users");
  await expect(page).toHaveURL(/\/reader_admin\/users$/);
});

test("admin user page searches paginated users and enters user page", async ({ page }) => {
  await routeMe(page, "admin-token", "admin");
  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/users(\?.*)?$/, async (route) => {
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
            email_verified_at: "2026-08-26T00:00:00",
            must_change_password_at_next_login: false,
            last_login_at: "2026-08-26T00:00:00",
            last_dashboard_at: "2026-08-26T10:00:00",
            last_dashboard_locale: "zh",
            created_at: "2026-08-26T00:00:00"
          }
        ],
        pagination: {
          page: 1,
          page_size: 20,
          total: 1,
          total_pages: 1,
          has_previous: false,
          has_next: false
        }
      })
    });
  });
  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/impersonation$/, async (route) => {
    await route.fulfill({
      status: 201,
      headers: apiHeaders,
      body: JSON.stringify({
        token: "impersonation-token",
        target_user: {
          id: "user_1",
          email: "reader@example.com",
          role: "user",
          status: "active",
          email_verified_at: "2026-08-26T00:00:00",
          must_change_password_at_next_login: false,
          last_login_at: "2026-08-26T00:00:00",
          last_dashboard_at: "2026-08-26T10:00:00",
          last_dashboard_locale: "zh",
          created_at: "2026-08-26T00:00:00"
        },
        expires_at: "2026-08-26T10:30:00"
      })
    });
  });

  await page.goto("/reader_admin/users");
  await page.getByPlaceholder("搜索邮箱").fill("reader");
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByText("reader@example.com")).toBeVisible();
  await page.getByRole("button", { name: "进入用户页面" }).click();
  expect(await page.evaluate(() => window.localStorage.getItem("pagealong_impersonation_return"))).toBe(
    "/reader_admin/users"
  );
});

test("admin blog page lists posts and saves the editor form", async ({ page }) => {
  await routeMe(page, "admin-token", "admin");
  let saved = false;

  const blog = {
    id: "blog_1",
    title: "后台规划",
    slug: "reader-admin",
    language: "zh",
    author_email: "admin@example.com",
    summary: "后台模块规划",
    status: "draft",
    published_at: null,
    created_at: "2026-08-26T00:00:00",
    updated_at: "2026-08-26T00:00:00",
    cover_image_url: "",
    body_markdown: "# 后台规划\n\n正文 <strong>HTML</strong>",
    body_html: "<h1>后台规划</h1><p>正文 <strong>HTML</strong></p>",
    seo_title: "后台规划",
    seo_description: "后台模块规划"
  };

  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/blogs(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        items: [blog],
        pagination: {
          page: 1,
          page_size: 20,
          total: 1,
          total_pages: 1,
          has_previous: false,
          has_next: false
        }
      })
    });
  });
  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/blogs\/blog_1$/, async (route) => {
    if (route.request().method() === "PATCH") {
      saved = true;
    }
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify(blog)
    });
  });

  await page.goto("/reader_admin/blogs");
  await expect(page.getByRole("heading", { name: "博客管理" })).toBeVisible();
  await expect(page.getByText("后台规划")).toBeVisible();
  await page.getByRole("link", { name: "编辑" }).click();
  await expect(page.getByRole("heading", { name: "编辑博客" })).toBeVisible();
  await page.getByRole("button", { name: "保存" }).click();
  await expect.poll(() => saved).toBe(true);
});

test("admin course pages list details and delete courses", async ({ page }) => {
  await routeMe(page, "admin-token", "admin");
  let deleted = false;
  const course = {
    id: "course_1",
    title: "英语阅读",
    user_email: "reader@example.com",
    source_type: "manual_text",
    status: "ready",
    created_at: "2026-08-26T00:00:00",
    updated_at: "2026-08-26T00:00:00",
    resource_counts: { image: 0, audio: 0, pdf: 1, docx: 0, markdown: 1 },
    audio_download_url: null,
    pdf_download_url: "/admin/courses/course_1/downloads/pdf",
    docx_download_url: "/admin/courses/course_1/downloads/docx",
    markdown_download_url: "/admin/courses/course_1/downloads/markdown",
    content_markdown: "正文内容"
  };

  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/courses(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        items: [{ ...course, content_markdown: undefined }],
        pagination: {
          page: 1,
          page_size: 20,
          total: 1,
          total_pages: 1,
          has_previous: false,
          has_next: false
        }
      })
    });
  });
  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/courses\/course_1$/, async (route) => {
    if (route.request().method() === "DELETE") {
      deleted = true;
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify(course) });
  });

  await page.goto("/reader_admin/courses");
  await expect(page.getByRole("heading", { name: "课程管理" })).toBeVisible();
  await expect(page.getByText("英语阅读")).toBeVisible();
  await expect(page.getByText("reader@example.com")).toBeVisible();
  await expect(page.getByText("正文内容")).toHaveCount(0);
  await page.getByRole("link", { name: "查看" }).click();
  await expect(page.getByText("正文内容")).toBeVisible();
  await page.getByRole("button", { name: "删除课程" }).click();
  await expect.poll(() => deleted).toBe(true);
});

test("admin announcement page lists saves and publishes announcements", async ({ page }) => {
  await routeMe(page, "admin-token", "admin");
  let saved = false;
  let published = false;
  const announcement = {
    id: "announcement_1",
    title: "文件导入优化",
    language: "zh",
    status: "draft",
    roadmap_status: "in_progress",
    display_position: "dashboard",
    sort_order: 3,
    is_pinned: true,
    published_at: null,
    created_at: "2026-08-26T00:00:00",
    updated_at: "2026-08-26T00:00:00",
    body_markdown: "正在开发文件导入体验。",
    body_html: "<p>正在开发文件导入体验。</p>"
  };

  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/announcements(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        items: [announcement],
        pagination: {
          page: 1,
          page_size: 20,
          total: 1,
          total_pages: 1,
          has_previous: false,
          has_next: false
        }
      })
    });
  });
  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/announcements\/announcement_1$/, async (route) => {
    if (route.request().method() === "PATCH") {
      saved = true;
    }
    await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify(announcement) });
  });
  await page.route(/http:\/\/localhost:(8000|8070)\/admin\/announcements\/announcement_1\/publish$/, async (route) => {
    published = true;
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({ ...announcement, status: "published", published_at: "2026-08-26T01:00:00" })
    });
  });

  await page.goto("/reader_admin/announcements");
  await expect(page.getByRole("heading", { name: "公告板" })).toBeVisible();
  await expect(page.getByText("文件导入优化")).toBeVisible();
  await page.getByRole("link", { name: "编辑" }).click();
  await expect(page.getByRole("heading", { name: "编辑公告" })).toBeVisible();
  await page.getByRole("button", { name: "保存" }).click();
  await expect.poll(() => saved).toBe(true);
  await page.goto("/reader_admin/announcements");
  await page.getByRole("button", { name: "发布" }).click();
  await expect.poll(() => published).toBe(true);
});
