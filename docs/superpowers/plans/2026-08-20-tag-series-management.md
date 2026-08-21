# Tag and Series Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class ordinary tag management and first-class series management across backend and web, with tag CRUD on `/tags`, series CRUD on `/series`, tag binding on course detail, tag chips in course lists, and searchable series selection during import.

**Architecture:** Ordinary tags become their own SQLAlchemy model plus course-tag association table, and course payloads move to tag IDs while still tolerating legacy string inputs during migration. Series stays a separate `course_series` concept, gains a last-read course pointer, and its page becomes a real management list with inline title edits, delete guards, and empty-series handling. The web app keeps one shared contract in `lib/api.ts` and `lib/types.ts`, then each page builds a thin UI on top of that contract.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, SQLite/PostgreSQL schema repair in `scripts/init_database.py`, Next.js 13, React 18, TypeScript, Playwright.

---

## Scope Check

This is one integrated feature, but the work naturally splits into backend contract changes and frontend UI slices. Keep it as one plan because the pages all depend on the same tag/series payload shape.

Do not start implementation before the failing tests in each task have been written and run.

## File Structure

### Backend

- Create `services/api/app/models/tag.py`: `Tag` and `CourseTag` models.
- Modify `services/api/app/models/course.py`: add `Course.tags` relationship and `CourseSeries.last_read_course_id`.
- Modify `services/api/app/models/__init__.py`: export the new tag models.
- Modify `services/api/app/schemas/course.py`: add tag schemas, course `tag_ids`, and series `last_read_course_id`.
- Create `services/api/app/services/tag_service.py`: tag CRUD, course-tag syncing, and legacy tag backfill helpers.
- Modify `services/api/app/services/course_service.py`: series creation/update/delete helpers and progress updates.
- Modify `services/api/app/api/routes/courses.py`: new tag and series endpoints, updated serializers, and delete guards.
- Modify `scripts/init_database.py`: schema repair for `course_series.last_read_course_id` and legacy tag backfill.
- Modify `services/api/tests/test_models.py`, `services/api/tests/test_init_database.py`, and `services/api/tests/test_course_library_api.py`.
- Create `services/api/tests/test_tags_api.py`.

### Frontend

- Modify `apps/web/src/lib/types.ts`, `apps/web/src/lib/api.ts`, and `apps/web/src/lib/i18n.ts`.
- Create reusable controls such as `TagChip.tsx`, `TagCombobox.tsx`, `SeriesCombobox.tsx`, `TagInspectorPanel.tsx`, `SeriesInlineTitleEditor.tsx`, and `SeriesListRow.tsx`.
- Modify `apps/web/src/app/[locale]/tags/page.tsx`, `apps/web/src/app/[locale]/series/page.tsx`, `apps/web/src/app/[locale]/courses/[courseId]/page.tsx`, `apps/web/src/app/[locale]/library/page.tsx`, `apps/web/src/components/CourseListItem.tsx`, `apps/web/src/components/ImportTextForm.tsx`, `apps/web/src/components/ImportUrlForm.tsx`, and `apps/web/src/components/MobileExtensionImportForm.tsx`.
- Update `apps/web/tests/course-flow.spec.ts` and add `apps/web/tests/tag-series.spec.ts`.

---

## Task 1: Backend Tag Model, Association Table, and CRUD API

**Files:**
- Create: `services/api/app/models/tag.py`
- Modify: `services/api/app/models/course.py`
- Modify: `services/api/app/models/__init__.py`
- Modify: `services/api/app/schemas/course.py`
- Create: `services/api/app/services/tag_service.py`
- Modify: `services/api/app/api/routes/courses.py`
- Modify: `scripts/init_database.py`
- Modify: `services/api/tests/test_models.py`
- Modify: `services/api/tests/test_init_database.py`
- Create: `services/api/tests/test_tags_api.py`

- [ ] **Step 1: Write the failing tag tests**

Add these tests first:

```python
def test_tag_crud_and_course_binding(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )

    created_tag = client.post("/courses/tags", json={"name": "英语"})
    assert created_tag.status_code == 201
    tag = created_tag.json()
    assert tag["name"] == "英语"
    assert tag["color"]
    assert tag["usage_count"] == 0

    created_course = client.post(
        "/courses",
        json={
            "title": "标签课程",
            "source_type": "manual_text",
            "text": "第一句。",
            "tag_ids": [tag["id"]],
        },
    )
    assert created_course.status_code == 201
    course = created_course.json()
    assert course["tags"][0]["id"] == tag["id"]
    assert course["tags"][0]["name"] == "英语"

    tags_response = client.get("/courses/tags")
    assert tags_response.json()["items"][0]["usage_count"] == 1

    deleted_tag = client.delete(f"/courses/tags/{tag['id']}")
    assert deleted_tag.status_code == 204
    assert client.get(f"/courses/{course['id']}").json()["tags"] == []


def test_init_database_backfills_legacy_tags_into_tag_tables():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE courses (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(128),
                    title VARCHAR(512),
                    source_type VARCHAR(16),
                    status VARCHAR(32),
                    word_count INTEGER,
                    duration_seconds INTEGER,
                    current_audio_asset_id VARCHAR(36),
                    last_playback_position_seconds INTEGER,
                    series_id VARCHAR(36),
                    tags_json TEXT NOT NULL DEFAULT '[]',
                    is_starred BOOLEAN NOT NULL DEFAULT 0,
                    last_read_at DATETIME,
                    is_deleted BOOLEAN NOT NULL DEFAULT 0,
                    created_at DATETIME,
                    updated_at DATETIME
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE course_series (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(128),
                    title VARCHAR(512),
                    tags_json TEXT NOT NULL DEFAULT '[]',
                    is_starred BOOLEAN NOT NULL DEFAULT 0,
                    is_deleted BOOLEAN NOT NULL DEFAULT 0,
                    last_read_at DATETIME,
                    created_at DATETIME,
                    updated_at DATETIME
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO course_series (id, user_id, title, tags_json, is_starred, is_deleted, created_at, updated_at)
                VALUES ('series_1', 'test_user', '旧系列', '["英语"]', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO courses (
                    id, user_id, title, source_type, status, word_count,
                    duration_seconds, last_playback_position_seconds, tags_json, series_id, is_deleted
                )
                VALUES (
                    'course_1', 'test_user', '旧课程', 'manual_text', 'ready',
                    12, 0, 0, '["复盘"]', 'series_1', 0
                )
                """
            )
        )

    init_database.create_application_tables(engine)

    with engine.begin() as connection:
        tag_names = {row["name"] for row in connection.execute(text("SELECT name FROM tags")).mappings()}
        course_tag_count = connection.execute(text("SELECT COUNT(*) AS count FROM course_tags")).mappings().one()["count"]
    assert tag_names == {"复盘", "英语"}
    assert course_tag_count == 2
```

- [ ] **Step 2: Run the tag tests and confirm they fail**

Run:

```bash
cd services/api && .venv/bin/python -m pytest -q tests/test_tags_api.py tests/test_models.py tests/test_init_database.py -k "tag or tags"
```

Expected: fail because `Tag`/`CourseTag` models, the CRUD routes, and the init-db backfill do not exist yet.

- [ ] **Step 3: Implement the tag model and service layer**

Add a real tag model and association model, then move all tag CRUD and course-tag syncing behind one service helper set:

```python
class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(128))
    color: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CourseTag(Base):
    __tablename__ = "course_tags"

    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), primary_key=True)
    tag_id: Mapped[str] = mapped_column(ForeignKey("tags.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

```python
import random

TAG_COLOR_PALETTE = ["#f97316", "#14b8a6", "#8b5cf6", "#ef4444", "#10b981"]


def pick_tag_color() -> str:
    return random.choice(TAG_COLOR_PALETTE)


def get_or_create_tag(db: Session, user_id: str, name: str) -> Tag:
    normalized_name = name.strip()
    tag = db.scalar(select(Tag).where(Tag.user_id == user_id, Tag.name == normalized_name))
    if tag is not None:
        return tag
    tag = Tag(user_id=user_id, name=normalized_name, color=pick_tag_color())
    db.add(tag)
    db.flush()
    return tag


def set_course_tags(
    db: Session,
    course: Course,
    *,
    tag_ids: list[str] | None = None,
    tag_names: list[str] | None = None,
) -> None:
    resolved_tags = []
    if tag_ids is not None:
        resolved_tags = list(db.scalars(select(Tag).where(Tag.user_id == course.user_id, Tag.id.in_(tag_ids))))
    elif tag_names is not None:
        resolved_tags = [get_or_create_tag(db, course.user_id, name) for name in tag_names]

    db.query(CourseTag).filter(CourseTag.course_id == course.id).delete()
    for tag in resolved_tags:
        db.add(CourseTag(course_id=course.id, tag_id=tag.id))
```

Wire `GET /courses/tags`, `POST /courses/tags`, `PATCH /courses/tags/{tag_id}`, and `DELETE /courses/tags/{tag_id}` to that service, and make `DELETE` unlink all `CourseTag` rows before removing the tag.
Treat tag names as trimmed and unique per user, and return a 409 when the same user tries to create a duplicate name.

- [ ] **Step 4: Run the tag tests again**

Run:

```bash
cd services/api && .venv/bin/python -m pytest -q tests/test_tags_api.py tests/test_models.py tests/test_init_database.py -k "tag or tags"
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add services/api/app/models/tag.py services/api/app/models/course.py services/api/app/models/__init__.py services/api/app/schemas/course.py services/api/app/services/tag_service.py services/api/app/api/routes/courses.py scripts/init_database.py services/api/tests/test_models.py services/api/tests/test_init_database.py services/api/tests/test_tags_api.py
git commit -m "feat: add tag dictionary management"
```

---

## Task 2: Backend Series Lifecycle and Last-Read Pointer

**Files:**
- Modify: `services/api/app/models/course.py`
- Modify: `services/api/app/schemas/course.py`
- Modify: `services/api/app/services/course_service.py`
- Modify: `services/api/app/api/routes/courses.py`
- Modify: `scripts/init_database.py`
- Modify: `services/api/tests/test_course_library_api.py`

- [ ] **Step 1: Write the failing series tests**

Add these tests to `services/api/tests/test_course_library_api.py`:

```python
def test_series_can_be_created_listed_read_and_deleted_only_when_empty(client, monkeypatch):
    stub_audio_queue(monkeypatch)

    created_series = client.post("/courses/series", json={"title": "英语精听"})
    assert created_series.status_code == 201
    series = created_series.json()
    assert series["title"] == "英语精听"
    assert series["article_count"] == 0
    assert series["last_read_course_id"] is None

    first = create_text_course(client, "第一课", series_id=series["id"])
    second = create_text_course(client, "第二课", series_id=series["id"])
    response = client.put(f"/courses/{second['id']}/progress", json={"position_seconds": 18, "sentence_index": 1})
    assert response.status_code == 200

    detail = client.get(f"/courses/series/{series['id']}").json()
    assert detail["article_count"] == 2
    assert detail["last_read_course_id"] == second["id"]
    assert detail["latest_course_id"] in {first["id"], second["id"]}

    delete_blocked = client.delete(f"/courses/series/{series['id']}")
    assert delete_blocked.status_code == 409

    emptied = client.post(f"/courses/series/{series['id']}/move-to-fragments")
    assert emptied.status_code == 200
    assert emptied.json()["moved_count"] == 2
    assert client.get("/courses/series").json()["items"][0]["article_count"] == 0
```

- [ ] **Step 2: Run the series tests and confirm they fail**

Run:

```bash
cd services/api && .venv/bin/python -m pytest -q tests/test_course_library_api.py -k "series or progress"
```

Expected: fail because the list still hides empty series, there is no `last_read_course_id`, and delete still has the old behavior.

- [ ] **Step 3: Implement series metadata and delete guards**

Add `last_read_course_id` to `CourseSeries`, create `POST /courses/series`, keep empty series visible in `list_series`, and make `DELETE /courses/series/{series_id}` return 409 when the series still has active courses.
Make `POST /courses/series` trim titles and reuse an existing series for the same user when the title already exists, so import and the new-button flow stay idempotent.

```python
class CourseSeries(Base):
    __tablename__ = "course_series"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    title: Mapped[str] = mapped_column(String(512))
    tags_json: Mapped[str] = mapped_column(Text, default="[]")
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    last_read_course_id: Mapped[str | None] = mapped_column(ForeignKey("courses.id"), nullable=True, index=True)
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

```python
def update_progress(
    course_id: str,
    payload: PlaybackProgressUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> PlaybackProgressRead:
    course = get_user_course_or_404(db, user_id, course_id)
    progress = db.get(PlaybackProgress, {"user_id": user_id, "course_id": course_id})
    if progress is None:
        progress = PlaybackProgress(user_id=user_id, course_id=course_id)
        db.add(progress)
    now = datetime.utcnow()
    progress.position_seconds = payload.position_seconds
    progress.sentence_index = payload.sentence_index
    course.last_read_at = now
    if course.series is not None:
        course.series.last_read_at = now
        course.series.last_read_course_id = course.id
    db.commit()
    return PlaybackProgressRead(position_seconds=progress.position_seconds, sentence_index=progress.sentence_index)
```

```python
def move_series_to_fragments(db: Session, series: CourseSeries) -> int:
    courses = active_series_courses(series)
    for course in courses:
        course.series_id = None
        course.series = None
    db.commit()
    return len(courses)
```

```python
def delete_course_series(
    series_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    series = get_user_series_or_404(db, user_id, series_id)
    if active_series_courses(series):
        raise HTTPException(status_code=409, detail="Series still has courses")
    series.is_deleted = True
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

Also update `scripts/init_database.py` so existing `course_series` tables gain the new column and index.

- [ ] **Step 4: Run the series tests again**

Run:

```bash
cd services/api && .venv/bin/python -m pytest -q tests/test_course_library_api.py -k "series or progress"
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add services/api/app/models/course.py services/api/app/schemas/course.py services/api/app/services/course_service.py services/api/app/api/routes/courses.py scripts/init_database.py services/api/tests/test_course_library_api.py
git commit -m "feat: tighten series lifecycle"
```

---

## Task 3: Web Shared Contract for Tags and Series

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/tests/course-flow.spec.ts`

- [ ] **Step 1: Update the shared web test fixtures first**

Adjust the existing Playwright fixture types so they match the new API shape:

```ts
type MockTag = {
  id: string;
  name: string;
  color: string;
  usage_count: number;
  updated_at: string;
};

type MockCourse = {
  id: string;
  title: string;
  source_type: string;
  status: string;
  word_count: number;
  word_count_unit: "characters" | "words";
  estimated_reading_seconds: number;
  duration_seconds: number;
  current_audio_url: string | null;
  last_playback_position_seconds: number;
  library_type: string;
  series_id: string | null;
  series_title: string | null;
  tags: MockTag[];
  is_starred: boolean;
  created_at: string;
  updated_at: string;
  last_read_at: string | null;
  sentence_count: number;
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
  import_status?: string | null;
  import_error_message?: string | null;
  generation_status?: string | null;
  generation_error_code?: string | null;
  failed_reason?: string | null;
  sentences: Array<{
    index: number;
    text: string;
    audio_start_seconds: number | null;
    audio_end_seconds: number | null;
  }>;
};

type MockCourseSeries = {
  id: string;
  title: string;
  article_count: number;
  is_starred: boolean;
  updated_at: string;
  last_read_at: string | null;
  last_read_course_id: string | null;
  latest_course_id: string | null;
};
```

- [ ] **Step 2: Run the web build and confirm it fails**

Run:

```bash
cd apps/web && npm run build
```

Expected: fail because the shared types and API client still assume string tags and series-tag fields.

- [ ] **Step 3: Update the web contract and reusable API helpers**

Change `Course.tags` and `CourseSummary.tags` to `Tag[]`, remove series tags from the frontend series type, add `last_read_course_id`, and add the new tag/series API helpers:

```ts
export type Tag = {
  id: string;
  name: string;
  color: string;
  usage_count: number;
  updated_at: string;
};

export type CourseBase = {
  id: string;
  title: string;
  source_type: string;
  status: string;
  word_count: number;
  word_count_unit?: "characters" | "words";
  estimated_reading_seconds?: number;
  duration_seconds: number;
  current_audio_url: string | null;
  last_playback_position_seconds: number;
  library_type: "fragmented" | "series";
  series_id: string | null;
  series_title: string | null;
  tags: Tag[];
  is_starred: boolean;
  created_at: string;
  updated_at: string;
  last_read_at: string | null;
  import_status?: string | null;
  import_error_code?: string | null;
  import_error_message?: string | null;
  current_generation_job_id?: string | null;
  generation_status?: string | null;
  generation_error_code?: string | null;
  failed_reason?: string | null;
};

export type CourseSeries = {
  id: string;
  title: string;
  article_count: number;
  is_starred: boolean;
  updated_at: string;
  last_read_at: string | null;
  last_read_course_id: string | null;
  latest_course_id: string | null;
};
```

```ts
export async function listCourseTags(input: { query?: string } = {}): Promise<Tag[]>
export async function createCourseTag(input: { name: string; color?: string }): Promise<Tag>
export async function updateCourseTag(input: { tagId: string; name?: string; color?: string }): Promise<Tag>
export async function deleteCourseTag(tagId: string): Promise<void>
export async function createCourseSeries(input: { title: string; isStarred?: boolean }): Promise<CourseSeries>
export async function updateCourseLibrary(input: {
  courseId: string;
  libraryType?: "fragmented" | "series";
  seriesId?: string;
  tagIds?: string[];
  isStarred?: boolean;
}): Promise<Course>
export async function createTextCourse(input: {
  title: string;
  text: string;
  seriesId?: string;
  seriesTitle?: string;
  tagIds?: string[];
}): Promise<Course>
export async function createUrlCourse(input: {
  url: string;
  title?: string;
  seriesId?: string;
  seriesTitle?: string;
}): Promise<Course>
export async function createExtensionSyncCourse(input: {
  url: string;
  title?: string;
  seriesId?: string;
  seriesTitle?: string;
}): Promise<Course>
```

Update the old `tags` string compatibility paths only where they are still needed for migration, but make the new UI flow use `tag_ids` and `series_id`.
Also update the existing route mocks in `apps/web/tests/course-flow.spec.ts` so `/courses/tags` returns tag objects, `/courses/series` returns series objects without a `tags` field, and the assertions read `course.tags[0].name` instead of raw strings.

Also add the first batch of bilingual copy keys in `apps/web/src/lib/i18n.ts` for:

- `/tags` page title, subtitle, search, create, edit, delete, color, and usage count
- course detail tag picker labels and empty states
- `/series` page list actions, inline edit, batch delete, and delete-blocked copy
- import page series combobox labels

- [ ] **Step 4: Run the build again**

Run:

```bash
cd apps/web && npm run build
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/lib/i18n.ts apps/web/tests/course-flow.spec.ts
git commit -m "feat: switch web to tag objects"
```

---

## Task 4: `/tags` Management Page

**Files:**
- Modify: `apps/web/src/app/[locale]/tags/page.tsx`
- Create: `apps/web/src/components/TagCard.tsx`
- Create: `apps/web/src/components/TagGridPage.tsx`
- Create: `apps/web/src/components/TagInspectorPanel.tsx`
- Create: `apps/web/tests/tag-series.spec.ts`

- [ ] **Step 1: Write the failing tag-page Playwright test**

Add a focused management test:

```ts
test("tag management page can create edit recolor and delete tags", async ({ page }) => {
  await routeTagCatalog(page, []);
  await page.goto("/zh/tags");

  await page.getByRole("button", { name: "新建标签" }).click();
  await page.getByLabel("名称").fill("英语");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("button", { name: /英语/ })).toBeVisible();

  await page.getByRole("button", { name: /英语/ }).click();
  await page.getByLabel("名称").fill("精听");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("精听")).toBeVisible();

  await page.getByRole("button", { name: "删除" }).click();
  await expect(page.getByText("删除后会影响")).toBeVisible();
});
```

- [ ] **Step 2: Run the tag-page test and confirm it fails**

Run:

```bash
cd apps/web && npm run test -- tests/tag-series.spec.ts -g "tag management page"
```

Expected: fail because the page is still a placeholder and the inspector/grid components do not exist yet.

- [ ] **Step 3: Build the tag grid and inspector flow**

Replace the placeholder page with a card grid that loads tag objects from `/courses/tags`, supports search by name, opens a right-side inspector on card click, creates tags with a random palette color, and edits name/color without using a modal.

```tsx
function TagInspectorPanel({
  tag,
  onSave,
  onDelete
}: {
  tag: Tag | null;
  onSave: (input: { name: string; color: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [draftName, setDraftName] = useState(tag?.name ?? "");
  const [draftColor, setDraftColor] = useState(tag?.color ?? "#f97316");
  return (
    <aside>
      <input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
      <input type="color" value={draftColor} onChange={(event) => setDraftColor(event.target.value)} />
      <button type="button" onClick={handleSave}>保存</button>
      <button type="button" onClick={handleDelete}>删除</button>
    </aside>
  );
}
```

Make delete show the affected course count from `usage_count` before the API call.
Start `apps/web/tests/tag-series.spec.ts` by copying the auth bootstrap and `apiHeaders` constants from `course-flow.spec.ts`, then add the local route helpers named `routeTagCatalog`, `routeCourseDetail`, and `routeSeriesCatalog` so the later tag, course, series, and import flows reuse the same mocked payload shapes.

- [ ] **Step 4: Run the tag-page test again**

Run:

```bash
cd apps/web && npm run test -- tests/tag-series.spec.ts -g "tag management page"
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/tags/page.tsx apps/web/src/components/TagCard.tsx apps/web/src/components/TagGridPage.tsx apps/web/src/components/TagInspectorPanel.tsx apps/web/tests/tag-series.spec.ts
git commit -m "feat: add tag management page"
```

---

## Task 5: Course Detail Tag Picker and Course List Tag Chips

**Files:**
- Modify: `apps/web/src/app/[locale]/courses/[courseId]/page.tsx`
- Modify: `apps/web/src/app/[locale]/library/page.tsx`
- Modify: `apps/web/src/components/CourseListItem.tsx`
- Create: `apps/web/src/components/TagCombobox.tsx`
- Create: `apps/web/src/components/TagChip.tsx`
- Modify: `apps/web/tests/tag-series.spec.ts`

- [ ] **Step 1: Write the failing course-detail and list-row tests**

Add one Playwright flow that covers both the main tag editor and the list-row supplement:

```ts
test("course detail can bind existing tags and create a new tag inline", async ({ page }) => {
  await routeTagCatalog(page, [
    { id: "tag_1", name: "英语", color: "#f97316", usage_count: 2, updated_at: "2026-08-20T10:00:00" },
  ]);
  await routeCourseDetail(page, {
    id: "course_1",
    tags: [],
  });

  await page.goto("/zh/courses/course_1");
  await page.getByRole("button", { name: "添加标签" }).click();
  await page.getByRole("option", { name: "英语" }).click();
  await page.getByRole("button", { name: "新建标签" }).click();
  await page.getByPlaceholder("标签名称").fill("复盘");
  await page.getByRole("button", { name: "创建并绑定" }).click();

  await expect(page.getByText("英语")).toBeVisible();
  await expect(page.getByText("复盘")).toBeVisible();
});
```

Also add a library assertion that a row shows only the first 2-3 chips and folds the rest into `+N`.

- [ ] **Step 2: Run the tag-picker test and confirm it fails**

Run:

```bash
cd apps/web && npm run test -- tests/tag-series.spec.ts -g "course detail can bind existing tags"
```

Expected: fail because the detail page still has no tag picker and the list rows still render raw string tags.

- [ ] **Step 3: Wire course tags through the detail and list views**

Add a searchable combobox on the course detail page with a create button that calls `POST /courses/tags`, then save the chosen tag IDs back through `PATCH /courses/{courseId}/library` using `tag_ids`.

```tsx
<TagCombobox
  selectedTags={course.tags}
  onCreateTag={createCourseTag}
  onChange={(tagIds) => updateCourseLibrary({ courseId: course.id, tagIds }) }
/>
```

Update `CourseListItem.tsx` so the row displays colored chips, shows only the first 2-3 tags, and renders a `+N` chip for the rest. Update `library/page.tsx` so the filter select uses tag IDs from `listCourseTags()` and clears itself if the selected tag disappears after a delete.

- [ ] **Step 4: Run the tag-picker test again**

Run:

```bash
cd apps/web && npm run test -- tests/tag-series.spec.ts -g "course detail can bind existing tags"
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/courses/[courseId]/page.tsx apps/web/src/app/[locale]/library/page.tsx apps/web/src/components/CourseListItem.tsx apps/web/src/components/TagCombobox.tsx apps/web/src/components/TagChip.tsx apps/web/tests/tag-series.spec.ts
git commit -m "feat: add course tag picker"
```

---

## Task 6: `/series` Management Page and Reader Entry

**Files:**
- Modify: `apps/web/src/app/[locale]/series/page.tsx`
- Create: `apps/web/src/components/SeriesInlineTitleEditor.tsx`
- Create: `apps/web/src/components/SeriesListRow.tsx`
- Create: `apps/web/src/components/SeriesListToolbar.tsx`
- Modify: `apps/web/tests/tag-series.spec.ts`

- [ ] **Step 1: Write the failing series-page Playwright test**

Add a focused series-management flow:

```ts
test("series page can edit titles inline open the last-read course and batch delete empty series", async ({ page }) => {
  await routeSeriesCatalog(page, [
    {
      id: "series_1",
      title: "英语精听",
      article_count: 2,
      last_read_course_id: "course_2",
      latest_course_id: "course_1",
      is_starred: false,
      updated_at: "2026-08-20T10:00:00",
      last_read_at: "2026-08-20T11:00:00",
    },
    {
      id: "series_2",
      title: "空系列",
      article_count: 0,
      last_read_course_id: null,
      latest_course_id: null,
      is_starred: false,
      updated_at: "2026-08-20T10:05:00",
      last_read_at: null,
    },
  ]);

  await page.goto("/zh/series");
  await page.getByRole("button", { name: "阅读" }).first().click();
  await expect(page.locator('[data-reading-sidebar]')).toContainText("course_2");

  await page.getByRole("button", { name: "编辑" }).first().click();
  await page.getByRole("textbox", { name: "系列标题" }).fill("英语精听 2");
  await page.getByRole("button", { name: "保存" }).click();

  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: "批量删除" }).click();
  await expect(page.getByText("空系列")).toHaveCount(0);
});
```

- [ ] **Step 2: Run the series-page test and confirm it fails**

Run:

```bash
cd apps/web && npm run test -- tests/tag-series.spec.ts -g "series page can edit titles inline"
```

Expected: fail because the page still has the old card layout and the reader entry still picks the wrong course when `last_read_course_id` exists.

- [ ] **Step 3: Rebuild the series page as a list with inline edits**

Turn `/series` into a list page with selection checkboxes, a primary `New series` action that calls `POST /courses/series`, inline title editing in the title column, a read button that opens `last_read_course_id ?? latest_course_id ?? first course`, delete buttons that respect the backend 409 guard, and a batch-delete toolbar that only acts on empty series.

```tsx
<SeriesInlineTitleEditor
  value={series.title}
  onSave={(title) => updateCourseSeries({ seriesId: series.id, title })}
/>
```

Keep the existing reader workspace, but feed it the resolved course chosen from `last_read_course_id` first.
Keep a secondary `Move out courses` action on each non-empty series row so the user can empty it before delete.

- [ ] **Step 4: Run the series-page test again**

Run:

```bash
cd apps/web && npm run test -- tests/tag-series.spec.ts -g "series page can edit titles inline"
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/series/page.tsx apps/web/src/components/SeriesInlineTitleEditor.tsx apps/web/src/components/SeriesListRow.tsx apps/web/src/components/SeriesListToolbar.tsx apps/web/tests/tag-series.spec.ts
git commit -m "feat: add series management page"
```

---

## Task 7: Import Series Combobox

**Files:**
- Modify: `apps/web/src/components/ImportTextForm.tsx`
- Modify: `apps/web/src/components/ImportUrlForm.tsx`
- Modify: `apps/web/src/components/MobileExtensionImportForm.tsx`
- Create: `apps/web/src/components/SeriesCombobox.tsx`
- Modify: `apps/web/tests/tag-series.spec.ts`

- [ ] **Step 1: Write the failing import-combobox test**

Add a Playwright flow for both selecting an existing series and creating a new one inline:

```ts
test("import forms can choose an existing series or create one inline", async ({ page }) => {
  await routeSeriesCatalog(page, [
    {
      id: "series_1",
      title: "英语精听",
      article_count: 1,
      last_read_course_id: null,
      latest_course_id: null,
      is_starred: false,
      updated_at: "2026-08-20T10:00:00",
      last_read_at: null,
    },
  ]);

  await page.goto("/zh/import/text");
  await page.getByRole("button", { name: "系列" }).click();
  await page.getByRole("option", { name: "英语精听" }).click();
  await page.getByRole("button", { name: "创建课程" }).click();
});
```

- [ ] **Step 2: Run the import test and confirm it fails**

Run:

```bash
cd apps/web && npm run test -- tests/tag-series.spec.ts -g "import forms can choose an existing series"
```

Expected: fail because the import forms still use the free-text series field.

- [ ] **Step 3: Replace the free-text series input with a searchable combobox**

Create one reusable `SeriesCombobox` that fetches `listCourseSeries()`, filters by title, offers an inline create flow via `POST /courses/series`, and returns `series_id` to the import forms.

```tsx
<SeriesCombobox
  value={seriesId}
  onCreate={createCourseSeries}
  onChange={setSeriesId}
/>
```

Update `ImportTextForm.tsx`, `ImportUrlForm.tsx`, and `MobileExtensionImportForm.tsx` to send `seriesId` when one is selected, and keep `seriesTitle` only as a compatibility fallback.

- [ ] **Step 4: Run the import test again**

Run:

```bash
cd apps/web && npm run test -- tests/tag-series.spec.ts -g "import forms can choose an existing series"
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ImportTextForm.tsx apps/web/src/components/ImportUrlForm.tsx apps/web/src/components/MobileExtensionImportForm.tsx apps/web/src/components/SeriesCombobox.tsx apps/web/tests/tag-series.spec.ts
git commit -m "feat: add searchable series import"
```
