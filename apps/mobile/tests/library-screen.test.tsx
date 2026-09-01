import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import * as api from "@/lib/api";
import { recordDashboardActivity } from "@/lib/api";
import { resetLocalePreferenceForTests, setLocalePreference } from "@/lib/locale";
import LibraryScreen from "../app/(tabs)/library";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn()
  }))
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 24,
    right: 0,
    bottom: 0,
    left: 0
  })
}));

jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  listCoursesPage: jest.fn(),
  listCourseSeriesPage: jest.fn(),
  createCourseSeries: jest.fn(),
  createCourseTag: jest.fn(),
  getCourseSeries: jest.fn(),
  updateCourseLibrary: jest.fn(),
  deleteCourse: jest.fn(),
  updateCourseSeries: jest.fn(),
  deleteCourseSeries: jest.fn(),
  requestCourseDownload: jest.fn(),
  recordDashboardActivity: jest.fn()
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

jest.mock("@/components/BottomSheet", () => ({
  BottomSheet: ({ visible, children }: { visible: boolean; children: ReactNode }) => (visible ? children : null)
}));

const mockedOpenURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

beforeEach(() => {
  mockPush.mockClear();
  mockedOpenURL.mockReset();
  mockedOpenURL.mockResolvedValue(undefined);
  resetLocalePreferenceForTests();
  (api.listCoursesPage as jest.MockedFunction<typeof api.listCoursesPage>).mockReset();
  (api.listCourseSeriesPage as jest.MockedFunction<typeof api.listCourseSeriesPage>).mockReset();
  (api.createCourseSeries as jest.MockedFunction<typeof api.createCourseSeries>).mockReset();
  (api.createCourseTag as jest.MockedFunction<typeof api.createCourseTag>).mockReset();
  (api.getCourseSeries as jest.MockedFunction<typeof api.getCourseSeries>).mockReset();
  (api.updateCourseLibrary as jest.MockedFunction<typeof api.updateCourseLibrary>).mockReset();
  (api.deleteCourse as jest.MockedFunction<typeof api.deleteCourse>).mockReset();
  (api.updateCourseSeries as jest.MockedFunction<typeof api.updateCourseSeries>).mockReset();
  (api.deleteCourseSeries as jest.MockedFunction<typeof api.deleteCourseSeries>).mockReset();
  (api.requestCourseDownload as jest.MockedFunction<typeof api.requestCourseDownload>).mockReset();
  (recordDashboardActivity as jest.MockedFunction<typeof recordDashboardActivity>).mockReset();
  (api.listCoursesPage as jest.MockedFunction<typeof api.listCoursesPage>).mockResolvedValue(pageOfCourses([]));
  (api.listCourseSeriesPage as jest.MockedFunction<typeof api.listCourseSeriesPage>).mockResolvedValue(pageOfSeries([]));
  (api.createCourseSeries as jest.MockedFunction<typeof api.createCourseSeries>).mockResolvedValue(seriesFixture() as never);
  (api.createCourseTag as jest.MockedFunction<typeof api.createCourseTag>).mockResolvedValue({
    id: "tag-new",
    name: "默认标签",
    color: "#2F6F5E",
    usage_count: 0,
    updated_at: "2026-08-27T00:00:00.000Z"
  });
  (api.getCourseSeries as jest.MockedFunction<typeof api.getCourseSeries>).mockResolvedValue(seriesFixture() as never);
  (api.updateCourseLibrary as jest.MockedFunction<typeof api.updateCourseLibrary>).mockResolvedValue(courseFixture() as never);
  (api.deleteCourse as jest.MockedFunction<typeof api.deleteCourse>).mockResolvedValue();
  (api.updateCourseSeries as jest.MockedFunction<typeof api.updateCourseSeries>).mockResolvedValue(seriesFixture());
  (api.deleteCourseSeries as jest.MockedFunction<typeof api.deleteCourseSeries>).mockResolvedValue();
  (api.requestCourseDownload as jest.MockedFunction<typeof api.requestCourseDownload>).mockResolvedValue({
    status: "pending",
    job_id: "job-default",
    job_type: "course_export_pdf",
    resource_id: null,
    download_url: null,
    message: null
  });
  (recordDashboardActivity as jest.MockedFunction<typeof recordDashboardActivity>).mockResolvedValue();
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
    series_id: null,
    series_title: null,
    tags: [],
    is_starred: false,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    last_read_at: null,
    sentence_count: 20,
    ...overrides
  };
}

function seriesFixture(overrides: Partial<api.CourseSeries> = {}): api.CourseSeries {
  return {
    id: "series-default",
    title: "默认系列",
    article_count: 3,
    tags: [],
    is_starred: false,
    updated_at: "2026-08-27T00:00:00.000Z",
    last_read_at: null,
    last_read_course_id: null,
    latest_course_id: null,
    ...overrides
  };
}

function pageOfCourses(items: api.CourseSummary[]): api.PaginatedList<api.CourseSummary> {
  return {
    items,
    pagination: { page: 1, page_size: 20, total: items.length, total_pages: 1, has_previous: false, has_next: false }
  };
}

function pageOfSeries(items: api.CourseSeries[]): api.PaginatedList<api.CourseSeries> {
  return {
    items,
    pagination: { page: 1, page_size: 20, total: items.length, total_pages: 1, has_previous: false, has_next: false }
  };
}

async function renderLibrary() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LibraryScreen />
    </QueryClientProvider>
  );
}

it("opens the plus menu with import, series, and tag actions", async () => {
  const screen = await renderLibrary();
  const mockedRecordDashboardActivity = recordDashboardActivity as jest.MockedFunction<typeof recordDashboardActivity>;

  expect(screen.getByRole("button", { name: "新增" })).toBeTruthy();
  expect(screen.getByPlaceholderText("输入网址，收藏为课程并生成音频")).toBeTruthy();
  await waitFor(() => {
    expect(mockedRecordDashboardActivity).toHaveBeenCalledWith("zh");
  });

  fireEvent.press(screen.getByRole("button", { name: "新增" }));
  await waitFor(() => {
    expect(screen.getByText("导入课程")).toBeTruthy();
    expect(screen.getByText("新建系列课程")).toBeTruthy();
    expect(screen.getByText("新建标签")).toBeTruthy();
  });

  fireEvent.press(screen.getByRole("button", { name: "导入课程" }));
  expect(mockPush).toHaveBeenCalledWith("/import");
});

it("renders the library page in the global English locale", async () => {
  await setLocalePreference("en");

  const screen = await renderLibrary();

  expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  expect(screen.getByPlaceholderText("Paste a URL to save it as a course")).toBeTruthy();
  expect(screen.getAllByText("Library").length).toBeGreaterThan(0);
});

it("switches between course and series columns", async () => {
  jest.spyOn(api, "listCoursesPage").mockResolvedValueOnce(pageOfCourses([courseFixture({ title: "碎片课程" })]));
  jest.spyOn(api, "listCourseSeriesPage").mockResolvedValueOnce(pageOfSeries([seriesFixture({ title: "系列目录" })]));

  const screen = await renderLibrary();

  await waitFor(() => expect(screen.getByText("碎片课程")).toBeTruthy());
  fireEvent.press(screen.getAllByText("系列课程")[0]);
  await waitFor(() => expect(screen.getByText("系列目录")).toBeTruthy());
});

it("opens the sort sheet and applies title sort", async () => {
  const listCoursesPage = jest.spyOn(api, "listCoursesPage").mockResolvedValue(pageOfCourses([]));
  const screen = await renderLibrary();

  await waitFor(() => expect(screen.getByLabelText("排序")).toBeTruthy());
  fireEvent.press(screen.getByLabelText("排序"));
  await waitFor(() => expect(screen.getByText("按标题")).toBeTruthy());
  fireEvent.press(screen.getByText("按标题"));

  await waitFor(() => {
    expect(listCoursesPage).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "title" }));
  });
});

it("renders compact course tag chips", async () => {
  (api.listCoursesPage as jest.MockedFunction<typeof api.listCoursesPage>).mockResolvedValueOnce(
    pageOfCourses([courseFixture({ tags: [{ id: "tag-1", name: "科技", color: "#2F6F5E", usage_count: 1, updated_at: "2026-08-27T00:00:00.000Z" }, { id: "tag-2", name: "阅读", color: "#D7B46A", usage_count: 1, updated_at: "2026-08-27T00:00:00.000Z" }, { id: "tag-3", name: "隐藏", color: "#A33A2B", usage_count: 1, updated_at: "2026-08-27T00:00:00.000Z" }] })])
  );
  const screen = await renderLibrary();

  await waitFor(() => expect(screen.getByText("科技")).toBeTruthy());
  expect(screen.getByText("阅读")).toBeTruthy();
  expect(screen.queryByText("隐藏")).toBeNull();
});

it("creates a series from the plus menu", async () => {
  const createCourseSeries = api.createCourseSeries as jest.MockedFunction<typeof api.createCourseSeries>;
  createCourseSeries.mockResolvedValueOnce(seriesFixture({ id: "series-new", title: "晨读系列" }) as never);

  const screen = await renderLibrary();

  fireEvent.press(screen.getByRole("button", { name: "新增" }));

  await waitFor(() => {
    expect(screen.getByText("新建系列课程")).toBeTruthy();
  });

  fireEvent.press(screen.getByRole("button", { name: "新建系列课程" }));

  await waitFor(() => {
    expect(screen.getByPlaceholderText("输入系列标题")).toBeTruthy();
  });

  fireEvent.changeText(screen.getByPlaceholderText("输入系列标题"), "晨读系列");
  await waitFor(() => {
    expect(screen.getByDisplayValue("晨读系列")).toBeTruthy();
  });
  fireEvent.press(screen.getByRole("button", { name: "创建系列" }));

  await waitFor(() => {
    expect(createCourseSeries).toHaveBeenCalledWith({ title: "晨读系列" });
  });
});

it("creates a tag from the plus menu", async () => {
  const createCourseTag = api.createCourseTag as jest.MockedFunction<typeof api.createCourseTag>;
  createCourseTag.mockResolvedValueOnce({
    id: "tag-new",
    name: "晨读",
    color: "#2F6F5E",
    usage_count: 0,
    updated_at: "2026-08-27T00:00:00.000Z"
  });

  const screen = await renderLibrary();

  fireEvent.press(screen.getByRole("button", { name: "新增" }));
  await waitFor(() => expect(screen.getByText("新建标签")).toBeTruthy());
  fireEvent.press(screen.getByRole("button", { name: "新建标签" }));

  await waitFor(() => {
    expect(screen.getByPlaceholderText("输入新标签")).toBeTruthy();
  });

  fireEvent.changeText(screen.getByPlaceholderText("输入新标签"), "晨读");
  await waitFor(() => {
    expect(screen.getByDisplayValue("晨读")).toBeTruthy();
  });
  fireEvent(screen.getByPlaceholderText("输入新标签"), "submitEditing");

  await waitFor(() => {
    expect(createCourseTag).toHaveBeenCalledWith({ name: "晨读" });
  });
});

it("opens a series list from the row", async () => {
  const series = seriesFixture({ title: "可打开系列", latest_course_id: "latest-course" });
  (api.listCourseSeriesPage as jest.MockedFunction<typeof api.listCourseSeriesPage>).mockResolvedValueOnce(pageOfSeries([series]));
  const screen = await renderLibrary();

  fireEvent.press(screen.getByText("系列课程"));
  const row = await waitFor(() => screen.getByRole("button", { name: "查看 可打开系列" }));
  fireEvent.press(row);

  expect(mockPush).toHaveBeenCalledWith({ pathname: "/series/[seriesId]", params: { seriesId: "series-default" } });
});

it("shows a continue reading hint on series rows", async () => {
  const series = seriesFixture({ title: "可阅读系列", last_read_course_id: "read-course" });
  (api.listCourseSeriesPage as jest.MockedFunction<typeof api.listCourseSeriesPage>).mockResolvedValueOnce(pageOfSeries([series]));
  const screen = await renderLibrary();

  fireEvent.press(screen.getByText("系列课程"));

  await waitFor(() => {
    expect(screen.getByText("继续阅读")).toBeTruthy();
  });
  expect(screen.queryByLabelText("收藏")).toBeNull();
});

it("reads a series from the row action", async () => {
  const series = seriesFixture({
    title: "可阅读系列",
    last_read_course_id: "read-course",
    latest_course_id: "latest-course"
  });
  (api.listCourseSeriesPage as jest.MockedFunction<typeof api.listCourseSeriesPage>).mockResolvedValueOnce(pageOfSeries([series]));
  const screen = await renderLibrary();

  fireEvent.press(screen.getByText("系列课程"));
  fireEvent.press(await screen.findByLabelText("阅读 可阅读系列"));

  expect(mockPush).toHaveBeenCalledWith({ pathname: "/courses/[courseId]", params: { courseId: "read-course" } });
});

it("uses series-specific error copy on the series tab", async () => {
  (api.listCourseSeriesPage as jest.MockedFunction<typeof api.listCourseSeriesPage>).mockRejectedValueOnce(new Error("failed"));
  const screen = await renderLibrary();

  fireEvent.press(screen.getByText("系列课程"));
  await waitFor(() => expect(screen.getByText("系列加载失败")).toBeTruthy());
});

it("stars a course from the row action sheet", async () => {
  jest.spyOn(api, "listCoursesPage").mockResolvedValue(pageOfCourses([courseFixture({ id: "course-1", title: "课程" })]));
  const update = jest.spyOn(api, "updateCourseLibrary").mockResolvedValue(courseFixture({ id: "course-1", is_starred: true }) as never);
  const screen = await renderLibrary();

  await waitFor(() => {
    expect(screen.getAllByLabelText("更多")).toHaveLength(1);
  });
  fireEvent.press(screen.getAllByLabelText("更多")[0]);
  await waitFor(() => expect(screen.getByText("星标")).toBeTruthy());
  fireEvent.press(screen.getByText("星标"));

  await waitFor(() => expect(update).toHaveBeenCalledWith({ courseId: "course-1", isStarred: true }));
});

it("opens ready downloads from the action sheet", async () => {
  (api.listCoursesPage as jest.MockedFunction<typeof api.listCoursesPage>).mockResolvedValue(pageOfCourses([courseFixture({ id: "course-1", title: "课程" })]));
  const requestDownload = api.requestCourseDownload as jest.MockedFunction<typeof api.requestCourseDownload>;
  requestDownload.mockResolvedValueOnce({
    status: "ready",
    job_id: "job-ready",
    job_type: "course_export_pdf",
    resource_id: "resource-ready",
    download_url: "https://media.pagealong.test/media/course-ready.pdf",
    message: null
  });
  const screen = await renderLibrary();

  await waitFor(() => {
    expect(screen.getAllByLabelText("更多")).toHaveLength(1);
  });
  fireEvent.press(screen.getAllByLabelText("更多")[0]);
  await waitFor(() => expect(screen.getByText("下载 PDF")).toBeTruthy());
  fireEvent.press(screen.getByText("下载 PDF"));

  await waitFor(() => {
    expect(mockedOpenURL).toHaveBeenCalledWith("https://media.pagealong.test/media/course-ready.pdf");
  });
});

it("routes to download tasks when an export is queued", async () => {
  (api.listCoursesPage as jest.MockedFunction<typeof api.listCoursesPage>).mockResolvedValue(pageOfCourses([courseFixture({ id: "course-1", title: "课程" })]));
  const requestDownload = api.requestCourseDownload as jest.MockedFunction<typeof api.requestCourseDownload>;
  requestDownload.mockResolvedValueOnce({
    status: "pending",
    job_id: "job-pending",
    job_type: "course_export_docx",
    resource_id: null,
    download_url: null,
    message: null
  });
  const screen = await renderLibrary();

  await waitFor(() => {
    expect(screen.getAllByLabelText("更多")).toHaveLength(1);
  });
  fireEvent.press(screen.getAllByLabelText("更多")[0]);
  await waitFor(() => expect(screen.getByText("下载 Word")).toBeTruthy());
  fireEvent.press(screen.getByText("下载 Word"));

  await waitFor(() => {
    expect(screen.getByText("文件正在生成中，前往下载任务页查看进度。")).toBeTruthy();
  });
  await waitFor(() => {
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/downloads");
  }, { timeout: 1600 });
});

it("clears course selection when switching to the series tab", async () => {
  (api.listCoursesPage as jest.MockedFunction<typeof api.listCoursesPage>).mockResolvedValue(pageOfCourses([courseFixture({ id: "course-1", title: "课程" })]));
  const screen = await renderLibrary();

  const courseButton = await screen.findByRole("button", { name: "课程", selected: false });
  fireEvent(courseButton, "longPress");
  expect(await screen.findByText("已选择 1 项")).toBeTruthy();

  fireEvent.press(screen.getAllByText("系列课程")[0]);

  await waitFor(() => {
    expect(screen.queryByText("已选择 1 项")).toBeNull();
  });
});

it("settles bulk delete state when one selected course fails", async () => {
  (api.listCoursesPage as jest.MockedFunction<typeof api.listCoursesPage>).mockResolvedValue(
    pageOfCourses([
      courseFixture({ id: "course-1", title: "课程一" }),
      courseFixture({ id: "course-2", title: "课程二" })
    ])
  );
  const deleteMock = api.deleteCourse as jest.MockedFunction<typeof api.deleteCourse>;
  deleteMock.mockImplementation((courseId) => (courseId === "course-1" ? Promise.reject(new Error("delete failed")) : Promise.resolve()));
  const screen = await renderLibrary();

  fireEvent(await screen.findByRole("button", { name: "课程一", selected: false }), "longPress");
  fireEvent.press(await screen.findByRole("button", { name: "课程二", selected: false }));
  expect(await screen.findByText("已选择 2 项")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("删除所选"));

  await waitFor(() => {
    expect(deleteMock).toHaveBeenCalledWith("course-1");
    expect(deleteMock).toHaveBeenCalledWith("course-2");
  });
  await waitFor(() => {
    expect(screen.getByText("部分操作未完成，请稍后重试")).toBeTruthy();
    expect(screen.queryByText("已选择 2 项")).toBeNull();
  });
});

it("clears a series by moving its courses to fragments", async () => {
  const series = seriesFixture({ id: "series-1", title: "系列" });
  const getSeries = jest.spyOn(api, "getCourseSeries").mockResolvedValue({
    ...series,
    courses: [courseFixture({ id: "course-1" }), courseFixture({ id: "course-2" })]
  } as never);
  const update = jest.spyOn(api, "updateCourseLibrary").mockResolvedValue(courseFixture() as never);
  (api.listCourseSeriesPage as jest.MockedFunction<typeof api.listCourseSeriesPage>).mockResolvedValueOnce(pageOfSeries([series]));
  const screen = await renderLibrary();

  fireEvent.press(screen.getByText("系列课程"));
  await waitFor(() => {
    expect(screen.getAllByLabelText("更多")).toHaveLength(1);
  });
  fireEvent.press(screen.getAllByLabelText("更多")[0]);
  await waitFor(() => expect(screen.getByText("清空课程")).toBeTruthy());
  fireEvent.press(screen.getByText("清空课程"));

  await waitFor(() => {
    expect(getSeries).toHaveBeenCalledWith("series-1");
    expect(update).toHaveBeenCalledWith({ courseId: "course-1", libraryType: "fragmented" });
    expect(update).toHaveBeenCalledWith({ courseId: "course-2", libraryType: "fragmented" });
  });
});
