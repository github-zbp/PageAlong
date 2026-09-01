jest.mock("@/lib/session-store", () => ({
  clearSessionToken: jest.fn(),
  getSessionToken: jest.fn(() => "session-token"),
  setSessionToken: jest.fn()
}));

jest.mock("@/lib/auth-storage", () => ({
  clearAuthToken: jest.fn()
}));

import { logoutAllSessions, logoutSession, submitFeedback } from "@/lib/api";

const mockedFetch = jest.fn();

beforeEach(() => {
  mockedFetch.mockReset();
  (global as typeof globalThis & { fetch: typeof mockedFetch }).fetch = mockedFetch;
});

it("submits feedback to the existing backend endpoint", async () => {
  mockedFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

  await submitFeedback({
    category: "suggestion",
    summary: "移动端建议",
    message: "希望阅读页更安静",
    pagePath: "/mobile/me"
  });

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.stringContaining("/feedback"),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        category: "suggestion",
        summary: "移动端建议",
        message: "希望阅读页更安静",
        page_path: "/mobile/me"
      })
    })
  );
});

it("calls logout for the current session", async () => {
  mockedFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

  await logoutSession();

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.stringContaining("/auth/logout"),
    expect.objectContaining({ method: "POST" })
  );
});

it("calls logout all sessions", async () => {
  mockedFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

  await logoutAllSessions();

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.stringContaining("/auth/logout-all"),
    expect.objectContaining({ method: "POST" })
  );
});
