"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConsoleShell } from "@/components/ConsoleShell";
import { CourseCard } from "@/components/CourseCard";
import { deleteCourse, getCourseSeries, updateCourseLibrary } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { dictionaries, type Locale } from "@/lib/i18n";
import { seriesCourseHref } from "@/lib/series-navigation";
import type { CourseSeriesDetail, CourseSummary, DownloadRequest } from "@/lib/types";

type DownloadFeedback = {
  kind: "success" | "error";
  message: string;
};

export function SeriesCoursesPage({
  locale,
  seriesId
}: {
  locale: Locale;
  seriesId: string;
}) {
  const dictionary = dictionaries[locale];
  const router = useRouter();
  const [series, setSeries] = useState<CourseSeriesDetail | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setLoading] = useState(true);
  const [downloadFeedback, setDownloadFeedback] = useState<DownloadFeedback | null>(null);
  const [isSaving, setSaving] = useState(false);

  const loadSeries = useCallback(async (resetState = false) => {
    setError("");
    if (resetState) {
      setLoading(true);
      setSeries(null);
    }
    try {
      setSeries(await getCourseSeries(seriesId));
    } catch (caughtError) {
      if (resetState) {
        setSeries(null);
      }
      setError(caughtError instanceof Error ? caughtError.message : dictionary.detail.loadError);
    } finally {
      if (resetState) {
        setLoading(false);
      }
    }
  }, [dictionary.detail.loadError, seriesId]);

  useEffect(() => {
    void loadSeries(true);
  }, [loadSeries]);

  const courseHref = useCallback(
    (course: Pick<CourseSummary, "id" | "status">) => {
      const shouldAutoplay = ["ready", "text_ready", "audio_generating"].includes(course.status);
      return `${seriesCourseHref(locale, seriesId, course.id)}${shouldAutoplay ? "?autoplay=1" : ""}`;
    },
    [locale, seriesId]
  );

  const sortedCourses = useMemo(
    () => (series?.courses ?? []).map((course) => ({ ...course, sentence_count: course.sentences.length })),
    [series]
  );

  async function removeCourse(courseId: string) {
    setSaving(true);
    try {
      await deleteCourse(courseId);
      await loadSeries();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.detail.loadError);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStar(courseId: string, nextStarred: boolean) {
    setSaving(true);
    try {
      await updateCourseLibrary({ courseId, isStarred: nextStarred });
      await loadSeries();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.detail.loadError);
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadQueued(request: DownloadRequest) {
    setDownloadFeedback({
      kind: "success",
      message: request.message ?? dictionary.downloads.queuedNotice
    });
  }

  if (isLoading) {
    return (
      <ConsoleShell locale={locale}>
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--pa-muted)]">
          {dictionary.auth.loading}
        </div>
      </ConsoleShell>
    );
  }

  if (series === null) {
    return (
      <ConsoleShell locale={locale}>
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="max-w-md rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4 text-sm text-[var(--pa-muted)]">
            <p>{error || dictionary.detail.loadError}</p>
            <button
              className="pa-focus mt-4 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-green)]"
              onClick={() => router.push(`/${locale}/series`)}
              type="button"
            >
              {dictionary.reading.backToList}
            </button>
          </div>
        </div>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell locale={locale}>
      <section className="mb-4 border-b border-[var(--pa-line)] pb-4">
        <h1 className="truncate text-lg font-semibold text-[var(--pa-ink)]">{series.title}</h1>
        <p className="mt-1 text-sm text-[var(--pa-muted)]">
          {series.article_count} {dictionary.series.articles}
          {` · ${dictionary.library.updatedAt}: ${formatDateTime(series.updated_at, locale)}`}
          {series.last_read_at
            ? ` · ${dictionary.library.lastReadAt}: ${formatDateTime(series.last_read_at, locale)}`
            : ` · ${dictionary.library.neverRead}`}
        </p>
      </section>

      {!isLoading && error ? <p className="mb-4 text-sm text-[var(--pa-error)]">{error}</p> : null}

      {downloadFeedback ? (
        <div
          className={[
            "mb-4 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm",
            downloadFeedback.kind === "success"
              ? "border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)] text-[var(--pa-green)]"
              : "border-[var(--pa-error-soft)] bg-[var(--pa-error-soft)] text-[var(--pa-error)]"
          ].join(" ")}
        >
          <span>{downloadFeedback.message}</span>
          {downloadFeedback.kind === "success" ? (
            <Link className="font-medium underline underline-offset-2" href={`/${locale}/jobs`}>
              {dictionary.downloads.viewTasks}
            </Link>
          ) : null}
        </div>
      ) : null}

      {sortedCourses.length > 0 ? (
        <section className="space-y-3">
          {sortedCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              href={courseHref(course)}
              locale={locale}
              onDelete={(courseId) => {
                void removeCourse(courseId);
              }}
              onDownloadQueued={handleDownloadQueued}
              onDownloadError={(message) => {
                setDownloadFeedback({ kind: "error", message });
              }}
              onToggleStar={(courseId, nextStarred) => {
                void toggleStar(courseId, nextStarred);
              }}
            />
          ))}
          </section>
      ) : (
        <section className="rounded-md border border-dashed border-[var(--pa-line)] bg-[var(--pa-surface)] p-5">
          <h2 className="text-base font-semibold">{dictionary.series.emptyTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pa-muted)]">{dictionary.series.emptyBody}</p>
        </section>
      )}
    </ConsoleShell>
  );
}
