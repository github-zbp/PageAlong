"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConsoleShell } from "@/components/ConsoleShell";
import { CourseDownloadActions } from "@/components/CourseDownloadActions";
import { CoursePlayer } from "@/components/CoursePlayer";
import { CourseRetryActions } from "@/components/CourseRetryActions";
import { CourseReviewActions } from "@/components/CourseReviewActions";
import { StatusBadge } from "@/components/StatusBadge";
import { getCourse } from "@/lib/api";
import { formatApproxReadingTime, formatContentCount } from "@/lib/format";
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
        <div className="mb-4 text-sm text-[#70685e]">
          <Link href={`/${locale}/library`} className="hover:text-[#245447]">
            {dictionary.detail.breadcrumb}
          </Link>
        </div>
        <div className="rounded-lg border border-[#ddd2c1] bg-[#fffdf8] p-4 text-sm text-[#70685e]">
          {error || dictionary.detail.loadingCourse}
        </div>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell locale={locale}>
      <div className="mb-4 text-sm text-[#70685e]">
        <Link href={`/${locale}/library`} className="hover:text-[#245447]">
          {dictionary.detail.breadcrumb}
        </Link>
        <span> / {course.title}</span>
      </div>

      <header className="mb-5 border-b border-[#ddd2c1] pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1f1a14]">{course.title}</h1>
            <p className="mt-1 text-sm text-[#70685e]">
              {[
                formatContentCount(course.word_count, course.word_count_unit, locale),
                `${course.sentences.length} ${dictionary.library.sentences}`,
                formatApproxReadingTime(course.estimated_reading_seconds, locale)
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
          <StatusBadge locale={locale} status={course.status} />
        </div>
      </header>

      <div className="mb-5">
        <CourseDownloadActions course={course} dictionary={dictionary} />
      </div>

      {course.status === "needs_review" ? (
        <CourseReviewActions courseId={course.id} dictionary={dictionary} onConfirmed={loadCourse} />
      ) : null}

      {course.status === "failed" ? (
        <CourseRetryActions
          courseId={course.id}
          dictionary={dictionary}
          failedReason={course.failed_reason}
          onRetried={loadCourse}
        />
      ) : null}

      <CoursePlayer course={course} locale={locale} autoplay={autoplay} />

      <div className="mt-5 flex flex-wrap gap-2">
        <Link className="pa-focus rounded-md border border-[#ddd2c1] px-3 py-2 text-sm text-[#245447]" href={`/${locale}/library`}>
          {dictionary.detail.backToLibrary}
        </Link>
        <Link className="pa-focus rounded-md bg-[#2f6f5e] px-3 py-2 text-sm text-white" href={`/${locale}/jobs`}>
          {dictionary.detail.viewJobs}
        </Link>
      </div>
    </ConsoleShell>
  );
}
