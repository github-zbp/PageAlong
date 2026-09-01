import type { FileImportBatch, FileImportItem, GenerationJob } from "@/lib/api";
import type { LocalePreference } from "@/lib/preferences";
import { getTaskCopy } from "@/lib/i18n";

export type TaskGroupKey = "running" | "pending" | "completed" | "failed";

export type TaskRowModel = {
  id: string;
  source: "job" | "file_batch";
  title: string;
  subtitle: string;
  typeLabel: string;
  status: string;
  group: TaskGroupKey;
  progress: number;
  errorMessage: string | null;
  updatedAt: string;
  downloadUrl?: string | null;
  courseId?: string | null;
};

export type TaskGroups = Record<TaskGroupKey, TaskRowModel[]>;

const GROUP_KEYS: TaskGroupKey[] = ["running", "pending", "completed", "failed"];

function normalizedStatus(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function groupFromJobStatus(status: string): TaskGroupKey {
  switch (normalizedStatus(status)) {
    case "running":
    case "processing":
    case "in_progress":
      return "running";
    case "succeeded":
    case "success":
    case "completed":
      return "completed";
    case "failed":
    case "error":
    case "canceled":
    case "cancelled":
      return "failed";
    case "pending":
    case "queued":
    default:
      return "pending";
  }
}

function groupFromFileBatch(batch: FileImportBatch): TaskGroupKey {
  const status = normalizedStatus(batch.status);
  if ((status === "failed" || status === "completed_with_failures") && batch.failed_count > 0) {
    return "failed";
  }

  switch (status) {
    case "running":
    case "processing":
    case "in_progress":
      return "running";
    case "succeeded":
    case "success":
    case "completed":
    case "completed_with_failures":
      return "completed";
    case "failed":
    case "error":
    case "canceled":
    case "cancelled":
      return "failed";
    case "pending":
    case "queued":
    default:
      return "pending";
  }
}

function labelForJobType(jobType: string, locale: LocalePreference): string {
  const copy = getTaskCopy(locale);
  switch (normalizedStatus(jobType)) {
    case "tts_generate":
      return copy.typeLabels.ttsGenerate;
    case "url_import":
      return copy.typeLabels.urlImport;
    case "course_export_pdf":
      return copy.typeLabels.courseExportPdf;
    case "course_export_docx":
      return copy.typeLabels.courseExportDocx;
    case "course_export_markdown":
      return copy.typeLabels.courseExportMarkdown;
    default:
      return copy.typeLabels.task;
  }
}

function titleForJob(job: GenerationJob, locale: LocalePreference): string {
  const targetLabel = job.target_label?.trim();
  if (targetLabel) {
    return targetLabel;
  }
  return labelForJobType(job.job_type, locale);
}

function titleForFileBatch(batch: FileImportBatch, locale: LocalePreference): string {
  const seriesTitle = batch.series_title?.trim();
  if (seriesTitle) {
    return seriesTitle;
  }
  if (batch.total_count === 1 && batch.items[0]?.original_filename) {
    return batch.items[0].original_filename;
  }
  const copy = getTaskCopy(locale);
  if (normalizedStatus(batch.source_mode) === "folder") {
    return copy.typeLabels.fileFolderImport;
  }
  return copy.typeLabels.fileImport;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function progressRatio(current: number | null | undefined, total: number | null | undefined, completed: boolean): number {
  const safeTotal = Number.isFinite(total ?? NaN) ? Math.max(0, total ?? 0) : 0;
  if (safeTotal <= 0) {
    return completed ? 1 : 0;
  }
  return clampProgress((current ?? 0) / safeTotal);
}

function progressForFileBatch(batch: FileImportBatch, group: TaskGroupKey): number {
  const processedCount = batch.success_count + batch.failed_count;
  return progressRatio(processedCount, batch.total_count, group === "completed");
}

function subtitleForJob(job: GenerationJob, locale: LocalePreference): string {
  if ((job.progress_total ?? 0) > 0) {
    return locale === "en"
      ? `${job.progress_current ?? 0}/${job.progress_total} completed`
      : `${job.progress_current ?? 0}/${job.progress_total} 已完成`;
  }
  return labelForJobType(job.job_type, locale);
}

function subtitleForFileBatch(batch: FileImportBatch, locale: LocalePreference): string {
  const total = Math.max(0, batch.total_count);
  const completed = Math.max(0, batch.success_count);
  const failed = Math.max(0, batch.failed_count);
  if (locale === "en") {
    if (failed > 0) {
      return `${completed}/${total} files completed, ${failed} failed`;
    }
    return `${completed}/${total} files completed`;
  }
  if (failed > 0) {
    return `${completed}/${total} 个文件已完成，${failed} 个失败`;
  }
  return `${completed}/${total} 个文件已完成`;
}

function firstNonEmpty(values: Array<string | null | undefined>): string {
  return values.find((value) => typeof value === "string" && value.trim()) ?? "";
}

function firstFailedItem(items: FileImportItem[]): FileImportItem | undefined {
  return items.find((item) => normalizedStatus(item.status) === "failed");
}

function errorForFileBatch(batch: FileImportBatch, locale: LocalePreference): string | null {
  const failedItem = firstFailedItem(batch.items);
  if (failedItem?.error_message?.trim()) {
    return failedItem.error_message;
  }
  if (batch.failed_count > 0) {
    if (locale === "en") {
      return batch.failed_count === 1 ? "1 file failed to import" : `${batch.failed_count} files failed to import`;
    }
    return `${batch.failed_count} 个文件导入失败`;
  }
  return null;
}

function errorForJob(job: GenerationJob): string | null {
  if (job.error_message?.trim()) {
    return job.error_message;
  }
  return job.error_code?.trim() || null;
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortRows(rows: TaskRowModel[]): TaskRowModel[] {
  return [...rows].sort((left, right) => {
    const byUpdatedAt = timestamp(right.updatedAt) - timestamp(left.updatedAt);
    if (byUpdatedAt !== 0) {
      return byUpdatedAt;
    }
    return right.id.localeCompare(left.id);
  });
}

export function taskFromJob(job: GenerationJob, locale: LocalePreference = "zh"): TaskRowModel {
  const group = groupFromJobStatus(job.status);
  return {
    id: job.id,
    source: "job",
    title: titleForJob(job, locale),
    subtitle: subtitleForJob(job, locale),
    typeLabel: labelForJobType(job.job_type, locale),
    status: job.status,
    group,
    progress: progressRatio(job.progress_current, job.progress_total, group === "completed"),
    errorMessage: errorForJob(job),
    updatedAt: firstNonEmpty([job.updated_at, job.finished_at, job.started_at, job.created_at]),
    downloadUrl: job.download_url ?? null,
    courseId: job.course_id
  };
}

export function taskFromFileBatch(batch: FileImportBatch, locale: LocalePreference = "zh"): TaskRowModel {
  const group = groupFromFileBatch(batch);
  const copy = getTaskCopy(locale);
  return {
    id: batch.id,
    source: "file_batch",
    title: titleForFileBatch(batch, locale),
    subtitle: subtitleForFileBatch(batch, locale),
    typeLabel: copy.typeLabels.urlImport,
    status: batch.status,
    group,
    progress: progressForFileBatch(batch, group),
    errorMessage: errorForFileBatch(batch, locale),
    updatedAt: firstNonEmpty([batch.updated_at, batch.finished_at, batch.created_at]),
    courseId: batch.items.find((item) => item.course_id)?.course_id ?? null
  };
}

export function buildTaskRows(input: {
  jobs?: GenerationJob[];
  fileBatches?: FileImportBatch[];
  locale?: LocalePreference;
}): TaskRowModel[] {
  const locale = input.locale ?? "zh";
  return [...(input.jobs ?? []).map((job) => taskFromJob(job, locale)), ...(input.fileBatches ?? []).map((batch) => taskFromFileBatch(batch, locale))];
}

export function groupTasks(rows: TaskRowModel[]): TaskGroups {
  const groups = GROUP_KEYS.reduce((accumulator, groupKey) => {
    accumulator[groupKey] = [];
    return accumulator;
  }, {} as TaskGroups);

  rows.forEach((row) => {
    groups[row.group].push(row);
  });

  GROUP_KEYS.forEach((groupKey) => {
    groups[groupKey] = sortRows(groups[groupKey]);
  });

  return groups;
}
