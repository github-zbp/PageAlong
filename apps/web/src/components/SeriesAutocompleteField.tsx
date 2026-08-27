"use client";

import { useEffect, useMemo, useState } from "react";
import { listCourseSeries } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";
import type { CourseSeries } from "@/lib/types";

export function SeriesAutocompleteField({
  dictionary,
  emptyText,
  helperText,
  newSeriesLabel,
  placeholder,
  value,
  onChange
}: {
  dictionary: Dictionary;
  emptyText?: string;
  helperText?: string;
  newSeriesLabel?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [seriesItems, setSeriesItems] = useState<CourseSeries[]>([]);
  const [isFocused, setFocused] = useState(false);

  useEffect(() => {
    void listCourseSeries()
      .then((items) => setSeriesItems(items))
      .catch(() => setSeriesItems([]));
  }, []);

  const query = value.trim();
  const exactMatch = useMemo(
    () => (query ? seriesItems.find((series) => series.title.trim().toLowerCase() === query.toLowerCase()) ?? null : null),
    [query, seriesItems]
  );
  const suggestions = useMemo(() => {
    if (!query) {
      return seriesItems.slice(0, 6);
    }
    const normalized = query.toLowerCase();
    return seriesItems.filter((series) => series.title.toLowerCase().includes(normalized)).slice(0, 6);
  }, [query, seriesItems]);

  return (
    <div className="space-y-2">
      <input
        className="w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-base outline-none focus:border-[var(--pa-green)]"
        placeholder={placeholder ?? dictionary.import.seriesPlaceholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          window.setTimeout(() => setFocused(false), 120);
        }}
      />
      {helperText ?? dictionary.import.seriesHelper ? (
        <p className="text-xs leading-5 text-[var(--pa-muted)]">{helperText ?? dictionary.import.seriesHelper}</p>
      ) : null}

      {isFocused || query ? (
        <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-2">
          <div className="space-y-1">
            {query && !exactMatch ? (
              <button
                className="flex w-full items-center justify-between gap-3 rounded-md border border-dashed border-[var(--pa-line)] px-2 py-2 text-left text-sm text-[var(--pa-green)] hover:border-[var(--pa-green)]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onChange(query)}
                type="button"
              >
                <span>{newSeriesLabel ?? dictionary.series.newSeries}</span>
                <span className="text-xs text-[var(--pa-muted)]">{query}</span>
              </button>
            ) : null}
            {suggestions.map((series) => (
              <button
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm text-[var(--pa-ink)] hover:bg-[var(--pa-muted-surface)]"
                key={series.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onChange(series.title)}
                type="button"
              >
                <span className="truncate">{series.title}</span>
                <span className="text-xs text-[var(--pa-muted)]">
                  {series.article_count} {dictionary.series.articles}
                </span>
              </button>
            ))}
            {suggestions.length === 0 && query ? (
              <p className="px-2 py-2 text-sm text-[var(--pa-muted)]">{emptyText ?? dictionary.series.emptyBody}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
