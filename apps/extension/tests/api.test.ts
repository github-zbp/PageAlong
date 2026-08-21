import { describe, expect, it, vi } from "vitest";
import { PageAlongClient } from "../src/lib/api";

describe("PageAlongClient", () => {
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

  it("calls injected fetch without binding the client instance", async () => {
    const fetchMock = vi.fn(function (this: unknown) {
      expect(this).toBeUndefined();
      return Promise.resolve(new Response(JSON.stringify({ id: "user_1" }), { status: 200 }));
    });
    const client = new PageAlongClient("http://localhost:8070", "http://localhost:3000", fetchMock as unknown as typeof fetch);

    const user = await client.me();

    expect(user.id).toBe("user_1");
  });

  it("submits extension sync payload", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "course_1", status: "extracting_text" }), { status: 201 }));
    const client = new PageAlongClient("http://localhost:8070", "http://localhost:3000", fetchMock as unknown as typeof fetch);

    const course = await client.syncArticle({
      url: "https://example.com/a",
      title: "标题",
      sourceDomain: "example.com",
      articleHtml: "<p>第一句。</p>",
      textExcerpt: "第一句。",
      images: [],
      sentences: [{ index: 0, text: "第一句。" }]
    });

    expect(course.id).toBe("course_1");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<string, unknown>;
    expect(body.url).toBe("https://example.com/a");
    expect(body.article_html).toBe("<p>第一句。</p>");
    expect(body.client_metadata).toMatchObject({
      extension_version: "0.1.0",
      extractor_version: "browser-v1"
    });
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
