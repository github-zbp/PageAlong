import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark";

const THEME_KEY = "pagealong.theme.mode";

export const lightTheme = {
  background: "#F7F4ED",
  surface: "#FFFDF8",
  elevatedSurface: "#FFFFFF",
  text: "#171717",
  mutedText: "#6B6760",
  border: "#E5DED2",
  accent: "#2F6F5E",
  highlight: "#D7B46A",
  danger: "#A33A2B"
} as const;

export const darkTheme = {
  background: "#121212",
  surface: "#1A1A1A",
  elevatedSurface: "#242424",
  text: "#F4F1EA",
  mutedText: "#A8A39A",
  border: "#2E2E2E",
  accent: "#76A892",
  highlight: "#C49A4A",
  danger: "#E36B5D"
} as const;

export function getThemeTokens(mode: ThemeMode) {
  return mode === "dark" ? darkTheme : lightTheme;
}

export async function loadThemeMode(): Promise<ThemeMode | null> {
  try {
    const value = await AsyncStorage.getItem(THEME_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, mode);
  } catch {
    // Theme persistence is best-effort; the current session still updates immediately.
  }
}
