# Audio Generation Timeline Design

## Goal

Turn any already-normalized course text into a generated audio asset and sentence timeline. This v1 uses the existing fake TTS provider to prove the product flow before integrating real TTS engines.

## Scope

In scope:

- Generate an audio file from the current `ArticleText` and `Sentence` rows for a course.
- Persist one current `AudioAsset`.
- Write `audio_start_seconds` and `audio_end_seconds` back to each sentence.
- Move course status through `audio_generating`, `ready`, or `failed`.
- Track a `GenerationJob` for the audio generation request.
- Expose a course audio URL that the H5 player can use.

Out of scope:

- Real TTS providers.
- PDF, Word, Markdown, EPUB, MOBI, AZW, DOCX, or URL extraction.
- Authentication changes.
- Billing, quota, or provider selection UI.

## Architecture

Text ingestion and audio generation remain separate. Future importers only need to create a course, an `ArticleText` version, and ordered `Sentence` rows. They then request audio generation through the same course-level generation entry point.

The generation boundary is:

```text
ArticleText + Sentence[] -> AudioGenerationService -> TTSProvider -> AudioAsset + sentence timeline
```

The Celery worker remains an orchestration layer. For this v1, the worker calls an internal API endpoint to run generation inside the API service, where the database models and existing fake TTS provider already live. This avoids duplicating model code across the current `services/api/app` and `services/worker/app` packages, which both use the Python package name `app`.

## Data Flow

1. `POST /courses` creates the course text and sentence rows.
2. API creates a `GenerationJob` with `pending` status and marks the course `audio_generating`.
3. API enqueues Celery with `course_id` and `job_id`.
4. Worker calls `POST /internal/generation-jobs/{job_id}/run`.
5. API loads the course, latest article text, and sentences.
6. `FakeTTSProvider` writes a WAV file under ignored local storage.
7. API creates an `AudioAsset`, updates sentence timings, marks the course `ready`, and marks the job `succeeded`.
8. Frontend renders an `<audio>` element with the course audio URL.

## Future Importer Contract

PDF, doc, markdown, epub, mobi, azw, docx, and URL importers must not call TTS directly. They should produce normalized text, store it as `ArticleText`, create ordered `Sentence` rows, then request audio generation through the same job creation function.

