import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react-native";
import { Pressable } from "react-native";
import * as api from "@/lib/api";
import CourseListRow, { COURSE_ROW_HEIGHT } from "@/components/CourseListRow";
import { formatCourseMeta, formatUpdatedDate } from "@/lib/library";
import { setLocalePreference } from "@/lib/locale";
import WorkbenchScreen from "../app/(tabs)/workbench";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  })
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 })
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
    }
  })
}));

jest.mock("@/providers/SessionProvider", () => ({
  useSession: () => ({ state: { status: "signed_out" } })
}));

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    listCoursesPage: jest.fn(),
    recordDashboardActivity: jest.fn().mockResolvedValue(undefined)
  };
});

function courseFixture(overrides: Partial<api.CourseSummary> = {}): api.CourseSummary {
  return {
    id: "course-default",
    title: "默认课程",
    source_type: "manual_text",
    status: "ready",
    word_count: 1200,
    word_count_unit: "characters",
    duration_seconds: 300,
    current_audio_url: null,
    last_playback_position_seconds: 0,
    library_type: "fragmented",
    tags: [],
    is_starred: false,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    sentence_count: 20,
    ...overrides
  };
}

it("renders continue learning before recent courses", async () => {
  const listCoursesPage = api.listCoursesPage as jest.MockedFunction<typeof api.listCoursesPage>;
  listCoursesPage.mockResolvedValueOnce({
    items: [
      courseFixture({ id: "a", title: "正在学习的课程", last_playback_position_seconds: 60, duration_seconds: 300 }),
      courseFixture({ id: "b", title: "最近阅读课程", last_playback_position_seconds: 0, duration_seconds: 200 })
    ],
    pagination: { page: 1, page_size: 6, total: 2, total_pages: 1, has_previous: false, has_next: false }
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <WorkbenchScreen />
    </QueryClientProvider>
  );

  expect(await screen.findByText("继续学习")).toBeTruthy();
  expect(screen.getByText("正在学习的课程")).toBeTruthy();
  expect(screen.getByText("最近阅读")).toBeTruthy();
  expect(screen.getByText("最近阅读课程")).toBeTruthy();
  expect(listCoursesPage).toHaveBeenCalledWith({ sort: "recent", pageSize: 6 });
});

it("keeps row actions from navigating the course", async () => {
  const onPress = jest.fn();
  const onMorePress = jest.fn();
  const onToggleStar = jest.fn();
  const screen = await render(
    <CourseListRow course={courseFixture()} onPress={onPress} onMorePress={onMorePress} onToggleStar={onToggleStar} />
  );

  fireEvent.press(screen.getByRole("button", { name: "更多" }));
  fireEvent.press(screen.getByRole("button", { name: "收藏" }));

  expect(onMorePress).toHaveBeenCalledWith(expect.objectContaining({ id: "course-default" }));
  expect(onToggleStar).toHaveBeenCalledWith(expect.objectContaining({ id: "course-default" }));
  expect(onPress).not.toHaveBeenCalled();
});

it("hides row controls when callbacks are not provided", async () => {
  const screen = await render(<CourseListRow course={courseFixture()} onPress={jest.fn()} />);

  expect(screen.queryByRole("button", { name: "收藏" })).toBeNull();
  expect(screen.queryByRole("button", { name: "更多" })).toBeNull();
});

it("keeps course rows at a fixed height", async () => {
  const screen = await render(
    <CourseListRow
      course={courseFixture({ title: "一个很长的课程标题", last_playback_position_seconds: 60 })}
      onPress={jest.fn()}
    />
  );

  expect(COURSE_ROW_HEIGHT).toBe(96);
});

it("formats workbench metadata in English", async () => {
  await setLocalePreference("en");
  expect(formatCourseMeta(courseFixture(), "en")).toBe("1,200 characters · 20 sentences");
  expect(formatUpdatedDate("2026-08-27T00:00:00.000Z", "en")).toBe("Aug 27");
});
