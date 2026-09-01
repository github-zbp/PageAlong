const mockConstants = {
  appOwnership: null as string | null
};
let mockAudioReady = true;

jest.mock("expo-constants", () => ({
  __esModule: true,
  get appOwnership() {
    return mockConstants.appOwnership;
  },
  get executionEnvironment() {
    return "storeClient";
  },
  default: mockConstants
}));

jest.mock("@/providers/AudioProvider", () => ({
  useAudio: jest.fn(() => ({
    ready: mockAudioReady
  }))
}));

import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { createAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { Course } from "@/lib/api";
import { PlaybackProvider, usePlayback } from "@/providers/PlaybackProvider";

const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  replace: jest.fn(),
  seekTo: jest.fn().mockResolvedValue(undefined),
  setPlaybackRate: jest.fn(),
  setActiveForLockScreen: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
  clearLockScreenControls: jest.fn(),
  remove: jest.fn(),
  currentTime: 0,
  duration: 100,
  playing: false
};

const mockBaseStatus = {
  id: "player-1",
  currentTime: 0,
  playbackState: "paused",
  timeControlStatus: "paused",
  reasonForWaitingToPlay: "",
  mute: false,
  duration: 100,
  playing: false,
  loop: false,
  didJustFinish: false,
  isBuffering: false,
  isLoaded: true,
  playbackRate: 1,
  shouldCorrectPitch: true,
  isLive: false,
  currentOffsetFromLive: null,
  error: null
};
let mockStatus = { ...mockBaseStatus };

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => mockPlayer),
  useAudioPlayerStatus: jest.fn(() => mockStatus)
}));

jest.mock("@/lib/api", () => ({
  mediaUrl: jest.fn((value: string) => value),
  getCourse: jest.fn(),
  requestCourseAudioGeneration: jest.fn(),
  savePlaybackProgress: jest.fn().mockResolvedValue(undefined)
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

const mockedCreateAudioPlayer = createAudioPlayer as jest.MockedFunction<typeof createAudioPlayer>;
const mockedUseAudioPlayerStatus = useAudioPlayerStatus as jest.MockedFunction<typeof useAudioPlayerStatus>;

function courseFixture(overrides: Partial<Course> = {}): Course {
  return {
    id: "course-1",
    title: "课程标题",
    source_type: "manual_text",
    status: "ready",
    word_count: 12,
    duration_seconds: 100,
    current_audio_url: "/courses/course-1/audio",
    last_playback_position_seconds: 18,
    library_type: "fragmented",
    series_id: null,
    series_title: null,
    tags: [],
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
    outline: [],
    ...overrides
  } as Course;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockConstants.appOwnership = null;
  mockAudioReady = true;
  mockStatus = { ...mockBaseStatus };
});

it("loads a course audio source and activates lock screen controls", async () => {
  function Probe() {
    const playback = usePlayback();
    return <Pressable accessibilityLabel="load" onPress={() => playback.loadCourse(courseFixture())} />;
  }

  const screen = await render(
    <PlaybackProvider>
      <Probe />
    </PlaybackProvider>
  );

  fireEvent.press(screen.getByLabelText("load"));

  await waitFor(() => {
    expect(mockPlayer.replace).toHaveBeenCalledWith(expect.objectContaining({ uri: expect.stringContaining("/courses/course-1/audio") }));
  });
  expect(mockPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
    true,
    expect.objectContaining({ title: "课程标题", artist: "页相随 PageAlong" }),
    expect.objectContaining({ showSeekForward: true, showSeekBackward: true })
  );
});

it("waits for audio setup before activating lock screen controls", async () => {
  mockAudioReady = false;

  function Probe() {
    const playback = usePlayback();
    return <Pressable accessibilityLabel="load" onPress={() => playback.loadCourse(courseFixture())} />;
  }

  const screen = await render(
    <PlaybackProvider>
      <Probe />
    </PlaybackProvider>
  );

  fireEvent.press(screen.getByLabelText("load"));

  await waitFor(() => {
    expect(mockPlayer.replace).toHaveBeenCalledWith(expect.objectContaining({ uri: expect.stringContaining("/courses/course-1/audio") }));
  });
  expect(mockPlayer.setActiveForLockScreen).not.toHaveBeenCalled();

  mockAudioReady = true;
  await act(async () => {
    screen.rerender(
      <PlaybackProvider>
        <Probe />
      </PlaybackProvider>
    );
  });

  await waitFor(() => {
    expect(mockPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ title: "课程标题", artist: "页相随 PageAlong" }),
      expect.objectContaining({ showSeekForward: true, showSeekBackward: true })
    );
  });
});

it("skips lock screen activation in Expo Go", async () => {
  mockConstants.appOwnership = "expo";

  function Probe() {
    const playback = usePlayback();
    return <Pressable accessibilityLabel="load" onPress={() => playback.loadCourse(courseFixture())} />;
  }

  const screen = await render(
    <PlaybackProvider>
      <Probe />
    </PlaybackProvider>
  );

  fireEvent.press(screen.getByLabelText("load"));

  await waitFor(() => {
    expect(mockPlayer.replace).toHaveBeenCalledWith(expect.objectContaining({ uri: expect.stringContaining("/courses/course-1/audio") }));
  });
  expect(mockPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
});

it("exposes playback controls", async () => {
  function Probe() {
    const playback = usePlayback();
    return (
      <>
        <Text accessibilityLabel="rate">{String(playback.rate)}</Text>
        <Pressable accessibilityLabel="play" onPress={() => playback.loadCourse(courseFixture())} />
      </>
    );
  }

  const screen = await render(
    <PlaybackProvider>
      <Probe />
    </PlaybackProvider>
  );

  expect(screen.getByText("1")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("play"));
  await waitFor(() => {
    expect(mockedCreateAudioPlayer).toHaveBeenCalled();
  });
});

it("restarts from the beginning when toggling play after the track finished", async () => {
  mockStatus = {
    ...mockBaseStatus,
    currentTime: 100,
    duration: 100,
    didJustFinish: true
  };

  function Probe() {
    const playback = usePlayback();
    return (
      <>
        <Pressable accessibilityLabel="load" onPress={() => playback.loadCourse(courseFixture({ last_playback_position_seconds: 0 }))} />
        <Pressable accessibilityLabel="toggle" onPress={playback.toggle} />
      </>
    );
  }

  const screen = await render(
    <PlaybackProvider>
      <Probe />
    </PlaybackProvider>
  );

  fireEvent.press(screen.getByLabelText("load"));
  await waitFor(() => {
    expect(mockPlayer.replace).toHaveBeenCalledWith(expect.objectContaining({ uri: expect.stringContaining("/courses/course-1/audio") }));
  });

  fireEvent.press(screen.getByLabelText("toggle"));

  await waitFor(() => {
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
  });
  expect(mockPlayer.play).toHaveBeenCalled();
});
