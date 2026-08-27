"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Space_Grotesk } from "next/font/google";
import { ConsoleShell } from "@/components/ConsoleShell";
import { CourseDetailContent } from "@/components/CourseDetailContent";
import { getCourse } from "@/lib/api";
import { dictionaries, normalizeLocale } from "@/lib/i18n";
import type { Course } from "@/lib/types";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap"
});

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

  if (!course) {
    return (
      <ConsoleShell locale={locale}>
        <div className={spaceGrotesk.className}>
          <div className="rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4 text-sm text-[var(--pa-muted)]">
            {error || dictionary.detail.loadingCourse}
          </div>
        </div>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell locale={locale}>
      <div className={spaceGrotesk.className}>
        <CourseDetailContent
          autoplay={autoplay}
          course={course}
          locale={locale}
          onCourseChange={setCourse}
          onReloadCourse={loadCourse}
        />
      </div>
    </ConsoleShell>
  );
}
