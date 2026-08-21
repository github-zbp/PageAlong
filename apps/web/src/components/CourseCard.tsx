import { type Locale } from "@/lib/i18n";
import type { CourseSummary } from "@/lib/types";
import { CourseListItem } from "./CourseListItem";

export function CourseCard({
  course,
  locale,
  onDelete,
  onOpen,
  onToggleStar
}: {
  course: CourseSummary;
  locale: Locale;
  onDelete: (courseId: string) => void;
  onOpen?: (course: CourseSummary) => void;
  onToggleStar?: (course: CourseSummary) => void;
}) {
  return (
    <CourseListItem
      course={course}
      locale={locale}
      onDelete={onDelete}
      onOpen={onOpen}
      onToggleStar={onToggleStar}
    />
  );
}
