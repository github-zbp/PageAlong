from __future__ import annotations

import io
import wave
from pathlib import Path
from typing import Any

from app.services.tts_types import TTSSegmentRequest, TTSSegmentResult, TTSProviderError, TTSProviderUnavailable


class KokoroOnnxSegmentProvider:
    provider_id = "kokoro_onnx_cpu"

    def __init__(
        self,
        *,
        output_dir: Path,
        client: Any | None = None,
        model_path: str = "",
        voices_path: str = "",
        voice: str = "zf_xiaobei",
        chinese_g2p_factory: Any | None = None,
    ):
        self.output_dir = output_dir
        self.client = client
        self.model_path = model_path
        self.voices_path = voices_path
        self.voice = voice
        self.chinese_g2p_factory = chinese_g2p_factory
        self._chinese_g2p: Any | None = None

    def synthesize_segment(self, request: TTSSegmentRequest) -> TTSSegmentResult:
        client = self.client or self._build_client()
        output_path = self._output_path(request)
        try:
            audio_bytes = self._synthesize_bytes(client, request)
        except Exception as exc:
            raise TTSProviderError(str(exc), code="kokoro_onnx_error", retryable=True) from exc

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(audio_bytes)
        return TTSSegmentResult(
            provider_id=self.provider_id,
            model_id="kokoro-82m-onnx-cpu",
            voice_id=request.voice_id or self.voice,
            audio_path=output_path,
            duration_seconds=self._estimate_duration(request.text, request.speed_factor),
            character_count=len(request.text),
            byte_size=len(audio_bytes),
            response_format=request.response_format or "wav",
        )

    def _build_client(self) -> Any:
        if not self.model_path:
            raise TTSProviderUnavailable("TTS_KOKORO_MODEL_PATH is required for Kokoro ONNX CPU TTS")
        if not self.voices_path:
            raise TTSProviderUnavailable("TTS_KOKORO_VOICES_PATH is required for Kokoro ONNX CPU TTS")
        try:
            from kokoro_onnx import Kokoro
        except ImportError as exc:
            raise TTSProviderUnavailable("kokoro-onnx is required for Kokoro ONNX CPU TTS") from exc
        self.client = Kokoro(self.model_path, self.voices_path)
        return self.client

    def _synthesize_bytes(self, client: Any, request: TTSSegmentRequest) -> bytes:
        voice = request.voice_id or self.voice
        if hasattr(client, "synthesize"):
            return client.synthesize(text=request.text, voice=voice, speed=request.speed_factor)
        if hasattr(client, "create"):
            text, create_kwargs = self._create_input(request.text)
            audio, sample_rate = client.create(text, voice=voice, speed=request.speed_factor, **create_kwargs)
            return self._wav_bytes(audio, sample_rate)
        raise TTSProviderUnavailable("Kokoro client must expose synthesize(...) or create(...)")

    def _create_input(self, text: str) -> tuple[str, dict[str, Any]]:
        if not self._contains_cjk(text):
            return text, {"lang": "en-us"}

        phonemes = self._phonemize_chinese(text)
        return phonemes, {"is_phonemes": True}

    def _phonemize_chinese(self, text: str) -> str:
        g2p = self._get_chinese_g2p()
        result = g2p(text)
        if isinstance(result, tuple):
            phonemes = result[0]
        else:
            phonemes = result
        if not isinstance(phonemes, str) or not phonemes.strip():
            raise TTSProviderUnavailable("Chinese Kokoro G2P returned empty phonemes")
        return phonemes

    def _get_chinese_g2p(self) -> Any:
        if self._chinese_g2p is not None:
            return self._chinese_g2p
        if self.chinese_g2p_factory is not None:
            self._chinese_g2p = self.chinese_g2p_factory()
            return self._chinese_g2p
        try:
            from misaki.zh import ZHG2P
        except ImportError as exc:
            raise TTSProviderUnavailable("misaki[zh] is required for Kokoro Chinese TTS") from exc
        self._chinese_g2p = ZHG2P()
        return self._chinese_g2p

    def _contains_cjk(self, text: str) -> bool:
        return any("\u4e00" <= char <= "\u9fff" for char in text)

    def _wav_bytes(self, audio: Any, sample_rate: int) -> bytes:
        samples = bytearray()
        for sample in audio:
            clipped = max(-1.0, min(1.0, float(sample)))
            samples.extend(int(clipped * 32767).to_bytes(2, byteorder="little", signed=True))
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(bytes(samples))
        return buffer.getvalue()

    def _output_path(self, request: TTSSegmentRequest) -> Path:
        suffix = request.response_format or "wav"
        return self.output_dir / "segments" / f"{request.job_id}-{request.segment_index}-{self.provider_id}.{suffix}"

    def _estimate_duration(self, text: str, speed_factor: float) -> float:
        return max(0.6, len(text.strip()) * 0.12 / max(speed_factor, 0.5))
