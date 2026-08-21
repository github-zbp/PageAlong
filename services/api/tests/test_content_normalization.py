from app.services.content_normalization import (
    NormalizedContent,
    content_hash,
    derive_tts_text,
    normalize_markdown,
    score_markdown_quality,
)


def test_normalize_markdown_removes_boilerplate_sections_but_keeps_article_structure():
    markdown = """
# 标题

第一段正文，包含足够的信息。

## 相关阅读

- 广告链接
- 推荐文章

## 正文小节

- 要点一
- 要点二
"""

    normalized = normalize_markdown(markdown)

    assert "# 标题" in normalized
    assert "第一段正文" in normalized
    assert "## 正文小节" in normalized
    assert "相关阅读" not in normalized
    assert "广告链接" not in normalized


def test_derive_tts_text_omits_code_blocks_urls_and_image_markup():
    markdown = """
# 标题

阅读 [官网](https://example.com/path) 的正文。

![无意义图片](https://example.com/a.png)

```python
print("不要朗读")
```

结尾一句。
"""

    text = derive_tts_text(markdown)

    assert text == "标题\n\n阅读 官网 的正文。\n\n结尾一句。"


def test_derive_tts_text_strips_inline_markdown_markup():
    markdown = "**重点**第一句，包含 *斜体*、__粗体__、`行内代码` 和 ~~删除线~~。"

    text = derive_tts_text(markdown)

    assert text == "重点第一句，包含 斜体、粗体、行内代码 和 删除线。"
    assert "*" not in text
    assert "_" not in text
    assert "`" not in text
    assert "~" not in text


def test_score_markdown_quality_rejects_short_or_link_heavy_content():
    low = score_markdown_quality("[首页](https://example.com) [登录](https://example.com/login)")
    high = score_markdown_quality("# 标题\n\n这是一个较长的正文段落，用于说明文章内容，而不是导航或广告。" * 5)

    assert low.is_usable is False
    assert low.reason == "link_heavy"
    assert high.is_usable is True
    assert high.character_count > 100


def test_content_hash_is_stable_for_equivalent_whitespace():
    assert content_hash("第一段。\n\n第二段。") == content_hash(" 第一段。\n\n\n第二段。 ")


def test_normalized_content_dataclass_carries_markdown_text_and_score():
    content = NormalizedContent.from_markdown("# 标题\n\n这是正文。" * 10)

    assert content.content_markdown.startswith("# 标题")
    assert "标题" in content.tts_text
    assert content.content_hash
    assert content.quality.character_count > 20
