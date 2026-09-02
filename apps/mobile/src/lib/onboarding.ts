import AsyncStorage from "@react-native-async-storage/async-storage";

const WORKBENCH_ONBOARDING_KEY = "pagealong.onboarding.workbench.v1";
let cachedWorkbenchOnboardingCompleted: boolean | null = null;

export function getCachedWorkbenchOnboardingCompleted(): boolean | null {
  return cachedWorkbenchOnboardingCompleted;
}

export async function loadWorkbenchOnboardingCompleted(): Promise<boolean> {
  if (cachedWorkbenchOnboardingCompleted !== null) {
    return cachedWorkbenchOnboardingCompleted;
  }

  try {
    cachedWorkbenchOnboardingCompleted = (await AsyncStorage.getItem(WORKBENCH_ONBOARDING_KEY)) === "1";
    return cachedWorkbenchOnboardingCompleted;
  } catch {
    cachedWorkbenchOnboardingCompleted = false;
    return false;
  }
}

export async function saveWorkbenchOnboardingCompleted(): Promise<void> {
  cachedWorkbenchOnboardingCompleted = true;
  try {
    await AsyncStorage.setItem(WORKBENCH_ONBOARDING_KEY, "1");
  } catch {
    // Best-effort persistence; the current session still closes the guide.
  }
}

export function resetWorkbenchOnboardingCompletedForTests(): void {
  cachedWorkbenchOnboardingCompleted = null;
}
