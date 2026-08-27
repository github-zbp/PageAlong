"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTextCourse } from "@/lib/api";
import type { Dictionary, Locale } from "@/lib/i18n";
import { SeriesAutocompleteField } from "./SeriesAutocompleteField";

export function ImportTextForm({
  dictionary,
  locale
}: {
  dictionary: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [seriesTitle, setSeriesTitle] = useState("");
  const [text, setText] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const course = await createTextCourse({ title, text, seriesTitle: seriesTitle.trim() || undefined });
      setTitle("");
      setSeriesTitle("");
      setText("");
      router.push(course.library_type === "series" ? `/${locale}/series` : `/${locale}/library`);
    } catch {
      setError(dictionary.import.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
      <input
        className="w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-base outline-none focus:border-[var(--pa-green)]"
        placeholder={dictionary.import.titlePlaceholder}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
      />
      <SeriesAutocompleteField dictionary={dictionary} value={seriesTitle} onChange={setSeriesTitle} />
      <textarea
        className="min-h-44 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-base outline-none focus:border-[var(--pa-green)]"
        placeholder={dictionary.import.textPlaceholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        required
      />
      {error ? <p className="text-sm text-[var(--pa-error)]">{error}</p> : null}
      <button
        className="pa-focus rounded-md bg-[var(--pa-green)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? dictionary.import.submitting : dictionary.import.submit}
      </button>
    </form>
  );
}
