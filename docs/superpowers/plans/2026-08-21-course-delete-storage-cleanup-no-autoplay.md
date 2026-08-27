# Course Delete Storage Cleanup and No-Autoplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user deletes a course, remove its persisted object-storage files, and stop opening course detail pages from auto-starting audio playback.

**Architecture:** Keep deletion logic in the backend service layer so the route stays thin. Add a small object-storage delete primitive, then use it to clean up course audio assets, imported article images, and file-import source uploads before soft-deleting the course. On the web side, remove the course-detail autoplay query param and the corresponding player prop so playback only starts from an explicit user click.

**Tech Stack:** FastAPI, SQLAlchemy, boto3/S3-compatible object storage, Next.js 13, React 18, Playwright, Pytest

---

### Task 1: Add object-storage deletion support

**Files:**
- Modify: `services/api/app/services/object_storage.py`
- Modify: `services/api/tests/test_object_storage.py`

- [ ] **Step 1: Write the failing test**

```python
def test_s3_compatible_delete_uses_bucket_and_key():
    captured = {}

    class FakeS3Client:
        def delete_object(self, **kwargs):
            captured.update(kwargs)

    service = ObjectStorageService(
        backend="r2",
        bucket="pagealong-media",
        endpoint_url="https://account.r2.cloudflarestorage.com",
        access_key_id="access",
        secret_access_key="secret",
        public_base_url="https://media.pagealong.com/assets",
        local_root=tmp_path / "local",
        client_factory=lambda: FakeS3Client(),
    )

    service.delete_object("audio/course_1/audio_1.wav")

    assert captured == {"Bucket": "pagealong-media", "Key": "audio/course_1/audio_1.wav"}
```

```python
def test_local_delete_removes_file(tmp_path):
    source = tmp_path / "media" / "audio" / "course_1" / "audio_1.wav"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"audio-bytes")

    service = ObjectStorageService(
        backend="local",
        bucket="local",
        endpoint_url="",
        access_key_id="",
        secret_access_key="",
        public_base_url="",
        local_root=tmp_path / "media",
    )

    service.delete_object("audio/course_1/audio_1.wav")

    assert not source.exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_object_storage.py -k delete`

Expected: FAIL with `AttributeError: 'ObjectStorageService' object has no attribute 'delete_object'`

- [ ] **Step 3: Write minimal implementation**

```python
def delete_object(self, object_key_or_path: str) -> None:
    normalized_key = object_key_or_path.lstrip("/")

    if self.backend == "local":
        path = Path(object_key_or_path)
        if not path.is_absolute():
            path = self.local_root / normalized_key
        path.unlink(missing_ok=True)
        return

    if self.backend not in S3_COMPATIBLE_BACKENDS:
        raise ValueError(f"Unsupported object storage backend: {self.backend}")

    self._client().delete_object(Bucket=self.bucket, Key=normalized_key)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_object_storage.py -k delete`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/app/services/object_storage.py services/api/tests/test_object_storage.py
git commit -m "feat: add object storage deletion support"
```

### Task 2: Remove course-related R2/local objects when a course is deleted

**Files:**
- Modify: `services/api/app/services/course_service.py`
- Modify: `services/api/app/api/routes/courses.py`
- Modify: `services/api/tests/test_course_deletion.py`

- [ ] **Step 1: Write the failing test**

```python
def test_delete_course_removes_associated_storage_objects(client, db_session, monkeypatch):
    deleted: list[tuple[str, str]] = []

    class FakeStorage:
        def __init__(self, backend: str):
            self.backend = backend

        def delete_object(self, object_key_or_path: str) -> None:
            deleted.append((self.backend, object_key_or_path))

    monkeypatch.setattr(
        "app.services.course_service.ObjectStorageService.from_settings",
        lambda backend=None: FakeStorage(backend or "r2"),
    )
    monkeypatch.setattr(
        "app.services.course_service.ObjectStorageService.from_file_import_settings",
        lambda: FakeStorage("r2"),
    )

    created = client.post(
        "/courses",
        json={"title": "课程", "source_type": "manual_text", "text": "第一句。"},
    ).json()

    course = db_session.get(Course, created["id"])
    article_text = db_session.query(ArticleText).filter(ArticleText.course_id == course.id).one()
    audio_asset = AudioAsset(
        course_id=course.id,
        article_text_id=article_text.id,
        provider="fake",
        voice_id="voice",
        format="mp3",
        object_path="https://media.pagealong.test/audio/placeholder.mp3",
        storage_backend="r2",
        bucket="pagealong-media",
        object_key=f"audio/{course.id}/course-audio.mp3",
        content_type="audio/mpeg",
        duration_seconds=10,
        character_count=4,
        is_current=True,
    )
    image_asset = ArticleImageAsset(
        course_id=course.id,
        article_text_id=article_text.id,
        source_url="https://example.com/image.webp",
        storage_backend="r2",
        bucket="pagealong-media",
        object_key=f"articles/{course.id}/images/image-hash.webp",
        object_path="https://media.pagealong.test/articles/placeholder.webp",
        content_type="image/webp",
        checksum_sha256="a" * 64,
        status="imported",
    )
    batch = FileImportBatch(
        user_id="test_user",
        source_mode=FileImportSourceMode.SINGLE_FILE,
        total_count=1,
    )
    db_session.add_all([audio_asset, image_asset, batch])
    db_session.flush()
    audio_asset.object_key = f"audio/{course.id}/{audio_asset.id}.mp3"
    image_asset.object_key = f"articles/{course.id}/images/{image_asset.checksum_sha256}.webp"
    file_item = FileImportItem(
        batch_id=batch.id,
        user_id="test_user",
        course_id=course.id,
        original_filename="chapter-1.pdf",
        relative_path="chapter-1.pdf",
        file_extension="pdf",
        content_type="application/pdf",
        byte_size=12,
        storage_backend="r2",
        bucket="pagealong-media",
        object_key="",
        object_path=f"https://media.pagealong.test/file-imports/{batch.id}/chapter-1.pdf",
    )
    db_session.add(file_item)
    db_session.flush()
    file_item.object_key = f"file-imports/{batch.id}/{file_item.id}/chapter-1.pdf"
    db_session.commit()

    response = client.delete(f"/courses/{created['id']}")

    assert response.status_code == 204
    assert deleted == [
        ("r2", audio_asset.object_key),
        ("r2", image_asset.object_key),
        ("r2", file_item.object_key),
    ]
    assert client.get("/courses").json()["items"] == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_course_deletion.py -k storage`

Expected: FAIL because the delete route does not clean up object-storage assets yet.

- [ ] **Step 3: Write minimal implementation**

```python
def delete_stored_object(storage_backend: str, object_key: str | None, object_path: str | None) -> int:
    backend = storage_backend.strip().lower()
    if backend == "local":
        if not object_path:
            return 0
        Path(object_path).unlink(missing_ok=True)
        return 1
    if backend in {"s3", "minio", "r2"} and object_key:
        ObjectStorageService.from_settings(backend).delete_object(object_key)
        return 1
    return 0


def delete_course_with_resources(db: Session, course: Course) -> int:
    deleted_objects = 0
    for audio_asset in db.scalars(select(AudioAsset).where(AudioAsset.course_id == course.id)):
        deleted_objects += delete_stored_object(audio_asset.storage_backend, audio_asset.object_key, audio_asset.object_path)
    for image_asset in db.scalars(select(ArticleImageAsset).where(ArticleImageAsset.course_id == course.id)):
        deleted_objects += delete_stored_object(image_asset.storage_backend, image_asset.object_key, image_asset.object_path)
    for file_item in db.scalars(select(FileImportItem).where(FileImportItem.course_id == course.id)):
        deleted_objects += delete_stored_object(file_item.storage_backend, file_item.object_key, file_item.object_path)

    course.is_deleted = True
    course.status = CourseStatus.DELETED
    db.commit()
    return deleted_objects
```

```python
@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    course = get_user_course_or_404(db, user_id, course_id)
    delete_course_with_resources(db, course)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_course_deletion.py`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/app/services/course_service.py services/api/app/api/routes/courses.py services/api/tests/test_course_deletion.py
git commit -m "feat: delete course storage assets on course removal"
```

### Task 3: Stop course detail pages from auto-starting playback

**Files:**
- Modify: `apps/web/src/components/CourseListItem.tsx`
- Modify: `apps/web/src/components/CoursePlayer.tsx`
- Modify: `apps/web/src/app/[locale]/courses/[courseId]/page.tsx`
- Modify: `apps/web/tests/course-flow.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
test("course detail does not auto-play on page load", async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __playCalls?: number }).__playCalls = 0;
    HTMLMediaElement.prototype.play = function () {
      (window as Window & { __playCalls?: number }).__playCalls =
        ((window as Window & { __playCalls?: number }).__playCalls ?? 0) + 1;
      return Promise.resolve();
    };
  });

  await page.goto("/zh/courses/ready_1");

  await expect.poll(async () => page.evaluate(() => (window as Window & { __playCalls?: number }).__playCalls ?? 0)).toBe(0);
  await page.getByRole("button", { name: "播放" }).click();
  await expect.poll(async () => page.evaluate(() => (window as Window & { __playCalls?: number }).__playCalls ?? 0)).toBe(1);
});
```

Update the existing detail-route expectations from:

```typescript
await expect(page).toHaveURL(/\/zh\/courses\/course_1(\?autoplay=1)?$/);
```

to:

```typescript
await expect(page).toHaveURL(/\/zh\/courses\/course_1$/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jqsf/Desktop/code/web_reader/apps/web && npm run test -- course-flow.spec.ts --grep "auto-play"`

Expected: FAIL because the list item still appends `?autoplay=1` and the player still accepts autoplay state.

- [ ] **Step 3: Write minimal implementation**

```tsx
// CourseListItem.tsx
const defaultHref = `/${locale}/courses/${course.id}`;
```

```tsx
// CoursePlayer.tsx
export function CoursePlayer({
  course,
  locale
}: {
  course: Course;
  locale: Locale;
}) {
```

```tsx
// page.tsx
<CoursePlayer course={course} locale={locale} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jqsf/Desktop/code/web_reader/apps/web && npm run test -- course-flow.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/CourseListItem.tsx apps/web/src/components/CoursePlayer.tsx apps/web/src/app/[locale]/courses/[courseId]/page.tsx apps/web/tests/course-flow.spec.ts
git commit -m "feat: remove course detail autoplay"
```
