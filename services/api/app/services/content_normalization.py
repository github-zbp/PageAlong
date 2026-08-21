from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

BOILERPLATE_HEADING_PATTERN = re.compile(
    r"^(related|recommend|comments|references|相关阅读|推荐阅读|评论|广告|赞助|更多文章|延伸阅读)\b",
    re.IGNORECASE,
)
CODE_BLOCK_PATTERN = re.compile(r"```.*?```", re.DOTALL)
IMAGE_PATTERN = re.compile(r"!\[[^\]]*\]\([^)]*\)")
LINK_PATTERN = re.compile(r"\[([^\]]+)\]\((https?://[^)]+)\)")
RAW_URL_PATTERN = re.compile(r"https?://\S+")
INLINE_CODE_PATTERN = re.compile(r"`([^`\n]+)`")
STRIKETHROUGH_PATTERN = re.compile(r"~~([^~\n]+)~~")
STRONG_PATTERN = re.compile(r"(\*\*|__)(.+?)\1")
ASTERISK_EMPHASIS_PATTERN = re.compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)")
UNDERSCORE_EMPHASIS_PATTERN = re.compile(r"(?<!\w)_([^_\n]+)_(?!\w)")


@dataclass(frozen=True)
class ContentQuality:
    is_usable: bool
    reason: str
    character_count: int
    link_count: int
    link_density: float


@dataclass(frozen=True)
class NormalizedContent:
    content_markdown: str
    tts_text: str
    content_hash: str
    quality: ContentQuality

    @classmethod
    def from_markdown(cls, markdown: str) -> "NormalizedContent":
        normalized_markdown = normalize_markdown(markdown)
        tts_text = derive_tts_text(normalized_markdown)
        return cls(
            content_markdown=normalized_markdown,
            tts_text=tts_text,
            content_hash=content_hash(normalized_markdown),
            quality=score_markdown_quality(normalized_markdown),
        )


def normalize_markdown(markdown: str) -> str:
    lines = markdown.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    kept: list[str] = []
    skipping = False
    in_code = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code = not in_code
            if not skipping:
                kept.append(line.rstrip())
            continue
        if not in_code and re.match(r"^#{1,6}\s+", stripped):
            skipping = bool(BOILERPLATE_HEADING_PATTERN.search(stripped.lstrip("#").strip()))
            if skipping:
                continue
        if skipping:
            if not stripped:
                continue
            if re.match(r"^#{1,6}\s+", stripped):
                skipping = bool(BOILERPLATE_HEADING_PATTERN.search(stripped.lstrip("#").strip()))
                if not skipping:
                    kept.append(line.rstrip())
            continue
        kept.append(line.rstrip())
    return re.sub(r"\n{3,}", "\n\n", "\n".join(kept)).strip()


def derive_tts_text(markdown: str) -> str:
    text = CODE_BLOCK_PATTERN.sub("", markdown)
    text = IMAGE_PATTERN.sub("", text)
    text = LINK_PATTERN.sub(r"\1", text)
    text = RAW_URL_PATTERN.sub("", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^>\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = strip_inline_markdown(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def strip_inline_markdown(text: str) -> str:
    text = INLINE_CODE_PATTERN.sub(r"\1", text)
    text = STRIKETHROUGH_PATTERN.sub(r"\1", text)
    text = STRONG_PATTERN.sub(r"\2", text)
    text = ASTERISK_EMPHASIS_PATTERN.sub(r"\1", text)
    return UNDERSCORE_EMPHASIS_PATTERN.sub(r"\1", text)


def score_markdown_quality(markdown: str) -> ContentQuality:
    text = derive_tts_text(markdown)
    character_count = len(re.sub(r"\s+", "", text))
    link_count = len(LINK_PATTERN.findall(markdown)) + len(RAW_URL_PATTERN.findall(markdown))
    link_density = link_count / max(1, character_count)
    if character_count < 80:
        if link_count >= 2:
            return ContentQuality(False, "link_heavy", character_count, link_count, link_density)
        return ContentQuality(False, "too_short", character_count, link_count, link_density)
    if link_density > 0.03:
        return ContentQuality(False, "link_heavy", character_count, link_count, link_density)
    return ContentQuality(True, "ok", character_count, link_count, link_density)


def content_hash(markdown: str) -> str:
    normalized = re.sub(r"\s+", " ", markdown).strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
