import { type Locale } from "@/lib/i18n";
import type { CourseSummary, DownloadRequest } from "@/lib/types";
import { CourseListItem } from "./CourseListItem";

export function CourseCard({
  course,
  href,
  locale,
  onDelete,
  onDownloadQueued,
  onDownloadError,
  onOpen,
  onSelectChange,
  onToggleStar,
  onTransferToSeries,
  selected
}: {
  course: CourseSummary;
  href?: string;
  locale: Locale;
  onDelete?: (courseId: string) => void | Promise<void>;
  onDownloadQueued?: (request: DownloadRequest) => void;
  onDownloadError?: (message: string) => void;
  onOpen?: (course: CourseSummary) => void;
  onSelectChange?: (courseId: string, nextSelected: boolean) => void;
  onToggleStar?: (courseId: string, nextStarred: boolean) => void | Promise<void>;
  onTransferToSeries?: (courseId: string) => void;
  selected?: boolean;
}) {
  return (
    <CourseListItem
      course={course}
      href={href}
      locale={locale}
      onDelete={onDelete}
      onDownloadQueued={onDownloadQueued}
      onDownloadError={onDownloadError}
      onOpen={onOpen}
      onSelectChange={onSelectChange}
      onToggleStar={onToggleStar}
      onTransferToSeries={onTransferToSeries}
      selected={selected}
    />
  );
}
