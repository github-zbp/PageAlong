# Real TTS Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real TTS routing MVP with free `edge-tts -> Kokoro` routing, paid `Tencent -> AWS Polly Standard` routing, resumable segmentation, usage tracking, internal API security, and worker execution that is not constrained by the current 300-second HTTP call.

**Architecture:** Keep FastAPI as the system of record and move real generation execution out of the API request path. Add focused SQLAlchemy models for course sections, TTS segments, usage events, and quota periods; add provider-neutral adapters and a router; keep default tests deterministic through fake/stub providers. The worker will invoke API orchestration through a local API-package subprocess as the first implementation step, avoiding long internal HTTP calls while avoiding a risky package rename in this dirty worktree.

**Tech Stack:** FastAPI, SQLAlchemy, Celery, Redis, boto3, optional edge-tts, optional Kokoro ONNX runtime, optional Tencent Cloud SDK or direct client adapter, pytest.

---

## File Structure

- Modify `services/api/app/core/config.py`: add TTS settings and internal token config.
- Modify `services/api/app/models/course.py`: add `CourseSection`, extend `AudioAsset`.
- Modify `services/api/app/models/generation_job.py`: extend job fields for routing, leases, and errors.
- Create `services/api/app/models/tts.py`: add `TTSSegment`, `TTSUsageEvent`, `TTSQuotaPeriod`.
- Modify `services/api/app/models/__init__.py`: export new models.
- Create `services/api/app/services/tts_types.py`: provider-neutral request/result dataclasses and errors.
- Create `services/api/app/services/tts_router.py`: entitlement and route selection.
- Create `services/api/app/services/tts_segments.py`: sectioning, segmentation, and Tencent speed mapping helpers.
- Create `services/api/app/services/tts_usage_service.py`: quota and idempotent usage events.
- Modify `services/api/app/services/tts_service.py`: keep fake provider and add segment-provider compatibility.
- Modify `services/api/app/services/audio_generation_service.py`: orchestrate segments, fallback, asset creation, and sentence/section timing.
- Modify `services/api/app/api/routes/internal.py`: require `INTERNAL_API_TOKEN`.
- Modify `services/api/app/api/routes/courses.py`: add generation retry/list endpoints and response metadata.
- Modify `services/api/app/schemas/course.py`: add section and generation fields.
- Create `services/api/app/cli/generate_audio.py`: local CLI entrypoint used by worker.
- Modify `services/worker/app/tasks/generate_audio.py`: call API CLI subprocess instead of long-running internal HTTP.
- Modify `scripts/init_database.py`: add existing-DB schema repair for new columns.
- Add focused tests under `services/api/tests/` and `services/worker/tests/`.

## Task 1: Models And Settings

**Files:**
- Modify: `services/api/app/core/config.py`
- Modify: `services/api/app/models/course.py`
- Modify: `services/api/app/models/generation_job.py`
- Create: `services/api/app/models/tts.py`
- Modify: `services/api/app/models/__init__.py`
- Test: `services/api/tests/test_tts_models.py`

- [x] **Step 1: Write failing model/settings tests**

Create `services/api/tests/test_tts_models.py` with tests proving `CourseSection`, `TTSSegment`, `TTSUsageEvent`, `TTSQuotaPeriod`, new `AudioAsset` fields, and new TTS settings exist:

```python
from datetime import datetime

from app.core.config import Settings
from app.models.course import AudioAsset, CourseSection
from app.models.tts import TTSSegment, TTSQuotaPeriod, TTSUsageEvent


def test_tts_settings_defaults_are_present():
    settings = Settings()

    assert settings.tts_provider_mode == "auto"
    assert settings.tts_default_free_provider == "edge_tts"
    assert settings.tts_free_fallback_provider == "kokoro_onnx_cpu"
    assert settings.tts_default_paid_provider == "tencent_cloud_tts"
    assert settings.tts_paid_fallback_provider == "aws_polly_standard"
    assert settings.tts_tencent_max_chinese_chars == 560
    assert settings.tts_tencent_max_english_letters == 1600


def test_tts_models_can_be_inserted(db_session):
    section = CourseSection(
        course_id="course_1",
        article_text_id="article_1",
        section_index=0,
        title="第 1 节",
        sentence_start_index=0,
        sentence_end_index=2,
        planned_duration_seconds=420,
    )
    segment = TTSSegment(
        job_id="job_1",
        course_id="course_1",
        article_text_id="article_1",
        section_id="section_1",
        segment_index=0,
        sentence_start_index=0,
        sentence_end_index=0,
        text_hash="hash_1",
        provider="tencent_cloud_tts",
        model_id="standard",
        voice_id="101001",
        speed_factor=1.25,
        provider_speed="2",
        idempotency_key="segment-key",
    )
    usage = TTSUsageEvent(
        idempotency_key="usage-key",
        user_id="user_1",
        course_id="course_1",
        job_id="job_1",
        segment_id="segment_1",
        tier="paid",
        provider="tencent_cloud_tts",
        model_id="standard",
        voice_id="101001",
        billable_characters=8,
        input_bytes=24,
        estimated_cost_cents=1,
        currency="CNY",
        status="reserved",
    )
    quota = TTSQuotaPeriod(
        user_id="user_1",
        tier="free",
        period_start=datetime(2026, 7, 1),
        period_end=datetime(2026, 8, 1),
    )
    asset = AudioAsset(
        course_id="course_1",
        article_text_id="article_1",
        provider="fake",
        model_id="fake",
        tier="free",
        voice_id="fake-cn",
        format="wav",
        object_path="storage/generated_audio/course.wav",
        duration_seconds=1,
        character_count=8,
        storage_backend="local",
    )

    db_session.add_all([section, segment, usage, quota, asset])
    db_session.commit()

    assert section.id
    assert segment.id
    assert usage.id
    assert quota.id
    assert asset.model_id == "fake"
```

- [x] **Step 2: Verify model test fails**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_tts_models.py -q
```

Expected: FAIL because the new models/settings are missing.

- [x] **Step 3: Implement models and settings**

Add the fields and models exactly named in the test. Use SQLAlchemy defaults matching the current model style.

- [x] **Step 4: Verify model test passes**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_tts_models.py -q
```

Expected: PASS.

## Task 2: Router And Provider Parameter Mapping

**Files:**
- Create: `services/api/app/services/tts_types.py`
- Create: `services/api/app/services/tts_router.py`
- Create: `services/api/app/services/tts_segments.py`
- Test: `services/api/tests/test_tts_router.py`

- [x] **Step 1: Write failing router tests**

Create tests proving free/paid routing, Tencent fallback on concurrency saturation, Tencent speed mapping, and Tencent segment caps.

```python
from app.services.tts_router import ProviderHealth, TTSRouter
from app.services.tts_segments import split_text_for_tencent, tencent_speed_for_factor


def test_router_chooses_edge_for_free_user():
    route = TTSRouter(paid_user_ids={"paid_user"}).route_for_user(
        user_id="free_user",
        estimated_characters=100,
        provider_health=ProviderHealth(),
    )

    assert route.tier == "free"
    assert route.provider_id == "edge_tts"
    assert route.fallback_provider_id == "kokoro_onnx_cpu"


def test_router_chooses_tencent_for_paid_user():
    route = TTSRouter(paid_user_ids={"paid_user"}).route_for_user(
        user_id="paid_user",
        estimated_characters=100,
        provider_health=ProviderHealth(),
    )

    assert route.tier == "paid"
    assert route.provider_id == "tencent_cloud_tts"
    assert route.fallback_provider_id == "aws_polly_standard"


def test_router_chooses_aws_when_tencent_capacity_is_full():
    route = TTSRouter(paid_user_ids={"paid_user"}).route_for_user(
        user_id="paid_user",
        estimated_characters=100,
        provider_health=ProviderHealth(tencent_capacity_available=False),
    )

    assert route.tier == "paid"
    assert route.provider_id == "aws_polly_standard"
    assert route.fallback_provider_id is None


def test_tencent_speed_mapping_uses_integer_provider_values():
    assert tencent_speed_for_factor(0.8) == -1
    assert tencent_speed_for_factor(1.0) == 0
    assert tencent_speed_for_factor(1.25) == 1
    assert tencent_speed_for_factor(1.5) == 2
    assert tencent_speed_for_factor(2.0) == 4


def test_tencent_chinese_segments_stay_under_conservative_limit():
    text = "学" * 900

    segments = split_text_for_tencent(text, max_chinese_chars=560, max_english_letters=1600)

    assert [len(segment) for segment in segments] == [560, 340]
```

- [x] **Step 2: Verify router tests fail**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_tts_router.py -q
```

Expected: FAIL because router and helpers are missing.

- [x] **Step 3: Implement router and helpers**

Implement dataclasses:

```python
@dataclass(frozen=True)
class TTSRoutePlan:
    tier: str
    provider_id: str
    model_id: str
    voice_id: str
    speed_factor: float
    response_format: str
    segment_character_limit: int
    segment_byte_limit: int
    max_concurrency: int
    fallback_provider_id: str | None
    fallback_policy: str
```

Implement `ProviderHealth` and `TTSRouter.route_for_user(...)` with the routing rules from the spec.

- [x] **Step 4: Verify router tests pass**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_tts_router.py -q
```

Expected: PASS.

## Task 3: Segments, Sections, Usage, And Fake Orchestration

**Files:**
- Modify: `services/api/app/services/tts_service.py`
- Create: `services/api/app/services/tts_usage_service.py`
- Modify: `services/api/app/services/audio_generation_service.py`
- Test: `services/api/tests/test_audio_generation_service.py`

- [x] **Step 1: Write failing orchestration tests**

Create tests proving one sentence becomes one segment, sections are created, fake generation writes segment rows, usage is committed, and repeated generation does not double-commit successful usage.

- [x] **Step 2: Verify orchestration tests fail**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_real_tts_orchestration.py -q
```

Expected: FAIL because orchestration does not create sections/segments/usage yet.

- [x] **Step 3: Implement minimal segment orchestration with fake provider**

Keep the existing `FakeTTSProvider` but add segment synthesis compatibility. Generate one final WAV locally for tests, using segment durations to populate sentence and section timing.

- [x] **Step 4: Verify orchestration tests pass**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_real_tts_orchestration.py -q
```

Expected: PASS.

## Task 4: API Error Fields, Retry Endpoint, And Internal Token

**Files:**
- Modify: `services/api/app/schemas/course.py`
- Modify: `services/api/app/api/routes/courses.py`
- Modify: `services/api/app/api/routes/internal.py`
- Test: `services/api/tests/test_tts_api.py`

- [x] **Step 1: Write failing API tests**

Test that course responses include `sections` and generation error fields, retry endpoint creates a job for the current user, and internal endpoint rejects missing token.

- [x] **Step 2: Verify API tests fail**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_tts_api.py -q
```

Expected: FAIL.

- [x] **Step 3: Implement API changes**

Add schemas, serialization, `GET /courses/{course_id}/generation-jobs`, `POST /courses/{course_id}/audio-generation`, and token check in internal route.

- [x] **Step 4: Verify API tests pass**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_tts_api.py -q
```

Expected: PASS.

## Task 5: Worker Direct Execution Path

**Files:**
- Create: `services/api/app/cli/generate_audio.py`
- Modify: `services/worker/app/tasks/generate_audio.py`
- Test: `services/worker/tests/test_generate_audio_task.py`

- [x] **Step 1: Write failing worker tests**

Update worker tests to prove it calls a local API CLI subprocess command and does not call `urlopen`.

- [x] **Step 2: Verify worker tests fail**

Run:

```bash
cd services/worker && .venv/bin/python -m pytest tests/test_generate_audio_task.py -q
```

Expected: FAIL because worker still uses `urlopen`.

- [x] **Step 3: Implement API CLI and worker subprocess call**

Add a CLI entrypoint that opens an API DB session and calls `AudioGenerationService.generate_for_job(job_id)`. Update worker task to call the API venv Python with `PYTHONPATH=services/api`.

- [x] **Step 4: Verify worker tests pass**

Run:

```bash
cd services/worker && .venv/bin/python -m pytest tests/test_generate_audio_task.py -q
```

Expected: PASS.

## Task 6: Real Provider Adapter Skeletons

**Files:**
- Create: `services/api/app/services/providers/edge_tts_provider.py`
- Create: `services/api/app/services/providers/kokoro_provider.py`
- Create: `services/api/app/services/providers/tencent_provider.py`
- Create: `services/api/app/services/providers/aws_polly_provider.py`
- Test: `services/api/tests/test_tts_provider_adapters.py`

- [x] **Step 1: Write failing provider adapter tests**

Use monkeypatched clients to verify each adapter builds the correct provider request without performing a network call.

- [x] **Step 2: Verify provider adapter tests fail**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_tts_provider_adapters.py -q
```

Expected: FAIL.

- [x] **Step 3: Implement provider adapters with optional imports**

Adapters must raise a clear configuration error when optional dependencies or credentials are missing. Default tests use fake/stub clients only.

- [x] **Step 4: Verify provider adapter tests pass**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_tts_provider_adapters.py -q
```

Expected: PASS.

## Task 7: Existing DB Repair And Verification

**Files:**
- Modify: `scripts/init_database.py`
- Test: `services/api/tests/test_init_database.py`

- [x] **Step 1: Write failing schema repair tests**

Add assertions that the init script creates new TTS tables and adds new columns to existing `audio_assets` and `generation_jobs`.

- [x] **Step 2: Verify schema repair tests fail**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_init_database.py -q
```

Expected: FAIL.

- [x] **Step 3: Implement schema repair**

Add `ensure_tts_schema(engine)` and call it from `create_application_tables(engine)`.

- [x] **Step 4: Verify API and worker tests**

Run:

```bash
make test-api
cd services/worker && .venv/bin/python -m pytest -q
```

Expected: PASS.

## Self-Review

Spec coverage:

- Provider routing: Task 2 and Task 6.
- Tencent parameter and segment limits: Task 2 and Task 6.
- Course sections vs TTS segments: Task 1 and Task 3.
- Usage idempotency and quota: Task 1 and Task 3.
- Internal API security: Task 4.
- Worker execution model: Task 5.
- Existing DB repair: Task 7.

Known intentional MVP limits:

- Object storage Range proxy is planned in the spec but not in this first code plan unless existing local playback tests require it.
- Real payment and authentication are not implemented; `PAID_USER_IDS` remains the entitlement source.
- Real provider calls are implemented behind adapters but default tests stub them and do not require credentials.
