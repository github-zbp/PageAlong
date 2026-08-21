# URL Import Content Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build first-phase public URL import that extracts article content with Trafilatura plus Readability fallback, normalizes it to reader Markdown, shows the cleaned result for user confirmation, and only then hands off to the existing audio generation flow.

**Architecture:** Extend `ArticleText` into the canonical content version by adding Markdown and metadata fields while keeping `text` as TTS text. Add focused backend services for URL safety, fetching, extraction, Markdown normalization, and course persistence; expose a dedicated `/courses/import-url` route and a worker task that runs the import asynchronously. Update the web import surface into route-backed tabs and make the URL tab responsible for polling the extracted content, showing the cleaned Markdown preview, and triggering audio generation only after user confirmation.

**Tech Stack:** FastAPI, SQLAlchemy, Celery, PostgreSQL/SQLite tests, `httpx`, `trafilatura`, `readability-lxml`, `markdownify`, Next.js 13, React 18, Playwright.

---

## Confirmed Reader UX

The course detail reader should no longer present a separate visible sentence list. The Markdown reading area is the primary body, sentence rows are retained as audio timeline data, the current spoken sentence is highlighted inline inside Markdown, and the audio player stays pinned to the viewport bottom while scrolling.

## Confirmed Import UX

The import area should be route-backed tabs instead of one stacked page. Text import, URL import, file upload, and extension import each get their own page. The URL tab must stop after cleanup, show a preview of the cleaned Markdown and source summary, and only start audio generation once the user confirms.

## 2026-07-24 Iteration Update

The implementation now uses `needs_review` as the post-extraction URL import state. The URL import worker persists cleaned Markdown, TTS text, source metadata, and sentences, then stops. `POST /courses/{course_id}/audio-generation` is reused as the confirmation action; when called for an unconfirmed URL import, it marks the latest `ArticleText.confirmed_by_user` true and queues the existing TTS job.

## File Structure

Backend files:

- Modify `services/api/pyproject.toml`: runtime dependencies for `httpx`, `trafilatura`, `readability-lxml`, `lxml`, and `markdownify`.
- Modify `Makefile`: keep `make deps` aligned with API runtime dependencies.
- Modify `services/api/app/models/course.py`: add `ArticleText.content_markdown`, `content_hash`, `source_metadata_json`, and `extraction_metadata_json`.
- Modify `services/api/app/models/generation_job.py`: add `JobType.URL_IMPORT` and a generic `input_json` payload field for import task input.
- Modify `scripts/init_database.py`: ensure new `article_texts` columns on existing databases.
- Modify `services/api/app/schemas/course.py`: add `CourseUrlImportCreate`, `CourseSourceRead`, and `CourseRead.content_markdown`.
- Modify `services/api/app/services/course_service.py`: add helpers to create URL-import placeholder courses, persist normalized content, and request audio generation.
- Create `services/api/app/services/content_normalization.py`: Markdown cleanup, TTS text derivation, quality scoring, hashing.
- Create `services/api/app/services/url_safety.py`: URL scheme, host, DNS, and IP safety checks.
- Create `services/api/app/services/web_fetcher.py`: `httpx` fetch wrapper with timeout, size limit, and redirect safety.
- Create `services/api/app/services/web_extraction.py`: Trafilatura primary extraction and Readability fallback.
- Create `services/api/app/services/url_import_service.py`: orchestrates import job execution.
- Modify `services/api/app/api/routes/courses.py`: add `POST /courses/import-url` and serialize Markdown/source summary.
- Modify `services/api/app/worker_client.py`: add `enqueue_url_import`.
- Create `services/api/app/cli/import_url.py`: CLI worker entry point.

Worker files:

- Create `services/worker/app/tasks/import_url.py`: Celery task that shells into the API CLI, matching the current audio task pattern.
- Modify `services/worker/app/celery_app.py`: register the URL import task.
- Modify `services/worker/tests/test_celery_app_registration.py`: assert both worker task names register.

Frontend files:

- Modify `apps/web/src/lib/types.ts`: add `content_markdown` and `source`.
- Modify `apps/web/src/lib/api.ts`: add `createUrlCourse` and `requestCourseAudioGeneration`.
- Modify `apps/web/src/lib/i18n.ts`: add URL import and reader copy.
- Create `apps/web/src/components/ImportUrlForm.tsx`: URL import form.
- Modify `apps/web/src/app/[locale]/import/page.tsx`: redirect `/import` to the text tab.
- Create `apps/web/src/app/[locale]/import/[tab]/page.tsx`: route-backed text, URL, file, and extension import tabs.
- Create `apps/web/src/components/CourseReviewActions.tsx`: confirm a reviewed URL course from the detail page.
- Create `apps/web/src/components/MarkdownReader.tsx`: safe minimal renderer for supported Markdown.
- Modify `apps/web/src/components/CoursePlayer.tsx` and `apps/web/src/components/CourseReadingWorkspace.tsx`: make Markdown the main reading surface, highlight the active sentence in Markdown, and keep the audio player fixed to the viewport bottom.
- Modify `apps/web/tests/course-flow.spec.ts`: cover URL form and Markdown rendering.

---

### Task 1: Content Version Schema

**Files:**
- Modify: `services/api/app/models/course.py`
- Modify: `services/api/app/models/generation_job.py`
- Modify: `scripts/init_database.py`
- Modify: `services/api/app/schemas/course.py`
- Test: `services/api/tests/test_models.py`
- Test: `services/api/tests/test_init_database.py`

- [ ] **Step 1: Write failing model tests**

Append to `services/api/tests/test_models.py`:

```python
from app.models.course import ArticleText
from app.models.generation_job import JobType


def test_article_text_defaults_support_normalized_content():
    article_text = ArticleText(course_id="course_1", text="正文")

    assert article_text.content_markdown == "正文"
    assert article_text.content_hash == ""
    assert article_text.source_metadata_json == "{}"
    assert article_text.extraction_metadata_json == "{}"


def test_generation_job_supports_url_import_type():
    assert JobType.URL_IMPORT.value == "url_import"


def test_generation_job_defaults_support_generic_input_payload():
    from app.models.generation_job import GenerationJob

    job = GenerationJob(course_id="course_1", job_type=JobType.URL_IMPORT)

    assert job.input_json == "{}"
```

- [ ] **Step 2: Run model tests and verify failure**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_models.py -q
```

Expected: fails because `ArticleText` does not have the new columns and `JobType.URL_IMPORT` is missing.

- [ ] **Step 3: Add model fields**

In `services/api/app/models/course.py`, replace `ArticleText` with:

```python
class ArticleText(Base):
    __tablename__ = "article_texts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    text: Mapped[str] = mapped_column(Text)
    content_markdown: Mapped[str] = mapped_column(Text, default="")
    content_hash: Mapped[str] = mapped_column(String(128), default="")
    source_metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    extraction_metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    source_quality: Mapped[str] = mapped_column(String(64), default="trusted")
    confirmed_by_user: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    course: Mapped[Course] = relationship(back_populates="article_texts")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.content_markdown is None or self.content_markdown == "":
            self.content_markdown = self.text or ""
        if self.content_hash is None:
            self.content_hash = ""
        if self.source_metadata_json is None:
            self.source_metadata_json = "{}"
        if self.extraction_metadata_json is None:
            self.extraction_metadata_json = "{}"
        if self.source_quality is None:
            self.source_quality = "trusted"
        if self.confirmed_by_user is None:
            self.confirmed_by_user = True
```

In `services/api/app/models/generation_job.py`, replace `JobType` with:

```python
class JobType(str, enum.Enum):
    SENTENCE_SEGMENT = "sentence_segment"
    URL_IMPORT = "url_import"
    TTS_GENERATE = "tts_generate"
    AUDIO_CONCAT = "audio_concat"
```

Add a generic payload field to `GenerationJob`:

```python
input_json: Mapped[str] = mapped_column(Text, default="{}")
```

Update `GenerationJob.__init__`:

```python
def __init__(self, **kwargs):
    super().__init__(**kwargs)
    if self.status is None:
        self.status = JobStatus.PENDING
    if self.attempt_count is None:
        self.attempt_count = 0
    if self.speed_factor is None:
        self.speed_factor = 1.0
    if self.input_json is None:
        self.input_json = "{}"
    if self.progress_current is None:
        self.progress_current = 0
    if self.progress_total is None:
        self.progress_total = 0
```

- [ ] **Step 4: Extend database initialization**

In `scripts/init_database.py`, add this function after `ensure_course_library_schema`:

```python
def ensure_article_text_schema(engine: Engine) -> None:
    with engine.begin() as connection:
        table_names = set(inspect(connection).get_table_names())
        if "article_texts" not in table_names:
            return
        _ensure_columns(
            connection,
            "article_texts",
            {
                "content_markdown": "TEXT NOT NULL DEFAULT ''",
                "content_hash": "VARCHAR(128) NOT NULL DEFAULT ''",
                "source_metadata_json": "TEXT NOT NULL DEFAULT '{}'",
                "extraction_metadata_json": "TEXT NOT NULL DEFAULT '{}'",
            },
        )
```

Call it from `create_application_tables`:

```python
def create_application_tables(engine: Engine) -> None:
    import app.models  # noqa: F401
    from app.db.base import Base

    Base.metadata.create_all(bind=engine)
    ensure_course_library_schema(engine)
    ensure_article_text_schema(engine)
    ensure_tts_schema(engine)
```

Inside the existing `ensure_tts_schema` `generation_jobs` column map, add:

```python
"input_json": "TEXT NOT NULL DEFAULT '{}'",
```

- [ ] **Step 5: Extend API schemas**

In `services/api/app/schemas/course.py`, add:

```python
class CourseSourceRead(BaseModel):
    source_kind: str | None = None
    locator: str | None = None
    canonical_locator: str | None = None
    final_url: str | None = None
    source_domain: str | None = None
    author: str | None = None
    published_at: str | None = None
```

Add to `CourseRead`:

```python
content_markdown: str | None = None
source: CourseSourceRead | None = None
import_status: str | None = None
import_error_code: str | None = None
import_error_message: str | None = None
```

Add request schema:

```python
class CourseUrlImportCreate(BaseModel):
    url: str = Field(min_length=1, max_length=4096)
    title: str | None = Field(default=None, max_length=512)
    series_id: str | None = None
    series_title: str | None = Field(default=None, max_length=512)
    tags: list[str] = Field(default_factory=list)
    is_starred: bool = False
```

- [ ] **Step 6: Add init database test**

Append to `services/api/tests/test_init_database.py`:

```python
from sqlalchemy import create_engine, inspect, text

from scripts.init_database import create_application_tables


def test_init_database_adds_article_text_content_columns_to_existing_table():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE article_texts (id VARCHAR(36) PRIMARY KEY, text TEXT NOT NULL)"))

    create_application_tables(engine)

    columns = {column["name"] for column in inspect(engine).get_columns("article_texts")}
    assert "content_markdown" in columns
    assert "content_hash" in columns
    assert "source_metadata_json" in columns
    assert "extraction_metadata_json" in columns


def test_init_database_adds_generation_job_input_payload_column_to_existing_table():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE generation_jobs (id VARCHAR(36) PRIMARY KEY, course_id VARCHAR(36) NOT NULL, job_type VARCHAR(64) NOT NULL)"
            )
        )

    create_application_tables(engine)

    columns = {column["name"] for column in inspect(engine).get_columns("generation_jobs")}
    assert "input_json" in columns
```

- [ ] **Step 7: Run tests**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_models.py tests/test_init_database.py -q
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add services/api/app/models/course.py services/api/app/models/generation_job.py services/api/app/schemas/course.py scripts/init_database.py services/api/tests/test_models.py services/api/tests/test_init_database.py
git commit -m "feat: extend article content version schema"
```

---

### Task 2: Content Normalization

**Files:**
- Create: `services/api/app/services/content_normalization.py`
- Test: `services/api/tests/test_content_normalization.py`

- [ ] **Step 1: Write failing tests**

Create `services/api/tests/test_content_normalization.py`:

```python
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
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_content_normalization.py -q
```

Expected: import error because `content_normalization.py` does not exist.

- [ ] **Step 3: Implement normalization service**

Create `services/api/app/services/content_normalization.py`:

```python
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

BOILERPLATE_HEADING_PATTERN = re.compile(
    r"^(#{1,6}\s*)?(related|recommend|comments|references|相关阅读|推荐阅读|评论|广告|赞助|更多文章|延伸阅读)\b",
    re.IGNORECASE,
)
CODE_BLOCK_PATTERN = re.compile(r"```.*?```", re.DOTALL)
IMAGE_PATTERN = re.compile(r"!\[[^\]]*\]\([^)]*\)")
LINK_PATTERN = re.compile(r"\[([^\]]+)\]\((https?://[^)]+)\)")
RAW_URL_PATTERN = re.compile(r"https?://\S+")


@dataclass(frozen=True)
class ContentQuality:
    is_usable: bool
    reason: str
    character_count: int
    link_count: int
    link_density: float


@dataclass(frozen=True)
class NormalizedContent:
    content_markdown: str
    tts_text: str
    content_hash: str
    quality: ContentQuality

    @classmethod
    def from_markdown(cls, markdown: str) -> "NormalizedContent":
        normalized_markdown = normalize_markdown(markdown)
        tts_text = derive_tts_text(normalized_markdown)
        return cls(
            content_markdown=normalized_markdown,
            tts_text=tts_text,
            content_hash=content_hash(normalized_markdown),
            quality=score_markdown_quality(normalized_markdown),
        )


def normalize_markdown(markdown: str) -> str:
    lines = markdown.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    kept: list[str] = []
    skipping = False
    in_code = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code = not in_code
            if not skipping:
                kept.append(line.rstrip())
            continue
        if not in_code and re.match(r"^#{1,6}\s+", stripped):
            skipping = bool(BOILERPLATE_HEADING_PATTERN.search(stripped.lstrip("#").strip()))
            if skipping:
                continue
        if skipping:
            if not stripped:
                continue
            if re.match(r"^#{1,6}\s+", stripped):
                skipping = bool(BOILERPLATE_HEADING_PATTERN.search(stripped.lstrip("#").strip()))
                if not skipping:
                    kept.append(line.rstrip())
            continue
        kept.append(line.rstrip())
    return re.sub(r"\n{3,}", "\n\n", "\n".join(kept)).strip()


def derive_tts_text(markdown: str) -> str:
    text = CODE_BLOCK_PATTERN.sub("", markdown)
    text = IMAGE_PATTERN.sub("", text)
    text = LINK_PATTERN.sub(r"\1", text)
    text = RAW_URL_PATTERN.sub("", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^>\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def score_markdown_quality(markdown: str) -> ContentQuality:
    text = derive_tts_text(markdown)
    character_count = len(re.sub(r"\s+", "", text))
    link_count = len(LINK_PATTERN.findall(markdown)) + len(RAW_URL_PATTERN.findall(markdown))
    link_density = link_count / max(1, character_count)
    if character_count < 80:
        if link_count >= 2:
            return ContentQuality(False, "link_heavy", character_count, link_count, link_density)
        return ContentQuality(False, "too_short", character_count, link_count, link_density)
    if link_density > 0.03:
        return ContentQuality(False, "link_heavy", character_count, link_count, link_density)
    return ContentQuality(True, "ok", character_count, link_count, link_density)


def content_hash(markdown: str) -> str:
    normalized = re.sub(r"\s+", " ", markdown).strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_content_normalization.py -q
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add services/api/app/services/content_normalization.py services/api/tests/test_content_normalization.py
git commit -m "feat: add content normalization service"
```

---

### Task 3: URL Safety And Fetching

**Files:**
- Create: `services/api/app/services/url_safety.py`
- Create: `services/api/app/services/web_fetcher.py`
- Test: `services/api/tests/test_url_safety.py`
- Test: `services/api/tests/test_web_fetcher.py`

- [ ] **Step 1: Write URL safety tests**

Create `services/api/tests/test_url_safety.py`:

```python
import pytest

from app.services.url_safety import UnsafeUrlError, validate_public_http_url


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "http://localhost:8000/secret",
        "http://127.0.0.1:8000/secret",
        "http://10.0.0.1/admin",
        "http://172.16.0.1/admin",
        "http://192.168.1.1/admin",
        "http://169.254.169.254/latest/meta-data",
    ],
)
def test_validate_public_http_url_rejects_unsafe_targets(monkeypatch, url):
    monkeypatch.setattr("app.services.url_safety.resolve_host_ips", lambda host: ["127.0.0.1"])
    with pytest.raises(UnsafeUrlError):
        validate_public_http_url(url)


def test_validate_public_http_url_allows_public_http_url(monkeypatch):
    monkeypatch.setattr("app.services.url_safety.resolve_host_ips", lambda host: ["93.184.216.34"])

    result = validate_public_http_url("https://example.com/article")

    assert result == "https://example.com/article"
```

- [ ] **Step 2: Write fetcher tests**

Create `services/api/tests/test_web_fetcher.py`:

```python
import httpx
import pytest

from app.services.web_fetcher import FetchResult, WebFetchError, fetch_public_html


def test_fetch_public_html_returns_text_and_metadata(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"content-type": "text/html"}, text="<html><body>正文</body></html>")

    monkeypatch.setattr("app.services.web_fetcher.validate_public_http_url", lambda url: url)
    result = fetch_public_html("https://example.com/article", client=httpx.Client(transport=httpx.MockTransport(handler)))

    assert isinstance(result, FetchResult)
    assert result.status_code == 200
    assert result.final_url == "https://example.com/article"
    assert "正文" in result.html


def test_fetch_public_html_maps_http_403_to_fetch_error(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, text="Forbidden")

    monkeypatch.setattr("app.services.web_fetcher.validate_public_http_url", lambda url: url)

    with pytest.raises(WebFetchError) as exc_info:
        fetch_public_html("https://example.com/private", client=httpx.Client(transport=httpx.MockTransport(handler)))

    assert exc_info.value.code == "http_403"
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_url_safety.py tests/test_web_fetcher.py -q
```

Expected: import errors for missing modules.

- [ ] **Step 4: Implement URL safety**

Create `services/api/app/services/url_safety.py`:

```python
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse, urlunparse


class UnsafeUrlError(ValueError):
    def __init__(self, message: str, code: str = "unsafe_url"):
        super().__init__(message)
        self.code = code


def resolve_host_ips(hostname: str) -> list[str]:
    return list({item[4][0] for item in socket.getaddrinfo(hostname, None)})


def validate_public_http_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme.lower() not in {"http", "https"}:
        raise UnsafeUrlError("Only http and https URLs are supported", code="invalid_scheme")
    if not parsed.hostname:
        raise UnsafeUrlError("URL must include a hostname", code="missing_hostname")
    hostname = parsed.hostname.lower()
    if hostname in {"localhost", "localhost.localdomain"}:
        raise UnsafeUrlError("Localhost URLs are not allowed", code="local_hostname")
    for ip_value in resolve_host_ips(hostname):
        ip = ipaddress.ip_address(ip_value)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
            raise UnsafeUrlError("Private network URLs are not allowed", code="private_network")
    return urlunparse(parsed._replace(fragment=""))
```

- [ ] **Step 5: Implement fetcher**

Create `services/api/app/services/web_fetcher.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from time import monotonic

import httpx

from app.services.url_safety import UnsafeUrlError, validate_public_http_url


class WebFetchError(RuntimeError):
    def __init__(self, message: str, code: str, status_code: int | None = None):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


@dataclass(frozen=True)
class FetchResult:
    original_url: str
    final_url: str
    status_code: int
    content_type: str
    html: str
    elapsed_ms: int


def fetch_public_html(url: str, *, client: httpx.Client | None = None, timeout_seconds: float = 10.0, max_bytes: int = 2_000_000) -> FetchResult:
    started = monotonic()
    try:
        safe_url = validate_public_http_url(url)
    except UnsafeUrlError as exc:
        raise WebFetchError(str(exc), code=exc.code) from exc
    owns_client = client is None
    active_client = client or httpx.Client(timeout=timeout_seconds, follow_redirects=True)
    try:
        response = active_client.get(safe_url, headers={"User-Agent": "PageAlongBot/0.1"})
        final_url = validate_public_http_url(str(response.url))
        if response.status_code >= 400:
            raise WebFetchError(f"URL returned HTTP {response.status_code}", code=f"http_{response.status_code}", status_code=response.status_code)
        content = response.content[: max_bytes + 1]
        if len(content) > max_bytes:
            raise WebFetchError("Fetched page exceeds maximum supported size", code="response_too_large")
        return FetchResult(
            original_url=safe_url,
            final_url=final_url,
            status_code=response.status_code,
            content_type=response.headers.get("content-type", ""),
            html=response.text,
            elapsed_ms=round((monotonic() - started) * 1000),
        )
    except httpx.TimeoutException as exc:
        raise WebFetchError("Fetching URL timed out", code="fetch_timeout") from exc
    except httpx.HTTPError as exc:
        raise WebFetchError(str(exc), code="fetch_error") from exc
    finally:
        if owns_client:
            active_client.close()
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_url_safety.py tests/test_web_fetcher.py -q
git add services/api/app/services/url_safety.py services/api/app/services/web_fetcher.py services/api/tests/test_url_safety.py services/api/tests/test_web_fetcher.py
git commit -m "feat: add safe public web fetcher"
```

Expected: tests pass, then commit succeeds.

---

### Task 4: Web Extraction Pipeline

**Files:**
- Modify: `services/api/pyproject.toml`
- Modify: `Makefile`
- Create: `services/api/app/services/web_extraction.py`
- Test: `services/api/tests/test_web_extraction.py`

- [ ] **Step 1: Add dependency declarations**

In `services/api/pyproject.toml`, ensure these dependencies are in `[project].dependencies`:

```toml
"httpx>=0.27.0",
"lxml>=5.2.0",
"markdownify>=0.13.1",
"readability-lxml>=0.8.1",
"trafilatura>=1.12.2",
```

In `Makefile`, update the API `pip install` command in `deps` to include:

```bash
httpx lxml markdownify readability-lxml trafilatura
```

- [ ] **Step 2: Install API dependencies locally**

Run:

```bash
cd services/api && .venv/bin/python -m pip install httpx lxml markdownify readability-lxml trafilatura
```

Expected: packages install successfully.

- [ ] **Step 3: Write failing extraction tests**

Create `services/api/tests/test_web_extraction.py`:

```python
import pytest

from app.services.web_extraction import ExtractionError, extract_article_content

ARTICLE_HTML = """
<html>
  <head><title>网页标题</title></head>
  <body>
    <nav>首页 登录</nav>
    <article>
      <h1>正文标题</h1>
      <p>这是第一段正文，包含足够多的文字用于通过质量检测。</p>
      <p>这是第二段正文，继续解释文章的关键内容。</p>
      <pre><code>print('代码保留但不朗读')</code></pre>
    </article>
    <section><h2>相关阅读</h2><a href="/ad">广告</a></section>
  </body>
</html>
"""


def test_extract_article_content_uses_extractor_for_markdown_and_metadata():
    result = extract_article_content(ARTICLE_HTML, original_url="https://example.com/a", final_url="https://example.com/a")

    assert result.extractor in {"trafilatura", "readability"}
    assert "正文标题" in result.normalized.content_markdown
    assert "第一段正文" in result.normalized.tts_text
    assert "相关阅读" not in result.normalized.content_markdown
    assert result.source_metadata["locator"] == "https://example.com/a"


def test_extract_article_content_uses_readability_when_trafilatura_is_low_quality(monkeypatch):
    monkeypatch.setattr("app.services.web_extraction.extract_with_trafilatura", lambda *args, **kwargs: "登录 首页")

    result = extract_article_content(ARTICLE_HTML, original_url="https://example.com/a", final_url="https://example.com/a")

    assert result.extractor == "readability"
    assert "正文标题" in result.normalized.content_markdown


def test_extract_article_content_rejects_low_quality_pages():
    with pytest.raises(ExtractionError) as exc_info:
        extract_article_content("<html><body><a>首页</a><a>登录</a></body></html>", original_url="https://example.com", final_url="https://example.com")

    assert exc_info.value.code == "low_confidence_extraction"
```

- [ ] **Step 4: Run tests and verify failure**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_web_extraction.py -q
```

Expected: import error because `web_extraction.py` does not exist.

- [ ] **Step 5: Implement extraction service**

Create `services/api/app/services/web_extraction.py`:

```python
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
        include_images=False,
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
            return build_extracted_article("readability", readability_content, html, original_url, final_url, attempts, title_override=readability_title)

    raise ExtractionError("Could not extract enough article content from this URL", code="low_confidence_extraction")


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
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_web_extraction.py -q
git add Makefile services/api/pyproject.toml services/api/app/services/web_extraction.py services/api/tests/test_web_extraction.py
git commit -m "feat: add article extraction fallback pipeline"
```

Expected: tests pass, then commit succeeds.

---

### Task 5: URL Import API And Backend Orchestration

**Files:**
- Modify: `services/api/app/services/course_service.py`
- Create: `services/api/app/services/url_import_service.py`
- Modify: `services/api/app/api/routes/courses.py`
- Modify: `services/api/app/worker_client.py`
- Test: `services/api/tests/test_url_import_service.py`
- Test: `services/api/tests/test_url_import_api.py`
- Test: `services/api/tests/test_courses_api.py`
- Test: `services/api/tests/test_course_library_api.py`

- [ ] **Step 1: Write service and API tests**

Create `services/api/tests/test_url_import_api.py`:

```python
from app.models.course import Course, CourseStatus, SourceType
from app.models.generation_job import GenerationJob, JobType


def test_create_url_import_course_returns_extracting_course(client, db_session, monkeypatch):
    enqueued = {}
    monkeypatch.setattr(
        "app.api.routes.courses.enqueue_url_import",
        lambda course_id, job_id: enqueued.update({"course_id": course_id, "job_id": job_id}) or "celery-import-id",
    )

    response = client.post("/courses/import-url", json={"url": "https://example.com/article"})

    assert response.status_code == 201
    body = response.json()
    assert body["source_type"] == "url_import"
    assert body["status"] == "extracting_text"
    course = db_session.get(Course, body["id"])
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == course.id).one()
    assert course.source_type == SourceType.URL_IMPORT
    assert course.status == CourseStatus.EXTRACTING_TEXT
    assert job.job_type == JobType.URL_IMPORT
    assert enqueued["course_id"] == course.id


def test_create_url_import_rejects_empty_url(client):
    response = client.post("/courses/import-url", json={"url": ""})

    assert response.status_code == 422
```

Create `services/api/tests/test_url_import_service.py`:

```python
from app.models.course import ArticleText, Course, CourseStatus, SourceType
from app.models.generation_job import GenerationJob, JobStatus, JobType
from app.services.url_import_service import ImportUrlInput, UrlImportService


def test_url_import_service_persists_markdown_text_sentences_and_waits_for_confirmation(db_session, monkeypatch):
    monkeypatch.setattr(
        "app.services.url_import_service.fetch_public_html",
        lambda url: type("Fetch", (), {"original_url": url, "final_url": url, "status_code": 200, "content_type": "text/html", "html": "<html></html>", "elapsed_ms": 1})(),
    )
    monkeypatch.setattr(
        "app.services.url_import_service.extract_article_content",
        lambda html, original_url, final_url: type("Extracted", (), {
            "title": "网页标题",
            "extractor": "trafilatura",
            "normalized": type("Normalized", (), {
                "content_markdown": "# 网页标题\n\n第一句。第二句。",
                "tts_text": "网页标题\n\n第一句。第二句。",
                "content_hash": "hash_1",
            })(),
            "source_metadata": {"source_kind": "url", "locator": original_url, "final_url": final_url},
            "extraction_metadata": {"extractor": "trafilatura"},
        })(),
    )
    course, job = UrlImportService(db_session).create_import_course("user_1", ImportUrlInput(url="https://example.com/a"))
    UrlImportService(db_session).run_import_job(job.id)

    db_session.expire_all()
    course = db_session.get(Course, course.id)
    article_text = db_session.query(ArticleText).filter(ArticleText.course_id == course.id).one()
    import_job = db_session.get(GenerationJob, job.id)

    assert course.source_type == SourceType.URL_IMPORT
    assert course.status == CourseStatus.NEEDS_REVIEW
    assert article_text.content_markdown.startswith("# 网页标题")
    assert article_text.text.startswith("网页标题")
    assert article_text.confirmed_by_user is False
    assert import_job.status == JobStatus.SUCCEEDED
    assert (
        db_session.query(GenerationJob)
        .filter(GenerationJob.course_id == course.id, GenerationJob.job_type == JobType.TTS_GENERATE)
        .count()
        == 0
    )
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_url_import_api.py tests/test_url_import_service.py -q
```

Expected: route and service are missing.

- [ ] **Step 3: Implement backend orchestration**

Use these concrete implementation anchors:

In `services/api/app/worker_client.py`, add:

```python
def enqueue_url_import(course_id: str, job_id: str) -> str:
    result = celery_client.send_task("import_url_for_course", args=[course_id, job_id])
    return result.id
```

In `services/api/app/services/course_service.py`, add these imports:

```python
from app.models.generation_job import GenerationJob, JobStatus, JobType
from app.worker_client import enqueue_audio_generation
```

Move the existing `request_audio_generation` implementation from `services/api/app/api/routes/courses.py` into `course_service.py`:

```python
def request_audio_generation(db: Session, course: Course) -> GenerationJob:
    latest_article_text = latest_article_text_for_course(course)
    if latest_article_text is not None and not latest_article_text.confirmed_by_user:
        latest_article_text.confirmed_by_user = True
    course.status = CourseStatus.AUDIO_GENERATING
    job = GenerationJob(
        course_id=course.id,
        job_type=JobType.TTS_GENERATE,
        status=JobStatus.PENDING,
    )
    db.add(job)
    db.commit()
    db.refresh(course)
    db.refresh(job)
    enqueue_audio_generation(course.id, job.id)
    return job
```

Add these content import helpers:

```python
def create_import_placeholder_course(
    db: Session,
    user_id: str,
    title: str,
    source_type: SourceType,
    series_id: str | None = None,
    series_title: str | None = None,
    tags: list[str] | None = None,
    is_starred: bool | None = False,
) -> Course:
    series = get_or_create_series(
        db,
        user_id,
        series_id=series_id,
        series_title=series_title,
        tags=tags,
        is_starred=is_starred if series_id or series_title else None,
    )
    course = Course(
        user_id=user_id,
        title=title,
        source_type=source_type,
        status=CourseStatus.EXTRACTING_TEXT,
        series_id=series.id if series is not None else None,
        tags_json="[]" if series is not None else encode_tags(tags),
        is_starred=False if series is not None else bool(is_starred),
    )
    db.add(course)
    db.flush()
    return course


def create_url_import_job(db: Session, course: Course, input_json: str) -> GenerationJob:
    job = GenerationJob(
        course_id=course.id,
        job_type=JobType.URL_IMPORT,
        status=JobStatus.PENDING,
        input_json=input_json,
    )
    db.add(job)
    db.flush()
    return job


def persist_article_content(
    db: Session,
    course: Course,
    *,
    title: str,
    tts_text: str,
    content_markdown: str,
    content_hash: str,
    source_metadata_json: str,
    extraction_metadata_json: str,
    source_quality: str = "extracted",
    confirmed_by_user: bool = False,
    course_status: CourseStatus = CourseStatus.TEXT_READY,
) -> ArticleText:
    course.title = title[:512]
    course.word_count = len(tts_text)
    course.status = course_status
    article_text = ArticleText(
        course_id=course.id,
        version=len(course.article_texts) + 1,
        text=tts_text,
        content_markdown=content_markdown,
        content_hash=content_hash,
        source_metadata_json=source_metadata_json,
        extraction_metadata_json=extraction_metadata_json,
        source_quality=source_quality,
        confirmed_by_user=confirmed_by_user,
    )
    db.add(article_text)
    db.flush()
    for index, sentence_text in enumerate(split_into_sentences(tts_text)):
        db.add(
            Sentence(
                course_id=course.id,
                article_text_id=article_text.id,
                index=index,
                paragraph_index=0,
                text=sentence_text,
            )
        )
    db.flush()
    return article_text
```

Create `services/api/app/services/url_import_service.py`:

```python
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.course import Course, CourseStatus, SourceType
from app.models.generation_job import GenerationJob, JobStatus, JobType
from app.services.course_service import (
    create_import_placeholder_course,
    create_url_import_job,
    persist_article_content,
)
from app.services.web_extraction import ExtractionError, extract_article_content
from app.services.web_fetcher import WebFetchError, fetch_public_html


@dataclass(frozen=True)
class ImportUrlInput:
    url: str
    title: str | None = None
    series_id: str | None = None
    series_title: str | None = None
    tags: list[str] | None = None
    is_starred: bool = False


@dataclass(frozen=True)
class UrlImportResult:
    course_id: str
    job_id: str
    status: str


class UrlImportService:
    def __init__(self, db: Session):
        self.db = db

    def create_import_course(self, user_id: str, payload: ImportUrlInput) -> tuple[Course, GenerationJob]:
        title = (payload.title or "正在提取网页").strip() or "正在提取网页"
        course = create_import_placeholder_course(
            self.db,
            user_id,
            title=title,
            source_type=SourceType.URL_IMPORT,
            series_id=payload.series_id,
            series_title=payload.series_title,
            tags=payload.tags,
            is_starred=payload.is_starred,
        )
        job = create_url_import_job(self.db, course, json.dumps({"url": payload.url}, ensure_ascii=False))
        self.db.commit()
        self.db.refresh(course)
        self.db.refresh(job)
        return course, job

    def run_import_job(self, job_id: str) -> UrlImportResult:
        job = self._get_job(job_id)
        course = self._get_course(job.course_id)
        try:
            payload = json.loads(job.input_json or "{}")
        except json.JSONDecodeError as exc:
            self._mark_failed(job_id, "invalid_job_input", "URL import job input is invalid")
            raise ValueError("URL import job input is invalid") from exc
        url = str(payload.get("url") or "").strip()
        if not url:
            self._mark_failed(job_id, "missing_url", "URL import job input is missing url")
            raise ValueError("URL import job input is missing url")

        try:
            job.status = JobStatus.RUNNING
            job.started_at = datetime.utcnow()
            course.status = CourseStatus.EXTRACTING_TEXT
            self.db.flush()
            fetched = fetch_public_html(url)
            extracted = extract_article_content(fetched.html, original_url=fetched.original_url, final_url=fetched.final_url)
            extraction_metadata = {
                **extracted.extraction_metadata,
                "http_status": fetched.status_code,
                "content_type": fetched.content_type,
                "fetch_elapsed_ms": fetched.elapsed_ms,
            }
            persist_article_content(
                self.db,
                course,
                title=extracted.title,
                tts_text=extracted.normalized.tts_text,
                content_markdown=extracted.normalized.content_markdown,
                content_hash=extracted.normalized.content_hash,
                source_metadata_json=json.dumps(extracted.source_metadata, ensure_ascii=False),
                extraction_metadata_json=json.dumps(extraction_metadata, ensure_ascii=False),
                source_quality="extracted",
                confirmed_by_user=False,
                course_status=CourseStatus.NEEDS_REVIEW,
            )
            job.status = JobStatus.SUCCEEDED
            job.error_code = None
            job.error_message = None
            job.finished_at = datetime.utcnow()
            self.db.commit()
            return UrlImportResult(course.id, job.id, course.status.value)
        except (WebFetchError, ExtractionError) as exc:
            self.db.rollback()
            self._mark_failed(job_id, getattr(exc, "code", "url_import_failed"), str(exc))
            raise

    def _get_job(self, job_id: str) -> GenerationJob:
        job = self.db.get(GenerationJob, job_id)
        if job is None or job.job_type != JobType.URL_IMPORT:
            raise ValueError(f"URL import job not found: {job_id}")
        return job

    def _get_course(self, course_id: str) -> Course:
        course = self.db.get(Course, course_id)
        if course is None or course.is_deleted:
            raise ValueError(f"Course not found: {course_id}")
        return course

    def _mark_failed(self, job_id: str, code: str, message: str) -> None:
        job = self.db.get(GenerationJob, job_id)
        if job is None:
            return
        job.status = JobStatus.FAILED
        job.error_code = code
        job.error_message = message[:2000]
        job.finished_at = datetime.utcnow()
        course = self.db.get(Course, job.course_id)
        if course is not None:
            course.status = CourseStatus.FAILED
        self.db.commit()
```

The `run_import_job` implementation must call `fetch_public_html`, then `extract_article_content`, then `persist_article_content` with `course_status=CourseStatus.NEEDS_REVIEW`, then stop. It must not call `request_audio_generation`; the existing audio generation route is the explicit user confirmation action. On `WebFetchError` or `ExtractionError`, mark both import job and course failed with the exception code and message.

The URL to import must be persisted in `GenerationJob.input_json` as JSON shaped like `{"url": "https://example.com/article"}`. Do not use `error_message` or `idempotency_key` as a data payload.

In `services/api/app/api/routes/courses.py`:

- import `CourseUrlImportCreate`, `CourseSourceRead`, `UrlImportService`, `ImportUrlInput`, and `enqueue_url_import`
- add `POST /courses/import-url`
- update `serialize_course` to include latest `ArticleText.content_markdown` and parsed `source_metadata_json`
- update `serialize_course` to include the latest URL-import job status and error fields by reading the newest `GenerationJob(job_type=JobType.URL_IMPORT)`
- import `request_audio_generation` from `app.services.course_service` instead of defining it in the route module, so text import, retry, and review-confirmation actions share the same helper

`serialize_course` should compute these values when `db` is available:

```python
article_text = latest_article_text(course)
import_job = latest_import_job(db, course.id) if db is not None else None
content_markdown = article_text.content_markdown if article_text is not None else None
source = parse_source_summary(article_text)
import_status = import_job.status.value if import_job is not None else None
import_error_code = import_job.error_code if import_job is not None else None
import_error_message = import_job.error_message if import_job is not None else None
```

Update existing tests that monkeypatch audio queueing. In `services/api/tests/test_courses_api.py` and `services/api/tests/test_course_library_api.py`, replace:

```python
"app.api.routes.courses.enqueue_audio_generation"
```

with:

```python
"app.services.course_service.enqueue_audio_generation"
```

- [ ] **Step 4: Run focused tests and commit**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_url_import_api.py tests/test_url_import_service.py tests/test_courses_api.py tests/test_course_library_api.py -q
git add services/api/app/services/course_service.py services/api/app/services/url_import_service.py services/api/app/api/routes/courses.py services/api/app/worker_client.py services/api/tests/test_url_import_api.py services/api/tests/test_url_import_service.py services/api/tests/test_courses_api.py services/api/tests/test_course_library_api.py
git commit -m "feat: add URL import API service"
```

Expected: tests pass, then commit succeeds.

---

### Task 6: Worker Task And CLI

**Files:**
- Create: `services/api/app/cli/import_url.py`
- Create: `services/worker/app/tasks/import_url.py`
- Modify: `services/worker/app/celery_app.py`
- Modify: `services/worker/tests/test_celery_app_registration.py`
- Test: `services/api/tests/test_url_import_cli.py`

- [ ] **Step 1: Write failing tests**

Create `services/api/tests/test_url_import_cli.py`:

```python
from app.cli.import_url import import_url_job


def test_import_url_job_returns_service_payload(monkeypatch):
    monkeypatch.setattr(
        "app.cli.import_url.UrlImportService",
        lambda db: type("Service", (), {
            "run_import_job": lambda self, job_id: type("Result", (), {"course_id": "course_1", "job_id": job_id, "status": "pending"})()
        })(),
    )

    assert import_url_job("job_1") == {"course_id": "course_1", "job_id": "job_1", "status": "pending"}
```

Replace `services/worker/tests/test_celery_app_registration.py` with:

```python
import subprocess
import sys


def test_worker_app_registers_tasks_on_startup():
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "from app.celery_app import celery_app; "
                "print('generate_audio_for_course' in celery_app.tasks); "
                "print('import_url_for_course' in celery_app.tasks)"
            ),
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    assert result.stdout.strip().splitlines() == ["True", "True"]
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_url_import_cli.py -q
cd ../../services/worker && .venv/bin/python -m pytest tests/test_celery_app_registration.py -q
```

Expected: API CLI missing and worker task missing.

- [ ] **Step 3: Implement CLI and worker task**

Create `services/api/app/cli/import_url.py`:

```python
from __future__ import annotations

import argparse
import json

from app.db.session import SessionLocal
from app.services.url_import_service import UrlImportService


def import_url_job(job_id: str) -> dict[str, str]:
    with SessionLocal() as db:
        result = UrlImportService(db).run_import_job(job_id)
        return {"course_id": result.course_id, "job_id": result.job_id, "status": result.status}


def main() -> None:
    parser = argparse.ArgumentParser(description="Import a PageAlong URL import job.")
    parser.add_argument("job_id")
    args = parser.parse_args()
    print(json.dumps(import_url_job(args.job_id), ensure_ascii=False))


if __name__ == "__main__":
    main()
```

Create `services/worker/app/tasks/import_url.py`:

```python
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from app.celery_app import celery_app


def get_repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def get_api_dir() -> Path:
    return Path(os.getenv("API_CLI_WORKDIR", str(get_repo_root() / "services" / "api")))


def get_api_python() -> str:
    return os.getenv("API_CLI_PYTHON", str(get_api_dir() / ".venv" / "bin" / "python"))


@celery_app.task(name="import_url_for_course")
def import_url_for_course(course_id: str, job_id: str) -> dict[str, str]:
    api_dir = get_api_dir()
    env = os.environ.copy()
    env["PYTHONPATH"] = str(api_dir)
    completed = subprocess.run(
        [get_api_python(), "-m", "app.cli.import_url", job_id],
        cwd=api_dir,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(completed.stdout) if completed.stdout else {}
    return {
        "course_id": str(payload.get("course_id", course_id)),
        "job_id": str(payload.get("job_id", job_id)),
        "status": str(payload.get("status", "succeeded")),
    }
```

In `services/worker/app/celery_app.py`, add:

```python
import app.tasks.import_url  # noqa: E402,F401
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
cd services/api && .venv/bin/python -m pytest tests/test_url_import_cli.py -q
cd ../../services/worker && .venv/bin/python -m pytest tests/test_celery_app_registration.py -q
git add services/api/app/cli/import_url.py services/api/tests/test_url_import_cli.py services/worker/app/tasks/import_url.py services/worker/app/celery_app.py services/worker/tests/test_celery_app_registration.py
git commit -m "feat: add URL import worker task"
```

Expected: tests pass, then commit succeeds.

---

### Task 7: Frontend URL Import Form

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/i18n.ts`
- Create: `apps/web/src/components/ImportUrlForm.tsx`
- Create: `apps/web/src/components/CourseReviewActions.tsx`
- Modify: `apps/web/src/app/[locale]/import/page.tsx`
- Create: `apps/web/src/app/[locale]/import/[tab]/page.tsx`
- Modify: `apps/web/src/app/[locale]/courses/[courseId]/page.tsx`
- Test: `apps/web/tests/course-flow.spec.ts`

- [ ] **Step 1: Update Playwright test for URL import**

Append to `apps/web/tests/course-flow.spec.ts`:

```ts
test("user imports a public URL from the localized console", async ({ page }) => {
  // Mock:
  // - POST /courses/import-url returns extracting_text.
  // - GET /courses/url_1 returns needs_review with content_markdown.
  // - POST /courses/url_1/audio-generation returns a pending TTS job.

  await page.goto("/zh/import/url");
  await page.getByPlaceholder("粘贴公开网页 URL").fill("https://example.com/article");
  await page.getByRole("button", { name: "导入网页" }).click();

  await expect(page.getByRole("heading", { name: "确认生成内容" })).toBeVisible();
  await expect(page.getByText("第一句。第二句。")).toBeVisible();
  await page.getByRole("button", { name: "确认并生成音频" }).click();

  await expect(page).toHaveURL(/\/zh\/courses\/url_1$/);
});
```

Update the `MockCourse` type and `mockCourse` default in the same file:

```ts
content_markdown: string | null;
source: null | {
  source_kind?: string | null;
  locator?: string | null;
  canonical_locator?: string | null;
  final_url?: string | null;
  source_domain?: string | null;
  author?: string | null;
  published_at?: string | null;
};
```

Default values:

```ts
content_markdown: null,
source: null,
```

- [ ] **Step 2: Run web test and verify failure**

Run:

```bash
cd apps/web && npm test -- course-flow.spec.ts
```

Expected: fails because the route-backed URL review UI does not exist.

- [ ] **Step 3: Update frontend types and API**

In `apps/web/src/lib/types.ts`, add:

```ts
export type CourseSource = {
  source_kind: string | null;
  locator: string | null;
  canonical_locator: string | null;
  final_url: string | null;
  source_domain: string | null;
  author: string | null;
  published_at: string | null;
};
```

Add to `Course`:

```ts
content_markdown: string | null;
source: CourseSource | null;
```

In `apps/web/src/lib/api.ts`, add `createUrlCourse` plus the confirmation helper:

```ts
export async function createUrlCourse(input: {
  url: string;
  title?: string;
  seriesTitle?: string;
}): Promise<Course> {
  const response = await fetch(apiUrl("/courses/import-url"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": "dev_user"
    },
    body: JSON.stringify({
      url: input.url,
      title: input.title || undefined,
      series_title: input.seriesTitle || undefined
    })
  });
  if (!response.ok) {
    throw new Error("Failed to import URL");
  }
  return (await response.json()) as Course;
}

export async function requestCourseAudioGeneration(courseId: string): Promise<GenerationJob> {
  const response = await fetch(apiUrl(`/courses/${courseId}/audio-generation`), {
    method: "POST",
    headers: { "X-User-Id": "dev_user" }
  });
  if (!response.ok) {
    throw new Error("Failed to request audio generation");
  }
  return (await response.json()) as GenerationJob;
}
```

- [ ] **Step 4: Add i18n copy**

In both `zh.import` and `en.import` inside `apps/web/src/lib/i18n.ts`, add these keys:

```ts
urlPlaceholder: "粘贴公开网页 URL",
urlSubmit: "导入网页",
urlSubmitting: "导入中",
urlExtractingTitle: "正在抓取并清洗网页",
urlReviewTitle: "确认生成内容",
urlConfirm: "确认并生成音频",
urlError: "网页导入失败。该网页可能需要登录、依赖动态渲染或阻止抓取，请使用浏览器插件剪存或手动粘贴正文。",
```

English:

```ts
urlPlaceholder: "Paste a public web URL",
urlSubmit: "Import URL",
urlSubmitting: "Importing",
urlExtractingTitle: "Extracting and cleaning the page",
urlReviewTitle: "Confirm generated content",
urlConfirm: "Confirm and generate audio",
urlError: "URL import failed. The page may require login, depend on dynamic rendering, or block crawling. Use browser clipping or paste the text manually.",
```

- [ ] **Step 5: Add URL import form**

Create `apps/web/src/components/ImportUrlForm.tsx` as a client-side URL workflow:

```tsx
"use client";

// submit URL -> poll course detail until needs_review -> render cleaned Markdown
// -> call requestCourseAudioGeneration on explicit confirmation.
```

The form should keep the user on `/import/url` after extraction and show the cleaned Markdown preview with a confirmation button. It should navigate to `/{locale}/courses/{courseId}` only after the confirmation call succeeds.

- [ ] **Step 6: Update route-backed import pages**

Change `/[locale]/import/page.tsx` into a redirect to `/{locale}/import/text`.

Create `/[locale]/import/[tab]/page.tsx` with route-backed tabs for `text`, `url`, `file`, and `extension`. Text import should keep the existing text form behavior. URL import should render `ImportUrlForm`. File upload and extension should be standalone coming-soon pages, not cards squeezed beside the active method.

- [ ] **Step 7: Run web test and commit**

Run:

```bash
cd apps/web && npm test -- course-flow.spec.ts
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/lib/i18n.ts apps/web/src/components/ImportUrlForm.tsx apps/web/src/components/CourseReviewActions.tsx apps/web/src/app/[locale]/import/page.tsx apps/web/src/app/[locale]/import/[tab]/page.tsx apps/web/src/app/[locale]/courses/[courseId]/page.tsx apps/web/tests/course-flow.spec.ts
git commit -m "feat: add URL import form"
```

Expected: tests pass, then commit succeeds.

---

### Task 8: Markdown Reader With In-Body Audio Highlighting

**Files:**
- Create: `apps/web/src/components/MarkdownReader.tsx`
- Modify: `apps/web/src/components/CoursePlayer.tsx`
- Modify: `apps/web/src/components/CourseReadingWorkspace.tsx`
- Test: `apps/web/tests/course-flow.spec.ts`

- [ ] **Step 1: Add Playwright test for Markdown body replacing visible sentence list**

Append to `apps/web/tests/course-flow.spec.ts`:

```ts
test("course detail uses markdown body for sentence highlighting and fixed bottom audio", async ({ page }) => {
  await page.route(/http:\/\/localhost:(8000|8070)\/courses\/course_md$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify(
        mockCourse({
          id: "course_md",
          title: "Markdown 课程",
          status: "ready",
          current_audio_url: "/courses/course_md/audio",
          content_markdown: "# 一级标题\n\n第一句。第二句。\n\n- 要点一。\n- 要点二。\n\n```js\nalert('x')\n```",
          source: {
            source_kind: "url",
            locator: "https://example.com/article",
            canonical_locator: "https://example.com/article",
            final_url: "https://example.com/article",
            source_domain: "example.com",
            author: null,
            published_at: null
          },
          sentences: [
            { index: 0, text: "一级标题", audio_start_seconds: 0, audio_end_seconds: 2 },
            { index: 1, text: "第一句。", audio_start_seconds: 2, audio_end_seconds: 5 },
            { index: 2, text: "第二句。", audio_start_seconds: 5, audio_end_seconds: 8 },
            { index: 3, text: "要点一。", audio_start_seconds: 8, audio_end_seconds: 11 },
            { index: 4, text: "要点二。", audio_start_seconds: 11, audio_end_seconds: 14 }
          ]
        })
      )
    });
  });

  await page.goto("/zh/courses/course_md");

  await expect(page.getByRole("heading", { name: "一级标题" })).toBeVisible();
  await expect(page.getByText("第一句。")).toBeVisible();
  await expect(page.getByText("要点一。")).toBeVisible();
  await expect(page.getByText("alert('x')")).toBeVisible();
  await expect(page.getByText("example.com")).toBeVisible();
  await expect(page.locator("[data-sentence-index='1']")).toContainText("第一句。");
  await expect(page.locator("[data-course-player='fixed-bottom']")).toBeVisible();
  await expect(page.locator("[data-sentence-list]")).toHaveCount(0);
});
```

- [ ] **Step 2: Run web test and verify failure**

Run:

```bash
cd apps/web && npm test -- course-flow.spec.ts
```

Expected: fails because Markdown is not rendered with mapped sentence spans and the current player is not fixed to the viewport bottom.

- [ ] **Step 3: Implement MarkdownReader with best-effort sentence mapping**

Create `apps/web/src/components/MarkdownReader.tsx`:

```tsx
"use client";

import React, { useEffect, useMemo } from "react";
import type { Sentence } from "@/lib/types";

type Block =
  | { type: "heading"; depth: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; text: string };

type SentenceCursor = {
  sentence: Sentence;
  matched: boolean;
};

function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let codeLines: string[] = [];
  let inCode = false;

  function flushParagraph() {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  }

  function flushList() {
    if (listItems.length > 0) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
    }
  }

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      if (inCode) {
        blocks.push({ type: "code", text: codeLines.join("\n") });
        codeLines = [];
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      return;
    }
    if (inCode) {
      codeLines.push(line);
      return;
    }
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", depth: heading[1].length, text: heading[2] });
      return;
    }
    const item = trimmed.match(/^[-*+]\s+(.+)$/);
    if (item) {
      flushParagraph();
      listItems.push(item[1]);
      return;
    }
    paragraph.push(trimmed);
  });
  flushParagraph();
  flushList();
  return blocks;
}

function renderMappedText(
  text: string,
  cursors: SentenceCursor[],
  activeSentenceIndex: number,
  onSelectSentence: (sentence: Sentence) => void,
) {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  cursors.forEach((cursor) => {
    if (cursor.matched) {
      return;
    }
    const sentenceText = cursor.sentence.text.trim();
    if (!sentenceText) {
      return;
    }
    const position = remaining.indexOf(sentenceText);
    if (position < 0) {
      return;
    }
    const before = remaining.slice(0, position);
    if (before) {
      nodes.push(<React.Fragment key={`t-${key++}`}>{before}</React.Fragment>);
    }
    const isActive = cursor.sentence.index === activeSentenceIndex;
    nodes.push(
      <button
        key={`s-${cursor.sentence.index}`}
        type="button"
        data-sentence-index={cursor.sentence.index}
        className={[
          "rounded-sm px-0.5 text-left transition-colors",
          isActive ? "bg-amber-200 text-neutral-950" : "hover:bg-amber-50"
        ].join(" ")}
        onClick={() => onSelectSentence(cursor.sentence)}
      >
        {sentenceText}
      </button>
    );
    cursor.matched = true;
    remaining = remaining.slice(position + sentenceText.length);
  });

  if (remaining) {
    nodes.push(<React.Fragment key={`t-${key++}`}>{remaining}</React.Fragment>);
  }
  return nodes;
}

export function MarkdownReader({
  markdown,
  sentences,
  activeSentenceIndex,
  onSelectSentence
}: {
  markdown: string;
  sentences: Sentence[];
  activeSentenceIndex: number;
  onSelectSentence: (sentence: Sentence) => void;
}) {
  const blocks = useMemo(() => parseMarkdown(markdown), [markdown]);
  const cursors: SentenceCursor[] = sentences.map((sentence) => ({ sentence, matched: false }));

  useEffect(() => {
    const activeNode = document.querySelector(`[data-sentence-index="${activeSentenceIndex}"]`);
    activeNode?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeSentenceIndex]);

  return (
    <article className="space-y-4 rounded-md border border-neutral-200 bg-white p-4 leading-7 text-neutral-800">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const className = block.depth === 1 ? "text-xl font-semibold text-neutral-950" : "text-lg font-semibold text-neutral-950";
          return React.createElement(
            `h${Math.min(block.depth, 3)}`,
            { key: index, className },
            renderMappedText(block.text, cursors, activeSentenceIndex, onSelectSentence)
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderMappedText(item, cursors, activeSentenceIndex, onSelectSentence)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "code") {
          return (
            <pre key={index} className="overflow-x-auto rounded-md bg-neutral-950 p-3 text-sm leading-6 text-neutral-50">
              <code>{block.text}</code>
            </pre>
          );
        }
        return <p key={index}>{renderMappedText(block.text, cursors, activeSentenceIndex, onSelectSentence)}</p>;
      })}
    </article>
  );
}
```

- [ ] **Step 4: Update CoursePlayer to remove visible SentenceList and use a fixed bottom player**

In `apps/web/src/components/CoursePlayer.tsx`:

- Remove the `SentenceList` import and visible `<SentenceList ... />` render.
- Import `MarkdownReader`.
- Keep `activeSentenceIndex`, `seekToSentence`, progress saving, and audio timing logic.
- Render source summary and `MarkdownReader` as the main body.
- Render the `<audio>` element inside a fixed bottom bar with `data-course-player="fixed-bottom"`.
- Add bottom padding to the wrapper so the fixed player does not cover the end of the article.

Use this layout shape:

```tsx
return (
  <div className="space-y-4 pb-28 md:pb-32">
    {course.source ? (
      <div className="rounded-md border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {course.source.source_domain ? <span>{course.source.source_domain}</span> : null}
          {course.source.author ? <span>{course.source.author}</span> : null}
          {course.source.published_at ? <span>{course.source.published_at}</span> : null}
          {course.source.canonical_locator ? (
            <a className="text-neutral-950 underline" href={course.source.canonical_locator} rel="noreferrer" target="_blank">
              {course.source.canonical_locator}
            </a>
          ) : null}
        </div>
      </div>
    ) : null}

    {course.content_markdown ? (
      <MarkdownReader
        markdown={course.content_markdown}
        sentences={course.sentences}
        activeSentenceIndex={activeSentenceIndex}
        onSelectSentence={seekToSentence}
      />
    ) : null}

    {!course.content_markdown && !hasAudio ? (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-4">
        <p className="text-sm font-medium text-neutral-950">{dictionary.detail.textReadyTitle}</p>
        <p className="mt-1 text-sm leading-6 text-neutral-600">{dictionary.detail.textReadyBody}</p>
      </div>
    ) : null}

    <div data-course-player="fixed-bottom" className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-4xl">
        {hasAudio ? (
          <audio ref={audioRef} controls className="w-full" src={courseAudioUrl(course.id)} onTimeUpdate={handleTimeUpdate} />
        ) : (
          <p className="text-sm text-neutral-600">{dictionary.detail.textReadyBody}</p>
        )}
      </div>
    </div>
  </div>
);
```

- [ ] **Step 5: Update CourseReadingWorkspace for the new body model**

In `apps/web/src/components/CourseReadingWorkspace.tsx`, keep the left article/course selector. The main pane should continue rendering `<CoursePlayer course={activeCourse} locale={locale} />`; do not render `SentenceList` elsewhere.

If any workspace-level styles clip fixed children, remove the clipping or ensure the fixed player is viewport-fixed and visible above the page.

- [ ] **Step 6: Run web test and commit**

Run:

```bash
cd apps/web && npm test -- course-flow.spec.ts
git add apps/web/src/components/MarkdownReader.tsx apps/web/src/components/CoursePlayer.tsx apps/web/src/components/CourseReadingWorkspace.tsx apps/web/tests/course-flow.spec.ts
git commit -m "feat: highlight audio in markdown reader"
```

Expected: tests pass, the sentence list is not rendered, and the fixed bottom player remains visible.

---

### Task 9: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run backend API tests**

Run:

```bash
make test-api
```

Expected: all API tests pass.

- [ ] **Step 2: Run worker tests**

Run:

```bash
cd services/worker && .venv/bin/python -m pytest -q
```

Expected: all worker tests pass.

- [ ] **Step 3: Run web tests**

Run:

```bash
make test-web
```

Expected: Playwright tests pass.

- [ ] **Step 4: Optional route/build verification**

Run if Task 7 or Task 8 changed route or server component behavior beyond the snippets above:

```bash
cd apps/web && npm run build
```

Expected: Next.js build completes successfully.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: only intentional uncommitted files remain; if every task committed successfully, `git status --short` should show only pre-existing unrelated user files.

---

## Self-Review Notes

- Spec coverage: the plan covers generic content fields, URL safety, Trafilatura primary extraction, Readability fallback, quality failure, API route, worker task, Markdown reading, and audio handoff.
- Scope control: Playwright scraping, PDF snapshots, browser-plugin clipping, OCR, authenticated pages, image understanding, and formula transcription are excluded from implementation tasks.
- Type consistency: the plan consistently uses `content_markdown`, `source_metadata_json`, `extraction_metadata_json`, `CourseUrlImportCreate`, `CourseSourceRead`, `JobType.URL_IMPORT`, and `import_url_for_course`.
