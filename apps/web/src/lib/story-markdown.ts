import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

import type { Locale } from "./i18n";

const STORY_FILES: Record<Locale, string> = {
  zh: "产品故事.md",
  en: "产品故事_en.md"
};

function resolveDocsRoot(): string {
  const candidates = [path.resolve(process.cwd(), "..", "..", "docs"), path.resolve(process.cwd(), "docs")];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

const DOCS_ROOT = resolveDocsRoot();

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function sanitizeHref(value: string): string {
  const trimmed = value.trim();
  if (/^(https?:|mailto:|\/|#)/i.test(trimmed)) {
    return trimmed;
  }
  return "#";
}

function rewriteStoryAssetSrc(value: string): string {
  const trimmed = value.trim();
  const fileName = trimmed.split("/").pop() ?? trimmed;
  if (fileName.includes("个人微信二维码")) {
    return "/personal-wechat-qr.jpg";
  }
  if (fileName.includes("qrcode_程序员阿沛")) {
    return "/pa-author-qr.jpg";
  }
  if (/^(https?:|\/)/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed.replace(/^\.\.\//g, "/");
}

function renderImageTag(src: string, alt: string, kind: "inline" | "block" = "inline"): string {
  const widthClass = kind === "block" ? "max-w-full" : "inline-block";
  return `<img src="${escapeAttribute(rewriteStoryAssetSrc(src))}" alt="${escapeAttribute(alt)}" class="${widthClass} h-auto rounded-md border border-[var(--pa-line)] bg-white object-cover" />`;
}

function renderRawImageTag(tag: string): string {
  const src = tag.match(/\bsrc="([^"]+)"/i)?.[1] ?? "";
  const alt = tag.match(/\balt="([^"]*)"/i)?.[1] ?? "";
  const width = tag.match(/\bwidth="([^"]+)"/i)?.[1];
  const height = tag.match(/\bheight="([^"]+)"/i)?.[1];
  const classes = tag.match(/\bclass="([^"]+)"/i)?.[1];
  const rewrittenTag = renderImageTag(src, alt, "inline").replace(
    'class="inline-block h-auto rounded-md border border-[var(--pa-line)] bg-white object-cover"',
    `class="${escapeAttribute(classes ?? "inline-block h-auto rounded-md border border-[var(--pa-line)] bg-white object-cover")}"`,
  );
  return rewrittenTag.replace(
    " />",
    `${width ? ` width="${escapeAttribute(width)}"` : ""}${height ? ` height="${escapeAttribute(height)}"` : ""} />`
  );
}

function renderInlineHtml(value: string): string {
  const rawImages: string[] = [];
  let working = value.replace(/<img\b[^>]*>/gi, (match) => {
    const token = `__PA_RAW_IMG_${rawImages.length}__`;
    rawImages.push(renderRawImageTag(match));
    return token;
  });

  working = escapeHtml(working);
  working = working.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_match, alt: string, src: string) =>
    renderImageTag(src, alt)
  );
  working = working.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
    const safeHref = escapeAttribute(sanitizeHref(href));
    return `<a class="text-[var(--pa-ink)] underline decoration-[var(--pa-green)] underline-offset-4" href="${safeHref}">${label}</a>`;
  });
  working = working.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  working = working.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  working = working.replace(/`([^`\n]+)`/g, "<code class=\"rounded bg-[var(--pa-muted-surface)] px-1 py-0.5 text-[0.95em] text-[var(--pa-ink)]\">$1</code>");

  rawImages.forEach((image, index) => {
    working = working.replace(`__PA_RAW_IMG_${index}__`, image);
  });

  return working;
}

function isTableSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function headingClass(depth: number): string {
  if (depth === 1) {
    return "mt-12 text-3xl font-semibold leading-tight text-[var(--pa-ink)] sm:text-4xl";
  }
  if (depth === 2) {
    return "mt-12 text-2xl font-semibold leading-tight text-[var(--pa-ink)] sm:text-3xl";
  }
  return "mt-9 text-base font-semibold leading-tight text-[var(--pa-ink)]";
}

function renderTable(lines: string[]): string {
  const rows = lines.map(splitTableRow);
  const hasHeaderSeparator = rows.length > 1 && isTableSeparatorRow(rows[1]);
  const headerCells = hasHeaderSeparator ? rows[0] : [];
  const bodyRows = hasHeaderSeparator ? rows.slice(2) : rows;
  const headerHtml = headerCells.length
    ? `<thead><tr>${headerCells
        .map(
          (cell) =>
            `<th class="border-b border-[var(--pa-line)] px-3 py-3 text-sm font-semibold text-[var(--pa-ink)]">${renderInlineHtml(cell)}</th>`
        )
        .join("")}</tr></thead>`
    : "";
  const bodyHtml = bodyRows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td class="border-b border-[var(--pa-line)] px-3 py-4 align-top text-sm leading-7 text-[var(--pa-muted)]">${renderInlineHtml(cell)}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  return `<div class="my-8 overflow-x-auto"><table class="w-full border-collapse">${headerHtml}<tbody>${bodyHtml}</tbody></table></div>`;
}

export async function loadStoryMarkdown(locale: Locale): Promise<string> {
  const fileName = STORY_FILES[locale];
  return fs.readFile(path.join(DOCS_ROOT, fileName), "utf8");
}

export function renderStoryMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let quoteLines: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }
    blocks.push(`<p class="mt-5 max-w-[68ch] text-[1.0625rem] leading-8 text-[var(--pa-muted)]">${renderInlineHtml(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (listItems.length === 0) {
      return;
    }
    blocks.push(
      `<ul class="mt-6 space-y-3">${listItems
        .map(
          (item) =>
            `<li class="flex gap-3 text-sm leading-7 text-[var(--pa-muted)]"><span class="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--pa-amber)]" aria-hidden="true"></span><span>${renderInlineHtml(item)}</span></li>`
        )
        .join("")}</ul>`
    );
    listItems = [];
  }

  function flushQuote() {
    if (quoteLines.length === 0) {
      return;
    }
    blocks.push(
      `<blockquote class="my-8 border-y border-[var(--pa-green)]/25 bg-[var(--pa-muted-surface)] px-5 py-5 text-lg leading-8 text-[var(--pa-ink)] sm:px-7">${quoteLines
        .map((line) => renderInlineHtml(line.replace(/^>\s?/, "")))
        .join("<br />")}</blockquote>`
    );
    quoteLines = [];
  }

  let index = 0;
  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushQuote();
      index += 1;
      continue;
    }

    if (trimmed === "----" || trimmed === "---") {
      flushParagraph();
      flushList();
      flushQuote();
      blocks.push('<hr class="my-10 border-[var(--pa-line)]" />');
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      blocks.push(`<h${heading[1].length} class="${headingClass(heading[1].length)}">${renderInlineHtml(heading[2])}</h${heading[1].length}>`);
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      flushList();
      quoteLines.push(trimmed);
      index += 1;
      continue;
    }
    flushQuote();

    if (trimmed.startsWith("|")) {
      flushParagraph();
      flushList();
      const tableLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      blocks.push(renderTable(tableLines));
      continue;
    }

    const listItem = trimmed.match(/^[-*+]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]);
      index += 1;
      continue;
    }

    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
    if (image) {
      flushParagraph();
      flushList();
      blocks.push(
        `<figure class="my-8">${renderImageTag(image[2], image[1], "block")}</figure>`
      );
      index += 1;
      continue;
    }

    paragraph.push(trimmed);
    index += 1;
  }

  flushParagraph();
  flushList();
  flushQuote();

  return blocks.join("\n");
}
