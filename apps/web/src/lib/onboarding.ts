const DASHBOARD_ONBOARDING_KEY = "pagealong.onboarding.dashboard.v1";

export function hasCompletedDashboardOnboarding(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(DASHBOARD_ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function markDashboardOnboardingCompleted(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(DASHBOARD_ONBOARDING_KEY, "1");
  } catch {
    // Best-effort persistence; the guide still closes in the current session.
  }
}
