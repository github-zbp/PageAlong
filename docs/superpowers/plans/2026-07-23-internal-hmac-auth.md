# Internal HMAC Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the reusable fixed internal API token with per-request HMAC signatures for internal HTTP runner endpoints.

**Architecture:** Keep `/internal/generation-jobs/{job_id}/run` as an optional local/debug endpoint, but authenticate production calls with timestamped HMAC-SHA256 signatures. The secret never crosses the wire; the API verifies TTL, signature, and nonce replay. Local development remains permissive when no HMAC secret is configured.

**Tech Stack:** FastAPI dependencies, Python `hmac/hashlib/secrets/time`, in-process replay cache for MVP, pytest.

---

## File Structure

- Modify `services/api/app/core/config.py`: add HMAC internal auth settings.
- Create `services/api/app/api/internal_auth.py`: signing, verification, replay cache, request dependency.
- Modify `services/api/app/api/routes/internal.py`: require HMAC dependency instead of fixed token header.
- Modify `services/api/tests/test_tts_api.py`: update internal auth regression tests.
- Modify `.env.example`: replace fixed token example with HMAC settings and fix inline `TTS_PAID_USER_IDS` comment.

## Task 1: HMAC Internal Auth Tests

**Files:**
- Modify: `services/api/tests/test_tts_api.py`

- [ ] **Step 1: Write failing tests**

Add tests that:

```python
def test_internal_generation_rejects_fixed_token_when_hmac_is_configured(...):
    monkeypatch.setattr("app.api.internal_auth.settings.internal_api_hmac_secret", "secret")
    response = client.post(
        f"/internal/generation-jobs/{job.id}/run",
        headers={"X-Internal-API-Token": "secret"},
    )
    assert response.status_code == 401
```

and:

```python
def test_internal_generation_accepts_hmac_signature_and_rejects_replay(...):
    headers = sign_internal_request("POST", f"/internal/generation-jobs/{job.id}/run", b"", "secret")
    accepted = client.post(f"/internal/generation-jobs/{job.id}/run", headers=headers)
    replayed = client.post(f"/internal/generation-jobs/{job.id}/run", headers=headers)
    assert accepted.status_code == 200
    assert replayed.status_code == 401
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_tts_api.py::test_internal_generation_rejects_fixed_token_when_hmac_is_configured tests/test_tts_api.py::test_internal_generation_accepts_hmac_signature_and_rejects_replay -q
```

Expected: FAIL because `app.api.internal_auth` does not exist and fixed-token auth is still accepted.

## Task 2: HMAC Auth Implementation

**Files:**
- Modify: `services/api/app/core/config.py`
- Create: `services/api/app/api/internal_auth.py`
- Modify: `services/api/app/api/routes/internal.py`

- [ ] **Step 1: Add settings**

Add:

```python
internal_api_hmac_secret: str = ""
internal_api_signature_ttl_seconds: int = 300
internal_api_replay_store: str = "memory"
```

- [ ] **Step 2: Implement signer/verifier**

Create `sign_internal_request(...)`, `build_internal_signature_payload(...)`, a memory nonce store, and `verify_internal_request_signature(...)`.

- [ ] **Step 3: Wire route dependency**

Replace `verify_internal_api_token` with `verify_internal_request_signature`.

- [ ] **Step 4: Run tests to verify pass**

Run the two targeted tests from Task 1. Expected: PASS.

## Task 3: Env Example And Verification

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Update env example**

Remove `INTERNAL_API_TOKEN`, add:

```env
INTERNAL_API_HMAC_SECRET=
INTERNAL_API_SIGNATURE_TTL_SECONDS=300
INTERNAL_API_REPLAY_STORE=memory
```

Move `TTS_PAID_USER_IDS` explanation onto a separate comment line.

- [ ] **Step 2: Verify**

Run:

```bash
make test-api
cd services/api && .venv/bin/python -m ruff check app tests
git diff --check -- .env.example services/api/app/api/internal_auth.py services/api/app/api/routes/internal.py services/api/app/core/config.py services/api/tests/test_tts_api.py
```

Expected: all commands pass.
