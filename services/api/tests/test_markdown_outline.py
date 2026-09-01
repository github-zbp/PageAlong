from app.services.markdown_outline import build_markdown_outline, decode_markdown_outline, encode_markdown_outline


def test_build_markdown_outline_extracts_h1_to_h4_and_skips_deeper_headings():
    outline = build_markdown_outline(
        "# 一级\n\n"
        "正文\n\n"
        "## 二级\n\n"
        "### 三级\n\n"
        "#### 四级\n\n"
        "##### 五级\n\n"
        "###### 六级\n"
    )

    assert [(item.depth, item.title) for item in outline] == [
        (1, "一级"),
        (2, "二级"),
        (3, "三级"),
        (4, "四级"),
    ]


def test_build_markdown_outline_ignores_headings_inside_fenced_code_blocks():
    outline = build_markdown_outline(
        "# 可见标题\n\n"
        "```markdown\n"
        "# 代码里的标题\n"
        "```\n\n"
        "## 仍然可见\n"
    )

    assert [(item.depth, item.title) for item in outline] == [
        (1, "可见标题"),
        (2, "仍然可见"),
    ]


def test_build_markdown_outline_cleans_inline_markdown_and_duplicate_ids():
    outline = build_markdown_outline(
        "## **Install** `[CLI](https://example.com)` ###\n\n"
        "## Install CLI\n\n"
        "## ![图](https://example.com/a.png) Install CLI\n"
    )

    assert [item.title for item in outline] == ["Install CLI", "Install CLI", "Install CLI"]
    assert [item.id for item in outline] == [
        "heading-install-cli",
        "heading-install-cli-2",
        "heading-install-cli-3",
    ]


def test_encode_and_decode_markdown_outline_round_trips_valid_items():
    outline = build_markdown_outline("# 标题\n\n## 小节")

    assert decode_markdown_outline(encode_markdown_outline(outline)) == outline
    assert decode_markdown_outline("not-json") == []
