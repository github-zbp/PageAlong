import AsyncStorage from "@react-native-async-storage/async-storage";

export type LocalePreference = "zh" | "en";
export type ReaderFontSize = "small" | "standard" | "large";
export type ReaderLineHeight = "compact" | "comfortable" | "loose";

export type ReaderPreferences = {
  fontSize: ReaderFontSize;
  lineHeight: ReaderLineHeight;
  playbackRate: number;
};

export const defaultReaderPreferences: ReaderPreferences = {
  fontSize: "standard",
  lineHeight: "comfortable",
  playbackRate: 1
};

const READER_PREFERENCES_KEY = "pagealong.reader.preferences";
const LOCALE_KEY = "pagealong.locale";

function isReaderPreferences(value: unknown): value is ReaderPreferences {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const preferences = value as Record<string, unknown>;
  return (
    (preferences.fontSize === "small" ||
      preferences.fontSize === "standard" ||
      preferences.fontSize === "large") &&
    (preferences.lineHeight === "compact" ||
      preferences.lineHeight === "comfortable" ||
      preferences.lineHeight === "loose") &&
    typeof preferences.playbackRate === "number" &&
    Number.isFinite(preferences.playbackRate)
  );
}

export async function loadReaderPreferences(): Promise<ReaderPreferences> {
  try {
    const raw = await AsyncStorage.getItem(READER_PREFERENCES_KEY);
    if (raw === null) {
      return defaultReaderPreferences;
    }

    const parsed: unknown = JSON.parse(raw);
    return isReaderPreferences(parsed) ? parsed : defaultReaderPreferences;
  } catch {
    return defaultReaderPreferences;
  }
}

export async function saveReaderPreferences(preferences: ReaderPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(READER_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Preference persistence is best-effort; the current session still updates immediately.
  }
}

export async function loadLocalePreference(): Promise<LocalePreference | null> {
  try {
    const value = await AsyncStorage.getItem(LOCALE_KEY);
    return value === "zh" || value === "en" ? value : null;
  } catch {
    return null;
  }
}

export async function saveLocalePreference(locale: LocalePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // Locale persistence is best-effort; the current session still updates immediately.
  }
}
