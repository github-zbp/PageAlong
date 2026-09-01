jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();

  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: jest.fn(async () => {
        store.clear();
      })
    }
  };
});

jest.mock("expo-sharing", () => ({
  useIncomingShare: jest.fn()
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({}))
}));

jest.mock("@/providers/SessionProvider", () => ({
  useSession: jest.fn()
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

jest.mock("@/lib/api", () => ({
  createUrlCourse: jest.fn(),
  getCourse: jest.fn()
}));

jest.mock("@/lib/locale", () => ({
  useLocalePreference: () => "zh",
  resetLocalePreferenceForTests: jest.fn()
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  })
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, waitFor } from "@testing-library/react-native";
import { useIncomingShare } from "expo-sharing";
import { useRouter } from "expo-router";
import { createUrlCourse, getCourse } from "@/lib/api";
import { getShareCopy } from "@/lib/i18n";
import { useSession } from "@/providers/SessionProvider";
import ShareReceivePage from "../app/share/receive";

const mockedUseIncomingShare = useIncomingShare as jest.MockedFunction<typeof useIncomingShare>;
const mockedUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedCreateUrlCourse = createUrlCourse as jest.MockedFunction<typeof createUrlCourse>;
const mockedGetCourse = getCourse as jest.MockedFunction<typeof getCourse>;
const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const mockReplace = jest.fn();
const mockClearSharedPayloads = jest.fn();
const mockRefreshSharePayloads = jest.fn();

function mockCourse(overrides: Record<string, unknown> = {}) {
  return {
    id: "course-1",
    title: "网页",
    source_type: "url_import",
    status: "extracting_text",
    word_count: 12,
    duration_seconds: 0,
    current_audio_url: null,
    last_playback_position_seconds: 0,
    library_type: "fragmented",
    series_id: null,
    series_title: null,
    tags: [],
    is_starred: false,
    created_at: "2026-08-31T00:00:00.000Z",
    updated_at: "2026-08-31T00:00:00.000Z",
    last_read_at: null,
    content_markdown: null,
    source: null,
    sentences: [],
    sections: [],
    outline: [],
    ...overrides
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockedUseRouter.mockReturnValue({
    replace: mockReplace,
    push: jest.fn(),
    back: jest.fn()
  } as never);
  mockedUseSession.mockReturnValue({
    state: { status: "signed_in", token: "token", user: { id: "user-1" } as never },
    signInWithToken: jest.fn(),
    signOut: jest.fn(),
    refresh: jest.fn()
  });
});

it("imports a shared url and jumps to the reader after text is ready", async () => {
  await mockedAsyncStorage.setItem(
    "pagealong.pending.share",
    JSON.stringify({ url: "https://example.com/old" })
  );
  mockedUseIncomingShare.mockReturnValue({
    sharedPayloads: [{ value: "https://example.com/article", shareType: "url", mimeType: "text/plain" }],
    resolvedSharedPayloads: [],
    clearSharedPayloads: mockClearSharedPayloads,
    isResolving: false,
    error: null,
    refreshSharePayloads: mockRefreshSharePayloads
  });
  mockedCreateUrlCourse.mockResolvedValueOnce(mockCourse({ id: "course-1" }) as never);
  mockedGetCourse
    .mockResolvedValueOnce(mockCourse({ id: "course-1", status: "extracting_text" }) as never)
    .mockResolvedValueOnce(
      mockCourse({
        id: "course-1",
        status: "text_ready",
        content_markdown: "# 标题\n\n第一句。",
        sentences: [{ index: 0, text: "第一句。", audio_start_seconds: null, audio_end_seconds: null }]
      }) as never
    );

  const screen = await render(<ShareReceivePage />);

  await waitFor(() => {
    expect(screen.getByText(getShareCopy("zh").processing)).toBeTruthy();
  });

  await waitFor(() => {
    expect(mockedCreateUrlCourse).toHaveBeenCalledWith({
      url: "https://example.com/article",
      autoGenerateAudio: true
    });
  });

  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/courses/[courseId]",
      params: { courseId: "course-1" }
    });
  });

  expect(mockClearSharedPayloads).toHaveBeenCalled();
  await expect(mockedAsyncStorage.getItem("pagealong.pending.share")).resolves.toBeNull();
});

it("preserves a shared url and routes to login when signed out", async () => {
  mockedUseSession.mockReturnValue({
    state: { status: "signed_out", token: null, user: null },
    signInWithToken: jest.fn(),
    signOut: jest.fn(),
    refresh: jest.fn()
  });
  mockedUseIncomingShare.mockReturnValue({
    sharedPayloads: [{ value: "https://example.com/article", shareType: "url", mimeType: "text/plain" }],
    resolvedSharedPayloads: [],
    clearSharedPayloads: mockClearSharedPayloads,
    isResolving: false,
    error: null,
    refreshSharePayloads: mockRefreshSharePayloads
  });

  await render(<ShareReceivePage />);

  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
  });

  await expect(mockedAsyncStorage.getItem("pagealong.pending.share")).resolves.toContain("example.com/article");
});

it("shows an invalid share message when no web url is present", async () => {
  mockedUseIncomingShare.mockReturnValue({
    sharedPayloads: [{ value: "not a link", shareType: "text", mimeType: "text/plain" }],
    resolvedSharedPayloads: [],
    clearSharedPayloads: mockClearSharedPayloads,
    isResolving: false,
    error: null,
    refreshSharePayloads: mockRefreshSharePayloads
  });

  const screen = await render(<ShareReceivePage />);

  await waitFor(() => {
    expect(screen.getByText(getShareCopy("zh").invalidShare)).toBeTruthy();
  });
  expect(mockedCreateUrlCourse).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});
