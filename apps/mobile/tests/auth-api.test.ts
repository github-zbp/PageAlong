jest.mock("@/lib/session-store", () => ({
  clearSessionToken: jest.fn(),
  getSessionToken: jest.fn(() => "session-token"),
  setSessionToken: jest.fn()
}));

jest.mock("@/lib/auth-storage", () => ({
  clearAuthToken: jest.fn()
}));

import {
  exchangeOneTapLogin,
  exchangeWechatLogin,
  getLoginCapabilities,
  loginWithEmailCode,
  recordDashboardActivity,
  requestEmailCode
} from "@/lib/api";
import { getSessionToken } from "@/lib/session-store";

const mockedFetch = jest.fn();
const mockedGetSessionToken = getSessionToken as jest.MockedFunction<typeof getSessionToken>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

beforeEach(() => {
  mockedFetch.mockReset();
  (global as typeof globalThis & { fetch: typeof mockedFetch }).fetch = mockedFetch;
  mockedGetSessionToken.mockReturnValue("session-token");
});

it("posts login email-code requests to the auth service", async () => {
  mockedFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

  await requestEmailCode({ email: "reader@example.com", purpose: "login" });

  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/auth/email/code",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        email: "reader@example.com",
        purpose: "login"
      })
    })
  );
  expect(mockedFetch.mock.calls[0][1]?.headers).toBeInstanceOf(Headers);
  expect((mockedFetch.mock.calls[0][1]?.headers as Headers).get("Authorization")).toBeNull();
});

it("posts email-code logins to the auth service", async () => {
  mockedFetch.mockResolvedValueOnce(
    jsonResponse({
      token: "token-123",
      user: {
        id: "user-1",
        email: "reader@example.com",
        role: "user",
        status: "active",
        email_verified_at: "2026-08-27T00:00:00.000Z",
        must_change_password_at_next_login: false,
        last_login_at: "2026-08-27T00:00:00.000Z",
        created_at: "2026-08-27T00:00:00.000Z"
      }
    })
  );

  const result = await loginWithEmailCode({ email: "reader@example.com", code: "123456" });

  expect(result.token).toBe("token-123");
  expect(result.user.email).toBe("reader@example.com");
  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/auth/email/login",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        email: "reader@example.com",
        code: "123456"
      })
    })
  );
});

it("posts WeChat exchanges to the auth service", async () => {
  mockedFetch.mockResolvedValueOnce(
    jsonResponse({
      token: "wechat-token",
      user: {
        id: "user-1",
        email: "wechat-reader@example.com",
        role: "user",
        status: "active",
        email_verified_at: "2026-08-27T00:00:00.000Z",
        must_change_password_at_next_login: false,
        last_login_at: "2026-08-27T00:00:00.000Z",
        created_at: "2026-08-27T00:00:00.000Z"
      }
    })
  );

  const result = await exchangeWechatLogin({ code: "wechat-code", state: "abc" });

  expect(result.token).toBe("wechat-token");
  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/auth/wechat/exchange",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        code: "wechat-code",
        state: "abc"
      })
    })
  );
});

it("posts one-tap exchanges to the auth service", async () => {
  mockedFetch.mockResolvedValueOnce(
    jsonResponse({
      token: "one-tap-token",
      user: {
        id: "user-1",
        email: "reader@example.com",
        role: "user",
        status: "active",
        email_verified_at: "2026-08-27T00:00:00.000Z",
        must_change_password_at_next_login: false,
        last_login_at: "2026-08-27T00:00:00.000Z",
        created_at: "2026-08-27T00:00:00.000Z"
      }
    })
  );

  const result = await exchangeOneTapLogin({ credential: "credential-123", provider: "cmcc" });

  expect(result.token).toBe("one-tap-token");
  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/auth/one-tap/exchange",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        credential: "credential-123",
        provider: "cmcc"
      })
    })
  );
});

it("fetches login capabilities without auth headers", async () => {
  mockedFetch.mockResolvedValueOnce(
    jsonResponse({
      email_password: true,
      email_code: true,
      wechat: false,
      one_tap: false
    })
  );

  const result = await getLoginCapabilities();

  expect(result).toEqual({
    email_password: true,
    email_code: true,
    wechat: false,
    one_tap: false
  });
  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/auth/capabilities",
    expect.objectContaining({
      cache: "no-store"
    })
  );
  expect(mockedFetch.mock.calls[0][1]?.headers).toBeInstanceOf(Headers);
  expect((mockedFetch.mock.calls[0][1]?.headers as Headers).get("Authorization")).toBeNull();
});

it("posts dashboard activity updates to the auth service", async () => {
  mockedFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

  await recordDashboardActivity("zh");

  expect(mockedFetch).toHaveBeenCalledWith(
    "http://10.0.2.2:8070/auth/me/dashboard-activity",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        locale: "zh"
      })
    })
  );
  expect(mockedFetch.mock.calls[0][1]?.headers).toBeInstanceOf(Headers);
  expect((mockedFetch.mock.calls[0][1]?.headers as Headers).get("Authorization")).toBe("Bearer session-token");
});
