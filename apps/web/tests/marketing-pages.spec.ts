import { expect, test } from "@playwright/test";

test("marketing pages and policy pages are wired up in both locales", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "指南" })).toHaveAttribute("href", "/guide");
  await expect(page.getByRole("link", { name: "下载" })).toHaveAttribute("href", "/download");
  await expect(page.getByRole("link", { name: "博客" })).toHaveAttribute("href", "/blog");
  await expect(page.getByRole("link", { name: "产品故事" })).toHaveAttribute("href", "/story");
  await expect(page.getByRole("link", { name: "隐私政策" })).toHaveAttribute("href", "/privacy");
  await expect(page.getByRole("link", { name: "用户条款" })).toHaveAttribute("href", "/terms");

  await page.getByRole("link", { name: "产品故事" }).click();
  await expect(page).toHaveURL(/\/story$/);
  await expect(page.getByRole("heading", { name: "我是谁" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "为什么开发这款产品" })).toBeVisible();
  await expect(page.getByAltText("添加阿沛个人微信的二维码")).toBeVisible();
  await expect(page.getByRole("heading", { name: "评论区" })).toBeVisible();
  await expect(page.getByRole("button", { name: "登录后评论" })).toBeVisible();

  await page.goto("/en/story");
  await expect(page.getByRole("heading", { name: "Who I am" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why I built this product" })).toBeVisible();
  await expect(page.getByAltText("QR code to add Apei on WeChat")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comments" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to comment" })).toBeVisible();

  await page.goto("/en/guide");
  await expect(page.getByRole("heading", { name: "This page is still being prepared" })).toBeVisible();

  await page.goto("/en/download");
  await expect(page.getByRole("heading", { name: "This page is still being prepared" })).toBeVisible();

  await page.goto("/en/blog");
  await expect(page.getByRole("heading", { name: "Blog" })).toBeVisible();

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "隐私政策草案" })).toBeVisible();

  await page.goto("/en/privacy");
  await expect(page.getByRole("heading", { name: "Privacy policy draft" })).toBeVisible();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "用户条款草案" })).toBeVisible();

  await page.goto("/en/terms");
  await expect(page.getByRole("heading", { name: "Terms of use draft" })).toBeVisible();
});

test("marketing locale switch keeps each public page on the matching English version", async ({ page }) => {
  const cases = [
    { path: "/guide", heading: "This page is still being prepared" },
    { path: "/download", heading: "This page is still being prepared" },
    { path: "/blog", heading: "Blog" },
    { path: "/story", heading: "Who I am" },
    { path: "/privacy", heading: "Privacy policy draft" },
    { path: "/terms", heading: "Terms of use draft" }
  ];

  for (const item of cases) {
    await page.goto(item.path);
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(new RegExp(`/en${item.path.replace("/", "\\/")}$`));
    await expect(page.getByRole("heading", { name: item.heading })).toBeVisible();
  }
});
