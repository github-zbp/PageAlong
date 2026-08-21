"use client";

import { useEffect, useMemo, useState } from "react";
import { dictionaries, type Locale } from "@/lib/i18n";
import type { Course } from "@/lib/types";
import { CoursePlayer } from "./CoursePlayer";
import { CourseRetryActions } from "./CourseRetryActions";
import { StatusBadge } from "./StatusBadge";
import { readReaderPreferences, updateReaderPreferences } from "@/lib/reader-preferences";
import { formatApproxReadingTime, formatContentCount, formatDuration, formatProgressPercent } from "@/lib/format";

function SidebarCourseButton({
  active,
  course,
  onClick,
  collapsed,
  locale
}: {
  active: boolean;
  course: Course;
  onClick: () => void;
  collapsed: boolean;
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
      {collapsed ? (
        <div className="flex h-8 items-center justify-center font-semibold">
          {course.title.slice(0, 1)}
        </div>
      ) : (
        <>
          <span className="block truncate font-medium">{course.title}</span>
          <span className={`mt-1 block text-xs ${active ? "text-white/75" : "text-[var(--pa-muted)]"}`}>
            {formatDuration(course.last_playback_position_seconds)} ·{" "}
            {formatProgressPercent(course.last_playback_position_seconds, course.duration_seconds)}
          </span>
          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.68rem] ${
            active ? "bg-white/15 text-white/80" : "bg-[var(--pa-muted-surface)] text-[var(--pa-muted)]"
          }`}>
            {dictionary.status[course.status as keyof typeof dictionary.status] ?? course.status}
          </span>
        </>
      )}
    </button>
  );
}

export function CourseReadingWorkspace({
  courses,
  activeCourse,
  locale,
  title,
  onBack,
  onSelectCourse
}: {
  courses: Course[];
  activeCourse: Course;
  locale: Locale;
  title: string;
  onBack: () => void;
  onSelectCourse: (course: Course) => void;
}) {
  const dictionary = dictionaries[locale];
  const [query, setQuery] = useState("");
  const [visibleActiveCourse, setVisibleActiveCourse] = useState(activeCourse);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(() => readReaderPreferences().sidebarCollapsed);
  const [isMobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    setVisibleActiveCourse(activeCourse);
  }, [activeCourse]);

  useEffect(() => {
    updateReaderPreferences({ sidebarCollapsed: isSidebarCollapsed });
  }, [isSidebarCollapsed]);

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
      <div className="grid min-h-screen md:grid-cols-[auto_1fr]">
        <aside
          aria-label={dictionary.reading.articleList}
          data-collapsed={isSidebarCollapsed}
          data-reading-sidebar
          className={[
            "hidden border-r border-[var(--pa-line)] bg-[var(--pa-muted-surface)] md:block",
            isSidebarCollapsed ? "w-16" : "w-72"
          ].join(" ")}
        >
          <div className="flex min-h-screen flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              {!isSidebarCollapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs text-[var(--pa-muted)]">{dictionary.reading.articleList}</p>
                </div>
              ) : (
                <div className="h-10 w-10 rounded-lg bg-[var(--pa-surface)]" />
              )}
              <button
                className="pa-focus rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-ink)]"
                onClick={() => setSidebarCollapsed((value) => !value)}
                type="button"
              >
                {isSidebarCollapsed ? dictionary.reading.expandArticleList : dictionary.reading.collapseArticleList}
              </button>
            </div>

            {!isSidebarCollapsed ? (
              <input
                aria-label={dictionary.reading.filterArticles}
                className="h-10 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 text-sm outline-none focus:border-[var(--pa-green)]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={dictionary.reading.filterArticles}
                type="search"
                value={query}
              />
            ) : null}

            <div className={isSidebarCollapsed ? "flex flex-1 flex-col gap-2" : "flex flex-1 flex-col gap-2 overflow-auto"}>
              {visibleCourses.length > 0 ? (
                visibleCourses.map((course) => (
                  <SidebarCourseButton
                    active={course.id === visibleActiveCourse.id}
                    collapsed={isSidebarCollapsed}
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

        <main className="min-w-0 md:col-start-2">
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

          <div className="px-4 py-5 md:px-8 md:py-7">
            <header className="mb-5 border-b border-[var(--pa-line)] pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-[var(--pa-muted)]">{title}</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-normal text-[var(--pa-ink)]">
                    {visibleActiveCourse.title}
                  </h1>
                  <p className="mt-1 text-sm text-[var(--pa-muted)]">
                    {[
                      formatContentCount(visibleActiveCourse.word_count, visibleActiveCourse.word_count_unit, locale),
                      `${visibleActiveCourse.sentences.length} ${dictionary.library.sentences}`,
                      formatApproxReadingTime(visibleActiveCourse.estimated_reading_seconds, locale)
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StatusBadge locale={locale} status={visibleActiveCourse.status} />
              </div>
            </header>

            {visibleActiveCourse.status === "failed" ? (
              <CourseRetryActions
                courseId={visibleActiveCourse.id}
                dictionary={dictionary}
                failedReason={visibleActiveCourse.failed_reason}
                onRetried={() =>
                  setVisibleActiveCourse({
                    ...visibleActiveCourse,
                    status: visibleActiveCourse.import_status === "failed" ? "extracting_text" : "audio_generating",
                    failed_reason: null,
                    import_status:
                      visibleActiveCourse.import_status === "failed"
                        ? "pending"
                        : visibleActiveCourse.import_status,
                    generation_status:
                      visibleActiveCourse.import_status === "failed" ? visibleActiveCourse.generation_status : "pending"
                  })
                }
              />
            ) : null}

            <CoursePlayer course={visibleActiveCourse} locale={locale} />
          </div>
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
                    collapsed={false}
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
