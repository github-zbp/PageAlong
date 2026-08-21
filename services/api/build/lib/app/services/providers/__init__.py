from __future__ import annotations

from pathlib import Path

from app.core.config import Settings, settings
from app.services.providers.aws_polly_provider import AWSPollySegmentProvider
from app.services.providers.edge_tts_provider import EdgeTTSSegmentProvider
from app.services.providers.kokoro_provider import KokoroOnnxSegmentProvider
from app.services.providers.tencent_provider import TencentCloudTTSSegmentProvider


def build_default_segment_providers(output_dir: Path, settings_: Settings | None = None) -> dict[str, object]:
    config = settings_ or settings
    return {
        "edge_tts": EdgeTTSSegmentProvider(output_dir=output_dir),
        "kokoro_onnx_cpu": KokoroOnnxSegmentProvider(
            output_dir=output_dir,
            model_path=config.tts_kokoro_model_path,
            voices_path=config.tts_kokoro_voices_path or config.tts_kokoro_voice_path,
            voice=config.tts_kokoro_voice,
        ),
        "tencent_cloud_tts": TencentCloudTTSSegmentProvider(
            output_dir=output_dir,
            app_id=config.tts_tencent_app_id,
            secret_id=config.tts_tencent_secret_id,
            secret_key=config.tts_tencent_secret_key,
            voice_type=config.tts_tencent_voice_type,
            codec=config.tts_tencent_codec,
            sample_rate=config.tts_tencent_sample_rate,
            timeout_seconds=config.tts_tencent_timeout_seconds,
        ),
        "aws_polly_standard": AWSPollySegmentProvider(
            output_dir=output_dir,
            region_name=config.tts_aws_region,
            engine=config.tts_aws_polly_engine,
        ),
    }


__all__ = [
    "AWSPollySegmentProvider",
    "EdgeTTSSegmentProvider",
    "KokoroOnnxSegmentProvider",
    "TencentCloudTTSSegmentProvider",
    "build_default_segment_providers",
]
