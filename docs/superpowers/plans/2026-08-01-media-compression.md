# Media Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress generated audio and imported article images before they are stored in R2, with a configurable fallback mode when compression fails.

**Architecture:** Add one API-side media compression service that owns ffmpeg/Pillow conversion, size metadata, and fallback behavior. `AudioGenerationService` and `import_article_images()` will call it before storage upload. Audio keeps using the existing worker -> API CLI flow; image import stays in the URL import path. `ArticleImageAsset` gets its own metadata column so each image can record compression results independently.

**Tech Stack:** FastAPI, SQLAlchemy, Celery worker task orchestration, `ffmpeg` CLI, `Pillow`, boto3-compatible object storage, pytest.

---

### Task 1: Add compression primitives, config, and dependency wiring

**Files:**
- Modify: `services/api/app/core/config.py`
- Create: `services/api/app/services/media_compression.py`
- Modify: `services/api/pyproject.toml`
- Modify: `Makefile`
- Create: `services/api/tests/test_media_compression.py`

- [ ] **Step 1: Write the failing tests**

```python
from io import BytesIO
from pathlib import Path

from PIL import Image
from app.core.config import settings
from app.services.media_compression import MediaCompressionService


def test_compress_audio_uses_ffmpeg_settings_and_records_metadata(tmp_path, monkeypatch):
    source = tmp_path / "course.wav"
    source.write_bytes(b"wav-bytes")

    calls = []

    def fake_run(cmd, check, capture_output, text, timeout):
        calls.append(cmd)
        output = Path(cmd[-1])
        output.write_bytes(b"mp3-bytes")
        return type("Result", (), {"returncode": 0})()

    monkeypatch.setattr(settings, "media_compression_enabled", True)
    monkeypatch.setattr(settings, "media_compression_failure_mode", "strict")
    monkeypatch.setattr(settings, "audio_compression_enabled", True)
    monkeypatch.setattr(settings, "audio_compression_format", "mp3")
    monkeypatch.setattr(settings, "audio_compression_bitrate", "64k")
    monkeypatch.setattr(settings, "audio_compression_sample_rate", 24000)
    monkeypatch.setattr(settings, "audio_compression_channels", 1)

    service = MediaCompressionService(ffmpeg_runner=fake_run)
    result = service.compress_audio(source)

    assert calls[0][0] == "ffmpeg"
    assert result.output_path.suffix == ".mp3"
    assert result.content_type == "audio/mpeg"
    assert result.metadata["compression"]["status"] == "compressed"


def test_compress_image_transcodes_to_webp_and_strips_metadata(tmp_path):
    raw = BytesIO()
    image = Image.new("RGBA", (2400, 1200), (255, 0, 0, 128))
    image.save(raw, format="PNG")

    service = MediaCompressionService()
    result = service.compress_image(raw.getvalue(), "image/png")

    assert result.content_type == "image/webp"
    assert result.metadata["compression"]["status"] == "compressed"
    assert result.metadata["compression"]["width"] == 1600
    assert result.metadata["compression"]["height"] == 800
```

- [ ] **Step 2: Run the targeted tests and confirm they fail**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_media_compression.py
```

Expected: import/attribute failures until the module and settings exist.

- [ ] **Step 3: Implement the minimal compression service and config**

```python
class MediaCompressionService:
    def compress_audio(self, source_path: Path) -> AudioCompressionResult:
        if not self.settings.media_compression_enabled or not self.settings.audio_compression_enabled:
            return self._original_audio_result(source_path)
        return self._ffmpeg_audio_result(source_path)

    def compress_image(self, content: bytes, content_type: str) -> ImageCompressionResult:
        if not self.settings.media_compression_enabled or not self.settings.image_compression_enabled:
            return self._original_image_result(content, content_type)
        return self._pillow_image_result(content, content_type)
```

Add the new settings to `Settings`, add `Pillow` to `services/api/pyproject.toml`, and add `pillow` to the `Makefile` dependency install line.

- [ ] **Step 4: Run the targeted tests and confirm they pass**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_media_compression.py
```

Expected: all tests in `tests/test_media_compression.py` pass.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-08-01-media-compression.md services/api/app/core/config.py services/api/app/services/media_compression.py services/api/pyproject.toml Makefile services/api/tests/test_media_compression.py
git commit -m "feat: add media compression primitives"
```

### Task 2: Compress generated audio before asset finalization

**Files:**
- Modify: `services/api/app/services/audio_generation_service.py`
- Modify: `services/api/app/models/course.py` if shared helpers need the new content-type mapping
- Modify: `services/api/tests/test_audio_generation_service.py`

- [ ] **Step 1: Write the failing test**

```python
import json

from app.models.course import AudioAsset, CourseStatus
from app.models.generation_job import GenerationJob, JobType
from app.services.audio_generation_service import AudioGenerationService
from app.services.course_service import create_text_course
from app.services.media_compression import MediaCompressionService


def test_audio_generation_compresses_to_mp3_before_upload(db_session, tmp_path):
    course = create_text_course(
        db_session,
        user_id="test_user",
        title="压缩音频",
        source_type="manual_text",
        text="第一句。第二句。",
    )
    course.status = CourseStatus.AUDIO_GENERATING
    job = GenerationJob(course_id=course.id, job_type=JobType.TTS_GENERATE)
    db_session.add(job)
    db_session.commit()

    service = AudioGenerationService(
        db_session,
        output_dir=tmp_path,
        media_compression=MediaCompressionService(),
    )
    service.generate_for_job(job.id)

    asset = db_session.query(AudioAsset).filter(AudioAsset.course_id == course.id).one()
    assert asset.format == "mp3"
    assert asset.content_type == "audio/mpeg"
    assert json.loads(asset.metadata_json)["compression"]["status"] == "compressed"
```

- [ ] **Step 2: Run the targeted test and confirm it fails**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_audio_generation_service.py -k compresses_to_mp3_before_upload
```

Expected: the assertion fails because the service still writes the uncompressed output path/format.

- [ ] **Step 3: Implement the audio compression path**

```python
compression = self.media_compression.compress_audio(audio_path)
audio_asset.format = compression.format
audio_asset.content_type = compression.content_type
audio_asset.object_path = str(compression.output_path)
audio_asset.metadata_json = json.dumps(compression.metadata, ensure_ascii=False)
```

Honor `MEDIA_COMPRESSION_FAILURE_MODE` so strict mode fails the job and fallback mode uploads the original file with fallback metadata.

- [ ] **Step 4: Run the targeted test and confirm it passes**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_audio_generation_service.py -k compresses_to_mp3_before_upload
```

Expected: the new compression test passes.

- [ ] **Step 5: Commit**

```bash
git add services/api/app/services/audio_generation_service.py services/api/app/models/course.py services/api/tests/test_audio_generation_service.py
git commit -m "feat: compress generated audio"
```

### Task 3: Compress imported images and store per-image metadata

**Files:**
- Modify: `services/api/app/models/course.py`
- Modify: `services/api/app/services/article_image_import.py`
- Modify: `scripts/init_database.py`
- Modify: `services/api/tests/test_article_image_import.py`
- Modify: `services/api/tests/test_init_database.py`
- Modify: `services/api/tests/test_models.py`
- Modify: `services/api/tests/test_url_import_api.py`

- [ ] **Step 1: Write the failing tests**

```python
import json
from sqlalchemy import create_engine, inspect, text

from app.models.course import ArticleImageAsset
from app.services.article_image_import import import_article_images


def test_import_article_images_compresses_to_webp_and_records_metadata(db_session):
    course, article_text = create_url_article(
        db_session,
        "![配图](https://example.com/hero.png)\n\n第一句。",
    )

    result = import_article_images(
        db_session,
        course=course,
        article_text=article_text,
        markdown=article_text.content_markdown,
        base_url="https://example.com/articles/a",
    )

    asset = db_session.query(ArticleImageAsset).filter(ArticleImageAsset.course_id == course.id).one()
    assert result.imported_count == 1
    assert asset.content_type == "image/webp"
    assert json.loads(asset.metadata_json)["compression"]["status"] == "compressed"
    assert article_text.content_markdown.startswith("![配图](")


def test_article_image_asset_defaults_metadata_json():
    asset = ArticleImageAsset(
        course_id="course_1",
        article_text_id="article_1",
        source_url="https://example.com/image.png",
        object_path="https://media.pagealong.test/articles/course_1/images/hash.png",
        object_key="articles/course_1/images/hash.png",
        content_type="image/png",
        byte_size=10,
        checksum_sha256="a" * 64,
    )

    assert asset.metadata_json == "{}"


def test_init_database_adds_article_image_metadata_column():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE article_image_assets (
                    id VARCHAR(36) PRIMARY KEY,
                    course_id VARCHAR(36),
                    article_text_id VARCHAR(36),
                    source_url VARCHAR(2048),
                    alt_text VARCHAR(512),
                    storage_backend VARCHAR(32),
                    bucket VARCHAR(255),
                    object_key VARCHAR(1024),
                    object_path VARCHAR(2048),
                    content_type VARCHAR(128),
                    byte_size INTEGER,
                    checksum_sha256 VARCHAR(128),
                    status VARCHAR(64),
                    error_code VARCHAR(128),
                    error_message TEXT,
                    created_at DATETIME
                )
                """
            )
        )

    init_database.create_application_tables(engine)

    columns = {column["name"] for column in inspect(engine).get_columns("article_image_assets")}
    assert "metadata_json" in columns
```

- [ ] **Step 2: Run the targeted tests and confirm they fail**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_article_image_import.py tests/test_models.py tests/test_init_database.py -k "metadata_json or compresses_to_webp"
```

Expected: the new assertions fail because image compression and `metadata_json` are not wired yet.

- [ ] **Step 3: Implement image compression and schema upgrade**

```python
compression = self.media_compression.compress_image(image.content, image.content_type)
stored = storage.upload_bytes(compression.data, object_key=object_key, content_type=compression.content_type)
asset.metadata_json = json.dumps(compression.metadata, ensure_ascii=False)
```

Add `metadata_json` to `ArticleImageAsset`, and teach `scripts/init_database.py` to add the column to legacy `article_image_assets` tables.

- [ ] **Step 4: Run the targeted tests and confirm they pass**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader/services/api && .venv/bin/python -m pytest -q tests/test_article_image_import.py tests/test_models.py tests/test_init_database.py -k "metadata_json or compresses_to_webp"
```

Expected: the image compression and schema tests pass.

- [ ] **Step 5: Commit**

```bash
git add services/api/app/models/course.py services/api/app/services/article_image_import.py scripts/init_database.py services/api/tests/test_article_image_import.py services/api/tests/test_init_database.py services/api/tests/test_models.py services/api/tests/test_url_import_api.py
git commit -m "feat: compress imported images"
```

### Task 4: Run backend verification

**Files:**
- None new

- [ ] **Step 1: Run the focused API tests**

Run:

```bash
cd /Users/jqsf/Desktop/code/web_reader && make test-api
```

Expected: backend test suite passes.

- [ ] **Step 2: Sanity-check the repo status**

Run:

```bash
git status --short
```

Expected: only the intended compression changes remain.
