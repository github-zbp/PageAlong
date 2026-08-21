import type { ExtensionSettings, HighlightColor } from "./types";

const STORAGE_KEY = "pagealong.extension.settings";
const colors: HighlightColor[] = ["amber", "green", "blue", "purple", "coral"];
const rates = [0.75, 1, 1.25, 1.5, 2];

export const defaultSettings: ExtensionSettings = {
  highlightColor: "amber",
  sidebarEnabled: true,
  autoScroll: true,
  playbackRate: 1
};

export function normalizeSettings(value: Partial<ExtensionSettings> | Record<string, unknown>): ExtensionSettings {
  const highlightColor = colors.includes(value.highlightColor as HighlightColor)
    ? (value.highlightColor as HighlightColor)
    : defaultSettings.highlightColor;
  const playbackRate =
    typeof value.playbackRate === "number" && rates.includes(value.playbackRate)
      ? value.playbackRate
      : defaultSettings.playbackRate;
  return {
    highlightColor,
    playbackRate,
    sidebarEnabled: typeof value.sidebarEnabled === "boolean" ? value.sidebarEnabled : defaultSettings.sidebarEnabled,
    autoScroll: typeof value.autoScroll === "boolean" ? value.autoScroll : defaultSettings.autoScroll
  };
}

export async function readSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  return normalizeSettings((stored[STORAGE_KEY] as Partial<ExtensionSettings>) || {});
}

export async function writeSettings(settings: ExtensionSettings): Promise<ExtensionSettings> {
  const normalized = normalizeSettings(settings);
  await chrome.storage.sync.set({ [STORAGE_KEY]: normalized });
  return normalized;
}
