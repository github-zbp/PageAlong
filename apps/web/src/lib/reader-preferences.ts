export type ReaderFontSize = "small" | "standard" | "large";
export type ReaderLineHeight = "compact" | "comfortable" | "loose";

export type ReaderPreferences = {
  fontSize: ReaderFontSize;
  lineHeight: ReaderLineHeight;
  sidebarCollapsed: boolean;
  playbackRate: number;
};

const STORAGE_KEY = "pagealong.reader.preferences";
export const READER_PREFERENCES_UPDATED_EVENT = "pagealong:reader-preferences-updated";

export const defaultReaderPreferences: ReaderPreferences = {
  fontSize: "standard",
  lineHeight: "comfortable",
  sidebarCollapsed: false,
  playbackRate: 1
};

const allowedFontSizes: ReaderFontSize[] = ["small", "standard", "large"];
const allowedLineHeights: ReaderLineHeight[] = ["compact", "comfortable", "loose"];
const allowedPlaybackRates = [0.75, 1, 1.25, 1.5, 2];

function normalizePreferences(value: Partial<ReaderPreferences>): ReaderPreferences {
  const fontSize = allowedFontSizes.includes(value.fontSize as ReaderFontSize)
    ? (value.fontSize as ReaderFontSize)
    : defaultReaderPreferences.fontSize;
  const lineHeight = allowedLineHeights.includes(value.lineHeight as ReaderLineHeight)
    ? (value.lineHeight as ReaderLineHeight)
    : defaultReaderPreferences.lineHeight;
  const playbackRate =
    typeof value.playbackRate === "number" && allowedPlaybackRates.includes(value.playbackRate)
      ? value.playbackRate
      : defaultReaderPreferences.playbackRate;

  return {
    fontSize,
    lineHeight,
    sidebarCollapsed: Boolean(value.sidebarCollapsed),
    playbackRate
  };
}

export function readReaderPreferences(): ReaderPreferences {
  if (typeof window === "undefined") {
    return defaultReaderPreferences;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultReaderPreferences;
    }
    return normalizePreferences(JSON.parse(raw) as Partial<ReaderPreferences>);
  } catch {
    return defaultReaderPreferences;
  }
}

export function writeReaderPreferences(preferences: ReaderPreferences): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePreferences(preferences)));
  window.dispatchEvent(new Event(READER_PREFERENCES_UPDATED_EVENT));
}

export function updateReaderPreferences(partial: Partial<ReaderPreferences>): ReaderPreferences {
  const next = normalizePreferences({ ...readReaderPreferences(), ...partial });
  writeReaderPreferences(next);
  return next;
}

export function fontSizeClassName(fontSize: ReaderFontSize): string {
  if (fontSize === "small") {
    return "pa-reader-font-small";
  }
  if (fontSize === "large") {
    return "pa-reader-font-large";
  }
  return "pa-reader-font-standard";
}

export function lineHeightClassName(lineHeight: ReaderLineHeight): string {
  if (lineHeight === "compact") {
    return "pa-reader-line-compact";
  }
  if (lineHeight === "loose") {
    return "pa-reader-line-loose";
  }
  return "pa-reader-line-comfortable";
}
