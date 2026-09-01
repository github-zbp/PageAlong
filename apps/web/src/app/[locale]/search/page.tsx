"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConsoleShell } from "@/components/ConsoleShell";
import { CourseCard } from "@/components/CourseCard";
import { PageHeader } from "@/components/PageHeader";
import { PaginationControls } from "@/components/PaginationControls";
import { listCoursesPage } from "@/lib/api";
import { dictionaries, normalizeLocale } from "@/lib/i18n";
import type { CourseSummary, Pagination } from "@/lib/types";

const PAGE_SIZE = 20;

export default function CourseSearchPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];
  const searchParams = useSearchParams();
  const query = searchParams.get("query")?.trim() ?? "";
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function refreshCourses() {
      if (!query) {
        setCourses([]);
        setPagination(null);
        setLoading(false);
        setError("");
        return;
      }

      setLoading(true);
      setError("");
      try {
        const response = await listCoursesPage({
          libraryType: "all",
          query,
          searchScope: "title",
          page,
          pageSize: PAGE_SIZE
        });
        if (!cancelled) {
          setCourses(response.items);
          setPagination(response.pagination);
        }
      } catch {
        if (!cancelled) {
          setCourses([]);
          setPagination(null);
          setError(dictionary.search.error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void refreshCourses();

    return () => {
      cancelled = true;
    };
  }, [dictionary.search.error, page, query]);

  return (
    <ConsoleShell locale={locale}>
      <PageHeader title={dictionary.search.resultTitle} subtitle={dictionary.search.resultSubtitle} />

      {query ? (
        <p className="mb-4 text-sm text-[var(--pa-muted)]">
          {dictionary.search.placeholder}: <span className="font-medium text-[var(--pa-ink)]">{query}</span>
        </p>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-5 text-sm text-[var(--pa-muted)]">
          {dictionary.search.loading}
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-lg border border-[var(--pa-error-soft)] bg-[var(--pa-error-soft)] p-5 text-sm text-[var(--pa-error)]">
          {error}
        </div>
      ) : null}

      {!loading && !error && courses.length > 0 ? (
        <section className="space-y-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} locale={locale} />
          ))}
        </section>
      ) : null}

      {!loading && !error && courses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--pa-line)] bg-[var(--pa-surface)] p-5 text-sm text-[var(--pa-muted)]">
          {query ? dictionary.search.empty : dictionary.search.emptyQuery}
        </div>
      ) : null}

      {pagination ? (
        <div className="mt-4">
          <PaginationControls dictionary={dictionary} onPageChange={setPage} pagination={pagination} />
        </div>
      ) : null}
    </ConsoleShell>
  );
}
