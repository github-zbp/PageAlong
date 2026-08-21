import { dictionaries, type Locale } from "@/lib/i18n";

const statusTone: Record<string, string> = {
  ready: "border-[#b9d3c8] bg-[#dfece6] text-[#245447]",
  needs_review: "border-[#e3c88f] bg-[#f4e6ca] text-[#7a4e12]",
  text_ready: "border-[#d9cfbe] bg-[#fff7e8] text-[#7a4e12]",
  audio_generating: "border-[#d9cfbe] bg-[#f3ede2] text-[#5f574d]",
  extracting_text: "border-[#d9cfbe] bg-[#f3ede2] text-[#5f574d]",
  importing: "border-[#d9cfbe] bg-[#f3ede2] text-[#5f574d]",
  ocr_processing: "border-[#d9cfbe] bg-[#f3ede2] text-[#5f574d]",
  failed: "border-[#f1b8b3] bg-[#fff1f0] text-[#b42318]",
  deleted: "border-neutral-200 bg-neutral-100 text-neutral-500"
};

export function StatusBadge({ locale, status }: { locale: Locale; status: string }) {
  const statuses = dictionaries[locale].status as Record<string, string>;
  const label = statuses[status] ?? status;
  const tone = statusTone[status] ?? "border-[#ddd2c1] bg-[#f3ede2] text-[#70685e]";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}
