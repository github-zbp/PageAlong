import type { ExtractedSentence } from "./types";

type TtsCallbacks = {
  rate: number;
  onActiveIndex: (index: number) => void;
  onFinished: () => void;
  onError: (message: string) => void;
};

type ChromeTtsApi = Pick<typeof chrome.tts, "speak" | "pause" | "resume" | "stop">;

const defaultTtsApi = globalThis.chrome?.tts;

export function createTtsController(ttsApi: ChromeTtsApi | undefined = defaultTtsApi) {
  if (!ttsApi) {
    throw new Error("Chrome TTS unavailable");
  }
  let stopped = false;
  let paused = false;

  async function speakOne(sentence: ExtractedSentence, callbacks: TtsCallbacks): Promise<void> {
    callbacks.onActiveIndex(sentence.index);
    await new Promise<void>((resolve) => {
      ttsApi.speak(
        sentence.text,
        {
          enqueue: false,
          rate: callbacks.rate,
          onEvent: (event) => {
            if (event.type === "end" || event.type === "interrupted" || event.type === "cancelled") {
              resolve();
            }
            if (event.type === "error") {
              callbacks.onError("Chrome TTS playback failed");
              resolve();
            }
          }
        },
        () => {
          const runtimeError = globalThis.chrome?.runtime?.lastError?.message;
          if (runtimeError) {
            callbacks.onError(runtimeError);
            resolve();
          }
        }
      );
    });
  }

  return {
    async play(sentences: ExtractedSentence[], callbacks: TtsCallbacks): Promise<void> {
      stopped = false;
      paused = false;
      for (const sentence of sentences) {
        if (stopped) {
          break;
        }
        while (paused && !stopped) {
          await new Promise((resolve) => window.setTimeout(resolve, 100));
        }
        await speakOne(sentence, callbacks);
      }
      callbacks.onFinished();
    },
    pause(): void {
      paused = true;
      ttsApi.pause();
    },
    resume(): void {
      paused = false;
      ttsApi.resume();
    },
    stop(): void {
      stopped = true;
      paused = false;
      ttsApi.stop();
    }
  };
}
