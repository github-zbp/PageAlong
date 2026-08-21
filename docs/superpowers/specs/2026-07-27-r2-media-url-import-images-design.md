# R2 Media and URL Import Images Design

Date: 2026-07-27

## Goal

Store generated course audio and URL-imported article images in S3-compatible object storage for production, with Cloudflare R2 as the first production target, while keeping local development usable without external storage.

## Current State

- `AudioAsset` already has object-storage metadata fields, but audio generation still records generated files as `local`.
- The audio read endpoint can read `s3`/`minio` objects, but production should prefer direct public media URLs when available.
- URL extraction disables image preservation.
- `ArticleText.content_markdown` is the reader source of truth, and TTS text derivation already strips Markdown image syntax.
- `MarkdownReader` currently reduces Markdown image syntax to alt text instead of rendering images.

## Architecture

Add a small API-side object storage abstraction for local and S3-compatible backends. `s3`, `minio`, and `r2` all use the existing S3-compatible settings and `boto3`; `local` keeps writing files to ignored local storage.

Generated audio keeps its current synthesis flow. After the final course-level audio file is available, the service uploads it when `TTS_STORAGE_BACKEND` is `s3`, `minio`, or `r2`, writes the object metadata to `AudioAsset`, and exposes a direct public URL when a media public base URL is configured. Without a public base URL, the existing `/courses/{course_id}/audio` endpoint remains the fallback.

URL import stores images as article image assets. Extraction keeps Markdown image references, then the import service resolves relative image URLs against the final page URL, downloads eligible public images, uploads them, and rewrites Markdown image URLs to renderable media URLs. Image failures are non-fatal: successful text extraction still creates a reviewable course.

## Data Model

Add `ArticleImageAsset` for URL-imported images:

- `course_id`
- `article_text_id`
- `source_url`
- `alt_text`
- `storage_backend`
- `bucket`
- `object_key`
- `object_path`
- `content_type`
- `byte_size`
- `checksum_sha256`
- `status`
- `error_code`
- `error_message`
- `created_at`

The table is narrow and article-specific. A generic media table can replace it later if uploads, covers, avatars, or user media need the same lifecycle.

## URL Import Rules

- Keep only Markdown image references found in the readable article body.
- Resolve relative image URLs with `urljoin(final_url, image_url)`.
- Validate each image URL as public HTTP(S) before downloading.
- Limit imported images to 20 per article.
- Limit each image response to 8 MB.
- Allow `image/jpeg`, `image/png`, `image/webp`, and `image/gif`.
- Deduplicate object keys by SHA-256 content hash.
- Leave TTS text image-free through the existing Markdown normalization path.

## Reader Behavior

`MarkdownReader` renders Markdown images as responsive image blocks with alt text preserved for accessibility. Images do not participate in sentence matching, highlighting, or click-to-seek.

## Error Handling

- Object upload failure for generated audio fails the audio generation job, because the course cannot reliably play the generated audio.
- Individual URL image fetch/upload failures are recorded or counted in extraction metadata and omitted from the rewritten Markdown.
- URL text extraction failures continue to fail the import job as they do today.

## Testing

Backend tests cover audio upload metadata, object-storage audio URL serialization, URL import image download/upload/rewrite, image failure tolerance, and TTS text staying image-free.

Frontend tests cover Markdown image rendering and existing course flow behavior.
