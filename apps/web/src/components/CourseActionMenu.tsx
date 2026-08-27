"use client";

import { useState } from "react";
import {
  openDownloadUrl,
  requestCourseDownload,
  type CourseDownloadFormat
} from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";
import type { CourseBase, CourseSummary, DownloadRequest } from "@/lib/types";
import { OverflowMenu } from "./OverflowMenu";

type CourseMenuCourse = Pick<CourseBase, "id" | "title" | "status" | "is_starred" | "current_audio_url"> &
  Partial<CourseSummary>;

export function CourseActionMenu({
  course,
  dictionary,
  onDelete,
  onDownloadQueued,
  onDownloadError,
  onManageTags,
  onToggleStar,
  onTransferToSeries
}: {
  course: CourseMenuCourse;
  dictionary: Dictionary;
  onDelete?: (courseId: string) => void | Promise<void>;
  onDownloadQueued?: (request: DownloadRequest) => void;
  onDownloadError?: (message: string) => void;
  onManageTags?: () => void;
  onToggleStar?: (courseId: string, nextStarred: boolean) => void | Promise<void>;
  onTransferToSeries?: (courseId: string) => void;
}) {
  const [activeDownloadFormat, setActiveDownloadFormat] = useState<CourseDownloadFormat | null>(null);

  async function handleDownload(format: CourseDownloadFormat) {
    if (activeDownloadFormat !== null) {
      return;
    }
    setActiveDownloadFormat(format);
    try {
      const request = await requestCourseDownload(course.id, format);
      if (request.status === "ready" && request.download_url) {
        openDownloadUrl(request.download_url);
        return;
      }
      onDownloadQueued?.(request);
    } catch {
      onDownloadError?.(dictionary.downloads.error);
    } finally {
      setActiveDownloadFormat(null);
    }
  }

  const items = [
    {
      label: dictionary.downloads.markdown,
      disabled: activeDownloadFormat !== null,
      onSelect: () => {
        void handleDownload("markdown");
      }
    },
    {
      label: dictionary.downloads.word,
      disabled: activeDownloadFormat !== null,
      onSelect: () => {
        void handleDownload("docx");
      }
    },
    {
      label: dictionary.downloads.pdf,
      disabled: activeDownloadFormat !== null,
      onSelect: () => {
        void handleDownload("pdf");
      }
    },
    ...(course.status === "ready" && course.current_audio_url
      ? [
          {
            label: dictionary.downloads.audio,
            disabled: activeDownloadFormat !== null,
            onSelect: () => {
              void handleDownload("audio");
            }
          }
        ]
      : []),
    ...(onManageTags
      ? [
          {
            label: dictionary.detail.manageTags,
            onSelect: onManageTags
          }
        ]
      : []),
    ...(onTransferToSeries
      ? [
          {
            label: dictionary.detail.transferToSeries,
            onSelect: () => {
              onTransferToSeries(course.id);
            }
          }
        ]
      : []),
    ...(onToggleStar
      ? [
          {
            label: course.is_starred ? dictionary.library.unstar : dictionary.library.star,
            onSelect: () => {
              void onToggleStar(course.id, !course.is_starred);
            }
          }
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: dictionary.library.delete,
            destructive: true,
            onSelect: () => {
              void onDelete(course.id);
            }
          }
        ]
      : [])
  ];

  return <OverflowMenu ariaLabel={`${dictionary.library.moreActions}: ${course.title}`} items={items} />;
}
