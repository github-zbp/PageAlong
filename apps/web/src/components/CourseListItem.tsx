"use client";

import Link from "next/link";
import { formatContentCount, formatDateTime, formatDuration, formatProgressPercent } from "@/lib/format";
import { dictionaries, type Locale } from "@/lib/i18n";
import type { CourseSummary, DownloadRequest } from "@/lib/types";
import { CourseActionMenu } from "./CourseActionMenu";
import { StatusBadge } from "./StatusBadge";
import { TagChip } from "./TagChip";

function CourseTitleBlock({
  course,
  locale
}: {
  course: CourseSummary;
  locale: Locale;
}) {
  const dictionary = dictionaries[locale];
  const position = formatDuration(course.last_playback_position_seconds);
  const updated = formatDateTime(course.updated_at, locale);

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <StatusBadge locale={locale} status={course.status} />
        <h2 className="truncate text-[0.98rem] font-semibold text-[var(--pa-ink)]">{course.title}</h2>
      </div>
      <p className="mt-1 truncate text-xs text-[var(--pa-muted)]">
        {formatContentCount(course.word_count, course.word_count_unit, locale)} · {course.sentence_count}{" "}
        {dictionary.library.sentences}
        {updated ? ` · ${dictionary.library.updatedAt} ${updated}` : ""}
      </p>
      <p className="mt-1 text-xs text-[var(--pa-muted)]">
        {dictionary.library.lastPosition}: {position}
      </p>
      {course.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {course.tags.slice(0, 3).map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
          {course.tags.length > 3 ? (
            <span className="rounded-full bg-[var(--pa-muted-surface)] px-2 py-0.5 text-[0.68rem] text-[var(--pa-muted)]">
              +{course.tags.length - 3}
            </span>
          ) : null}
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
  onDownloadQueued,
  onDownloadError,
  onOpen,
  onSelectChange,
  onToggleStar,
  onTransferToSeries,
  selected
}: {
  active?: boolean;
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
  const dictionary = dictionaries[locale];
  const progress = formatProgressPercent(course.last_playback_position_seconds, course.duration_seconds);
  const shouldAutoplay = ["ready", "text_ready", "audio_generating"].includes(course.status);
  const defaultHref = `/${locale}/courses/${course.id}${shouldAutoplay ? "?autoplay=1" : ""}`;
  const rowClassName = [
    "group rounded-lg border p-3 transition",
    selected
      ? "border-[var(--pa-green)] bg-[var(--pa-green-soft)] shadow-sm"
      : active
        ? "border-[var(--pa-green)] bg-[var(--pa-green)] text-white shadow-sm"
        : "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-ink)] hover:border-[var(--pa-muted)] hover:shadow-sm"
  ].join(" ");

  const titleContent = <CourseTitleBlock course={course} locale={locale} />;
  const titleNode = onOpen ? (
    <button
      aria-label={`${dictionary.library.open}: ${course.title}`}
      className="block min-w-0 flex-1 text-left"
      onClick={() => onOpen(course)}
      type="button"
    >
      {titleContent}
    </button>
  ) : (
    <Link className="block min-w-0 flex-1" href={href ?? defaultHref}>
      {titleContent}
    </Link>
  );

  return (
    <article className={rowClassName}>
      <div className="flex min-w-0 gap-3">
        {onSelectChange ? (
          <label className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center">
            <input
              aria-label={`${dictionary.library.selected}: ${course.title}`}
              checked={selected ?? false}
              className="h-4 w-4 accent-[var(--pa-green)]"
              onChange={(event) => onSelectChange(course.id, event.target.checked)}
              type="checkbox"
            />
          </label>
        ) : null}

        <div className="min-w-0 flex-1">
          <div>{titleNode}</div>

          <div className="mt-3 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className={`h-1.5 overflow-hidden rounded-full ${active ? "bg-white/20" : "bg-[var(--pa-muted-surface)]"}`}>
                <div
                  className={active ? "h-full rounded-full bg-[var(--pa-surface)]" : "h-full rounded-full bg-[var(--pa-amber)]"}
                  style={{ width: progress }}
                />
              </div>
              <p className={`mt-1 text-xs ${active ? "text-white/70" : "text-[var(--pa-muted)]"}`}>{progress}</p>
            </div>
            <span className={`shrink-0 text-sm ${active ? "text-white/40" : "text-[var(--pa-line)]"}`}>|</span>
            <CourseActionMenu
              course={course}
              dictionary={dictionary}
              onDelete={onDelete}
              onDownloadError={onDownloadError}
              onDownloadQueued={onDownloadQueued}
              onToggleStar={onToggleStar}
              onTransferToSeries={onTransferToSeries}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
