const SENTENCE_PATTERN = /[^。！？.!?\n]+[。！？.!?]?/g;

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function splitIntoSentences(text: string): string[] {
  return Array.from(normalizeWhitespace(text).matchAll(SENTENCE_PATTERN))
    .map((match) => normalizeWhitespace(match[0]))
    .filter(Boolean);
}
