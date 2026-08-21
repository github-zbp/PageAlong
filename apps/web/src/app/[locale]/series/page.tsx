"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConsoleShell } from "@/components/ConsoleShell";
import { CourseReadingWorkspace } from "@/components/CourseReadingWorkspace";
import { PageHeader } from "@/components/PageHeader";
import {
  deleteCourseSeries,
  getCourseSeries,
  listCourseSeries,
  listCourseTags,
  moveSeriesToFragments,
  updateCourseSeries
} from "@/lib/api";
import { dictionaries, normalizeLocale } from "@/lib/i18n";
import type { Course, CourseSeries, CourseSeriesDetail } from "@/lib/types";

function formatDate(value: string | null, locale: string): string {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function SeriesPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];
  const searchParams = useSearchParams();
  const query = searchParams.get("query")?.trim() ?? "";
  const [seriesItems, setSeriesItems] = useState<CourseSeries[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [activeSeries, setActiveSeries] = useState<CourseSeriesDetail | null>(null);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);

  async function refresh() {
    setSeriesItems(
      await listCourseSeries({
        query,
        tag: selectedTag || undefined,
        starred: starredOnly || undefined
      })
    );
  }

  async function refreshTags() {
    try {
      setTags(await listCourseTags());
    } catch {
      setTags([]);
    }
  }

  async function openSeries(series: CourseSeries) {
    const detail = await getCourseSeries(series.id);
    setActiveSeries(detail);
    setActiveCourse(
      detail.courses.find((course) => course.id === detail.latest_course_id) ?? detail.courses[0] ?? null
    );
  }

  async function toggleStar(series: CourseSeries) {
    await updateCourseSeries({ seriesId: series.id, isStarred: !series.is_starred });
    await refresh();
  }

  async function moveToFragments(series: CourseSeries) {
    await moveSeriesToFragments(series.id);
    await refresh();
  }

  async function removeSeries(series: CourseSeries) {
    await deleteCourseSeries(series.id);
    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, [query, selectedTag, starredOnly]);

  useEffect(() => {
    void refreshTags();
  }, []);

  if (activeSeries && activeCourse) {
    return (
      <CourseReadingWorkspace
        courses={activeSeries.courses}
        activeCourse={activeCourse}
        locale={locale}
        title={activeSeries.title}
        onBack={() => {
          setActiveSeries(null);
          setActiveCourse(null);
        }}
        onSelectCourse={setActiveCourse}
      />
    );
  }

  return (
    <ConsoleShell locale={locale}>
      <PageHeader title={dictionary.series.title} subtitle={dictionary.series.subtitle} />

      <section className="mb-4 flex flex-col gap-3 rounded-md border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center">
        <select
          className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-neutral-950"
          value={selectedTag}
          onChange={(event) => setSelectedTag(event.target.value)}
          aria-label={dictionary.library.tags}
        >
          <option value="">{dictionary.library.allTags}</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
          <input
            checked={starredOnly}
            className="h-4 w-4"
            onChange={(event) => setStarredOnly(event.target.checked)}
            type="checkbox"
          />
          {dictionary.library.starredOnly}
        </label>
      </section>

      {seriesItems.length > 0 ? (
        <section className="space-y-3">
          {seriesItems.map((series) => (
            <article key={series.id} className="rounded-md border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => openSeries(series)}
                  aria-label={`${dictionary.series.open}: ${series.title}`}
                >
                  <h2 className="text-base font-medium">{series.title}</h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    {series.article_count} {dictionary.series.articles}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {dictionary.library.updatedAt}: {formatDate(series.updated_at, locale)}
                    {series.last_read_at
                      ? ` · ${dictionary.library.lastReadAt}: ${formatDate(series.last_read_at, locale)}`
                      : ` · ${dictionary.library.neverRead}`}
                  </p>
                  {series.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {series.tags.map((tag) => (
                        <span key={tag} className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <button
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700"
                    onClick={() => toggleStar(series)}
                    type="button"
                  >
                    {series.is_starred ? dictionary.library.unstar : dictionary.library.star}
                  </button>
                  <button
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700"
                    onClick={() => moveToFragments(series)}
                    type="button"
                  >
                    {dictionary.series.moveToFragments}
                  </button>
                  <button
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700"
                    onClick={() => removeSeries(series)}
                    type="button"
                  >
                    {dictionary.library.delete}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-md border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-semibold">{dictionary.series.emptyTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">{dictionary.series.emptyBody}</p>
        </section>
      )}
    </ConsoleShell>
  );
}
