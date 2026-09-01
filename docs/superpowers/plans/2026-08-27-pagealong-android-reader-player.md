# PageAlong Android Reader and Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Android course reader with Markdown reading, outline/series directory sheets, current-sentence highlighting, floating player, full-screen player, background playback, and playback progress persistence.

**Architecture:** Keep playback state in a shared provider above routes so audio continues when users leave the reader screen. The reader route fetches course detail and sends play/seek intents to the provider; the provider owns the single `expo-audio` player instance, lock-screen activation, current track metadata, time updates, playback rate, and throttled progress saves.

**Tech Stack:** Expo Router, React Native, TypeScript, React Query, expo-audio, FastAPI existing course APIs, @testing-library/react-native, jest.

**Spec:** `docs/superpowers/specs/2026-08-27-pagealong-android-app-design.md` (Spec 5: 阅读页与播放器)

## Global Constraints

- 只做 Android，不做 iOS。
- 不做 `Sign in with Apple`。
- 不做手机短信验证码登录。
- 微信登录保留，但仅在国内用户可见。
- 手机一键登录保留为可选能力，前提是没有直接金钱成本且接入路径明确。
- 主题只保留白天和夜间两种，不做动态色或额外主题。
- 后端接口优先复用 Web 端现有接口，只有确实无法复用时才补新接口。
- 播放器在应用切到后台后不能停止。
- 下载逻辑要和 Web 端一致：文件已准备好就立即下载，未准备好则提示生成中并引导去任务页。
- 设计、交互、组件、文字风格参考 `/Users/jqsf/Downloads/cubox` 下的竞品截图，只借深色底、强留白、超大标题、紧凑分组、底部抽屉和图标优先的界面语法，不照搬品牌元素。

---

## Scope Check

In scope:

- Course detail reading route.
- Markdown/body rendering.
- Outline bottom sheet.
- Series directory bottom sheet for series courses.
- Current sentence highlight and sentence-to-audio seeking.
- Top and bottom chrome auto-hide in reading mode.
- Floating mini player and full-screen player.
- Playback progress save through `PUT /courses/{course_id}/progress`.
- Audio-generation request/poll when text is ready but audio is not ready.
- Download action handoff to task center.

Out of scope:

- Real TTS integration; keep current backend fake/skeleton TTS behavior.
- Full offline sync and local audio cache.
- Native Android widgets beyond expo-audio lock-screen controls.
- iOS audio session behavior.

## Design Direction

- Reading page follows the Cubox reference: black/dark gray reading field in night mode, large article title, segmented top mode affordance only when useful, and bottom icon actions.
- The current sentence should use a soft amber background and a 2px left time-rail line, not a loud colored card.
- Touch once to enter quiet reading mode: top bar, bottom reader actions, and mini player fade/collapse. Tap again or scroll up to reveal.
- Full-screen player is functional and sparse: title, play/pause, 10-second jump buttons, progress slider, current/total time, and speed chips.

## File Structure

### Mobile Config

- Modify `apps/mobile/app.config.ts`: register `expo-audio` plugin for Android background playback and disable recording permission.
- Modify `apps/mobile/src/lib/audio.ts`: switch interruption mode to `doNotMix` for lock-screen controls.
- Modify `apps/mobile/src/providers/AudioProvider.tsx`: keep only global audio mode readiness; playback state moves to a dedicated provider.
- Modify `apps/mobile/app/_layout.tsx`: wrap routes in `PlaybackProvider`.

### Mobile Runtime

- Modify `apps/mobile/src/lib/api.ts`: add course detail, series detail, audio generation, download, and progress helpers.
- Create `apps/mobile/src/lib/player.ts`: sentence lookup, progress math, time formatting, save throttling helpers.
- Create `apps/mobile/src/providers/PlaybackProvider.tsx`: shared expo-audio player state and actions.
- Create `apps/mobile/src/components/MarkdownArticle.tsx`: mobile Markdown/body renderer.
- Create `apps/mobile/src/components/ReaderTopBar.tsx`: back/title/preferences/tag actions.
- Create `apps/mobile/src/components/ReaderBottomBar.tsx`: outline, series, download, star actions.
- Create `apps/mobile/src/components/OutlineSheet.tsx`: outline bottom sheet.
- Create `apps/mobile/src/components/SeriesDirectorySheet.tsx`: series course list bottom sheet.
- Create `apps/mobile/src/components/FloatingPlayer.tsx`: compact floating player.
- Create `apps/mobile/src/components/FullScreenPlayer.tsx`: expanded player.
- Create `apps/mobile/app/courses/[courseId].tsx`: course reader route.
- Create `apps/mobile/tests/player.test.ts`: player helper tests.
- Create `apps/mobile/tests/playback-provider.test.tsx`: provider behavior tests with expo-audio mocks.
- Create `apps/mobile/tests/reader-screen.test.tsx`: reader route render and interaction tests.

## Mobile Test Fixture Notes

When a test snippet below calls `courseFixture` or `ReaderPlayerHarness`, define those helpers in the same test file. `courseFixture` should return a complete `Course` object with sensible defaults and shallow-merge overrides. `ReaderPlayerHarness` should wrap `FloatingPlayer` and `FullScreenPlayer` in a mocked `PlaybackProvider` value so UI interactions can be tested without native audio.

---

### Task 1: Configure Android background playback

**Files:**
- Modify: `apps/mobile/app.config.ts`
- Modify: `apps/mobile/src/lib/audio.ts`
- Modify: `apps/mobile/tests/audio.test.ts`

**Interfaces:**
- Consumes: existing `configureBackgroundAudio()`.
- Produces: Android config that enables background playback foreground service and lock-screen compatible audio mode.

- [ ] **Step 1: Write failing config tests**

Update `apps/mobile/tests/audio.test.ts`:

```ts
jest.mock("expo-audio", () => ({
  setAudioModeAsync: jest.fn()
}));

import { setAudioModeAsync } from "expo-audio";
import { configureBackgroundAudio } from "@/lib/audio";

it("configures audio for sustained Android background playback", async () => {
  await configureBackgroundAudio();

  expect(setAudioModeAsync).toHaveBeenCalledWith({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: "doNotMix"
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- audio.test.ts
```

Expected: fail because the current interruption mode is `"duckOthers"`.

- [ ] **Step 3: Update audio mode**

Change `apps/mobile/src/lib/audio.ts`:

```ts
import { setAudioModeAsync } from "expo-audio";

export async function configureBackgroundAudio(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: "doNotMix"
  });
}
```

Update `apps/mobile/app.config.ts` plugins:

```ts
plugins: [
  "expo-router",
  "expo-secure-store",
  [
    "expo-audio",
    {
      enableBackgroundPlayback: true,
      recordAudioAndroid: false
    }
  ]
]
```

- [ ] **Step 4: Re-run audio tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- audio.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit playback config**

```bash
git add apps/mobile/app.config.ts apps/mobile/src/lib/audio.ts apps/mobile/tests/audio.test.ts
git commit -m "feat: configure android background playback"
```

---

### Task 2: Add course reader API helpers

**Files:**
- Modify: `apps/mobile/src/lib/api.ts`
- Create: `apps/mobile/tests/reader-api.test.ts`

**Interfaces:**
- Consumes: `GET /courses/{course_id}`, `GET /courses/series/{series_id}`, `PUT /courses/{course_id}/progress`, `POST /courses/{course_id}/audio-generation`, and `POST /courses/{course_id}/downloads/{format}`.
- Produces: `getCourse`, `getCourseSeries`, `savePlaybackProgress`, `requestCourseAudioGeneration`, and `requestCourseDownload`.

- [ ] **Step 1: Write failing API tests**

```ts
it("saves playback progress with integer seconds", async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ position_seconds: 12, sentence_index: 3 }) })) as jest.Mock;

  await savePlaybackProgress({ courseId: "course-1", positionSeconds: 12.8, sentenceIndex: 3 });

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/courses/course-1/progress"),
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ position_seconds: 12, sentence_index: 3 })
    })
  );
});
```

```ts
it("requests an audio download through the existing download endpoint", async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ status: "pending", job_id: "job-1", job_type: "tts_generate", message: "audio_generation_queued" })
  })) as jest.Mock;

  await requestCourseDownload("course-1", "audio");

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/courses/course-1/downloads/audio"),
    expect.objectContaining({ method: "POST" })
  );
});
```

- [ ] **Step 2: Run the failing tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- reader-api.test.ts
```

Expected: fail because the reader helpers are missing.

- [ ] **Step 3: Add reader types and helpers**

Add mobile-side types:

```ts
export type Sentence = {
  index: number;
  text: string;
  audio_start_seconds: number | null;
  audio_end_seconds: number | null;
};

export type CourseOutlineItem = {
  id: string;
  depth: number;
  title: string;
};

export type Course = CourseSummary & {
  sentences: Sentence[];
  outline: CourseOutlineItem[];
  content_markdown: string | null;
};

export type CourseDownloadFormat = "markdown" | "docx" | "pdf" | "audio";
export type DownloadRequest = {
  status: "ready" | "pending";
  job_id: string | null;
  job_type: string;
  resource_id: string | null;
  download_url: string | null;
  message: string | null;
};
```

Add:

```ts
export async function getCourse(courseId: string): Promise<Course> {
  return apiJson<Course>(`/courses/${courseId}`, { cache: "no-store" }, "Failed to load course");
}

export async function savePlaybackProgress(input: {
  courseId: string;
  positionSeconds: number;
  sentenceIndex: number;
}): Promise<void> {
  await apiNoContent(
    `/courses/${input.courseId}/progress`,
    {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({
        position_seconds: Math.floor(input.positionSeconds),
        sentence_index: input.sentenceIndex
      })
    },
    "Failed to save progress"
  );
}
```

- [ ] **Step 4: Re-run API tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- reader-api.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit reader API helpers**

```bash
git add apps/mobile/src/lib/api.ts apps/mobile/tests/reader-api.test.ts
git commit -m "feat: add mobile reader api helpers"
```

---

### Task 3: Add player helper functions

**Files:**
- Create: `apps/mobile/src/lib/player.ts`
- Create: `apps/mobile/tests/player.test.ts`

**Interfaces:**
- Consumes: `Sentence[]`.
- Produces: pure helpers used by provider and UI: `activeSentenceIndexAt`, `sentenceStartTime`, `clampSeekTime`, `formatPlayerTime`, and `shouldSaveProgress`.

- [ ] **Step 1: Write failing helper tests**

```ts
it("finds the active sentence for a playback time", () => {
  const sentences = [
    { index: 0, text: "第一句", audio_start_seconds: 0, audio_end_seconds: 3 },
    { index: 1, text: "第二句", audio_start_seconds: 3, audio_end_seconds: 8 }
  ];

  expect(activeSentenceIndexAt(sentences, 4)).toBe(1);
});
```

```ts
it("saves progress only after enough movement", () => {
  expect(shouldSaveProgress({ lastSavedSecond: 10, nextSecond: 18 })).toBe(false);
  expect(shouldSaveProgress({ lastSavedSecond: 10, nextSecond: 21 })).toBe(true);
});
```

- [ ] **Step 2: Run failing helper tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- player.test.ts
```

Expected: fail because `src/lib/player.ts` does not exist.

- [ ] **Step 3: Implement helpers**

```ts
import type { Sentence } from "@/lib/api";

export function activeSentenceIndexAt(sentences: Sentence[], seconds: number): number {
  const match = sentences.find((sentence) => {
    if (sentence.audio_start_seconds == null || sentence.audio_end_seconds == null) {
      return false;
    }
    return seconds >= sentence.audio_start_seconds && seconds < sentence.audio_end_seconds;
  });
  return match?.index ?? 0;
}

export function sentenceStartTime(sentence: Sentence): number | null {
  return sentence.audio_start_seconds == null ? null : Math.max(0, sentence.audio_start_seconds);
}

export function clampSeekTime(value: number, duration: number): number {
  return Math.min(Math.max(value, 0), Math.max(duration, 0));
}

export function formatPlayerTime(seconds: number): string {
  const normalized = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(normalized / 60);
  const remaining = normalized % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function shouldSaveProgress(input: { lastSavedSecond: number; nextSecond: number }): boolean {
  return Math.abs(input.nextSecond - input.lastSavedSecond) >= 10;
}
```

- [ ] **Step 4: Re-run helper tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- player.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit helper functions**

```bash
git add apps/mobile/src/lib/player.ts apps/mobile/tests/player.test.ts
git commit -m "feat: add mobile player helpers"
```

---

### Task 4: Build the shared playback provider

**Files:**
- Create: `apps/mobile/src/providers/PlaybackProvider.tsx`
- Modify: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/tests/playback-provider.test.tsx`

**Interfaces:**
- Consumes: `createAudioPlayer`, `useAudioPlayerStatus`-equivalent status through mocked expo-audio object, course data from `Course`, and `savePlaybackProgress`.
- Produces: `usePlayback()` with `loadCourse`, `toggle`, `seekTo`, `seekBy`, `setRate`, `activeSentenceIndex`, `status`, and `track`.

- [ ] **Step 1: Write failing provider tests**

Mock `expo-audio`:

```ts
const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  replace: jest.fn(),
  seekTo: jest.fn(),
  setPlaybackRate: jest.fn(),
  setActiveForLockScreen: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
  remove: jest.fn(),
  currentTime: 0,
  duration: 100,
  playing: false
};

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => mockPlayer)
}));
```

Test:

```tsx
it("loads a course audio source and activates lock screen controls", async () => {
  const course = courseFixture({ id: "course-1", title: "课程标题", current_audio_url: "/courses/course-1/audio" });

  function Probe() {
    const playback = usePlayback();
    return <Pressable accessibilityLabel="load" onPress={() => playback.loadCourse(course)} />;
  }

  const screen = render(
    <PlaybackProvider>
      <Probe />
    </PlaybackProvider>
  );

  fireEvent.press(screen.getByLabelText("load"));

  expect(mockPlayer.replace).toHaveBeenCalledWith(expect.objectContaining({ uri: expect.stringContaining("/courses/course-1/audio") }));
  expect(mockPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
    true,
    expect.objectContaining({ title: "课程标题", artist: "页相随 PageAlong" }),
    expect.any(Object)
  );
});
```

- [ ] **Step 2: Run failing provider test**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- playback-provider.test.tsx
```

Expected: fail because `PlaybackProvider` does not exist.

- [ ] **Step 3: Implement provider state**

Create context value:

```ts
type PlaybackContextValue = {
  track: Course | null;
  currentTime: number;
  duration: number;
  playing: boolean;
  rate: number;
  activeSentenceIndex: number;
  loadCourse: (course: Course) => void;
  toggle: () => void;
  seekTo: (seconds: number) => Promise<void>;
  seekBy: (deltaSeconds: number) => Promise<void>;
  setRate: (rate: number) => void;
};
```

Use `createAudioPlayer(null, { updateInterval: 500 })` once. In `loadCourse`, call `player.replace({ uri: mediaUrl(course.current_audio_url) })` when `current_audio_url` exists. Then call:

```ts
player.setActiveForLockScreen(
  true,
  { title: course.title, artist: "页相随 PageAlong" },
  { forwardSkipInterval: 10, backwardSkipInterval: 10 }
);
```

Use a 10-second threshold before calling `savePlaybackProgress`.

- [ ] **Step 4: Wrap app routes**

In `apps/mobile/app/_layout.tsx`, nest:

```tsx
<AudioProvider>
  <PlaybackProvider>
    <Stack screenOptions={{ headerShown: false }} />
  </PlaybackProvider>
</AudioProvider>
```

- [ ] **Step 5: Re-run provider tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- playback-provider.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit playback provider**

```bash
git add apps/mobile/src/providers/PlaybackProvider.tsx apps/mobile/app/_layout.tsx apps/mobile/tests/playback-provider.test.tsx
git commit -m "feat: add shared mobile playback provider"
```

---

### Task 5: Build reader UI components

**Files:**
- Create: `apps/mobile/src/components/MarkdownArticle.tsx`
- Create: `apps/mobile/src/components/ReaderTopBar.tsx`
- Create: `apps/mobile/src/components/ReaderBottomBar.tsx`
- Create: `apps/mobile/src/components/OutlineSheet.tsx`
- Create: `apps/mobile/src/components/SeriesDirectorySheet.tsx`
- Create: `apps/mobile/tests/reader-screen.test.tsx`

**Interfaces:**
- Consumes: `Course`, `CourseOutlineItem`, `Sentence`, `BottomSheet`, and theme tokens.
- Produces: reusable reader surface components.

- [ ] **Step 1: Add Markdown dependency**

Use npm in the mobile workspace:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm install react-native-markdown-display
```

Commit `apps/mobile/package.json` and `apps/mobile/package-lock.json` with this plan's changes only.

- [ ] **Step 2: Write failing reader component tests**

```tsx
it("highlights the current sentence", () => {
  const screen = render(
    <MarkdownArticle
      markdown={"第一句\\n\\n第二句"}
      sentences={[
        { index: 0, text: "第一句", audio_start_seconds: 0, audio_end_seconds: 3 },
        { index: 1, text: "第二句", audio_start_seconds: 3, audio_end_seconds: 8 }
      ]}
      activeSentenceIndex={1}
      onSentencePress={jest.fn()}
    />
  );

  expect(screen.getByText("第二句")).toBeTruthy();
});
```

- [ ] **Step 3: Run failing reader tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- reader-screen.test.tsx
```

Expected: fail because components are missing.

- [ ] **Step 4: Implement `MarkdownArticle`**

Use `react-native-markdown-display` for general Markdown blocks. For sentence-level highlighting, render the sentence list when `sentences.length > 0`; fall back to Markdown when sentences are unavailable:

```tsx
{sentences.length > 0 ? (
  sentences.map((sentence) => (
    <Pressable key={sentence.index} onPress={() => onSentencePress(sentence)}>
      <Text style={sentence.index === activeSentenceIndex ? activeSentenceStyle : sentenceStyle}>
        {sentence.text}
      </Text>
    </Pressable>
  ))
) : (
  <Markdown>{markdown}</Markdown>
)}
```

Use a left border only for the active sentence and keep line height comfortable in both themes.

- [ ] **Step 5: Implement bars and sheets**

`ReaderTopBar`:

- Back icon left.
- Center title truncates.
- Preference and tag icons right.
- Hide/show controlled by `visible`.

`ReaderBottomBar`:

- Outline.
- Series directory only when `course.series_id` exists.
- Download.
- Star.

`OutlineSheet` opens headings from `course.outline`. `SeriesDirectorySheet` renders `series.courses` as compact rows and calls `onSelectCourse(courseId)`.

- [ ] **Step 6: Re-run reader component tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- reader-screen.test.tsx
```

Expected: pass for component-level assertions.

- [ ] **Step 7: Commit reader UI components**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/src/components/MarkdownArticle.tsx apps/mobile/src/components/ReaderTopBar.tsx apps/mobile/src/components/ReaderBottomBar.tsx apps/mobile/src/components/OutlineSheet.tsx apps/mobile/src/components/SeriesDirectorySheet.tsx apps/mobile/tests/reader-screen.test.tsx
git commit -m "feat: add mobile reader components"
```

---

### Task 6: Build floating and full-screen players

**Files:**
- Create: `apps/mobile/src/components/FloatingPlayer.tsx`
- Create: `apps/mobile/src/components/FullScreenPlayer.tsx`
- Modify: `apps/mobile/tests/reader-screen.test.tsx`

**Interfaces:**
- Consumes: `usePlayback()` context.
- Produces: mini player and expanded full-screen player surfaces.

- [ ] **Step 1: Write failing player UI tests**

```tsx
it("expands the floating player into full screen controls", () => {
  const screen = render(<ReaderPlayerHarness />);

  fireEvent.press(screen.getByLabelText("展开播放器"));

  expect(screen.getByText("1.0x")).toBeTruthy();
  expect(screen.getByLabelText("后退 10 秒")).toBeTruthy();
  expect(screen.getByLabelText("前进 10 秒")).toBeTruthy();
});
```

- [ ] **Step 2: Run failing tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- reader-screen.test.tsx
```

Expected: fail because the player UI is missing.

- [ ] **Step 3: Implement `FloatingPlayer`**

Render only when `track` exists:

- Play/pause button.
- Title one line.
- A thin progress line that wraps the button edge visually by using an outer border/progress overlay.
- Pressing the component calls `onExpand`.

- [ ] **Step 4: Implement `FullScreenPlayer`**

Use a full-screen `Modal` with:

- Down icon to close.
- Course title.
- Current sentence text if available.
- Play/pause.
- Back 10 / forward 10.
- Slider or stepped progress control.
- Current time and total time using `formatPlayerTime`.
- Speed chips `[0.75, 1, 1.25, 1.5, 2]`.

- [ ] **Step 5: Re-run player UI tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- reader-screen.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit player UI**

```bash
git add apps/mobile/src/components/FloatingPlayer.tsx apps/mobile/src/components/FullScreenPlayer.tsx apps/mobile/tests/reader-screen.test.tsx
git commit -m "feat: add mobile reader player surfaces"
```

---

### Task 7: Build the course reader route

**Files:**
- Create: `apps/mobile/app/courses/[courseId].tsx`
- Modify: `apps/mobile/tests/reader-screen.test.tsx`

**Interfaces:**
- Consumes: `getCourse`, `getCourseSeries`, `requestCourseAudioGeneration`, `requestCourseDownload`, `updateCourseLibrary`, `usePlayback`, and reader components.
- Produces: navigable `/courses/[courseId]` route.

- [ ] **Step 1: Write failing route tests**

```tsx
it("loads a course and starts playback from the reader", async () => {
  jest.spyOn(api, "getCourse").mockResolvedValue(courseFixture({ id: "course-1", title: "功能导游" }));

  const screen = render(<CourseReaderScreen />);

  expect(await screen.findByText("功能导游")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("播放"));

  expect(screen.getByText("功能导游")).toBeTruthy();
});
```

- [ ] **Step 2: Run failing route tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- reader-screen.test.tsx
```

Expected: fail because the route is missing.

- [ ] **Step 3: Implement reader route data flow**

Use route params:

```tsx
const { courseId } = useLocalSearchParams<{ courseId: string }>();
const courseQuery = useQuery({
  queryKey: ["mobile", "course", courseId],
  queryFn: () => getCourse(courseId)
});
```

When the course loads, call `playback.loadCourse(course)` only after the user presses play, not on page load.

- [ ] **Step 4: Implement chrome hide/show**

State:

```ts
const [chromeVisible, setChromeVisible] = useState(true);
const [lastScrollY, setLastScrollY] = useState(0);
```

Behavior:

- Tap article body toggles `chromeVisible`.
- Scrolling down past 48 px hides chrome.
- Scrolling upward more than 20 px shows chrome.

- [ ] **Step 5: Implement download handoff**

`ReaderBottomBar` download action calls:

```ts
const request = await requestCourseDownload(course.id, format);
if (request.status === "ready" && request.download_url) {
  await Linking.openURL(mediaUrl(request.download_url));
} else {
  router.push({ pathname: "/downloads", params: { jobId: request.job_id ?? "" } });
}
```

Show a short inline message `"文件正在生成中"` before navigating.

- [ ] **Step 6: Re-run route tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- reader-screen.test.tsx
```

Expected: pass.

- [ ] **Step 7: Commit reader route**

```bash
git add apps/mobile/app/courses/[courseId].tsx apps/mobile/tests/reader-screen.test.tsx
git commit -m "feat: build mobile course reader route"
```

---

### Task 8: Verify reader and player

**Files:**
- All files changed by Tasks 1-7.

- [ ] **Step 1: Run mobile reader tests**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- audio.test.ts reader-api.test.ts player.test.ts playback-provider.test.tsx reader-screen.test.tsx
```

- [ ] **Step 2: Run mobile typecheck**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm run typecheck
```

- [ ] **Step 3: Manual Android check**

```bash
API_PORT=8070 make api
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8070 npm run android
```

Check:

- Course rows open `/courses/[courseId]`.
- Reader title truncates and正文 is readable in dark and light mode.
- Current sentence highlights softly and tapping a sentence seeks to the matching audio timestamp.
- Outline and series directory open as bottom sheets.
- Tapping article body hides top bar, bottom bar, and floating player; tapping again or scrolling up reveals them.
- Floating player expands to full screen and collapses with the down icon.
- Playback continues when app goes to background for at least 4 minutes on Android.
- Lock-screen controls show course title and respond to play/pause.
- Progress is saved after at least 10 seconds of movement.
- Download action opens a ready file or navigates to the downloads tab when generation is pending.

- [ ] **Step 4: Commit verification fixes if needed**

```bash
git status --short
git add <only-files-touched-for-this-plan>
git commit -m "fix: polish mobile reader playback"
```
