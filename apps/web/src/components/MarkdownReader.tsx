"use client";

import React, { useEffect, useMemo } from "react";
import { mediaUrl } from "@/lib/api";
import {
  fontSizeClassName,
  lineHeightClassName,
  type ReaderFontSize,
  type ReaderLineHeight
} from "@/lib/reader-preferences";
import type { Sentence } from "@/lib/types";

type Block =
  | { type: "heading"; depth: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; text: string }
  | { type: "image"; alt: string; src: string };

type TextUnit = {
  id: string;
  text: string;
  normalizedText: string;
  kind: "text" | "code" | "image";
  listGroupId?: string;
  render: (
    nodes: React.ReactNode,
    key: string,
    activeSentenceIndex: number,
    onSelectSentence: (sentence: Sentence) => void,
    sentence: Sentence | null,
  ) => React.ReactNode;
};

type MatchedUnit = TextUnit & {
  start: number;
  end: number;
};

type UnitSegment = {
  text: string;
  sentence: Sentence | null;
};

function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let codeLines: string[] = [];
  let inCode = false;

  function flushParagraph() {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  }

  function flushList() {
    if (listItems.length > 0) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
    }
  }

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      if (inCode) {
        blocks.push({ type: "code", text: codeLines.join("\n") });
        codeLines = [];
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      return;
    }
    if (inCode) {
      codeLines.push(line);
      return;
    }
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", depth: heading[1].length, text: heading[2] });
      return;
    }
    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
    if (image) {
      flushParagraph();
      flushList();
      blocks.push({ type: "image", alt: image[1], src: image[2] });
      return;
    }
    const item = trimmed.match(/^[-*+]\s+(.+)$/);
    if (item) {
      flushParagraph();
      listItems.push(item[1]);
      return;
    }
    paragraph.push(trimmed);
  });
  flushParagraph();
  flushList();
  if (inCode && codeLines.length > 0) {
    blocks.push({ type: "code", text: codeLines.join("\n") });
  }
  return blocks;
}

function normalizeMarkdownInline(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(text: string): string {
  return normalizeMarkdownInline(text).replace(/\s+/g, " ").trim();
}

function renderInlineText(
  text: string,
  keyPrefix: string,
  activeSentenceIndex: number,
  onSelectSentence: (sentence: Sentence) => void,
  sentence: Sentence | null,
) {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  const tokenPattern = /(\*\*[^*\n]+\*\*|__[^_\n]+__|!?\[[^\]]*\]\([^)]*\)|`[^`]+`|https?:\/\/\S+)/g;
  Array.from(text.matchAll(tokenPattern)).forEach((match, index) => {
    if (match.index === undefined) {
      return;
    }
    if (match.index > cursor) {
      nodes.push(<React.Fragment key={`${keyPrefix}-t-${index}`}>{text.slice(cursor, match.index)}</React.Fragment>);
    }
    const rawToken = match[0];
    const link = rawToken.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    const image = rawToken.match(/^!\[([^\]]*)\]\([^)]*\)$/);
    const code = rawToken.match(/^`([^`]+)`$/);
    const asteriskBold = rawToken.match(/^\*\*([^*\n]+)\*\*$/);
    const underscoreBold = rawToken.match(/^__([^_\n]+)__$/);
    if (link) {
      nodes.push(<React.Fragment key={`${keyPrefix}-l-${index}`}>{link[1]}</React.Fragment>);
    } else if (image) {
      nodes.push(<React.Fragment key={`${keyPrefix}-i-${index}`}>{image[1]}</React.Fragment>);
    } else if (code) {
      nodes.push(<React.Fragment key={`${keyPrefix}-c-${index}`}>{code[1]}</React.Fragment>);
    } else if (asteriskBold || underscoreBold) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold text-[#1f1a14]">
          {(asteriskBold ?? underscoreBold)?.[1]}
        </strong>
      );
    }
    cursor = match.index + rawToken.length;
  });
  if (cursor < text.length) {
    nodes.push(<React.Fragment key={`${keyPrefix}-t-tail`}>{text.slice(cursor)}</React.Fragment>);
  }
  const content = nodes.length > 0 ? nodes : text;
  if (sentence === null) {
    return content;
  }
  const isActive = sentence.index === activeSentenceIndex;
  return (
    <button
      type="button"
      data-sentence-index={sentence.index}
      className={[
        "inline rounded-sm px-0.5 text-left transition-colors",
        isActive ? "pa-sentence-active text-[#1f1a14]" : "hover:bg-[#fff1d4]"
      ].join(" ")}
      onClick={() => onSelectSentence(sentence)}
    >
      {content}
    </button>
  );
}

function renderUnitSegments(
  segments: UnitSegment[],
  keyPrefix: string,
  activeSentenceIndex: number,
  onSelectSentence: (sentence: Sentence) => void,
) {
  return segments.map((segment, index) => (
    <React.Fragment key={`${keyPrefix}-segment-${index}`}>
      {renderInlineText(segment.text, `${keyPrefix}-${index}`, activeSentenceIndex, onSelectSentence, segment.sentence)}
    </React.Fragment>
  ));
}

function buildTextUnits(blocks: Block[]): TextUnit[] {
  const units: TextUnit[] = [];
  blocks.forEach((block, blockIndex) => {
    if (block.type === "heading") {
      const className = block.depth === 1 ? "text-xl font-semibold text-[#1f1a14]" : "text-lg font-semibold text-[#1f1a14]";
      units.push({
        id: `h-${blockIndex}`,
        text: block.text,
        normalizedText: normalizeForMatch(block.text),
        kind: "text",
        render: (nodes, key) => React.createElement(`h${Math.min(block.depth, 3)}`, { key, className }, nodes)
      });
      return;
    }
    if (block.type === "list") {
      block.items.forEach((item, itemIndex) => {
        units.push({
          id: `li-${blockIndex}-${itemIndex}`,
          text: item,
          normalizedText: normalizeForMatch(item),
          kind: "text",
          listGroupId: `list-${blockIndex}`,
          render: (nodes, key) => <li key={key}>{nodes}</li>
        });
      });
      return;
    }
    if (block.type === "code") {
      units.push({
        id: `code-${blockIndex}`,
        text: block.text,
        normalizedText: "",
        kind: "code",
        render: (_nodes, key) => (
          <pre key={key} className="overflow-x-auto rounded-lg bg-[#1f1a14] p-3 text-sm leading-6 text-[#fffdf8]">
            <code>{block.text}</code>
          </pre>
        )
      });
      return;
    }
    if (block.type === "image") {
      units.push({
        id: `img-${blockIndex}`,
        text: "",
        normalizedText: "",
        kind: "image",
        render: (_nodes, key) => (
          <img
            key={key}
            alt={block.alt}
            className="max-h-[70vh] w-full rounded-lg bg-[#f3ede2] object-contain"
            decoding="async"
            loading="lazy"
            src={mediaUrl(block.src)}
          />
        )
      });
      return;
    }
    units.push({
      id: `p-${blockIndex}`,
      text: block.text,
      normalizedText: normalizeForMatch(block.text),
      kind: "text",
      render: (nodes, key) => <p key={key}>{nodes}</p>
    });
  });
  return units;
}

function mapSentencesToUnits(units: TextUnit[], sentences: Sentence[]): Map<string, UnitSegment[]> {
  const map = new Map<string, UnitSegment[]>();
  let normalizedDocument = "";
  const matchedUnits: MatchedUnit[] = [];
  units.forEach((unit) => {
    if (unit.kind === "code" || !unit.normalizedText) {
      return;
    }
    if (normalizedDocument) {
      normalizedDocument += " ";
    }
    const start = normalizedDocument.length;
    normalizedDocument += unit.normalizedText;
    matchedUnits.push({ ...unit, start, end: normalizedDocument.length });
  });

  sentences.forEach((sentence) => {
    const normalizedSentence = normalizeForMatch(sentence.text);
    if (!normalizedSentence) {
      return;
    }
    const start = normalizedDocument.indexOf(normalizedSentence);
    if (start < 0) {
      return;
    }
    const end = start + normalizedSentence.length;
    matchedUnits.forEach((unit) => {
      if (unit.end <= start || unit.start >= end) {
        return;
      }
      map.set(unit.id, splitUnitForSentence(map.get(unit.id) ?? [{ text: unit.text, sentence: null }], sentence));
    });
  });
  return map;
}

function splitUnitForSentence(segments: UnitSegment[], sentence: Sentence): UnitSegment[] {
  const normalizedSentence = normalizeForMatch(sentence.text);
  if (!normalizedSentence) {
    return segments;
  }
  const nextSegments: UnitSegment[] = [];
  let alreadyMatched = false;
  segments.forEach((segment) => {
    if (alreadyMatched || segment.sentence !== null) {
      nextSegments.push(segment);
      return;
    }
    const match = findNormalizedSlice(segment.text, normalizedSentence);
    if (match === null) {
      nextSegments.push(segment);
      return;
    }
    const before = segment.text.slice(0, match.start);
    const selected = segment.text.slice(match.start, match.end);
    const after = segment.text.slice(match.end);
    if (before) {
      nextSegments.push({ text: before, sentence: null });
    }
    if (selected) {
      nextSegments.push({ text: selected, sentence });
    }
    if (after) {
      nextSegments.push({ text: after, sentence: null });
    }
    alreadyMatched = true;
  });
  return nextSegments;
}

function findNormalizedSlice(text: string, normalizedNeedle: string): { start: number; end: number } | null {
  for (let start = 0; start < text.length; start += 1) {
    for (let end = start + 1; end <= text.length; end += 1) {
      if (normalizeForMatch(text.slice(start, end)) === normalizedNeedle) {
        return { start, end };
      }
    }
  }
  return null;
}

export function MarkdownReader({
  markdown,
  sentences,
  activeSentenceIndex,
  onSelectSentence,
  fontSize = "standard",
  lineHeight = "comfortable"
}: {
  markdown: string;
  sentences: Sentence[];
  activeSentenceIndex: number;
  onSelectSentence: (sentence: Sentence) => void;
  fontSize?: ReaderFontSize;
  lineHeight?: ReaderLineHeight;
}) {
  const blocks = useMemo(() => parseMarkdown(markdown), [markdown]);
  const units = useMemo(() => buildTextUnits(blocks), [blocks]);
  const segmentsByUnit = useMemo(() => mapSentencesToUnits(units, sentences), [units, sentences]);

  useEffect(() => {
    const activeNode = document.querySelector(`[data-sentence-index="${activeSentenceIndex}"]`);
    activeNode?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeSentenceIndex]);

  return (
    <article
      className={[
        "mx-auto max-w-[72ch] space-y-5 px-1 text-[#2a241d] md:px-0",
        fontSizeClassName(fontSize),
        lineHeightClassName(lineHeight)
      ].join(" ")}
    >
      {units.map((unit, index) => {
        if (unit.listGroupId && units[index - 1]?.listGroupId === unit.listGroupId) {
          return null;
        }
        if (unit.listGroupId) {
          const listUnits = units.filter((candidate) => candidate.listGroupId === unit.listGroupId);
          return (
            <ul key={unit.listGroupId} className="list-disc space-y-1 pl-5">
              {listUnits.map((listUnit) => {
                const segments = segmentsByUnit.get(listUnit.id) ?? [{ text: listUnit.text, sentence: null }];
                const nodes = renderUnitSegments(segments, listUnit.id, activeSentenceIndex, onSelectSentence);
                const sentence = segments.find((segment) => segment.sentence !== null)?.sentence ?? null;
                return listUnit.render(nodes, listUnit.id, activeSentenceIndex, onSelectSentence, sentence);
              })}
            </ul>
          );
        }
        const segments = segmentsByUnit.get(unit.id) ?? [{ text: unit.text, sentence: null }];
        const nodes = renderUnitSegments(segments, unit.id, activeSentenceIndex, onSelectSentence);
        const sentence = segments.find((segment) => segment.sentence !== null)?.sentence ?? null;
        return unit.render(nodes, unit.id, activeSentenceIndex, onSelectSentence, sentence);
      })}
    </article>
  );
}
