from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings, settings
from app.services.tts_types import TTSRoutePlan


@dataclass(frozen=True)
class ProviderHealth:
    edge_capacity_available: bool = True
    kokoro_capacity_available: bool = True
    tencent_capacity_available: bool = True
    aws_capacity_available: bool = True


class TTSRouter:
    def __init__(self, *, settings_: Settings | None = None, paid_user_ids: set[str] | None = None):
        self.settings = settings_ or settings
        self._paid_user_ids = paid_user_ids

    def route_for_user(
        self,
        *,
        user_id: str,
        estimated_characters: int,
        provider_health: ProviderHealth,
        speed_factor: float = 1.0,
    ) -> TTSRoutePlan:
        tier = "paid" if self._is_paid_user(user_id) else "free"
        if tier == "paid":
            return self._paid_route(provider_health=provider_health, speed_factor=speed_factor)
        return self._free_route(provider_health=provider_health, speed_factor=speed_factor)

    def _is_paid_user(self, user_id: str) -> bool:
        paid_user_ids = self._paid_user_ids if self._paid_user_ids is not None else self.settings.paid_user_ids
        return user_id in paid_user_ids

    def _free_route(self, *, provider_health: ProviderHealth, speed_factor: float) -> TTSRoutePlan:
        provider_id = self.settings.tts_default_free_provider
        fallback_provider_id = self.settings.tts_free_fallback_provider

        if provider_id == "edge_tts" and not provider_health.edge_capacity_available:
            provider_id = fallback_provider_id
            fallback_provider_id = None

        if provider_id == "kokoro_onnx_cpu":
            return TTSRoutePlan(
                tier="free",
                provider_id=provider_id,
                model_id="kokoro-82m-onnx-cpu",
                voice_id=self.settings.tts_kokoro_voice,
                speed_factor=speed_factor,
                response_format="wav",
                segment_character_limit=1000,
                segment_byte_limit=10_000,
                max_concurrency=self.settings.tts_kokoro_max_concurrency,
                fallback_provider_id=fallback_provider_id,
                fallback_policy="retry_then_fallback",
            )

        return TTSRoutePlan(
            tier="free",
            provider_id=provider_id,
            model_id="edge-tts",
            voice_id="zh-CN-XiaoxiaoNeural",
            speed_factor=speed_factor,
            response_format="mp3",
            segment_character_limit=1000,
            segment_byte_limit=10_000,
            max_concurrency=self.settings.tts_edge_max_concurrency,
            fallback_provider_id=fallback_provider_id,
            fallback_policy="retry_then_fallback",
        )

    def _paid_route(self, *, provider_health: ProviderHealth, speed_factor: float) -> TTSRoutePlan:
        if provider_health.tencent_capacity_available:
            return TTSRoutePlan(
                tier="paid",
                provider_id=self.settings.tts_default_paid_provider,
                model_id="standard",
                voice_id=self.settings.tts_tencent_voice_type,
                speed_factor=speed_factor,
                response_format=self.settings.tts_tencent_codec,
                segment_character_limit=self.settings.tts_tencent_max_chinese_chars,
                segment_byte_limit=self.settings.tts_tencent_max_english_letters,
                max_concurrency=self.settings.tts_tencent_max_concurrency,
                fallback_provider_id=self.settings.tts_paid_fallback_provider,
                fallback_policy="retry_then_fallback",
            )

        return TTSRoutePlan(
            tier="paid",
            provider_id=self.settings.tts_paid_fallback_provider,
            model_id=self.settings.tts_aws_polly_engine,
            voice_id=self.settings.tts_aws_polly_voice_id,
            speed_factor=speed_factor,
            response_format="mp3",
            segment_character_limit=self.settings.tts_aws_polly_max_characters,
            segment_byte_limit=10_000,
            max_concurrency=self.settings.tts_aws_polly_max_concurrency,
            fallback_provider_id=None,
            fallback_policy="none",
        )
