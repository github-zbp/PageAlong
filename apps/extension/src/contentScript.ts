import { extractArticleFromDocument } from "./lib/extractor";
import { clearHighlight, highlightTextInDocument } from "./lib/highlight";
import type { ContentRequestMessage, ContentResponseMessage } from "./lib/messages";

chrome.runtime.onMessage.addListener(
  (
    message: ContentRequestMessage,
    _sender,
    sendResponse: (response: ContentResponseMessage) => void
  ) => {
    try {
      if (message.type === "PA_PING") {
        sendResponse({ type: "PA_PONG" });
        return true;
      }
      if (message.type === "PA_EXTRACT_ARTICLE") {
        sendResponse({
          type: "PA_ARTICLE_EXTRACTED",
          article: extractArticleFromDocument(document, new URL(window.location.href))
        });
        return true;
      }
      if (message.type === "PA_HIGHLIGHT_SENTENCE") {
        sendResponse({
          type: "PA_HIGHLIGHT_RESULT",
          matched: highlightTextInDocument(document, message.text, message.color, message.autoScroll)
        });
        return true;
      }
      if (message.type === "PA_CLEAR_HIGHLIGHT") {
        clearHighlight(document);
        sendResponse({ type: "PA_HIGHLIGHT_RESULT", matched: true });
        return true;
      }
    } catch (error) {
      sendResponse({
        type: "PA_CONTENT_ERROR",
        code: "content_script_error",
        message: error instanceof Error ? error.message : "Content script failed"
      });
      return true;
    }
    return false;
  }
);
