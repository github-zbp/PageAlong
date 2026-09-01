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
