import type { ExtractedArticle } from "./types";
import { PAGEALONG_API_BASE_URL, PAGEALONG_WEB_BASE_URL, getExtensionVersion } from "./config";

export type PageAlongUser = {
  id: string;
  email?: string;
};

export type SyncedCourse = {
  id: string;
  status: string;
  title?: string;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    let message = fallback;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail.trim()) {
        message = body.detail;
      }
    } catch {
      message = fallback;
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export class PageAlongClient {
  private readonly apiBaseUrl: string;
  private readonly webBaseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    apiBaseUrl = PAGEALONG_API_BASE_URL,
    webBaseUrl = PAGEALONG_WEB_BASE_URL,
    fetchImpl: typeof fetch = fetch
  ) {
    this.apiBaseUrl = trimTrailingSlash(apiBaseUrl);
    this.webBaseUrl = trimTrailingSlash(webBaseUrl);
    this.fetchImpl = ((...args: Parameters<typeof fetch>) => fetchImpl(...args)) as typeof fetch;
  }

  async me(): Promise<PageAlongUser> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}/auth/me`, {
      method: "GET",
      headers: {},
      credentials: "include"
    });
    return readJson<PageAlongUser>(response, "未登录 PageAlong");
  }

  async syncArticle(article: ExtractedArticle): Promise<SyncedCourse> {
    return this.syncPayload({
      url: article.url,
      title: article.title,
      article_html: article.articleHtml,
      text_excerpt: article.textExcerpt,
      images: article.images.map((image) => ({
        url: image.url,
        alt: image.alt,
        width: image.width,
        height: image.height,
        nearby_text: image.nearbyText
      })),
      client_metadata: {
        extension_version: getExtensionVersion(),
        extractor_version: "browser-v1",
        source: "desktop_extension"
      }
    });
  }

  async syncUrl(url: string, title = ""): Promise<SyncedCourse> {
    return this.syncPayload({
      url,
      title,
      article_html: "",
      text_excerpt: "",
      images: [],
      client_metadata: {
        extension_version: getExtensionVersion(),
        extractor_version: "browser-v1",
        source: "desktop_extension_url_only"
      }
    });
  }

  private async syncPayload(payload: {
    url: string;
    title: string;
    article_html: string;
    text_excerpt: string;
    images: Array<{
      url: string;
      alt: string;
      width?: number;
      height?: number;
      nearby_text: string;
    }>;
    client_metadata: Record<string, string>;
  }): Promise<SyncedCourse> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}/courses/import-url/extension-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    return readJson<SyncedCourse>(response, "同步到 PageAlong 失败");
  }

  loginUrl(nextUrl: string): string {
    const url = new URL("zh/login", `${this.webBaseUrl}/`);
    url.searchParams.set("next", nextUrl);
    return url.toString();
  }

  courseUrl(courseId: string, locale = "zh"): string {
    return new URL(`${locale}/courses/${courseId}`, `${this.webBaseUrl}/`).toString();
  }
}
