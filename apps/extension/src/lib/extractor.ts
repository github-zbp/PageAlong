import type { ArticleImageCandidate, ExtractedArticle } from "./types";
import { normalizeWhitespace, splitIntoSentences } from "./sentences";

const BLOCK_SELECTOR = "article, main, [role='main'], .article, .post, .entry-content, .content";
const DROP_SELECTOR = "script, style, nav, footer, header, aside, form, noscript";

function scoreElement(element: Element): number {
  const text = normalizeWhitespace(element.textContent || "");
  const linkText = Array.from(element.querySelectorAll("a"))
    .map((link) => link.textContent || "")
    .join(" ");
  const linkDensity = linkText.length / Math.max(1, text.length);
  return text.length * (1 - Math.min(linkDensity, 0.8));
}

function cloneCleanElement(element: Element): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(DROP_SELECTOR).forEach((node) => node.remove());
  return clone;
}

function bestContentElement(documentRef: Document): HTMLElement {
  const candidates = Array.from(documentRef.querySelectorAll(BLOCK_SELECTOR));
  if (candidates.length === 0) {
    return cloneCleanElement(documentRef.body || documentRef.documentElement);
  }
  const best = candidates.sort((a, b) => scoreElement(b) - scoreElement(a))[0];
  return cloneCleanElement(best);
}

function titleFromElement(element: HTMLElement, documentRef: Document): string {
  const heading = element.querySelector("h1, h2");
  return normalizeWhitespace(heading?.textContent || documentRef.title || "未命名网页");
}

function imageCandidates(element: HTMLElement, pageUrl: URL): ArticleImageCandidate[] {
  return Array.from(element.querySelectorAll("img"))
    .slice(0, 20)
    .map((image) => {
      const src = image.getAttribute("src") || "";
      const nearbyText = normalizeWhitespace(image.closest("figure, p, div")?.textContent || "");
      try {
        const resolved = new URL(src, pageUrl).toString();
        if (!/^https?:\/\//i.test(resolved)) {
          return null;
        }
        return {
          url: resolved,
          alt: image.getAttribute("alt") || "",
          width: image.naturalWidth || Number(image.getAttribute("width") || 0) || undefined,
          height: image.naturalHeight || Number(image.getAttribute("height") || 0) || undefined,
          nearbyText
        };
      } catch {
        return null;
      }
    })
    .filter((image): image is ArticleImageCandidate => image !== null);
}

export function extractArticleFromDocument(documentRef: Document, pageUrl: URL): ExtractedArticle {
  const content = bestContentElement(documentRef);
  const textExcerpt = normalizeWhitespace(content.textContent || "");
  const title = titleFromElement(content, documentRef);
  return {
    url: pageUrl.toString(),
    title,
    sourceDomain: pageUrl.hostname,
    articleHtml: content.innerHTML,
    textExcerpt,
    images: imageCandidates(content, pageUrl),
    sentences: splitIntoSentences(textExcerpt).map((text, index) => ({ index, text }))
  };
}
