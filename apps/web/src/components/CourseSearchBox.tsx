"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listCoursesPage } from "@/lib/api";
import { dictionaries, type Locale } from "@/lib/i18n";
import type { CourseSummary } from "@/lib/types";
import { CloseIcon, SearchIcon } from "./UiIcons";

const SEARCH_DEBOUNCE_MS = 1000;
const PREVIEW_RESULT_LIMIT = 5;

function courseContextLabel(course: CourseSummary, locale: Locale): string {
  if (course.series_title) {
    return course.series_title;
  }
  if (course.library_type === "series") {
    return dictionaries[locale].nav.seriesCourses;
  }
  return dictionaries[locale].nav.fragmentedCourses;
}

export function CourseSearchBox({
  initialValue = "",
  locale,
  onNavigate
}: {
  initialValue?: string;
  locale: Locale;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const dictionary = dictionaries[locale];
  const requestId = useRef(0);
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [hasUserInput, setHasUserInput] = useState(false);

  useEffect(() => {
    requestId.current += 1;
    setQuery(initialValue);
    setResults([]);
    setLoading(false);
    setError("");
    setPreviewOpen(false);
    setHasUserInput(false);
  }, [initialValue]);

  useEffect(() => {
    const trimmed = query.trim();
    const currentRequestId = ++requestId.current;

    if (!hasUserInput || !trimmed) {
      setResults([]);
      setLoading(false);
      setError("");
      setPreviewOpen(false);
      return;
    }

    setResults([]);
    setLoading(false);
    setError("");
    setPreviewOpen(true);

    const timer = window.setTimeout(() => {
      setLoading(true);
      void listCoursesPage({
        libraryType: "all",
        query: trimmed,
        searchScope: "title",
        page: 1,
        pageSize: PREVIEW_RESULT_LIMIT
      })
        .then((response) => {
          if (currentRequestId === requestId.current) {
            setResults(response.items);
          }
        })
        .catch(() => {
          if (currentRequestId === requestId.current) {
            setResults([]);
            setError(dictionary.search.error);
          }
        })
        .finally(() => {
          if (currentRequestId === requestId.current) {
            setLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [dictionary.search.error, hasUserInput, query]);

  function clearSearch() {
    requestId.current += 1;
    setQuery("");
    setResults([]);
    setLoading(false);
    setError("");
    setPreviewOpen(false);
    setHasUserInput(false);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    requestId.current += 1;
    const trimmed = query.trim();
    setPreviewOpen(false);
    onNavigate?.();
    router.push(trimmed ? `/${locale}/search?query=${encodeURIComponent(trimmed)}` : `/${locale}/search`);
  }

  const trimmedQuery = query.trim();
  const shouldShowPreview = previewOpen && hasUserInput && Boolean(trimmedQuery);
  const searchHref = trimmedQuery ? `/${locale}/search?query=${encodeURIComponent(trimmedQuery)}` : `/${locale}/search`;

  return (
    <form className="relative" role="search" onSubmit={submitSearch}>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pa-muted)]" />
        <input
          aria-label={dictionary.search.placeholder}
          className="pa-focus h-10 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-9 text-sm outline-none transition placeholder:text-[var(--pa-muted)] focus:border-[var(--pa-green)]"
          onChange={(event) => {
            setHasUserInput(true);
            setQuery(event.target.value);
          }}
          placeholder={dictionary.search.placeholder}
          type="search"
          value={query}
        />
        {query ? (
          <button
            aria-label={dictionary.search.clear}
            className="pa-focus absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[var(--pa-muted)] hover:bg-[var(--pa-muted-surface)] hover:text-[var(--pa-ink)]"
            onClick={clearSearch}
            title={dictionary.search.clear}
            type="button"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {shouldShowPreview ? (
        <div
          aria-label={dictionary.search.suggestions}
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] shadow-[0_16px_36px_rgba(17,17,17,0.16)]"
          data-course-search-suggestions
        >
          {loading ? <p className="px-3 py-3 text-sm text-[var(--pa-muted)]">{dictionary.search.loading}</p> : null}
          {!loading && error ? <p className="px-3 py-3 text-sm text-[var(--pa-error)]">{error}</p> : null}
          {!loading && !error && results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-[var(--pa-muted)]">{dictionary.search.empty}</p>
          ) : null}
          {!loading && !error && results.length > 0 ? (
            <div className="max-h-80 overflow-y-auto">
              {results.map((course) => (
                <Link
                  className="block border-b border-[var(--pa-line)] px-3 py-2.5 text-left transition last:border-b-0 hover:bg-[var(--pa-muted-surface)]"
                  href={`/${locale}/courses/${course.id}`}
                  key={course.id}
                  onClick={() => {
                    setPreviewOpen(false);
                    onNavigate?.();
                  }}
                >
                  <span className="block truncate text-sm font-medium text-[var(--pa-ink)]">{course.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--pa-muted)]">{courseContextLabel(course, locale)}</span>
                </Link>
              ))}
            </div>
          ) : null}
          {trimmedQuery ? (
            <Link
              className="block border-t border-[var(--pa-line)] px-3 py-2 text-sm font-medium text-[var(--pa-green)] hover:bg-[var(--pa-muted-surface)]"
              href={searchHref}
              onClick={() => {
                setPreviewOpen(false);
                onNavigate?.();
              }}
            >
              {dictionary.search.viewAll}
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

export default CourseSearchBox;
