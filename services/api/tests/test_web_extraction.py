import pytest

from app.services.web_extraction import ExtractionError, extract_article_content, extract_with_trafilatura

ARTICLE_HTML = """
<html>
  <head><title>网页标题</title></head>
  <body>
    <nav>首页 登录</nav>
    <article>
      <h1>正文标题</h1>
      <p>这是第一段正文，包含足够多的文字用于通过质量检测。</p>
      <p>这是第二段正文，继续解释文章的关键内容。</p>
      <p>这是第三段正文，用来补充足够的字符数量，避免被误判为太短。</p>
      <pre><code>print('代码保留但不朗读')</code></pre>
    </article>
    <section><h2>相关阅读</h2><a href="/ad">广告</a></section>
  </body>
</html>
"""


def test_extract_article_content_uses_extractor_for_markdown_and_metadata():
    result = extract_article_content(
        ARTICLE_HTML,
        original_url="https://example.com/a",
        final_url="https://example.com/a",
    )

    assert result.extractor in {"trafilatura", "readability"}
    assert "正文标题" in result.normalized.content_markdown
    assert "第一段正文" in result.normalized.tts_text
    assert "相关阅读" not in result.normalized.content_markdown
    assert result.source_metadata["locator"] == "https://example.com/a"


def test_extract_article_content_uses_readability_when_trafilatura_is_low_quality(monkeypatch):
    monkeypatch.setattr("app.services.web_extraction.extract_with_trafilatura", lambda *args, **kwargs: "登录 首页")

    result = extract_article_content(
        ARTICLE_HTML,
        original_url="https://example.com/a",
        final_url="https://example.com/a",
    )

    assert result.extractor == "readability"
    assert "正文标题" in result.normalized.content_markdown


def test_extract_article_content_rejects_low_quality_pages():
    with pytest.raises(ExtractionError) as exc_info:
        extract_article_content(
            "<html><body><a>首页</a><a>登录</a></body></html>",
            original_url="https://example.com",
            final_url="https://example.com",
        )

    assert exc_info.value.code == "low_confidence_extraction"


def test_extract_with_trafilatura_preserves_article_images(monkeypatch):
    captured = {}

    def fake_extract(*args, **kwargs):
        captured.update(kwargs)
        return "![配图](/image.png)\n\n这是一段正文内容。"

    monkeypatch.setattr("app.services.web_extraction.trafilatura.extract", fake_extract)

    markdown = extract_with_trafilatura("<html></html>", "https://example.com/a")

    assert captured["include_images"] is True
    assert "![配图](/image.png)" in markdown


def test_extract_extension_article_content_normalizes_html_and_metadata():
    from app.services.web_extraction import extract_extension_article_content

    result = extract_extension_article_content(
        article_html="""
        <article>
          <h1>浏览器正文</h1>
          <p>第一段正文内容足够长，用来验证插件提供的正文也会走统一归一化流程。</p>
          <p>第二段继续补充正文，避免质量检测因为内容过短而失败。</p>
          <img src="/hero.png" alt="配图">
        </article>
        """,
        text_excerpt="浏览器正文 第一段正文内容足够长 第二段继续补充正文",
        title="插件标题",
        original_url="https://example.com/article",
        final_url="https://example.com/article",
        client_metadata={"extension_version": "0.1.0", "extractor_version": "browser-v1"},
    )

    assert result.extractor == "extension_payload"
    assert result.title == "插件标题"
    assert "浏览器正文" in result.normalized.content_markdown
    assert "第一段正文内容足够长" in result.normalized.tts_text
    assert result.source_metadata["source_kind"] == "url"
    assert result.source_metadata["extension_version"] == "0.1.0"
    assert result.extraction_metadata["extractor"] == "extension_payload"
    assert result.extraction_metadata["quality"]["is_usable"] is True


def test_extract_extension_article_content_rejects_low_quality_payload():
    from app.services.web_extraction import ExtractionError, extract_extension_article_content

    with pytest.raises(ExtractionError) as exc_info:
        extract_extension_article_content(
            article_html="<nav>首页 登录</nav>",
            text_excerpt="首页 登录",
            title="低质量页面",
            original_url="https://example.com/thin",
            final_url="https://example.com/thin",
            client_metadata={"extension_version": "0.1.0"},
        )

    assert exc_info.value.code == "low_confidence_extension_payload"
