# PageAlong Android Profile and Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Android `"我的"` tab with account summary, reading preferences, language, day/night theme, feedback, legal links, and sign-out.

**Architecture:** Reuse existing auth, preference, feedback, and legal surfaces where they already exist. Mobile keeps Android-only display language, day/night theme mode, and reader preferences locally at first, while account identity and logout continue to use backend auth routes through the existing `SessionProvider`.

**Tech Stack:** Expo Router, React Native, TypeScript, React Query, AsyncStorage, FastAPI existing auth/feedback APIs, @testing-library/react-native, jest.

**Spec:** `docs/superpowers/specs/2026-08-27-pagealong-android-app-design.md` (Spec 7: 我的)

## Global Constraints

- 只做 Android，不做 iOS。
- 不做 `Sign in with Apple`。
- 不做手机短信验证码登录。
- 微信登录保留，但仅在国内用户可见。
- 手机一键登录保留为可选能力，前提是没有直接金钱成本且接入路径明确。
- 主题只保留白天和夜间两种，不做动态色或额外主题。
- 后端接口优先复用 Web 端现有接口，只有确实无法复用时才补新接口。
- 播放器在应用切到后台后不能停止。
- 下载逻辑要和 Web 端一致：文件已准备好就立即下载，未准备好则提示生成中并引导去任务页。
- 设计、交互、组件、文字风格参考 `/Users/jqsf/Downloads/cubox` 下的竞品截图，只借深色底、强留白、超大标题、紧凑分组、底部抽屉和图标优先的界面语法，不照搬品牌元素。

---

## Scope Check

In scope:

- `"我的"` tab top bar with title and settings/language action.
- Avatar placeholder, email, account status, role, and last login.
- Reading preferences: font size, line height, playback rate.
- Interface language: Chinese/English local toggle.
- Theme: day/night local toggle using existing `ThemeProvider`.
- Feedback form using `POST /feedback`.
- Privacy and terms links using the existing public Web legal pages.
- Logout and logout-all behavior.

Out of scope:

- Editing email address.
- Password change UI. Web already supports it; mobile can link to Web or defer to a later account-management spec.
- Push notifications.
- Paid subscription/account billing.
- Server-synced Android theme beyond the two locked day/night modes.

## Design Direction

- The page should resemble Cubox grouped settings lists: large `"我的"` title, account card at top, then compact grouped rows with icons, values, and chevrons.
- Keep copy utilitarian: `"阅读偏好"`, `"界面语言"`, `"主题"`, `"反馈"`, `"隐私政策"`, `"用户条款"`, `"退出登录"`.
- Use bottom sheets for preference editing and feedback; do not stack full-screen settings pages unless a task genuinely needs room.
- Avatar can be a quiet initials circle; do not introduce profile-photo upload.

## File Structure

### Mobile

- Modify `apps/mobile/src/lib/api.ts`: add feedback and logout helpers if missing.
- Create `apps/mobile/src/lib/preferences.ts`: local reader preference and language persistence.
- Create `apps/mobile/src/components/SettingsGroup.tsx`: grouped settings container.
- Create `apps/mobile/src/components/SettingsRow.tsx`: icon, label, value, chevron/toggle row.
- Create `apps/mobile/src/components/AccountSummaryCard.tsx`: account identity summary.
- Create `apps/mobile/src/components/ReaderPreferencesSheet.tsx`: font/line/rate bottom sheet.
- Create `apps/mobile/src/components/LanguageSheet.tsx`: Chinese/English selector.
- Create `apps/mobile/src/components/FeedbackSheet.tsx`: feedback form.
- Modify `apps/mobile/app/(tabs)/me.tsx`: real profile/settings page.
- Create `apps/mobile/tests/preferences.test.ts`: local preference tests.
- Create `apps/mobile/tests/profile-api.test.ts`: feedback/logout API tests.
- Create `apps/mobile/tests/profile-screen.test.tsx`: screen render and interaction tests.

### Backend

- No backend changes expected. Reuse `GET /auth/me`, `POST /feedback`, `POST /auth/logout`, and `POST /auth/logout-all`.

## Mobile Test Fixture Notes

When a test snippet below calls `mockSessionUser` or `mockSession`, define those helpers at the top of `apps/mobile/tests/profile-screen.test.tsx`. They should mock `useSession()` for the current test file only and expose the same `state`, `signOut`, `signInWithToken`, and `refresh` shape as `SessionProvider`.

---

### Task 1: Add mobile profile API helpers

**Files:**
- Modify: `apps/mobile/src/lib/api.ts`
- Create: `apps/mobile/tests/profile-api.test.ts`

**Interfaces:**
- Consumes: `POST /feedback`, `POST /auth/logout`, and `POST /auth/logout-all`.
- Produces: `submitFeedback`, `logoutSession`, and `logoutAllSessions`.

- [ ] **Step 1: Write failing API tests**

```ts
it("submits feedback to the existing backend endpoint", async () => {
  global.fetch = jest.fn(async () => ({ ok: true })) as jest.Mock;

  await submitFeedback({
    category: "suggestion",
    summary: "移动端建议",
    message: "希望阅读页更安静",
    pagePath: "/mobile/me"
  });

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/feedback"),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        category: "suggestion",
        summary: "移动端建议",
        message: "希望阅读页更安静",
        page_path: "/mobile/me"
      })
    })
  );
});
```

```ts
it("calls logout all sessions", async () => {
  global.fetch = jest.fn(async () => ({ ok: true })) as jest.Mock;

  await logoutAllSessions();

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/auth/logout-all"),
    expect.objectContaining({ method: "POST" })
  );
});
```

- [ ] **Step 2: Run the failing API tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- profile-api.test.ts
```

Expected: fail because helpers are missing.

- [ ] **Step 3: Implement helpers**

Add:

```ts
export type FeedbackCategory = "suggestion" | "bug" | "feature";

export async function submitFeedback(input: {
  category: FeedbackCategory;
  summary: string;
  message: string;
  pagePath?: string;
}): Promise<void> {
  await apiNoContent(
    "/feedback",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        category: input.category,
        summary: input.summary,
        message: input.message,
        page_path: input.pagePath || undefined
      })
    },
    "Failed to send feedback"
  );
}
```

Add logout helpers:

```ts
export async function logoutSession(): Promise<void> {
  await apiNoContent("/auth/logout", { method: "POST" }, "Failed to sign out");
}

export async function logoutAllSessions(): Promise<void> {
  await apiNoContent("/auth/logout-all", { method: "POST" }, "Failed to sign out");
}
```

- [ ] **Step 4: Re-run API tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- profile-api.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit profile API helpers**

```bash
git add apps/mobile/src/lib/api.ts apps/mobile/tests/profile-api.test.ts
git commit -m "feat: add mobile profile api helpers"
```

---

### Task 2: Add local reading and language preferences

**Files:**
- Create: `apps/mobile/src/lib/preferences.ts`
- Create: `apps/mobile/tests/preferences.test.ts`

**Interfaces:**
- Consumes: AsyncStorage.
- Produces: `ReaderPreferences`, `loadReaderPreferences`, `saveReaderPreferences`, `loadLocalePreference`, and `saveLocalePreference`.

- [ ] **Step 1: Write failing preference tests**

```ts
it("persists reader preferences", async () => {
  await saveReaderPreferences({ fontSize: "large", lineHeight: "loose", playbackRate: 1.25 });

  await expect(loadReaderPreferences()).resolves.toEqual({
    fontSize: "large",
    lineHeight: "loose",
    playbackRate: 1.25
  });
});
```

```ts
it("ignores invalid locale preference", async () => {
  await AsyncStorage.setItem("pagealong.locale", "fr");

  await expect(loadLocalePreference()).resolves.toBeNull();
});
```

- [ ] **Step 2: Run the failing preference tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- preferences.test.ts
```

Expected: fail because `src/lib/preferences.ts` does not exist.

- [ ] **Step 3: Implement preferences**

```ts
export type LocalePreference = "zh" | "en";
export type ReaderFontSize = "small" | "standard" | "large";
export type ReaderLineHeight = "compact" | "comfortable" | "loose";

export type ReaderPreferences = {
  fontSize: ReaderFontSize;
  lineHeight: ReaderLineHeight;
  playbackRate: number;
};

export const defaultReaderPreferences: ReaderPreferences = {
  fontSize: "standard",
  lineHeight: "comfortable",
  playbackRate: 1
};
```

Use keys:

- `pagealong.reader.preferences`
- `pagealong.locale`

Validate each loaded value and fall back to defaults/null on malformed JSON or AsyncStorage errors.

- [ ] **Step 4: Re-run preference tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- preferences.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit local preferences**

```bash
git add apps/mobile/src/lib/preferences.ts apps/mobile/tests/preferences.test.ts
git commit -m "feat: add mobile local preferences"
```

---

### Task 3: Add settings list components

**Files:**
- Create: `apps/mobile/src/components/SettingsGroup.tsx`
- Create: `apps/mobile/src/components/SettingsRow.tsx`
- Create: `apps/mobile/src/components/AccountSummaryCard.tsx`
- Create: `apps/mobile/tests/profile-screen.test.tsx`

**Interfaces:**
- Consumes: theme tokens and `AuthUser`.
- Produces: reusable Cubox-style grouped settings UI.

- [ ] **Step 1: Write failing component tests**

```tsx
it("renders account summary with email and status", () => {
  const screen = render(
    <AccountSummaryCard
      user={{
        id: "u1",
        email: "reader@example.com",
        role: "user",
        status: "active",
        email_verified_at: null,
        must_change_password_at_next_login: false,
        last_login_at: null,
        created_at: "2026-08-27T00:00:00"
      }}
    />
  );

  expect(screen.getByText("reader@example.com")).toBeTruthy();
  expect(screen.getByText("正常")).toBeTruthy();
});
```

- [ ] **Step 2: Run failing component tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- profile-screen.test.tsx
```

Expected: fail because components are missing.

- [ ] **Step 3: Implement `SettingsGroup`**

Props:

```ts
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode })
```

Render title above a rounded group surface. In dark mode use subtle borders and a surface close to Cubox grouped rows.

- [ ] **Step 4: Implement `SettingsRow`**

Props:

```ts
type SettingsRowProps = {
  icon: ComponentProps<typeof Feather>["name"];
  label: string;
  value?: string;
  danger?: boolean;
  onPress?: () => void;
  rightAccessory?: ReactNode;
};
```

Rows must be at least 52px high, with left icon, label, optional value, and chevron when pressable.

- [ ] **Step 5: Implement `AccountSummaryCard`**

Display:

- Initials/avatar circle derived from email.
- Email.
- Status label `"正常"` / `"已停用"`.
- Role label `"普通用户"` / `"管理员"`.
- Last-login row if available.

- [ ] **Step 6: Re-run component tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- profile-screen.test.tsx
```

Expected: pass for component tests.

- [ ] **Step 7: Commit settings components**

```bash
git add apps/mobile/src/components/SettingsGroup.tsx apps/mobile/src/components/SettingsRow.tsx apps/mobile/src/components/AccountSummaryCard.tsx apps/mobile/tests/profile-screen.test.tsx
git commit -m "feat: add mobile settings list components"
```

---

### Task 4: Add preference and feedback sheets

**Files:**
- Create: `apps/mobile/src/components/ReaderPreferencesSheet.tsx`
- Create: `apps/mobile/src/components/LanguageSheet.tsx`
- Create: `apps/mobile/src/components/FeedbackSheet.tsx`
- Modify: `apps/mobile/tests/profile-screen.test.tsx`

**Interfaces:**
- Consumes: `BottomSheet`, local preferences, and `submitFeedback`.
- Produces: editable bottom sheets for reader preferences, language, and feedback.

- [ ] **Step 1: Write failing sheet tests**

```tsx
it("saves reader preference changes", () => {
  const onSave = jest.fn();
  const screen = render(
    <ReaderPreferencesSheet
      visible
      preferences={{ fontSize: "standard", lineHeight: "comfortable", playbackRate: 1 }}
      onClose={jest.fn()}
      onSave={onSave}
    />
  );

  fireEvent.press(screen.getByText("大字"));
  fireEvent.press(screen.getByText("完成"));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ fontSize: "large" }));
});
```

```tsx
it("submits feedback", async () => {
  jest.spyOn(api, "submitFeedback").mockResolvedValue(undefined);
  const screen = render(<FeedbackSheet visible onClose={jest.fn()} />);

  fireEvent.changeText(screen.getByPlaceholderText("一句话概括问题"), "阅读页建议");
  fireEvent.changeText(screen.getByPlaceholderText("详细说明"), "希望底部播放器更小");
  fireEvent.press(screen.getByText("发送"));

  await waitFor(() => expect(api.submitFeedback).toHaveBeenCalled());
});
```

- [ ] **Step 2: Run failing sheet tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- profile-screen.test.tsx
```

Expected: fail because sheets are missing.

- [ ] **Step 3: Implement `ReaderPreferencesSheet`**

Controls:

- Font size: `"小字"`, `"标准"`, `"大字"`.
- Line height: `"紧凑"`, `"舒适"`, `"宽松"`.
- Playback rate: `0.75x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`.

Use segmented button rows, not text-only paragraphs.

- [ ] **Step 4: Implement `LanguageSheet`**

Options:

- `"简体中文"`
- `"English"`

Save local preference with `saveLocalePreference`. This controls mobile UI labels added in these specs; it does not change backend content language.

- [ ] **Step 5: Implement `FeedbackSheet`**

Fields:

- Category segmented control: `"建议"`, `"问题"`, `"功能"`.
- Summary placeholder `"一句话概括问题"`.
- Message placeholder `"详细说明"`.
- Submit button `"发送"`.

Validate summary and message are non-empty. Show `"反馈已发送"` on success.

- [ ] **Step 6: Re-run sheet tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- profile-screen.test.tsx
```

Expected: pass.

- [ ] **Step 7: Commit sheets**

```bash
git add apps/mobile/src/components/ReaderPreferencesSheet.tsx apps/mobile/src/components/LanguageSheet.tsx apps/mobile/src/components/FeedbackSheet.tsx apps/mobile/tests/profile-screen.test.tsx
git commit -m "feat: add mobile settings sheets"
```

---

### Task 5: Build the `"我的"` tab

**Files:**
- Modify: `apps/mobile/app/(tabs)/me.tsx`
- Modify: `apps/mobile/src/providers/SessionProvider.tsx`
- Modify: `apps/mobile/tests/profile-screen.test.tsx`

**Interfaces:**
- Consumes: `useSession`, `useTheme`, local preferences, `logoutSession`, `logoutAllSessions`, settings components, and feedback/preferences sheets.
- Produces: profile/settings screen.

- [ ] **Step 1: Write failing screen tests**

```tsx
it("renders profile settings rows", async () => {
  mockSessionUser({ email: "reader@example.com" });

  const screen = render(<MeScreen />);

  expect(screen.getByText("reader@example.com")).toBeTruthy();
  expect(screen.getByText("阅读偏好")).toBeTruthy();
  expect(screen.getByText("界面语言")).toBeTruthy();
  expect(screen.getByText("主题")).toBeTruthy();
  expect(screen.getByText("反馈")).toBeTruthy();
});
```

```tsx
it("signs out from the current device", async () => {
  const signOut = jest.fn();
  mockSession({ signOut });
  jest.spyOn(api, "logoutSession").mockResolvedValue(undefined);

  const screen = render(<MeScreen />);
  fireEvent.press(screen.getByText("退出登录"));

  await waitFor(() => expect(api.logoutSession).toHaveBeenCalled());
  expect(signOut).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run failing screen tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- profile-screen.test.tsx
```

Expected: fail because `"我的"` is still scaffolded.

- [ ] **Step 3: Expose current session state if needed**

If `SessionProvider` does not expose enough state to tests, add stable helpers without changing existing semantics:

```ts
type SessionContextValue = {
  state: SessionState;
  signInWithToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};
```

Do not introduce auth assumptions beyond the existing bearer-token session.

- [ ] **Step 4: Implement screen layout**

Render inside `AppFrame` with title `"我的"` and an optional right language/settings icon.

Groups:

1. Account summary.
2. Preferences:
   - 阅读偏好
   - 界面语言
   - 主题 with local day/night toggle
3. Support:
   - 反馈
   - 隐私政策
   - 用户条款
4. Account actions:
   - 退出登录
   - 退出所有设备

- [ ] **Step 5: Wire legal links**

Use `Linking.openURL`:

```ts
const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000";
```

Open:

- `${WEB_BASE_URL}/privacy`
- `${WEB_BASE_URL}/terms`

Add `EXPO_PUBLIC_WEB_BASE_URL=http://localhost:3000` to `apps/mobile/.env.example` if not already present.

- [ ] **Step 6: Wire logout**

Current-device logout:

```ts
await logoutSession().catch(() => undefined);
await signOut();
router.replace("/(auth)/login");
```

All-device logout:

```ts
await logoutAllSessions().catch(() => undefined);
await signOut();
router.replace("/(auth)/login");
```

- [ ] **Step 7: Re-run screen tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- profile-screen.test.tsx
```

Expected: pass.

- [ ] **Step 8: Commit profile screen**

```bash
git add apps/mobile/app/(tabs)/me.tsx apps/mobile/src/providers/SessionProvider.tsx apps/mobile/.env.example apps/mobile/tests/profile-screen.test.tsx
git commit -m "feat: build mobile profile settings"
```

---

### Task 6: Verify profile and settings

**Files:**
- All files changed by Tasks 1-5.

- [ ] **Step 1: Run mobile profile tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- preferences.test.ts profile-api.test.ts profile-screen.test.tsx
```

- [ ] **Step 2: Run mobile typecheck**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm run typecheck
```

- [ ] **Step 3: Run backend feedback/auth tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_auth_api.py tests/test_feedback_api.py
```

- [ ] **Step 4: Manual Android check**

```bash
API_PORT=8070 make api
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8070 npm run android
```

Check:

- `"我的"` shows email, role/status, and grouped setting rows.
- Theme toggle switches day/night immediately and persists after app restart.
- Reading preference sheet saves font, line height, and playback rate locally.
- Language sheet switches mobile labels for this page and persists locally.
- Feedback submits and shows success/error state.
- Privacy and terms open the existing Web pages.
- Logout clears local token and returns to auth flow once Spec 2 is present.
- Dark mode keeps large title, compact rows, and clear dividers without visual overlap.

- [ ] **Step 5: Commit verification fixes if needed**

```bash
git status --short
git add <only-files-touched-for-this-plan>
git commit -m "fix: polish mobile profile settings"
```
