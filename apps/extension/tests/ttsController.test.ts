import { describe, expect, it, vi } from "vitest";
import { createTtsController } from "../src/lib/ttsController";

describe("createTtsController", () => {
  it("speaks sentences in order and reports active index", async () => {
    const spoken: string[] = [];
    const activeIndexes: number[] = [];
    const tts = {
      speak: vi.fn((text: string, options: chrome.tts.TtsOptions, callback?: () => void) => {
        spoken.push(text);
        options.onEvent?.({ type: "start", charIndex: 0 });
        options.onEvent?.({ type: "end", charIndex: text.length });
        callback?.();
      }),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn()
    };
    const controller = createTtsController(tts as unknown as typeof chrome.tts);

    await controller.play(
      [
        { index: 0, text: "第一句。" },
        { index: 1, text: "第二句。" }
      ],
      {
        rate: 1.25,
        onActiveIndex: (index) => activeIndexes.push(index),
        onFinished: () => activeIndexes.push(-1),
        onError: () => undefined
      }
    );

    expect(spoken).toEqual(["第一句。", "第二句。"]);
    expect(activeIndexes).toEqual([0, 1, -1]);
  });
});
