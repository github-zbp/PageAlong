"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createUrlCourse, getCourse, requestCourseAudioGeneration, retryFailedCourseJob } from "@/lib/api";
import { formatApproxReadingTime, formatContentCount } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { Course } from "@/lib/types";
import { MarkdownReader } from "./MarkdownReader";
import { SeriesAutocompleteField } from "./SeriesAutocompleteField";

const ACTIVE_URL_IMPORT_COURSE_KEY = "pagealong.activeUrlImportCourseId";

class ImportPollingCancelled extends Error {}

function readActiveUrlImportCourseId(): string {
  try {
    return window.localStorage.getItem(ACTIVE_URL_IMPORT_COURSE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeActiveUrlImportCourseId(courseId: string): void {
  try {
    window.localStorage.setItem(ACTIVE_URL_IMPORT_COURSE_KEY, courseId);
  } catch {
    return;
  }
}

function clearActiveUrlImportCourseId(): void {
  try {
    window.localStorage.removeItem(ACTIVE_URL_IMPORT_COURSE_KEY);
  } catch {
    return;
  }
}

export function ImportUrlForm({
  dictionary,
  locale
}: {
  dictionary: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const isCancelledRef = useRef(false);
  const latestCourseRef = useRef<Course | null>(null);
  const [url, setUrl] = useState("");
  const [seriesTitle, setSeriesTitle] = useState("");
  const [phase, setPhase] = useState<"idle" | "submitting" | "extracting" | "review" | "confirming" | "failed">(
    "idle"
  );
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    isCancelledRef.current = false;
    void restoreActiveImport();
    return () => {
      isCancelledRef.current = true;
    };
  }, []);

  function setLivePhase(nextPhase: typeof phase) {
    if (!isCancelledRef.current) {
      setPhase(nextPhase);
    }
  }

  function setLiveError(nextError: string) {
    if (!isCancelledRef.current) {
      setError(nextError);
    }
  }

  function setLiveCourse(nextCourse: Course) {
    latestCourseRef.current = nextCourse;
    if (!isCancelledRef.current) {
      setCourse(nextCourse);
    }
  }

  function previewMarkdown(nextCourse: Course): string {
    return nextCourse.content_markdown?.trim() || nextCourse.sentences.map((sentence) => sentence.text).join("\n\n");
  }

  function isReviewReady(nextCourse: Course): boolean {
    return nextCourse.status === "needs_review" && previewMarkdown(nextCourse).trim().length > 0;
  }

  function delay(milliseconds: number) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function restoreActiveImport() {
    const activeCourseId = readActiveUrlImportCourseId();
    if (!activeCourseId) {
      return;
    }
    setLivePhase("extracting");
    setLiveError("");
    try {
      const restoredCourse = await getCourse(activeCourseId);
      setLiveCourse(restoredCourse);
      if (isReviewReady(restoredCourse)) {
        setLivePhase("review");
        return;
      }
      if (restoredCourse.status === "failed") {
        setLiveError(restoredCourse.import_error_message || restoredCourse.failed_reason || dictionary.import.urlError);
        setLivePhase("failed");
        return;
      }
      if (restoredCourse.status === "audio_generating" || restoredCourse.status === "ready") {
        clearActiveUrlImportCourseId();
        setLivePhase("idle");
        return;
      }
      const reviewedCourse = await waitForReview(activeCourseId);
      setLiveCourse(reviewedCourse);
      setLivePhase("review");
    } catch (caughtError) {
      setLiveError(caughtError instanceof Error ? caughtError.message : dictionary.import.urlError);
      setLivePhase(latestCourseRef.current?.status === "failed" ? "failed" : "idle");
    }
  }

  async function waitForReview(courseId: string): Promise<Course> {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      if (isCancelledRef.current) {
        throw new ImportPollingCancelled();
      }
      const nextCourse = await getCourse(courseId);
      setLiveCourse(nextCourse);
      if (isReviewReady(nextCourse)) {
        return nextCourse;
      }
      if (nextCourse.status === "failed") {
        throw new Error(nextCourse.import_error_message || nextCourse.failed_reason || dictionary.import.urlError);
      }
      await delay(1200);
    }
    throw new Error(dictionary.import.urlPollTimeout);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLivePhase("submitting");
    setLiveError("");
    try {
      const createdCourse = await createUrlCourse({ url, seriesTitle: seriesTitle.trim() || undefined });
      writeActiveUrlImportCourseId(createdCourse.id);
      setLiveCourse(createdCourse);
      if (isReviewReady(createdCourse)) {
        setLivePhase("review");
        return;
      }
      setLivePhase("extracting");
      const reviewedCourse = await waitForReview(createdCourse.id);
      setLiveCourse(reviewedCourse);
      setLivePhase("review");
    } catch (caughtError) {
      if (caughtError instanceof ImportPollingCancelled) {
        return;
      }
      setLiveError(caughtError instanceof Error ? caughtError.message : dictionary.import.urlError);
      setLivePhase(latestCourseRef.current?.status === "failed" ? "failed" : "idle");
    }
  }

  async function retryFailedImport() {
    if (course === null) {
      return;
    }
    setLivePhase("extracting");
    setLiveError("");
    try {
      await retryFailedCourseJob(course.id);
      const reviewedCourse = await waitForReview(course.id);
      setLiveCourse(reviewedCourse);
      setLivePhase("review");
    } catch (caughtError) {
      if (caughtError instanceof ImportPollingCancelled) {
        return;
      }
      setLiveError(caughtError instanceof Error ? caughtError.message : dictionary.detail.retryError);
      setLivePhase(latestCourseRef.current?.status === "failed" ? "failed" : "idle");
    }
  }

  async function confirmAudioGeneration() {
    if (course === null) {
      return;
    }
    setLivePhase("confirming");
    setLiveError("");
    try {
      await requestCourseAudioGeneration(course.id);
      clearActiveUrlImportCourseId();
      router.push(`/${locale}/courses/${course.id}`);
    } catch (caughtError) {
      setLiveError(caughtError instanceof Error ? caughtError.message : dictionary.detail.confirmError);
      setLivePhase("review");
    }
  }

  const isBusy = phase === "submitting" || phase === "extracting" || phase === "confirming";
  const cleanedMarkdown = course ? previewMarkdown(course) : "";
  const sourceLabel =
    course?.source?.source_domain ||
    course?.source?.canonical_locator ||
    course?.source?.final_url ||
    course?.source?.locator ||
    "";

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3 rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
        <input
          className="w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-base outline-none focus:border-[var(--pa-green)] disabled:bg-[var(--pa-muted-surface)]"
          disabled={isBusy}
          placeholder={dictionary.import.urlPlaceholder}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
          type="url"
        />
        <SeriesAutocompleteField dictionary={dictionary} value={seriesTitle} onChange={setSeriesTitle} />
        {error && phase !== "failed" ? <p className="text-sm text-[var(--pa-error)]">{error}</p> : null}
        <button
          className="pa-focus rounded-md bg-[var(--pa-green)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={isBusy}
          type="submit"
        >
          {phase === "submitting" || phase === "extracting" ? dictionary.import.urlSubmitting : dictionary.import.urlSubmit}
        </button>
      </form>

      {phase === "extracting" ? (
        <div className="rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4" role="status">
          <p className="text-sm font-medium text-[var(--pa-ink)]">{dictionary.import.urlExtractingTitle}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">{dictionary.import.urlExtractingBody}</p>
        </div>
      ) : null}

      {phase === "failed" && course !== null ? (
        <div className="rounded-lg border border-[var(--pa-error-soft)] bg-[var(--pa-error-soft)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--pa-ink)]">{dictionary.detail.failedTitle}</p>
              {error ? <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">{error}</p> : null}
            </div>
            <button
              className="pa-focus w-full rounded-md bg-[var(--pa-green)] px-4 py-2 text-sm font-medium text-white sm:w-auto"
              onClick={retryFailedImport}
              type="button"
            >
              {dictionary.detail.retry}
            </button>
          </div>
        </div>
      ) : null}

      {(phase === "review" || phase === "confirming") && course !== null ? (
        <section className="space-y-3">
          <div className="rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--pa-ink)]">{dictionary.import.urlReviewTitle}</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">{dictionary.import.urlReviewBody}</p>
                <p className="mt-2 text-xs text-[var(--pa-muted)]">
                  {[
                    formatContentCount(course.word_count, course.word_count_unit, locale),
                    `${course.sentences.length} ${dictionary.library.sentences}`,
                    formatApproxReadingTime(course.estimated_reading_seconds, locale)
                  ].filter(Boolean).join(" · ")}
                </p>
                {sourceLabel ? <p className="mt-2 text-xs text-[var(--pa-muted)]">{sourceLabel}</p> : null}
              </div>
              <button
                className="pa-focus w-full rounded-md bg-[var(--pa-green)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
                disabled={phase === "confirming"}
                onClick={confirmAudioGeneration}
                type="button"
              >
                {phase === "confirming" ? dictionary.import.urlConfirming : dictionary.import.urlConfirm}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[var(--pa-muted)]">{dictionary.import.urlPreviewTitle}</h3>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
              <MarkdownReader
                markdown={cleanedMarkdown}
                sentences={[]}
                activeSentenceIndex={-1}
                onSelectSentence={() => undefined}
              />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
