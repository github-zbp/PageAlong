import type { FileImportBatch, FileImportItem, GenerationJob } from "@/lib/api";
import { buildTaskRows, groupTasks, taskFromFileBatch, taskFromJob } from "@/lib/tasks";

function jobFixture(overrides: Partial<GenerationJob> = {}): GenerationJob {
  return {
    id: "job-1",
    course_id: "course-1",
    target_type: "course",
    target_id: "course-1",
    target_label: "网页课程",
    job_type: "tts_generate",
    status: "pending",
    progress_current: 0,
    progress_total: 0,
    result_resource_id: null,
    download_url: null,
    error_code: null,
    error_message: null,
    started_at: null,
    finished_at: null,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    ...overrides
  };
}

function fileItemFixture(overrides: Partial<FileImportItem> = {}): FileImportItem {
  return {
    id: "item-1",
    batch_id: "batch-1",
    course_id: null,
    status: "pending",
    original_filename: "a.md",
    relative_path: null,
    file_extension: ".md",
    content_type: "text/markdown",
    byte_size: 8,
    storage_backend: "local",
    bucket: null,
    object_key: "a.md",
    object_path: "/tmp/a.md",
    error_code: null,
    error_message: null,
    started_at: null,
    finished_at: null,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    ...overrides
  };
}

function batchFixture(overrides: Partial<FileImportBatch> = {}): FileImportBatch {
  return {
    id: "batch-1",
    status: "pending",
    source_mode: "single_file",
    series_id: null,
    series_title: null,
    total_count: 1,
    success_count: 0,
    failed_count: 0,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    finished_at: null,
    items: [fileItemFixture()],
    ...overrides
  };
}

it("groups generation jobs and file batches into task sections", () => {
  const groups = groupTasks([
    taskFromJob(
      jobFixture({
        id: "job-running",
        status: "running",
        progress_current: 1,
        progress_total: 4
      })
    ),
    taskFromFileBatch(
      batchFixture({
        id: "batch-failed",
        status: "failed",
        failed_count: 1,
        total_count: 1
      })
    )
  ]);

  expect(groups.running).toHaveLength(1);
  expect(groups.failed).toHaveLength(1);
  expect(groups.pending).toHaveLength(0);
  expect(groups.completed).toHaveLength(0);
});

it("normalizes generation jobs with labels, progress, errors, and download URLs", () => {
  const row = taskFromJob(
    jobFixture({
      id: "job-pdf",
      job_type: "course_export_pdf",
      status: "failed",
      target_label: "深度文章",
      progress_current: 2,
      progress_total: 5,
      error_message: "导出失败",
      download_url: "/courses/course-1/exports/pdf",
      updated_at: "2026-08-27T02:00:00.000Z"
    })
  );

  expect(row).toMatchObject({
    id: "job-pdf",
    source: "job",
    title: "深度文章",
    typeLabel: "PDF 导出",
    group: "failed",
    progress: 0.4,
    errorMessage: "导出失败",
    updatedAt: "2026-08-27T02:00:00.000Z",
    downloadUrl: "/courses/course-1/exports/pdf",
    courseId: "course-1"
  });
});

it("keeps completed file batches with failed items in the failed group", () => {
  const row = taskFromFileBatch(
    batchFixture({
      id: "batch-mixed",
      status: "completed_with_failures",
      source_mode: "multiple_files",
      total_count: 3,
      success_count: 2,
      failed_count: 1,
      items: [
        fileItemFixture({ id: "item-ok", original_filename: "ok.md", status: "succeeded" }),
        fileItemFixture({
          id: "item-failed",
          original_filename: "bad.md",
          status: "failed",
          error_message: "文件格式不支持"
        })
      ]
    })
  );

  expect(row.group).toBe("failed");
  expect(row.typeLabel).toBe("导入");
  expect(row.progress).toBe(1);
  expect(row.errorMessage).toBe("文件格式不支持");
  expect(row.subtitle).toContain("2/3");
});

it("sorts each task group by latest update time", () => {
  const rows = buildTaskRows({
    jobs: [
      jobFixture({ id: "job-old", status: "running", updated_at: "2026-08-27T01:00:00.000Z" }),
      jobFixture({ id: "job-new", status: "running", updated_at: "2026-08-27T03:00:00.000Z" })
    ],
    fileBatches: [
      batchFixture({ id: "batch-pending", status: "pending", updated_at: "2026-08-27T02:00:00.000Z" })
    ]
  });

  const groups = groupTasks(rows);

  expect(groups.running.map((row) => row.id)).toEqual(["job-new", "job-old"]);
  expect(groups.pending.map((row) => row.id)).toEqual(["batch-pending"]);
});
