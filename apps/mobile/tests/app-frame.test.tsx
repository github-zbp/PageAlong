jest.mock("@/lib/api", () => ({
  recordDashboardActivity: jest.fn(),
  searchCoursesByTitle: jest.fn(async () => [])
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
    top: 24,
    right: 0,
    bottom: 0,
    left: 0
  })
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack
  })
}));

import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { AppFrame } from "@/components/AppFrame";
import { TabBar } from "@/components/TabBar";
import { TopAppBar } from "@/components/TopAppBar";
import { recordDashboardActivity } from "@/lib/api";
import { getTabRoutes } from "@/lib/navigation";
import { resetLocalePreferenceForTests, setLocalePreference } from "@/lib/locale";

const mockedRecordDashboardActivity = recordDashboardActivity as jest.MockedFunction<typeof recordDashboardActivity>;

beforeEach(() => {
  jest.clearAllMocks();
  resetLocalePreferenceForTests();
});

it("renders the top frame and all four tab labels", async () => {
  const screen = await render(
    <AppFrame title="工作台">
      <></>
    </AppFrame>
  );

  expect(screen.getByText("工作台")).toBeTruthy();
  expect(getTabRoutes("zh")).toHaveLength(4);
  expect(getTabRoutes("zh").map((route) => route.title)).toEqual(["工作台", "课程库", "下载资源", "我的"]);
});

it("renders a compact tab header when large title is disabled", async () => {
  const screen = await render(
    <AppFrame title="工作台" largeTitle={false}>
      <></>
    </AppFrame>
  );

  expect(StyleSheet.flatten(screen.getByText("工作台").props.style)).toEqual(
    expect.objectContaining({
      fontSize: 18,
      textAlign: "center"
    })
  );
});

it("renders tab labels from the global locale", async () => {
  await setLocalePreference("en");

  const screen = await render(
    <TabBar
      state={{ index: 0 }}
      navigation={{ navigate: jest.fn() }}
      insets={{ bottom: 0 }}
    />
  );

  expect(screen.getByText("Workbench")).toBeTruthy();
  expect(screen.getByText("Library")).toBeTruthy();
  expect(screen.getByText("Downloads")).toBeTruthy();
  expect(screen.getByText("Me")).toBeTruthy();
});

it("renders top content, exposes the right action label, and records activity on mount", async () => {
  const onRightAction = jest.fn();
  const screen = await render(
    <AppFrame
      title="工作台"
      rightAction={<Text>+</Text>}
      rightActionLabel="导入"
      onRightAction={onRightAction}
      topContent={<Text>网址栏</Text>}
    >
      <></>
    </AppFrame>
  );

  await waitFor(() => {
    expect(mockedRecordDashboardActivity).toHaveBeenCalledWith("zh");
  });
  expect(screen.getByText("网址栏")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "导入" }));
  expect(onRightAction).toHaveBeenCalledTimes(1);
});

it("mounts the global search overlay from AppFrame", async () => {
  const screen = await render(
    <AppFrame title="工作台">
      <></>
    </AppFrame>
  );

  await act(async () => {
    fireEvent.press(screen.getByLabelText("搜索课程"));
  });

  await waitFor(() => {
    expect(screen.getByPlaceholderText("搜索课程")).toBeTruthy();
  });
});

it("routes submitted global search to the dedicated search page", async () => {
  const screen = await render(
    <AppFrame title="工作台">
      <></>
    </AppFrame>
  );

  await act(async () => {
    fireEvent.press(screen.getByLabelText("搜索课程"));
  });
  const input = screen.getByPlaceholderText("搜索课程");
  await act(async () => {
    fireEvent.changeText(input, "手机");
  });
  await act(async () => {
    fireEvent(input, "submitEditing");
  });

  expect(mockPush).toHaveBeenCalledWith({ pathname: "/search", params: { query: "手机" } });
});

it("routes to the import entry from the default top action", async () => {
  const screen = await render(
    <AppFrame title="工作台">
      <></>
    </AppFrame>
  );

  fireEvent.press(screen.getByLabelText("导入"));

  expect(mockPush).toHaveBeenCalledWith("/import");
});

it("keeps the top app bar content below the system status bar", async () => {
  const screen = await render(<TopAppBar title="工作台" />);
  const topBar = screen.toJSON();

  expect(topBar).toBeTruthy();
  expect(StyleSheet.flatten(topBar?.props.style)).toEqual(
    expect.objectContaining({
      paddingTop: 36,
      paddingBottom: 12
    })
  );
});
