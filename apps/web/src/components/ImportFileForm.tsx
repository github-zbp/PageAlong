"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createFileImportBatch, getFileImportBatch } from "@/lib/api";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { FileImportBatch } from "@/lib/types";

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
  if (status === "succeeded") return "border-[#c9e4d8] bg-[#eef8f2] text-[#245447]";
  if (status === "running") return "border-[#ead9a8] bg-[#fff8df] text-[#8a5b00]";
  if (status === "failed") return "border-[#f1b8b3] bg-[#fff1f0] text-[#b42318]";
  return "border-[#ddd2c1] bg-[#fffdf8] text-[#70685e]";
}

function itemRowClassName(status: string): string {
  if (status === "succeeded") return "border-[#c9e4d8] bg-[#f8fcf9]";
  if (status === "running") return "border-[#ead9a8] bg-[#fffdf0]";
  if (status === "failed") return "border-[#f1b8b3] bg-[#fff8f7]";
  return "border-[#ddd2c1] bg-[#fffdf8]";
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
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-[#ddd2c1] bg-[#fffdf8] p-4">
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
                  ? "border-[#2f6f5e] bg-[#2f6f5e] text-white"
                  : "border-[#ddd2c1] bg-[#fffdf8] text-[#70685e] hover:border-[#2f6f5e] hover:text-[#245447]"
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
          <input
            className="w-full rounded-md border border-[#ddd2c1] bg-[#fffdf8] px-3 py-2 text-base outline-none focus:border-[#2f6f5e]"
            placeholder={dictionary.import.seriesPlaceholder}
            value={seriesTitle}
            onChange={(event) => setSeriesTitle(event.target.value)}
          />
          <input
            ref={fileInputRef}
            aria-label={dictionary.import.fileSelect}
            className="w-full rounded-md border border-dashed border-[#ddd2c1] bg-[#fffdf8] px-3 py-2 text-sm text-[#70685e] file:mr-3 file:rounded-md file:border-0 file:bg-[#2f6f5e] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white focus:border-[#2f6f5e] focus:outline-none"
            multiple={mode !== "single_file"}
            onChange={(event) => updateSelectedFiles(Array.from(event.target.files ?? []))}
            type="file"
            accept=".html,.htm,.pdf,.doc,.docx,.epub,.txt,.ppt,.pptx,.mobi,.azw3"
          />
        </div>

        <div className="rounded-lg border border-[#ddd2c1] bg-[#fffdf8] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#70685e]">{dictionary.import.fileSelect}</p>
            <span className="text-xs text-[#70685e]">{selectedFiles.length}</span>
          </div>
          {selectedFiles.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {selectedFiles.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#1f1a14]">
                      {selectedPaths[index] ?? file.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[#70685e]">{Math.max(file.size, 0)} B</p>
                  </div>
                  <span className="rounded-md border border-[#ddd2c1] px-2 py-1 text-xs text-[#70685e]">
                    {(file.name.split(".").pop() || "").toUpperCase() || dictionary.import.fileSingle}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[#70685e]">{dictionary.import.fileNoFiles}</p>
          )}
        </div>

        <p className="text-xs leading-5 text-[#70685e]">{dictionary.import.fileResumeNotice}</p>

        {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}

        <button
          className="pa-focus rounded-md bg-[#2f6f5e] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? dictionary.import.fileSubmitting : dictionary.import.fileSubmit}
        </button>
      </form>

      {batch ? (
        <section className="space-y-3 rounded-lg border border-[#ddd2c1] bg-[#fffdf8] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1f1a14]">{dictionary.import.fileBatchSummary}</p>
              <p className="mt-1 text-xs text-[#70685e]">
                {batch.success_count} {dictionary.import.fileSucceeded} · {batch.failed_count} {dictionary.import.fileFailed}
                · {dictionary.import.fileTotal} {batch.total_count}
              </p>
            </div>
            <span className="text-xs text-[#70685e]">
              {isPolling ? dictionary.import.fileRunning : dictionary.import.fileReady}
            </span>
          </div>
          <div className="space-y-2">
            {batch.items.map((item) => (
              <article key={item.id} className={`rounded-md border p-3 ${itemRowClassName(item.status)}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#1f1a14]">{item.original_filename}</p>
                    <p className="mt-0.5 text-xs text-[#70685e]">
                      {item.relative_path && item.relative_path !== item.original_filename ? item.relative_path : item.original_filename}
                    </p>
                    {item.error_message ? <p className="mt-2 text-sm leading-6 text-[#b42318]">{item.error_message}</p> : null}
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
