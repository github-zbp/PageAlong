"use client";

import { useState } from "react";
import { downloadCourseToBrowser, type CourseDownloadFormat } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";
import type { CourseBase } from "@/lib/types";

type DownloadAction = {
  format: CourseDownloadFormat;
  label: string;
  shortLabel: string;
};

export function CourseDownloadActions({
  compact = false,
  course,
  dictionary
}: {
  compact?: boolean;
  course: CourseBase;
  dictionary: Dictionary;
}) {
  const [activeFormat, setActiveFormat] = useState<CourseDownloadFormat | null>(null);
  const [error, setError] = useState("");
  const actions: DownloadAction[] = [
    {
      format: "markdown",
      label: dictionary.downloads.markdown,
      shortLabel: dictionary.downloads.markdownShort
    },
    {
      format: "docx",
      label: dictionary.downloads.word,
      shortLabel: dictionary.downloads.wordShort
    },
    {
      format: "pdf",
      label: dictionary.downloads.pdf,
      shortLabel: dictionary.downloads.pdfShort
    }
  ];

  if (course.status === "ready" && course.current_audio_url) {
    actions.push({
      format: "audio",
      label: dictionary.downloads.audio,
      shortLabel: dictionary.downloads.audioShort
    });
  }

  async function download(format: CourseDownloadFormat) {
    setActiveFormat(format);
    setError("");
    try {
      await downloadCourseToBrowser(course.id, format);
    } catch {
      setError(dictionary.downloads.error);
    } finally {
      setActiveFormat(null);
    }
  }

  const buttonClassName = compact
    ? "pa-focus rounded-md border border-[#ddd2c1] px-2.5 py-1.5 text-xs text-[#70685e] hover:border-[#2f6f5e] hover:text-[#245447] disabled:opacity-50"
    : "pa-focus rounded-md border border-[#ddd2c1] bg-[#fffdf8] px-3 py-2 text-sm text-[#245447] hover:border-[#2f6f5e] disabled:opacity-50";

  return (
    <div className={compact ? "flex flex-wrap justify-end gap-2" : "flex flex-col gap-2"}>
      {!compact ? <p className="text-sm font-medium text-[#70685e]">{dictionary.downloads.title}</p> : null}
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
            {compact ? action.shortLabel : action.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-xs text-[#b42318]">{error}</p> : null}
    </div>
  );
}
