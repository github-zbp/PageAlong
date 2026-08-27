"use client";

import { dictionaries, type Locale } from "@/lib/i18n";
import type { ReaderFontSize, ReaderLineHeight, ReaderPreferences } from "@/lib/reader-preferences";

export function ReaderPreferencesControls({
  locale,
  onChange,
  preferences
}: {
  locale: Locale;
  onChange: (next: Partial<ReaderPreferences>) => void;
  preferences: ReaderPreferences;
}) {
  const dictionary = dictionaries[locale];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-[var(--pa-ink)]">{dictionary.reading.readerPreferences}</span>
        {(
          [
            ["small", dictionary.reading.smallFont],
            ["standard", dictionary.reading.standardFont],
            ["large", dictionary.reading.largeFont]
          ] as Array<[ReaderFontSize, string]>
        ).map(([fontSize, label]) => (
          <button
            aria-pressed={preferences.fontSize === fontSize}
            className={[
              "pa-focus rounded-md border px-2.5 py-1.5 transition",
              preferences.fontSize === fontSize
                ? "border-[var(--pa-green)] bg-[var(--pa-green-soft)] text-[var(--pa-green)]"
                : "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)] hover:border-[var(--pa-green)]"
            ].join(" ")}
            key={fontSize}
            onClick={() => onChange({ fontSize })}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["compact", dictionary.reading.compactLine],
            ["comfortable", dictionary.reading.comfortableLine],
            ["loose", dictionary.reading.looseLine]
          ] as Array<[ReaderLineHeight, string]>
        ).map(([lineHeight, label]) => (
          <button
            aria-pressed={preferences.lineHeight === lineHeight}
            className={[
              "pa-focus rounded-md border px-2.5 py-1.5 transition",
              preferences.lineHeight === lineHeight
                ? "border-[var(--pa-green)] bg-[var(--pa-green-soft)] text-[var(--pa-green)]"
                : "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)] hover:border-[var(--pa-green)]"
            ].join(" ")}
            key={lineHeight}
            onClick={() => onChange({ lineHeight })}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
