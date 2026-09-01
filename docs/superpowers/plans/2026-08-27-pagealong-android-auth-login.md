# PageAlong Android Auth and Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Android launch gate and unified login flow with consent, email password login, email-code login, WeChat entry, optional one-tap entry, and durable session restore.

**Architecture:** Keep the foundation session provider as the source of truth, then add a dedicated auth route group that owns splash/loading, consent, and sign-in/register surfaces. The backend exposes a minimal capability endpoint and provider-exchange routes so the mobile app can show only the methods that are actually available, while the client stores the bearer token long term and rehydrates it on launch. The auth surface should use the same Cubox-inspired dark, compact, icon-first mobile language as the rest of the app.

**Tech Stack:** Expo Router, React Native, TypeScript, React Query, expo-secure-store, expo-web-browser, expo-linking, FastAPI, SQLAlchemy, pytest.

**Spec:** `docs/superpowers/specs/2026-08-27-pagealong-android-app-design.md` (Spec 2: 启动页与登录)

## Global Constraints

- 只做 Android，不做 iOS。
- 不做 `Sign in with Apple`。
- 不做手机短信验证码登录。
- 微信登录保留，但仅在国内用户可见。
- 手机一键登录保留为可选能力，前提是没有直接金钱成本且接入路径明确。
- 主题只保留白天和夜间两种，不做动态色或额外主题。
- 后端接口优先复用 Web 端现有接口，只有确实无法复用时才补新接口。
- 播放器在应用切到后台后不能停止。
- 下载逻辑要和 Web 端一致：文件已准备好就立即下载，未准备好则提示生成中并引导去任务页。

---

## Scope Check

- In scope: APP loading gate, consent gate, password login, email-code login, provider-capability discovery, WeChat and one-tap entry points, and long-lived token restore.
- Out of scope: iOS, Apple login, SMS login, payment, OCR, real TTS, and production observability.
- This plan assumes `docs/superpowers/plans/2026-08-27-pagealong-android-foundation.md` is already complete.

## Known Workspace Constraints

- Preserve unrelated local edits in the existing `apps/mobile`, `apps/web`, and docs trees.
- Keep local API runs on port `8070` when testing mobile auth against the backend.
- Do not touch generated archives or build outputs.

## File Structure

### Backend

- Modify `services/api/app/core/config.py`: add auth capability and provider feature flags.
- Modify `services/api/app/schemas/auth.py`: add login-capability and email-code-login schemas.
- Modify `services/api/app/services/auth_service.py`: add email-code sign-in and provider exchange helpers.
- Modify `services/api/app/api/routes/auth.py`: expose capability and exchange routes.
- Modify `services/api/tests/test_auth_api.py`: cover capability visibility, code login, and provider exchange behavior.

### Mobile

- Modify `apps/mobile/app/index.tsx`: route signed-in users into tabs and signed-out users into auth.
- Create `apps/mobile/app/loading.tsx`: splash/loading screen.
- Create `apps/mobile/app/(auth)/_layout.tsx`: auth route stack.
- Create `apps/mobile/app/(auth)/login.tsx`: unified sign-in/register surface.
- Create `apps/mobile/src/components/AuthConsentRow.tsx`: agreement checkbox and legal links.
- Create `apps/mobile/src/components/AuthMethodTabs.tsx`: password/code segmented control.
- Create `apps/mobile/src/components/AuthProviderButtons.tsx`: WeChat and one-tap buttons.
- Create `apps/mobile/src/components/AuthForm.tsx`: shared credential form.
- Modify `apps/mobile/src/lib/api.ts`: auth capability and auth exchange helpers.
- Create `apps/mobile/tests/auth-login.test.tsx`: auth screen render and state flow tests.
- Create `apps/mobile/tests/auth-api.test.ts`: auth client helper tests.

---

### Task 1: Add the backend auth capability contract

**Files:**
- Modify: `services/api/app/core/config.py`
- Modify: `services/api/app/schemas/auth.py`
- Modify: `services/api/app/services/auth_service.py`
- Modify: `services/api/app/api/routes/auth.py`
- Modify: `services/api/tests/test_auth_api.py`

- [ ] **Step 1: Write the failing backend tests**

Add coverage for three behaviors:

```python
def test_auth_capabilities_hide_provider_buttons_when_disabled(client, monkeypatch):
    from app.api.routes import auth

    monkeypatch.setattr(auth.settings, "auth_wechat_enabled", False)
    monkeypatch.setattr(auth.settings, "auth_one_tap_enabled", False)

    response = client.get("/auth/capabilities")

    assert response.status_code == 200
    assert response.json() == {
        "email_password": True,
        "email_code": True,
        "wechat": False,
        "one_tap": False,
    }
```

```python
def test_email_code_login_issues_a_session_for_existing_user(client, db_session, monkeypatch):
    from app.api.routes import auth
    from app.models.user import User, UserRole, UserStatus
    from app.services.auth_security import hash_password
    from app.services.auth_service import AuthService, InMemoryVerificationCodeStore
    from app.services.email_delivery import RecordingEmailSender

    user = User(
        email="reader@example.com",
        password_hash=hash_password("abc12345"),
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    sender = RecordingEmailSender()
    service = AuthService(code_store=InMemoryVerificationCodeStore(), email_sender=sender)
    monkeypatch.setattr(auth, "get_auth_service", lambda: service)

    client.post("/auth/email/code", json={"email": "reader@example.com", "purpose": "login"})
    code = sender.messages[-1].code
    response = client.post("/auth/email/login", json={"email": "reader@example.com", "code": code})

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "reader@example.com"
```

```python
def test_provider_exchange_routes_return_auth_response(client, monkeypatch):
    from app.api.routes import auth
    from app.services.auth_service import AuthService

    service = AuthService()
    monkeypatch.setattr(auth, "get_auth_service", lambda: service)
    monkeypatch.setattr(service, "exchange_wechat_identity", lambda *args, **kwargs: fake_auth_result)

    response = client.post("/auth/wechat/exchange", json={"code": "wechat-code", "state": "abc"})

    assert response.status_code == 200
    assert response.json()["token"]
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_auth_api.py
```

Expected: fail because the capability endpoint, login-code path, and provider exchanges do not exist yet.

- [ ] **Step 3: Implement the smallest backend surface**

Add these request/response models to `services/api/app/schemas/auth.py`:

```python
class LoginCapabilitiesRead(BaseModel):
    email_password: bool = True
    email_code: bool = True
    wechat: bool = False
    one_tap: bool = False


class EmailCodeLoginRequest(BaseModel):
    email: str
    code: str


class WechatExchangeRequest(BaseModel):
    code: str
    state: str | None = None


class OneTapExchangeRequest(BaseModel):
    credential: str
    provider: str | None = None
```

Then update `AuthService` to:

```python
def login_with_email_code(...)
def exchange_wechat_identity(...)
def exchange_one_tap_identity(...)
def login_capabilities(request_ip: str) -> LoginCapabilitiesRead
```

Keep the existing password login, register, logout, and session creation flow untouched. The new email-code login should create a session for an existing verified account; if the account does not exist, the route should return a clear 404/409-style auth error so the client can switch to registration.

- [ ] **Step 4: Re-run the backend tests**

Run the same pytest command from Step 2.

Expected: pass.

- [ ] **Step 5: Commit the backend auth contract**

```bash
git add services/api/app/core/config.py services/api/app/schemas/auth.py services/api/app/services/auth_service.py services/api/app/api/routes/auth.py services/api/tests/test_auth_api.py
git commit -m "feat: add mobile auth capability contract"
```

---

### Task 2: Gate the app with loading and session routing

**Files:**
- Modify: `apps/mobile/app/index.tsx`
- Create: `apps/mobile/app/loading.tsx`
- Create: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/src/components/AuthSplash.tsx`
- Modify: `apps/mobile/src/providers/SessionProvider.tsx`
- Test: `apps/mobile/tests/auth-login.test.tsx`

- [ ] **Step 1: Write the failing mobile routing tests**

Add coverage that the app does not jump straight into tabs before the session finishes bootstrapping:

```tsx
it("shows the loading gate until session bootstrap resolves", async () => {
  render(<AppRoot />);

  expect(screen.getByText("PageAlong")).toBeTruthy();
  expect(screen.queryByText("工作台")).toBeNull();
});
```

Also cover the signed-out redirect:

```tsx
it("redirects signed-out users into the auth route group", async () => {
  mockBootstrapSession({ status: "signed_out", token: null, user: null });
  render(<AppRoot />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(auth)/login"));
});
```

- [ ] **Step 2: Run the failing test file**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- auth-login.test.tsx
```

Expected: fail because the loading screen and auth route group are not wired yet.

- [ ] **Step 3: Add the loading screen and session gate**

Create `apps/mobile/app/loading.tsx` with a minimal splash surface and create `apps/mobile/src/components/AuthSplash.tsx` as the shared renderer.

Update `apps/mobile/app/index.tsx` so it:

```tsx
const { state } = useSession();

if (state.status === "loading") {
  return <AuthSplash />;
}
if (state.status === "signed_in") {
  return <Redirect href="/(tabs)/workbench" />;
}
return <Redirect href="/(auth)/login" />;
```

Create `apps/mobile/app/(auth)/_layout.tsx` as a stack that hides the tab bar and keeps the auth flow isolated from the signed-in shell.

- [ ] **Step 4: Re-run the mobile routing tests**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- auth-login.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit the launch gate**

```bash
git add apps/mobile/app/index.tsx apps/mobile/app/loading.tsx apps/mobile/app/(auth)/_layout.tsx apps/mobile/src/components/AuthSplash.tsx apps/mobile/src/providers/SessionProvider.tsx apps/mobile/tests/auth-login.test.tsx
git commit -m "feat: gate android auth launch"
```

---

### Task 3: Build the unified login and registration surface

**Files:**
- Create: `apps/mobile/app/(auth)/login.tsx`
- Create: `apps/mobile/src/components/AuthConsentRow.tsx`
- Create: `apps/mobile/src/components/AuthMethodTabs.tsx`
- Create: `apps/mobile/src/components/AuthForm.tsx`
- Create: `apps/mobile/src/components/AuthProviderButtons.tsx`
- Modify: `apps/mobile/src/lib/api.ts`
- Modify: `apps/mobile/src/providers/SessionProvider.tsx`
- Test: `apps/mobile/tests/auth-login.test.tsx`
- Test: `apps/mobile/tests/auth-api.test.ts`

- [ ] **Step 1: Write the failing form and API tests**

Add a screen test that proves the consent checkbox blocks all sign-in actions until the user agrees:

```tsx
it("keeps provider buttons disabled until consent is checked", async () => {
  render(<LoginScreen />);

  expect(screen.getByLabelText("同意服务协议")).toBeTruthy();
  expect(screen.getByRole("button", { name: "微信登录" })).toBeDisabled();
});
```

Add API tests that cover:

- `requestEmailCode({ purpose: "login" })`
- `loginWithEmailCode({ email, code })`
- `exchangeWechatLogin(...)`
- `exchangeOneTapLogin(...)`

- [ ] **Step 2: Run the failing tests**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- auth-login.test.tsx auth-api.test.ts
```

Expected: fail because the new screen and client helpers do not exist yet.

- [ ] **Step 3: Implement the auth form**

Create `apps/mobile/app/(auth)/login.tsx` as a single screen with:

```tsx
<AuthConsentRow />
<AuthMethodTabs value={method} onChange={setMethod} />
<AuthForm method={method} onSubmit={submit} />
<AuthProviderButtons
  capabilities={capabilities}
  onWechatPress={handleWechat}
  onOneTapPress={handleOneTap}
/>
```

Behavior:

- Password mode uses email/password and `loginWithPassword`.
- Code mode requests a login code first, then signs in with `loginWithEmailCode`.
- If the backend reports that the email does not yet exist, the same screen switches into registration mode and reuses the code plus password fields with `registerWithEmail`.
- `SessionProvider.signInWithToken()` remains the only way to persist the bearer token after any successful auth path.

Extend `apps/mobile/src/lib/api.ts` with the new auth helper calls and capability fetcher.

- [ ] **Step 4: Re-run the mobile auth tests**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- auth-login.test.tsx auth-api.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit the unified auth screen**

```bash
git add apps/mobile/app/(auth)/login.tsx apps/mobile/src/components/AuthConsentRow.tsx apps/mobile/src/components/AuthMethodTabs.tsx apps/mobile/src/components/AuthForm.tsx apps/mobile/src/components/AuthProviderButtons.tsx apps/mobile/src/lib/api.ts apps/mobile/src/providers/SessionProvider.tsx apps/mobile/tests/auth-login.test.tsx apps/mobile/tests/auth-api.test.ts
git commit -m "feat: add android auth screen"
```

---

### Task 4: Verify the full auth flow against the running API

**Files:**
- Modify: none
- Test: `services/api/tests/test_auth_api.py`
- Test: `apps/mobile/tests/auth-login.test.tsx`

- [ ] **Step 1: Run the focused backend and mobile auth suites**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_auth_api.py
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && npm test -- auth-login.test.tsx auth-api.test.ts
```

Expected: both pass.

- [ ] **Step 2: Launch the API and mobile app together**

Run the API with the local port override:

```bash
cd /Users/jqsf/Desktop/code/web_reader && API_PORT=8070 make api
```

Then launch the Android app with the emulator base URL:

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/mobile && EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8070 npm run android
```

Expected: the loading screen appears first, then the auth route group, then the signed-in shell after a successful login.

- [ ] **Step 3: Commit the auth milestone**

```bash
git add services/api/app/core/config.py services/api/app/schemas/auth.py services/api/app/services/auth_service.py services/api/app/api/routes/auth.py services/api/tests/test_auth_api.py apps/mobile
git commit -m "feat: finish android auth flow"
```
