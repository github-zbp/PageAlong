import { useSyncExternalStore } from "react";
import { loadLocalePreference, saveLocalePreference, type LocalePreference } from "@/lib/preferences";

const DEFAULT_LOCALE: LocalePreference = "zh";

let currentLocale: LocalePreference = DEFAULT_LOCALE;
let hydrated = false;
let bootstrapPromise: Promise<LocalePreference> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => {
    listener();
  });
}

function setLocale(nextLocale: LocalePreference, nextHydrated = true) {
  currentLocale = nextLocale;
  hydrated = nextHydrated;
  emit();
}

export function getLocalePreference(): LocalePreference {
  return currentLocale;
}

export function isLocalePreferenceHydrated(): boolean {
  return hydrated;
}

export function subscribeLocalePreference(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLocalePreference(): LocalePreference {
  return useSyncExternalStore(subscribeLocalePreference, getLocalePreference, () => DEFAULT_LOCALE);
}

export function useLocalePreferenceReady(): boolean {
  return useSyncExternalStore(
    subscribeLocalePreference,
    isLocalePreferenceHydrated,
    () => true
  );
}

export async function bootstrapLocalePreference(): Promise<LocalePreference> {
  if (hydrated) {
    return currentLocale;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = loadLocalePreference()
      .then((storedLocale) => {
        setLocale(storedLocale ?? DEFAULT_LOCALE, true);
        return currentLocale;
      })
      .catch(() => {
        setLocale(DEFAULT_LOCALE, true);
        return currentLocale;
      })
      .finally(() => {
        bootstrapPromise = null;
      });
  }

  return bootstrapPromise;
}

export async function setLocalePreference(locale: LocalePreference): Promise<void> {
  setLocale(locale, true);
  await saveLocalePreference(locale);
}

export function resetLocalePreferenceForTests(): void {
  currentLocale = DEFAULT_LOCALE;
  hydrated = false;
  bootstrapPromise = null;
  listeners.clear();
}

