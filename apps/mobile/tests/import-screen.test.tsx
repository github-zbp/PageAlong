import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { resetLocalePreferenceForTests, setLocalePreference } from "@/lib/locale";
import ImportScreen from "../app/import";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack
  })),
  useLocalSearchParams: jest.fn(() => ({}))
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 24,
    right: 0,
    bottom: 0,
    left: 0
  })
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

function mockRouterPush() {
  (require("expo-router").useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
    replace: mockReplace,
    back: mockBack
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetLocalePreferenceForTests();
  mockRouterPush();
});

it("opens the WebView route from the top URL bar", async () => {
  const screen = await render(<ImportScreen />);

  const urlInput = screen.getByPlaceholderText("输入网址，收藏为课程并生成音频");
  fireEvent.changeText(urlInput, "example.com/article");
  await waitFor(() => {
    expect(screen.getByDisplayValue("example.com/article")).toBeTruthy();
  });
  fireEvent.press(screen.getByRole("button", { name: "打开网页" }));

  await waitFor(() => {
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/import/web",
      params: { url: "https://example.com/article" }
    });
  });
});

it("renders import options in the global English locale", async () => {
  await setLocalePreference("en");

  const screen = await render(<ImportScreen />);

  expect(screen.getByText("Import")).toBeTruthy();
  expect(screen.getByText("Text import")).toBeTruthy();
  expect(screen.getByText("File import")).toBeTruthy();
  expect(screen.getByPlaceholderText("Paste a URL to save it as a course")).toBeTruthy();
});
