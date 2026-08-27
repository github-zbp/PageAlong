"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConsoleShell } from "@/components/ConsoleShell";
import { FloatingPanel } from "@/components/FloatingPanel";
import { PaginationControls } from "@/components/PaginationControls";
import { PlusIcon, SearchIcon, TrashIcon } from "@/components/UiIcons";
import { OverflowMenu } from "@/components/OverflowMenu";
import {
  createCourseSeries,
  deleteCourseSeries,
  getCourseSeries,
  listCourseSeriesPage,
  moveSeriesToFragments,
  updateCourseSeries
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { dictionaries, type Locale } from "@/lib/i18n";
import { pickSeriesCourse, seriesCourseHref, seriesCoursesHref } from "@/lib/series-navigation";
import type { CourseSeries, Pagination } from "@/lib/types";

type SeriesDraft = {
  title: string;
};

export function SeriesManagementPage({
  locale
}: {
  locale: Locale;
}) {
  const dictionary = dictionaries[locale];
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [seriesItems, setSeriesItems] = useState<CourseSeries[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<string[]>([]);
  const [isCreating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<SeriesDraft>({ title: "" });
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setSaving] = useState(false);

  const selectedSeries = useMemo(
    () => seriesItems.filter((series) => selectedSeriesIds.includes(series.id)),
    [selectedSeriesIds, seriesItems]
  );

  async function refreshSeries(targetPage = page) {
    const response = await listCourseSeriesPage({
      query,
      page: targetPage,
      pageSize: 20
    });
    if (response.items.length === 0 && response.pagination.page > 1) {
      setSeriesItems([]);
      setPagination(response.pagination);
      setPage(response.pagination.total_pages);
      setSelectedSeriesIds([]);
      return;
    }
    setSeriesItems(response.items);
    setPagination(response.pagination);
  }

  useEffect(() => {
    setPage(1);
    setSelectedSeriesIds([]);
  }, [query]);

  useEffect(() => {
    setSelectedSeriesIds([]);
  }, [page]);

  useEffect(() => {
    void refreshSeries().catch(() => {
      setSeriesItems([]);
      setPagination(null);
    });
  }, [query, page]);

  function viewSeries(series: CourseSeries) {
    router.push(seriesCoursesHref(locale, series.id));
  }

  async function readSeries(series: CourseSeries) {
    setError("");
    try {
      const detail = await getCourseSeries(series.id);
      const targetCourse = pickSeriesCourse(detail);
      if (targetCourse === null) {
        return;
      }
      router.push(seriesCourseHref(locale, series.id, targetCourse.id));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.series.saveError);
    }
  }

  function startEditing(series: CourseSeries) {
    setError("");
    setCreating(false);
    setEditingSeriesId(series.id);
    setEditingTitle(series.title);
  }

  function cancelEditing() {
    setEditingSeriesId(null);
    setEditingTitle("");
  }

  async function saveEditing(series: CourseSeries) {
    const title = editingTitle.trim();
    if (!title) {
      setError(dictionary.series.nameRequired);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateCourseSeries({ seriesId: series.id, title });
      await refreshSeries();
      cancelEditing();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.series.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function createSeries() {
    const title = createDraft.title.trim();
    if (!title) {
      setError(dictionary.series.nameRequired);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createCourseSeries({ title });
      await refreshSeries();
      setCreating(false);
      setCreateDraft({ title: "" });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.series.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function clearSeriesCourses(series: CourseSeries) {
    setSaving(true);
    setError("");
    try {
      await moveSeriesToFragments(series.id);
      setSelectedSeriesIds([]);
      await refreshSeries();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.series.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSeries(series: CourseSeries) {
    setSaving(true);
    setError("");
    try {
      await deleteCourseSeries(series.id);
      setSelectedSeriesIds((current) => current.filter((id) => id !== series.id));
      await refreshSeries();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.series.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedSeries() {
    if (selectedSeries.some((series) => series.article_count > 0)) {
      setError(dictionary.series.batchDeleteBlocked);
      return;
    }
    setSaving(true);
    setError("");
    try {
      for (const series of selectedSeries) {
        await deleteCourseSeries(series.id);
      }
      setSelectedSeriesIds([]);
      await refreshSeries();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.series.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ConsoleShell locale={locale}>
      <section className="mb-4 flex flex-col gap-3 border-b border-[var(--pa-line)] pb-4 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pa-muted)]" />
          <input
            aria-label={dictionary.series.search}
            className="h-9 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] pl-9 pr-3 text-sm outline-none focus:border-[var(--pa-ink)]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dictionary.series.search}
            type="search"
            value={query}
          />
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-[var(--pa-line)] px-3 py-2 text-sm text-[var(--pa-ink)]"
          onClick={() => {
            setCreating(true);
            setEditingSeriesId(null);
            setError("");
            setCreateDraft({ title: "" });
          }}
          type="button"
        >
          <PlusIcon className="h-4 w-4" />
          {dictionary.series.newSeries}
        </button>
        {selectedSeriesIds.length > 0 ? (
          <button
            className="inline-flex items-center gap-2 rounded-md border border-[var(--pa-line)] px-3 py-2 text-sm text-[var(--pa-ink)] disabled:opacity-50"
            disabled={isSaving}
            onClick={deleteSelectedSeries}
            type="button"
          >
            <TrashIcon className="h-4 w-4" />
            {dictionary.series.deleteSelected}
          </button>
        ) : null}
      </section>

      <FloatingPanel
        closeLabel={dictionary.common.close}
        onClose={() => {
          setCreating(false);
          setCreateDraft({ title: "" });
          setError("");
        }}
        open={isCreating}
        position="center"
        title={dictionary.series.createTitle}
      >
        <div className="space-y-4">
          <label className="block space-y-2 text-sm">
            <span className="text-[var(--pa-muted)]">{dictionary.series.nameLabel}</span>
            <input
              autoFocus
              className="h-11 w-full rounded-md border border-[var(--pa-line)] px-3 outline-none focus:border-[var(--pa-ink)]"
              onChange={(event) => setCreateDraft({ title: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void createSeries();
                }
              }}
              placeholder={dictionary.series.nameLabel}
              value={createDraft.title}
            />
          </label>
          {error ? <p className="text-sm text-[var(--pa-error)]">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              className="rounded-md border border-[var(--pa-line)] px-3 py-2 text-sm text-[var(--pa-ink)]"
              onClick={() => {
                setCreating(false);
                setCreateDraft({ title: "" });
                setError("");
              }}
              type="button"
            >
              {dictionary.series.cancel}
            </button>
            <button
              className="rounded-md bg-[var(--pa-green)] px-3 py-2 text-sm text-white disabled:opacity-50"
              disabled={isSaving}
              onClick={() => void createSeries()}
              type="button"
            >
              {dictionary.series.save}
            </button>
          </div>
        </div>
      </FloatingPanel>

      {!isCreating && error ? <p className="mb-4 text-sm text-[var(--pa-error)]">{error}</p> : null}

      {seriesItems.length > 0 ? (
        <section className="space-y-3">
          {seriesItems.map((series) => {
            const isEditing = editingSeriesId === series.id;
            const isSelected = selectedSeriesIds.includes(series.id);
            return (
              <article key={series.id} className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
                <div className="flex items-start gap-3">
                  <label className="mt-1 inline-flex items-center">
                    <input
                      checked={isSelected}
                      className="h-4 w-4"
                      onChange={(event) => {
                        setSelectedSeriesIds((current) =>
                          event.target.checked
                            ? [...current, series.id]
                            : current.filter((id) => id !== series.id)
                        );
                      }}
                      aria-label={`${dictionary.series.select} ${series.title}`}
                      type="checkbox"
                    />
                  </label>

                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <>
                        <span aria-hidden="true" className="sr-only">
                          {series.title}
                        </span>
                        <input
                          autoFocus
                          className="h-11 w-full rounded-md border border-[var(--pa-line)] px-3 outline-none focus:border-[var(--pa-ink)]"
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void saveEditing(series);
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelEditing();
                            }
                          }}
                        />
                      </>
                    ) : (
                      <button
                        type="button"
                        className="min-w-0 text-left"
                        onClick={() => startEditing(series)}
                        aria-label={series.title}
                      >
                        <h2 className="text-base font-medium">{series.title}</h2>
                      </button>
                    )}
                    <p className="mt-1 text-sm text-[var(--pa-muted)]">
                      {series.article_count} {dictionary.series.articles}
                    </p>
                    <p className="mt-1 text-xs text-[var(--pa-muted)]">
                      {dictionary.library.updatedAt}: {formatDateTime(series.updated_at, locale)}
                      {series.last_read_at
                        ? ` · ${dictionary.library.lastReadAt}: ${formatDateTime(series.last_read_at, locale)}`
                        : ` · ${dictionary.library.neverRead}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <button
                      className="rounded-md border border-[var(--pa-line)] px-2 py-1 text-xs text-[var(--pa-ink)] disabled:opacity-50"
                      onClick={() => viewSeries(series)}
                      type="button"
                    >
                      {dictionary.series.open}
                    </button>
                    <button
                      className="rounded-md border border-[var(--pa-line)] px-2 py-1 text-xs text-[var(--pa-ink)] disabled:opacity-50"
                      disabled={series.article_count === 0}
                      onClick={() => void readSeries(series)}
                      type="button"
                    >
                      {dictionary.series.read}
                    </button>
                    <OverflowMenu
                      ariaLabel={`${dictionary.library.moreActions}: ${series.title}`}
                      items={[
                        {
                          label: dictionary.series.clearCourses,
                          disabled: isSaving,
                          onSelect: () => {
                            void clearSeriesCourses(series);
                          }
                        },
                        {
                          label: dictionary.series.delete,
                          destructive: true,
                          disabled: isSaving || isEditing,
                          onSelect: () => {
                            void deleteSeries(series);
                          }
                        }
                      ]}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="rounded-md border border-dashed border-[var(--pa-line)] bg-[var(--pa-surface)] p-5">
          <h2 className="text-base font-semibold">{dictionary.series.emptyTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pa-muted)]">{dictionary.series.emptyBody}</p>
        </section>
      )}

      {pagination ? (
        <div className="mt-4">
          <PaginationControls dictionary={dictionary} onPageChange={setPage} pagination={pagination} />
        </div>
      ) : null}
    </ConsoleShell>
  );
}
