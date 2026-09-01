# Course Reading Outline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a precomputed Markdown outline for course reading pages and render it as a toggleable table-of-contents sidebar on normal and series course readers.

**Architecture:** Store the current article outline on `ArticleText.outline_json`, generated from Markdown H1-H4 headings when article content is created. Course detail serializers expose `outline`; the frontend renders the returned outline and assigns matching heading ids during the existing Markdown render pass.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, pytest, Next.js 13, React 18, TypeScript, Tailwind CSS, Playwright.

---

### Task 1: Backend Outline Parser

**Files:**
- Create: `services/api/app/services/markdown_outline.py`
- Create: `services/api/tests/test_markdown_outline.py`

- [ ] **Step 1: Write failing parser tests**
  - Verify H1-H4 extraction, H5 exclusion, fenced-code exclusion, inline cleanup, closing hash cleanup, and duplicate id suffixes.

- [ ] **Step 2: Run parser tests and confirm failure**
  - Run: `cd services/api && .venv/bin/python -m pytest -q tests/test_markdown_outline.py`
  - Expected: failure because `app.services.markdown_outline` does not exist.

- [ ] **Step 3: Implement parser**
  - Add a small dataclass `MarkdownOutlineItem`.
  - Add `build_markdown_outline(markdown: str) -> list[MarkdownOutlineItem]`.
  - Add `encode_markdown_outline` and `decode_markdown_outline`.

- [ ] **Step 4: Run parser tests and confirm pass**
  - Run: `cd services/api && .venv/bin/python -m pytest -q tests/test_markdown_outline.py`

### Task 2: Backend Persistence And API Contract

**Files:**
- Modify: `services/api/app/models/course.py`
- Modify: `services/api/app/schemas/course.py`
- Modify: `services/api/app/services/course_service.py`
- Modify: `services/api/app/api/routes/courses.py`
- Modify: `scripts/init_database.py`
- Modify: `services/api/tests/test_courses_api.py`
- Modify: `services/api/tests/test_course_library_api.py`
- Modify: `services/api/tests/test_init_database.py`

- [ ] **Step 1: Write failing API/schema tests**
  - Manual text creation returns `outline`.
  - Course detail returns outline for legacy rows whose `outline_json` is `NULL`.
  - Series detail returns `outline` inside each course.
  - Course list summaries still do not include `outline`.
  - Local database initializer adds `article_texts.outline_json`.

- [ ] **Step 2: Run targeted backend tests and confirm failure**
  - Run: `cd services/api && .venv/bin/python -m pytest -q tests/test_courses_api.py tests/test_course_library_api.py tests/test_init_database.py -k "outline or summary_without_reader_content or article_text"`

- [ ] **Step 3: Implement persistence and serialization**
  - Add nullable `outline_json` to `ArticleText`.
  - Generate outline JSON in `create_text_course` and `persist_article_content`.
  - Add `CourseOutlineItemRead` and `outline` to `CourseRead`.
  - Deserialize stored outline in `serialize_course`; derive from Markdown when missing or invalid.
  - Add `outline_json` to the local schema upgrade helper.

- [ ] **Step 4: Run targeted backend tests and confirm pass**
  - Run: `cd services/api && .venv/bin/python -m pytest -q tests/test_markdown_outline.py tests/test_courses_api.py tests/test_course_library_api.py tests/test_init_database.py -k "outline or summary_without_reader_content or article_text"`

### Task 3: Frontend Outline Rendering

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/components/UiIcons.tsx`
- Modify: `apps/web/src/components/MarkdownReader.tsx`
- Modify: `apps/web/src/components/CoursePlayer.tsx`
- Modify: `apps/web/src/components/CourseDetailContent.tsx`
- Modify: `apps/web/src/components/CourseReadingWorkspace.tsx`
- Modify: `apps/web/src/app/[locale]/courses/[courseId]/page.tsx`
- Modify: `apps/web/tests/course-flow.spec.ts`

- [ ] **Step 1: Write failing Playwright tests**
  - Normal course page exposes an outline icon when `outline` is non-empty, opens an outline sidebar, and clicking a child item scrolls to its heading.
  - Series course page exposes the same icon, replaces the article sidebar with the outline sidebar, and clicking an outline item scrolls to its heading.

- [ ] **Step 2: Run targeted Playwright tests and confirm failure**
  - Run: `cd apps/web && npm run test -- course-flow.spec.ts --grep "outline"`

- [ ] **Step 3: Implement frontend rendering**
  - Add outline types and localized labels.
  - Add an outline icon.
  - Thread `outline`, `isOutlineOpen`, and toggle/select callbacks through the detail, player, and workspace components.
  - Render heading ids in `MarkdownReader` from the returned outline.
  - Hide the icon when outline is empty.

- [ ] **Step 4: Run targeted Playwright tests and confirm pass**
  - Run: `cd apps/web && npm run test -- course-flow.spec.ts --grep "outline"`

### Task 4: Final Verification

**Files:**
- All modified backend and frontend files.

- [ ] **Step 1: Run backend API tests**
  - Run: `make test-api`

- [ ] **Step 2: Run frontend behavior tests**
  - Run: `make test-web`

- [ ] **Step 3: Run UI detector**
  - Run: `node .agents/skills/impeccable/scripts/detect.mjs --json apps/web/src/components/CourseDetailContent.tsx apps/web/src/components/CourseReadingWorkspace.tsx apps/web/src/components/MarkdownReader.tsx apps/web/src/components/CoursePlayer.tsx`

