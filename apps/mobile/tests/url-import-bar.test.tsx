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

import renderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";
import { UrlImportBar } from "@/components/UrlImportBar";

it("includes safe area padding when rendered at the top of a page", () => {
  let instance: renderer.ReactTestRenderer;
  act(() => {
    instance = renderer.create(<UrlImportBar value="" onChangeText={jest.fn()} onOpen={jest.fn()} />);
  });
  const topBar = instance!.toJSON();

  expect(topBar).toBeTruthy();
  if (!topBar) {
    throw new Error("Expected a rendered top bar");
  }
  if (Array.isArray(topBar)) {
    throw new Error("Expected a single root node");
  }
  expect(StyleSheet.flatten(topBar.props.style)).toEqual(
    expect.objectContaining({
      paddingTop: 36,
      paddingBottom: 12
    })
  );
});
