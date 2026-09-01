import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Linking } from "react-native";
import type { ReactNode } from "react";
import type { CourseSeriesDetail } from "@/lib/api";
import * as api from "@/lib/api";
import { useLocalePreference } from "@/lib/locale";
import SeriesScreen from "../app/series/[seriesId]";

const mockPush = jest.fn();
const mockedUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockCourseRows: Array<{
  course: CourseSeriesDetail["courses"][number];
  onPress: (courseId: string) => void;
  onLongPress?: (courseId: string) => void;
  onMorePress?: (course: CourseSeriesDetail["courses"][number]) => void;
  onToggleStar?: (course: CourseSeriesDetail["courses"][number]) => void;
  selected?: boolean;
  selectionMode?: boolean;
}> = [];
const mockLibraryMoreSheets: Array<{
  onDownload?: (format: "pdf" | "docx" | "markdown" | "audio") => void;
  onToggleStar?: () => void;
  onDelete?: () => void;
}> = [];
const mockedOpenURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn()
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn()
}));

jest.mock("@/components/BottomSheet", () => ({
  BottomSheet: ({ visible, children }: { visible: boolean; children: ReactNode }) => (visible ? children : null)
}));

jest.mock("@/components/CourseListRow", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    __esModule: true,
    default: ({ course, onPress, onLongPress, onMorePress, onToggleStar, selected, selectionMode }: any) => {
      mockCourseRows.push({ course, onPress, onLongPress, onMorePress, onToggleStar, selected, selectionMode });
      return React.createElement(View, null);
    }
  };
});

jest.mock("@/components/LibraryMoreSheet", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    __esModule: true,
    default: ({ visible, item, onDownload, onToggleStar, onDelete }: any) =>
      visible && item
        ? (mockLibraryMoreSheets.push({ onDownload, onToggleStar, onDelete }), React.createElement(View, null))
        : null
  };
});

jest.mock("@/components/SeriesMoveSheet", () => {
  const React = require("react");
  const { Pressable, Text, TextInput, View } = require("react-native");

  return {
    __esModule: true,
    SeriesMoveSheet: ({ visible, inputPlaceholder, submitLabel, onSubmit }: any) => {
      const [value, setValue] = React.useState("");

      if (!visible) {
        return null;
      }

      return React.createElement(
        View,
        null,
        React.createElement(TextInput, {
          placeholder: inputPlaceholder,
          value,
          onChangeText: setValue
        }),
        React.createElement(Pressable, { accessibilityRole: "button", onPress: () => onSubmit(value) }, React.createElement(Text, null, submitLabel))
      );
    }
  };
});

jest.mock("@/components/AppFrame", () => {
  const React = require("react");
  const { Text, View } = require("react-native");

  return {
    AppFrame: ({ title, subtitle, children }: any) =>
      React.createElement(
        View,
        null,
        React.createElement(Text, null, title),
        subtitle ? React.createElement(Text, null, subtitle) : null,
        children
      )
  };
});

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

jest.mock("@/lib/locale", () => ({
  useLocalePreference: jest.fn(),
  resetLocalePreferenceForTests: jest.fn()
}));

jest.mock("@/lib/api", () => ({
  getCourseSeries: jest.fn(),
  updateCourseLibrary: jest.fn(),
  deleteCourse: jest.fn(),
  requestCourseDownload: jest.fn(),
  mediaUrl: jest.fn((value: string) => value)
}));

function seriesFixture(): CourseSeriesDetail {
  return {
    id: "series-1",
    title: "系列标题",
    article_count: 2,
    tags: [],
    is_starred: false,
    updated_at: "2026-08-27T00:00:00.000Z",
    last_read_at: null,
    last_read_course_id: "course-2",
    latest_course_id: "course-2",
    courses: [
      {
        id: "course-1",
        title: "第一课",
        source_type: "manual_text",
        status: "ready",
        word_count: 12,
        duration_seconds: 120,
        current_audio_url: "/courses/course-1/audio",
        last_playback_position_seconds: 18,
        library_type: "series",
        series_id: "series-1",
        series_title: "系列标题",
        tags: [],
        is_starred: false,
        created_at: "2026-08-27T00:00:00.000Z",
        updated_at: "2026-08-27T00:00:00.000Z",
        last_read_at: null,
        content_markdown: "正文",
        source: null,
        sentences: [],
        sections: [],
        outline: []
      },
      {
        id: "course-2",
        title: "第二课",
        source_type: "manual_text",
        status: "ready",
        word_count: 12,
        duration_seconds: 120,
        current_audio_url: "/courses/course-2/audio",
        last_playback_position_seconds: 0,
        library_type: "series",
        series_id: "series-1",
        series_title: "系列标题",
        tags: [],
        is_starred: false,
        created_at: "2026-08-27T00:00:00.000Z",
        updated_at: "2026-08-27T00:00:00.000Z",
        last_read_at: null,
        content_markdown: "正文",
        source: null,
        sentences: [],
        sections: [],
        outline: []
      }
    ]
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCourseRows.length = 0;
  mockLibraryMoreSheets.length = 0;
  mockedOpenURL.mockReset();
  mockedOpenURL.mockResolvedValue(undefined);
  (useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn()
  });
  (useLocalSearchParams as jest.Mock).mockReturnValue({ seriesId: "series-1" });
  (useLocalePreference as jest.Mock).mockReturnValue("zh");
  mockedUseQuery.mockReturnValue({
    data: seriesFixture(),
    error: null,
    isLoading: false,
    refetch: jest.fn()
  } as never);
  (api.updateCourseLibrary as jest.MockedFunction<typeof api.updateCourseLibrary>).mockResolvedValue(seriesFixture().courses[0] as never);
  (api.deleteCourse as jest.MockedFunction<typeof api.deleteCourse>).mockResolvedValue();
  (api.requestCourseDownload as jest.MockedFunction<typeof api.requestCourseDownload>).mockResolvedValue({
    status: "ready",
    job_id: "job-ready",
    job_type: "course_export_pdf",
    resource_id: "resource-ready",
    download_url: "https://media.pagealong.test/media/course.pdf",
    message: null
  });
});

it("renders a series course list and opens a course from the row", async () => {
  const screen = await render(<SeriesScreen />);

  await waitFor(() => {
    expect(mockCourseRows).toHaveLength(2);
  });
  const firstRow = mockCourseRows[0];
  expect(firstRow).toBeTruthy();
  firstRow?.onPress(firstRow.course.id);

  expect(mockPush).toHaveBeenCalledWith({ pathname: "/courses/[courseId]", params: { courseId: "course-1" } });
});

it("supports multi-select move actions on the series page", async () => {
  const screen = await render(<SeriesScreen />);

  await waitFor(() => {
    expect(mockCourseRows).toHaveLength(2);
  });

  await act(async () => {
    mockCourseRows[0].onLongPress?.(mockCourseRows[0].course.id);
  });

  await waitFor(() => {
    expect(screen.getByText("已选择 1 项")).toBeTruthy();
  });

  fireEvent.press(screen.getByLabelText("转移至"));
  await waitFor(() => {
    expect(screen.getByPlaceholderText("输入系列标题")).toBeTruthy();
  });
  fireEvent.changeText(screen.getByPlaceholderText("输入系列标题"), "目标系列");
  await waitFor(() => {
    expect(screen.getByDisplayValue("目标系列")).toBeTruthy();
  });
  fireEvent.press(screen.getByText("确认转移"));

  await waitFor(() => {
    expect(api.updateCourseLibrary).toHaveBeenCalledWith({
      courseId: "course-1",
      libraryType: "series",
      seriesTitle: "目标系列"
    });
  });
});

it("opens row actions for download, star, and delete", async () => {
  const screen = await render(<SeriesScreen />);

  await waitFor(() => {
    expect(mockCourseRows).toHaveLength(2);
  });

  await act(async () => {
    mockCourseRows[0].onMorePress?.(mockCourseRows[0].course);
  });

  await waitFor(() => {
    expect(mockLibraryMoreSheets).toHaveLength(1);
  });

  const firstSheet = mockLibraryMoreSheets[mockLibraryMoreSheets.length - 1];
  expect(firstSheet.onDownload).toBeDefined();
  await act(async () => {
    await firstSheet.onDownload?.("pdf");
  });
  expect(mockedOpenURL).toHaveBeenCalledWith("https://media.pagealong.test/media/course.pdf");

  await act(async () => {
    mockCourseRows[0].onMorePress?.(mockCourseRows[0].course);
  });
  await waitFor(() => {
    expect(mockLibraryMoreSheets).toHaveLength(2);
  });
  const secondSheet = mockLibraryMoreSheets[mockLibraryMoreSheets.length - 1];
  await act(async () => {
    await secondSheet.onToggleStar?.();
  });

  await waitFor(() => {
    expect(api.updateCourseLibrary).toHaveBeenCalledWith({
      courseId: "course-1",
      isStarred: true
    });
  });

  await act(async () => {
    mockCourseRows[0].onMorePress?.(mockCourseRows[0].course);
  });
  await waitFor(() => {
    expect(mockLibraryMoreSheets).toHaveLength(3);
  });
  const thirdSheet = mockLibraryMoreSheets[mockLibraryMoreSheets.length - 1];
  await act(async () => {
    await thirdSheet.onDelete?.();
  });

  await waitFor(() => {
    expect(api.deleteCourse).toHaveBeenCalledWith("course-1");
  });
});
