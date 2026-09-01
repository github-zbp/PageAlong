"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLinkIcon, FullscreenExitIcon, FullscreenIcon, OutlineIcon, SettingsIcon } from "./UiIcons";
import { CourseDownloadActions } from "./CourseDownloadActions";
import { CoursePlayer } from "./CoursePlayer";
import { CourseRetryActions } from "./CourseRetryActions";
import { CourseReviewActions } from "./CourseReviewActions";
import { CourseTagEditor } from "./CourseTagEditor";
import { CourseMoveSeriesPanel } from "./CourseMoveSeriesPanel";
import { FloatingPanel } from "./FloatingPanel";
import { OverflowMenu } from "./OverflowMenu";
import { ReaderPreferencesControls } from "./ReaderPreferencesControls";
import { StatusBadge } from "./StatusBadge";
import { openDownloadUrl, requestCourseDownload, updateCourseLibrary } from "@/lib/api";
import { formatApproxReadingTime, formatContentCount } from "@/lib/format";
import { dictionaries, type Locale } from "@/lib/i18n";
import {
  READER_PREFERENCES_UPDATED_EVENT,
  readReaderPreferences,
  type ReaderPreferences,
  updateReaderPreferences
} from "@/lib/reader-preferences";
import type { Course } from "@/lib/types";

export function CourseDetailContent({
  autoplay = false,
  course,
  isFullscreen = false,
  isOutlineOpen = false,
  locale,
  onCourseChange,
  onToggleOutline,
  onToggleFullscreen,
  onReloadCourse
}: {
  autoplay?: boolean;
  course: Course;
  isFullscreen?: boolean;
  isOutlineOpen?: boolean;
  locale: Locale;
  onCourseChange: (course: Course) => void;
  onToggleOutline?: () => void;
  onToggleFullscreen?: () => void;
  onReloadCourse: () => void | Promise<void>;
}) {
  const dictionary = dictionaries[locale];
  const [activePanel, setActivePanel] = useState<"tags" | "series" | "preferences" | null>(null);
  const [transferSeriesTitle, setTransferSeriesTitle] = useState("");
  const [transferError, setTransferError] = useState("");
  const [isTransferring, setTransferring] = useState(false);
  const [activeDownloadFormat, setActiveDownloadFormat] = useState<string | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(
    null
  );
  const [preferences, setPreferences] = useState<ReaderPreferences>(() => readReaderPreferences());

  useEffect(() => {
    function syncPreferences() {
      setPreferences(readReaderPreferences());
    }

    syncPreferences();
    window.addEventListener(READER_PREFERENCES_UPDATED_EVENT, syncPreferences);
    return () => {
      window.removeEventListener(READER_PREFERENCES_UPDATED_EVENT, syncPreferences);
    };
  }, []);

  const canonicalLocator = course?.source?.canonical_locator || "";
  const canonicalLocatorIsLink = /^https?:\/\//i.test(canonicalLocator);
  const showExternalLink = Boolean(course?.source && canonicalLocatorIsLink && course.source.source_kind === "url");
  const outline = course.outline ?? [];

  const headerMeta = useMemo(() => {
    return [
      formatContentCount(course.word_count, course.word_count_unit, locale),
      `${course.sentences.length} ${dictionary.library.sentences}`,
      formatApproxReadingTime(course.estimated_reading_seconds, locale)
    ]
      .filter(Boolean)
      .join(" · ");
  }, [course.estimated_reading_seconds, course.sentences.length, course.word_count, course.word_count_unit, dictionary.library.sentences, locale]);

  const closePanel = useCallback(() => {
    setActivePanel(null);
    setTransferError("");
  }, []);

  const openTagPanel = useCallback(() => {
    setTransferError("");
    setActivePanel("tags");
  }, []);

  const openPreferencesPanel = useCallback(() => {
    setTransferError("");
    setPreferences(readReaderPreferences());
    setActivePanel("preferences");
  }, []);

  const openSeriesPanel = useCallback(() => {
    setTransferError("");
    setTransferSeriesTitle(course?.series_title ?? "");
    setActivePanel("series");
  }, [course?.series_title]);

  const requestDownload = useCallback(
    async (format: "markdown" | "docx" | "pdf" | "audio") => {
      if (activeDownloadFormat !== null) {
        return;
      }
      setActiveDownloadFormat(format);
      setDownloadFeedback(null);
      try {
        const request = await requestCourseDownload(course.id, format);
        if (request.status === "ready" && request.download_url) {
          openDownloadUrl(request.download_url);
        } else {
          setDownloadFeedback({ kind: "success", message: dictionary.downloads.queuedNotice });
        }
      } catch {
        setDownloadFeedback({ kind: "error", message: dictionary.downloads.error });
      } finally {
        setActiveDownloadFormat(null);
      }
    },
    [activeDownloadFormat, course.id, dictionary.downloads.error, dictionary.downloads.queuedNotice]
  );

  async function transferToSeries() {
    const title = transferSeriesTitle.trim();
    if (!title) {
      setTransferError(dictionary.detail.transferSeriesHelper);
      return;
    }
    setTransferring(true);
    setTransferError("");
    try {
      const updated = await updateCourseLibrary({
        courseId: course.id,
        libraryType: "series",
        seriesTitle: title
      });
      onCourseChange(updated);
      closePanel();
    } catch (caughtError) {
      setTransferError(caughtError instanceof Error ? caughtError.message : dictionary.detail.transferSeriesHelper);
    } finally {
      setTransferring(false);
    }
  }

  return (
    <>
      <header className="mb-5 border-b border-[var(--pa-line)] pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {onToggleFullscreen ? (
              <button
                aria-label={isFullscreen ? dictionary.reading.exitFullscreen : dictionary.reading.fullscreen}
                className="pa-focus inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)] hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
                onClick={onToggleFullscreen}
                type="button"
                title={isFullscreen ? dictionary.reading.exitFullscreen : dictionary.reading.fullscreen}
              >
                {isFullscreen ? <FullscreenExitIcon className="h-4 w-4" /> : <FullscreenIcon className="h-4 w-4" />}
              </button>
            ) : null}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold text-[var(--pa-ink)]">{course.title}</h1>
              <p className="mt-1 text-sm text-[var(--pa-muted)]">{headerMeta}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge
              href={course.status === "audio_generating" ? `/${locale}/jobs` : undefined}
              locale={locale}
              status={course.status}
            />
            {outline.length > 0 && onToggleOutline ? (
              <button
                aria-label={isOutlineOpen ? dictionary.reading.closeOutline : dictionary.reading.openOutline}
                aria-pressed={isOutlineOpen}
                className={[
                  "pa-focus inline-flex h-9 w-9 items-center justify-center rounded-md border bg-[var(--pa-surface)] hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]",
                  isOutlineOpen
                    ? "border-[var(--pa-green)] text-[var(--pa-green)]"
                    : "border-[var(--pa-line)] text-[var(--pa-muted)]"
                ].join(" ")}
                onClick={onToggleOutline}
                title={isOutlineOpen ? dictionary.reading.closeOutline : dictionary.reading.openOutline}
                type="button"
              >
                <OutlineIcon className="h-4 w-4" />
              </button>
            ) : null}
            {showExternalLink ? (
              <a
                aria-label={`${dictionary.detail.openOriginalPage}: ${canonicalLocator}`}
                className="pa-focus inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)] hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
                href={canonicalLocator}
                rel="noreferrer"
                target="_blank"
                title={`${dictionary.detail.openOriginalPage}\n${canonicalLocator}`}
              >
                <ExternalLinkIcon className="h-4 w-4" />
              </a>
            ) : null}
            <button
              aria-label={dictionary.reading.readerPreferences}
              className="pa-focus inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)] hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
              onClick={openPreferencesPanel}
              type="button"
              title={dictionary.reading.readerPreferences}
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
            <OverflowMenu
              ariaLabel={dictionary.detail.moreActions}
              items={[
                {
                  label: dictionary.downloads.markdown,
                  disabled: activeDownloadFormat !== null,
                  onSelect: () => {
                    void requestDownload("markdown");
                  }
                },
                {
                  label: dictionary.downloads.word,
                  disabled: activeDownloadFormat !== null,
                  onSelect: () => {
                    void requestDownload("docx");
                  }
                },
                {
                  label: dictionary.downloads.pdf,
                  disabled: activeDownloadFormat !== null,
                  onSelect: () => {
                    void requestDownload("pdf");
                  }
                },
                ...(course.status === "ready" && course.current_audio_url
                  ? [
                      {
                        label: dictionary.downloads.audio,
                        disabled: activeDownloadFormat !== null,
                        onSelect: () => {
                          void requestDownload("audio");
                        }
                      }
                    ]
                  : []),
                {
                  label: dictionary.detail.manageTags,
                  onSelect: openTagPanel
                },
                {
                  label: dictionary.detail.transferToSeries,
                  onSelect: openSeriesPanel
                }
              ]}
            />
          </div>
        </div>
      </header>

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

      {course.status === "needs_review" ? (
        <CourseReviewActions courseId={course.id} dictionary={dictionary} onConfirmed={onReloadCourse} />
      ) : null}

      {course.status === "failed" ? (
        <CourseRetryActions
          courseId={course.id}
          dictionary={dictionary}
          failedReason={course.failed_reason}
          onRetried={onReloadCourse}
        />
      ) : null}

      <CoursePlayer
        course={course}
        locale={locale}
        autoplay={autoplay}
        outline={outline}
        showReaderPreferencesSection={false}
        showSourceInfo={false}
      />

      <div className="mt-5">
        <CourseDownloadActions compact course={course} dictionary={dictionary} locale={locale} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-2 text-sm text-[var(--pa-green)]" href={`/${locale}/library`}>
          {dictionary.detail.backToLibrary}
        </Link>
        <Link className="pa-focus rounded-md bg-[var(--pa-green)] px-3 py-2 text-sm text-white" href={`/${locale}/jobs`}>
          {dictionary.detail.viewJobs}
        </Link>
      </div>

      <FloatingPanel
        closeLabel={dictionary.common.close}
        onClose={closePanel}
        open={activePanel === "tags"}
        position="right"
        title={dictionary.detail.manageTags}
      >
        <CourseTagEditor course={course} embedded locale={locale} onCourseChange={onCourseChange} />
      </FloatingPanel>

      <CourseMoveSeriesPanel
        dictionary={dictionary}
        error={transferError}
        isSaving={isTransferring}
        onChangeSeriesTitle={setTransferSeriesTitle}
        onClose={closePanel}
        onConfirm={() => {
          void transferToSeries();
        }}
        open={activePanel === "series"}
        seriesTitle={transferSeriesTitle}
      />

      <FloatingPanel
        closeLabel={dictionary.common.close}
        onClose={closePanel}
        open={activePanel === "preferences"}
        position="right"
        title={dictionary.reading.readerPreferences}
      >
        <div className="space-y-4">
          <ReaderPreferencesControls
            locale={locale}
            onChange={(next) => {
              const updated = updateReaderPreferences({ ...preferences, ...next });
              setPreferences(updated);
            }}
            preferences={preferences}
          />
        </div>
      </FloatingPanel>
    </>
  );
}
