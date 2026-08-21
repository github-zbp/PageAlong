import type { HighlightColor } from "./types";
import { normalizeWhitespace } from "./sentences";

const HIGHLIGHT_CLASS = "pa-ext-current-sentence";
const COLOR_MAP: Record<HighlightColor, string> = {
  amber: "rgba(201, 138, 46, 0.24)",
  green: "rgba(47, 111, 94, 0.22)",
  blue: "rgba(59, 130, 246, 0.2)",
  purple: "rgba(126, 87, 194, 0.2)",
  coral: "rgba(244, 99, 83, 0.2)"
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function flexibleWhitespacePattern(text: string): RegExp {
  const normalized = normalizeWhitespace(text);
  return new RegExp(escapeRegExp(normalized).replace(/\s+/g, "\\s+"));
}

export function clearHighlight(documentRef: Document = document): void {
  documentRef.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((node) => {
    const parent = node.parentNode;
    if (!parent) {
      return;
    }
    parent.replaceChild(documentRef.createTextNode(node.textContent || ""), node);
    parent.normalize();
  });
}

function findTextNode(documentRef: Document, text: string): { node: Text; start: number; end: number } | null {
  const root = documentRef.body || documentRef.documentElement;
  if (!root) {
    return null;
  }
  const pattern = flexibleWhitespacePattern(text);
  const walker = documentRef.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    const value = node.nodeValue || "";
    const match = value.match(pattern);
    if (match && match.index !== undefined) {
      return { node, start: match.index, end: match.index + match[0].length };
    }
    current = walker.nextNode();
  }
  return null;
}

export function highlightTextInDocument(
  documentRef: Document,
  text: string,
  color: HighlightColor,
  autoScroll: boolean
): boolean {
  clearHighlight(documentRef);
  const match = findTextNode(documentRef, text);
  if (!match) {
    return false;
  }
  const range = documentRef.createRange();
  range.setStart(match.node, match.start);
  range.setEnd(match.node, match.end);
  const mark = documentRef.createElement("span");
  mark.className = HIGHLIGHT_CLASS;
  mark.style.background = COLOR_MAP[color];
  mark.style.boxShadow = `inset 3px 0 0 ${COLOR_MAP[color].replace("0.2", "0.9").replace("0.22", "0.9").replace("0.24", "0.9")}`;
  mark.style.borderRadius = "3px";
  mark.style.padding = "0 2px";
  range.surroundContents(mark);
  if (autoScroll) {
    mark.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  return true;
}
