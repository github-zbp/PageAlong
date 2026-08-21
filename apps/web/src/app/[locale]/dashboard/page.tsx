"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { CourseCard } from "@/components/CourseCard";
import { PageHeader } from "@/components/PageHeader";
import { SummaryCard } from "@/components/SummaryCard";
import { deleteCourse, listCourses } from "@/lib/api";
import { dictionaries, normalizeLocale } from "@/lib/i18n";
import type { CourseSummary } from "@/lib/types";

export default function DashboardPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];
  const [courses, setCourses] = useState<CourseSummary[]>([]);

  async function refresh() {
    setCourses(await listCourses());
  }

  async function removeCourse(courseId: string) {
    await deleteCourse(courseId);
    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, []);

  const textReadyCount = courses.filter((course) => course.status === "text_ready").length;
  const resumableCourses = courses.filter((course) => course.last_playback_position_seconds > 0);
  const continueCourse = resumableCourses[0];
  const nextStep = useMemo(() => {
    if (continueCourse) {
      return dictionary.dashboard.progressNext;
    }
    if (textReadyCount > 0) {
      return dictionary.dashboard.textReadyNext;
    }
    return dictionary.dashboard.emptyNext;
  }, [continueCourse, dictionary.dashboard, textReadyCount]);

  return (
    <ConsoleShell locale={locale}>
      <PageHeader
        title={dictionary.dashboard.title}
        subtitle={dictionary.dashboard.subtitle}
        action={
          <Link
            className="pa-focus rounded-md bg-[#2f6f5e] px-4 py-2 text-sm font-medium text-white shadow-sm"
            href={`/${locale}/import`}
          >
            {dictionary.dashboard.primaryAction}
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label={dictionary.dashboard.totalCourses} value={courses.length} />
        <SummaryCard label={dictionary.dashboard.textReady} value={textReadyCount} />
        <SummaryCard label={dictionary.dashboard.resumable} value={resumableCourses.length} />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.72fr]">
        <div>
          <h2 className="text-base font-semibold text-[#1f1a14]">{dictionary.dashboard.continueTitle}</h2>
          {continueCourse ? (
            <div className="mt-3">
              <CourseCard
                course={continueCourse}
                locale={locale}
                onDelete={removeCourse}
              />
            </div>
          ) : (
            <p className="mt-2 rounded-lg border border-dashed border-[#ddd2c1] bg-[#fffdf8] p-4 text-sm text-[#70685e]">
              {dictionary.dashboard.noProgress}
            </p>
          )}
        </div>
        <div className="border-t border-[#ddd2c1] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <h2 className="text-base font-semibold text-[#1f1a14]">{dictionary.dashboard.nextTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-[#70685e]">{nextStep}</p>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-base font-semibold text-[#1f1a14]">{dictionary.dashboard.recentTitle}</h2>
        {courses.length > 0 ? (
          <div className="space-y-3">
            {courses.slice(0, 5).map((course) => (
              <CourseCard key={course.id} course={course} locale={locale} onDelete={removeCourse} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#ddd2c1] bg-[#fffdf8] p-4 text-sm text-[#70685e]">
            {dictionary.dashboard.emptyRecent}
          </div>
        )}
      </section>
    </ConsoleShell>
  );
}
