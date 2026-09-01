import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import type { FileImportBatch, FileImportItem, GenerationJob, PaginatedList } from "@/lib/api";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  listFileImportBatchesPage,
  listGenerationJobsPage,
  recordDashboardActivity,
  retryFailedCourseJob,
  retryFileImportBatch,
  resolveApiUrl
} from "@/lib/api";
import { resetLocalePreferenceForTests, setLocalePreference } from "@/lib/locale";
import DownloadsScreen from "../app/(tabs)/downloads";

const mockPush = jest.fn();
const mockJobRefetch = jest.fn(async () => undefined);
const mockBatchRefetch = jest.fn(async () => undefined);

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({
    push: mockPush
  }))
}));

jest.mock("@/components/AppFrame", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  return {
    AppFrame: ({ title, rightAction, onRightAction, rightActionLabel, topContent, children }: any) =>
      React.createElement(
        View,
        { style: { flex: 1 } },
        React.createElement(
          View,
          null,
          React.createElement(Text, null, title),
          onRightAction
            ? React.createElement(
                Pressable,
                {
                  accessibilityLabel: rightActionLabel ?? title,
                  accessibilityRole: "button",
                  onPress: onRightAction
                },
                rightAction ?? null
              )
            : null
        ),
        topContent ?? null,
        React.createElement(View, { style: { flex: 1 } }, children)
      )
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 24,
    right: 0,
    bottom: 0,
    left: 0
  })
}));

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();

  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      clear: jest.fn(async () => {
        store.clear();
      })
    }
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

jest.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: jest.fn(),
  useQueryClient: jest.fn()
}));

jest.mock("@/lib/api", () => ({
  listFileImportBatchesPage: jest.fn(),
  listGenerationJobsPage: jest.fn(),
  recordDashboardActivity: jest.fn(),
  retryFailedCourseJob: jest.fn(),
  retryFileImportBatch: jest.fn(),
  resolveApiUrl: jest.fn((path: string) => (/^https?:\/\//i.test(path) ? path : `http://10.0.2.2:8070${path}`))
}));

const mockedListGenerationJobsPage = listGenerationJobsPage as jest.MockedFunction<typeof listGenerationJobsPage>;
const mockedListFileImportBatchesPage = listFileImportBatchesPage as jest.MockedFunction<typeof listFileImportBatchesPage>;
const mockedRecordDashboardActivity = recordDashboardActivity as jest.MockedFunction<typeof recordDashboardActivity>;
const mockedRetryFailedCourseJob = retryFailedCourseJob as jest.MockedFunction<typeof retryFailedCourseJob>;
const mockedRetryFileImportBatch = retryFileImportBatch as jest.MockedFunction<typeof retryFileImportBatch>;
const mockedResolveApiUrl = resolveApiUrl as jest.MockedFunction<typeof resolveApiUrl>;
const mockedUseInfiniteQuery = useInfiniteQuery as jest.MockedFunction<typeof useInfiniteQuery>;
const mockedUseQueryClient = useQueryClient as jest.MockedFunction<typeof useQueryClient>;
const mockedOpenURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

function jobFixture(overrides: Record<string, unknown> = {}): GenerationJob {
  return {
    id: "job-1",
    course_id: "course-1",
    target_type: "course",
    target_id: "course-1",
    target_label: "网页课程",
    job_type: "tts_generate",
    status: "pending",
    progress_current: 0,
    progress_total: 0,
    result_resource_id: null,
    download_url: null,
    error_code: null,
    error_message: null,
    started_at: null,
    finished_at: null,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    ...overrides
  };
}

function fileItemFixture(overrides: Record<string, unknown> = {}): FileImportItem {
  return {
    id: "item-1",
    batch_id: "batch-1",
    course_id: null,
    status: "pending",
    original_filename: "a.md",
    relative_path: null,
    file_extension: ".md",
    content_type: "text/markdown",
    byte_size: 8,
    storage_backend: "local",
    bucket: null,
    object_key: "a.md",
    object_path: "/tmp/a.md",
    error_code: null,
    error_message: null,
    started_at: null,
    finished_at: null,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    ...overrides
  };
}

function batchFixture(overrides: Record<string, unknown> = {}): FileImportBatch {
  return {
    id: "batch-1",
    status: "pending",
    source_mode: "single_file",
    series_id: null,
    series_title: null,
    total_count: 1,
    success_count: 0,
    failed_count: 0,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    finished_at: null,
    items: [fileItemFixture()],
    ...overrides
  };
}

function pageResponse<T>(pages: T[][], page: number, totalPages = pages.length): PaginatedList<T> {
  return {
    items: pages[page - 1] ?? [],
    pagination: {
      page,
      page_size: 20,
      total: pages.reduce((sum, current) => sum + current.length, 0),
      total_pages: Math.max(1, totalPages),
      has_previous: page > 1,
      has_next: page < totalPages
    }
  };
}

let taskQueryFixtures: {
  jobs: GenerationJob[][];
  batches: FileImportBatch[][];
} = {
  jobs: [[]],
  batches: [[]]
};

function mockTaskPages(config: { jobPages?: GenerationJob[][]; batchPages?: FileImportBatch[][] }) {
  taskQueryFixtures = {
    jobs: config.jobPages ?? [[]],
    batches: config.batchPages ?? [[]]
  };

  mockedListGenerationJobsPage.mockImplementation(async ({ page = 1 } = {}) =>
    pageResponse(taskQueryFixtures.jobs, page, taskQueryFixtures.jobs.length)
  );
  mockedListFileImportBatchesPage.mockImplementation(async ({ page = 1 } = {}) =>
    pageResponse(taskQueryFixtures.batches, page, taskQueryFixtures.batches.length)
  );
}

function renderScreen() {
  return render(<DownloadsScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetLocalePreferenceForTests();
  mockTaskPages({ jobPages: [[]], batchPages: [[]] });
  mockedUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() } as never);
  mockedUseInfiniteQuery.mockImplementation((input: any) => {
    const { useState } = require("react");
    const queryKey = Array.isArray(input?.queryKey) ? input.queryKey : [];
    const kind = queryKey.includes("jobs") ? "jobs" : "batches";
    const [pageCount, setPageCount] = useState(1);
    function createQueryState<T>(pagesSource: T[][], loadPage: (nextPage: number) => Promise<void>) {
      const visiblePages = pagesSource.slice(0, pageCount);
      const totalPages = pagesSource.length;

      return {
        data: {
          pages: visiblePages.map((items, index) => ({
            items,
            pagination: {
              page: index + 1,
              page_size: 20,
              total: pagesSource.reduce((sum, current) => sum + current.length, 0),
              total_pages: Math.max(1, totalPages),
              has_previous: index > 0,
              has_next: index + 1 < totalPages
            }
          }))
        },
        isLoading: false,
        isFetching: false,
        isFetchingNextPage: false,
        hasNextPage: pageCount < totalPages,
        refetch: kind === "jobs" ? mockJobRefetch : mockBatchRefetch,
        fetchNextPage: async () => {
          const nextPage = pageCount + 1;
          if (nextPage > totalPages) {
            return;
          }
          await loadPage(nextPage);
          setPageCount((current: number) => Math.min(current + 1, totalPages));
        }
      };
    }

    return kind === "jobs"
      ? (createQueryState(taskQueryFixtures.jobs, async (nextPage) => {
          await mockedListGenerationJobsPage({ scope: "all", page: nextPage, pageSize: 20 });
        }) as never)
      : (createQueryState(taskQueryFixtures.batches, async (nextPage) => {
          await mockedListFileImportBatchesPage({ page: nextPage, pageSize: 20 });
        }) as never);
  });
  mockedRetryFailedCourseJob.mockResolvedValue(jobFixture({ id: "job-retry", status: "pending" }) as never);
  mockedRetryFileImportBatch.mockResolvedValue(batchFixture({ id: "batch-retry", status: "pending" }) as never);
  mockedResolveApiUrl.mockImplementation((path: string) => (/^https?:\/\//i.test(path) ? path : `http://10.0.2.2:8070${path}`));
});

afterEach(() => {
  jest.useRealTimers();
});

it("renders task status tabs and keeps the active tab isolated", async () => {
  mockTaskPages({
    jobPages: [
      [
        jobFixture({
          id: "job-running",
          target_label: "网页课程",
          status: "running",
          progress_current: 1,
          progress_total: 4
        }),
        jobFixture({
          id: "job-ready-download",
          target_label: "PDF 课件",
          job_type: "course_export_pdf",
          status: "succeeded",
          download_url: "https://media.pagealong.test/downloads/course.pdf"
        })
      ]
    ] as GenerationJob[][],
    batchPages: [
      [
        batchFixture({
          id: "batch-failed",
          status: "failed",
          failed_count: 1,
          total_count: 1,
          series_title: "失败批次",
          items: [fileItemFixture({ status: "failed", error_message: "文件格式不支持" })]
        })
      ]
    ]
  });

  const screen = await renderScreen();

  expect(screen.getByRole("tab", { name: "进行中" }).props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByText("网页课程")).toBeTruthy();
  expect(screen.queryByText("文件格式不支持")).toBeNull();
  expect(screen.getByRole("button", { name: "导入" })).toBeTruthy();
  expect(screen.getByPlaceholderText("输入网址，收藏为课程并生成音频")).toBeTruthy();
});

it("switches tabs in the English locale", async () => {
  await setLocalePreference("en");
  mockTaskPages({
    jobPages: [
      [
        jobFixture({
          id: "job-running",
          target_label: "Course",
          status: "running"
        })
      ]
    ]
  });

  const screen = await renderScreen();

  expect(screen.getByRole("tab", { name: "Running" }).props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByRole("tab", { name: "Pending" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Completed" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Failed" })).toBeTruthy();
  expect(screen.getByPlaceholderText("Paste a URL to save it as a course")).toBeTruthy();
});

it("refreshes tasks when switching tabs", async () => {
  mockTaskPages({
    jobPages: [
      [
        jobFixture({
          id: "job-running",
          target_label: "网页课程",
          status: "running",
          progress_current: 1,
          progress_total: 4
        })
      ]
    ]
  });

  const screen = await renderScreen();

  await act(async () => {
    fireEvent.press(screen.getByRole("tab", { name: "已完成" }));
  });

  await waitFor(() => {
    expect(mockJobRefetch).toHaveBeenCalledTimes(1);
    expect(mockBatchRefetch).toHaveBeenCalledTimes(1);
  });
});

it("polls only the pending and running tabs when tasks exist", async () => {
  jest.useFakeTimers();
  mockTaskPages({
    jobPages: [
      [
        jobFixture({
          id: "job-running",
          target_label: "网页课程",
          status: "running",
          progress_current: 1,
          progress_total: 4
        })
      ]
    ]
  });

  const screen = await renderScreen();
  await waitFor(() => {
    expect(screen.getByText("网页课程")).toBeTruthy();
  });

  await act(async () => {
    jest.advanceTimersByTime(5000);
  });

  expect(mockJobRefetch).toHaveBeenCalledTimes(1);
  expect(mockBatchRefetch).toHaveBeenCalledTimes(1);

  await act(async () => {
    fireEvent.press(screen.getByRole("tab", { name: "已完成" }));
  });
  mockJobRefetch.mockClear();
  mockBatchRefetch.mockClear();

  await act(async () => {
    jest.advanceTimersByTime(5000);
  });

  expect(mockJobRefetch).not.toHaveBeenCalled();
  expect(mockBatchRefetch).not.toHaveBeenCalled();
  jest.useRealTimers();
});

it("opens ready task downloads from the completed tab", async () => {
  mockTaskPages({
    jobPages: [
      [
        jobFixture({
          id: "job-running",
          target_label: "网页课程",
          status: "running",
          progress_current: 1,
          progress_total: 4
        }),
        jobFixture({
          id: "job-ready-download",
          target_label: "PDF 课件",
          job_type: "course_export_pdf",
          status: "succeeded",
          download_url: "https://media.pagealong.test/downloads/course.pdf"
        })
      ]
    ]
  });

  const screen = await renderScreen();

  await act(async () => {
    fireEvent.press(screen.getByRole("tab", { name: "已完成" }));
  });
  await waitFor(() => {
    expect(screen.getByText("PDF 课件")).toBeTruthy();
  });

  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "下载 PDF 课件" }));
  });

  expect(mockedOpenURL).toHaveBeenCalledWith("https://media.pagealong.test/downloads/course.pdf");
});

it("opens retry details for a failed task and retries it", async () => {
  mockTaskPages({
    batchPages: [
      [
        batchFixture({
          id: "batch-failed",
          status: "failed",
          failed_count: 1,
          total_count: 1,
          series_title: "失败批次",
          items: [fileItemFixture({ status: "failed", error_message: "文件格式不支持" })]
        })
      ]
    ]
  });

  const screen = await renderScreen();

  await act(async () => {
    fireEvent.press(screen.getByRole("tab", { name: "失败" }));
  });
  fireEvent.press(screen.getByText("失败批次"));

  await waitFor(() => {
    expect(screen.getByText("重试")).toBeTruthy();
  });

  await act(async () => {
    fireEvent.press(screen.getByText("重试"));
  });

  await waitFor(() => {
    expect(mockedRetryFileImportBatch).toHaveBeenCalledWith("batch-failed");
  });
});

it("loads more tasks when the footer is activated", async () => {
  mockTaskPages({
    jobPages: [
      [
        jobFixture({
          id: "job-running-1",
          target_label: "第一页任务",
          status: "running",
          progress_current: 1,
          progress_total: 4
        })
      ],
      [
        jobFixture({
          id: "job-running-2",
          target_label: "第二页任务",
          status: "running",
          progress_current: 2,
          progress_total: 4
        })
      ]
    ]
  });

  const screen = await renderScreen();

  await waitFor(() => {
    expect(screen.getByText("第一页任务")).toBeTruthy();
  });
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "加载更多" }));
  });

  await waitFor(() => {
    expect(mockedListGenerationJobsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 20,
        scope: "all"
      })
    );
  });
  expect(screen.getByText("第二页任务")).toBeTruthy();
});
