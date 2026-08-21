"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTextCourse } from "@/lib/api";
import type { Dictionary, Locale } from "@/lib/i18n";

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
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-[#ddd2c1] bg-[#fffdf8] p-4">
      <input
        className="w-full rounded-md border border-[#ddd2c1] bg-[#fffdf8] px-3 py-2 text-base outline-none focus:border-[#2f6f5e]"
        placeholder={dictionary.import.titlePlaceholder}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
      />
      <input
        className="w-full rounded-md border border-[#ddd2c1] bg-[#fffdf8] px-3 py-2 text-base outline-none focus:border-[#2f6f5e]"
        placeholder={dictionary.import.seriesPlaceholder}
        value={seriesTitle}
        onChange={(event) => setSeriesTitle(event.target.value)}
      />
      <textarea
        className="min-h-44 w-full rounded-md border border-[#ddd2c1] bg-[#fffdf8] px-3 py-2 text-base outline-none focus:border-[#2f6f5e]"
        placeholder={dictionary.import.textPlaceholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        required
      />
      {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
      <button
        className="pa-focus rounded-md bg-[#2f6f5e] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? dictionary.import.submitting : dictionary.import.submit}
      </button>
    </form>
  );
}
