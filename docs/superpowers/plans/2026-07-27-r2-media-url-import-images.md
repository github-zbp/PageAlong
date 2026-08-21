# R2 Media and URL Import Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store generated audio and URL-imported article images in S3-compatible object storage, then render imported images in the reader.

**Architecture:** Add a small object storage service, persist article image assets, upload final audio and imported images through the same storage boundary, and expose direct public media URLs when configured. Local mode remains available for development and tests.

**Tech Stack:** FastAPI, SQLAlchemy, boto3, httpx, trafilatura/readability, Next.js 13, React 18, Playwright.

---

### Task 1: Object Storage Boundary

**Files:**
- Create: `services/api/app/services/object_storage.py`
- Modify: `services/api/app/core/config.py`

- [ ] Write failing tests for S3-compatible uploads returning backend, bucket, object key, URL, byte size, content type, ETag, and checksum.
- [ ] Implement `StoredObject`, `ObjectStorageService`, local file copy, S3-compatible `put_object`, public URL construction, and cache-control metadata.
- [ ] Run the focused storage tests.

### Task 2: Audio Upload Integration

**Files:**
- Modify: `services/api/app/services/audio_generation_service.py`
- Modify: `services/api/app/api/routes/courses.py`
- Test: `services/api/tests/test_audio_generation_service.py`
- Test: `services/api/tests/test_tts_api.py`

- [ ] Replace the existing test that expects configured S3 storage to remain local with a failing test that expects object metadata.
- [ ] Upload final legacy and segmented audio when `TTS_STORAGE_BACKEND` is `s3`, `minio`, or `r2`.
- [ ] Serialize `current_audio_url` as a public object URL when available, otherwise keep the existing API audio endpoint.
- [ ] Keep `/courses/{course_id}/audio` as local/proxy fallback and include `r2` in object-storage fallback handling.

### Task 3: Article Image Assets and Import Rewrite

**Files:**
- Modify: `services/api/app/models/course.py`
- Modify: `services/api/app/models/__init__.py`
- Modify: `services/api/app/services/web_extraction.py`
- Create: `services/api/app/services/article_image_import.py`
- Modify: `services/api/app/services/url_import_service.py`
- Test: `services/api/tests/test_web_extraction.py`
- Test: `services/api/tests/test_url_import_service.py`
- Test: `services/api/tests/test_models.py`

- [ ] Add a failing model test for `ArticleImageAsset` defaults.
- [ ] Add failing URL import tests for image URL resolution, upload, Markdown rewrite, and non-fatal image failure.
- [ ] Enable extractor image preservation.
- [ ] Implement Markdown image parsing/rewrite, public URL validation, limited image download, type filtering, object upload, and asset persistence.
- [ ] Update extraction metadata with imported/skipped image counts.

### Task 4: Reader Image Rendering

**Files:**
- Modify: `apps/web/src/components/MarkdownReader.tsx`
- Modify: `apps/web/tests/course-flow.spec.ts`

- [ ] Add a failing Playwright expectation for an imported Markdown image rendering as an image.
- [ ] Extend the lightweight Markdown parser with image blocks.
- [ ] Render responsive images with accessible alt text and no sentence mapping.
- [ ] Keep existing sentence highlighting and list/code rendering intact.

### Task 5: Config and Verification

**Files:**
- Modify: `.env.example`
- Modify: `docs/local-development.md` only if needed for new storage variables.

- [ ] Document the new public media URL setting without changing local port defaults.
- [ ] Run `make test-api`.
- [ ] Run `make test-web`.
- [ ] Run `cd apps/web && npm run build` if route/API URL handling changed.
