from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Literal

WordCountUnit = Literal["characters", "words"]

CJK_CHARACTER_PATTERN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
ENGLISH_WORD_PATTERN = re.compile(r"[A-Za-z0-9]+(?:[’'\-][A-Za-z0-9]+)*")
CHINESE_READING_CHARS_PER_MINUTE = 450
ENGLISH_READING_WORDS_PER_MINUTE = 220


@dataclass(frozen=True)
class TextContentMetric:
    count: int
    unit: WordCountUnit
    estimated_reading_seconds: int


def measure_text_content(text: str) -> TextContentMetric:
    cjk_count = len(CJK_CHARACTER_PATTERN.findall(text or ""))
    english_word_count = len(ENGLISH_WORD_PATTERN.findall(text or ""))

    if cjk_count > 0:
        return TextContentMetric(
            count=cjk_count,
            unit="characters",
            estimated_reading_seconds=estimate_reading_seconds(
                cjk_count,
                CHINESE_READING_CHARS_PER_MINUTE,
            ),
        )

    return TextContentMetric(
        count=english_word_count,
        unit="words",
        estimated_reading_seconds=estimate_reading_seconds(
            english_word_count,
            ENGLISH_READING_WORDS_PER_MINUTE,
        ),
    )


def estimate_reading_seconds(count: int, units_per_minute: int) -> int:
    if count <= 0:
        return 0
    return max(60, math.ceil(count / units_per_minute * 60))


def word_count_unit_label(unit: WordCountUnit) -> str:
    return "字" if unit == "characters" else "单词"
