"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { PageHeader } from "@/components/PageHeader";
import { PaginationControls } from "@/components/PaginationControls";
import { listGenerationJobsPage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { dictionaries, normalizeLocale } from "@/lib/i18n";
import type { GenerationJob, Pagination } from "@/lib/types";

const PAGE_SIZE = 20;

function jobTypeLabel(job: GenerationJob, locale: "zh" | "en") {
  const dictionary = dictionaries[locale];
  switch (job.job_type) {
    case "course_export_markdown":
      return dictionary.downloads.markdownShort;
    case "course_export_docx":
      return dictionary.downloads.wordShort;
    case "course_export_pdf":
      return dictionary.downloads.pdfShort;
    case "tts_generate":
      return dictionary.jobs.audioGeneration;
    default:
      return job.job_type;
  }
}

function statusLabel(job: GenerationJob, locale: "zh" | "en") {
  const dictionary = dictionaries[locale];
  switch (job.status) {
    case "pending":
      return dictionary.jobs.waiting;
    case "running":
      return dictionary.jobs.generating;
    case "succeeded":
      return dictionary.jobs.completed;
    case "failed":
      return dictionary.status.failed;
    default:
      return job.status;
  }
}

function statusClass(job: GenerationJob) {
  switch (job.status) {
    case "pending":
      return "border-[#e7d9bf] bg-[#fffaf0] text-[var(--pa-amber)]";
    case "running":
      return "border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)] text-[var(--pa-green)]";
    case "succeeded":
      return "border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)] text-[var(--pa-green)]";
    case "failed":
      return "border-[var(--pa-error-soft)] bg-[var(--pa-error-soft)] text-[var(--pa-error)]";
    default:
      return "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)]";
  }
}

export default function JobsPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [expandedJobId, setExpandedJobId] = useState("");

  useEffect(() => {
    setExpandedJobId("");
  }, [page]);

  useEffect(() => {
    let active = true;

    async function loadJobs() {
      try {
        const response = await listGenerationJobsPage({ scope: "resource", page, pageSize: PAGE_SIZE });
        if (!active) {
          return;
        }
        if (response.items.length === 0 && response.pagination.page > 1) {
          setJobs([]);
          setPagination(response.pagination);
          setError("");
          setPage(response.pagination.total_pages);
          return;
        }
        setJobs(response.items);
        setPagination(response.pagination);
        setError("");
      } catch {
        if (active) {
          setError(dictionary.jobs.loadError);
        }
      }
    }

    void loadJobs();
    const timer = window.setInterval(() => {
      void loadJobs();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [dictionary.jobs.loadError, page]);

  return (
    <ConsoleShell locale={locale}>
      <PageHeader title={dictionary.jobs.title} subtitle={dictionary.jobs.subtitle} />

      {error ? (
        <div className="mb-4 rounded-md border border-[var(--pa-error-soft)] bg-[var(--pa-error-soft)] px-3 py-2 text-sm text-[var(--pa-error)]">
          {error}
        </div>
      ) : null}

      {jobs.length > 0 ? (
        <section className="space-y-3">
          {jobs.map((job) => {
            const failureText = job.error_message || job.error_code || dictionary.jobs.failureReasonTitle;
            const progressTotal = job.progress_total ?? 0;
            const progressCurrent = job.progress_current ?? 0;
            const progressPercent = progressTotal > 0 ? Math.min(100, Math.round((progressCurrent / progressTotal) * 100)) : 0;
            const isFailureExpanded = expandedJobId === job.id;

            return (
              <article key={job.id} className="rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-[var(--pa-ink)]">
                        {job.target_label || dictionary.jobs.download}
                      </h2>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(job)}`}>
                        {statusLabel(job, locale)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--pa-muted)]">
                      {jobTypeLabel(job, locale)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--pa-muted)]">
                      {dictionary.jobs.createdAt}: {formatDateTime(job.created_at, locale)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--pa-muted)]">
                      {dictionary.jobs.updatedAt}: {formatDateTime(job.updated_at, locale)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {job.download_url ? (
                      <a
                        className="pa-focus rounded-md bg-[var(--pa-green)] px-3 py-2 text-sm text-white"
                        href={job.download_url}
                      >
                        {dictionary.jobs.download}
                      </a>
                    ) : null}
                    {job.status === "failed" ? (
                      <button
                        className="pa-focus rounded-md border border-[var(--pa-error-soft)] px-3 py-2 text-sm text-[var(--pa-error)]"
                        onClick={() => setExpandedJobId(isFailureExpanded ? "" : job.id)}
                        type="button"
                      >
                        {dictionary.jobs.failureReason}
                      </button>
                    ) : null}
                  </div>
                </div>

                {progressTotal > 0 ? (
                  <div className="mt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--pa-muted-surface)]">
                      <div
                        className="h-full rounded-full bg-[var(--pa-amber)]"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-[var(--pa-muted)]">
                      {progressCurrent} / {progressTotal}
                    </p>
                  </div>
                ) : null}

                {job.status === "failed" && isFailureExpanded ? (
                  <div className="mt-4 rounded-md border border-[var(--pa-error-soft)] bg-[var(--pa-error-soft)] px-3 py-2 text-sm text-[var(--pa-error)]">
                    <p className="font-medium">{dictionary.jobs.failureReasonTitle}</p>
                    <p className="mt-1 whitespace-pre-wrap leading-6">{failureText}</p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <section className="rounded-md border border-dashed border-[var(--pa-line)] bg-[var(--pa-surface)] p-5">
          <h2 className="text-base font-semibold text-[var(--pa-ink)]">{dictionary.jobs.emptyTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pa-muted)]">{dictionary.jobs.emptyBody}</p>
          <div className="mt-4 flex gap-2">
            <Link className="rounded-md border border-[var(--pa-line)] px-3 py-2 text-sm" href={`/${locale}/library`}>
              {dictionary.nav.fragmentedCourses}
            </Link>
            <Link className="rounded-md bg-[var(--pa-ink)] px-3 py-2 text-sm text-white" href={`/${locale}/import`}>
              {dictionary.nav.courseImport}
            </Link>
          </div>
        </section>
      )}

      {pagination ? (
        <div className="mt-4">
          <PaginationControls dictionary={dictionary} onPageChange={setPage} pagination={pagination} />
        </div>
      ) : null}
    </ConsoleShell>
  );
}
