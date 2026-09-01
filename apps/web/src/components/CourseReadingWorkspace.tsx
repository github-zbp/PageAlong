"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatDuration, formatProgressPercent } from "@/lib/format";
import { dictionaries, type Locale } from "@/lib/i18n";
import type { Course, CourseOutlineItem } from "@/lib/types";
import { CourseOutlineDrawer, CourseOutlineSidebar } from "./CourseOutlineSidebar";
import { LogoutIcon } from "./UiIcons";

function SidebarCourseButton({
  active,
  course,
  onClick,
  locale
}: {
  active: boolean;
  course: Course;
  onClick: () => void;
  locale: Locale;
}) {
  const dictionary = dictionaries[locale];
  return (
    <button
      aria-label={course.title}
      className={[
        "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
        active
          ? "border-[var(--pa-green)] bg-[var(--pa-green)] text-white"
          : "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-ink)] hover:border-[var(--pa-green)]"
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      <span className="block truncate font-medium">{course.title}</span>
      <span className={`mt-1 block text-xs ${active ? "text-white/75" : "text-[var(--pa-muted)]"}`}>
        {formatDuration(course.last_playback_position_seconds)} ·{" "}
        {formatProgressPercent(course.last_playback_position_seconds, course.duration_seconds)}
      </span>
      <span
        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.68rem] ${
          active ? "bg-white/15 text-white/80" : "bg-[var(--pa-muted-surface)] text-[var(--pa-muted)]"
        }`}
      >
        {dictionary.status[course.status as keyof typeof dictionary.status] ?? course.status}
      </span>
    </button>
  );
}

export function CourseReadingWorkspace({
  children,
  courses,
  activeCourse,
  isFullscreenMode,
  isOutlineOpen = false,
  locale,
  outline = [],
  title,
  onBack,
  onCloseOutline,
  onSelectCourse,
  onSelectOutlineItem
}: {
  children: ReactNode;
  courses: Course[];
  activeCourse: Course;
  isFullscreenMode: boolean;
  isOutlineOpen?: boolean;
  locale: Locale;
  outline?: CourseOutlineItem[];
  title: string;
  onBack: () => void;
  onCloseOutline?: () => void;
  onSelectCourse: (course: Course) => void;
  onSelectOutlineItem?: (itemId: string) => void;
}) {
  const dictionary = dictionaries[locale];
  const [query, setQuery] = useState("");
  const [visibleActiveCourse, setVisibleActiveCourse] = useState(activeCourse);
  const closeOutline = onCloseOutline ?? (() => undefined);
  const selectOutlineItem = onSelectOutlineItem ?? (() => undefined);
  const canShowOutline = isOutlineOpen && outline.length > 0 && onCloseOutline !== undefined && onSelectOutlineItem !== undefined;

  useEffect(() => {
    setVisibleActiveCourse(activeCourse);
  }, [activeCourse]);

  const visibleCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return courses;
    }
    return courses.filter((course) => course.title.toLowerCase().includes(normalizedQuery));
  }, [courses, query]);

  function selectCourse(course: Course) {
    setVisibleActiveCourse(course);
    onSelectCourse(course);
  }

  return (
    <div className="min-h-screen bg-[var(--pa-bg)] text-[var(--pa-ink)]">
      <div className="flex min-h-screen w-full flex-col md:flex-row">
        {!isFullscreenMode ? (
          canShowOutline ? (
            <aside
              aria-label={dictionary.reading.outline}
              className="hidden min-h-screen border-r border-[var(--pa-line)] bg-[var(--pa-muted-surface)] md:block md:w-72"
            >
              <CourseOutlineSidebar
                closeLabel={dictionary.reading.closeOutline}
                courseTitle={activeCourse.title}
                onClose={closeOutline}
                onSelect={selectOutlineItem}
                outline={outline}
                title={dictionary.reading.outline}
              />
            </aside>
          ) : (
            <aside
              data-reading-sidebar
              aria-label={dictionary.reading.articleList}
              className="hidden min-h-screen border-r border-[var(--pa-line)] bg-[var(--pa-muted-surface)] md:block md:w-72"
            >
              <div className="flex min-h-screen flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-xs text-[var(--pa-muted)]">{dictionary.reading.articleList}</p>
                  </div>
                  <button
                    aria-label={dictionary.reading.exitReading}
                    className="pa-focus flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-2.5 py-1.5 text-xs text-[var(--pa-ink)]"
                    onClick={onBack}
                    type="button"
                  >
                    <LogoutIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>{dictionary.reading.exitReading}</span>
                  </button>
                </div>

                <input
                  aria-label={dictionary.reading.filterArticles}
                  className="h-10 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 text-sm outline-none focus:border-[var(--pa-green)]"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={dictionary.reading.filterArticles}
                  type="search"
                  value={query}
                />

                <div className="flex flex-1 flex-col gap-2 overflow-auto">
                  {visibleCourses.length > 0 ? (
                    visibleCourses.map((course) => (
                      <SidebarCourseButton
                        active={course.id === visibleActiveCourse.id}
                        course={course}
                        key={course.id}
                        locale={locale}
                        onClick={() => selectCourse(course)}
                      />
                    ))
                  ) : (
                    <p className="rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-3 text-sm text-[var(--pa-muted)]">
                      {dictionary.reading.emptyList}
                    </p>
                  )}
                </div>
              </div>
            </aside>
          )
        ) : null}

        <main className="min-w-0 flex-1">
          <div className={isFullscreenMode ? "px-4 py-4 md:px-8 md:py-6" : "px-4 py-5 md:px-8 md:py-7"}>{children}</div>
        </main>
      </div>

      {canShowOutline ? (
        <CourseOutlineDrawer
          closeLabel={dictionary.reading.closeOutline}
          courseTitle={activeCourse.title}
          mobileOnly={!isFullscreenMode}
          onClose={closeOutline}
          onSelect={selectOutlineItem}
          open={isOutlineOpen}
          outline={outline}
          title={dictionary.reading.outline}
        />
      ) : null}
    </div>
  );
}
