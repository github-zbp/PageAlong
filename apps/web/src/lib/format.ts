import type { Locale } from "./i18n";

export function formatDuration(totalSeconds: number | null | undefined): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds ?? 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatDateTime(value: string | null, locale: Locale): string {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatProgressPercent(positionSeconds: number, durationSeconds: number): string {
  if (durationSeconds <= 0 || positionSeconds <= 0) {
    return "0%";
  }
  const percent = Math.min(100, Math.max(0, Math.round((positionSeconds / durationSeconds) * 100)));
  return `${percent}%`;
}

export function formatContentCount(
  count: number,
  unit: "characters" | "words" | null | undefined,
  locale: Locale
): string {
  if (unit === "words") {
    return locale === "zh" ? `${count} 单词` : `${count} words`;
  }
  return locale === "zh" ? `${count} 字` : `${count} characters`;
}

export function formatApproxReadingTime(totalSeconds: number | null | undefined, locale: Locale): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds ?? 0));
  if (safeSeconds <= 0) {
    return "";
  }
  const minutes = Math.max(1, Math.ceil(safeSeconds / 60));
  return locale === "zh" ? `约 ${minutes} 分钟阅读` : `~${minutes} min read`;
}
