"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatDuration, formatProgressPercent } from "@/lib/format";
import { dictionaries, type Locale } from "@/lib/i18n";
import type { Course } from "@/lib/types";
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
  locale,
  title,
  onBack,
  onSelectCourse
}: {
  children: ReactNode;
  courses: Course[];
  activeCourse: Course;
  isFullscreenMode: boolean;
  locale: Locale;
  title: string;
  onBack: () => void;
  onSelectCourse: (course: Course) => void;
}) {
  const dictionary = dictionaries[locale];
  const [query, setQuery] = useState("");
  const [visibleActiveCourse, setVisibleActiveCourse] = useState(activeCourse);
  const [isMobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    setVisibleActiveCourse(activeCourse);
  }, [activeCourse]);

  useEffect(() => {
    if (isFullscreenMode) {
      setMobileDrawerOpen(false);
    }
  }, [isFullscreenMode]);

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
    setMobileDrawerOpen(false);
  }

  return (
    <div className="min-h-screen bg-[var(--pa-bg)] text-[var(--pa-ink)]">
      <div className="flex min-h-screen w-full flex-col md:flex-row">
        {!isFullscreenMode ? (
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
                  className="pa-focus flex items-center gap-2 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-ink)]"
                  onClick={onBack}
                  type="button"
                >
                  <LogoutIcon className="h-4 w-4" />
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
        ) : null}

        <main className="min-w-0 flex-1">
          {isFullscreenMode ? (
            <div className="sticky top-0 z-20 border-b border-[var(--pa-line)] bg-[var(--pa-bg)]/95 px-4 py-3 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{title}</p>
                </div>
                <button
                  className="pa-focus rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-ink)]"
                  onClick={onBack}
                  type="button"
                >
                  {dictionary.reading.backToList}
                </button>
              </div>
            </div>
          ) : (
            <div className="sticky top-0 z-20 border-b border-[var(--pa-line)] bg-[var(--pa-bg)]/95 px-4 py-3 backdrop-blur md:hidden">
              <div className="flex items-center justify-between gap-3">
                <button
                  className="pa-focus rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-ink)]"
                  onClick={onBack}
                  type="button"
                >
                  {dictionary.reading.backToList}
                </button>
                <button
                  className="pa-focus rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-green)]"
                  onClick={() => setMobileDrawerOpen(true)}
                  type="button"
                >
                  {dictionary.reading.openArticleList}
                </button>
              </div>
            </div>
          )}

          <div className={isFullscreenMode ? "px-4 py-4 md:px-8 md:py-6" : "px-4 py-5 md:px-8 md:py-7"}>{children}</div>
        </main>
      </div>

      {isMobileDrawerOpen ? (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" role="dialog" aria-label={dictionary.reading.articleList}>
          <div className="ml-auto flex h-full w-[86vw] max-w-sm flex-col bg-[var(--pa-surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--pa-line)] p-4">
              <div>
                <p className="text-sm font-semibold text-[var(--pa-ink)]">{dictionary.reading.articleList}</p>
                <p className="text-xs text-[var(--pa-muted)]">{title}</p>
              </div>
              <button
                className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-2 text-sm text-[var(--pa-muted)]"
                onClick={() => setMobileDrawerOpen(false)}
                type="button"
              >
                {dictionary.reading.closeArticleList}
              </button>
            </div>
            <div className="border-b border-[var(--pa-line)] p-4">
              <input
                aria-label={dictionary.reading.filterArticles}
                className="h-10 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 text-sm outline-none focus:border-[var(--pa-green)]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={dictionary.reading.filterArticles}
                value={query}
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-4">
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
                <p className="rounded-lg border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] p-3 text-sm text-[var(--pa-muted)]">
                  {dictionary.reading.emptyList}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
