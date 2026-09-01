import {
  activeSentenceIndexAt,
  clampSeekTime,
  formatPlayerTime,
  sentenceStartTime,
  shouldSaveProgress
} from "@/lib/player";

it("finds the active sentence for a playback time", () => {
  const sentences = [
    { index: 0, text: "第一句", audio_start_seconds: 0, audio_end_seconds: 3 },
    { index: 1, text: "第二句", audio_start_seconds: 3, audio_end_seconds: 8 }
  ];

  expect(activeSentenceIndexAt(sentences, 4)).toBe(1);
});

it("returns the sentence start time when it exists", () => {
  expect(sentenceStartTime({ index: 0, text: "句子", audio_start_seconds: 12.3, audio_end_seconds: 18 })).toBe(12.3);
  expect(sentenceStartTime({ index: 0, text: "句子", audio_start_seconds: null, audio_end_seconds: null })).toBeNull();
});

it("clamps seek time to the available duration", () => {
  expect(clampSeekTime(-4, 60)).toBe(0);
  expect(clampSeekTime(72, 60)).toBe(60);
});

it("formats player time as mm:ss", () => {
  expect(formatPlayerTime(5)).toBe("0:05");
  expect(formatPlayerTime(125)).toBe("2:05");
});

it("saves progress only after enough movement", () => {
  expect(shouldSaveProgress({ lastSavedSecond: 10, nextSecond: 18 })).toBe(false);
  expect(shouldSaveProgress({ lastSavedSecond: 10, nextSecond: 21 })).toBe(true);
});
