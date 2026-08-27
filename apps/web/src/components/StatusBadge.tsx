import { dictionaries, type Locale } from "@/lib/i18n";

const statusTone: Record<string, string> = {
  ready: "border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)] text-[var(--pa-green)]",
  needs_review: "border-[var(--pa-amber-soft)] bg-[var(--pa-amber-soft)] text-[var(--pa-amber)]",
  text_ready: "border-[var(--pa-line)] bg-[var(--pa-amber-soft)] text-[var(--pa-amber)]",
  audio_generating: "border-[var(--pa-line)] bg-[var(--pa-muted-surface)] text-[var(--pa-muted)]",
  extracting_text: "border-[var(--pa-line)] bg-[var(--pa-muted-surface)] text-[var(--pa-muted)]",
  importing: "border-[var(--pa-line)] bg-[var(--pa-muted-surface)] text-[var(--pa-muted)]",
  ocr_processing: "border-[var(--pa-line)] bg-[var(--pa-muted-surface)] text-[var(--pa-muted)]",
  failed: "border-[var(--pa-error-soft)] bg-[var(--pa-error-soft)] text-[var(--pa-error)]",
  deleted: "border-[var(--pa-line)] bg-[var(--pa-muted-surface)] text-[var(--pa-muted)]"
};

export function StatusBadge({ locale, status }: { locale: Locale; status: string }) {
  const statuses = dictionaries[locale].status as Record<string, string>;
  const label = statuses[status] ?? status;
  const tone = statusTone[status] ?? "border-[var(--pa-line)] bg-[var(--pa-muted-surface)] text-[var(--pa-muted)]";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}
