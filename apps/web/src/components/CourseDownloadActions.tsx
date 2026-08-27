"use client";

import Link from "next/link";
import { useState } from "react";
import { openDownloadUrl, requestCourseDownload, type CourseDownloadFormat } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";
import type { CourseBase } from "@/lib/types";

type DownloadAction = {
  format: CourseDownloadFormat;
  label: string;
};

export function CourseDownloadActions({
  compact = false,
  course,
  dictionary,
  locale
}: {
  compact?: boolean;
  course: CourseBase;
  dictionary: Dictionary;
  locale: "zh" | "en";
}) {
  const [activeFormat, setActiveFormat] = useState<CourseDownloadFormat | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const actions: DownloadAction[] = [
    {
      format: "markdown",
      label: dictionary.downloads.markdown
    },
    {
      format: "docx",
      label: dictionary.downloads.word
    },
    {
      format: "pdf",
      label: dictionary.downloads.pdf
    }
  ];

  if (course.status === "ready" && course.current_audio_url) {
    actions.push({
      format: "audio",
      label: dictionary.downloads.audio
    });
  }

  async function download(format: CourseDownloadFormat) {
    setActiveFormat(format);
    setError("");
    setNotice("");
    try {
      const request = await requestCourseDownload(course.id, format);
      if (request.status === "ready" && request.download_url) {
        openDownloadUrl(request.download_url);
      } else {
        setNotice(dictionary.downloads.queuedNotice);
      }
    } catch {
      setError(dictionary.downloads.error);
    } finally {
      setActiveFormat(null);
    }
  }

  const buttonClassName = compact
    ? "pa-focus rounded-md border border-[var(--pa-line)] px-2.5 py-1.5 text-xs text-[var(--pa-muted)] hover:border-[var(--pa-green)] hover:text-[var(--pa-green)] disabled:opacity-50"
    : "pa-focus rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-green)] hover:border-[var(--pa-green)] disabled:opacity-50";

  return (
    <div className={compact ? "flex flex-wrap justify-end gap-2" : "flex flex-col gap-2"}>
      {!compact ? <p className="text-sm font-medium text-[var(--pa-muted)]">{dictionary.downloads.title}</p> : null}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            aria-label={compact ? `${action.label}: ${course.title}` : action.label}
            className={buttonClassName}
            disabled={activeFormat !== null}
            key={action.format}
            onClick={() => download(action.format)}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>
      {notice ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)] px-3 py-2 text-xs text-[var(--pa-green)]">
          <span>{notice}</span>
          <Link className="font-medium underline underline-offset-2" href={`/${locale}/jobs`}>
            {dictionary.downloads.viewTasks}
          </Link>
        </div>
      ) : null}
      {error ? <p className="text-xs text-[var(--pa-error)]">{error}</p> : null}
    </div>
  );
}
