import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { getPostLoginRedirect } from "@/lib/share";
import { registerWithEmail, requestEmailCode } from "@/lib/api";
import { useSession } from "@/providers/SessionProvider";
import RegisterScreen from "../app/(auth)/register";

const consentLabel = "我已阅读并同意服务协议、隐私政策和用户条款";

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockSignInWithToken = jest.fn();

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, href),
    useRouter: () => ({
      replace: mockReplace,
      push: jest.fn(),
      back: mockBack
    }),
    useLocalSearchParams: () => ({})
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
  registerWithEmail: jest.fn(),
  requestEmailCode: jest.fn()
}));

jest.mock("@/lib/share", () => ({
  getPostLoginRedirect: jest.fn()
}));

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedRegisterWithEmail = registerWithEmail as jest.MockedFunction<typeof registerWithEmail>;
const mockedRequestEmailCode = requestEmailCode as jest.MockedFunction<typeof requestEmailCode>;
const mockedGetPostLoginRedirect = getPostLoginRedirect as jest.MockedFunction<typeof getPostLoginRedirect>;
const CODE_SENT_NOTICE = "验证码已发送，如果没找到请到邮件垃圾箱看看~";

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseSession.mockReturnValue({
    state: { status: "signed_out", token: null, user: null },
    signInWithToken: mockSignInWithToken,
    signOut: jest.fn(),
    refresh: jest.fn()
  });
  mockedGetPostLoginRedirect.mockResolvedValue("/(tabs)/workbench");
});

it("sends register email codes with the register purpose", async () => {
  mockedRequestEmailCode.mockResolvedValueOnce(undefined);

  const screen = await render(<RegisterScreen />);
  await fireEvent.changeText(screen.getByLabelText("邮箱"), "reader@example.com");
  await fireEvent.changeText(screen.getByLabelText("密码"), "abc12345");
  await fireEvent.press(screen.getByLabelText(consentLabel));

  await waitFor(() => {
    expect(screen.getByLabelText("发送验证码")).not.toBeDisabled();
  });

  await fireEvent.press(screen.getByLabelText("发送验证码"));

  await waitFor(() => {
    expect(mockedRequestEmailCode).toHaveBeenCalledWith({
      email: "reader@example.com",
      purpose: "register"
    });
  });

  expect(await screen.findByText(CODE_SENT_NOTICE)).toBeTruthy();
});

it("registers and enters the workbench without a separate login step", async () => {
  mockedRegisterWithEmail.mockResolvedValueOnce({
    token: "register-token",
    user: {
      id: "user-1",
      email: "reader@example.com",
      role: "user",
      status: "active",
      email_verified_at: "2026-08-27T00:00:00.000Z",
      must_change_password_at_next_login: false,
      last_login_at: "2026-08-27T00:00:00.000Z",
      created_at: "2026-08-27T00:00:00.000Z"
    }
  });

  const screen = await render(<RegisterScreen />);
  await fireEvent.changeText(screen.getByLabelText("邮箱"), "reader@example.com");
  await fireEvent.changeText(screen.getByLabelText("密码"), "abc12345");
  await fireEvent.changeText(screen.getByLabelText("验证码"), "123456");
  await fireEvent.press(screen.getByLabelText(consentLabel));

  await waitFor(() => {
    expect(screen.getByLabelText("注册")).not.toBeDisabled();
  });

  await fireEvent.press(screen.getByLabelText("注册"));

  await waitFor(() => {
    expect(mockedRegisterWithEmail).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "abc12345",
      code: "123456"
    });
  });

  await waitFor(() => {
    expect(mockSignInWithToken).toHaveBeenCalledWith("register-token");
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/workbench");
  });
});

it("returns to the share receiver after registration when a pending share exists", async () => {
  mockedGetPostLoginRedirect.mockResolvedValueOnce("/share/receive");
  mockedRegisterWithEmail.mockResolvedValueOnce({
    token: "register-token",
    user: {
      id: "user-1",
      email: "reader@example.com",
      role: "user",
      status: "active",
      email_verified_at: "2026-08-27T00:00:00.000Z",
      must_change_password_at_next_login: false,
      last_login_at: "2026-08-27T00:00:00.000Z",
      created_at: "2026-08-27T00:00:00.000Z"
    }
  });

  const screen = await render(<RegisterScreen />);
  await fireEvent.changeText(screen.getByLabelText("邮箱"), "reader@example.com");
  await fireEvent.changeText(screen.getByLabelText("密码"), "abc12345");
  await fireEvent.changeText(screen.getByLabelText("验证码"), "123456");
  await fireEvent.press(screen.getByLabelText(consentLabel));

  await waitFor(() => {
    expect(screen.getByLabelText("注册")).not.toBeDisabled();
  });

  await fireEvent.press(screen.getByLabelText("注册"));

  await waitFor(() => {
    expect(mockSignInWithToken).toHaveBeenCalledWith("register-token");
  });

  expect(mockReplace).toHaveBeenCalledWith("/share/receive");
});
