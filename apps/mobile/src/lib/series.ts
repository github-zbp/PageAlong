import type { CourseSeries } from "@/lib/api";

export function pickSeriesReadCourseId(series: Pick<CourseSeries, "last_read_course_id" | "latest_course_id">): string | null {
  return series.last_read_course_id ?? series.latest_course_id ?? null;
}
