# Real TTS Multi-Provider Routing Design

## Goal

Add real text-to-speech generation to PageAlong while keeping cost, stability, and provider routing under platform control.

The feature must route different users and environments to different TTS providers:

- Free tier: `edge-tts` first, then `Kokoro-82M ONNX CPU` when `edge-tts` fails after retry.
- Paid tier: Tencent Cloud Text-to-Speech first, then AWS Polly Standard when Tencent fails after retry or the Tencent concurrency budget is full.
- Tests: the existing fake TTS provider remains available only for deterministic automated tests.

This design upgrades the current fake-audio flow without claiming URL import, file upload, OCR, authentication, payment, or production observability are already available.

## Scope

In scope:

- Provider abstraction for real TTS engines and cloud APIs.
- Tier-aware routing for local development and production.
- Provider-level retry, concurrency gates, and fallback.
- Long-text segmentation, per-segment persistence, resume, and final audio assembly.
- Character usage and estimated cost ledger for quota and future billing.
- API/worker integration with the current `GenerationJob`, `AudioAsset`, and sentence timeline flow.
- Focused backend and worker tests for routing, failure recovery, and usage accounting.

Out of scope for this spec:

- Real authentication, payment, subscription checkout, or invoice collection.
- User-facing provider selection UI.
- Voice cloning, custom voice training, or user-uploaded voice samples.
- URL import, file upload, OCR, or document parsing.
- Public sharing of generated audio.

## Current Project Context

The current backend already has the core generation boundary:

```text
ArticleText + Sentence[] -> AudioGenerationService -> TTSProvider -> AudioAsset + sentence timeline
```

The current implementation uses `FakeTTSProvider` inside the API service. Celery worker tasks call an internal API endpoint, and the API service owns database writes. That was acceptable for fake audio, but it is not acceptable for real long-form TTS because a course can take several minutes and the current worker HTTP call has a 300-second timeout.

The target real-TTS implementation moves long-running orchestration into the worker. The API creates jobs, exposes job state, serves audio, and protects internal/debug endpoints. The worker claims jobs from Celery, runs the generation orchestrator directly, writes segment/job state, and resumes from persisted segment rows after failure. To avoid duplicating model and service code between the current `services/api/app` and `services/worker/app` packages, the implementation should extract shared TTS orchestration, storage, routing, and database access helpers into an importable backend module used by both API and worker.

The new design keeps text ingestion and audio generation separate. Any future importer only needs to create `Course`, `ArticleText`, and ordered `Sentence` rows, then request audio generation through the same job entry point.

## Provider Decisions

### Free Tier Providers

Free generation uses a best-effort chain:

```text
edge_tts -> retry edge_tts -> kokoro_onnx_cpu
```

`edge-tts` is an open-source Python library that calls Microsoft Edge online TTS voices. It does not provide the same product contract as Azure Speech. The implementation must treat it as an unstable best-effort provider:

- Always set short request timeouts.
- Keep a provider-level circuit breaker.
- Do not block API requests while it runs.
- Keep it behind `TTS_EDGE_ENABLED` so production can disable it without code changes.
- Fall back to Kokoro when retry fails, timeout occurs, or the circuit is open.

`Kokoro-82M ONNX CPU` is the self-hosted free fallback. It must run through ONNX Runtime CPU, with model path and quantization configured by environment variables. It should not require a GPU.

### Paid Tier Providers

Paid generation uses a cost-optimized cloud chain:

```text
tencent_cloud_tts -> retry tencent_cloud_tts -> aws_polly_standard
```

Tencent Cloud is the primary paid provider for Chinese content and cost control. AWS Polly Standard is the fallback when Tencent fails after retry or when the Tencent concurrency budget is already full.

Provider fallback is course-level by default. A final `AudioAsset` should not mix Tencent-generated segments and AWS-generated segments unless an explicit emergency setting enables mixed-provider output. If Tencent fails halfway through a course and fallback is required, the orchestrator discards the partial Tencent output for that job attempt and regenerates the whole course with AWS Polly Standard. This preserves voice consistency and avoids a jarring course playback experience.

### Test Provider

`FakeTTSProvider` remains available for tests and local smoke checks. It is not a real TTS feature and must not be presented in product copy as generated speech.

## Provider Compliance And Launch Policy

Provider availability must be explicit. A provider can be present in code without being eligible for production traffic.

| Provider | Launch policy | Notes |
| --- | --- | --- |
| `fake` | Test/dev only | deterministic test provider; never counts as real generated speech |
| `edge_tts` | Free-tier beta, feature-flagged | unofficial best-effort provider; production traffic is allowed only behind `TTS_EDGE_ENABLED` and a global kill switch |
| `kokoro_onnx_cpu` | Production free fallback | self-hosted CPU provider; required whenever `edge_tts` is enabled in production |
| `tencent_cloud_tts` | Production paid primary | requires Tencent `AppId`, `SecretId`, `SecretKey`, region, voice, codec, and sample-rate configuration |
| `aws_polly_standard` | Production paid fallback | use `Engine=standard`; pricing and quotas remain configurable |

Launch rules:

- `TTS_PROVIDER_MODE=fake` forces the fake provider and is allowed only in tests and local smoke checks.
- `TTS_PROVIDER_MODE=real` requires all providers needed by the selected route to be configured and fails fast if credentials or model assets are missing.
- `TTS_PROVIDER_MODE=auto` follows the routing matrix and allows local/test fallbacks, but production still requires real configured providers.
- If `edge_tts` is disabled or its circuit breaker is open, free users go directly to Kokoro.
- Paid production traffic must never fall back to free providers. If both Tencent and AWS are unavailable, the job fails without consuming free-tier capacity.

## Routing Rules

Add `TTSRouter` in `services/api/app/services/tts_router.py`.

The router input is:

- `user_id`
- `course_id`
- `article_text_id`
- normalized language hint, derived from text when no explicit value exists
- requested voice and speed, defaulting from settings
- estimated billable characters
- environment mode: local/test/production
- entitlement tier: free/paid
- provider health and concurrency state

The router output is a `TTSRoutePlan`:

- `tier`: `free` or `paid`
- `provider_id`
- `model_id`
- `voice_id`
- `speed_factor`
- `response_format`
- `segment_character_limit`
- `segment_byte_limit`
- `max_concurrency`
- `fallback_provider_id`
- `fallback_policy`

Routing matrix:

| Context | Free route | Paid route |
| --- | --- | --- |
| Automated tests | `fake` | `fake` unless provider tests explicitly stub cloud clients |
| Local dev without provider keys | `edge_tts`, fallback `kokoro_onnx_cpu`; fake allowed by explicit test setting only | return clear config error or use fake only under test override |
| Local dev with provider keys | same as production free | Tencent, fallback AWS |
| Production | `edge_tts`, fallback `kokoro_onnx_cpu` | Tencent, fallback AWS |

Temporary entitlement resolution:

- Until authentication and payment exist, use the existing `X-User-Id` user identity and a local entitlement resolver.
- `TTS_PAID_USER_IDS` can mark local/test users as paid.
- A small `user_entitlements` table can be introduced for production readiness.
- Future payment integration should replace only `EntitlementResolver`, not the router or generation orchestrator.

## Provider Interface

Replace the narrow fake provider interface with a provider-neutral contract:

```text
TTSProvider.synthesize_segment(request) -> SegmentSynthesisResult
```

Request fields:

- `job_id`
- `course_id`
- `section_id`
- `segment_id`
- `segment_index`
- `text`
- `language_code`
- `voice_id`
- `speed_factor`
- `response_format`
- `sample_rate_hz`
- `idempotency_key`
- `timeout_seconds`

Result fields:

- `provider_id`
- `model_id`
- `audio_path`
- `duration_seconds`
- `billable_characters`
- `input_bytes`
- `provider_request_id`
- `raw_metadata`

Provider implementations:

- `EdgeTTSProvider`
- `KokoroOnnxProvider`
- `TencentTTSProvider`
- `AwsPollyStandardProvider`
- `FakeTTSProvider`

Provider classes must not write course, job, or usage rows directly. They only synthesize segment audio and return metadata. The orchestrator owns persistence.

## Provider Parameter Mapping

The product should use normalized user-facing parameters and let provider adapters translate them into provider-specific API parameters.

Normalized request fields:

- `language_code`: normalized BCP-47-style hint such as `zh-CN` or `en-US`.
- `voice_id`: internal voice slug selected from a platform voice catalog.
- `speed_factor`: user-facing playback/synthesis speed such as `0.8`, `1.0`, `1.25`, `1.5`, or `2.0`.
- `response_format`: normalized output format, default `mp3`.
- `sample_rate_hz`: requested provider output sample rate when the provider supports it.

Provider mapping:

| Provider | Voice mapping | Speed mapping | Format/sample-rate mapping | Text limit mapping |
| --- | --- | --- | --- | --- |
| `edge_tts` | internal voice slug maps to Edge voice name such as a `zh-CN-*` voice | convert `speed_factor` to Edge `rate` percentage, for example `1.25` -> `+25%`; clamp to provider-supported values | adapter saves provider output and normalizes final segment to MP3 if needed | use conservative best-effort limits because service behavior is not contractual |
| `kokoro_onnx_cpu` | internal voice slug maps to local Kokoro voice asset | pass float speed when supported; otherwise clamp to nearest supported local value | generate local WAV/PCM and transcode to final MP3 during assembly | local limit is configured for CPU responsiveness, not provider API limits |
| `tencent_cloud_tts` | internal voice slug maps to Tencent `VoiceType` | map `speed_factor` to Tencent `Speed` integer in `[-2, 6]`; never send a raw multiplier | use `Codec` and `SampleRate` from settings; default production target is MP3 | Chinese source text must stay below Tencent's 600 Chinese-character maximum; use a conservative default of 560 Chinese characters per segment |
| `aws_polly_standard` | internal voice slug maps to AWS `VoiceId` and language | use SSML `<prosody rate>` only if required; otherwise generate at normal speed and let the player handle playback speed | use `Engine=standard`, `OutputFormat=mp3`; sample rate stays configurable | keep below AWS `SynthesizeSpeech` synchronous limits with a conservative 2500 billed-character cap |

Tencent speed mapping starts with the MVP playback speeds:

| Product speed | Tencent `Speed` |
| ---: | ---: |
| `0.8x` | `-1` |
| `1.0x` | `0` |
| `1.25x` | `2` |
| `1.5x` | `4` |
| `2.0x` | `6` |

The Tencent adapter must clamp any custom value into `[-2, 6]` and record the actual provider speed in segment metadata.

## Job Execution Model

Real TTS jobs are long-running worker jobs. The API must not execute full-course synthesis inside an HTTP request/response cycle.

Execution rules:

1. API creates `GenerationJob` rows and enqueues `generate_audio_for_course(course_id, job_id)`.
2. Worker claims the job with a Redis lease keyed by `job_id`.
3. Worker runs the shared `AudioGenerationOrchestrator` directly, not through `urlopen(..., timeout=300)`.
4. Worker writes `GenerationJob.last_heartbeat_at` every 30 seconds and after each segment.
5. Worker commits segment state after each segment, not only at the end of the whole course.
6. If a worker dies, the Redis lease expires and a later worker resumes from persisted `TTSSegment` rows.
7. Internal API debug/admin endpoints can still exist, but production worker execution must not depend on waiting for a long-running internal API call.

Required job fields for recovery:

- `locked_by`
- `lock_token`
- `last_heartbeat_at`
- `lease_expires_at`

The old internal-run HTTP path is a transition/debug path only. It must be protected by per-request HMAC signatures and must not be the normal production generation path.

## Course Sections vs TTS Segments

The product course structure and provider request structure are separate.

`CourseSection` is user-facing:

- Represents a 5-10 minute learning section.
- Has a generated or derived section title.
- Owns an ordered range of sentences.
- Drives player navigation such as previous section and next section.

`TTSSegment` is provider-facing:

- Represents one provider synthesis request.
- Defaults to one sentence per segment for accurate sentence timing.
- Can split one oversized sentence into multiple provider-safe segments.
- Is not exposed directly in the player UI.

Initial sectioning can be deterministic and lightweight:

1. Estimate duration from sentence character counts and language.
2. Group sentences into sections targeting 5-10 minutes.
3. Use the first meaningful sentence or article title plus section index as the temporary section title.
4. Store sentence-to-section mapping before TTS starts.
5. After final audio duration is known, update section start/end times from sentence timings.

This preserves the MVP's course feel while keeping provider calls small and recoverable.

## Long Text Segmentation

The orchestrator must never send a full article to a cloud API in one request.

Segmentation algorithm:

1. Load ordered `Sentence` rows for the current article text.
2. Create one segment per sentence by default.
3. Split an oversized single sentence only when it exceeds configured character or byte limits.
4. Generate one audio file per segment.
5. Measure each segment duration.
6. Concatenate segment audio into one final MP3.
7. Write sentence `audio_start_seconds` and `audio_end_seconds` from measured segment boundaries.

This preserves sentence-level highlighting without depending on provider speech marks. A future optimization can group adjacent short sentences, but that must be opt-in because it makes sentence timing approximate.

Default limits:

| Provider | Segment character limit | Segment byte limit | Reason |
| --- | ---: | ---: | --- |
| `edge_tts` | 800 | 3000 | keep requests small because the service is unofficial and best effort |
| `kokoro_onnx_cpu` | 1200 | 6000 | CPU generation should remain responsive and resumable |
| `tencent_cloud_tts` | 560 Chinese characters or 1600 English letters | 3000 | below Tencent realtime limits of 600 Chinese characters or 1800 English letters |
| `aws_polly_standard` | 2500 billed characters | 5000 total characters | below AWS Polly synchronous input limits |

These limits are settings, not constants. Production can tune them after real latency and failure data.

Text too long policy:

- Free tier can auto-generate only up to `FREE_TTS_MAX_COURSE_CHARACTERS`.
- Paid tier can auto-generate up to `PAID_TTS_MAX_AUTO_CHARACTERS`.
- Above the paid auto limit, the API should create the course as `text_ready` and require a future explicit confirmation endpoint before spending paid TTS budget.
- Since the current product has no confirmation UI, this first implementation should reject auto-generation above the configured max and keep the course text available.

## Data Model Changes

Add `CourseSection`.

Fields:

- `id`
- `course_id`
- `article_text_id`
- `section_index`
- `title`
- `sentence_start_index`
- `sentence_end_index`
- `audio_start_seconds`
- `audio_end_seconds`
- `planned_duration_seconds`
- `actual_duration_seconds`
- `status`: `pending`, `audio_generating`, `ready`, `failed`
- `created_at`
- `updated_at`

Constraints:

- Unique `(course_id, article_text_id, section_index)`.
- `sentence_start_index <= sentence_end_index`.

Add `TTSSegment`.

Fields:

- `id`
- `job_id`
- `course_id`
- `article_text_id`
- `section_id`
- `segment_index`
- `sentence_start_index`
- `sentence_end_index`
- `text_hash`
- `provider`
- `model_id`
- `voice_id`
- `speed_factor`
- `provider_speed`
- `status`: `pending`, `running`, `succeeded`, `failed`, `skipped`
- `attempt_count`
- `provider_attempt`
- `idempotency_key`
- `object_path`
- `duration_seconds`
- `character_count`
- `input_bytes`
- `provider_request_id`
- `error_code`
- `error_message`
- `created_at`
- `updated_at`
- `started_at`
- `finished_at`

Constraints:

- Unique `(job_id, provider, segment_index, text_hash)`.
- Unique `idempotency_key`.
- `segment_index` is stable for the logical sentence segment inside a job, even when fallback creates new provider rows.
- A fallback provider creates new `TTSSegment` rows with the same `segment_index` and `text_hash`, but a different `provider`.

Add `TTSUsageEvent`.

Fields:

- `id`
- `idempotency_key`
- `user_id`
- `course_id`
- `job_id`
- `segment_id`
- `tier`
- `provider`
- `model_id`
- `voice_id`
- `billable_characters`
- `input_bytes`
- `estimated_cost_cents`
- `currency`
- `status`: `reserved`, `committed`, `released`, `failed`
- `created_at`
- `reserved_at`
- `committed_at`
- `released_at`

Constraints:

- Unique `idempotency_key`.
- At most one committed usage event for a given `(job_id, provider, segment_id, text_hash)`.
- Retries with the same provider update the same usage reservation instead of creating a new committed usage row.
- Fallback to AWS creates separate AWS usage rows; discarded Tencent reservations are released unless the Tencent adapter can prove the request was billable.

Add `TTSQuotaPeriod`.

Fields:

- `id`
- `user_id`
- `tier`
- `period_start`
- `period_end`
- `free_course_count`
- `free_audio_seconds`
- `free_tts_characters`
- `paid_tts_characters`
- `estimated_cost_cents`
- `currency`
- `created_at`
- `updated_at`

Constraints:

- Unique `(user_id, tier, period_start, period_end)`.
- Quota counters are derived from committed `TTSUsageEvent` rows and cached here for fast checks.

Extend `GenerationJob`:

- `tier`
- `provider`
- `model_id`
- `voice_id`
- `segment_count`
- `succeeded_segment_count`
- `estimated_character_count`
- `fallback_from_provider`
- `fallback_reason`
- `locked_by`
- `lock_token`
- `last_heartbeat_at`
- `lease_expires_at`
- `error_code`
- `error_message`

Extend `AudioAsset`:

- `model_id`
- `tier`
- `generation_job_id`
- `storage_backend`
- `bucket`
- `object_key`
- `content_type`
- `byte_size`
- `etag`
- `checksum_sha256`
- `metadata_json`

The existing `AudioAsset.provider`, `voice_id`, `speed`, `format`, `duration_seconds`, and `character_count` remain valid.

State commit rules:

- Job and course status transitions can happen in larger transactions.
- `TTSSegment` status and heartbeat updates are committed after each segment.
- `TTSUsageEvent` reservations are inserted before provider calls and committed/released immediately after each provider result.
- Final `AudioAsset` creation and `Course.current_audio_asset_id` update happen only after the final audio file is valid.

## Generation Flow

1. `POST /courses` creates `Course`, `ArticleText`, and `Sentence` rows.
2. API builds or refreshes deterministic `CourseSection` rows for the current article text.
3. API calls `request_audio_generation`.
4. API creates a `GenerationJob`, marks the course `audio_generating`, commits, and enqueues Celery.
5. Worker claims the job lease and loads the job, course, article text, sections, and sentences.
6. `EntitlementResolver` determines free/paid tier.
7. `TTSRouter` chooses the first route plan.
8. Orchestrator creates provider-safe `TTSSegment` rows under each `CourseSection`.
9. Orchestrator reserves usage and runs segment generation under provider concurrency gates.
10. Each succeeded segment commits its audio object, segment duration, and usage event immediately.
11. Failed segments are retried with the same provider and same segment idempotency key.
12. If provider-level fallback is required, the job records `fallback_from_provider`, marks primary-provider segment output as skipped for the final asset, releases unused primary usage reservations, and regenerates every sentence segment with the fallback provider.
13. When all active provider segments succeed, the orchestrator concatenates final audio.
14. API-visible state is updated: one current `AudioAsset`, older current assets false, sentence timeline, section timeline, committed usage, job `succeeded`, and course `ready`.
15. If generation fails, worker marks the job `failed`, keeps the course text and sections, and does not delete or overwrite the previous ready audio asset if one exists.

## Concurrency And Rate Control

Provider concurrency is enforced by shared Redis semaphores because worker processes perform provider calls. Provider-published TPS/RPM limits and true concurrent request limits are different controls; the implementation must model both when the provider publishes both.

Default provider budgets:

| Provider | Default internal budget | Fallback behavior |
| --- | ---: | --- |
| `edge_tts` | 2 concurrent segments | if timeout/retry/circuit open, use Kokoro |
| `kokoro_onnx_cpu` | 1 concurrent segment per process | queue; no paid fallback for free users |
| `tencent_cloud_tts` | 16 concurrent segments | if budget full after short wait, route whole job to AWS |
| `aws_polly_standard` | 60 concurrent segments | queue or fail when AWS budget is full |

The Tencent budget intentionally stays below the researched default 20-way account concurrency to leave headroom for retries and operational drift. AWS Standard stays below the documented 80 TPS and 80 concurrent request limits.

Implementation details:

- Use Redis-backed semaphores keyed by provider, not in-process-only locks.
- Use Redis token buckets for provider request-rate limits when needed.
- Each semaphore acquisition has a short timeout.
- If Tencent cannot acquire capacity quickly, paid jobs route to AWS at the start of the attempt.
- If Tencent fails mid-job and retry also fails, fallback regenerates the full job with AWS and does not reuse Tencent segments in the final audio.
- Provider circuit breakers open after repeated transient failures and close after a cooldown.
- 429, throttling, timeout, connection reset, and 5xx are retryable.
- Provider authentication errors, invalid voice, invalid text, and unsupported format are non-retryable config failures.

## Cost And Quota Control

Before segment generation, the orchestrator reserves estimated usage.

Usage rules:

- Free tier consumes `free_tts_characters`.
- Paid tier consumes `paid_tts_characters` and records estimated cost.
- Segment retries with the same `idempotency_key` should not create duplicate committed usage events unless the provider actually charged another successful synthesis.
- Fallback regeneration records released or failed usage for discarded primary segments and committed usage for fallback output.
- The current implementation can estimate cost from config. It does not need to integrate provider invoices in this spec.

Quota periods:

- Free quota is monthly by default, matching the MVP target of 3 free courses or 60 minutes of audio per month.
- Daily safety caps can also apply to free users to prevent abuse from a single account.
- Paid quota is monthly by default and can be represented as a higher character or audio-minute allowance until real subscription billing exists.
- Quota period rows use `(user_id, tier, period_start, period_end)` as the natural scope.
- Period reset is calculated from timestamps when checking quota; a scheduled reset job is optional, not required for correctness.
- When free quota is exceeded, the course remains `text_ready`, no generation job is enqueued, and the API returns a structured `tts_quota_exceeded` reason.
- When paid auto-generation quota is exceeded or text is above the paid auto limit, the course remains `text_ready` until a future explicit confirmation or upgrade flow exists.

Default pricing config:

- Tencent paid primary: configure CNY cents per character.
- AWS Polly Standard fallback: configure USD cents per character.
- Currency conversion is out of scope; store provider-native currency and aggregate later.

The UI should not claim exact billing until real payment and invoice reconciliation exist.

## Storage And Audio Assembly

Segment audio and final audio are separate artifacts.

Local development:

- Store segments under `storage/generated_audio/segments/{job_id}/`.
- Store final audio under `storage/generated_audio/{course_id}-{job_id}.mp3`.

Production:

- Upload both segment and final audio to MinIO-compatible object storage.
- Keep object paths in `TTSSegment.object_path` and `AudioAsset.object_path`.
- Do not expose segment objects through public APIs.

Object storage playback:

- `GET /courses/{course_id}/audio` remains the stable playback endpoint.
- For local file storage, the endpoint can continue returning `FileResponse`.
- For object storage, the endpoint should either proxy from MinIO/S3 with HTTP Range support or return a short-lived signed URL.
- The default production path should proxy with Range support first, because it keeps authorization and future metering in the API layer.
- The endpoint must forward `Range` requests and return `206 Partial Content` for mobile seeking.
- Responses should include stable `Content-Type`, `Content-Length`, `Accept-Ranges`, `ETag`, and cache headers.
- Segment audio objects stay private and are never returned by public course APIs.

Assembly:

- Prefer provider output as MP3 when possible.
- If concatenation reliability requires normalization, convert segment output to WAV/PCM internally and encode final MP3.
- The implementation may start with `ffmpeg` as a required runtime dependency for production audio stitching.
- The orchestrator must write final files atomically: generate to a temp path, validate nonzero duration, then move/upload to the final path.

## Error Handling

Course status behavior:

- New generation starts with `audio_generating`.
- Success marks the course `ready`.
- Failure marks course `failed` only when no previous current audio asset exists.
- If a course already has a ready audio asset and regeneration fails, keep the old asset current and expose the failed job separately.

Job error codes:

- `tts_provider_timeout`
- `tts_provider_rate_limited`
- `tts_provider_auth_failed`
- `tts_provider_bad_request`
- `tts_provider_unavailable`
- `tts_text_too_long`
- `tts_quota_exceeded`
- `tts_audio_assembly_failed`
- `tts_unknown_failure`

Retry policy:

- Segment provider calls: up to 2 attempts for the primary provider.
- Free edge fallback: 1 retry on `edge_tts`, then Kokoro.
- Paid Tencent fallback: 1 retry on Tencent, then full-course AWS fallback.
- Worker task retry: retry only when the worker exits before recording a final job state; resumed work must skip committed successful segments.

## API Surface

The first real-TTS implementation needs a small public job surface so users can recover failed jobs and see actionable failure state.

Existing endpoints continue to work:

- `POST /courses`
- `GET /courses/{course_id}`
- `GET /courses/{course_id}/audio`

New or updated public endpoints:

- `GET /courses/{course_id}/generation-jobs`: list recent generation jobs for the course.
- `POST /courses/{course_id}/audio-generation`: enqueue a new audio generation job or retry the latest failed job.
- `GET /courses/{course_id}`: include latest generation error summary when the current course audio is not ready.

Course response additions:

- `current_generation_job_id`
- `generation_error_code`
- `generation_error_message`
- `generation_provider`
- `generation_fallback_from_provider`
- `sections`

The frontend should show a failed generation reason and a retry action when `generation_error_code` exists and the course has no current audio asset.

Internal endpoints:

- `POST /internal/generation-jobs/{job_id}/run` remains only as a local/debug/admin endpoint during transition.
- It must not be the production worker execution path.
- It must require HMAC request headers when `INTERNAL_API_HMAC_SECRET` is configured.
- It must reject missing, stale, replayed, or invalid signatures and should not be exposed through a public ingress.

Internal debug responses can include more detail for local/admin logs:

```json
{
  "course_id": "course_1",
  "job_id": "job_1",
  "status": "succeeded",
  "provider": "tencent_cloud_tts",
  "fallback_from_provider": null,
  "segment_count": 12
}
```

Future public endpoints, outside this first implementation:

- `POST /courses/{course_id}/audio-generation/confirm-cost`

## Internal API Security

Real TTS can spend money, so internal generation entry points are cost-sensitive.

Security requirements:

- Add `INTERNAL_API_HMAC_SECRET`, `INTERNAL_API_SIGNATURE_TTL_SECONDS`, and `INTERNAL_API_REPLAY_STORE` to API settings.
- Internal HTTP callers must send `X-Internal-Timestamp`, `X-Internal-Nonce`, and `X-Internal-Signature`.
- Internal routes must validate the HMAC-SHA256 signature with constant-time comparison.
- Internal routes must reject missing HMAC headers, invalid signatures, future timestamps, expired timestamps, and replayed nonces inside the configured signature TTL.
- Fixed reusable token headers are not a supported production authentication mode; deployments that still carry the old token-only setting should fail closed until `INTERNAL_API_HMAC_SECRET` is configured.
- `memory` replay storage is acceptable only for single-process local/dev runs; production multi-instance deployments should use `redis`.
- Internal routes must never rely on the public `X-User-Id` header.
- Production deployment should keep `/internal/*` off public ingress when infrastructure allows it.
- All generation start/retry endpoints must verify the course belongs to the current user before enqueueing a job.
- Job retry must enforce quota and provider routing again; it cannot reuse a stale paid route blindly.

## Configuration

New API settings:

- `TTS_PROVIDER_MODE=auto`
- `TTS_DEFAULT_FREE_PROVIDER=edge_tts`
- `TTS_FREE_FALLBACK_PROVIDER=kokoro_onnx_cpu`
- `TTS_DEFAULT_PAID_PROVIDER=tencent_cloud_tts`
- `TTS_PAID_FALLBACK_PROVIDER=aws_polly_standard`
- `TTS_EDGE_ENABLED=true`
- `TTS_EDGE_TIMEOUT_SECONDS=20`
- `TTS_EDGE_CONCURRENCY=2`
- `TTS_KOKORO_MODEL_PATH`
- `TTS_KOKORO_VOICE`
- `TTS_KOKORO_CONCURRENCY=1`
- `TTS_TENCENT_APP_ID`
- `TTS_TENCENT_SECRET_ID`
- `TTS_TENCENT_SECRET_KEY`
- `TTS_TENCENT_REGION`
- `TTS_TENCENT_VOICE_TYPE`
- `TTS_TENCENT_CODEC=mp3`
- `TTS_TENCENT_SAMPLE_RATE=16000`
- `TTS_TENCENT_CONCURRENCY=16`
- `TTS_TENCENT_MAX_CHINESE_CHARS=560`
- `TTS_TENCENT_MAX_ENGLISH_LETTERS=1600`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `TTS_AWS_POLLY_VOICE_ID`
- `TTS_AWS_POLLY_ENGINE=standard`
- `TTS_AWS_POLLY_CONCURRENCY=60`
- `FREE_TTS_MAX_COURSE_CHARACTERS`
- `FREE_TTS_MONTHLY_COURSE_LIMIT=3`
- `FREE_TTS_MONTHLY_AUDIO_MINUTES=60`
- `FREE_TTS_DAILY_COURSE_LIMIT`
- `PAID_TTS_MAX_AUTO_CHARACTERS`
- `TTS_PAID_USER_IDS`
- `TTS_STORAGE_BACKEND=local`
- `TTS_SIGNED_URL_TTL_SECONDS`
- `INTERNAL_API_HMAC_SECRET`
- `INTERNAL_API_SIGNATURE_TTL_SECONDS=300`
- `INTERNAL_API_REPLAY_STORE=memory`

Do not change the Makefile default API port or `.env.example` default API port to satisfy this feature. Local API commands should keep using command-level `API_PORT=8070` overrides when needed.

## Testing Strategy

Backend tests:

- Router chooses `edge_tts` for free users.
- Router chooses Tencent for paid users.
- Free route falls back to Kokoro after edge timeout/retry.
- Paid route falls back to AWS when Tencent retry fails.
- Paid route chooses AWS when Tencent concurrency semaphore is full.
- Tencent adapter maps product speed to Tencent `Speed` integer values and never sends raw multipliers.
- Tencent segmentation keeps Chinese segments under the configured conservative Tencent limit.
- Fallback regenerates the full course with one provider and does not mix provider segments in the final asset.
- Course text is grouped into user-facing `CourseSection` rows independently from provider `TTSSegment` rows.
- Long text is split into multiple `TTSSegment` rows.
- Successful generation creates one current `AudioAsset`, sentence timing, segment rows, and committed usage events.
- Segment retries reuse idempotency keys and do not create duplicate committed usage rows.
- Quota checks create no provider calls when a free user is over the monthly or daily limit.
- Failed generation preserves existing ready audio when regenerating an existing course.
- Text over configured limits does not enqueue paid generation automatically.
- Internal endpoints reject missing, invalid, stale, or replayed HMAC signatures when `INTERNAL_API_HMAC_SECRET` is configured.
- Object storage playback supports range requests without loading the whole audio file into memory.

Worker tests:

- Worker runs the orchestrator directly and does not wait on the old 300-second internal HTTP call.
- Worker returns provider and fallback metadata when present.
- Worker retry behavior does not duplicate succeeded segments.
- Worker resumes a stale running job from persisted segment rows after lease expiry.

No real cloud calls should run in default test suites. Provider clients must be stubbed.

Manual local checks:

- Create a free user course with `edge-tts` enabled.
- Disable network or force edge failure and confirm Kokoro fallback.
- Mark a local user as paid and run Tencent against a small text sample when credentials are present.
- Force Tencent concurrency full and confirm AWS route selection when AWS credentials are present.

## Rollout Plan

1. Add shared backend TTS module, data model changes, settings, and internal API token checks while keeping fake generation as the default in tests.
2. Move production generation orchestration from the API request path into the worker and add job leases/heartbeats.
3. Implement provider interface, parameter mapping, router, and fake-provider compatibility.
4. Implement `CourseSection` creation, provider segmentation, and segment persistence.
5. Add `edge-tts` and Kokoro providers for free tier.
6. Add Tencent provider and AWS Polly Standard provider for paid tier.
7. Add provider concurrency gates, rate limit buckets, retry, circuit breaker, and fallback.
8. Add usage ledger, quota periods, text length limits, and no-double-commit idempotency.
9. Add object-storage audio playback with Range support.
10. Update local/production docs with provider credentials, CPU model setup, internal token setup, and storage behavior.

## Acceptance Criteria

- Free user courses attempt `edge-tts` first and use Kokoro after edge retry failure.
- Paid user courses attempt Tencent first and use AWS Polly Standard after Tencent retry failure or Tencent concurrency exhaustion.
- Tencent requests honor provider-specific limits: conservative Chinese segment cap, `AppId`, `VoiceType`, `Codec`, `SampleRate`, and mapped integer `Speed`.
- A final course audio asset uses a single provider unless an explicit emergency mixed-provider setting is enabled.
- Course detail can expose user-facing sections separately from sentence-level playback timing.
- Long text is generated in resumable segments, not one provider request.
- Retrying a failed job skips already successful work when the same provider remains active.
- Fallback regeneration does not overwrite a previously ready audio asset until the new final audio is valid.
- Usage events record provider, model, tier, character count, and estimated cost.
- Usage events are idempotent and do not double-commit on retry.
- Production audio playback supports local storage and MinIO/S3 object storage through the same course audio endpoint.
- Internal generation endpoints require HMAC request signatures when `INTERNAL_API_HMAC_SECRET` is configured.
- Worker orchestration is not constrained by the current 300-second internal HTTP timeout.
- Automated tests do not require Tencent, AWS, edge, Kokoro model files, or network access.

## Operational Minimum

The first production-capable release must emit enough structured data to debug provider instability and cost.

Structured log fields:

- `job_id`
- `course_id`
- `section_id`
- `segment_id`
- `user_id`
- `tier`
- `provider`
- `model_id`
- `voice_id`
- `attempt_count`
- `provider_attempt`
- `status`
- `error_code`
- `duration_ms`
- `billable_characters`
- `estimated_cost_cents`

Required metrics or queryable aggregates:

- provider success rate by provider and tier
- provider fallback rate
- provider retry count
- segment p50/p95 synthesis latency
- course p50/p95 generation latency
- queue wait time
- concurrency saturation count
- circuit breaker open count and duration
- monthly free quota usage by user
- paid estimated cost by user and provider

## Source Notes

Prices, quotas, and provider limits are operational inputs, not permanent product assumptions. They were researched on 2026-07-22 and should remain configurable.

Important current constraints captured in this spec:

- Tencent realtime TTS source text limit is provider-specific; this design uses a conservative 560 Chinese-character segment cap and maps product speed to Tencent's integer `Speed` parameter.
- AWS Polly Standard currently publishes a 3000 billed-character synchronous input limit, 80 TPS, and up to 80 concurrent requests for Standard voices; this design uses lower internal defaults.
- AWS Polly Standard pricing is currently treated as configurable provider-native USD cost; do not hard-code pricing in business logic.

Useful references:

- edge-tts GitHub: https://github.com/rany2/edge-tts
- Kokoro GitHub: https://github.com/hexgrad/kokoro
- AWS Polly pricing: https://aws.amazon.com/polly/pricing/
- AWS Polly quotas: https://docs.aws.amazon.com/polly/latest/dg/limits.html
- Tencent Cloud Text-to-Speech pricing: https://cloud.tencent.com/document/product/1073/34112
- Tencent Cloud realtime synthesis docs: https://cloud.tencent.com/document/product/1073/94308
