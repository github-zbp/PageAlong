from __future__ import annotations

import bleach
import markdown

ALLOWED_TAGS = [
    "a",
    "abbr",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "span",
    "strong",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "ul",
]
ALLOWED_ATTRIBUTES = {
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "title"],
    "th": ["align"],
    "td": ["align"],
}
ALLOWED_PROTOCOLS = ["http", "https", "mailto"]


def sanitize_html(html: str) -> str:
    cleaned = bleach.clean(
        html or "",
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
    )
    return bleach.linkify(cleaned, callbacks=[_safe_link_attrs])


def render_markdown_to_safe_html(markdown_text: str) -> str:
    raw_html = markdown.markdown(
        markdown_text or "",
        extensions=["extra", "sane_lists", "nl2br"],
        output_format="html5",
    )
    return sanitize_html(raw_html)


def _safe_link_attrs(attrs, new=False):
    href_key = (None, "href")
    if href_key in attrs:
        attrs[(None, "target")] = "_blank"
        attrs[(None, "rel")] = "noopener noreferrer"
    return attrs
