"use client";

import { FloatingPanel } from "./FloatingPanel";
import { SeriesAutocompleteField } from "./SeriesAutocompleteField";
import type { Dictionary } from "@/lib/i18n";

export function CourseMoveSeriesPanel({
  dictionary,
  error,
  isSaving,
  onChangeSeriesTitle,
  onClose,
  onConfirm,
  open,
  seriesTitle
}: {
  dictionary: Dictionary;
  error?: string;
  isSaving: boolean;
  onChangeSeriesTitle: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
  seriesTitle: string;
}) {
  return (
    <FloatingPanel closeLabel={dictionary.common.close} onClose={onClose} open={open} position="right" title={dictionary.detail.transferToSeries}>
      <div className="space-y-4">
        <SeriesAutocompleteField
          dictionary={dictionary}
          emptyText={dictionary.detail.noSeriesMatch}
          helperText={dictionary.detail.transferSeriesHelper}
          newSeriesLabel={dictionary.series.newSeries}
          placeholder={dictionary.detail.transferSeriesPlaceholder}
          value={seriesTitle}
          onChange={onChangeSeriesTitle}
        />
        {error ? <p className="text-sm text-[var(--pa-error)]">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            className="rounded-md border border-[var(--pa-line)] px-3 py-2 text-sm text-[var(--pa-ink)]"
            onClick={onClose}
            type="button"
          >
            {dictionary.series.cancel}
          </button>
          <button
            className="rounded-md bg-[var(--pa-green)] px-3 py-2 text-sm text-white disabled:opacity-50"
            disabled={isSaving}
            onClick={onConfirm}
            type="button"
          >
            {dictionary.detail.transferToSeries}
          </button>
        </div>
      </div>
    </FloatingPanel>
  );
}
