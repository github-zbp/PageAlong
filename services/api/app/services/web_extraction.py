from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse

import trafilatura
from markdownify import markdownify as html_to_markdown
from readability import Document

from app.services.content_normalization import NormalizedContent


class ExtractionError(RuntimeError):
    def __init__(self, message: str, code: str = "extractor_failure"):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ExtractedArticle:
    title: str
    extractor: str
    normalized: NormalizedContent
    source_metadata: dict[str, object]
    extraction_metadata: dict[str, object]


def extract_with_trafilatura(html: str, url: str) -> str:
    extracted = trafilatura.extract(
        html,
        url=url,
        output_format="markdown",
        include_comments=False,
        include_tables=True,
        include_images=True,
        favor_precision=True,
    )
    return extracted or ""


def extract_with_readability(html: str) -> tuple[str, str]:
    document = Document(html)
    title = document.short_title() or ""
    summary_html = document.summary(html_partial=True)
    return html_to_markdown(summary_html, heading_style="ATX"), title


def extract_article_content(html: str, *, original_url: str, final_url: str) -> ExtractedArticle:
    attempts: list[dict[str, object]] = []

    trafilatura_markdown = extract_with_trafilatura(html, final_url)
    trafilatura_content = NormalizedContent.from_markdown(trafilatura_markdown) if trafilatura_markdown else None
    if trafilatura_content is not None:
        attempts.append({"extractor": "trafilatura", "quality": trafilatura_content.quality.reason})
        if trafilatura_content.quality.is_usable:
            return build_extracted_article("trafilatura", trafilatura_content, html, original_url, final_url, attempts)

    readability_markdown, readability_title = extract_with_readability(html)
    readability_content = NormalizedContent.from_markdown(readability_markdown) if readability_markdown else None
    if readability_content is not None:
        attempts.append({"extractor": "readability", "quality": readability_content.quality.reason})
        if readability_content.quality.is_usable:
            return build_extracted_article(
                "readability",
                readability_content,
                html,
                original_url,
                final_url,
                attempts,
                title_override=readability_title,
            )

    raise ExtractionError("Could not extract enough article content from this URL", code="low_confidence_extraction")


def extract_extension_article_content(
    *,
    article_html: str,
    text_excerpt: str,
    title: str,
    original_url: str,
    final_url: str,
    client_metadata: dict[str, object] | None = None,
) -> ExtractedArticle:
    markdown = html_to_markdown(article_html or "", heading_style="ATX").strip()
    if not markdown and text_excerpt.strip():
        markdown = text_excerpt.strip()

    content = NormalizedContent.from_markdown(markdown)
    excerpt = text_excerpt.strip()
    if not content.quality.is_usable and excerpt and excerpt not in markdown:
        combined_markdown = f"{markdown}\n\n{excerpt}".strip()
        combined_content = NormalizedContent.from_markdown(combined_markdown)
        if combined_content.quality.is_usable:
            markdown = combined_markdown
            content = combined_content

    attempts = [{"extractor": "extension_payload", "quality": content.quality.reason}]
    if not content.quality.is_usable:
        raise ExtractionError(
            "Extension payload did not contain enough article content",
            code="low_confidence_extension_payload",
        )

    fallback_html = article_html or f"<html><head><title>{title}</title></head><body>{text_excerpt}</body></html>"
    article = build_extracted_article(
        "extension_payload",
        content,
        fallback_html,
        original_url,
        final_url,
        attempts,
        title_override=title,
    )
    metadata = dict(client_metadata or {})
    article.source_metadata.update(
        {
            "extractor": "extension_payload",
            "extension_version": str(metadata.get("extension_version") or ""),
            "browser_extractor_version": str(metadata.get("extractor_version") or ""),
        }
    )
    article.extraction_metadata["client_metadata"] = metadata
    return article


def build_extracted_article(
    extractor: str,
    content: NormalizedContent,
    html: str,
    original_url: str,
    final_url: str,
    attempts: list[dict[str, object]],
    title_override: str = "",
) -> ExtractedArticle:
    document = Document(html)
    title = title_override or document.short_title() or first_markdown_heading(content.content_markdown) or "未命名网页"
    parsed = urlparse(final_url)
    source_metadata = {
        "source_kind": "url",
        "locator": original_url,
        "canonical_locator": final_url,
        "final_url": final_url,
        "source_domain": parsed.netloc,
        "author": "",
        "published_at": "",
        "extractor": extractor,
    }
    extraction_metadata = {
        "extractor": extractor,
        "attempts": attempts,
        "quality": {
            "is_usable": content.quality.is_usable,
            "reason": content.quality.reason,
            "character_count": content.quality.character_count,
            "link_count": content.quality.link_count,
            "link_density": content.quality.link_density,
        },
    }
    return ExtractedArticle(title, extractor, content, source_metadata, extraction_metadata)


def first_markdown_heading(markdown: str) -> str:
    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip()
    return ""
