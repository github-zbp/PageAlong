import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import type { Course } from "@/lib/api";
import { updateCourseLibrary } from "@/lib/api";
import { getReaderCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { usePlayback } from "@/providers/PlaybackProvider";
import CourseReaderScreen from "../app/courses/[courseId]";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockRefetch = jest.fn();
let playback: {
  track: Course | null;
  currentTime: number;
  duration: number;
  playing: boolean;
  rate: number;
  activeSentenceIndex: number;
  status: {
    playing: boolean;
  };
  loadCourse: jest.Mock;
  toggle: jest.Mock;
  seekTo: jest.Mock;
  seekBy: jest.Mock;
  setRate: jest.Mock;
  requestAudioGeneration: jest.Mock;
};
const mockLoadCourse = jest.fn((nextCourse: Course) => {
  playback.track = nextCourse;
  playback.currentTime = nextCourse.last_playback_position_seconds;
  playback.duration = nextCourse.duration_seconds;
  playback.playing = false;
  playback.status = { playing: false };
});
const mockToggle = jest.fn(() => {
  playback.playing = !playback.playing;
  playback.status = { playing: playback.playing };
});
const mockSeekTo = jest.fn(async (seconds: number) => {
  playback.currentTime = seconds;
  playback.activeSentenceIndex = seconds >= 3 ? 1 : 0;
});
const mockSeekBy = jest.fn(async (delta: number) => {
  playback.currentTime += delta;
});
const mockSetRate = jest.fn();
const mockRequestAudioGeneration = jest.fn();
const mockedUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockedUsePlayback = usePlayback as jest.MockedFunction<typeof usePlayback>;
const mockReaderBottomBar = jest.fn();

const course = {
  id: "course-1",
  title: "课程标题",
  source_type: "manual_text",
  status: "ready",
  word_count: 12,
  duration_seconds: 120,
  current_audio_url: "/courses/course-1/audio",
  last_playback_position_seconds: 18,
  library_type: "fragmented",
  series_id: null,
  series_title: null,
  tags: [{ id: "tag-1", name: "学习", color: "#2F6F5E", usage_count: 1, updated_at: "2026-08-27T00:00:00.000Z" }],
  is_starred: false,
  created_at: "2026-08-27T00:00:00.000Z",
  updated_at: "2026-08-27T00:00:00.000Z",
  last_read_at: null,
  content_markdown: "正文",
  source: null,
  sentences: [
    { index: 0, text: "第一句", audio_start_seconds: 0, audio_end_seconds: 3 },
    { index: 1, text: "第二句", audio_start_seconds: 3, audio_end_seconds: 8 }
  ],
  sections: [],
  outline: [
    { id: "outline-1", depth: 1, title: "目录一" }
  ]
};

playback = {
  track: null,
  currentTime: 0,
  duration: 0,
  playing: false,
  rate: 1,
  activeSentenceIndex: 0,
  status: {
    playing: false
  },
  loadCourse: mockLoadCourse,
  toggle: mockToggle,
  seekTo: mockSeekTo,
  seekBy: mockSeekBy,
  setRate: mockSetRate,
  requestAudioGeneration: mockRequestAudioGeneration
};

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn()
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn()
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 24,
    right: 0,
    bottom: 12,
    left: 0
  })
}));

jest.mock("@/providers/PlaybackProvider", () => ({
  usePlayback: jest.fn()
}));

jest.mock("@/components/ReaderBottomBar", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    ReaderBottomBar: (props: any) => {
      mockReaderBottomBar(props);
      return React.createElement(View, null);
    }
  };
});

jest.mock("@/components/BottomSheet", () => ({
  BottomSheet: ({ visible, children }: { visible: boolean; children: ReactNode }) => (visible ? children : null)
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

jest.mock("@/lib/locale", () => ({
  useLocalePreference: jest.fn(),
  resetLocalePreferenceForTests: jest.fn()
}));

jest.mock("@/lib/preferences", () => ({
  defaultReaderPreferences: {
    fontSize: "standard",
    lineHeight: "comfortable",
    playbackRate: 1
  },
  loadReaderPreferences: jest.fn().mockResolvedValue({
    fontSize: "standard",
    lineHeight: "comfortable",
    playbackRate: 1
  }),
  saveReaderPreferences: jest.fn()
}));

jest.mock("@/lib/api", () => ({
  getCourse: jest.fn(),
  getCourseSeries: jest.fn(),
  mediaUrl: jest.fn((value: string) => value),
  requestCourseAudioGeneration: jest.fn(),
  requestCourseDownload: jest.fn(),
  updateCourseLibrary: jest.fn()
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockReaderBottomBar.mockClear();
  (useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack
  });
  (useLocalSearchParams as jest.Mock).mockReturnValue({ courseId: "course-1" });
  (useLocalePreference as jest.Mock).mockReturnValue("zh");
  mockedUsePlayback.mockReturnValue(playback as never);
  mockedUseQuery.mockImplementation(({ queryKey }) => {
    const key = Array.isArray(queryKey) ? queryKey.join(":") : String(queryKey);
    if (key.includes("course-series")) {
      return {
        data: null,
        error: null,
        isLoading: false,
        refetch: jest.fn()
      } as never;
    }
    return {
      data: course,
      error: null,
      isLoading: false,
      refetch: mockRefetch
    } as never;
  });
  playback.track = null;
  playback.currentTime = 0;
  playback.duration = 0;
  playback.playing = false;
  playback.activeSentenceIndex = 0;
  playback.status = { playing: false };
  (updateCourseLibrary as jest.MockedFunction<typeof updateCourseLibrary>).mockResolvedValue(course as never);
});

it("restores the reader chrome when playback starts", async () => {
  const screen = await render(<CourseReaderScreen />);
  const copy = getReaderCopy("zh");

  await waitFor(() => {
    expect(screen.getByText("第一句")).toBeTruthy();
  });

  fireEvent.press(screen.getAllByText("课程标题")[1].parent?.parent as never);
  await waitFor(() => {
    expect(mockReaderBottomBar.mock.calls.at(-1)?.[0]?.visible).toBe(false);
  });

  fireEvent.press(screen.getByRole("button", { name: copy.play }));

  await waitFor(() => {
    expect(mockLoadCourse).toHaveBeenCalledWith(course);
    expect(mockToggle).toHaveBeenCalled();
    expect(mockReaderBottomBar.mock.calls.at(-1)?.[0]?.visible).toBe(true);
  });

  await waitFor(() => {
    expect(screen.getByLabelText(copy.closePlayer)).toBeTruthy();
  });

  fireEvent.press(screen.getByLabelText(copy.closePlayer));

  await waitFor(() => {
    expect(screen.getByLabelText(copy.restorePlayer)).toBeTruthy();
  });

  fireEvent.press(screen.getByLabelText(copy.restorePlayer));

  await waitFor(() => {
    expect(screen.getByLabelText(copy.closePlayer)).toBeTruthy();
  });
});

it("seeks to a sentence when it is tapped", async () => {
  const screen = await render(<CourseReaderScreen />);

  await waitFor(() => {
    expect(screen.getByText("第一句")).toBeTruthy();
  });

  fireEvent.press(screen.getByRole("button", { name: "第二句" }));

  await waitFor(() => {
    expect(mockLoadCourse).toHaveBeenCalledWith(course);
    expect(mockSeekTo).toHaveBeenCalledWith(3);
  });
});

it("adds and removes tags from the reader sheet", async () => {
  const screen = await render(<CourseReaderScreen />);

  await waitFor(() => {
    expect(screen.getByText("第一句")).toBeTruthy();
  });

  fireEvent.press(screen.getByLabelText("添加标签"));

  await waitFor(() => {
    expect(screen.getByPlaceholderText("输入新标签")).toBeTruthy();
  });

  fireEvent.changeText(screen.getByPlaceholderText("输入新标签"), "晨读");
  await waitFor(() => {
    expect(screen.getByDisplayValue("晨读")).toBeTruthy();
  });
  fireEvent.press(screen.getByRole("button", { name: "确认" }));

  await waitFor(() => {
    expect(updateCourseLibrary).toHaveBeenCalledWith({
      courseId: "course-1",
      tags: ["学习", "晨读"]
    });
  });

  fireEvent.press(screen.getByLabelText("添加标签"));

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "删除 学习" })).toBeTruthy();
  });

  fireEvent.press(screen.getByRole("button", { name: "删除 学习" }));

  await waitFor(() => {
    expect(updateCourseLibrary).toHaveBeenLastCalledWith({
      courseId: "course-1",
      tags: []
    });
  });
});
