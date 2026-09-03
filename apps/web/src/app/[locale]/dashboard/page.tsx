"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { CourseCard } from "@/components/CourseCard";
import { DashboardAnnouncements } from "@/components/DashboardAnnouncements";
import { PageHeader } from "@/components/PageHeader";
import { SummaryCard } from "@/components/SummaryCard";
import { deleteCourse, listCourses, recordDashboardActivity } from "@/lib/api";
import { dictionaries, normalizeLocale } from "@/lib/i18n";
import { hasCompletedDashboardOnboarding, markDashboardOnboardingCompleted } from "@/lib/onboarding";
import type { CourseSummary } from "@/lib/types";

export default function DashboardPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  async function refresh() {
    setCourses(await listCourses());
  }

  async function removeCourse(courseId: string) {
    await deleteCourse(courseId);
    await refresh();
  }

  useEffect(() => {
    void recordDashboardActivity(locale).catch(() => undefined);
    void refresh();
  }, [locale]);

  useEffect(() => {
    setShowOnboarding(!hasCompletedDashboardOnboarding());
  }, []);

  const textReadyCount = courses.filter((course) => course.status === "text_ready").length;
  const resumableCourses = courses.filter((course) => course.last_playback_position_seconds > 0);
  const continueCourse = resumableCourses[0];
  const sidebarGuide = {
    initialOpen: showOnboarding,
    onComplete: () => {
      markDashboardOnboardingCompleted();
    },
    title: dictionary.dashboard.onboarding.title,
    subtitle: dictionary.dashboard.onboarding.subtitle,
    steps: dictionary.dashboard.onboarding.steps,
    next: dictionary.dashboard.onboarding.next,
    complete: dictionary.dashboard.onboarding.complete,
    stepLabel: dictionary.dashboard.onboarding.stepLabel,
    close: dictionary.common.close,
    buttonLabel: dictionary.dashboard.onboarding.buttonLabel
  };
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
    <ConsoleShell locale={locale} sidebarGuide={sidebarGuide}>
      <PageHeader
        title={dictionary.dashboard.title}
        subtitle={dictionary.dashboard.subtitle}
        action={
          <Link
            className="pa-focus rounded-md bg-[var(--pa-green)] px-4 py-2 text-sm font-medium text-white shadow-sm"
            href={`/${locale}/import`}
          >
            {dictionary.dashboard.primaryAction}
          </Link>
        }
      />

      <DashboardAnnouncements locale={locale} />

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryCard label={dictionary.dashboard.totalCourses} value={courses.length} />
        <SummaryCard label={dictionary.dashboard.textReady} value={textReadyCount} />
        <SummaryCard label={dictionary.dashboard.resumable} value={resumableCourses.length} />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.72fr]">
        <div>
          <h2 className="text-base font-semibold text-[var(--pa-ink)]">{dictionary.dashboard.continueTitle}</h2>
          {continueCourse ? (
            <div className="mt-3">
              <CourseCard
                course={continueCourse}
                locale={locale}
                onDelete={removeCourse}
              />
            </div>
          ) : (
            <p className="mt-2 rounded-lg border border-dashed border-[var(--pa-line)] bg-[var(--pa-surface)] p-4 text-sm text-[var(--pa-muted)]">
              {dictionary.dashboard.noProgress}
            </p>
          )}
        </div>
        <div className="border-t border-[var(--pa-line)] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <h2 className="text-base font-semibold text-[var(--pa-ink)]">{dictionary.dashboard.nextTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--pa-muted)]">{nextStep}</p>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-base font-semibold text-[var(--pa-ink)]">{dictionary.dashboard.recentTitle}</h2>
        {courses.length > 0 ? (
          <div className="space-y-3">
            {courses.slice(0, 5).map((course) => (
              <CourseCard key={course.id} course={course} locale={locale} onDelete={removeCourse} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--pa-line)] bg-[var(--pa-surface)] p-4 text-sm text-[var(--pa-muted)]">
            {dictionary.dashboard.emptyRecent}
          </div>
        )}
      </section>
    </ConsoleShell>
  );
}
