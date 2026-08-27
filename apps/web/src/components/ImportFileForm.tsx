"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createFileImportBatch, getFileImportBatch } from "@/lib/api";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { FileImportBatch } from "@/lib/types";
import { SeriesAutocompleteField } from "./SeriesAutocompleteField";

const ACTIVE_BATCH_KEY = "pagealong.activeFileImportBatchId";

type ImportMode = FileImportBatch["source_mode"];

function readActiveBatchId(): string {
  try {
    return window.localStorage.getItem(ACTIVE_BATCH_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeActiveBatchId(batchId: string): void {
  try {
    window.localStorage.setItem(ACTIVE_BATCH_KEY, batchId);
  } catch {
    return;
  }
}

function clearActiveBatchId(): void {
  try {
    window.localStorage.removeItem(ACTIVE_BATCH_KEY);
  } catch {
    return;
  }
}

function hasPendingItems(batch: FileImportBatch): boolean {
  return batch.items.some((item) => item.status === "pending" || item.status === "running");
}

function statusLabel(dictionary: Dictionary, status: string): string {
  if (status === "pending") return dictionary.import.fileReady;
  if (status === "running") return dictionary.import.fileRunning;
  if (status === "succeeded") return dictionary.import.fileSucceeded;
  if (status === "failed") return dictionary.import.fileFailed;
  return status;
}

function statusClassName(status: string): string {
  if (status === "succeeded") return "border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)] text-[var(--pa-green)]";
  if (status === "running") return "border-[var(--pa-amber-soft)] bg-[var(--pa-amber-soft)] text-[var(--pa-amber)]";
  if (status === "failed") return "border-[var(--pa-error-soft)] bg-[var(--pa-error-soft)] text-[var(--pa-error)]";
  return "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)]";
}

function itemRowClassName(status: string): string {
  if (status === "succeeded") return "border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)]";
  if (status === "running") return "border-[var(--pa-amber-soft)] bg-[var(--pa-amber-soft)]";
  if (status === "failed") return "border-[var(--pa-error-soft)] bg-[var(--pa-error-soft)]";
  return "border-[var(--pa-line)] bg-[var(--pa-surface)]";
}

export function ImportFileForm({
  dictionary,
  locale
}: {
  dictionary: Dictionary;
  locale: Locale;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const pollTokenRef = useRef(0);
  const [mode, setMode] = useState<ImportMode>("multiple_files");
  const [seriesTitle, setSeriesTitle] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [batch, setBatch] = useState<FileImportBatch | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isPolling, setPolling] = useState(false);
  const [error, setError] = useState("");

  const selectedPaths = useMemo(
    () =>
      selectedFiles.map((file) => {
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim();
        return relativePath || file.name;
      }),
    [selectedFiles]
  );

  useEffect(() => {
    mountedRef.current = true;
    void restoreActiveBatch();
    return () => {
      mountedRef.current = false;
      pollTokenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) {
      return;
    }
    if (mode === "folder") {
      input.setAttribute("webkitdirectory", "");
    } else {
      input.removeAttribute("webkitdirectory");
    }
  }, [mode]);

  async function restoreActiveBatch() {
    const batchId = readActiveBatchId();
    if (!batchId) {
      return;
    }
    try {
      const restored = await getFileImportBatch(batchId);
      if (!mountedRef.current) {
        return;
      }
      setBatch(restored);
      setMode(restored.source_mode);
      if (hasPendingItems(restored)) {
        void pollBatch(restored.id);
      } else {
        clearActiveBatchId();
      }
    } catch {
      clearActiveBatchId();
    }
  }

  async function pollBatch(batchId: string) {
    const token = ++pollTokenRef.current;
    setPolling(true);
    while (mountedRef.current && pollTokenRef.current === token) {
      try {
        const next = await getFileImportBatch(batchId);
        if (!mountedRef.current || pollTokenRef.current !== token) {
          return;
        }
        setBatch(next);
        if (!hasPendingItems(next)) {
          clearActiveBatchId();
          setPolling(false);
          return;
        }
      } catch (caughtError) {
        if (mountedRef.current && pollTokenRef.current === token) {
          setError(caughtError instanceof Error ? caughtError.message : dictionary.import.error);
          setPolling(false);
        }
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    if (mountedRef.current && pollTokenRef.current === token) {
      setPolling(false);
    }
  }

  function updateSelectedFiles(files: File[]) {
    const nextFiles = mode === "single_file" ? files.slice(0, 1) : files;
    setSelectedFiles(nextFiles);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      setError(dictionary.import.fileNoFiles);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const nextBatch = await createFileImportBatch({
        files: selectedFiles,
        relativePaths: selectedPaths,
        sourceMode: mode,
        seriesTitle: seriesTitle.trim() || undefined
      });
      if (!mountedRef.current) {
        return;
      }
      setBatch(nextBatch);
      writeActiveBatchId(nextBatch.id);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (hasPendingItems(nextBatch)) {
        void pollBatch(nextBatch.id);
      } else {
        clearActiveBatchId();
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.import.error);
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["single_file", dictionary.import.fileSingle],
              ["multiple_files", dictionary.import.fileMultiple],
              ["folder", dictionary.import.fileFolder]
            ] as Array<[ImportMode, string]>
          ).map(([nextMode, label]) => (
            <button
              aria-pressed={mode === nextMode}
              className={[
                "pa-focus rounded-md border px-3 py-2 text-sm font-medium transition",
                mode === nextMode
                  ? "border-[var(--pa-green)] bg-[var(--pa-green)] text-white"
                  : "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)] hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
              ].join(" ")}
              key={nextMode}
              onClick={() => {
                setMode(nextMode);
                if (nextMode === "single_file") {
                  setSelectedFiles((current) => current.slice(0, 1));
                }
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SeriesAutocompleteField dictionary={dictionary} value={seriesTitle} onChange={setSeriesTitle} />
          <input
            ref={fileInputRef}
            aria-label={dictionary.import.fileSelect}
            className="w-full rounded-md border border-dashed border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--pa-green)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white focus:border-[var(--pa-green)] focus:outline-none"
            multiple={mode !== "single_file"}
            onChange={(event) => updateSelectedFiles(Array.from(event.target.files ?? []))}
            type="file"
            accept=".html,.htm,.pdf,.doc,.docx,.epub,.txt,.ppt,.pptx,.mobi,.azw3"
          />
        </div>

        <div className="rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pa-muted)]">{dictionary.import.fileSelect}</p>
            <span className="text-xs text-[var(--pa-muted)]">{selectedFiles.length}</span>
          </div>
          {selectedFiles.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {selectedFiles.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--pa-ink)]">
                      {selectedPaths[index] ?? file.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--pa-muted)]">{Math.max(file.size, 0)} B</p>
                  </div>
                  <span className="rounded-md border border-[var(--pa-line)] px-2 py-1 text-xs text-[var(--pa-muted)]">
                    {(file.name.split(".").pop() || "").toUpperCase() || dictionary.import.fileSingle}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[var(--pa-muted)]">{dictionary.import.fileNoFiles}</p>
          )}
        </div>

        <p className="text-xs leading-5 text-[var(--pa-muted)]">{dictionary.import.fileResumeNotice}</p>

        {error ? <p className="text-sm text-[var(--pa-error)]">{error}</p> : null}

        <button
          className="pa-focus rounded-md bg-[var(--pa-green)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? dictionary.import.fileSubmitting : dictionary.import.fileSubmit}
        </button>
      </form>

      {batch ? (
        <section className="space-y-3 rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--pa-ink)]">{dictionary.import.fileBatchSummary}</p>
              <p className="mt-1 text-xs text-[var(--pa-muted)]">
                {batch.success_count} {dictionary.import.fileSucceeded} · {batch.failed_count} {dictionary.import.fileFailed}
                · {dictionary.import.fileTotal} {batch.total_count}
              </p>
            </div>
            <span className="text-xs text-[var(--pa-muted)]">
              {isPolling ? dictionary.import.fileRunning : dictionary.import.fileReady}
            </span>
          </div>
          <div className="space-y-2">
            {batch.items.map((item) => (
              <article key={item.id} className={`rounded-md border p-3 ${itemRowClassName(item.status)}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--pa-ink)]">{item.original_filename}</p>
                    <p className="mt-0.5 text-xs text-[var(--pa-muted)]">
                      {item.relative_path && item.relative_path !== item.original_filename ? item.relative_path : item.original_filename}
                    </p>
                    {item.error_message ? <p className="mt-2 text-sm leading-6 text-[var(--pa-error)]">{item.error_message}</p> : null}
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${statusClassName(item.status)}`}>
                    {statusLabel(dictionary, item.status)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
