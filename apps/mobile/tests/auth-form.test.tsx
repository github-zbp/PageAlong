import { render } from "@testing-library/react-native";
import { AuthForm } from "@/components/AuthForm";

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

const codeSentNotice = "验证码已发送，如果没找到请到邮件垃圾箱看看~";

it("renders the code sent notice", async () => {
  const screen = await render(
    <AuthForm
      method="code"
      stage="login"
      email="reader@example.com"
      code=""
      password=""
      consented={true}
      loading={false}
      feedback={{ text: codeSentNotice, tone: "default" }}
      onEmailChange={jest.fn()}
      onCodeChange={jest.fn()}
      onPasswordChange={jest.fn()}
      onConsentChange={jest.fn()}
      onRequestCode={jest.fn()}
      onSubmit={jest.fn()}
    />
  );

  expect(screen.getByText(codeSentNotice)).toBeTruthy();
});
