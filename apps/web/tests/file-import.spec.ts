import { expect, test } from "@playwright/test";

const apiHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};

const authToken = "file-import-token";
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

test("import landing page stacks the four choices vertically", async ({ page }) => {
  await page.goto("/zh/import");

  const labels = ["粘贴文本", "网页导入", "文件上传", "浏览器插件"];
  const boxes = [];
  for (const label of labels) {
    const box = await page.getByRole("link", { name: label }).boundingBox();
    expect(box).not.toBeNull();
    boxes.push(box!);
  }

  expect(boxes[0].y).toBeLessThan(boxes[1].y);
  expect(boxes[1].y).toBeLessThan(boxes[2].y);
  expect(boxes[2].y).toBeLessThan(boxes[3].y);
});

test("file upload import reports per-file failures and keeps successful files", async ({ page }) => {
  let pollCount = 0;
  const pendingBatchResponse = {
    id: "batch_1",
    status: "running",
    source_mode: "multiple_files",
    series_id: null,
    series_title: null,
    total_count: 2,
    success_count: 0,
    failed_count: 1,
    created_at: "2026-08-20T00:00:00",
    updated_at: "2026-08-20T00:00:00",
    finished_at: null,
    items: [
      {
        id: "item_1",
        batch_id: "batch_1",
        course_id: null,
        status: "pending",
        original_filename: "ok.txt",
        relative_path: "ok.txt",
        file_extension: "txt",
        content_type: "text/plain",
        byte_size: 18,
        storage_backend: "local",
        bucket: null,
        object_key: "file-imports/batch_1/item_1/ok.txt",
        object_path: "/tmp/file-imports/batch_1/item_1/ok.txt",
        error_code: null,
        error_message: null,
        started_at: "2026-08-20T00:00:00",
        finished_at: "2026-08-20T00:00:00",
        created_at: "2026-08-20T00:00:00",
        updated_at: "2026-08-20T00:00:00"
      },
      {
        id: "item_2",
        batch_id: "batch_1",
        course_id: null,
        status: "failed",
        original_filename: "scan.pdf",
        relative_path: "scan.pdf",
        file_extension: "pdf",
        content_type: "application/pdf",
        byte_size: 12,
        storage_backend: "local",
        bucket: null,
        object_key: "",
        object_path: "",
        error_code: "scanned_pdf_without_text_layer",
        error_message: "PDF appears to be scanned or image-only. OCR is not supported yet.",
        started_at: null,
        finished_at: "2026-08-20T00:00:00",
        created_at: "2026-08-20T00:00:00",
        updated_at: "2026-08-20T00:00:00"
      }
    ]
  };
  const completedBatchResponse = {
    ...pendingBatchResponse,
    status: "completed_with_failures",
    success_count: 1,
    finished_at: "2026-08-20T00:00:00",
    items: [
      {
        ...pendingBatchResponse.items[0],
        course_id: "course_1",
        status: "succeeded",
        started_at: "2026-08-20T00:00:00",
        finished_at: "2026-08-20T00:00:00"
      },
      pendingBatchResponse.items[1]
    ]
  };

  await page.route(/http:\/\/localhost:(8000|8070)\/courses\/import-files$/, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    await route.fulfill({
      status: 202,
      headers: apiHeaders,
      body: JSON.stringify(pendingBatchResponse)
    });
  });

  await page.route(/http:\/\/localhost:(8000|8070)\/courses\/file-import-batches\/batch_1$/, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    pollCount += 1;
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify(completedBatchResponse)
    });
  });

  await page.goto("/zh/import/file");
  await expect(page.getByRole("button", { name: "多文件" })).toBeVisible();
  await page.getByRole("button", { name: "多文件" }).click();
  await page.setInputFiles('input[type="file"]', [
    { name: "ok.txt", mimeType: "text/plain", buffer: Buffer.from("第一句。第二句。") },
    { name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 fake") }
  ]);
  await page.getByRole("button", { name: "开始导入" }).click();

  await expect(page.getByText("ok.txt").first()).toBeVisible();
  await expect(page.getByText("scan.pdf").first()).toBeVisible();
  await expect(page.getByText("PDF appears to be scanned or image-only. OCR is not supported yet.")).toBeVisible();
  await expect.poll(() => pollCount).toBeGreaterThan(0);
});
