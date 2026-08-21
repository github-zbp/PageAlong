from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass


_TENCENT_SPEED_FACTORS = {
    -2: 0.6,
    -1: 0.8,
    0: 1.0,
    1: 1.2,
    2: 1.5,
    3: 1.65,
    4: 2.0,
    5: 2.25,
    6: 2.5,
}


@dataclass(frozen=True)
class TextSegment:
    segment_index: int
    sentence_start_index: int
    sentence_end_index: int
    text: str
    text_hash: str


def tencent_speed_for_factor(speed_factor: float) -> int:
    clamped = max(0.6, min(2.5, speed_factor))
    return min(_TENCENT_SPEED_FACTORS, key=lambda speed: abs(_TENCENT_SPEED_FACTORS[speed] - clamped))


def split_text_for_tencent(
    text: str,
    *,
    max_chinese_chars: int = 560,
    max_english_letters: int = 1600,
) -> list[str]:
    normalized = _normalize_whitespace(text)
    if not normalized:
        return []

    limit = max_chinese_chars if _contains_cjk(normalized) else max_english_letters
    return _split_text_by_limit(normalized, limit)


def build_sentence_segments(sentences: list[str], *, max_characters: int) -> list[TextSegment]:
    segments: list[TextSegment] = []
    current_texts: list[str] = []
    current_start = 0

    def flush(end_index: int) -> None:
        nonlocal current_texts, current_start
        if not current_texts:
            return
        text = "".join(current_texts).strip()
        if text:
            segments.append(
                TextSegment(
                    segment_index=len(segments),
                    sentence_start_index=current_start,
                    sentence_end_index=end_index,
                    text=text,
                    text_hash=hash_text(text),
                )
            )
        current_texts = []
        current_start = end_index + 1

    for index, sentence in enumerate(sentences):
        normalized = _normalize_whitespace(sentence)
        if not normalized:
            continue

        if len(normalized) > max_characters:
            flush(index - 1)
            for chunk in _split_text_by_limit(normalized, max_characters):
                segments.append(
                    TextSegment(
                        segment_index=len(segments),
                        sentence_start_index=index,
                        sentence_end_index=index,
                        text=chunk,
                        text_hash=hash_text(chunk),
                    )
                )
            current_start = index + 1
            continue

        next_length = len("".join(current_texts)) + len(normalized)
        if current_texts and next_length > max_characters:
            flush(index - 1)

        if not current_texts:
            current_start = index
        current_texts.append(normalized)

    flush(len(sentences) - 1)
    return segments


def hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _split_text_by_limit(text: str, limit: int) -> list[str]:
    if limit <= 0:
        raise ValueError("limit must be positive")

    chunks: list[str] = []
    remaining = text
    while len(remaining) > limit:
        cut_at = _best_cut_index(remaining, limit)
        chunks.append(remaining[:cut_at].strip())
        remaining = remaining[cut_at:].strip()
    if remaining:
        chunks.append(remaining)
    return chunks


def _best_cut_index(text: str, limit: int) -> int:
    window = text[:limit]
    punctuation_matches = list(re.finditer(r"[。！？!?；;,.，、]\s*", window))
    if punctuation_matches:
        return punctuation_matches[-1].end()

    whitespace_index = window.rfind(" ")
    if whitespace_index >= int(limit * 0.6):
        return whitespace_index + 1

    return limit


def _contains_cjk(text: str) -> bool:
    return any("\u4e00" <= char <= "\u9fff" for char in text)


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()
