import Link from "next/link";
import { formatContentCount, formatDateTime, formatDuration, formatProgressPercent } from "@/lib/format";
import { dictionaries, type Locale } from "@/lib/i18n";
import type { CourseSummary } from "@/lib/types";
import { CourseDownloadActions } from "./CourseDownloadActions";
import { StatusBadge } from "./StatusBadge";

function primaryActionLabel(status: string, locale: Locale): string {
  if (locale === "zh") {
    if (status === "ready") {
      return "继续";
    }
    if (status === "needs_review") {
      return "确认";
    }
    if (status === "failed") {
      return "查看";
    }
    return "打开";
  }
  if (status === "ready") {
    return "Continue";
  }
  if (status === "needs_review") {
    return "Review";
  }
  if (status === "failed") {
    return "View";
  }
  return "Open";
}

function CourseTitleBlock({
  course,
  locale,
  active
}: {
  course: CourseSummary;
  locale: Locale;
  active?: boolean;
}) {
  const dictionary = dictionaries[locale];
  const position = formatDuration(course.last_playback_position_seconds);
  const updated = formatDateTime(course.updated_at, locale);

  return (
    <div className="min-w-0">
      <h2 className={`truncate text-[0.98rem] font-semibold ${active ? "text-white" : "text-[#1f1a14]"}`}>
        {course.title}
      </h2>
      <p className={`mt-1 truncate text-xs ${active ? "text-white/75" : "text-[#70685e]"}`}>
        {formatContentCount(course.word_count, course.word_count_unit, locale)} · {course.sentence_count}{" "}
        {dictionary.library.sentences}
        {updated ? ` · ${dictionary.library.updatedAt} ${updated}` : ""}
      </p>
      <p className={`mt-1 text-xs ${active ? "text-white/70" : "text-[#70685e]"}`}>
        {dictionary.library.lastPosition}: {position}
      </p>
      {course.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {course.tags.slice(0, 3).map((tag) => (
            <span
              className={`rounded-full px-2 py-0.5 text-[0.68rem] ${
                active ? "bg-white/15 text-white/80" : "bg-[#f3ede2] text-[#70685e]"
              }`}
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CourseListItem({
  active,
  course,
  href,
  locale,
  onDelete,
  onOpen,
  onToggleStar
}: {
  active?: boolean;
  course: CourseSummary;
  href?: string;
  locale: Locale;
  onDelete?: (courseId: string) => void;
  onOpen?: (course: CourseSummary) => void;
  onToggleStar?: (course: CourseSummary) => void;
}) {
  const dictionary = dictionaries[locale];
  const progress = formatProgressPercent(
    course.last_playback_position_seconds,
    course.duration_seconds
  );
  const shouldAutoplay = ["ready", "text_ready", "audio_generating"].includes(course.status);
  const defaultHref = `/${locale}/courses/${course.id}${shouldAutoplay ? "?autoplay=1" : ""}`;
  const rowClassName = [
    "group rounded-lg border p-3 transition",
    active
      ? "border-[#2f6f5e] bg-[#2f6f5e] text-white shadow-sm"
      : "border-[#ddd2c1] bg-[#fffdf8] text-[#1f1a14] hover:border-[#bfae97] hover:shadow-sm"
  ].join(" ");

  const content = (
    <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center">
      <CourseTitleBlock active={active} course={course} locale={locale} />
      <div className="min-w-0">
        <div className={`h-1.5 overflow-hidden rounded-full ${active ? "bg-white/20" : "bg-[#ede3d4]"}`}>
          <div
            className={active ? "h-full rounded-full bg-white" : "h-full rounded-full bg-[#c98a2e]"}
            style={{ width: progress }}
          />
        </div>
        <p className={`mt-1 text-xs ${active ? "text-white/70" : "text-[#70685e]"}`}>{progress}</p>
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <StatusBadge locale={locale} status={course.status} />
        <span
          className={`rounded-md px-3 py-2 text-xs font-semibold ${
            active ? "bg-white text-[#245447]" : "bg-[#2f6f5e] text-white"
          }`}
        >
          {primaryActionLabel(course.status, locale)}
        </span>
      </div>
    </div>
  );

  return (
    <article className={rowClassName}>
      <div className="flex min-w-0 flex-col gap-3">
        {onOpen ? (
          <button
            type="button"
            className="min-w-0 text-left"
            onClick={() => onOpen(course)}
            aria-label={`${dictionary.library.open}: ${course.title}`}
          >
            {content}
          </button>
        ) : (
          <Link href={href ?? defaultHref} className="min-w-0">
            {content}
          </Link>
        )}
        {!active ? (
          <div className="flex flex-col gap-2 border-t border-[#eee5d8] pt-2 sm:flex-row sm:items-center sm:justify-between">
            <CourseDownloadActions compact course={course} dictionary={dictionary} />
            <div className="flex justify-end gap-2">
              {onToggleStar ? (
                <button
                  className="pa-focus rounded-md border border-[#ddd2c1] px-2.5 py-1.5 text-xs text-[#70685e] hover:border-[#2f6f5e] hover:text-[#245447]"
                  onClick={() => onToggleStar(course)}
                  type="button"
                >
                  {course.is_starred ? dictionary.library.unstar : dictionary.library.star}
                </button>
              ) : null}
              {onDelete ? (
                <button
                  className="pa-focus rounded-md border border-[#ddd2c1] px-2.5 py-1.5 text-xs text-[#70685e] hover:border-[#b42318] hover:text-[#b42318]"
                  onClick={() => onDelete(course.id)}
                  type="button"
                >
                  {dictionary.library.delete}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
