# URL Import and Content Normalization Design

## Goal

Add public-web URL import to PageAlong so a user can paste a page URL, have the backend extract the article title and body, normalize that content into a single canonical Markdown representation for reading, derive plain text for TTS, and then pause for user confirmation before audio generation starts.

This first version uses `httpx` plus `trafilatura` as the primary extractor and `readability-lxml` as the fallback extractor. It does not use a paid third-party reader service.

## Scope

In scope:

- A dedicated URL import endpoint for public pages.
- Backend extraction, cleanup, normalization, and quality gating.
- Persisting generic provenance and extraction metadata on the content version.
- Rendering the imported article as Markdown in the reader UI.
- Deriving TTS text from the same normalized source.
- A preview-and-confirm step before the existing audio generation flow.
- Actionable failure states for 403, timeout, low-content, and dynamic-rendering cases.

Out of scope:

- PDF export.
- Playwright-based scraper pools.
- Logged-in, paywalled, or authenticated crawling.
- OCR.
- Complex image understanding.
- Full formula transcription.
- A separate URL-only snapshot table.

## Current State

The repository already has the right workflow primitives:

- `Course.source_type` already includes `url_import`.
- `Course.status` already includes `importing`, `extracting_text`, `needs_review`, `text_ready`, `audio_generating`, `ready`, and `failed`.
- `ArticleText.text` already stores the body that sentence splitting and TTS consume.
- `GenerationJob` already tracks async work for audio generation.
- The current web import screen is still text-first and has placeholder cards for URL import.

That means the feature can extend the existing content pipeline instead of inventing a second parallel model.

## Design Principles

- One content version should be the source of truth for both reading and TTS.
- Reading Markdown and TTS text are related, but they are not the same field.
- Generic provenance belongs with the content version, not in a URL-specific table.
- Fail closed when extraction quality is poor.
- Keep the normalization contract source-agnostic so text, Markdown, doc, and URL imports can converge on it later.

## Data Model

### `ArticleText`

Extend `ArticleText` to carry the canonical imported content:

- `content_markdown`: canonical reader Markdown.
- `content_hash`: hash of the normalized content after cleanup.
- `source_metadata_json`: generic provenance and source info such as `source_kind`, `locator`, `canonical_locator`, `final_url`, `source_domain`, `author`, `published_at`, and `extractor`.
- `extraction_metadata_json`: fetch, parse, score, and error details.

Keep the existing `text` column as the canonical TTS text.

For URL imports:

- `text` is the plain-text TTS body.
- `content_markdown` is the rendered reader body.
- `source_quality` should distinguish successful extraction from low-confidence or failed extraction.
- `confirmed_by_user` should stay false unless a later manual review flow explicitly confirms it.

### `Course`

`Course` still owns the user-facing workflow state:

- `importing` when the import job is created.
- `extracting_text` while fetch/extract/normalize is running.
- `needs_review` after a URL import successfully persists cleaned content and is waiting for user confirmation.
- `text_ready` after content is persisted and ready for audio.
- `audio_generating` after the existing TTS job is queued.
- `ready` once audio generation completes.
- `failed` when the importer cannot produce usable content.

### Tables Not Added In v1

Do not add a URL-specific `course_sources` or `article_snapshots` table for this phase.

If a future snapshot table is needed, it should be generic and source-agnostic, not named around URL fields. For v1, the normalized Markdown plus the metadata JSON fields above are enough.

## API And Job Flow

Add a dedicated URL import endpoint, for example `POST /courses/import-url`.

Request fields:

- `url`
- optional `title` override
- optional `series_id` / `series_title`
- optional `tags`
- optional `is_starred`

Behavior:

1. Create a `Course` row with `source_type=url_import`.
2. Create a job row for the import work.
3. Queue the import worker.
4. Return the course in `importing` or `extracting_text` state.
5. After extraction succeeds, persist `ArticleText`, split sentences from the TTS text, and leave the course in `needs_review`.
6. After the user confirms the preview, enqueue the existing audio generation job.

Reuse the existing async job table by adding a new import job type rather than creating a second queueing system.

Concretely, extend `JobType` with `URL_IMPORT` and reuse `GenerationJob` for the import task lifecycle.

## Import UI

The course import surface should use route-backed tabs instead of stacking every import method on one screen.

- `/import` redirects to the text import page.
- `/import/text` contains pasted-text import.
- `/import/url` contains URL submission, extraction progress, cleaned preview, and the confirmation action.
- `/import/file` and `/import/extension` are standalone coming-soon pages until those importers are implemented.

The URL import tab owns the confirmation flow: after the worker persists cleaned content, the tab shows the Markdown preview, source summary, word count, and sentence count. The user must click the confirmation action before audio generation is queued.

## Extraction Pipeline

The import worker should use a deterministic pipeline:

1. Validate the URL.
2. Reject unsafe targets before any network request.
3. Fetch HTML with `httpx`.
4. Extract content with `trafilatura`.
5. Score the result.
6. If the result is empty, too short, or clearly noisy, retry with `readability-lxml`.
7. Convert the chosen result to canonical Markdown.
8. Derive plain TTS text from that Markdown.
9. Persist the content version and stop at the confirmation step.

### URL Safety Rules

The fetcher must not become an SSRF entry point.

- Allow only `http` and `https`.
- Reject `file:`, `data:`, and other non-web schemes.
- Reject `localhost`, loopback, private, link-local, and metadata-range addresses.
- Re-check the resolved target after redirects.
- Do not forward user cookies, auth headers, or browser state.
- Apply a response size limit and a request timeout.

### Why Trafilatura First

`trafilatura` is the main extractor because it already handles boilerplate removal and can emit structured article content. It is the best fit for the canonical Markdown contract.

### Why Readability As Fallback

`readability-lxml` is the fallback because it is a second, independent main-text heuristic. It is useful when the first extractor returns a login page, a thin shell, or an obviously noisy article body.

### Noise Removal Strategy

The cleanup step should be more than tag deletion. Use block-level and semantic filters:

- Hard-remove obvious boilerplate containers: `nav`, `footer`, `header`, `aside`, `script`, `style`, `form`, `noscript`, comment regions, share widgets, promo blocks, related-reading blocks, and recommendation blocks.
- Drop sections whose headings match boilerplate patterns such as `related`, `recommend`, `comments`, `references`, `相关阅读`, `推荐阅读`, `评论`, `广告`, `赞助`, or similar.
- Drop blocks with high link density and low text density.
- Drop repeated short list blocks that are obviously navigation menus.
- Keep meaningful anchor text, but strip raw URLs from the TTS path.
- Preserve code blocks in Markdown, but omit them from TTS text by default.
- Preserve images only as readable figure/caption text if the alt text or caption is meaningful; do not attempt OCR.

This gives a cleaner result than DOM cleanup alone because it scores entire blocks, not just tags.

### Markdown Contract

`content_markdown` is the canonical persisted reader format.

Rules:

- Headings become Markdown headings.
- Paragraphs stay as paragraphs.
- Lists stay as lists.
- Quotes stay as blockquotes.
- Code stays fenced.
- Tables may be preserved if they are compact; otherwise flatten them into readable prose.
- Raw HTML is not rendered to the client.

`text` is derived from `content_markdown` for TTS:

- remove code blocks
- remove raw URLs
- collapse boilerplate sections
- flatten links to anchor text
- simplify tables
- collapse whitespace and repeated blank lines

## Reader Rendering

The course detail/reading surface should render `content_markdown` directly, not the TTS text. The URL import page should first show a cleaned preview and only queue audio after confirmation.

The course detail API therefore needs to expose the latest `content_markdown` and a compact source summary alongside the existing sentence and audio fields.

This replaces the visible sentence-list reader model. Sentences remain backend timeline records, but the user reads and navigates through the Markdown article body.

The Markdown reader is the main course body. It replaces the old visible sentence list in the course detail experience. The sentence rows still exist as timeline data, but they are no longer rendered as a separate one-line-per-sentence panel.

Reader behavior:

- Markdown body fills the main reading area.
- Current audio sentence is highlighted in place inside the Markdown body.
- Clicking a highlighted/mapped sentence seeks the audio to that sentence.
- While audio plays, the reader can scroll the active sentence into view.
- The audio player is pinned to the bottom of the viewport and remains visible while the user scrolls through the Markdown body.
- The page content reserves enough bottom padding so the fixed player does not cover the final paragraphs.
- Source metadata such as author, published date, and canonical URL is shown when available.
- Safe Markdown rendering uses raw HTML disabled or sanitized.

The initial sentence-to-Markdown mapping should be best effort and source-order based. It may match sentence text into paragraph, heading, quote, and list text nodes. It must skip code blocks because code blocks are preserved for reading but omitted from TTS.

The reader should use the same Markdown contract for future text, Markdown, doc, and URL importers. A source-agnostic reader makes later import work much simpler.

## Error Handling

The import should fail with a clear reason when it cannot produce usable content.

Suggested failure classes:

- invalid URL
- blocked by SSRF safety checks
- fetch timeout
- fetch error
- HTTP 403 / 401 / 429
- extractor failure
- low-confidence extraction
- content too short
- content is mostly boilerplate or noise

When the failure indicates dynamic rendering or server-side blocking, the user-facing message should explicitly tell them to use browser-plugin clipping or manual paste.

Do not auto-generate audio from low-confidence content in v1.

## Metadata And Observability

Persist enough context to debug the import without keeping a full raw snapshot in the database:

- original URL
- final URL after redirects
- canonical URL if present
- source domain
- page title
- author
- published date
- extractor name and version
- HTTP status
- fetch duration
- content length
- quality score or rule reason
- machine-readable error code
- human-readable error message

Store these details in the JSON metadata fields on `ArticleText` and in the import job error fields.

## Future Importer Contract

This design sets the contract for all future importers:

```text
source-specific input -> normalized Markdown -> TTS text -> sentences -> audio
```

URL import is the first implementation of that contract, not a special case.

## Testing

Backend coverage should include:

- URL validation and SSRF rejection.
- Trafilatura success path.
- Readability fallback path.
- Low-content and noisy-content rejection.
- 403 / timeout failure messages.
- Markdown normalization for headings, lists, links, and code blocks.
- TTS text derivation from Markdown.
- Course state transitions from import to audio generation.

Frontend coverage should include:

- Markdown rendering for headings, lists, links, and code blocks.
- Raw HTML not rendering in the reader.
- Course detail showing content while audio is still pending.
- Markdown body replacing the visible sentence list.
- Fixed bottom player remaining visible while the article scrolls.
- Active sentence highlighting inside Markdown based on audio time.

## Deferred Work

Explicitly defer these items:

- Browser-plugin clipping integration.
- PDF snapshots.
- Playwright scraping pools.
- Authenticated page support.
- OCR.
- Deep image and formula understanding.
- A generic raw snapshot table unless the product later proves it needs one.
