import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import * as api from "@/lib/api";
import { GlobalSearchOverlay } from "@/components/GlobalSearchOverlay";

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

jest.mock("@/lib/locale", () => ({
  useLocalePreference: () => "zh",
  resetLocalePreferenceForTests: jest.fn()
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 24,
    right: 0,
    bottom: 0,
    left: 0
  })
}));

afterEach(() => {
  jest.useRealTimers();
});

it("opens a selected course from search results", async () => {
  jest.useFakeTimers();
  const onClose = jest.fn();
  const onOpenCourse = jest.fn();
  const searchCourses = jest.spyOn(api, "searchCoursesByTitle").mockResolvedValueOnce([
    {
      id: "course-1",
      title: "为什么手机最后1%的电可以用很久？",
      source_type: "url",
      status: "ready",
      word_count: 1200,
      word_count_unit: "characters",
      estimated_reading_seconds: 360,
      duration_seconds: 420,
      current_audio_url: null,
      last_playback_position_seconds: 0,
      library_type: "fragmented",
      tags: [],
      is_starred: false,
      created_at: "2026-08-27T00:00:00",
      updated_at: "2026-08-27T00:00:00",
      sentence_count: 20
    }
  ]);

  const screen = await render(<GlobalSearchOverlay visible onClose={onClose} onOpenCourse={onOpenCourse} />);

  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText("搜索课程"), "手机");
  });
  await act(async () => {
    jest.advanceTimersByTime(999);
  });
  expect(searchCourses).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(screen.getByText("为什么手机最后1%的电可以用很久？")).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByText("为什么手机最后1%的电可以用很久？"));
  });

  expect(onOpenCourse).toHaveBeenCalledWith("course-1");
  expect(onClose).toHaveBeenCalled();
});

it("clears typed search text and hides preview results", async () => {
  jest.useFakeTimers();
  const onClose = jest.fn();
  const onOpenCourse = jest.fn();
  jest.spyOn(api, "searchCoursesByTitle").mockResolvedValueOnce([
    {
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
      library_type: "fragmented",
      tags: [],
      is_starred: false,
      created_at: "2026-08-27T00:00:00",
      updated_at: "2026-08-27T00:00:00",
      sentence_count: 20
    }
  ]);

  const screen = await render(<GlobalSearchOverlay visible onClose={onClose} onOpenCourse={onOpenCourse} />);

  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText("搜索课程"), "手机");
  });
  await act(async () => {
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() => {
    expect(screen.getByText("手机电量研究")).toBeTruthy();
  });

  await act(async () => {
    fireEvent.press(screen.getByLabelText("清空搜索"));
  });

  expect(screen.getByPlaceholderText("搜索课程")).toHaveProp("value", "");
  expect(screen.queryByText("手机电量研究")).toBeNull();
});

it("submits typed search text without opening a course", async () => {
  const onClose = jest.fn();
  const onOpenCourse = jest.fn();
  const onSubmitSearch = jest.fn();

  const screen = await render(
    <GlobalSearchOverlay
      visible
      onClose={onClose}
      onOpenCourse={onOpenCourse}
      onSubmitSearch={onSubmitSearch}
    />
  );

  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText("搜索课程"), "电池");
  });
  await act(async () => {
    fireEvent(screen.getByPlaceholderText("搜索课程"), "submitEditing");
  });

  expect(onSubmitSearch).toHaveBeenCalledWith("电池");
  expect(onOpenCourse).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});
