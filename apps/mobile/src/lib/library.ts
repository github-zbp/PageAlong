import type { CourseSummary } from "@/lib/api";
import type { LocalePreference } from "@/lib/preferences";

export function courseProgress(
  course: Pick<CourseSummary, "duration_seconds" | "last_playback_position_seconds">
): number {
  if (course.duration_seconds <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, course.last_playback_position_seconds / course.duration_seconds));
}

export function formatCourseMeta(
  course: Pick<CourseSummary, "word_count" | "word_count_unit" | "sentence_count">,
  locale: LocalePreference = "zh"
): string {
  const isEnglish = locale === "en";
  const wordUnit = isEnglish ? (course.word_count_unit === "words" ? "words" : "characters") : course.word_count_unit === "words" ? "词" : "字";
  const parts = [`${new Intl.NumberFormat(isEnglish ? "en-US" : "zh-CN").format(course.word_count)} ${wordUnit}`];
  if (typeof course.sentence_count === "number") {
    parts.push(`${new Intl.NumberFormat(isEnglish ? "en-US" : "zh-CN").format(course.sentence_count)} ${isEnglish ? "sentences" : "句"}`);
  }
  return parts.join(" · ");
}

export function formatUpdatedDate(value: string | null | undefined, locale: LocalePreference = "zh"): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    month: locale === "en" ? "short" : "numeric",
    day: "numeric"
  }).format(date);
}
