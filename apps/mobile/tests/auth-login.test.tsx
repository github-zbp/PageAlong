import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { SessionState } from "@/lib/session";
import { getLoginCapabilities, requestEmailCode } from "@/lib/api";
import { useSession } from "@/providers/SessionProvider";
import IndexPage from "../app/index";
import StartPage from "../app/(auth)/start";
import LoginScreen from "../app/(auth)/login";
import CredentialsScreen from "../app/(auth)/credentials";

const consentLabel = "我已阅读并同意服务协议、隐私政策和用户条款";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockSignInWithToken = jest.fn();
let mockLocalSearchParams: Record<string, string | string[] | undefined> = {};

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, href),
    useRouter: () => ({
      replace: mockReplace,
      push: mockPush,
      back: mockBack
    }),
    useLocalSearchParams: () => mockLocalSearchParams
  };
});

jest.mock("@/providers/SessionProvider", () => ({
  useSession: jest.fn()
}));

jest.mock("@/providers/ThemeProvider", () => ({
  useTheme: () => ({
    mode: "light",
    tokens: {
      background: "#F7F4ED",
      surface: "#FFFDF8",
      elevatedSurface: "#FFFFFF",
      border: "#E5DED2",
      text: "#171717",
      mutedText: "#6B6760",
      accent: "#2F6F5E",
      highlight: "#D7B46A",
      danger: "#A33A2B"
    },
    setMode: jest.fn(),
    toggleMode: jest.fn()
  })
}));

jest.mock("@/lib/api", () => ({
  getLoginCapabilities: jest.fn(),
  loginWithPassword: jest.fn(),
  registerWithEmail: jest.fn(),
  requestEmailCode: jest.fn(),
  loginWithEmailCode: jest.fn(),
  exchangeWechatLogin: jest.fn(),
  exchangeOneTapLogin: jest.fn()
}));

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedGetLoginCapabilities = getLoginCapabilities as jest.MockedFunction<typeof getLoginCapabilities>;
const mockedRequestEmailCode = requestEmailCode as jest.MockedFunction<typeof requestEmailCode>;

function setSessionState(state: SessionState) {
  mockedUseSession.mockReturnValue({
    state,
    signInWithToken: mockSignInWithToken,
    signOut: jest.fn(),
    refresh: jest.fn()
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLocalSearchParams = {};
  setSessionState({ status: "signed_out", token: null, user: null });
  mockedGetLoginCapabilities.mockResolvedValue({
    email_password: true,
    email_code: true,
    wechat: true,
    one_tap: true
  });
});

it("shows the loading gate until session bootstrap resolves", async () => {
  setSessionState({ status: "loading", token: null, user: null });

  const screen = await render(<IndexPage />);

  expect(screen.getByText("PageAlong")).toBeTruthy();
  expect(screen.queryByText("工作台")).toBeNull();
});

it("redirects signed-out users into the auth route group", async () => {
  setSessionState({ status: "signed_out", token: null, user: null });

  const screen = await render(<IndexPage />);

  expect(screen.getByText("/(auth)/start")).toBeTruthy();
});

it("shows the start page and advances into login", async () => {
  const screen = await render(<StartPage />);

  fireEvent.press(screen.getByRole("button", { name: "开始" }));

  await waitFor(() => {
    expect(mockPush).toHaveBeenCalledWith("/(auth)/login");
  });
});

it("shows the login method page and routes to credentials", async () => {
  const screen = await render(<LoginScreen />);

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "密码登录" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "邮箱验证码登录" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "微信登录" })).toBeTruthy();
  });

  fireEvent.press(screen.getByRole("button", { name: "邮箱验证码登录" }));

  expect(mockPush).toHaveBeenCalledWith({ pathname: "/(auth)/credentials", params: { method: "code" } });
});

it("shows a register link on the login method page", async () => {
  const screen = await render(<LoginScreen />);

  await waitFor(() => {
    expect(screen.getByRole("link", { name: "注册" })).toBeTruthy();
  });

  fireEvent.press(screen.getByRole("link", { name: "注册" }));

  expect(mockPush).toHaveBeenCalledWith("/(auth)/register");
});

it("renders the credential form with consent below the fields", async () => {
  mockLocalSearchParams = { method: "password" };

  const screen = await render(<CredentialsScreen />);

  expect(screen.queryByRole("tab", { name: "密码登录" })).toBeNull();
  expect(screen.getByText("邮箱密码登录")).toBeTruthy();
  expect(screen.getByLabelText("邮箱")).toBeTruthy();
  expect(screen.getByLabelText(consentLabel)).toBeTruthy();
  expect(screen.getByRole("button", { name: "登录" })).toBeTruthy();
});

it("opens the credential form in email-code mode without method tabs", async () => {
  mockLocalSearchParams = { method: "code" };

  const screen = await render(<CredentialsScreen />);

  expect(screen.queryByRole("tab", { name: "邮箱验证码" })).toBeNull();
  expect(screen.getByText("邮箱验证码登录")).toBeTruthy();
  expect(screen.getByLabelText("验证码")).toBeTruthy();
});

it("shows the code sent notice after requesting an email code", async () => {
  mockLocalSearchParams = { method: "code" };
  mockedRequestEmailCode.mockResolvedValueOnce(undefined);

  const screen = await render(<CredentialsScreen />);

  fireEvent.changeText(screen.getByLabelText("邮箱"), "reader@example.com");
  fireEvent.press(screen.getByLabelText(consentLabel));

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "发送验证码" })).not.toBeDisabled();
  });

  fireEvent.press(screen.getByRole("button", { name: "发送验证码" }));

  await waitFor(() => {
    expect(mockedRequestEmailCode).toHaveBeenCalledWith({
      email: "reader@example.com",
      purpose: "login"
    });
  });
});
