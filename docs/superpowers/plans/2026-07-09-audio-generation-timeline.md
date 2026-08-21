# Audio Generation Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a playable fake audio asset and sentence timeline for normalized course text.

**Architecture:** Keep text ingestion independent from audio generation. Add an API-side `AudioGenerationService` that owns database writes and TTS provider calls. Keep the worker as orchestration for v1 by calling an internal API endpoint, avoiding cross-package imports between the two existing `app` packages.

**Tech Stack:** FastAPI, SQLAlchemy, Celery, Next.js, TypeScript, pytest, Playwright smoke coverage.

---

### Task 1: Backend Generation Service

**Files:**

- Create: `services/api/app/services/audio_generation_service.py`
- Modify: `services/api/app/core/config.py`
- Test: `services/api/tests/test_audio_generation_service.py`

- [ ] Write failing tests proving generation marks a course ready, writes one audio asset, and updates every sentence timing.
- [ ] Implement `AudioGenerationService.generate_for_job(job_id)` with fake TTS, job status transitions, course status transitions, asset creation, and sentence timeline writes.
- [ ] Run the focused backend service test.

### Task 2: API Job Request And Internal Runner

**Files:**

- Modify: `services/api/app/api/routes/courses.py`
- Create: `services/api/app/api/routes/internal.py`
- Modify: `services/api/app/api/router.py`
- Modify: `services/api/app/worker_client.py`
- Test: `services/api/tests/test_courses_api.py`

- [ ] Write failing API tests proving course creation creates a generation job and moves the course to `audio_generating`.
- [ ] Write a failing API test proving the internal generation endpoint makes the course `ready`.
- [ ] Implement `request_audio_generation` so all future text importers can reuse it.
- [ ] Implement `POST /internal/generation-jobs/{job_id}/run`.
- [ ] Run focused API tests.

### Task 3: Audio Delivery And Player Wiring

**Files:**

- Modify: `services/api/app/schemas/course.py`
- Modify: `services/api/app/api/routes/courses.py`
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/CoursePlayer.tsx`
- Test: `services/api/tests/test_courses_api.py`
- Test: `apps/web/tests/api-url.test.mjs`

- [ ] Write failing tests proving ready courses include an audio URL and the audio endpoint returns the generated file.
- [ ] Add `current_audio_url` to course responses.
- [ ] Add `GET /courses/{course_id}/audio` for the current audio asset.
- [ ] Add frontend type and helper support, then set `<audio src=...>`.
- [ ] Run focused backend and frontend tests.

### Task 4: Worker Orchestration

**Files:**

- Modify: `services/worker/app/tasks/generate_audio.py`
- Test: `services/worker/tests/test_generate_audio_task.py`

- [ ] Write failing worker tests proving the Celery task calls the internal API with `job_id`.
- [ ] Implement the task HTTP callback using the standard library.
- [ ] Run focused worker tests.

### Task 5: Verification

- [ ] Run `make test-api`.
- [ ] Run `cd services/worker && .venv/bin/python -m pytest -q`.
- [ ] Run `cd apps/web && node tests/api-url.test.mjs`.
- [ ] Manually verify one created course can become `ready` and expose audio.

