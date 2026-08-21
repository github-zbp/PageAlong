from __future__ import annotations

import base64
import hashlib
import hmac
import json
import random
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from app.services.tts_types import TTSSegmentRequest, TTSSegmentResult, TTSProviderError, TTSProviderUnavailable


class TencentRealtimeWebSocketClient:
    def __init__(
        self,
        *,
        app_id: str,
        secret_id: str,
        secret_key: str,
        endpoint: str = "tts.cloud.tencent.com",
        path: str = "/stream_ws",
        timeout_seconds: int = 30,
    ):
        self.app_id = app_id
        self.secret_id = secret_id
        self.secret_key = secret_key
        self.endpoint = endpoint
        self.path = path
        self.timeout_seconds = timeout_seconds

    def synthesize(self, payload: dict[str, object]) -> bytes:
        try:
            from websockets.sync.client import connect
        except ImportError as exc:
            raise TTSProviderUnavailable("websockets is required for Tencent realtime TTS") from exc

        url = self.build_signed_url(payload)
        audio_chunks: list[bytes] = []
        try:
            with connect(url, open_timeout=self.timeout_seconds, close_timeout=self.timeout_seconds) as websocket:
                while True:
                    message = websocket.recv(timeout=self.timeout_seconds)
                    if isinstance(message, bytes):
                        audio_chunks.append(message)
                        continue
                    done = self._handle_json_message(message, audio_chunks)
                    if done:
                        break
        except TTSProviderUnavailable:
            raise
        except Exception as exc:
            raise TTSProviderError(str(exc), code="tencent_websocket_error", retryable=True) from exc

        if not audio_chunks:
            raise TTSProviderError("Tencent realtime TTS returned no audio", code="tencent_empty_audio", retryable=True)
        return b"".join(audio_chunks)

    def build_signed_url(
        self,
        payload: dict[str, object],
        *,
        now: int | None = None,
        nonce: int | None = None,
    ) -> str:
        timestamp = int(now if now is not None else time.time())
        params = {
            **payload,
            "AppId": payload.get("AppId") or self.app_id,
            "SecretId": self.secret_id,
            "Timestamp": timestamp,
            "Expired": timestamp + 24 * 60 * 60,
            "Nonce": nonce if nonce is not None else random.randint(1, 2**31 - 1),
        }
        signature = self._signature(params)
        return f"wss://{self.endpoint}{self.path}?{urlencode({**params, 'Signature': signature})}"

    def _signature(self, params: dict[str, object]) -> str:
        query = "&".join(f"{key}={params[key]}" for key in sorted(params))
        source = f"GET{self.endpoint}{self.path}?{query}"
        digest = hmac.new(self.secret_key.encode("utf-8"), source.encode("utf-8"), hashlib.sha1).digest()
        return base64.b64encode(digest).decode("utf-8")

    def _handle_json_message(self, message: str, audio_chunks: list[bytes]) -> bool:
        try:
            payload = json.loads(message)
        except json.JSONDecodeError as exc:
            raise TTSProviderError("Tencent realtime TTS returned invalid JSON", code="tencent_invalid_json") from exc

        code = payload.get("code", payload.get("Code", 0))
        if code not in {0, "0", None}:
            raise TTSProviderError(str(payload.get("message") or payload), code="tencent_response_error", retryable=True)

        result = payload.get("result") or payload.get("Result") or payload
        if isinstance(result, dict):
            audio = result.get("audio") or result.get("Audio") or result.get("data") or result.get("Data")
            if audio:
                audio_chunks.append(base64.b64decode(str(audio)))
            final = result.get("final", result.get("Final", payload.get("final", payload.get("Final"))))
            return final in {1, "1", True, "true", "True"}
        return False


class TencentCloudTTSSegmentProvider:
    provider_id = "tencent_cloud_tts"

    def __init__(
        self,
        *,
        output_dir: Path,
        client: Any | None = None,
        app_id: str = "",
        secret_id: str = "",
        secret_key: str = "",
        voice_type: str = "101001",
        codec: str = "mp3",
        sample_rate: int = 16000,
        timeout_seconds: int = 30,
    ):
        self.output_dir = output_dir
        self.client = client
        self.app_id = app_id
        self.secret_id = secret_id
        self.secret_key = secret_key
        self.voice_type = voice_type
        self.codec = codec
        self.sample_rate = sample_rate
        self.timeout_seconds = timeout_seconds

    def synthesize_segment(self, request: TTSSegmentRequest) -> TTSSegmentResult:
        client = self.client or self._build_client()
        payload = self.build_payload(request)
        output_path = self._output_path(request)
        try:
            audio_bytes = client.synthesize(payload)
        except Exception as exc:
            raise TTSProviderError(str(exc), code="tencent_tts_error", retryable=True) from exc

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(audio_bytes)
        return TTSSegmentResult(
            provider_id=self.provider_id,
            model_id=request.model_id,
            voice_id=request.voice_id or self.voice_type,
            audio_path=output_path,
            duration_seconds=self._estimate_duration(request.text, request.speed_factor),
            character_count=len(request.text),
            byte_size=len(audio_bytes),
            response_format=request.response_format or self.codec,
        )

    def build_payload(self, request: TTSSegmentRequest) -> dict[str, object]:
        return {
            "AppId": self.app_id,
            "Text": request.text,
            "SessionId": f"{request.job_id}:{request.segment_index}",
            "VoiceType": int(request.voice_id or self.voice_type),
            "Codec": request.response_format or self.codec,
            "SampleRate": self.sample_rate,
            "Speed": self._provider_speed(request),
        }

    def build_client(self, *, now: int | None = None, nonce: int | None = None) -> TencentRealtimeWebSocketClient:
        if not self.app_id:
            raise TTSProviderUnavailable("TTS_TENCENT_APP_ID is required for Tencent Cloud TTS")
        if not self.secret_id or not self.secret_key:
            raise TTSProviderUnavailable("TTS_TENCENT_SECRET_ID and TTS_TENCENT_SECRET_KEY are required for Tencent Cloud TTS")
        client = TencentRealtimeWebSocketClient(
            app_id=self.app_id,
            secret_id=self.secret_id,
            secret_key=self.secret_key,
            timeout_seconds=self.timeout_seconds,
        )
        if now is not None or nonce is not None:
            client.build_signed_url({"AppId": self.app_id, "Text": "", "SessionId": "probe"}, now=now, nonce=nonce)
        return client

    def _build_client(self) -> Any:
        self.client = self.build_client()
        return self.client

    def _provider_speed(self, request: TTSSegmentRequest) -> int:
        if request.provider_speed is None:
            return 0
        return int(float(request.provider_speed))

    def _output_path(self, request: TTSSegmentRequest) -> Path:
        suffix = request.response_format or self.codec
        return self.output_dir / "segments" / f"{request.job_id}-{request.segment_index}-{self.provider_id}.{suffix}"

    def _estimate_duration(self, text: str, speed_factor: float) -> float:
        return max(0.6, len(text.strip()) * 0.12 / max(speed_factor, 0.5))
