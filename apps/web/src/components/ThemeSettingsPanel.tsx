"use client";

import { useEffect, useMemo, useState } from "react";
import { updateCurrentThemePreferences } from "@/lib/api";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  applyThemePreferences,
  backgroundCatalog,
  readThemePreferences,
  themeCatalog,
  THEME_PREFERENCES_UPDATED_EVENT,
  type ThemeBackgroundColor,
  type ThemeId,
  type ThemePreferences,
  writeThemePreferences
} from "@/lib/theme-preferences";

const themeOrder: ThemeId[] = ["newspaper", "forest", "mist", "amber", "night"];

export function ThemeSettingsPanel({
  dictionary,
  locale
}: {
  dictionary: Dictionary;
  locale: Locale;
}) {
  const [draftPreferences, setDraftPreferences] = useState<ThemePreferences>(() => readThemePreferences());
  const [savedPreferences, setSavedPreferences] = useState<ThemePreferences>(() => readThemePreferences());
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    function syncFromStorage() {
      const next = readThemePreferences();
      setDraftPreferences(next);
      setSavedPreferences(next);
      applyThemePreferences(next);
    }

    syncFromStorage();
    window.addEventListener(THEME_PREFERENCES_UPDATED_EVENT, syncFromStorage);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener(THEME_PREFERENCES_UPDATED_EVENT, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  const isDirty = useMemo(
    () =>
      draftPreferences.theme_id !== savedPreferences.theme_id ||
      draftPreferences.background_color !== savedPreferences.background_color,
    [draftPreferences, savedPreferences]
  );

  function selectTheme(themeId: ThemeId) {
    const next = { ...draftPreferences, theme_id: themeId };
    setDraftPreferences(next);
    applyThemePreferences(next);
    setStatus("idle");
  }

  function selectBackground(backgroundColor: ThemeBackgroundColor) {
    const next = { ...draftPreferences, background_color: backgroundColor };
    setDraftPreferences(next);
    applyThemePreferences(next);
    setStatus("idle");
  }

  async function savePreferences() {
    if (!isDirty) {
      return;
    }
    setStatus("saving");
    try {
      const next = await updateCurrentThemePreferences(draftPreferences);
      writeThemePreferences(next);
      setSavedPreferences(next);
      setDraftPreferences(next);
      setStatus("saved");
    } catch {
      setStatus("error");
      setDraftPreferences(savedPreferences);
      applyThemePreferences(savedPreferences);
    }
  }

  const statusLabel =
    status === "saving"
      ? dictionary.settings.saving
      : status === "saved"
        ? dictionary.settings.saved
        : status === "error"
          ? dictionary.settings.saveError
          : "";

  return (
    <section className="space-y-5 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--pa-ink)]">{dictionary.settings.theme}</h2>
          <p className="mt-1 text-sm text-[var(--pa-muted)]">{statusLabel || " "}</p>
        </div>
        <button
          className="pa-focus inline-flex h-10 items-center justify-center rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-4 text-sm font-medium text-[var(--pa-ink)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isDirty || status === "saving"}
          onClick={() => {
            void savePreferences();
          }}
          type="button"
        >
          {dictionary.settings.save}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {themeOrder.map((themeId) => {
          const theme = themeCatalog[themeId];
          const active = draftPreferences.theme_id === themeId;

          return (
            <button
              key={themeId}
              aria-pressed={active}
              className={[
                "pa-focus rounded-md border p-4 text-left transition",
                active
                  ? "border-[var(--pa-green)] bg-[var(--pa-green-soft)]"
                  : "border-[var(--pa-line)] bg-[var(--pa-surface)] hover:border-[var(--pa-green)]"
              ].join(" ")}
              onClick={() => selectTheme(themeId)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--pa-ink)]">{theme.name[locale]}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--pa-muted)]">{theme.description[locale]}</p>
                </div>
                {active ? (
                  <span className="rounded-full border border-[var(--pa-green)] px-2 py-0.5 text-[11px] font-medium text-[var(--pa-green)]">
                    {locale === "zh" ? "已选" : "Selected"}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 rounded-md border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-[var(--pa-line)] bg-[var(--pa-surface)] px-2 py-1 text-[11px] text-[var(--pa-muted)]">
                    {locale === "zh" ? "课程库" : "Library"}
                  </span>
                  <span className="text-[11px] text-[var(--pa-muted)]">12:42</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-2 py-2 text-[11px] text-[var(--pa-muted)]">
                    {locale === "zh" ? "继续学习" : "Continue"}
                  </div>
                  <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-2 py-2 text-[11px] text-[var(--pa-muted)]">
                    {locale === "zh" ? "查看详情" : "Details"}
                  </div>
                </div>
                <div className="mt-3 flex gap-1" aria-hidden="true">
                  {theme.swatches.map((swatch) => (
                    <span
                      key={swatch}
                      className="h-2 flex-1 rounded-full"
                      style={{ backgroundColor: swatch }}
                    />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--pa-ink)]">{dictionary.settings.background}</h3>
            <p className="mt-1 text-xs text-[var(--pa-muted)]">{dictionary.settings.backgroundLocked}</p>
          </div>
          <span className="rounded-full border border-[var(--pa-line)] bg-[var(--pa-surface)] px-2.5 py-1 text-xs text-[var(--pa-muted)]">
            {backgroundCatalog.white.name[locale]}
          </span>
        </div>

        <div className="mt-3">
          <button
            aria-pressed={draftPreferences.background_color === "white"}
            className={[
              "pa-focus flex w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left transition",
              draftPreferences.background_color === "white"
                ? "border-[var(--pa-green)] bg-[var(--pa-surface)]"
                : "border-[var(--pa-line)] bg-[var(--pa-surface)]"
            ].join(" ")}
            onClick={() => selectBackground("white")}
            type="button"
          >
            <span className="flex items-center gap-3">
              <span className="h-6 w-6 rounded-full border border-[var(--pa-line)] bg-[#ffffff]" />
              <span>
                <span className="block text-sm font-medium text-[var(--pa-ink)]">{backgroundCatalog.white.name[locale]}</span>
                <span className="block text-xs text-[var(--pa-muted)]">{backgroundCatalog.white.description[locale]}</span>
              </span>
            </span>
            <span className="rounded-full border border-[var(--pa-line)] px-2 py-0.5 text-[11px] text-[var(--pa-muted)]">
              {locale === "zh" ? "默认" : "Default"}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
