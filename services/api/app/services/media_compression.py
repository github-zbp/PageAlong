from __future__ import annotations

import hashlib
import subprocess
import tempfile
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any, Callable

from PIL import Image, ImageOps

from app.core.config import Settings, settings


def audio_content_type_for_format(format_name: str) -> str:
    normalized = _normalize_format(format_name)
    if normalized == "mp3":
        return "audio/mpeg"
    if normalized == "wav":
        return "audio/wav"
    if normalized == "m4a":
        return "audio/mp4"
    if normalized == "aac":
        return "audio/aac"
    return f"audio/{normalized or 'mpeg'}"


def image_content_type_for_format(format_name: str) -> str:
    normalized = _normalize_format(format_name)
    if normalized == "jpg":
        return "image/jpeg"
    if normalized == "jpeg":
        return "image/jpeg"
    if normalized == "png":
        return "image/png"
    if normalized == "gif":
        return "image/gif"
    if normalized == "webp":
        return "image/webp"
    return f"image/{normalized or 'webp'}"


def format_for_content_type(content_type: str) -> str:
    normalized = _normalize_content_type(content_type)
    if normalized == "audio/mpeg":
        return "mp3"
    if normalized == "audio/wav":
        return "wav"
    if normalized == "audio/mp4":
        return "m4a"
    if normalized == "image/jpeg":
        return "jpg"
    if normalized == "image/png":
        return "png"
    if normalized == "image/gif":
        return "gif"
    if normalized == "image/webp":
        return "webp"
    if "/" in normalized:
        return normalized.split("/", 1)[1]
    return normalized


@dataclass(frozen=True)
class AudioCompressionResult:
    source_path: Path
    output_path: Path
    format: str
    content_type: str
    original_byte_size: int
    byte_size: int
    checksum_sha256: str
    metadata: dict[str, Any]
    compressed: bool
    fallback_original: bool


@dataclass(frozen=True)
class ImageCompressionResult:
    data: bytes
    format: str
    content_type: str
    original_byte_size: int
    byte_size: int
    checksum_sha256: str
    metadata: dict[str, Any]
    compressed: bool
    fallback_original: bool
    width: int | None
    height: int | None


class MediaCompressionError(RuntimeError):
    def __init__(self, message: str, code: str = "media_compression_failed"):
        super().__init__(message)
        self.code = code


class MediaCompressionService:
    def __init__(
        self,
        settings_: Settings | None = None,
        ffmpeg_runner: Callable[..., Any] | None = None,
    ):
        self.settings = settings_ or settings
        self.ffmpeg_runner = ffmpeg_runner or subprocess.run

    @classmethod
    def from_settings(cls, settings_: Settings | None = None) -> "MediaCompressionService":
        return cls(settings_=settings_ or settings)

    def compress_audio(self, source_path: Path) -> AudioCompressionResult:
        original_bytes = source_path.read_bytes()
        original_format = _normalize_format(source_path.suffix.lstrip(".")) or "wav"
        original_content_type = audio_content_type_for_format(original_format)

        if not self.settings.media_compression_enabled or not self.settings.audio_compression_enabled:
            return self._build_audio_result(
                source_path=source_path,
                output_path=source_path,
                output_bytes=original_bytes,
                original_byte_size=len(original_bytes),
                output_format=original_format,
                content_type=original_content_type,
                status="disabled",
                compressed=False,
                fallback_original=False,
            )

        output_format = _normalize_format(self.settings.audio_compression_format) or "mp3"
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=f".{output_format}",
            prefix=f"{source_path.stem}.compressed-",
            dir=str(source_path.parent),
        ) as handle:
            output_path = Path(handle.name)

        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(source_path),
            "-vn",
            "-ac",
            str(self.settings.audio_compression_channels),
            "-ar",
            str(self.settings.audio_compression_sample_rate),
            "-b:a",
            self.settings.audio_compression_bitrate,
            str(output_path),
        ]

        try:
            self.ffmpeg_runner(
                command,
                check=True,
                capture_output=True,
                text=True,
                timeout=self.settings.media_compression_timeout_seconds,
            )
            if not output_path.exists() or output_path.stat().st_size == 0:
                raise MediaCompressionError("ffmpeg produced no audio output", code="audio_compression_failed")
            output_bytes = output_path.read_bytes()
            return self._build_audio_result(
                source_path=source_path,
                output_path=output_path,
                output_bytes=output_bytes,
                original_byte_size=len(original_bytes),
                output_format=output_format,
                content_type=audio_content_type_for_format(output_format),
                status="compressed",
                compressed=True,
                fallback_original=False,
            )
        except Exception as exc:
            self._cleanup_path(output_path)
            if self.settings.media_compression_failure_mode == "fallback_original":
                return self._build_audio_result(
                    source_path=source_path,
                    output_path=source_path,
                    output_bytes=original_bytes,
                    original_byte_size=len(original_bytes),
                    output_format=original_format,
                    content_type=original_content_type,
                    status="fallback_original",
                    compressed=False,
                    fallback_original=True,
                    error=exc,
                    error_code="audio_compression_failed",
                )
            raise MediaCompressionError(str(exc), code="audio_compression_failed") from exc

    def compress_image(self, content: bytes, content_type: str) -> ImageCompressionResult:
        normalized_content_type = _normalize_content_type(content_type)
        original_format = format_for_content_type(normalized_content_type)

        if not self.settings.media_compression_enabled or not self.settings.image_compression_enabled:
            return self._build_image_result(
                data=content,
                original_byte_size=len(content),
                output_format=original_format,
                content_type=normalized_content_type,
                status="disabled",
                compressed=False,
                fallback_original=False,
            )

        try:
            with BytesIO(content) as input_buffer:
                image = Image.open(input_buffer)
                image.load()

            if self._is_animated_gif(image, normalized_content_type):
                raise MediaCompressionError("animated GIFs are not compressed", code="image_compression_failed")

            normalized_image = ImageOps.exif_transpose(image)
            resized = self._resize_image(normalized_image)
            output_bytes = self._encode_webp(resized)
            if not output_bytes:
                raise MediaCompressionError("image compression produced no output", code="image_compression_failed")
            return self._build_image_result(
                data=output_bytes,
                original_byte_size=len(content),
                output_format="webp",
                content_type=image_content_type_for_format("webp"),
                status="compressed",
                compressed=True,
                fallback_original=False,
                width=resized.width,
                height=resized.height,
            )
        except Exception as exc:
            if self.settings.media_compression_failure_mode == "fallback_original":
                width, height = self._image_size_or_none(content)
                return self._build_image_result(
                    data=content,
                    original_byte_size=len(content),
                    output_format=original_format,
                    content_type=normalized_content_type,
                    status="fallback_original",
                    compressed=False,
                    fallback_original=True,
                    error=exc,
                    error_code="image_compression_failed",
                    width=width,
                    height=height,
                )
            raise MediaCompressionError(str(exc), code="image_compression_failed") from exc

    def _build_audio_result(
        self,
        *,
        source_path: Path,
        output_path: Path,
        output_bytes: bytes,
        original_byte_size: int,
        output_format: str,
        content_type: str,
        status: str,
        compressed: bool,
        fallback_original: bool,
        error: Exception | None = None,
        error_code: str | None = None,
    ) -> AudioCompressionResult:
        byte_size = len(output_bytes)
        metadata = {
            "compression": {
                "enabled": bool(self.settings.media_compression_enabled and self.settings.audio_compression_enabled),
                "status": status,
                "failure_mode": self.settings.media_compression_failure_mode,
                "tool": "ffmpeg",
                "output_format": output_format,
                "content_type": content_type,
                "original_byte_size": original_byte_size,
                "compressed_byte_size": byte_size,
                "ratio": round(byte_size / original_byte_size, 4) if original_byte_size else None,
                "bitrate": self.settings.audio_compression_bitrate,
                "sample_rate": self.settings.audio_compression_sample_rate,
                "channels": self.settings.audio_compression_channels,
            }
        }
        if error is not None:
            metadata["compression"]["error_code"] = error_code or getattr(error, "code", "audio_compression_failed")
            metadata["compression"]["error_message"] = str(error)
        return AudioCompressionResult(
            source_path=source_path,
            output_path=output_path,
            format=output_format,
            content_type=content_type,
            original_byte_size=original_byte_size,
            byte_size=byte_size,
            checksum_sha256=hashlib.sha256(output_bytes).hexdigest(),
            metadata=metadata,
            compressed=compressed,
            fallback_original=fallback_original,
        )

    def _build_image_result(
        self,
        *,
        data: bytes,
        original_byte_size: int,
        output_format: str,
        content_type: str,
        status: str,
        compressed: bool,
        fallback_original: bool,
        error: Exception | None = None,
        error_code: str | None = None,
        width: int | None = None,
        height: int | None = None,
    ) -> ImageCompressionResult:
        byte_size = len(data)
        metadata = {
            "compression": {
                "enabled": bool(self.settings.media_compression_enabled and self.settings.image_compression_enabled),
                "status": status,
                "failure_mode": self.settings.media_compression_failure_mode,
                "tool": "pillow",
                "output_format": output_format,
                "content_type": content_type,
                "original_byte_size": original_byte_size,
                "compressed_byte_size": byte_size,
                "ratio": round(byte_size / original_byte_size, 4) if original_byte_size else None,
                "quality": self.settings.image_compression_quality,
                "max_width": self.settings.image_compression_max_width,
                "max_height": self.settings.image_compression_max_height,
                "width": width,
                "height": height,
            }
        }
        if error is not None:
            metadata["compression"]["error_code"] = error_code or getattr(error, "code", "image_compression_failed")
            metadata["compression"]["error_message"] = str(error)
        return ImageCompressionResult(
            data=data,
            format=output_format,
            content_type=content_type,
            original_byte_size=original_byte_size,
            byte_size=byte_size,
            checksum_sha256=hashlib.sha256(data).hexdigest(),
            metadata=metadata,
            compressed=compressed,
            fallback_original=fallback_original,
            width=width,
            height=height,
        )

    def _resize_image(self, image: Image.Image) -> Image.Image:
        target = image.copy()
        target.thumbnail(
            (
                int(self.settings.image_compression_max_width),
                int(self.settings.image_compression_max_height),
            ),
            Image.Resampling.LANCZOS,
        )
        if target.mode not in {"RGB", "RGBA"}:
            if "A" in target.getbands():
                target = target.convert("RGBA")
            else:
                target = target.convert("RGB")
        return target

    def _encode_webp(self, image: Image.Image) -> bytes:
        output = BytesIO()
        save_kwargs: dict[str, Any] = {
            "format": "WEBP",
            "quality": int(self.settings.image_compression_quality),
            "method": 6,
        }
        if "A" in image.getbands():
            save_kwargs["lossless"] = False
        image.save(output, **save_kwargs)
        return output.getvalue()

    def _is_animated_gif(self, image: Image.Image, content_type: str) -> bool:
        if content_type != "image/gif":
            return False
        return bool(getattr(image, "is_animated", False) and getattr(image, "n_frames", 1) > 1)

    def _image_size_or_none(self, content: bytes) -> tuple[int | None, int | None]:
        try:
            with BytesIO(content) as input_buffer:
                image = Image.open(input_buffer)
                image.load()
                return image.width, image.height
        except Exception:
            return None, None

    def _cleanup_path(self, path: Path) -> None:
        try:
            if path.exists():
                path.unlink()
        except OSError:
            pass


def _normalize_format(value: str) -> str:
    return value.strip().lower().lstrip(".")


def _normalize_content_type(value: str) -> str:
    return value.split(";", 1)[0].strip().lower()
