# Media Compression Design

Date: 2026-08-01

## Goal

Reduce R2 storage and transfer cost while keeping mobile listening and reading quality acceptable. Compression is the default media pipeline for generated audio and imported article images. Original audio/image files are treated as temporary inputs, not long-term assets.

This design also leaves a narrow path for future video compression without introducing a generic media platform too early.

## Current Context

- Audio generation is triggered by the existing Celery worker task, which currently calls the API CLI (`app.cli.generate_audio`) to run `AudioGenerationService`.
- `AudioGenerationService` creates the final course audio file, records an `AudioAsset`, and uploads to S3-compatible storage when `TTS_STORAGE_BACKEND` is `s3`, `minio`, or `r2`.
- URL import downloads article images in `import_article_images()`, uploads them through `ObjectStorageService`, creates `ArticleImageAsset`, and rewrites Markdown image URLs.
- Object storage already abstracts local and S3-compatible backends, including R2.
- Existing reader/API behavior only needs playable/renderable URLs, so compression metadata can remain backend-facing for now.

## Scope

In scope:

- Compress final generated course audio before `AudioAsset` is finalized and before R2 upload.
- Compress URL-imported article images locally before `ArticleImageAsset` is finalized and before R2 upload.
- Add configuration switches for enabling compression and controlling failure behavior.
- Record enough metadata to audit size savings and compression fallback.
- Keep local development working.

Out of scope:

- Preserving original audio/image files as durable assets.
- CDN image transformation.
- Multiple responsive image variants.
- User-facing compression controls.
- Real video import/transcoding implementation.
- Authentication, billing, or observability platform changes.

## Recommended Approach

Use upload-before-compression only as a rejected fallback pattern. The production path should be:

```text
temporary source media -> local compression -> asset metadata -> object storage upload -> render/playback URL
```

This keeps object storage free of avoidable original files and keeps Markdown/audio URLs stable.

## Compression Failure Modes

Compression failure behavior is configurable because audio and images have different product impact.

Add a shared mode:

```text
MEDIA_COMPRESSION_FAILURE_MODE=strict | fallback_original
```

Recommended defaults:

- Code default: `strict`
- Local/dev should explicitly override to `fallback_original` when easier iteration matters more than storage savings.

Mode behavior:

- `strict`: do not upload the original file when compression fails.
- `fallback_original`: upload the original temporary file/bytes, mark the asset as uncompressed fallback, and keep the job/import moving.

Audio-specific behavior:

- In `strict`, audio compression failure fails the TTS generation job. The course should not become `ready` with a large uncompressed asset.
- In `fallback_original`, audio compression failure uploads the original generated file, records fallback metadata, and the generation job can succeed.

Image-specific behavior:

- In `strict`, image compression failure skips that image and records/counts the failure. The URL import job still succeeds if text extraction succeeded.
- In `fallback_original`, image compression failure uploads the original downloaded image, records fallback metadata, and rewrites Markdown to the uploaded original image.

This preserves the existing rule that individual image failures are non-fatal, while allowing audio to be strict by default.

## Configuration

Add settings with conservative defaults:

```text
MEDIA_COMPRESSION_ENABLED=true
MEDIA_COMPRESSION_FAILURE_MODE=strict

AUDIO_COMPRESSION_ENABLED=true
AUDIO_COMPRESSION_FORMAT=mp3
AUDIO_COMPRESSION_BITRATE=64k
AUDIO_COMPRESSION_SAMPLE_RATE=24000
AUDIO_COMPRESSION_CHANNELS=1

IMAGE_COMPRESSION_ENABLED=true
IMAGE_COMPRESSION_FORMAT=webp
IMAGE_COMPRESSION_QUALITY=80
IMAGE_COMPRESSION_MAX_WIDTH=1600
IMAGE_COMPRESSION_MAX_HEIGHT=1600
```

Notes:

- `MEDIA_COMPRESSION_ENABLED=false` disables both audio and image compression unless a specific media type override is later added.
- Audio bitrate can be lowered to `48k` for a more aggressive free-tier profile, but `64k` is the safer default for mobile course listening.
- Image quality `80` and max long edge `1600px` are a good starting point for article reading on mobile and normal desktop.

## Audio Design

Compression should run as part of the existing worker-triggered generation job. Because the worker currently delegates to the API CLI, the compression code should live next to `AudioGenerationService` instead of duplicating database/model code inside `services/worker`.

Audio flow:

1. TTS provider generates one or more segment files.
2. `AudioGenerationService` combines segments into a final temporary file.
3. `MediaCompressionService.compress_audio()` runs `ffmpeg` against the final file when enabled.
4. The service returns the selected upload file and metadata.
5. `AudioAsset` is created/finalized using the compressed file's format, content type, byte size, checksum, and metadata.
6. The selected file is uploaded to local/S3-compatible storage.
7. Temporary source/intermediate files remain local scratch data and are not durable product assets.

Audio command profile:

```text
ffmpeg -y -i input -vn -ac 1 -ar 24000 -b:a 64k output.mp3
```

Implementation notes:

- Use `subprocess.run(..., check=True, capture_output=True)` with a timeout.
- Write compressed output to a separate temporary path first.
- Only replace/select the compressed path after the output exists and has non-zero size.
- Use `audio/mpeg` for MP3 rather than `audio/mp3`.
- If the source is already an MP3 below the configured bitrate and has acceptable sample/channel settings, the implementation may skip recompression later, but v1 can always normalize through ffmpeg for simpler behavior.

## Image Design

Image compression runs inside URL image import after download and content-type validation, before object key selection and upload.

Image flow:

1. Resolve and download eligible image.
2. Validate content type and size against existing image import limits.
3. Decode image locally.
4. Strip EXIF/metadata.
5. Resize to fit configured max width/height without upscaling.
6. Encode to WebP at configured quality.
7. Build object key from the compressed bytes checksum and extension.
8. Upload compressed bytes and create `ArticleImageAsset`.
9. Rewrite Markdown to the uploaded image URL or local image route.

Static image profile:

- Input: JPEG, PNG, WebP.
- Output: WebP.
- Quality: `80`.
- Max dimensions: `1600x1600`.
- Strip metadata.
- Preserve alpha for transparent PNG/WebP when WebP output supports it.

GIF behavior:

- Animated GIF compression is not part of v1.
- In `strict`, unsupported animated GIFs are skipped and counted as image failures.
- In `fallback_original`, unsupported animated GIFs can be uploaded unchanged.

This avoids silently converting animations to broken still images.

## Metadata

Do not expose compression metadata in `CourseRead` yet. Store it for audit/debugging.

For audio, use `AudioAsset.metadata_json`:

```json
{
  "compression": {
    "enabled": true,
    "status": "compressed",
    "failure_mode": "strict",
    "tool": "ffmpeg",
    "output_format": "mp3",
    "original_byte_size": 1234567,
    "compressed_byte_size": 456789,
    "ratio": 0.37,
    "bitrate": "64k",
    "sample_rate": 24000,
    "channels": 1
  }
}
```

For fallback uploads:

```json
{
  "compression": {
    "enabled": true,
    "status": "fallback_original",
    "failure_mode": "fallback_original",
    "error_code": "audio_compression_failed",
    "error_message": "ffmpeg exited with code 1"
  }
}
```

For images, add `ArticleImageAsset.metadata_json` so each image carries its own width, height, output format, compression status, and fallback reason.

## Future Video Extension

Do not implement video compression now, but keep the compression boundary reusable:

```text
MediaCompressionService
  compress_audio(...)
  compress_image(...)
  compress_video(...)  # future
```

Future video should use ffmpeg with a separate queue/profile because CPU time and failure impact will be much higher than audio/image. Video should likely require explicit product scope before enabling automatic import.

## Error Handling

- Missing compression dependency should be treated as compression failure.
- `strict` mode should fail audio jobs and skip individual images.
- `fallback_original` mode should upload original media and record fallback metadata.
- Object upload failure remains separate from compression failure:
  - Audio upload failure fails the generation job.
  - Image upload failure skips that image unless a later retry system is introduced.
- Compression should never mutate source Markdown or asset rows until an upload candidate is selected.

## Tests

Backend tests:

- Audio generation uploads compressed output when compression is enabled.
- `AudioAsset.format`, `content_type`, `byte_size`, `object_key`, and `metadata_json` reflect compressed MP3 output.
- Audio strict mode fails the generation job when compression fails.
- Audio fallback mode uploads original output and marks metadata as `fallback_original`.
- Image import uploads compressed bytes and rewrites Markdown to the compressed asset URL.
- Image strict mode skips failed/unsupported images without failing URL text import.
- Image fallback mode uploads original bytes when compression fails.
- Compression disabled mode preserves current behavior.

Worker tests:

- Existing worker task still invokes API CLI for audio generation.
- No duplicated database/model work is introduced in `services/worker`.

Manual/local checks:

- Verify `ffmpeg` is available in the worker/API CLI runtime used by the worker.
- Verify local MinIO/R2-compatible upload stores compressed object keys and content types.
