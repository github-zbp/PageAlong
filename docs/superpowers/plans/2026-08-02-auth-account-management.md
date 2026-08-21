# Auth And Account Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build email/password registration, Brevo email-code delivery, bearer-token login, account management, and admin user management for PageAlong.

**Architecture:** Add focused auth models, schemas, services, and routes in `services/api/app`, then wire `get_current_user_id` to bearer sessions while preserving `AUTH_DEV_BYPASS` for local development. Update the Next.js client API helper and console shell to use token-backed auth, then add public auth pages, account page, and admin user pages.

**Tech Stack:** FastAPI, SQLAlchemy, Redis, Python standard library SMTP/PBKDF2/secrets, Next.js 13, React 18, TypeScript, Playwright.

---

## File Structure

- Create `services/api/app/models/user.py`: user, auth session, and auth event SQLAlchemy models.
- Modify `services/api/app/models/__init__.py`: export auth models.
- Modify `services/api/app/core/config.py`: add auth, SMTP, and admin bootstrap settings.
- Modify `scripts/init_database.py`: ensure auth tables and seed initial admin.
- Create `services/api/app/schemas/auth.py`: request/response schemas.
- Create `services/api/app/services/auth_security.py`: password hashing, token generation, token hashing, email normalization.
- Create `services/api/app/services/email_delivery.py`: Brevo SMTP email sender and test-friendly console sender.
- Create `services/api/app/services/auth_service.py`: verification-code, registration, login, logout, password, and admin-user operations.
- Modify `services/api/app/api/deps.py`: authenticate bearer token, expose current user and admin dependencies, keep dev bypass.
- Create `services/api/app/api/routes/auth.py`: public and self-service auth endpoints.
- Create `services/api/app/api/routes/admin.py`: admin user management endpoints.
- Modify `services/api/app/api/router.py`: include auth and admin routers.
- Create `services/api/tests/test_auth_api.py`: end-to-end backend auth tests.
- Create `services/api/tests/test_admin_api.py`: admin authorization and user-management tests.
- Modify `.env.example`: document Brevo/auth settings without secrets.
- Modify `apps/web/src/lib/types.ts`: add auth and admin-user types.
- Modify `apps/web/src/lib/api.ts`: central request helper, auth token storage, auth/admin API calls.
- Modify `apps/web/src/lib/i18n.ts`: auth/account/admin text.
- Create `apps/web/src/components/AuthGate.tsx`: client-side protected route gate.
- Modify `apps/web/src/components/ConsoleShell.tsx`: show current email, logout, account/admin links.
- Create `apps/web/src/app/[locale]/login/page.tsx`: login page.
- Create `apps/web/src/app/[locale]/register/page.tsx`: registration page.
- Create `apps/web/src/app/[locale]/forgot-password/page.tsx`: password reset request/confirm page.
- Create `apps/web/src/app/[locale]/account/page.tsx`: account page.
- Create `apps/web/src/app/[locale]/admin/users/page.tsx`: admin user list and actions.
- Modify protected app pages under `apps/web/src/app/[locale]/...`: wrap with `AuthGate` where user data is required.
- Modify `apps/web/tests/course-flow.spec.ts`: update CORS/auth mocks only where needed.
- Create `apps/web/tests/auth-flow.spec.ts`: browser auth flow coverage.

## Task 1: Backend Auth Models And Bootstrap

- [ ] **Step 1: Write failing model/bootstrap tests**

Add tests in `services/api/tests/test_auth_api.py` covering admin seed idempotency and model exports.

- [ ] **Step 2: Run test to verify it fails**

Run: `make test-api`

Expected: failure because `User` and bootstrap helpers do not exist.

- [ ] **Step 3: Add auth models, exports, settings, and init schema**

Create auth SQLAlchemy models and add schema creation/column ensuring in `scripts/init_database.py`.

- [ ] **Step 4: Run backend tests for this task**

Run: `make test-api`

Expected: model/bootstrap tests pass, existing API tests remain green.

## Task 2: Backend Auth Security And Email Code Service

- [ ] **Step 1: Write failing service tests**

Add tests for email normalization, password hashing/verification, token hashing, verification code storage, 60-second cooldown, single-use code validation, and logger output.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && .venv/bin/python -m pytest -q tests/test_auth_api.py`

Expected: failures for missing security and service functions.

- [ ] **Step 3: Implement security helpers and email delivery abstraction**

Use standard library PBKDF2-HMAC-SHA256, `secrets`, SHA-256 token hashing, and SMTP delivery with a test-friendly injected sender.

- [ ] **Step 4: Run focused tests**

Run: `cd services/api && .venv/bin/python -m pytest -q tests/test_auth_api.py`

Expected: service tests pass.

## Task 3: Public Auth API

- [ ] **Step 1: Write failing route tests**

Add tests for `POST /auth/email/code`, `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `POST /auth/change-password`, and password reset.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && .venv/bin/python -m pytest -q tests/test_auth_api.py`

Expected: 404s or missing behavior failures.

- [ ] **Step 3: Implement schemas, auth routes, and bearer-token dependency**

Add auth schemas, service methods, routes, and update `get_current_user_id` to prefer bearer sessions and fall back to `X-User-Id` only when `AUTH_DEV_BYPASS=true`.

- [ ] **Step 4: Run focused auth tests**

Run: `cd services/api && .venv/bin/python -m pytest -q tests/test_auth_api.py`

Expected: auth route tests pass.

## Task 4: Admin User Management API

- [ ] **Step 1: Write failing admin tests**

Add tests in `services/api/tests/test_admin_api.py` for non-admin denial, admin list/search/filter, disable/enable, promote/demote, force logout, and last-admin guard.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && .venv/bin/python -m pytest -q tests/test_admin_api.py`

Expected: 404s or permission failures.

- [ ] **Step 3: Implement admin routes and service methods**

Add `/admin/users` endpoints and admin dependency.

- [ ] **Step 4: Run focused admin tests**

Run: `cd services/api && .venv/bin/python -m pytest -q tests/test_admin_api.py`

Expected: admin tests pass.

## Task 5: Backend Regression And Configuration

- [ ] **Step 1: Add settings tests**

Extend existing settings tests to cover auth defaults and SMTP/admin environment variable parsing.

- [ ] **Step 2: Run test to verify it fails if settings are missing**

Run: `cd services/api && .venv/bin/python -m pytest -q tests/test_settings.py`

Expected: failures for missing auth settings.

- [ ] **Step 3: Update `.env.example`**

Document `AUTH_DEV_BYPASS`, session TTL, Brevo SMTP host/port/user/password, sender, and admin bootstrap variables. Do not write real secrets.

- [ ] **Step 4: Run full backend test suite**

Run: `make test-api`

Expected: all backend tests pass.

## Task 6: Frontend Auth Client

- [ ] **Step 1: Write failing frontend unit-style checks or Playwright mocks**

Add/update tests so API calls use `Authorization` after login and no longer depend on hardcoded `X-User-Id`.

- [ ] **Step 2: Run web tests to verify failure**

Run: `make test-web`

Expected: failures around missing auth helper/pages.

- [ ] **Step 3: Implement auth token storage and API functions**

Add auth/admin types and `apiRequest` helper in `apps/web/src/lib/api.ts`.

- [ ] **Step 4: Run focused web tests**

Run: `make test-web`

Expected: updated tests pass or move to UI failures addressed in following tasks.

## Task 7: Frontend Auth Pages And Protected Shell

- [ ] **Step 1: Add failing Playwright coverage**

Cover login, registration code flow, logout, and redirect from protected pages.

- [ ] **Step 2: Run web tests to verify failure**

Run: `make test-web`

Expected: route/page failures.

- [ ] **Step 3: Implement `AuthGate`, login/register/reset/account pages, and shell account menu**

Use existing visual language and avoid marketing-style layouts inside the app.

- [ ] **Step 4: Run web tests**

Run: `make test-web`

Expected: auth UI flow tests pass.

## Task 8: Frontend Admin Users Page

- [ ] **Step 1: Add failing Playwright coverage**

Cover admin user list visibility, normal user denial, disabling/enabling a user, and admin-only link visibility.

- [ ] **Step 2: Run web tests to verify failure**

Run: `make test-web`

Expected: admin page failures.

- [ ] **Step 3: Implement admin users page**

Build a dense table with search/filter controls and row actions.

- [ ] **Step 4: Run web tests**

Run: `make test-web`

Expected: admin UI tests pass.

## Task 9: Final Verification

- [ ] **Step 1: Run backend tests**

Run: `make test-api`

Expected: all backend tests pass.

- [ ] **Step 2: Run web tests**

Run: `make test-web`

Expected: all Playwright tests pass.

- [ ] **Step 3: Run web build because routes/API client changed**

Run: `cd apps/web && npm run build`

Expected: Next.js build completes successfully.

- [ ] **Step 4: Review diff for secrets**

Run: `git diff --check && rg -n "xsmtpsib-|xkeysib-|1q2w3e4R|658c9a37" . --glob '!node_modules/**' --glob '!.git/**'`

Expected: `git diff --check` has no whitespace errors; `rg` finds no checked-in secrets.
