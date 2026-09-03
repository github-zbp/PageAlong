"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConsoleShell } from "@/components/ConsoleShell";
import { CourseDetailContent } from "@/components/CourseDetailContent";
import { CourseOutlineDrawer, CourseOutlineSidebar } from "@/components/CourseOutlineSidebar";
import { getCourse } from "@/lib/api";
import { dictionaries, normalizeLocale } from "@/lib/i18n";
import type { Course } from "@/lib/types";

export default function LocalizedCourseDetailPage({
  params
}: {
  params: { locale: string; courseId: string };
}) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];
  const searchParams = useSearchParams();
  const autoplay = searchParams.get("autoplay") === "1";
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState("");
  const [isOutlineOpen, setOutlineOpen] = useState(false);

  const loadCourse = useCallback(async () => {
    setError("");
    try {
      setCourse(await getCourse(params.courseId));
    } catch {
      setCourse(null);
      setError(dictionary.detail.loadError);
    }
  }, [dictionary.detail.loadError, params.courseId]);

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  useEffect(() => {
    if (!course?.outline?.length) {
      setOutlineOpen(false);
    }
  }, [course?.id, course?.outline?.length]);

  const scrollToOutlineItem = useCallback((itemId: string) => {
    document.getElementById(itemId)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  if (!course) {
    return (
      <ConsoleShell locale={locale}>
        <div className="rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4 text-sm text-[var(--pa-muted)]">
          {error || dictionary.detail.loadingCourse}
        </div>
      </ConsoleShell>
    );
  }

  const outline = course.outline ?? [];
  const outlineSidebar =
    isOutlineOpen && outline.length > 0 ? (
      <CourseOutlineSidebar
        closeLabel={dictionary.reading.closeOutline}
        courseTitle={course.title}
        onClose={() => setOutlineOpen(false)}
        onSelect={scrollToOutlineItem}
        outline={outline}
        title={dictionary.reading.outline}
      />
    ) : undefined;

  return (
    <>
      <ConsoleShell locale={locale} sidebarOverride={outlineSidebar} sidebarOverrideLabel={dictionary.reading.outline}>
        <CourseDetailContent
          autoplay={autoplay}
          course={course}
          isOutlineOpen={isOutlineOpen}
          locale={locale}
          onCourseChange={setCourse}
          onReloadCourse={loadCourse}
          onToggleOutline={() => setOutlineOpen((value) => !value)}
        />
      </ConsoleShell>
      <CourseOutlineDrawer
        closeLabel={dictionary.reading.closeOutline}
        courseTitle={course.title}
        onClose={() => setOutlineOpen(false)}
        onSelect={scrollToOutlineItem}
        open={isOutlineOpen}
        outline={outline}
        title={dictionary.reading.outline}
      />
    </>
  );
}
