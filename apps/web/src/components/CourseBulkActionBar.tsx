"use client";

import { ArrowRightIcon, CloseIcon, StarIcon, TrashIcon } from "./UiIcons";
import type { Dictionary } from "@/lib/i18n";

export function CourseBulkActionBar({
  dictionary,
  isBusy = false,
  onClearSelection,
  onDeleteSelected,
  onMoveToSeries,
  onUnstarSelected,
  selectedCount
}: {
  dictionary: Dictionary;
  isBusy?: boolean;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onMoveToSeries: () => void;
  onUnstarSelected: () => void;
  selectedCount: number;
}) {
  if (selectedCount <= 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--pa-green)]">
        {dictionary.library.selected} {selectedCount}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className="pa-focus inline-flex items-center gap-2 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-green)] hover:border-[var(--pa-green)]"
          disabled={isBusy}
          onClick={onMoveToSeries}
          type="button"
        >
          <ArrowRightIcon className="h-4 w-4" />
          {dictionary.library.moveToSeries}
        </button>
        <button
          className="pa-focus inline-flex items-center gap-2 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-green)] hover:border-[var(--pa-green)]"
          disabled={isBusy}
          onClick={onUnstarSelected}
          type="button"
        >
          <StarIcon className="h-4 w-4" />
          {dictionary.library.unstarSelected}
        </button>
        <button
          className="pa-focus inline-flex items-center gap-2 rounded-md border border-[var(--pa-error-soft)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-error)] hover:border-[var(--pa-error)]"
          disabled={isBusy}
          onClick={onDeleteSelected}
          type="button"
        >
          <TrashIcon className="h-4 w-4" />
          {dictionary.library.deleteSelected}
        </button>
        <button
          className="pa-focus inline-flex items-center gap-2 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-muted)] hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
          disabled={isBusy}
          onClick={onClearSelection}
          type="button"
        >
          <CloseIcon className="h-4 w-4" />
          {dictionary.library.clearSelection}
        </button>
      </div>
    </div>
  );
}
