"use client";

import { useEffect } from "react";
import {
  applyThemePreferences,
  readThemePreferences,
  THEME_PREFERENCES_UPDATED_EVENT
} from "@/lib/theme-preferences";

export function ThemeBootstrap() {
  useEffect(() => {
    function syncTheme() {
      applyThemePreferences(readThemePreferences());
    }

    syncTheme();
    window.addEventListener(THEME_PREFERENCES_UPDATED_EVENT, syncTheme);
    window.addEventListener("storage", syncTheme);

    return () => {
      window.removeEventListener(THEME_PREFERENCES_UPDATED_EVENT, syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  return null;
}
