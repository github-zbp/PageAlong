import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createExtensionSyncCourse } from "@/lib/api";
import ImportWebScreen from "../app/import/web";

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockSetOptions = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = {
  setOptions: mockSetOptions
};
let mockLocalSearchParams: Record<string, string | string[] | undefined> = {};

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({
    replace: mockReplace,
    back: mockBack
  })),
  useLocalSearchParams: jest.fn(() => mockLocalSearchParams),
  useNavigation: jest.fn(() => mockNavigation)
}));

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    WebView: React.forwardRef((props: Record<string, any>, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        goBack: mockGoBack
      }));
      return React.createElement(View, props);
    })
  };
});

jest.mock("@/lib/api", () => ({
  createExtensionSyncCourse: jest.fn()
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

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  })
}));

const mockedCreateExtensionSyncCourse = createExtensionSyncCourse as jest.MockedFunction<typeof createExtensionSyncCourse>;

function mockRouter() {
  (require("expo-router").useRouter as jest.Mock).mockReturnValue({
    replace: mockReplace,
    back: mockBack
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLocalSearchParams = { url: "https://example.com/start" };
  mockRouter();
});

it("saves the current WebView URL as a course", async () => {
  mockedCreateExtensionSyncCourse.mockResolvedValueOnce({ id: "course-1" } as never);

  const screen = await render(<ImportWebScreen />);

  await act(async () => {
    fireEvent(screen.getByTestId("import-webview"), "navigationStateChange", {
      url: "https://example.com/article",
      title: "网页标题"
    });
  });
  await waitFor(() => {
    expect(screen.getByText("网页标题")).toBeTruthy();
  });
  await act(async () => {
    fireEvent.press(screen.getByLabelText("收藏网页"));
  });

  await waitFor(() => {
    expect(mockedCreateExtensionSyncCourse).toHaveBeenCalledWith({
      url: "https://example.com/article",
      title: "网页标题"
    });
  });
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/downloads");
});

it("keeps the import webview on the theme background while loading", async () => {
  const screen = await render(<ImportWebScreen />);

  const webView = screen.getByTestId("import-webview");
  expect(webView.props.startInLoadingState).toBe(true);
  expect(webView.props.style).toEqual(
    expect.objectContaining({
      backgroundColor: "#F7F4ED"
    })
  );
  expect(typeof webView.props.renderLoading).toBe("function");
});

it("keeps _blank links inside the same WebView", async () => {
  const screen = await render(<ImportWebScreen />);

  await waitFor(() => {
    expect(mockSetOptions).toHaveBeenCalledWith({ gestureEnabled: false });
  });

  await act(async () => {
    fireEvent(screen.getByTestId("import-webview"), "openWindow", {
      nativeEvent: {
        targetUrl: "https://example.com/article"
      }
    });
  });

  await waitFor(() => {
    expect(screen.getByTestId("import-webview").props.source).toEqual({
      uri: "https://example.com/article"
    });
  });
});

it("uses WebView history before leaving the browser screen", async () => {
  const screen = await render(<ImportWebScreen />);

  await act(async () => {
    fireEvent(screen.getByTestId("import-webview"), "navigationStateChange", {
      url: "https://example.com/article",
      title: "网页标题",
      canGoBack: true,
      canGoForward: false
    });
  });

  fireEvent.press(screen.getAllByRole("button")[0]);

  expect(mockGoBack).toHaveBeenCalledTimes(1);
  expect(mockBack).not.toHaveBeenCalled();
});

it("restores the browser source after going back so the same _blank link can open again", async () => {
  mockLocalSearchParams = { url: "https://example.com/a" };
  const screen = await render(<ImportWebScreen />);

  await act(async () => {
    fireEvent(screen.getByTestId("import-webview"), "openWindow", {
      nativeEvent: {
        targetUrl: "https://example.com/b"
      }
    });
  });

  await waitFor(() => {
    expect(screen.getByTestId("import-webview").props.source).toEqual({
      uri: "https://example.com/b"
    });
  });

  await act(async () => {
    fireEvent(screen.getByTestId("import-webview"), "navigationStateChange", {
      url: "https://example.com/a",
      title: "页面 A",
      canGoBack: false,
      canGoForward: true
    });
  });

  await waitFor(() => {
    expect(screen.getByTestId("import-webview").props.source).toEqual({
      uri: "https://example.com/a"
    });
  });

  await act(async () => {
    fireEvent(screen.getByTestId("import-webview"), "openWindow", {
      nativeEvent: {
        targetUrl: "https://example.com/b"
      }
    });
  });

  await waitFor(() => {
    expect(screen.getByTestId("import-webview").props.source).toEqual({
      uri: "https://example.com/b"
    });
  });
});
