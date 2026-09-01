"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { CourseDetailContent } from "@/components/CourseDetailContent";
import { CourseReadingWorkspace } from "@/components/CourseReadingWorkspace";
import { getCourseSeries } from "@/lib/api";
import { dictionaries, type Locale } from "@/lib/i18n";
import { pickSeriesCourse, seriesCourseHref, seriesCoursesHref } from "@/lib/series-navigation";
import type { Course, CourseSeriesDetail } from "@/lib/types";

export function SeriesCourseReadingView({
  locale,
  seriesId,
  courseId
}: {
  locale: Locale;
  seriesId: string;
  courseId: string;
}) {
  const dictionary = dictionaries[locale];

  return (
    <AuthGate
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--pa-bg)] text-sm text-[var(--pa-muted)]">
          {dictionary.auth.loading}
        </div>
      }
      locale={locale}
    >
      {() => <SeriesCourseReadingContent locale={locale} seriesId={seriesId} courseId={courseId} />}
    </AuthGate>
  );
}

function SeriesCourseReadingContent({
  locale,
  seriesId,
  courseId
}: {
  locale: Locale;
  seriesId: string;
  courseId: string;
}) {
  const dictionary = dictionaries[locale];
  const router = useRouter();
  const [series, setSeries] = useState<CourseSeriesDetail | null>(null);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setLoading] = useState(true);
  const [isFullscreenMode, setFullscreenMode] = useState(false);
  const [isOutlineOpen, setOutlineOpen] = useState(false);

  const loadSeries = useCallback(async (resetState = false) => {
    if (resetState) {
      setLoading(true);
      setSeries(null);
      setActiveCourse(null);
    }
    setError("");

    try {
      const detail = await getCourseSeries(seriesId);
      const selectedCourse = pickSeriesCourse(detail, courseId);
      if (selectedCourse === null) {
        setSeries(detail);
        setError(dictionary.series.emptyBody);
        return;
      }

      setSeries(detail);
      setActiveCourse(selectedCourse);
      if (selectedCourse.id !== courseId) {
        router.replace(seriesCourseHref(locale, seriesId, selectedCourse.id));
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.detail.loadError);
    } finally {
      if (resetState) {
        setLoading(false);
      }
    }
  }, [courseId, dictionary.detail.loadError, dictionary.series.emptyBody, locale, router, seriesId]);

  useEffect(() => {
    void loadSeries(true);
  }, [loadSeries]);

  useEffect(() => {
    setOutlineOpen(false);
  }, [activeCourse?.id]);

  const onBack = useCallback(() => {
    router.push(seriesCoursesHref(locale, seriesId));
  }, [locale, router, seriesId]);

  const onSelectCourse = useCallback(
    (course: Course) => {
      if (course.id === courseId) {
        return;
      }
      router.push(seriesCourseHref(locale, seriesId, course.id));
    },
    [courseId, locale, router, seriesId]
  );

  const onCourseChange = useCallback((nextCourse: Course) => {
    setActiveCourse(nextCourse);
    setSeries((current) =>
      current === null
        ? current
        : {
            ...current,
            courses: current.courses.map((course) => (course.id === nextCourse.id ? nextCourse : course))
          }
    );
  }, []);

  const scrollToOutlineItem = useCallback((itemId: string) => {
    document.getElementById(itemId)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--pa-bg)] text-sm text-[var(--pa-muted)]">
        {dictionary.auth.loading}
      </div>
    );
  }

  if (error || series === null || activeCourse === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--pa-bg)] px-4 text-sm text-[var(--pa-muted)]">
        <div className="max-w-md rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
          <p>{error || dictionary.detail.loadError}</p>
          <button
            className="pa-focus mt-4 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-ink)]"
            onClick={onBack}
            type="button"
          >
            {dictionary.reading.backToList}
          </button>
        </div>
      </div>
    );
  }

  return (
    <CourseReadingWorkspace
      activeCourse={activeCourse}
      courses={series.courses}
      isFullscreenMode={isFullscreenMode}
      isOutlineOpen={isOutlineOpen}
      locale={locale}
      outline={activeCourse.outline ?? []}
      title={series.title}
      onBack={onBack}
      onCloseOutline={() => setOutlineOpen(false)}
      onSelectCourse={onSelectCourse}
      onSelectOutlineItem={scrollToOutlineItem}
    >
      <CourseDetailContent
        course={activeCourse}
        isFullscreen={isFullscreenMode}
        isOutlineOpen={isOutlineOpen}
        locale={locale}
        onCourseChange={onCourseChange}
        onReloadCourse={() => void loadSeries()}
        onToggleOutline={() => setOutlineOpen((value) => !value)}
        onToggleFullscreen={() => setFullscreenMode((value) => !value)}
      />
    </CourseReadingWorkspace>
  );
}
