from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from app.services.tts_types import (
    TTSSegmentRequest,
    TTSSegmentResult,
    TTSSentenceTiming,
    TTSProviderError,
    TTSProviderUnavailable,
)


class EdgeTTSSegmentProvider:
    provider_id = "edge_tts"

    def __init__(self, *, output_dir: Path, communicate_factory: Any | None = None):
        self.output_dir = output_dir
        self.communicate_factory = communicate_factory

    def synthesize_segment(self, request: TTSSegmentRequest) -> TTSSegmentResult:
        output_path = self._output_path(request)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        communicate_factory = self.communicate_factory or self._import_communicate_factory()
        try:
            communicate = communicate_factory(request.text, request.voice_id, rate=self._rate_for_speed(request.speed_factor))
            audio_bytes, sentence_timings = asyncio.run(self._stream_audio(communicate, request))
            output_path.write_bytes(audio_bytes)
        except Exception as exc:
            raise TTSProviderError(str(exc), code="edge_tts_error", retryable=True) from exc

        byte_size = output_path.stat().st_size if output_path.exists() else 0
        duration_seconds = max(
            (
                timing.end_seconds
                for timing in sentence_timings
            ),
            default=self._estimate_duration(request.text, request.speed_factor),
        )
        return TTSSegmentResult(
            provider_id=self.provider_id,
            model_id="edge-tts",
            voice_id=request.voice_id,
            audio_path=output_path,
            duration_seconds=duration_seconds,
            character_count=len(request.text),
            byte_size=byte_size,
            response_format=request.response_format or "mp3",
            sentence_timings=tuple(sentence_timings),
        )

    async def _stream_audio(
        self,
        communicate: Any,
        request: TTSSegmentRequest,
    ) -> tuple[bytes, list[TTSSentenceTiming]]:
        audio = bytearray()
        sentence_timings: list[TTSSentenceTiming] = []
        next_sentence_index = request.sentence_start_index

        async for message in communicate.stream():
            message_type = message.get("type")
            if message_type == "audio":
                audio.extend(message.get("data", b""))
                continue
            if message_type != "SentenceBoundary":
                continue
            if next_sentence_index > request.sentence_end_index:
                continue

            start_seconds = self._ticks_to_seconds(message["offset"])
            end_seconds = self._ticks_to_seconds(message["offset"] + message["duration"])
            sentence_timings.append(
                TTSSentenceTiming(
                    sentence_index=next_sentence_index,
                    start_seconds=start_seconds,
                    end_seconds=end_seconds,
                )
            )
            next_sentence_index += 1

        if not audio:
            raise TTSProviderError("Edge TTS returned no audio", code="edge_tts_empty_audio", retryable=True)
        return bytes(audio), sentence_timings

    def _ticks_to_seconds(self, ticks: int) -> float:
        return round(float(ticks) / 10_000_000, 6)

    def _import_communicate_factory(self) -> Any:
        try:
            import edge_tts
        except ImportError as exc:
            raise TTSProviderUnavailable("edge-tts is required for Edge free TTS") from exc
        self.communicate_factory = edge_tts.Communicate
        return self.communicate_factory

    def _rate_for_speed(self, speed_factor: float) -> str:
        percentage = round((speed_factor - 1.0) * 100)
        return f"{percentage:+d}%"

    def _output_path(self, request: TTSSegmentRequest) -> Path:
        suffix = request.response_format or "mp3"
        return self.output_dir / "segments" / f"{request.job_id}-{request.segment_index}-{self.provider_id}.{suffix}"

    def _estimate_duration(self, text: str, speed_factor: float) -> float:
        return max(0.6, len(text.strip()) * 0.12 / max(speed_factor, 0.5))
