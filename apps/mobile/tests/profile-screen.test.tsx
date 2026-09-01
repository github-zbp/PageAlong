import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "@/providers/SessionProvider";
import { useTheme } from "@/providers/ThemeProvider";
import {
  loadLocalePreference,
  loadReaderPreferences,
  saveReaderPreferences,
  defaultReaderPreferences
} from "@/lib/preferences";
import { resetLocalePreferenceForTests, setLocalePreference } from "@/lib/locale";
import type { SessionState } from "@/lib/session";
import {
  logoutSession,
  recordDashboardActivity,
  submitFeedback,
  type AuthUser
} from "@/lib/api";
import MeScreen from "../app/(tabs)/me";
import { AccountSummaryCard } from "@/components/AccountSummaryCard";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { LanguageSheet } from "@/components/LanguageSheet";
import { ReaderPreferencesSheet } from "@/components/ReaderPreferencesSheet";
import { SettingsGroup } from "@/components/SettingsGroup";
import { SettingsRow } from "@/components/SettingsRow";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockToggleMode = jest.fn();
const mockSignOut = jest.fn(async () => undefined);
const mockSignInWithToken = jest.fn(async () => undefined);
const mockedUser: AuthUser = {
  id: "u1",
  email: "reader@example.com",
  role: "user",
  status: "active",
  email_verified_at: null,
  must_change_password_at_next_login: false,
  last_login_at: "2026-08-27T12:00:00.000Z",
  created_at: "2026-08-27T00:00:00.000Z"
};

jest.mock("expo-router", () => ({
  useRouter: jest.fn()
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 24,
    right: 0,
    bottom: 0,
    left: 0
  })
}));

jest.mock("@/providers/SessionProvider", () => ({
  useSession: jest.fn()
}));

jest.mock("@/providers/ThemeProvider", () => ({
  useTheme: jest.fn()
}));

jest.mock("@/lib/api", () => ({
  recordDashboardActivity: jest.fn(),
  logoutSession: jest.fn(),
  submitFeedback: jest.fn()
}));

jest.mock("@/lib/preferences", () => {
  const defaultReaderPreferences = {
    fontSize: "standard",
    lineHeight: "comfortable",
    playbackRate: 1
  };

  return {
    __esModule: true,
    defaultReaderPreferences,
    loadLocalePreference: jest.fn(),
    loadReaderPreferences: jest.fn(),
    saveLocalePreference: jest.fn(),
    saveReaderPreferences: jest.fn()
  };
});

const mockedUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;
const mockedLoadLocalePreference = loadLocalePreference as jest.MockedFunction<typeof loadLocalePreference>;
const mockedLoadReaderPreferences = loadReaderPreferences as jest.MockedFunction<typeof loadReaderPreferences>;
const mockedSaveReaderPreferences = saveReaderPreferences as jest.MockedFunction<typeof saveReaderPreferences>;
const mockedLogoutSession = logoutSession as jest.MockedFunction<typeof logoutSession>;
const mockedRecordDashboardActivity = recordDashboardActivity as jest.MockedFunction<typeof recordDashboardActivity>;
const mockedSubmitFeedback = submitFeedback as jest.MockedFunction<typeof submitFeedback>;
const mockedOpenURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

const themeTokens = {
  background: "#F7F4ED",
  surface: "#FFFDF8",
  elevatedSurface: "#FFFFFF",
  border: "#E5DED2",
  text: "#171717",
  mutedText: "#6B6760",
  accent: "#2F6F5E",
  highlight: "#D7B46A",
  danger: "#A33A2B"
} as const;

function mockSessionUser(user: Partial<AuthUser> = {}) {
  mockedUseSession.mockReturnValue({
    state: {
      status: "signed_in",
      token: "session-token",
      user: { ...mockedUser, ...user }
    },
    signInWithToken: mockSignInWithToken,
    signOut: mockSignOut,
    refresh: jest.fn()
  });
}

function mockSession(state: SessionState) {
  mockedUseSession.mockReturnValue({
    state,
    signInWithToken: mockSignInWithToken,
    signOut: mockSignOut,
    refresh: jest.fn()
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetLocalePreferenceForTests();
  mockedUseRouter.mockReturnValue({
    replace: mockReplace,
    push: mockPush,
    back: mockBack
  } as never);
  mockedUseTheme.mockReturnValue({
    mode: "light",
    tokens: themeTokens,
    setMode: jest.fn(),
    toggleMode: mockToggleMode
  });
  mockSessionUser();
  mockedLoadLocalePreference.mockResolvedValue(null);
  mockedLoadReaderPreferences.mockResolvedValue(defaultReaderPreferences as never);
  mockedSaveReaderPreferences.mockResolvedValue(undefined);
  mockedLogoutSession.mockResolvedValue(undefined);
  mockedRecordDashboardActivity.mockResolvedValue(undefined);
  mockedSubmitFeedback.mockResolvedValue(undefined);
});

afterEach(() => {
  mockedOpenURL.mockClear();
});

it("renders account summary with email and status", async () => {
  const screen = await render(<AccountSummaryCard user={mockedUser} />);

  expect(screen.getByText("reader@example.com")).toBeTruthy();
  expect(screen.getByText("正常")).toBeTruthy();
  expect(screen.getByText("普通用户")).toBeTruthy();
  expect(screen.getByText("上次登录")).toBeTruthy();
});

it("renders grouped settings rows", async () => {
  const onPress = jest.fn();
  const screen = await render(
    <SettingsGroup title="分组">
      <SettingsRow icon="book-open" label="阅读偏好" value="标准" onPress={onPress} />
    </SettingsGroup>
  );

  expect(screen.getByText("分组")).toBeTruthy();
  expect(screen.getByText("阅读偏好")).toBeTruthy();
  expect(screen.getByText("标准")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "阅读偏好" }));
  expect(onPress).toHaveBeenCalled();
});

it("saves reader preference changes", async () => {
  const onSave = jest.fn();
  const screen = await render(
    <ReaderPreferencesSheet
      visible
      preferences={{ fontSize: "standard", lineHeight: "comfortable", playbackRate: 1 }}
      onClose={jest.fn()}
      onSave={onSave}
    />
  );

  await fireEvent.press(await screen.findByRole("button", { name: "大字" }));
  await fireEvent.press(await screen.findByRole("button", { name: "完成" }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ fontSize: "large" }));
});

it("saves locale preference changes", async () => {
  const onChange = jest.fn();
  const screen = await render(<LanguageSheet visible value="zh" onClose={jest.fn()} onChange={onChange} />);

  await fireEvent.press(await screen.findByRole("button", { name: "English" }));
  await fireEvent.press(await screen.findByRole("button", { name: "完成" }));

  await waitFor(() => {
    expect(onChange).toHaveBeenCalledWith("en");
  });
});

it("submits feedback", async () => {
  const screen = await render(<FeedbackSheet visible onClose={jest.fn()} />);

  await fireEvent.changeText(await screen.findByPlaceholderText("一句话概括问题"), "阅读页建议");
  await fireEvent.changeText(await screen.findByPlaceholderText("详细说明"), "希望底部播放器更小");
  await fireEvent.press(await screen.findByRole("button", { name: "发送" }));

  await waitFor(() =>
    expect(mockedSubmitFeedback).toHaveBeenCalledWith({
      category: "suggestion",
      summary: "阅读页建议",
      message: "希望底部播放器更小",
      pagePath: "/mobile/me"
    })
  );
  expect(await screen.findByText("反馈已发送")).toBeTruthy();
});

it("renders profile settings rows", async () => {
  mockSessionUser();
  const screen = await render(<MeScreen />);

  expect(await screen.findByText("reader@example.com")).toBeTruthy();
  expect(screen.getByText("阅读偏好")).toBeTruthy();
  expect(screen.getByText("界面语言")).toBeTruthy();
  expect(screen.getByText("主题")).toBeTruthy();
  expect(screen.getByText("反馈")).toBeTruthy();
  expect(screen.getByText("隐私政策")).toBeTruthy();
  expect(screen.getByText("用户条款")).toBeTruthy();
  expect(screen.getByRole("button", { name: "退出登录" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "退出所有设备" })).toBeNull();
});

it("switches the global app language from the profile screen", async () => {
  const screen = await render(<MeScreen />);

  await fireEvent.press(await screen.findByLabelText("语言"));
  await fireEvent.press(await screen.findByText("English"));
  await fireEvent.press(await screen.findByText("完成"));

  await waitFor(() => {
    expect(screen.getByText("Me")).toBeTruthy();
  });
  expect(screen.getByText("Theme")).toBeTruthy();
});

it("renders profile settings in the global English locale", async () => {
  await setLocalePreference("en");

  const screen = await render(<MeScreen />);

  expect(await screen.findByText("Reading preferences")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Sign out all devices" })).toBeNull();
});

it("switches the day night theme", async () => {
  const screen = await render(<MeScreen />);

  await fireEvent.press(await screen.findByRole("button", { name: "主题" }));

  expect(mockToggleMode).toHaveBeenCalled();
  expect(screen.getByText("白天")).toBeTruthy();
});

it("opens the legal pages", async () => {
  const screen = await render(<MeScreen />);

  await fireEvent.press(await screen.findByRole("button", { name: "隐私政策" }));
  await fireEvent.press(await screen.findByRole("button", { name: "用户条款" }));

  await waitFor(() => {
    expect(mockedOpenURL).toHaveBeenCalledWith(expect.stringContaining("/privacy"));
    expect(mockedOpenURL).toHaveBeenCalledWith(expect.stringContaining("/terms"));
  });
});

it("signs out from the current device", async () => {
  const screen = await render(<MeScreen />);

  await fireEvent.press(await screen.findByRole("button", { name: "退出登录" }));

  await waitFor(() => {
    expect(mockedLogoutSession).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
  });
});
