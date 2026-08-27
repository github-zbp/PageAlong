import type { Locale } from "./i18n";

export type ThemeId = "newspaper" | "forest" | "mist" | "amber" | "night";
export type ThemeBackgroundColor = "white";

export type ThemePreferences = {
  theme_id: ThemeId;
  background_color: ThemeBackgroundColor;
};

type ThemeCopy = {
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  swatches: string[];
};

type ThemeTokens = {
  "--pa-bg": string;
  "--pa-surface": string;
  "--pa-muted-surface": string;
  "--pa-ink": string;
  "--pa-muted": string;
  "--pa-line": string;
  "--pa-green": string;
  "--pa-green-soft": string;
  "--pa-amber": string;
  "--pa-amber-soft": string;
  "--pa-error": string;
  "--pa-error-soft": string;
  "--pa-selection": string;
  colorScheme: "light" | "dark";
};

export const THEME_PREFERENCES_UPDATED_EVENT = "pagealong:theme-preferences-updated";
const STORAGE_KEY = "pagealong.theme.preferences";

export const defaultThemePreferences: ThemePreferences = {
  theme_id: "newspaper",
  background_color: "white"
};

const themeTokens: Record<ThemeId, ThemeTokens> = {
  newspaper: {
    "--pa-bg": "#ffffff",
    "--pa-surface": "#fcfcfb",
    "--pa-muted-surface": "#f7f7f2",
    "--pa-ink": "#111111",
    "--pa-muted": "#686862",
    "--pa-line": "#e2e2dc",
    "--pa-green": "#171717",
    "--pa-green-soft": "rgba(23, 23, 23, 0.08)",
    "--pa-amber": "#42403b",
    "--pa-amber-soft": "rgba(66, 64, 59, 0.12)",
    "--pa-error": "#b42318",
    "--pa-error-soft": "rgba(180, 35, 24, 0.10)",
    "--pa-selection": "rgba(23, 23, 23, 0.16)",
    colorScheme: "light"
  },
  forest: {
    "--pa-bg": "#ffffff",
    "--pa-surface": "#fcfdfc",
    "--pa-muted-surface": "#f6f8f6",
    "--pa-ink": "#1c241e",
    "--pa-muted": "#5f6f63",
    "--pa-line": "#e1e8e2",
    "--pa-green": "#3e7b5f",
    "--pa-green-soft": "rgba(62, 123, 95, 0.10)",
    "--pa-amber": "#8fa44e",
    "--pa-amber-soft": "rgba(143, 164, 78, 0.14)",
    "--pa-error": "#b42318",
    "--pa-error-soft": "rgba(180, 35, 24, 0.10)",
    "--pa-selection": "rgba(62, 123, 95, 0.16)",
    colorScheme: "light"
  },
  mist: {
    "--pa-bg": "#ffffff",
    "--pa-surface": "#fbfcfd",
    "--pa-muted-surface": "#f4f7fa",
    "--pa-ink": "#17212b",
    "--pa-muted": "#587287",
    "--pa-line": "#dde6ee",
    "--pa-green": "#416c98",
    "--pa-green-soft": "rgba(65, 108, 152, 0.10)",
    "--pa-amber": "#6ba7b8",
    "--pa-amber-soft": "rgba(107, 167, 184, 0.14)",
    "--pa-error": "#b42318",
    "--pa-error-soft": "rgba(180, 35, 24, 0.10)",
    "--pa-selection": "rgba(65, 108, 152, 0.16)",
    colorScheme: "light"
  },
  amber: {
    "--pa-bg": "#ffffff",
    "--pa-surface": "#fdfcf9",
    "--pa-muted-surface": "#fbf7f0",
    "--pa-ink": "#241c15",
    "--pa-muted": "#7a5f43",
    "--pa-line": "#e7dccd",
    "--pa-green": "#b1692a",
    "--pa-green-soft": "rgba(177, 105, 42, 0.10)",
    "--pa-amber": "#d59b31",
    "--pa-amber-soft": "rgba(213, 155, 49, 0.14)",
    "--pa-error": "#b42318",
    "--pa-error-soft": "rgba(180, 35, 24, 0.10)",
    "--pa-selection": "rgba(177, 105, 42, 0.16)",
    colorScheme: "light"
  },
  night: {
    "--pa-bg": "#11161c",
    "--pa-surface": "#1a212b",
    "--pa-muted-surface": "#202936",
    "--pa-ink": "#f4efe7",
    "--pa-muted": "#a6b0ba",
    "--pa-line": "rgba(255, 255, 255, 0.08)",
    "--pa-green": "#8dd6c7",
    "--pa-green-soft": "rgba(141, 214, 199, 0.12)",
    "--pa-amber": "#f0b96a",
    "--pa-amber-soft": "rgba(240, 185, 106, 0.14)",
    "--pa-error": "#ff8b7b",
    "--pa-error-soft": "rgba(255, 139, 123, 0.14)",
    "--pa-selection": "rgba(141, 214, 199, 0.18)",
    colorScheme: "dark"
  }
};

export const themeCatalog: Record<ThemeId, ThemeCopy> = {
  newspaper: {
    name: {
      zh: "报纸白底",
      en: "Newspaper White"
    },
    description: {
      zh: "白底、细线和深色标题，适合阅读和管理。",
      en: "White paper, fine lines, and restrained accents."
    },
    swatches: ["#ffffff", "#fcfcfb", "#171717", "#42403b", "#e2e2dc"]
  },
  forest: {
    name: {
      zh: "青林静绿",
      en: "Forest Green"
    },
    description: {
      zh: "白底配绿色点缀，更清爽，也更专注。",
      en: "A white base with green accents for a calmer working rhythm."
    },
    swatches: ["#ffffff", "#fcfdfc", "#3e7b5f", "#8fa44e", "#e1e8e2"]
  },
  mist: {
    name: {
      zh: "晨雾蓝灰",
      en: "Mist Blue"
    },
    description: {
      zh: "更理性，适合信息密度高的后台。",
      en: "Cooler and more analytical for dense administrative work."
    },
    swatches: ["#ffffff", "#fbfcfd", "#416c98", "#6ba7b8", "#dde6ee"]
  },
  amber: {
    name: {
      zh: "台灯琥珀",
      en: "Amber Desk"
    },
    description: {
      zh: "白底带一点暖意，适合低光阅读。",
      en: "A warm white reading tone for low-light sessions."
    },
    swatches: ["#ffffff", "#fdfcf9", "#b1692a", "#d59b31", "#e7dccd"]
  },
  night: {
    name: {
      zh: "夜航墨黑",
      en: "Night Black"
    },
    description: {
      zh: "深色背景，夜间对比更强。",
      en: "A dark theme with stronger contrast at night."
    },
    swatches: ["#11161c", "#1a212b", "#8dd6c7", "#f0b96a", "rgba(255,255,255,0.08)"]
  }
};

export const backgroundCatalog: Record<ThemeBackgroundColor, ThemeCopy> = {
  white: {
    name: {
      zh: "白色",
      en: "White"
    },
    description: {
      zh: "最简单的背景。",
      en: "The simplest available background."
    },
    swatches: ["#ffffff"]
  }
};

const allowedThemeIds = Object.keys(themeCatalog) as ThemeId[];
const allowedBackgroundColors = Object.keys(backgroundCatalog) as ThemeBackgroundColor[];

function normalizeThemeId(value: string | undefined | null): ThemeId {
  if (value && allowedThemeIds.includes(value as ThemeId)) {
    return value as ThemeId;
  }
  return defaultThemePreferences.theme_id;
}

function normalizeBackgroundColor(value: string | undefined | null): ThemeBackgroundColor {
  if (value && allowedBackgroundColors.includes(value as ThemeBackgroundColor)) {
    return value as ThemeBackgroundColor;
  }
  return defaultThemePreferences.background_color;
}

export function normalizeThemePreferences(value: Partial<ThemePreferences>): ThemePreferences {
  return {
    theme_id: normalizeThemeId(value.theme_id),
    background_color: normalizeBackgroundColor(value.background_color)
  };
}

export function readThemePreferences(): ThemePreferences {
  if (typeof window === "undefined") {
    return defaultThemePreferences;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultThemePreferences;
    }
    return normalizeThemePreferences(JSON.parse(raw) as Partial<ThemePreferences>);
  } catch {
    return defaultThemePreferences;
  }
}

export function writeThemePreferences(preferences: ThemePreferences): void {
  if (typeof window === "undefined") {
    return;
  }
  const next = normalizeThemePreferences(preferences);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(THEME_PREFERENCES_UPDATED_EVENT));
}

export function updateThemePreferences(partial: Partial<ThemePreferences>): ThemePreferences {
  const next = normalizeThemePreferences({ ...readThemePreferences(), ...partial });
  writeThemePreferences(next);
  return next;
}

export function applyThemePreferences(preferences: ThemePreferences): void {
  if (typeof document === "undefined") {
    return;
  }
  const next = normalizeThemePreferences(preferences);
  const root = document.documentElement;
  const tokens = themeTokens[next.theme_id];

  Object.entries(tokens).forEach(([key, value]) => {
    if (key === "colorScheme") {
      root.style.colorScheme = value;
      return;
    }
    root.style.setProperty(key, value);
  });

  root.dataset.pagealongTheme = next.theme_id;
  root.dataset.pagealongBackground = next.background_color;
}
