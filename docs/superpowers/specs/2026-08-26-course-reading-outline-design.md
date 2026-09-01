# Course Reading Outline Design

Date: 2026-08-26

## Goal

Add a table-of-contents outline to the course reading page and the series course reading page, generated from Markdown H1-H4 headings after course content is imported or persisted.

## Confirmed Decisions

- Hide the outline icon when the current course has no H1-H4 headings.
- Precompute the outline on the backend when Markdown content is saved, so long articles do not require an extra client-side outline scan on every reader open.
- Keep course list summaries unchanged. Only course detail responses and series detail course entries include the outline.
- Reuse the existing Markdown body as the source of truth. Do not introduce a new editor, auth assumption, real TTS behavior, or route-level hash navigation.

## Data Contract

Each course detail carries:

```json
{
  "outline": [
    {
      "id": "heading-1-overview",
      "depth": 1,
      "title": "Overview"
    }
  ]
}
```

Rules:

- Parse only ATX headings with one to four leading `#` characters.
- Ignore headings inside fenced code blocks.
- Strip trailing closing hashes and inline Markdown emphasis, code, image, and link syntax from outline titles.
- Generate stable ids from heading text; append numeric suffixes for duplicates.
- Existing courses without stored outline data should still return an outline by deriving it server-side from the latest Markdown body.

## Backend Design

- Add `ArticleText.outline_json` as nullable text.
- Add a focused Markdown outline service that parses `content_markdown` and encodes/decodes outline JSON.
- Set `outline_json` when `create_text_course` and `persist_article_content` create `ArticleText` rows.
- Include `outline` in `CourseRead` serialization from the latest article text.
- Update `scripts/init_database.py` so local legacy databases gain the new nullable column.

## Frontend Design

- Add `CourseOutlineItem` to frontend types.
- `CourseDetailContent` owns whether the outline side panel is open.
- `CoursePlayer` passes the backend outline into `MarkdownReader`.
- `MarkdownReader` assigns heading ids while rendering the already-parsed Markdown blocks; it does not perform a separate outline extraction pass.
- The course header gets a compact outline icon button at the top-right, next to source/preferences/actions.
- On desktop:
  - Normal course detail shows an outline side panel inside the reading surface when opened.
  - Series course detail replaces the left course-article sidebar with the outline sidebar when opened.
- On mobile, the outline opens as a drawer using the same outline item list.

## Testing

- Backend parser tests cover H1-H4 extraction, fenced-code exclusion, inline cleanup, duplicate ids, and H5/H6 exclusion.
- API tests cover outline on manual text course creation, detail serialization, series detail serialization, and fallback for legacy rows with no stored outline.
- Playwright tests cover opening the outline on a normal course page and a series course page, then clicking an outline item and observing the matching heading enter view.

