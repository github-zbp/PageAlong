import { afterEach, describe, expect, it, vi } from "vitest";
import { PageAlongClient } from "../src/lib/api";

describe("PageAlongClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("checks current user with credentials", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "user_1" }), { status: 200 }));
    const client = new PageAlongClient("http://localhost:8070", "http://localhost:3000", fetchMock as unknown as typeof fetch);

    const user = await client.me();

    expect(user.id).toBe("user_1");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8070/auth/me", {
      credentials: "include",
      headers: {},
      method: "GET"
    });
  });

  it("reads the PageAlong session cookie and sends it as bearer auth", async () => {
    const cookieGet = vi.fn(async () => ({ value: "session-token-1" } as chrome.cookies.Cookie));
    vi.stubGlobal("chrome", {
      cookies: {
        get: cookieGet
      }
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "user_1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "course_1", status: "extracting_text" }), { status: 201 }));
    const client = new PageAlongClient("http://localhost:8070", "http://localhost:3000", fetchMock as unknown as typeof fetch);

    const user = await client.me();
    const course = await client.syncUrl("https://example.com/a", "标题");

    expect(user.id).toBe("user_1");
    expect(course.id).toBe("course_1");
    expect(cookieGet).toHaveBeenCalledTimes(2);
    expect(cookieGet).toHaveBeenNthCalledWith(1, {
      url: "http://localhost:8070/",
      name: "pagealong_session"
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: "include",
      headers: {
        Authorization: "Bearer session-token-1"
      },
      method: "GET"
    });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      credentials: "include",
      headers: {
        Authorization: "Bearer session-token-1",
        "Content-Type": "application/json"
      },
      method: "POST"
    });
  });

  it("calls injected fetch without binding the client instance", async () => {
    const fetchMock = vi.fn(function (this: unknown) {
      expect(this).toBeUndefined();
      return Promise.resolve(new Response(JSON.stringify({ id: "user_1" }), { status: 200 }));
    });
    const client = new PageAlongClient("http://localhost:8070", "http://localhost:3000", fetchMock as unknown as typeof fetch);

    const user = await client.me();

    expect(user.id).toBe("user_1");
  });

  it("does not expose article-based sync", () => {
    const client = new PageAlongClient("http://localhost:8070", "http://localhost:3000");

    expect("syncArticle" in client).toBe(false);
  });

  it("submits url-only sync payloads", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "course_2", status: "extracting_text" }), { status: 201 }));
    const client = new PageAlongClient("http://localhost:8070", "http://localhost:3000", fetchMock as unknown as typeof fetch);

    await client.syncUrl("https://example.com/a", "标题");

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<string, unknown>;
    expect(body.url).toBe("https://example.com/a");
    expect(body.article_html).toBe("");
    expect(body.text_excerpt).toBe("");
    expect(body.images).toEqual([]);
  });

  it("builds login URLs from the web base", () => {
    const client = new PageAlongClient("http://localhost:8070", "http://localhost:3000");

    expect(client.loginUrl("https://example.com/a")).toBe(
      "http://localhost:3000/zh/login?next=https%3A%2F%2Fexample.com%2Fa"
    );
  });

  it("builds course URLs from the web base", () => {
    const client = new PageAlongClient("http://localhost:8070", "http://localhost:3000");

    expect(client.courseUrl("course_1")).toBe("http://localhost:3000/zh/courses/course_1");
  });
});
