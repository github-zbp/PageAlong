"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConsoleShell } from "@/components/ConsoleShell";
import { CourseBulkActionBar } from "@/components/CourseBulkActionBar";
import { CourseCard } from "@/components/CourseCard";
import { CourseMoveSeriesPanel } from "@/components/CourseMoveSeriesPanel";
import { PaginationControls } from "@/components/PaginationControls";
import { deleteCourse, listCourseTags, listCoursesPage, updateCourseLibrary } from "@/lib/api";
import { dictionaries, normalizeLocale } from "@/lib/i18n";
import type { CourseSummary, Pagination, TagRead } from "@/lib/types";

const PAGE_SIZE = 20;

type DownloadFeedback = {
  kind: "success" | "error";
  message: string;
};

export default function LibraryPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];
  const searchParams = useSearchParams();
  const query = searchParams.get("query")?.trim() ?? "";
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [tags, setTags] = useState<TagRead[]>([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [downloadFeedback, setDownloadFeedback] = useState<DownloadFeedback | null>(null);
  const [moveSeriesCourseIds, setMoveSeriesCourseIds] = useState<string[]>([]);
  const [moveSeriesTitle, setMoveSeriesTitle] = useState("");
  const [moveSeriesError, setMoveSeriesError] = useState("");
  const [isBulkSaving, setBulkSaving] = useState(false);

  const selectedCourses = useMemo(
    () => courses.filter((course) => selectedCourseIds.includes(course.id)),
    [courses, selectedCourseIds]
  );

  async function refreshCourses(targetPage = page) {
    const response = await listCoursesPage({
      libraryType: "fragmented",
      query,
      tag: selectedTag || undefined,
      starred: starredOnly || undefined,
      page: targetPage,
      pageSize: PAGE_SIZE
    });
    if (response.items.length === 0 && response.pagination.page > 1) {
      clearSelection();
      setCourses([]);
      setPagination(response.pagination);
      setPage(response.pagination.total_pages);
      return;
    }
    setCourses(response.items);
    setPagination(response.pagination);
  }

  async function refreshTags() {
    try {
      setTags(await listCourseTags());
    } catch {
      setTags([]);
    }
  }

  function clearSelection() {
    setSelectedCourseIds([]);
    setMoveSeriesCourseIds([]);
    setMoveSeriesTitle("");
    setMoveSeriesError("");
  }

  function openMoveSeries(courseIds: string[], title = "") {
    setMoveSeriesError("");
    setMoveSeriesCourseIds(courseIds);
    setMoveSeriesTitle(title);
  }

  function handleDownloadQueued() {
    setDownloadFeedback({
      kind: "success",
      message: dictionary.downloads.queuedNotice
    });
  }

  async function removeCourse(courseId: string) {
    await deleteCourse(courseId);
    clearSelection();
    await refreshCourses();
  }

  async function toggleStar(courseId: string, nextStarred: boolean) {
    await updateCourseLibrary({ courseId, isStarred: nextStarred });
    await refreshCourses();
  }

  async function deleteSelected() {
    if (selectedCourseIds.length === 0) {
      return;
    }
    setBulkSaving(true);
    try {
      await Promise.all(selectedCourseIds.map((courseId) => deleteCourse(courseId)));
      clearSelection();
      await refreshCourses();
    } finally {
      setBulkSaving(false);
    }
  }

  async function unstarSelected() {
    if (selectedCourses.length === 0) {
      return;
    }
    setBulkSaving(true);
    try {
      await Promise.all(
        selectedCourses.map((course) => updateCourseLibrary({ courseId: course.id, isStarred: false }))
      );
      clearSelection();
      await refreshCourses();
    } finally {
      setBulkSaving(false);
    }
  }

  async function moveSelectedToSeries() {
    const title = moveSeriesTitle.trim();
    if (!title) {
      setMoveSeriesError(dictionary.detail.transferSeriesHelper);
      return;
    }
    if (moveSeriesCourseIds.length === 0) {
      return;
    }
    setBulkSaving(true);
    setMoveSeriesError("");
    try {
      await Promise.all(
        moveSeriesCourseIds.map((courseId) =>
          updateCourseLibrary({
            courseId,
            libraryType: "series",
            seriesTitle: title
          })
        )
      );
      clearSelection();
      await refreshCourses();
    } catch (caughtError) {
      setMoveSeriesError(caughtError instanceof Error ? caughtError.message : dictionary.detail.transferSeriesHelper);
    } finally {
      setBulkSaving(false);
    }
  }

  useEffect(() => {
    setPage(1);
    clearSelection();
  }, [query, selectedTag, starredOnly]);

  useEffect(() => {
    clearSelection();
  }, [page]);

  useEffect(() => {
    void refreshCourses().catch(() => {
      setCourses([]);
      setPagination(null);
    });
  }, [page, query, selectedTag, starredOnly]);

  useEffect(() => {
    void refreshTags();
  }, []);

  useEffect(() => {
    clearSelection();
  }, [query, selectedTag, starredOnly]);

  return (
    <ConsoleShell locale={locale}>
      <section className="mb-4 flex flex-col gap-3 rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-3 sm:flex-row sm:items-center">
        <select
          aria-label={dictionary.library.tags}
          className="h-10 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 text-sm outline-none focus:border-[var(--pa-green)]"
          value={selectedTag}
          onChange={(event) => setSelectedTag(event.target.value)}
        >
          <option value="">{dictionary.library.allTags}</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.name}>
              {tag.name}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-[var(--pa-muted)]">
          <input
            checked={starredOnly}
            className="h-4 w-4 accent-[var(--pa-green)]"
            onChange={(event) => setStarredOnly(event.target.checked)}
            type="checkbox"
          />
          {dictionary.library.starredOnly}
        </label>
      </section>

      {downloadFeedback ? (
        <div
          className={[
            "mb-4 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm",
            downloadFeedback.kind === "success"
              ? "border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)] text-[var(--pa-green)]"
              : "border-[var(--pa-error-soft)] bg-[var(--pa-error-soft)] text-[var(--pa-error)]"
          ].join(" ")}
        >
          <span>{downloadFeedback.message}</span>
          {downloadFeedback.kind === "success" ? (
            <Link className="font-medium underline underline-offset-2" href={`/${locale}/jobs`}>
              {dictionary.downloads.viewTasks}
            </Link>
          ) : null}
        </div>
      ) : null}

      {selectedCourseIds.length > 0 ? (
        <div className="mb-4">
          <CourseBulkActionBar
            dictionary={dictionary}
            isBusy={isBulkSaving}
            onClearSelection={clearSelection}
            onDeleteSelected={() => {
              void deleteSelected();
            }}
            onMoveToSeries={() => openMoveSeries(selectedCourseIds)}
            onUnstarSelected={() => {
              void unstarSelected();
            }}
            selectedCount={selectedCourseIds.length}
          />
        </div>
      ) : null}

      {courses.length > 0 ? (
        <section className="space-y-3">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              locale={locale}
              selected={selectedCourseIds.includes(course.id)}
              onDelete={removeCourse}
              onDownloadQueued={handleDownloadQueued}
              onDownloadError={(message) => {
                setDownloadFeedback({ kind: "error", message });
              }}
              onSelectChange={(courseId, nextSelected) => {
                setSelectedCourseIds((current) =>
                  nextSelected ? Array.from(new Set([...current, courseId])) : current.filter((id) => id !== courseId)
                );
              }}
              onToggleStar={toggleStar}
              onTransferToSeries={(courseId) => {
                const source = courses.find((item) => item.id === courseId);
                openMoveSeries([courseId], source?.series_title ?? "");
              }}
            />
          ))}
        </section>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--pa-line)] bg-[var(--pa-surface)] p-5 text-sm text-[var(--pa-muted)]">
          {query ? dictionary.library.emptySearch : dictionary.library.empty}
        </div>
      )}

      {pagination ? (
        <div className="mt-4">
          <PaginationControls
            dictionary={dictionary}
            onPageChange={setPage}
            pagination={pagination}
          />
        </div>
      ) : null}

      <CourseMoveSeriesPanel
        dictionary={dictionary}
        error={moveSeriesError}
        isSaving={isBulkSaving}
        open={moveSeriesCourseIds.length > 0}
        seriesTitle={moveSeriesTitle}
        onChangeSeriesTitle={setMoveSeriesTitle}
        onClose={() => {
          setMoveSeriesCourseIds([]);
          setMoveSeriesTitle("");
          setMoveSeriesError("");
        }}
        onConfirm={() => {
          void moveSelectedToSeries();
        }}
      />
    </ConsoleShell>
  );
}
