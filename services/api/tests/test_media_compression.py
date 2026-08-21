from io import BytesIO
from pathlib import Path

from PIL import Image

from app.core.config import settings


def test_audio_content_type_maps_mp3_to_audio_mpeg():
    from app.services.media_compression import audio_content_type_for_format

    assert audio_content_type_for_format("mp3") == "audio/mpeg"
    assert audio_content_type_for_format("wav") == "audio/wav"


def test_compress_audio_uses_ffmpeg_settings_and_records_metadata(tmp_path, monkeypatch):
    from app.services.media_compression import MediaCompressionService

    source = tmp_path / "course.wav"
    source.write_bytes(b"wav-bytes")
    calls: list[list[str]] = []

    def fake_run(cmd, check, capture_output, text, timeout):
        calls.append(cmd)
        output = Path(cmd[-1])
        output.write_bytes(b"mp3-bytes")
        return type("Result", (), {"returncode": 0})()

    monkeypatch.setattr(settings, "media_compression_enabled", True)
    monkeypatch.setattr(settings, "audio_compression_enabled", True)
    monkeypatch.setattr(settings, "media_compression_failure_mode", "strict")
    monkeypatch.setattr(settings, "audio_compression_format", "mp3")
    monkeypatch.setattr(settings, "audio_compression_bitrate", "64k")
    monkeypatch.setattr(settings, "audio_compression_sample_rate", 24000)
    monkeypatch.setattr(settings, "audio_compression_channels", 1)

    service = MediaCompressionService(ffmpeg_runner=fake_run)
    result = service.compress_audio(source)

    assert calls[0][0] == "ffmpeg"
    assert result.output_path.suffix == ".mp3"
    assert result.content_type == "audio/mpeg"
    assert result.byte_size == len(b"mp3-bytes")
    assert result.metadata["compression"]["status"] == "compressed"


def test_compress_audio_falls_back_to_original_when_ffmpeg_fails(tmp_path, monkeypatch):
    from app.services.media_compression import MediaCompressionService

    source = tmp_path / "course.wav"
    source.write_bytes(b"wav-bytes")

    def failing_run(*args, **kwargs):
        raise RuntimeError("ffmpeg missing")

    monkeypatch.setattr(settings, "media_compression_enabled", True)
    monkeypatch.setattr(settings, "audio_compression_enabled", True)
    monkeypatch.setattr(settings, "media_compression_failure_mode", "fallback_original")

    service = MediaCompressionService(ffmpeg_runner=failing_run)
    result = service.compress_audio(source)

    assert result.output_path == source
    assert result.content_type == "audio/wav"
    assert result.metadata["compression"]["status"] == "fallback_original"
    assert result.metadata["compression"]["error_code"] == "audio_compression_failed"


def test_compress_image_transcodes_to_webp_and_strips_metadata(monkeypatch):
    from app.services.media_compression import MediaCompressionService

    raw = BytesIO()
    image = Image.new("RGBA", (2400, 1200), (255, 0, 0, 128))
    image.save(raw, format="PNG")

    monkeypatch.setattr(settings, "media_compression_enabled", True)
    monkeypatch.setattr(settings, "image_compression_enabled", True)
    monkeypatch.setattr(settings, "media_compression_failure_mode", "strict")
    monkeypatch.setattr(settings, "image_compression_format", "webp")
    monkeypatch.setattr(settings, "image_compression_quality", 80)
    monkeypatch.setattr(settings, "image_compression_max_width", 1600)
    monkeypatch.setattr(settings, "image_compression_max_height", 1600)

    service = MediaCompressionService()
    result = service.compress_image(raw.getvalue(), "image/png")

    assert result.content_type == "image/webp"
    assert result.data != raw.getvalue()
    assert result.metadata["compression"]["status"] == "compressed"
    assert result.metadata["compression"]["width"] == 1600
    assert result.metadata["compression"]["height"] == 800


def test_compress_image_falls_back_to_original_for_animated_gif(monkeypatch):
    from app.services.media_compression import MediaCompressionService

    frames = [
        Image.new("RGBA", (32, 32), (255, 0, 0, 255)),
        Image.new("RGBA", (32, 32), (0, 255, 0, 255)),
    ]
    raw = BytesIO()
    frames[0].save(raw, format="GIF", save_all=True, append_images=[frames[1]], duration=10, loop=0)

    monkeypatch.setattr(settings, "media_compression_enabled", True)
    monkeypatch.setattr(settings, "image_compression_enabled", True)
    monkeypatch.setattr(settings, "media_compression_failure_mode", "fallback_original")

    service = MediaCompressionService()
    result = service.compress_image(raw.getvalue(), "image/gif")

    assert result.content_type == "image/gif"
    assert result.data == raw.getvalue()
    assert result.metadata["compression"]["status"] == "fallback_original"
    assert result.metadata["compression"]["error_code"] == "image_compression_failed"
