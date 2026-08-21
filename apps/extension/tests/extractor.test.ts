import { describe, expect, it } from "vitest";
import { extractArticleFromDocument } from "../src/lib/extractor";

describe("extractArticleFromDocument", () => {
  it("extracts article text and image candidates", () => {
    document.body.innerHTML = `
      <nav>首页 登录</nav>
      <article>
        <h1>正文标题</h1>
        <p>第一段正文内容足够长，用来验证剪藏。</p>
        <p>第二段正文继续补充内容，保持可读。</p>
        <img src="https://example.com/hero.png" alt="配图" width="800" height="400">
      </article>
    `;
    Object.defineProperty(document, "title", { value: "页面标题", configurable: true });

    const result = extractArticleFromDocument(document, new URL("https://example.com/a"));

    expect(result.title).toBe("正文标题");
    expect(result.sourceDomain).toBe("example.com");
    expect(result.textExcerpt).toContain("第一段正文内容足够长");
    expect(result.images[0].url).toBe("https://example.com/hero.png");
    expect(result.sentences.length).toBeGreaterThan(1);
  });
});
