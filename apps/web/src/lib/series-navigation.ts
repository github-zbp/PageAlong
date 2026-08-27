import type { Locale } from "@/lib/i18n";
import type { Course, CourseSeriesDetail } from "@/lib/types";

export function seriesCourseHref(locale: Locale, seriesId: string, courseId: string): string {
  return `/${locale}/series/${seriesId}/courses/${courseId}`;
}

export function seriesCoursesHref(locale: Locale, seriesId: string): string {
  return `/${locale}/series/${seriesId}/courses`;
}

export function pickSeriesCourse(detail: CourseSeriesDetail, preferredCourseId?: string | null): Course | null {
  return (
    detail.courses.find((course) => course.id === preferredCourseId) ??
    detail.courses.find((course) => course.id === detail.last_read_course_id) ??
    detail.courses.find((course) => course.id === detail.latest_course_id) ??
    detail.courses[0] ??
    null
  );
}
