from __future__ import annotations

from pathlib import Path
from typing import Any

from app.services.tts_types import TTSSegmentRequest, TTSSegmentResult, TTSProviderError, TTSProviderUnavailable


class AWSPollySegmentProvider:
    provider_id = "aws_polly_standard"

    def __init__(
        self,
        *,
        output_dir: Path,
        client: Any | None = None,
        region_name: str = "us-east-1",
        engine: str = "standard",
    ):
        self.output_dir = output_dir
        self.client = client
        self.region_name = region_name
        self.engine = engine

    def synthesize_segment(self, request: TTSSegmentRequest) -> TTSSegmentResult:
        client = self.client or self._build_client()
        output_path = self._output_path(request)
        try:
            response = client.synthesize_speech(
                Text=request.text,
                VoiceId=request.voice_id,
                OutputFormat=request.response_format or "mp3",
                Engine=self.engine,
            )
            audio_stream = response["AudioStream"]
            audio_bytes = audio_stream.read()
            if hasattr(audio_stream, "close"):
                audio_stream.close()
        except Exception as exc:
            raise TTSProviderError(str(exc), code="aws_polly_error", retryable=True) from exc

        self._write_bytes(output_path, audio_bytes)
        return TTSSegmentResult(
            provider_id=self.provider_id,
            model_id=self.engine,
            voice_id=request.voice_id,
            audio_path=output_path,
            duration_seconds=self._estimate_duration(request.text, request.speed_factor),
            character_count=len(request.text),
            byte_size=len(audio_bytes),
            response_format=request.response_format or "mp3",
        )

    def _build_client(self) -> Any:
        try:
            import boto3
        except ImportError as exc:
            raise TTSProviderUnavailable("boto3 is required for AWS Polly TTS") from exc
        self.client = boto3.client("polly", region_name=self.region_name)
        return self.client

    def _output_path(self, request: TTSSegmentRequest) -> Path:
        suffix = request.response_format or "mp3"
        return self.output_dir / "segments" / f"{request.job_id}-{request.segment_index}-{self.provider_id}.{suffix}"

    def _write_bytes(self, output_path: Path, audio_bytes: bytes) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(audio_bytes)

    def _estimate_duration(self, text: str, speed_factor: float) -> float:
        return max(0.6, len(text.strip()) * 0.12 / max(speed_factor, 0.5))
