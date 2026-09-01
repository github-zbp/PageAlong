from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class MarkdownOutlineItem:
    id: str
    depth: int
    title: str


FENCE_PATTERN = re.compile(r"^\s{0,3}(```+|~~~+)")
HEADING_PATTERN = re.compile(r"^\s{0,3}(#{1,6})[ \t]+(.+?)\s*$")


def build_markdown_outline(markdown: str) -> list[MarkdownOutlineItem]:
    outline: list[MarkdownOutlineItem] = []
    used_ids: dict[str, int] = {}
    in_fence = False
    fence_marker = ""

    for line in markdown.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        fence_match = FENCE_PATTERN.match(line)
        if fence_match is not None:
            marker = fence_match.group(1)
            if not in_fence:
                in_fence = True
                fence_marker = marker[0]
            elif marker.startswith(fence_marker):
                in_fence = False
                fence_marker = ""
            continue

        if in_fence:
            continue

        heading_match = HEADING_PATTERN.match(line)
        if heading_match is None:
            continue

        depth = len(heading_match.group(1))
        if depth > 4:
            continue

        title = clean_outline_title(heading_match.group(2))
        if not title:
            continue

        base_id = slugify_heading(title) or f"heading-{len(outline) + 1}"
        count = used_ids.get(base_id, 0) + 1
        used_ids[base_id] = count
        item_id = base_id if count == 1 else f"{base_id}-{count}"
        outline.append(MarkdownOutlineItem(id=item_id, depth=depth, title=title))

    return outline


def clean_outline_title(text: str) -> str:
    cleaned = re.sub(r"\s+#+\s*$", "", text.strip())
    cleaned = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", cleaned)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    cleaned = re.sub(r"\[([^\]]+)\]\((?:https?://)?[^)]+\)", r"\1", cleaned)
    cleaned = re.sub(r"https?://\S+", "", cleaned)
    cleaned = re.sub(r"\*\*([^*\n]+)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"__([^_\n]+)__", r"\1", cleaned)
    cleaned = re.sub(r"\*([^*\n]+)\*", r"\1", cleaned)
    cleaned = re.sub(r"_([^_\n]+)_", r"\1", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def slugify_heading(title: str) -> str:
    normalized = title.strip().lower()
    slug = re.sub(r"[^\w]+", "-", normalized, flags=re.UNICODE).strip("-")
    return f"heading-{slug}" if slug else ""


def encode_markdown_outline(outline: list[MarkdownOutlineItem]) -> str:
    return json.dumps([asdict(item) for item in outline], ensure_ascii=False)


def decode_markdown_outline(value: str | None) -> list[MarkdownOutlineItem]:
    if value is None:
        return []
    try:
        payload = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(payload, list):
        return []

    outline: list[MarkdownOutlineItem] = []
    for item in payload:
        if not isinstance(item, dict):
            return []
        item_id = str(item.get("id") or "").strip()
        title = str(item.get("title") or "").strip()
        try:
            depth = int(item.get("depth"))
        except (TypeError, ValueError):
            return []
        if not item_id or not title or depth < 1 or depth > 4:
            return []
        outline.append(MarkdownOutlineItem(id=item_id, depth=depth, title=title))
    return outline
