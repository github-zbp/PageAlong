import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Appearance } from "react-native";
import { getThemeTokens, loadThemeMode, saveThemeMode, type ThemeMode } from "@/lib/theme";

type ThemeContextValue = {
  mode: ThemeMode;
  tokens: ReturnType<typeof getThemeTokens>;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>(() => (Appearance.getColorScheme() === "dark" ? "dark" : "light"));

  useEffect(() => {
    void loadThemeMode().then((stored) => {
      if (stored) {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void saveThemeMode(nextMode);
  }, []);

  const toggleMode = useCallback(() => {
    const nextMode = mode === "dark" ? "light" : "dark";
    setModeState(nextMode);
    void saveThemeMode(nextMode);
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      tokens: getThemeTokens(mode),
      setMode,
      toggleMode
    }),
    [mode, setMode, toggleMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return value;
}
