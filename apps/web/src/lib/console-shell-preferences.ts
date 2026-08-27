export type ConsoleShellPreferences = {
  sidebarCollapsed: boolean;
};

const STORAGE_KEY = "pagealong.console-shell.preferences";

export const defaultConsoleShellPreferences: ConsoleShellPreferences = {
  sidebarCollapsed: false
};

function normalizePreferences(value: Partial<ConsoleShellPreferences>): ConsoleShellPreferences {
  return {
    sidebarCollapsed: Boolean(value.sidebarCollapsed)
  };
}

export function readConsoleShellPreferences(): ConsoleShellPreferences {
  if (typeof window === "undefined") {
    return defaultConsoleShellPreferences;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultConsoleShellPreferences;
    }
    return normalizePreferences(JSON.parse(raw) as Partial<ConsoleShellPreferences>);
  } catch {
    return defaultConsoleShellPreferences;
  }
}

export function writeConsoleShellPreferences(preferences: ConsoleShellPreferences): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePreferences(preferences)));
}

export function updateConsoleShellPreferences(partial: Partial<ConsoleShellPreferences>): ConsoleShellPreferences {
  const next = normalizePreferences({ ...readConsoleShellPreferences(), ...partial });
  writeConsoleShellPreferences(next);
  return next;
}
