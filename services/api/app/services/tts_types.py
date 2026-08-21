from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class TTSRoutePlan:
    tier: str
    provider_id: str
    model_id: str
    voice_id: str
    speed_factor: float
    response_format: str
    segment_character_limit: int
    segment_byte_limit: int
    max_concurrency: int
    fallback_provider_id: str | None
    fallback_policy: str


@dataclass(frozen=True)
class TTSSegmentRequest:
    job_id: str
    course_id: str
    article_text_id: str
    section_id: str | None
    segment_index: int
    sentence_start_index: int
    sentence_end_index: int
    text: str
    text_hash: str
    provider_id: str
    model_id: str
    voice_id: str
    speed_factor: float
    provider_speed: str | None
    response_format: str
    idempotency_key: str


@dataclass(frozen=True)
class TTSSentenceTiming:
    sentence_index: int
    start_seconds: float
    end_seconds: float


@dataclass(frozen=True)
class TTSSegmentResult:
    provider_id: str
    model_id: str
    voice_id: str
    audio_path: Path
    duration_seconds: float
    character_count: int
    byte_size: int
    response_format: str
    sentence_timings: tuple[TTSSentenceTiming, ...] = ()


class TTSProviderError(Exception):
    def __init__(self, message: str, *, code: str = "tts_provider_error", retryable: bool = True):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


class TTSProviderUnavailable(TTSProviderError):
    def __init__(self, message: str, *, code: str = "tts_provider_unavailable"):
        super().__init__(message, code=code, retryable=True)
