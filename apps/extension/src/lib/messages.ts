import type { ExtractedArticle, HighlightColor } from "./types";

export type ContentRequestMessage =
  | { type: "PA_PING" }
  | { type: "PA_EXTRACT_ARTICLE" }
  | { type: "PA_HIGHLIGHT_SENTENCE"; text: string; color: HighlightColor; autoScroll: boolean }
  | { type: "PA_CLEAR_HIGHLIGHT" };

export type ContentResponseMessage =
  | { type: "PA_PONG" }
  | { type: "PA_ARTICLE_EXTRACTED"; article: ExtractedArticle }
  | { type: "PA_HIGHLIGHT_RESULT"; matched: boolean }
  | { type: "PA_CONTENT_ERROR"; code: string; message: string };
