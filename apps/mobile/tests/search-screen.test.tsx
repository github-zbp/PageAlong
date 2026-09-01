import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as api from "@/lib/api";
import { resetLocalePreferenceForTests } from "@/lib/locale";
import SearchScreen from "../app/search";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn()
}));

jest.mock("@/components/AppFrame", () => {
  const React = require("react");
  const { Text, View } = require("react-native");

  return {
    AppFrame: ({ title, subtitle, children }: any) =>
      React.createElement(
        View,
        { style: { flex: 1 } },
        React.createElement(Text, null, title),
        subtitle ? React.createElement(Text, null, subtitle) : null,
        children
      )
  };
});

jest.mock("@/providers/ThemeProvider", () => ({
  useTheme: () => ({
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
    }
  })
}));

function courseFixture(overrides: Partial<api.CourseSummary> = {}): api.CourseSummary {
  return {
    id: "course-1",
    title: "手机电量研究",
    source_type: "url",
    status: "ready",
    word_count: 1200,
    word_count_unit: "characters",
    estimated_reading_seconds: 360,
    duration_seconds: 420,
    current_audio_url: null,
    last_playback_position_seconds: 0,
    library_type: "series",
    series_id: "series-1",
    series_title: "电池系列",
    tags: [],
    is_starred: false,
    created_at: "2026-08-27T00:00:00",
    updated_at: "2026-08-27T00:00:00",
    last_read_at: null,
    sentence_count: 20,
    ...overrides
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetLocalePreferenceForTests();
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  (useLocalSearchParams as jest.Mock).mockReturnValue({ query: "手机" });
});

it("loads dedicated search results from the query and opens a selected course", async () => {
  const searchCourses = jest.spyOn(api, "searchCoursesByTitle").mockResolvedValueOnce([courseFixture()]);

  const screen = await render(<SearchScreen />);

  await waitFor(() => {
    expect(screen.getByText("手机电量研究")).toBeTruthy();
  });
  expect(searchCourses).toHaveBeenCalledWith("手机");
  fireEvent.press(screen.getByText("手机电量研究"));

  expect(mockPush).toHaveBeenCalledWith({ pathname: "/courses/[courseId]", params: { courseId: "course-1" } });
});
