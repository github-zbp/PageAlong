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
  await expect(page.getByRole("heading", { name: "这一页还在准备中" })).toBeVisible();

  await page.goto("/guide?lang=en");
  await expect(page.getByRole("heading", { name: "This page is still being prepared" })).toBeVisible();

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "隐私政策草案" })).toBeVisible();

  await page.goto("/privacy?lang=en");
  await expect(page.getByRole("heading", { name: "Privacy policy draft" })).toBeVisible();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "用户条款草案" })).toBeVisible();

  await page.goto("/terms?lang=en");
  await expect(page.getByRole("heading", { name: "Terms of use draft" })).toBeVisible();
});
