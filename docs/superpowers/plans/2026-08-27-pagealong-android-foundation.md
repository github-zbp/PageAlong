# PageAlong Android App Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Android-only PageAlong app foundation with Expo, shared session/theme/audio primitives, and the four-tab shell that later specs can complete.

**Architecture:** Use a managed Expo Router app in `apps/mobile` with React Query for server state, SecureStore for durable auth token storage, AsyncStorage for local theme preference, and `expo-audio` as the shared background audio primitive. The shell will not invent any new backend behavior; it will bootstrap from the existing web auth and theme endpoints, persist session state locally, and present a stable app frame that later specs can extend with login, search, import, library, and reading flows.

**Tech Stack:** Expo, Expo Router, React Native, TypeScript, React Query, expo-secure-store, expo-audio, AsyncStorage, react-native-safe-area-context, react-native-gesture-handler, @expo/vector-icons, jest-expo, @testing-library/react-native.

---

## Scope Check

This plan implements only **Spec 1: Android 基础底座** from `docs/superpowers/specs/2026-08-27-pagealong-android-app-design.md`.

In scope:

- Create the new Android app workspace under `apps/mobile`.
- Add local developer commands for the mobile app.
- Add auth token persistence and session bootstrap primitives.
- Add day/night theme persistence and theme tokens.
- Add the background audio configuration primitive.
- Build the root route tree and the four-tab shell.
- Add a small mobile test harness for the new primitives and shell.

Out of scope:

- Login UI and login method selection.
- Search, import, URL WebView, file picker, and clipboard flows.
- Course list, series list, reading page, directory, playback UI, and task center details.
- iOS, Sign in with Apple, SMS login, wallet/payment, OCR, or real TTS.
- Backend API changes.

Separate plans should cover Specs 2 through 7 one by one.

## File Structure

Create the mobile workspace and its configs:

- `apps/mobile/package.json`: Expo workspace scripts and dependencies.
- `apps/mobile/app.config.ts`: Expo config, Android package id, and API base URL fallback.
- `apps/mobile/babel.config.js`: Expo Router Babel setup.
- `apps/mobile/metro.config.js`: Metro config for Expo Router.
- `apps/mobile/tsconfig.json`: Mobile TypeScript config.
- `apps/mobile/jest.config.js`: Jest + Expo test config.
- `apps/mobile/jest.setup.ts`: RN test setup and module mocks.
- `apps/mobile/.env.example`: mobile-only environment template.

Create the mobile runtime layer:

- `apps/mobile/app/_layout.tsx`: root providers and navigation container.
- `apps/mobile/app/index.tsx`: bootstrap redirect into the shell.
- `apps/mobile/app/(tabs)/_layout.tsx`: the four-tab navigator.
- `apps/mobile/app/(tabs)/workbench.tsx`: workbench screen scaffold.
- `apps/mobile/app/(tabs)/library.tsx`: course library scaffold.
- `apps/mobile/app/(tabs)/downloads.tsx`: task center scaffold.
- `apps/mobile/app/(tabs)/me.tsx`: profile/settings scaffold.
- `apps/mobile/src/components/AppFrame.tsx`: common screen frame.
- `apps/mobile/src/components/TopAppBar.tsx`: shared top bar shell.
- `apps/mobile/src/components/TabBar.tsx`: shared bottom tab bar.
- `apps/mobile/src/components/Screen.tsx`: scroll and safe-area wrapper.
- `apps/mobile/src/providers/QueryProvider.tsx`: React Query client setup.
- `apps/mobile/src/providers/SessionProvider.tsx`: durable auth/session bootstrap.
- `apps/mobile/src/providers/ThemeProvider.tsx`: persisted light/dark mode.
- `apps/mobile/src/providers/AudioProvider.tsx`: background audio setup.
- `apps/mobile/src/lib/api.ts`: mobile API client.
- `apps/mobile/src/lib/auth-storage.ts`: token persistence helper.
- `apps/mobile/src/lib/session-store.ts`: in-memory session token store.
- `apps/mobile/src/lib/session.ts`: session bootstrap and persistence helpers.
- `apps/mobile/src/lib/theme.ts`: theme tokens and persistence helpers.
- `apps/mobile/src/lib/audio.ts`: `expo-audio` mode configuration.
- `apps/mobile/src/lib/navigation.ts`: tab metadata shared by the shell.
- `apps/mobile/tests/auth-storage.test.ts`: token persistence tests.
- `apps/mobile/tests/session.test.ts`: session bootstrap tests.
- `apps/mobile/tests/theme.test.ts`: theme token and persistence tests.
- `apps/mobile/tests/audio.test.ts`: audio mode tests.
- `apps/mobile/tests/app-frame.test.tsx`: shell render tests.

Modify repo-level wiring:

- `.gitignore`: ignore Expo local artifacts.
- `Makefile`: add mobile install/start/test targets.
- `docs/local-development.md`: add mobile setup and Android emulator notes.

---

### Task 1: Bootstrap the Expo workspace and repo wiring

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.config.ts`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/metro.config.js`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/jest.config.js`
- Create: `apps/mobile/jest.setup.ts`
- Create: `apps/mobile/.env.example`
- Modify: `.gitignore`
- Modify: `Makefile`
- Modify: `docs/local-development.md`

- [ ] **Step 1: Add a failing mobile workspace check**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm run typecheck
```

Expected: fail because the new workspace and route tree do not exist yet.

- [ ] **Step 2: Create the Expo app package and config**

Create `apps/mobile/package.json`:

```json
{
  "name": "pagealong-mobile",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "typecheck": "tsc --noEmit",
    "test": "jest --runInBand"
  }
}
```

Create `apps/mobile/app.config.ts`:

```ts
import type { ExpoConfig } from "expo/config";

export default (): ExpoConfig => ({
  name: "PageAlong",
  slug: "pagealong",
  scheme: "pagealong",
  orientation: "portrait",
  platforms: ["android"],
  android: {
    package: "com.pagealong.app"
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:8070"
  },
  plugins: ["expo-router", "expo-secure-store"]
});
```

Create `apps/mobile/babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["expo-router/babel"]
  };
};
```

Create `apps/mobile/metro.config.js`:

```js
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
```

Create `apps/mobile/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["app/**/*.ts", "app/**/*.tsx", "src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx"]
}
```

Create `apps/mobile/jest.config.js`:

```js
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"]
};
```

Create `apps/mobile/jest.setup.ts`:

```ts
import "@testing-library/jest-native/extend-expect";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));
```

Create `apps/mobile/.env.example`:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8070
```

Update `.gitignore`:

```gitignore
apps/mobile/.expo/
apps/mobile/.expo-shared/
apps/mobile/.eas/
apps/mobile/web-build/
```

Update `Makefile`:

```makefile
deps:
	cd apps/mobile && $(NPM) install

mobile:
	cd apps/mobile && $(NPM) run start

mobile-android:
	cd apps/mobile && EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8070 $(NPM) run android

test-mobile:
	cd apps/mobile && $(NPM) test

test: test-api test-web test-extension test-mobile
```

Update `docs/local-development.md` with a mobile section:

```md
## Android app

```bash
cd apps/mobile
cp .env.example .env
npm install
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8070 npm run start
```

Use `10.0.2.2` for the Android emulator. Physical devices need the host machine LAN IP or an Expo tunnel.
```

- [ ] **Step 3: Install the mobile dependencies**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile
npx expo install expo-router expo-secure-store expo-audio expo-status-bar react-native-safe-area-context react-native-gesture-handler react-native-screens
npm install @tanstack/react-query @react-native-async-storage/async-storage @expo/vector-icons
npm install -D jest jest-expo @testing-library/react-native @testing-library/jest-native
```

Expected: the workspace gets a lockfile and the Expo dependency set resolves cleanly.

- [ ] **Step 4: Re-run the mobile test harness**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test
```

Expected: still fails, but now because the runtime layer and test subjects are not in place yet rather than because the workspace bootstrap is missing.

- [ ] **Step 5: Commit the workspace scaffold**

```bash
git add .gitignore Makefile docs/local-development.md apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/app.config.ts apps/mobile/babel.config.js apps/mobile/metro.config.js apps/mobile/tsconfig.json apps/mobile/jest.config.js apps/mobile/jest.setup.ts apps/mobile/.env.example
git commit -m "feat: scaffold android app workspace"
```

---

### Task 2: Add session, theme, and audio primitives

**Files:**
- Create: `apps/mobile/src/lib/auth-storage.ts`
- Create: `apps/mobile/src/lib/session.ts`
- Create: `apps/mobile/src/lib/api.ts`
- Create: `apps/mobile/src/lib/theme.ts`
- Create: `apps/mobile/src/lib/audio.ts`
- Create: `apps/mobile/src/lib/session-store.ts`
- Create: `apps/mobile/src/providers/QueryProvider.tsx`
- Create: `apps/mobile/src/providers/SessionProvider.tsx`
- Create: `apps/mobile/src/providers/ThemeProvider.tsx`
- Create: `apps/mobile/src/providers/AudioProvider.tsx`
- Test: `apps/mobile/tests/auth-storage.test.ts`
- Test: `apps/mobile/tests/session.test.ts`
- Test: `apps/mobile/tests/theme.test.ts`
- Test: `apps/mobile/tests/audio.test.ts`

- [ ] **Step 1: Write the failing unit tests for the core primitives**

Create `apps/mobile/tests/auth-storage.test.ts`:

```ts
import { clearAuthToken, loadAuthToken, saveAuthToken } from "@/lib/auth-storage";
import * as SecureStore from "expo-secure-store";

it("stores and clears the auth token", async () => {
  (SecureStore.setItemAsync as jest.Mock).mockResolvedValueOnce(undefined);
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce("token-123");
  (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValueOnce(undefined);

  await saveAuthToken("token-123");
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("pagealong.auth.token", "token-123");

  await expect(loadAuthToken()).resolves.toBe("token-123");

  await clearAuthToken();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("pagealong.auth.token");
});
```

Create `apps/mobile/tests/theme.test.ts`:

```ts
import { getThemeTokens } from "@/lib/theme";

it("returns separate day and night tokens", () => {
  expect(getThemeTokens("light").background).not.toBe(getThemeTokens("dark").background);
  expect(getThemeTokens("light").surface).not.toBe(getThemeTokens("dark").surface);
});
```

Create `apps/mobile/tests/audio.test.ts`:

```ts
import { setAudioModeAsync } from "expo-audio";
import { configureBackgroundAudio } from "@/lib/audio";

it("enables background audio mode", async () => {
  (setAudioModeAsync as jest.Mock).mockResolvedValueOnce(undefined);

  await configureBackgroundAudio();

  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      shouldPlayInBackground: true,
      playsInSilentMode: true
    })
  );
});
```

Create `apps/mobile/tests/session.test.ts`:

```ts
jest.mock("@/lib/auth-storage", () => ({
  loadAuthToken: jest.fn(),
  saveAuthToken: jest.fn(),
  clearAuthToken: jest.fn()
}));

jest.mock("@/lib/api", () => ({
  getCurrentUser: jest.fn()
}));

import { bootstrapSession } from "@/lib/session";
import { loadAuthToken } from "@/lib/auth-storage";

it("boots to signed out when no token exists", async () => {
  (loadAuthToken as jest.Mock).mockResolvedValueOnce(null);

  await expect(bootstrapSession()).resolves.toMatchObject({
    status: "signed_out",
    token: null,
    user: null
  });
});
```

- [ ] **Step 2: Implement durable token storage**

Create `apps/mobile/src/lib/auth-storage.ts`:

```ts
import * as SecureStore from "expo-secure-store";

const AUTH_TOKEN_KEY = "pagealong.auth.token";

export async function loadAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function saveAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}
```

Create `apps/mobile/src/lib/session-store.ts`:

```ts
let sessionToken: string | null = null;

export function getSessionToken(): string | null {
  return sessionToken;
}

export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

export function clearSessionToken(): void {
  sessionToken = null;
}
```

Create `apps/mobile/src/lib/session.ts`:

```ts
import { clearAuthToken, loadAuthToken, saveAuthToken } from "@/lib/auth-storage";
import { getCurrentUser, type AuthUser } from "@/lib/api";
import { clearSessionToken, setSessionToken } from "@/lib/session-store";

export type SessionState =
  | { status: "loading"; token: string | null; user: null }
  | { status: "signed_out"; token: null; user: null }
  | { status: "signed_in"; token: string; user: AuthUser };

export async function bootstrapSession(): Promise<SessionState> {
  const token = await loadAuthToken();
  if (!token) {
    clearSessionToken();
    return { status: "signed_out", token: null, user: null };
  }

  try {
    setSessionToken(token);
    const user = await getCurrentUser();
    return { status: "signed_in", token, user };
  } catch {
    await clearSession();
    return { status: "signed_out", token: null, user: null };
  }
}

export async function persistSession(token: string): Promise<void> {
  setSessionToken(token);
  await saveAuthToken(token);
}

export async function clearSession(): Promise<void> {
  clearSessionToken();
  await clearAuthToken();
}
```

Create `apps/mobile/src/lib/api.ts`:

```ts
import { clearAuthToken } from "@/lib/auth-storage";
import { clearSessionToken, getSessionToken } from "@/lib/session-store";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:8070";

async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    // ignore
  }
  return fallback;
}

export async function apiFetch(path: string, init: RequestInit = {}, auth = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (auth) {
    const token = getSessionToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (auth && response.status === 401) {
    clearSessionToken();
    await clearAuthToken();
  }
  return response;
}

export async function apiJson<T>(path: string, init: RequestInit = {}, fallback = "Request failed", auth = true): Promise<T> {
  const response = await apiFetch(path, init, auth);
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, fallback));
  }
  return (await response.json()) as T;
}

export async function apiNoContent(path: string, init: RequestInit = {}, fallback = "Request failed", auth = true): Promise<void> {
  const response = await apiFetch(path, init, auth);
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, fallback));
  }
}

export type AuthUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  email_verified_at: string | null;
  must_change_password_at_next_login: boolean;
  last_login_at: string | null;
  created_at: string;
};

export async function getCurrentUser(): Promise<AuthUser> {
  return apiJson<AuthUser>("/auth/me", { cache: "no-store" }, "Failed to load account");
}
```

- [ ] **Step 3: Implement theme tokens and audio mode configuration**

Create `apps/mobile/src/lib/theme.ts`:

```ts
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
  const value = await AsyncStorage.getItem(THEME_KEY);
  return value === "dark" || value === "light" ? value : null;
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(THEME_KEY, mode);
}
```

Create `apps/mobile/src/lib/audio.ts`:

```ts
import { setAudioModeAsync } from "expo-audio";

export async function configureBackgroundAudio(): Promise<void> {
  await setAudioModeAsync({
    shouldPlayInBackground: true,
    playsInSilentMode: true,
    interruptionMode: "duckOthers"
  });
}
```

Create `apps/mobile/src/providers/QueryProvider.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";

export function QueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 60_000
          }
        }
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

Create `apps/mobile/src/providers/SessionProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { getCurrentUser } from "@/lib/api";
import { bootstrapSession, clearSession, persistSession, type SessionState } from "@/lib/session";

type SessionContextValue = {
  state: SessionState;
  signInWithToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ status: "loading", token: null, user: null });

  useEffect(() => {
    let active = true;
    void bootstrapSession().then((nextState) => {
      if (active) {
        setState(nextState);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      async signInWithToken(token: string) {
        await persistSession(token);
        try {
          const user = await getCurrentUser();
          setState({ status: "signed_in", token, user });
        } catch (error) {
          await clearSession();
          setState({ status: "signed_out", token: null, user: null });
          throw error;
        }
      },
      async signOut() {
        await clearSession();
        setState({ status: "signed_out", token: null, user: null });
      },
      async refresh() {
        setState(await bootstrapSession());
      }
    }),
    [state]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return value;
}
```

Create `apps/mobile/src/providers/ThemeProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
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
  const [mode, setMode] = useState<ThemeMode>(Appearance.getColorScheme() === "dark" ? "dark" : "light");

  useEffect(() => {
    void loadThemeMode().then((stored) => {
      if (stored) {
        setMode(stored);
      }
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    tokens: getThemeTokens(mode),
    setMode(nextMode) {
      setMode(nextMode);
      void saveThemeMode(nextMode);
    },
    toggleMode() {
      const nextMode = mode === "dark" ? "light" : "dark";
      setMode(nextMode);
      void saveThemeMode(nextMode);
    }
  }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return value;
}
```

Create `apps/mobile/src/providers/AudioProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { configureBackgroundAudio } from "@/lib/audio";

type AudioContextValue = {
  ready: boolean;
};

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void configureBackgroundAudio().finally(() => setReady(true));
  }, []);

  return <AudioContext.Provider value={{ ready }}>{children}</AudioContext.Provider>;
}

export function useAudio() {
  const value = useContext(AudioContext);
  if (!value) {
    throw new Error("useAudio must be used inside AudioProvider");
  }
  return value;
}
```

- [ ] **Step 4: Re-run the primitive tests**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test
```

Expected: pass after the storage, session, theme, and audio primitives exist.

- [ ] **Step 5: Commit the runtime layer**

```bash
git add apps/mobile/src/lib/auth-storage.ts apps/mobile/src/lib/session-store.ts apps/mobile/src/lib/session.ts apps/mobile/src/lib/api.ts apps/mobile/src/lib/theme.ts apps/mobile/src/lib/audio.ts apps/mobile/src/providers/QueryProvider.tsx apps/mobile/src/providers/SessionProvider.tsx apps/mobile/src/providers/ThemeProvider.tsx apps/mobile/src/providers/AudioProvider.tsx apps/mobile/tests/auth-storage.test.ts apps/mobile/tests/session.test.ts apps/mobile/tests/theme.test.ts apps/mobile/tests/audio.test.ts
git commit -m "feat: add mobile runtime primitives"
```

---

### Task 3: Build the route tree and four-tab shell

**Files:**
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/index.tsx`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/workbench.tsx`
- Create: `apps/mobile/app/(tabs)/library.tsx`
- Create: `apps/mobile/app/(tabs)/downloads.tsx`
- Create: `apps/mobile/app/(tabs)/me.tsx`
- Create: `apps/mobile/src/components/AppFrame.tsx`
- Create: `apps/mobile/src/components/TopAppBar.tsx`
- Create: `apps/mobile/src/components/TabBar.tsx`
- Create: `apps/mobile/src/components/Screen.tsx`
- Create: `apps/mobile/src/lib/navigation.ts`
- Test: `apps/mobile/tests/app-frame.test.tsx`

- [ ] **Step 1: Write the failing shell render test**

Create `apps/mobile/tests/app-frame.test.tsx`:

```tsx
jest.mock("@/providers/ThemeProvider", () => ({
  useTheme: () => ({
    mode: "light",
    tokens: {
      background: "#F7F4ED",
      surface: "#FFFDF8",
      border: "#E5DED2",
      text: "#171717",
      mutedText: "#6B6760",
      accent: "#2F6F5E"
    },
    setMode: jest.fn(),
    toggleMode: jest.fn()
  })
}));

import { render } from "@testing-library/react-native";
import { AppFrame } from "@/components/AppFrame";
import { TAB_ROUTES } from "@/lib/navigation";

it("renders the top frame and all four tab labels", () => {
  const screen = render(
    <AppFrame title="工作台">
      <></>
    </AppFrame>
  );

  expect(screen.getByText("工作台")).toBeTruthy();
  expect(TAB_ROUTES).toHaveLength(4);
  expect(TAB_ROUTES.map((route) => route.title)).toEqual(["工作台", "课程库", "下载资源", "我的"]);
});
```

- [ ] **Step 2: Add the route metadata and shared frame**

Create `apps/mobile/src/lib/navigation.ts`:

```ts
import type { ComponentProps } from "react";
import { Feather } from "@expo/vector-icons";

export const TAB_ROUTES = [
  { name: "workbench", title: "工作台", icon: "home" as const },
  { name: "library", title: "课程库", icon: "book-open" as const },
  { name: "downloads", title: "下载资源", icon: "download" as const },
  { name: "me", title: "我的", icon: "user" as const }
] as const;

export type TabRoute = (typeof TAB_ROUTES)[number];
export type TabIconName = ComponentProps<typeof Feather>["name"];
```

Create `apps/mobile/src/components/Screen.tsx`:

```tsx
import { ScrollView, View, type PropsWithChildren } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";

export function Screen({ children }: PropsWithChildren) {
  const { tokens } = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: tokens.background }} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ flex: 1, padding: 16 }}>{children}</View>
    </ScrollView>
  );
}
```

Create `apps/mobile/src/components/TopAppBar.tsx`:

```tsx
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/providers/ThemeProvider";
import type { ReactNode } from "react";

type Props = {
  title: string;
  rightAction?: ReactNode;
  onRightAction?: () => void;
};

export function TopAppBar({ title, rightAction, onRightAction }: Props) {
  const { tokens } = useTheme();

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 16, paddingVertical: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ color: tokens.text, fontSize: 18, fontWeight: "600" }}>{title}</Text>
        <Pressable onPress={onRightAction} hitSlop={10}>
          {rightAction ?? <Feather name="settings" size={20} color={tokens.mutedText} />}
        </Pressable>
      </View>
    </View>
  );
}
```

Create `apps/mobile/src/components/AppFrame.tsx`:

```tsx
import { View, type PropsWithChildren } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { TopAppBar } from "@/components/TopAppBar";
import type { ReactNode } from "react";

type Props = PropsWithChildren<{
  title: string;
  rightAction?: ReactNode;
  onRightAction?: () => void;
}>;

export function AppFrame({ title, rightAction, onRightAction, children }: Props) {
  const { tokens } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      <TopAppBar title={title} rightAction={rightAction} onRightAction={onRightAction} />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
```

Create `apps/mobile/src/components/TabBar.tsx`:

```tsx
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "@/providers/ThemeProvider";
import { TAB_ROUTES } from "@/lib/navigation";

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { tokens } = useTheme();

  return (
    <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: tokens.border, backgroundColor: tokens.surface }}>
      {TAB_ROUTES.map((route, index) => {
        const focused = state.index === index;

        return (
          <Pressable
            key={route.name}
            onPress={() => navigation.navigate(route.name)}
            style={{ flex: 1, paddingVertical: 12, alignItems: "center", gap: 4, opacity: focused ? 1 : 0.72 }}
          >
            <Feather name={route.icon} size={18} color={focused ? tokens.accent : tokens.mutedText} />
            <Text style={{ color: focused ? tokens.accent : tokens.mutedText, fontSize: 12 }}>{route.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 3: Build the root layout and tab navigator**

Create `apps/mobile/app/_layout.tsx`:

```tsx
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { QueryProvider } from "@/providers/QueryProvider";
import { SessionProvider } from "@/providers/SessionProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AudioProvider } from "@/providers/AudioProvider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryProvider>
          <ThemeProvider>
            <SessionProvider>
              <AudioProvider>
                <Stack screenOptions={{ headerShown: false }} />
              </AudioProvider>
            </SessionProvider>
          </ThemeProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

Create `apps/mobile/app/index.tsx`:

```tsx
import { Redirect } from "expo-router";

export default function Index() {
  return <Redirect href="/(tabs)/workbench" />;
}
```

Create `apps/mobile/app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from "expo-router";
import { useTheme } from "@/providers/ThemeProvider";
import { TAB_ROUTES } from "@/lib/navigation";
import { TabBar } from "@/components/TabBar";

export default function TabsLayout() {
  const { tokens } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.accent,
        tabBarInactiveTintColor: tokens.mutedText,
        tabBarStyle: { borderTopColor: tokens.border, backgroundColor: tokens.surface }
      }}
      tabBar={(props) => <TabBar {...props} />}
    >
      {TAB_ROUTES.map((route) => (
        <Tabs.Screen
          key={route.name}
          name={route.name}
          options={{
            title: route.title
          }}
        />
      ))}
    </Tabs>
  );
}
```

- [ ] **Step 4: Add the four shell screens with honest empty states**

Create `apps/mobile/app/(tabs)/workbench.tsx`:

```tsx
import { Text, View } from "react-native";
import { AppFrame } from "@/components/AppFrame";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/providers/ThemeProvider";
import { useSession } from "@/providers/SessionProvider";

export default function WorkbenchScreen() {
  const { tokens } = useTheme();
  const { state } = useSession();

  return (
    <AppFrame title="工作台">
      <Screen>
        <View style={{ gap: 12 }}>
          <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 12, padding: 16, backgroundColor: tokens.surface }}>
            <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>继续学习</Text>
            <Text style={{ color: tokens.mutedText, marginTop: 8 }}>
              {state.status === "signed_in" ? `当前账号：${state.user.email}` : "会话会在后续登录流程接入后恢复。"}
            </Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 12, padding: 16, backgroundColor: tokens.surface }}>
            <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>最近阅读</Text>
            <Text style={{ color: tokens.mutedText, marginTop: 8 }}>这里会在后续 spec 中接入课程列表。</Text>
          </View>
        </View>
      </Screen>
    </AppFrame>
  );
}
```

Create `apps/mobile/app/(tabs)/library.tsx`:

```tsx
import { Text } from "react-native";
import { AppFrame } from "@/components/AppFrame";
import { Screen } from "@/components/Screen";

export default function LibraryScreen() {
  return (
    <AppFrame title="课程库">
      <Screen>
        <Text>课程库的列表与筛选会在下一阶段接入。</Text>
      </Screen>
    </AppFrame>
  );
}
```

Create `apps/mobile/app/(tabs)/downloads.tsx`:

```tsx
import { Text } from "react-native";
import { AppFrame } from "@/components/AppFrame";
import { Screen } from "@/components/Screen";

export default function DownloadsScreen() {
  return (
    <AppFrame title="下载资源">
      <Screen>
        <Text>导入与下载任务中心会在后续 spec 中补齐。</Text>
      </Screen>
    </AppFrame>
  );
}
```

Create `apps/mobile/app/(tabs)/me.tsx`:

```tsx
import { Pressable, Text, View } from "react-native";
import { AppFrame } from "@/components/AppFrame";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/providers/ThemeProvider";
import { useSession } from "@/providers/SessionProvider";

export default function MeScreen() {
  const { tokens, mode, toggleMode } = useTheme();
  const { state } = useSession();

  return (
    <AppFrame title="我的">
      <Screen>
        <View style={{ gap: 12 }}>
          <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 12, padding: 16, backgroundColor: tokens.surface }}>
            <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>账号信息</Text>
            <Text style={{ color: tokens.mutedText, marginTop: 8 }}>
              {state.status === "signed_in" ? state.user.email : "登录入口会在下一阶段接入。"}
            </Text>
          </View>
          <Pressable onPress={toggleMode} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 12, padding: 16, backgroundColor: tokens.surface }}>
            <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>主题</Text>
            <Text style={{ color: tokens.mutedText, marginTop: 8 }}>当前是 {mode === "dark" ? "夜间" : "白天"} 模式，点击切换。</Text>
          </Pressable>
        </View>
      </Screen>
    </AppFrame>
  );
}
```

- [ ] **Step 5: Run the shell tests and typecheck**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test && npm run typecheck
```

Expected: pass once the shell and providers are wired together.

- [ ] **Step 6: Commit the shell**

```bash
git add apps/mobile/app/_layout.tsx apps/mobile/app/index.tsx apps/mobile/app/(tabs)/_layout.tsx apps/mobile/app/(tabs)/workbench.tsx apps/mobile/app/(tabs)/library.tsx apps/mobile/app/(tabs)/downloads.tsx apps/mobile/app/(tabs)/me.tsx apps/mobile/src/components/AppFrame.tsx apps/mobile/src/components/TopAppBar.tsx apps/mobile/src/components/TabBar.tsx apps/mobile/src/components/Screen.tsx apps/mobile/src/lib/navigation.ts apps/mobile/tests/app-frame.test.tsx
git commit -m "feat: add android app shell"
```

---

### Task 4: Verify Android startup and finish the foundation

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `Makefile`
- Modify: `docs/local-development.md`

- [ ] **Step 1: Ensure the mobile scripts are exposed from the workspace**

Confirm `apps/mobile/package.json` still contains:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "typecheck": "tsc --noEmit",
    "test": "jest --runInBand"
  }
}
```

- [ ] **Step 2: Add a repository-level mobile test target if it is missing**

Keep the root `Makefile` mobile targets as:

```makefile
mobile:
	cd apps/mobile && $(NPM) run start

mobile-android:
	cd apps/mobile && EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8070 $(NPM) run android

test-mobile:
	cd apps/mobile && $(NPM) test
```

- [ ] **Step 3: Run the repo checks that cover the new app**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm run typecheck
```

Expected: both pass.

- [ ] **Step 4: Verify the Android path against a running API**

Run the API in another terminal:

```bash
cd /Users/jqsf/Desktop/code/web_reader && API_PORT=8070 make api
```

Then launch the Android app:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8070 npm run android
```

Expected: Expo opens the Android app shell, the four tabs render, the app starts with the base shell, and the session/theme/audio providers initialize without throwing.

- [ ] **Step 5: Commit the finished foundation**

```bash
git add .gitignore Makefile docs/local-development.md apps/mobile
git commit -m "feat: finish android app foundation"
```
