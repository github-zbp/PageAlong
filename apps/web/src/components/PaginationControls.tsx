"use client";

import { ArrowRightIcon } from "./UiIcons";
import type { Dictionary } from "@/lib/i18n";
import type { Pagination } from "@/lib/types";

type PaginationItem = number | "ellipsis";

function formatTemplate(template: string, replacements: Record<string, number>): string {
  return Object.entries(replacements).reduce((value, [key, replacement]) => {
    return value.replaceAll(`{${key}}`, String(replacement));
  }, template);
}

function buildPageItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const candidates = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const pageNumbers = Array.from(candidates)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);

  const items: PaginationItem[] = [];
  let previousPage = 0;
  for (const page of pageNumbers) {
    if (previousPage > 0 && page - previousPage > 1) {
      items.push("ellipsis");
    }
    items.push(page);
    previousPage = page;
  }
  return items;
}

export function PaginationControls({
  dictionary,
  pagination,
  onPageChange
}: {
  dictionary: Dictionary;
  pagination: Pagination;
  onPageChange: (page: number) => void;
}) {
  if (pagination.total_pages <= 1) {
    return null;
  }

  const pageItems = buildPageItems(pagination.page, pagination.total_pages);
  const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.page_size + 1;
  const end = pagination.total === 0 ? 0 : Math.min(pagination.page * pagination.page_size, pagination.total);
  const pageSummary = formatTemplate(dictionary.pagination.pageSummary, {
    page: pagination.page,
    totalPages: pagination.total_pages
  });
  const resultSummary = formatTemplate(dictionary.pagination.resultSummary, {
    start,
    end,
    total: pagination.total
  });

  return (
    <nav className="flex flex-col gap-3 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-muted)] sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <p className="font-medium text-[var(--pa-ink)]">{pageSummary}</p>
        <p>{resultSummary}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <button
          className="inline-flex items-center gap-1 rounded-md border border-[var(--pa-line)] px-2 py-1.5 text-sm text-[var(--pa-ink)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!pagination.has_previous}
          onClick={() => onPageChange(pagination.page - 1)}
          type="button"
        >
          <ArrowRightIcon className="h-4 w-4 rotate-180" />
          {dictionary.pagination.previous}
        </button>

        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <span aria-hidden="true" className="px-2 py-1.5 text-[var(--pa-muted)]" key={`ellipsis-${index}`}>
              ...
            </span>
          ) : (
            <button
              aria-current={item === pagination.page ? "page" : undefined}
              className={[
                "min-w-9 rounded-md border px-2 py-1.5 text-sm",
                item === pagination.page
                  ? "border-[var(--pa-green)] bg-[var(--pa-green-soft)] font-medium text-[var(--pa-green)]"
                  : "border-[var(--pa-line)] text-[var(--pa-ink)] hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
              ].join(" ")}
              disabled={item === pagination.page}
              key={item}
              onClick={() => onPageChange(item)}
              type="button"
            >
              {item}
            </button>
          )
        )}

        <button
          className="inline-flex items-center gap-1 rounded-md border border-[var(--pa-line)] px-2 py-1.5 text-sm text-[var(--pa-ink)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!pagination.has_next}
          onClick={() => onPageChange(pagination.page + 1)}
          type="button"
        >
          {dictionary.pagination.next}
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
