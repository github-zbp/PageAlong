# Mobile Audio Course MVP Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working vertical slice for a mobile-first audio course product: user-owned courses, text import, async audio generation with sentence timeline, H5 course library, and H5 player.

**Architecture:** Use a Python FastAPI backend as the system of record, a Celery worker for long-running generation jobs, Postgres for structured data, Redis for job brokering, object storage for generated audio, and a Next.js H5/Web frontend. This plan intentionally uses a deterministic fake TTS provider first so the product flow and sentence timeline can be tested before downloading or operating real open-source TTS models.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, Celery, Redis, Postgres, MinIO-compatible object storage, pytest, Next.js, TypeScript, React Query, Tailwind CSS, Playwright.

---

## Scope Check

The product spec covers several independent subsystems: H5/Web, backend API, async jobs, Chrome extension, OCR, local TTS, cloud TTS, and future mini program/App clients. This plan implements the first testable foundation slice only:

- Backend domain model and APIs.
- Manual text import and URL import request skeleton.
- Async sentence segmentation and fake audio generation.
- MP3/timeline asset record creation using a deterministic generated audio file.
- H5 course library and player wired to real backend APIs.
- Dockerized local dependencies.

Separate implementation plans should cover:

- Chrome extension page extraction and auth binding.
- Production document parsing and OCR.
- Real local TTS provider integration with MeloTTS/Kokoro.
- Paid cloud TTS provider integration and billing rules.
- Mobile polish, share entry, and future mini program/App surfaces.

## File Structure

Create this structure:

```text
web_reader/
  .env.example
  .gitignore
  docker-compose.yml
  Makefile
  README.md
  apps/
    web/
      package.json
      next.config.ts
      tsconfig.json
      tailwind.config.ts
      postcss.config.mjs
      src/
        app/
          globals.css
          layout.tsx
          page.tsx
          courses/
            page.tsx
            [courseId]/
              page.tsx
        components/
          AppShell.tsx
          CourseCard.tsx
          CoursePlayer.tsx
          ImportTextForm.tsx
          SentenceList.tsx
        lib/
          api.ts
          types.ts
      tests/
        course-player.spec.ts
  services/
    api/
      pyproject.toml
      alembic.ini
      app/
        __init__.py
        main.py
        api/
          __init__.py
          deps.py
          router.py
          routes/
            __init__.py
            courses.py
            health.py
        core/
          __init__.py
          config.py
        db/
          __init__.py
          base.py
          session.py
        models/
          __init__.py
          course.py
          generation_job.py
          playback_progress.py
        schemas/
          __init__.py
          course.py
          playback.py
        services/
          __init__.py
          course_service.py
          sentence_service.py
          storage_service.py
          tts_service.py
        worker_client.py
      tests/
        conftest.py
        test_courses_api.py
        test_sentence_service.py
        test_tts_service.py
    worker/
      pyproject.toml
      app/
        __init__.py
        celery_app.py
        tasks/
          __init__.py
          generate_audio.py
      tests/
        test_generate_audio_task.py
```

Responsibilities:

- `services/api/app/models/*`: database entities only.
- `services/api/app/schemas/*`: API request and response shapes only.
- `services/api/app/services/*`: business logic with unit tests.
- `services/api/app/api/routes/*`: thin HTTP handlers.
- `services/worker/app/tasks/*`: Celery task orchestration.
- `apps/web/src/lib/api.ts`: API client only.
- `apps/web/src/components/*`: reusable UI units.
- `apps/web/src/app/*`: route-level composition.

## Task 1: Repository Bootstrap

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `Makefile`
- Create: `README.md`

- [ ] **Step 0: Initialize git repository**

Run:

```bash
test -d .git || git init
```

Expected: repository has a `.git` directory.

- [ ] **Step 1: Write project ignore rules**

Create `.gitignore`:

```gitignore
.DS_Store
.env
.venv
__pycache__/
.pytest_cache/
.mypy_cache/
.ruff_cache/
node_modules/
.next/
dist/
coverage/
playwright-report/
test-results/
*.pyc
.superpowers/
storage/
```

- [ ] **Step 2: Write local environment template**

Create `.env.example`:

```dotenv
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=web_reader
POSTGRES_USER=web_reader
POSTGRES_PASSWORD=web_reader
DATABASE_URL=postgresql+psycopg://web_reader:web_reader@localhost:5432/web_reader
REDIS_URL=redis://localhost:6379/0
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=web-reader-dev
API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

- [ ] **Step 3: Write local dependency compose file**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: web_reader
      POSTGRES_USER: web_reader
      POSTGRES_PASSWORD: web_reader
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  minio:
    image: quay.io/minio/minio:RELEASE.2025-06-13T11-33-47Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  minio_data:
```

- [ ] **Step 4: Write developer commands**

Create `Makefile`:

```makefile
.PHONY: deps up down api worker web test-api test-web test

deps:
	cd services/api && uv sync
	cd services/worker && uv sync
	cd apps/web && pnpm install

up:
	docker compose up -d

down:
	docker compose down

api:
	cd services/api && uv run uvicorn app.main:app --reload --port 8000

worker:
	cd services/worker && uv run celery -A app.celery_app worker --loglevel=info

web:
	cd apps/web && pnpm dev

test-api:
	cd services/api && uv run pytest -q

test-web:
	cd apps/web && pnpm test

test: test-api test-web
```

- [ ] **Step 5: Write README quickstart**

Create `README.md`:

```markdown
# Web Reader Audio Course

Mobile-first audio course product for turning web articles and documents into listenable courses.

## Local services

1. Copy `.env.example` to `.env`.
2. Run `make up`.
3. Run backend tests with `make test-api`.
4. Run web tests with `make test-web`.

The first implementation slice uses a fake TTS provider to validate course creation, sentence timeline generation, and H5 playback before real TTS engines are integrated.
```

- [ ] **Step 6: Verify repository bootstrap**

Run:

```bash
test -f .env.example && test -f docker-compose.yml && test -f Makefile && test -f README.md
```

Expected: command exits with status `0`.

- [ ] **Step 7: Commit**

```bash
git add .gitignore .env.example docker-compose.yml Makefile README.md
git commit -m "chore: bootstrap repository"
```

## Task 2: Backend Project Skeleton

**Files:**
- Create: `services/api/pyproject.toml`
- Create: `services/api/app/main.py`
- Create: `services/api/app/core/config.py`
- Create: `services/api/app/api/router.py`
- Create: `services/api/app/api/routes/health.py`
- Create: `services/api/tests/test_health.py`

- [ ] **Step 1: Create backend package metadata**

Create `services/api/pyproject.toml`:

```toml
[project]
name = "web-reader-api"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "alembic>=1.13.2",
  "boto3>=1.34.150",
  "celery[redis]>=5.4.0",
  "fastapi>=0.111.1",
  "psycopg[binary]>=3.2.1",
  "pydantic-settings>=2.3.4",
  "python-multipart>=0.0.9",
  "sqlalchemy>=2.0.31",
  "uvicorn[standard]>=0.30.3"
]

[dependency-groups]
dev = [
  "httpx>=0.27.0",
  "pytest>=8.3.2",
  "pytest-asyncio>=0.23.8",
  "ruff>=0.5.5"
]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 2: Write failing health test**

Create `services/api/tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_ok():
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
cd services/api && uv run pytest tests/test_health.py -q
```

Expected: FAIL because `app.main` or `/health` is not implemented.

- [ ] **Step 4: Implement config, router, and app**

Create `services/api/app/core/config.py`:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://web_reader:web_reader@localhost:5432/web_reader"
    redis_url: str = "redis://localhost:6379/0"
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key_id: str = "minioadmin"
    s3_secret_access_key: str = "minioadmin"
    s3_bucket: str = "web-reader-dev"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
```

Create `services/api/app/api/routes/health.py`:

```python
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
```

Create `services/api/app/api/router.py`:

```python
from fastapi import APIRouter

from app.api.routes import health

api_router = APIRouter()
api_router.include_router(health.router)
```

Create `services/api/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router

app = FastAPI(title="Web Reader Audio Course API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
```

Create empty package files:

```text
services/api/app/__init__.py
services/api/app/api/__init__.py
services/api/app/api/routes/__init__.py
services/api/app/core/__init__.py
```

- [ ] **Step 5: Run health test**

Run:

```bash
cd services/api && uv run pytest tests/test_health.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/api
git commit -m "feat: add FastAPI skeleton"
```

## Task 3: Backend Database Models

**Files:**
- Create: `services/api/app/db/base.py`
- Create: `services/api/app/db/session.py`
- Create: `services/api/app/models/course.py`
- Create: `services/api/app/models/generation_job.py`
- Create: `services/api/app/models/playback_progress.py`
- Create: `services/api/app/models/__init__.py`
- Create: `services/api/tests/test_models.py`

- [ ] **Step 1: Write model behavior test**

Create `services/api/tests/test_models.py`:

```python
from app.models.course import Course, CourseStatus, SourceType


def test_course_defaults_to_importing_status():
    course = Course(user_id="user_1", title="测试课程", source_type=SourceType.MANUAL_TEXT)

    assert course.status == CourseStatus.IMPORTING
    assert course.word_count == 0
    assert course.duration_seconds == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd services/api && uv run pytest tests/test_models.py -q
```

Expected: FAIL because models are not implemented.

- [ ] **Step 3: Implement database base and models**

Create `services/api/app/db/base.py`:

```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
```

Create `services/api/app/db/session.py`:

```python
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

Create `services/api/app/models/course.py`:

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CourseStatus(str, enum.Enum):
    IMPORTING = "importing"
    EXTRACTING_TEXT = "extracting_text"
    OCR_PROCESSING = "ocr_processing"
    NEEDS_REVIEW = "needs_review"
    TEXT_READY = "text_ready"
    AUDIO_GENERATING = "audio_generating"
    READY = "ready"
    FAILED = "failed"
    DELETED = "deleted"


class SourceType(str, enum.Enum):
    CHROME_EXTENSION = "chrome_extension"
    URL_IMPORT = "url_import"
    FILE_UPLOAD = "file_upload"
    MANUAL_TEXT = "manual_text"


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    title: Mapped[str] = mapped_column(String(512))
    source_type: Mapped[SourceType] = mapped_column(Enum(SourceType))
    status: Mapped[CourseStatus] = mapped_column(Enum(CourseStatus), default=CourseStatus.IMPORTING)
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    current_audio_asset_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    last_playback_position_seconds: Mapped[int] = mapped_column(Integer, default=0)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    article_texts: Mapped[list["ArticleText"]] = relationship(back_populates="course")
    sentences: Mapped[list["Sentence"]] = relationship(back_populates="course")
    audio_assets: Mapped[list["AudioAsset"]] = relationship(back_populates="course")


class ArticleText(Base):
    __tablename__ = "article_texts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    text: Mapped[str] = mapped_column(Text)
    source_quality: Mapped[str] = mapped_column(String(64), default="trusted")
    confirmed_by_user: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    course: Mapped[Course] = relationship(back_populates="article_texts")


class Sentence(Base):
    __tablename__ = "sentences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    article_text_id: Mapped[str] = mapped_column(ForeignKey("article_texts.id"), index=True)
    index: Mapped[int] = mapped_column(Integer)
    paragraph_index: Mapped[int] = mapped_column(Integer, default=0)
    text: Mapped[str] = mapped_column(Text)
    audio_start_seconds: Mapped[float | None] = mapped_column(nullable=True)
    audio_end_seconds: Mapped[float | None] = mapped_column(nullable=True)
    generation_status: Mapped[str] = mapped_column(String(64), default="pending")

    course: Mapped[Course] = relationship(back_populates="sentences")


class AudioAsset(Base):
    __tablename__ = "audio_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    article_text_id: Mapped[str] = mapped_column(ForeignKey("article_texts.id"), index=True)
    provider: Mapped[str] = mapped_column(String(64))
    voice_id: Mapped[str] = mapped_column(String(128))
    speed: Mapped[float] = mapped_column(default=1.0)
    format: Mapped[str] = mapped_column(String(16), default="mp3")
    object_path: Mapped[str] = mapped_column(String(1024))
    duration_seconds: Mapped[int] = mapped_column(Integer)
    character_count: Mapped[int] = mapped_column(Integer)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    course: Mapped[Course] = relationship(back_populates="audio_assets")
```

Create `services/api/app/models/generation_job.py`:

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class JobType(str, enum.Enum):
    SENTENCE_SEGMENT = "sentence_segment"
    TTS_GENERATE = "tts_generate"
    AUDIO_CONCAT = "audio_concat"


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    job_type: Mapped[JobType] = mapped_column(Enum(JobType))
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

Create `services/api/app/models/playback_progress.py`:

```python
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PlaybackProgress(Base):
    __tablename__ = "playback_progress"

    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), primary_key=True)
    audio_asset_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    position_seconds: Mapped[int] = mapped_column(Integer, default=0)
    sentence_index: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

Create `services/api/app/models/__init__.py`:

```python
from app.models.course import ArticleText, AudioAsset, Course, CourseStatus, Sentence, SourceType
from app.models.generation_job import GenerationJob, JobStatus, JobType
from app.models.playback_progress import PlaybackProgress

__all__ = [
    "ArticleText",
    "AudioAsset",
    "Course",
    "CourseStatus",
    "GenerationJob",
    "JobStatus",
    "JobType",
    "PlaybackProgress",
    "Sentence",
    "SourceType",
]
```

- [ ] **Step 4: Run model test**

Run:

```bash
cd services/api && uv run pytest tests/test_models.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/app/db services/api/app/models services/api/tests/test_models.py
git commit -m "feat: add course data models"
```

## Task 4: Sentence Segmentation and Fake TTS Services

**Files:**
- Create: `services/api/app/services/sentence_service.py`
- Create: `services/api/app/services/tts_service.py`
- Create: `services/api/tests/test_sentence_service.py`
- Create: `services/api/tests/test_tts_service.py`

- [ ] **Step 1: Write sentence service tests**

Create `services/api/tests/test_sentence_service.py`:

```python
from app.services.sentence_service import split_into_sentences


def test_split_into_sentences_handles_chinese_and_english_punctuation():
    text = "第一句。第二句！Is this useful? 是的。"

    result = split_into_sentences(text)

    assert result == ["第一句。", "第二句！", "Is this useful?", "是的。"]


def test_split_into_sentences_removes_blank_lines():
    text = "第一段第一句。\n\n第二段第一句。"

    result = split_into_sentences(text)

    assert result == ["第一段第一句。", "第二段第一句。"]
```

- [ ] **Step 2: Write fake TTS tests**

Create `services/api/tests/test_tts_service.py`:

```python
from app.services.tts_service import FakeTTSProvider


def test_fake_tts_creates_timeline_for_each_sentence(tmp_path):
    provider = FakeTTSProvider(output_dir=tmp_path)

    result = provider.synthesize_article(
        course_id="course_1",
        sentences=["第一句。", "第二句。"],
        voice_id="fake-cn",
        speed=1.0,
    )

    assert result.provider == "fake"
    assert result.duration_seconds > 0
    assert result.character_count == 6
    assert result.audio_path.exists()
    assert len(result.timeline) == 2
    assert result.timeline[0].start_seconds == 0
    assert result.timeline[0].end_seconds <= result.timeline[1].start_seconds
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
cd services/api && uv run pytest tests/test_sentence_service.py tests/test_tts_service.py -q
```

Expected: FAIL because services are not implemented.

- [ ] **Step 4: Implement sentence segmentation**

Create `services/api/app/services/sentence_service.py`:

```python
import re

SENTENCE_PATTERN = re.compile(r"[^。！？!?？]+[。！？!?？]?")


def split_into_sentences(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    sentences = [match.group(0).strip() for match in SENTENCE_PATTERN.finditer(normalized)]
    return [sentence for sentence in sentences if sentence]
```

- [ ] **Step 5: Implement fake TTS provider**

Create `services/api/app/services/tts_service.py`:

```python
import wave
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SentenceTiming:
    sentence_index: int
    start_seconds: float
    end_seconds: float


@dataclass(frozen=True)
class SynthesisResult:
    provider: str
    audio_path: Path
    duration_seconds: int
    character_count: int
    timeline: list[SentenceTiming]


class FakeTTSProvider:
    provider = "fake"

    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def synthesize_article(
        self,
        course_id: str,
        sentences: list[str],
        voice_id: str,
        speed: float,
    ) -> SynthesisResult:
        sample_rate = 8_000
        timeline: list[SentenceTiming] = []
        frames = bytearray()
        cursor = 0.0

        for index, sentence in enumerate(sentences):
            duration = max(0.6, len(sentence) * 0.08 / max(speed, 0.5))
            frame_count = int(sample_rate * duration)
            frames.extend(b"\x00\x00" * frame_count)
            timeline.append(SentenceTiming(index, round(cursor, 3), round(cursor + duration, 3)))
            cursor += duration

        audio_path = self.output_dir / f"{course_id}.wav"
        with wave.open(str(audio_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(bytes(frames))

        return SynthesisResult(
            provider=self.provider,
            audio_path=audio_path,
            duration_seconds=max(1, round(cursor)),
            character_count=sum(len(sentence) for sentence in sentences),
            timeline=timeline,
        )
```

- [ ] **Step 6: Run service tests**

Run:

```bash
cd services/api && uv run pytest tests/test_sentence_service.py tests/test_tts_service.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add services/api/app/services/sentence_service.py services/api/app/services/tts_service.py services/api/tests/test_sentence_service.py services/api/tests/test_tts_service.py
git commit -m "feat: add sentence and fake tts services"
```

## Task 5: Course API Vertical Slice

**Files:**
- Create: `services/api/app/schemas/course.py`
- Create: `services/api/app/services/course_service.py`
- Create: `services/api/app/api/deps.py`
- Create: `services/api/app/api/routes/courses.py`
- Modify: `services/api/app/api/router.py`
- Create: `services/api/tests/conftest.py`
- Create: `services/api/tests/test_courses_api.py`

- [ ] **Step 1: Write API tests**

Create `services/api/tests/conftest.py`:

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user_id
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import course as course_models


@pytest.fixture
def db_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with TestingSessionLocal() as session:
        yield session


@pytest.fixture
def client(db_session: Session) -> TestClient:
    def override_get_db():
        yield db_session

    def override_user():
        return "test_user"

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_id] = override_user
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
```

Create `services/api/tests/test_courses_api.py`:

```python
def test_create_text_course_returns_course_with_sentences(client):
    response = client.post(
        "/courses",
        json={
            "title": "测试课程",
            "source_type": "manual_text",
            "text": "第一句。第二句。",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "测试课程"
    assert body["status"] == "text_ready"
    assert len(body["sentences"]) == 2


def test_list_courses_returns_user_courses(client):
    client.post(
        "/courses",
        json={
            "title": "测试课程",
            "source_type": "manual_text",
            "text": "第一句。",
        },
    )

    response = client.get("/courses")

    assert response.status_code == 200
    assert response.json()["items"][0]["title"] == "测试课程"
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd services/api && uv run pytest tests/test_courses_api.py -q
```

Expected: FAIL because course API is not implemented.

- [ ] **Step 3: Implement schemas**

Create `services/api/app/schemas/course.py`:

```python
from pydantic import BaseModel, Field


class SentenceRead(BaseModel):
    index: int
    text: str
    audio_start_seconds: float | None = None
    audio_end_seconds: float | None = None


class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    source_type: str
    text: str = Field(min_length=1)


class CourseRead(BaseModel):
    id: str
    title: str
    source_type: str
    status: str
    word_count: int
    duration_seconds: int
    last_playback_position_seconds: int
    sentences: list[SentenceRead] = []


class CourseList(BaseModel):
    items: list[CourseRead]
```

- [ ] **Step 4: Implement user dependency and service**

Create `services/api/app/api/deps.py`:

```python
from fastapi import Header


def get_current_user_id(x_user_id: str | None = Header(default=None)) -> str:
    return x_user_id or "dev_user"
```

Create `services/api/app/services/course_service.py`:

```python
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.course import ArticleText, Course, CourseStatus, Sentence, SourceType
from app.services.sentence_service import split_into_sentences


def create_text_course(db: Session, user_id: str, title: str, source_type: str, text: str) -> Course:
    course = Course(
        user_id=user_id,
        title=title,
        source_type=SourceType(source_type),
        status=CourseStatus.TEXT_READY,
        word_count=len(text),
    )
    db.add(course)
    db.flush()

    article_text = ArticleText(course_id=course.id, version=1, text=text, confirmed_by_user=True)
    db.add(article_text)
    db.flush()

    for index, sentence_text in enumerate(split_into_sentences(text)):
        db.add(
            Sentence(
                course_id=course.id,
                article_text_id=article_text.id,
                index=index,
                paragraph_index=0,
                text=sentence_text,
            )
        )

    db.commit()
    db.refresh(course)
    return course


def list_courses(db: Session, user_id: str) -> list[Course]:
    statement = (
        select(Course)
        .where(Course.user_id == user_id, Course.is_deleted.is_(False))
        .order_by(Course.created_at.desc())
    )
    return list(db.scalars(statement))
```

- [ ] **Step 5: Implement course routes**

Create `services/api/app/api/routes/courses.py`:

```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id
from app.db.session import get_db
from app.models.course import Course
from app.schemas.course import CourseCreate, CourseList, CourseRead, SentenceRead
from app.services.course_service import create_text_course, list_courses

router = APIRouter(prefix="/courses", tags=["courses"])


def serialize_course(course: Course) -> CourseRead:
    return CourseRead(
        id=course.id,
        title=course.title,
        source_type=course.source_type.value,
        status=course.status.value,
        word_count=course.word_count,
        duration_seconds=course.duration_seconds,
        last_playback_position_seconds=course.last_playback_position_seconds,
        sentences=[
            SentenceRead(
                index=sentence.index,
                text=sentence.text,
                audio_start_seconds=sentence.audio_start_seconds,
                audio_end_seconds=sentence.audio_end_seconds,
            )
            for sentence in sorted(course.sentences, key=lambda item: item.index)
        ],
    )


@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> CourseRead:
    course = create_text_course(db, user_id, payload.title, payload.source_type, payload.text)
    return serialize_course(course)


@router.get("", response_model=CourseList)
def get_courses(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> CourseList:
    return CourseList(items=[serialize_course(course) for course in list_courses(db, user_id)])
```

Modify `services/api/app/api/router.py`:

```python
from fastapi import APIRouter

from app.api.routes import courses, health

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(courses.router)
```

- [ ] **Step 6: Run course API tests**

Run:

```bash
cd services/api && uv run pytest tests/test_courses_api.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add services/api/app/api services/api/app/schemas services/api/app/services/course_service.py services/api/tests
git commit -m "feat: add course text import api"
```

## Task 6: Audio Generation Job Skeleton

**Files:**
- Create: `services/worker/pyproject.toml`
- Create: `services/worker/app/celery_app.py`
- Create: `services/worker/app/tasks/generate_audio.py`
- Create: `services/worker/tests/test_generate_audio_task.py`
- Create: `services/api/app/worker_client.py`
- Modify: `services/api/app/api/routes/courses.py`

- [ ] **Step 1: Write task unit test**

Create `services/worker/tests/test_generate_audio_task.py`:

```python
from app.tasks.generate_audio import build_timeline_payload


def test_build_timeline_payload_serializes_sentence_timings():
    payload = build_timeline_payload(
        [{"index": 0, "text": "第一句。"}, {"index": 1, "text": "第二句。"}],
        [(0, 0.0, 0.8), (1, 0.8, 1.6)],
    )

    assert payload == [
        {"index": 0, "text": "第一句。", "audio_start_seconds": 0.0, "audio_end_seconds": 0.8},
        {"index": 1, "text": "第二句。", "audio_start_seconds": 0.8, "audio_end_seconds": 1.6},
    ]
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd services/worker && uv run pytest tests/test_generate_audio_task.py -q
```

Expected: FAIL because worker project is not implemented.

- [ ] **Step 3: Implement worker package**

Create `services/worker/pyproject.toml`:

```toml
[project]
name = "web-reader-worker"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "celery[redis]>=5.4.0",
  "pydantic-settings>=2.3.4"
]

[dependency-groups]
dev = [
  "pytest>=8.3.2",
  "ruff>=0.5.5"
]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

Create `services/worker/app/celery_app.py`:

```python
import os

from celery import Celery

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("web_reader_worker", broker=redis_url, backend=redis_url)
```

Create `services/worker/app/tasks/generate_audio.py`:

```python
from app.celery_app import celery_app


def build_timeline_payload(
    sentences: list[dict[str, object]],
    timings: list[tuple[int, float, float]],
) -> list[dict[str, object]]:
    timing_by_index = {
        index: {"audio_start_seconds": start, "audio_end_seconds": end}
        for index, start, end in timings
    }
    return [
        {
            "index": sentence["index"],
            "text": sentence["text"],
            **timing_by_index[int(sentence["index"])],
        }
        for sentence in sentences
    ]


@celery_app.task(name="generate_audio_for_course")
def generate_audio_for_course(course_id: str) -> dict[str, str]:
    return {"course_id": course_id, "status": "queued"}
```

Create empty package files:

```text
services/worker/app/__init__.py
services/worker/app/tasks/__init__.py
```

- [ ] **Step 4: Run worker test**

Run:

```bash
cd services/worker && uv run pytest tests/test_generate_audio_task.py -q
```

Expected: PASS.

- [ ] **Step 5: Add API worker client**

Create `services/api/app/worker_client.py`:

```python
from celery import Celery

from app.core.config import settings

celery_client = Celery("web_reader_api", broker=settings.redis_url, backend=settings.redis_url)


def enqueue_audio_generation(course_id: str) -> str:
    result = celery_client.send_task("generate_audio_for_course", args=[course_id])
    return result.id
```

Modify imports in `services/api/app/api/routes/courses.py`:

```python
from app.worker_client import enqueue_audio_generation
```

Modify the `create_course` route body:

```python
@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> CourseRead:
    course = create_text_course(db, user_id, payload.title, payload.source_type, payload.text)
    enqueue_audio_generation(course.id)
    return serialize_course(course)
```

- [ ] **Step 6: Run API tests**

Modify `services/api/tests/test_courses_api.py` so both tests monkeypatch the enqueue call:

```python
def test_create_text_course_returns_course_with_sentences(client, monkeypatch):
    monkeypatch.setattr("app.api.routes.courses.enqueue_audio_generation", lambda course_id: "test-job-id")

    response = client.post(
        "/courses",
        json={
            "title": "测试课程",
            "source_type": "manual_text",
            "text": "第一句。第二句。",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "测试课程"
    assert body["status"] == "text_ready"
    assert len(body["sentences"]) == 2


def test_list_courses_returns_user_courses(client, monkeypatch):
    monkeypatch.setattr("app.api.routes.courses.enqueue_audio_generation", lambda course_id: "test-job-id")

    client.post(
        "/courses",
        json={
            "title": "测试课程",
            "source_type": "manual_text",
            "text": "第一句。",
        },
    )

    response = client.get("/courses")

    assert response.status_code == 200
    assert response.json()["items"][0]["title"] == "测试课程"
```

Run:

```bash
cd services/api && uv run pytest tests/test_courses_api.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add services/worker services/api/app/worker_client.py services/api/app/api/routes/courses.py services/api/tests/test_courses_api.py
git commit -m "feat: enqueue audio generation jobs"
```

## Task 7: H5/Web Frontend Skeleton

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/lib/types.ts`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/components/AppShell.tsx`
- Create: `apps/web/src/components/ImportTextForm.tsx`
- Create: `apps/web/src/components/CourseCard.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/courses/page.tsx`

- [ ] **Step 1: Create frontend package**

Create `apps/web/package.json`:

```json
{
  "name": "web-reader-h5",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "playwright test"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.51.11",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.3",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.40",
    "tailwindcss": "^3.4.7",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: Implement config files**

Create `apps/web/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

Create `apps/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `apps/web/tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {}
  },
  plugins: []
};

export default config;
```

Create `apps/web/postcss.config.mjs`:

```js
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};

export default config;
```

- [ ] **Step 3: Implement API types and client**

Create `apps/web/src/lib/types.ts`:

```ts
export type Sentence = {
  index: number;
  text: string;
  audio_start_seconds: number | null;
  audio_end_seconds: number | null;
};

export type Course = {
  id: string;
  title: string;
  source_type: string;
  status: string;
  word_count: number;
  duration_seconds: number;
  last_playback_position_seconds: number;
  sentences: Sentence[];
};
```

Create `apps/web/src/lib/api.ts`:

```ts
import type { Course } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function listCourses(): Promise<Course[]> {
  const response = await fetch(`${API_BASE_URL}/courses`, {
    headers: { "X-User-Id": "dev_user" },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("Failed to load courses");
  }
  const body = (await response.json()) as { items: Course[] };
  return body.items;
}

export async function createTextCourse(input: { title: string; text: string }): Promise<Course> {
  const response = await fetch(`${API_BASE_URL}/courses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": "dev_user"
    },
    body: JSON.stringify({
      title: input.title,
      text: input.text,
      source_type: "manual_text"
    })
  });
  if (!response.ok) {
    throw new Error("Failed to create course");
  }
  return (await response.json()) as Course;
}
```

- [ ] **Step 4: Implement layout and base styles**

Create `apps/web/src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body {
  min-height: 100%;
  background: #f7f7f4;
  color: #151515;
}
```

Create `apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "有声课程",
  description: "把网页和文档转成可听课程"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

Create `apps/web/src/components/AppShell.tsx`:

```tsx
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-5">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">有声课程</h1>
          <p className="text-sm text-neutral-600">把网页和文档变成路上能听的课程</p>
        </div>
      </header>
      {children}
    </main>
  );
}
```

- [ ] **Step 5: Implement import form and course card**

Create `apps/web/src/components/ImportTextForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createTextCourse } from "@/lib/api";

export function ImportTextForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    await createTextCourse({ title, text });
    setTitle("");
    setText("");
    setSubmitting(false);
    onCreated();
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded border border-neutral-200 bg-white p-4">
      <input
        className="w-full rounded border border-neutral-300 px-3 py-2 text-base"
        placeholder="课程标题"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
      />
      <textarea
        className="min-h-32 w-full rounded border border-neutral-300 px-3 py-2 text-base"
        placeholder="先粘贴一段课程正文，后续任务会接入 URL 和文件上传"
        value={text}
        onChange={(event) => setText(event.target.value)}
        required
      />
      <button
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "导入中" : "导入文本"}
      </button>
    </form>
  );
}
```

Create `apps/web/src/components/CourseCard.tsx`:

```tsx
import Link from "next/link";
import type { Course } from "@/lib/types";

export function CourseCard({ course }: { course: Course }) {
  return (
    <Link href={`/courses/${course.id}`} className="block rounded border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">{course.title}</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {course.word_count} 字 · {course.status}
          </p>
        </div>
        <span className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
          {course.source_type}
        </span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 6: Implement course list page**

Create `apps/web/src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/courses");
}
```

Create `apps/web/src/app/courses/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CourseCard } from "@/components/CourseCard";
import { ImportTextForm } from "@/components/ImportTextForm";
import { listCourses } from "@/lib/api";
import type { Course } from "@/lib/types";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);

  async function refresh() {
    setCourses(await listCourses());
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AppShell>
      <div className="space-y-5">
        <ImportTextForm onCreated={refresh} />
        <section className="space-y-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </section>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 7: Build frontend**

Run:

```bash
cd apps/web && pnpm install && pnpm build
```

Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat: add H5 course library skeleton"
```

## Task 8: Course Detail Player Skeleton

**Files:**
- Create: `apps/web/src/components/SentenceList.tsx`
- Create: `apps/web/src/components/CoursePlayer.tsx`
- Create: `apps/web/src/app/courses/[courseId]/page.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `services/api/app/api/routes/courses.py`
- Modify: `services/api/tests/test_courses_api.py`

- [ ] **Step 1: Add course detail API client**

Modify `apps/web/src/lib/api.ts`:

```ts
export async function getCourse(courseId: string): Promise<Course> {
  const response = await fetch(`${API_BASE_URL}/courses/${courseId}`, {
    headers: { "X-User-Id": "dev_user" },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("Failed to load course");
  }
  return (await response.json()) as Course;
}
```

Modify `services/api/tests/test_courses_api.py` to add:

```python
def test_get_course_returns_course_detail(client, monkeypatch):
    monkeypatch.setattr("app.api.routes.courses.enqueue_audio_generation", lambda course_id: "test-job-id")
    created = client.post(
        "/courses",
        json={"title": "课程详情", "source_type": "manual_text", "text": "第一句。"},
    ).json()

    response = client.get(f"/courses/{created['id']}")

    assert response.status_code == 200
    assert response.json()["title"] == "课程详情"
    assert response.json()["sentences"][0]["text"] == "第一句。"
```

Modify imports in `services/api/app/api/routes/courses.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
```

Add this helper above the route functions:

```python
def get_user_course_or_404(db: Session, user_id: str, course_id: str) -> Course:
    course = db.scalar(
        select(Course).where(
            Course.id == course_id,
            Course.user_id == user_id,
            Course.is_deleted.is_(False),
        )
    )
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course
```

Add this route:

```python
@router.get("/{course_id}", response_model=CourseRead)
def get_course(
    course_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> CourseRead:
    return serialize_course(get_user_course_or_404(db, user_id, course_id))
```

- [ ] **Step 2: Implement sentence list**

Create `apps/web/src/components/SentenceList.tsx`:

```tsx
import type { Sentence } from "@/lib/types";

export function SentenceList({
  sentences,
  activeIndex,
  onSelect
}: {
  sentences: Sentence[];
  activeIndex: number;
  onSelect: (sentence: Sentence) => void;
}) {
  return (
    <div className="space-y-2">
      {sentences.map((sentence) => (
        <button
          key={sentence.index}
          className={[
            "w-full rounded border px-3 py-2 text-left text-base leading-7",
            sentence.index === activeIndex
              ? "border-amber-500 bg-amber-50"
              : "border-neutral-200 bg-white"
          ].join(" ")}
          onClick={() => onSelect(sentence)}
          type="button"
        >
          {sentence.text}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Implement player**

Create `apps/web/src/components/CoursePlayer.tsx`:

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import type { Course, Sentence } from "@/lib/types";
import { SentenceList } from "./SentenceList";

export function CoursePlayer({ course }: { course: Course }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(course.last_playback_position_seconds);

  const activeSentenceIndex = useMemo(() => {
    const match = course.sentences.find((sentence) => {
      if (sentence.audio_start_seconds == null || sentence.audio_end_seconds == null) {
        return false;
      }
      return currentTime >= sentence.audio_start_seconds && currentTime < sentence.audio_end_seconds;
    });
    return match?.index ?? 0;
  }, [course.sentences, currentTime]);

  function seekToSentence(sentence: Sentence) {
    if (sentence.audio_start_seconds == null || audioRef.current == null) {
      return;
    }
    audioRef.current.currentTime = sentence.audio_start_seconds;
    setCurrentTime(sentence.audio_start_seconds);
  }

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        controls
        className="w-full"
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      />
      <SentenceList
        sentences={course.sentences}
        activeIndex={activeSentenceIndex}
        onSelect={seekToSentence}
      />
    </div>
  );
}
```

- [ ] **Step 4: Implement course detail page**

Create `apps/web/src/app/courses/[courseId]/page.tsx`:

```tsx
import { AppShell } from "@/components/AppShell";
import { CoursePlayer } from "@/components/CoursePlayer";
import { getCourse } from "@/lib/api";

export default async function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = await getCourse(courseId);

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{course.title}</h2>
          <p className="text-sm text-neutral-600">
            {course.word_count} 字 · {course.status}
          </p>
        </div>
        <CoursePlayer course={course} />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: Build frontend and run API tests**

Run:

```bash
cd services/api && uv run pytest tests/test_courses_api.py -q
cd ../../apps/web && pnpm build
```

Expected: API tests PASS and frontend build succeeds.

- [ ] **Step 6: Commit**

```bash
git add services/api apps/web
git commit -m "feat: add H5 course player skeleton"
```

## Task 9: Playback Progress API

**Files:**
- Create: `services/api/app/schemas/playback.py`
- Modify: `services/api/app/api/routes/courses.py`
- Create: `services/api/tests/test_playback_progress.py`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/CoursePlayer.tsx`

- [ ] **Step 1: Write playback API tests**

Create `services/api/tests/test_playback_progress.py`:

```python
def test_save_and_restore_playback_progress(client):
    created = client.post(
        "/courses",
        json={"title": "课程", "source_type": "manual_text", "text": "第一句。"},
    ).json()

    response = client.put(
        f"/courses/{created['id']}/progress",
        json={"position_seconds": 12, "sentence_index": 0},
    )

    assert response.status_code == 200
    assert response.json()["position_seconds"] == 12

    detail = client.get(f"/courses/{created['id']}")
    assert detail.json()["last_playback_position_seconds"] == 12
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd services/api && uv run pytest tests/test_playback_progress.py -q
```

Expected: FAIL because progress endpoint is not implemented.

- [ ] **Step 3: Implement playback schema and endpoint**

Create `services/api/app/schemas/playback.py`:

```python
from pydantic import BaseModel, Field


class PlaybackProgressUpdate(BaseModel):
    position_seconds: int = Field(ge=0)
    sentence_index: int = Field(ge=0)


class PlaybackProgressRead(BaseModel):
    position_seconds: int
    sentence_index: int
```

Modify `services/api/app/api/routes/courses.py` to add:

```python
from app.models.playback_progress import PlaybackProgress
from app.schemas.playback import PlaybackProgressRead, PlaybackProgressUpdate


@router.put("/{course_id}/progress", response_model=PlaybackProgressRead)
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
    progress.position_seconds = payload.position_seconds
    progress.sentence_index = payload.sentence_index
    course.last_playback_position_seconds = payload.position_seconds
    db.commit()
    return PlaybackProgressRead(
        position_seconds=progress.position_seconds,
        sentence_index=progress.sentence_index,
    )
```

This endpoint reuses the `get_user_course_or_404` helper added in Task 8.

- [ ] **Step 4: Run playback tests**

Run:

```bash
cd services/api && uv run pytest tests/test_playback_progress.py tests/test_courses_api.py -q
```

Expected: PASS.

- [ ] **Step 5: Wire frontend progress save**

Modify `apps/web/src/lib/api.ts`:

```ts
export async function savePlaybackProgress(input: {
  courseId: string;
  positionSeconds: number;
  sentenceIndex: number;
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/courses/${input.courseId}/progress`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": "dev_user"
    },
    body: JSON.stringify({
      position_seconds: Math.floor(input.positionSeconds),
      sentence_index: input.sentenceIndex
    })
  });
  if (!response.ok) {
    throw new Error("Failed to save progress");
  }
}
```

Modify `apps/web/src/components/CoursePlayer.tsx` to call `savePlaybackProgress` every 10 seconds of playback time.

Use this full component body:

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { savePlaybackProgress } from "@/lib/api";
import type { Course, Sentence } from "@/lib/types";
import { SentenceList } from "./SentenceList";

export function CoursePlayer({ course }: { course: Course }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSavedSecondRef = useRef(course.last_playback_position_seconds);
  const [currentTime, setCurrentTime] = useState(course.last_playback_position_seconds);

  const activeSentenceIndex = useMemo(() => {
    const match = course.sentences.find((sentence) => {
      if (sentence.audio_start_seconds == null || sentence.audio_end_seconds == null) {
        return false;
      }
      return currentTime >= sentence.audio_start_seconds && currentTime < sentence.audio_end_seconds;
    });
    return match?.index ?? 0;
  }, [course.sentences, currentTime]);

  function seekToSentence(sentence: Sentence) {
    if (sentence.audio_start_seconds == null || audioRef.current == null) {
      return;
    }
    audioRef.current.currentTime = sentence.audio_start_seconds;
    setCurrentTime(sentence.audio_start_seconds);
  }

  async function handleTimeUpdate(event: React.SyntheticEvent<HTMLAudioElement>) {
    const nextTime = event.currentTarget.currentTime;
    setCurrentTime(nextTime);
    if (Math.abs(nextTime - lastSavedSecondRef.current) >= 10) {
      lastSavedSecondRef.current = nextTime;
      await savePlaybackProgress({
        courseId: course.id,
        positionSeconds: nextTime,
        sentenceIndex: activeSentenceIndex
      });
    }
  }

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        controls
        className="w-full"
        onTimeUpdate={handleTimeUpdate}
      />
      <SentenceList
        sentences={course.sentences}
        activeIndex={activeSentenceIndex}
        onSelect={seekToSentence}
      />
    </div>
  );
}
```

- [ ] **Step 6: Verify**

Run:

```bash
cd services/api && uv run pytest tests/test_playback_progress.py tests/test_courses_api.py -q
cd ../../apps/web && pnpm build
```

Expected: API tests PASS and frontend build succeeds.

- [ ] **Step 7: Commit**

```bash
git add services/api apps/web
git commit -m "feat: sync playback progress"
```

## Task 10: Deletion and Basic Course Management

**Files:**
- Modify: `services/api/app/api/routes/courses.py`
- Create: `services/api/tests/test_course_deletion.py`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/CourseCard.tsx`

- [ ] **Step 1: Write deletion API test**

Create `services/api/tests/test_course_deletion.py`:

```python
def test_delete_course_removes_it_from_list(client):
    created = client.post(
        "/courses",
        json={"title": "课程", "source_type": "manual_text", "text": "第一句。"},
    ).json()

    response = client.delete(f"/courses/{created['id']}")

    assert response.status_code == 204
    assert client.get("/courses").json()["items"] == []
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd services/api && uv run pytest tests/test_course_deletion.py -q
```

Expected: FAIL because delete endpoint is not implemented.

- [ ] **Step 3: Implement soft delete endpoint**

Modify `services/api/app/api/routes/courses.py`:

```python
from fastapi import Response
from app.models.course import CourseStatus


@router.delete("/{course_id}", status_code=204)
def delete_course(
    course_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    course = get_user_course_or_404(db, user_id, course_id)
    course.is_deleted = True
    course.status = CourseStatus.DELETED
    db.commit()
    return Response(status_code=204)
```

- [ ] **Step 4: Run deletion tests**

Run:

```bash
cd services/api && uv run pytest tests/test_course_deletion.py tests/test_courses_api.py -q
```

Expected: PASS.

- [ ] **Step 5: Wire frontend delete action**

Modify `apps/web/src/lib/api.ts`:

```ts
export async function deleteCourse(courseId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/courses/${courseId}`, {
    method: "DELETE",
    headers: { "X-User-Id": "dev_user" }
  });
  if (!response.ok) {
    throw new Error("Failed to delete course");
  }
}
```

Replace `apps/web/src/components/CourseCard.tsx` with:

```tsx
import Link from "next/link";
import type { Course } from "@/lib/types";

export function CourseCard({
  course,
  onDelete
}: {
  course: Course;
  onDelete: (courseId: string) => void;
}) {
  return (
    <article className="rounded border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/courses/${course.id}`} className="min-w-0 flex-1">
          <h2 className="text-base font-medium">{course.title}</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {course.word_count} 字 · {course.status}
          </p>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
            {course.source_type}
          </span>
          <button
            className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700"
            onClick={() => onDelete(course.id)}
            type="button"
          >
            删除
          </button>
        </div>
      </div>
    </article>
  );
}
```

Modify `apps/web/src/app/courses/page.tsx` to pass `onDelete`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CourseCard } from "@/components/CourseCard";
import { ImportTextForm } from "@/components/ImportTextForm";
import { deleteCourse, listCourses } from "@/lib/api";
import type { Course } from "@/lib/types";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);

  async function refresh() {
    setCourses(await listCourses());
  }

  async function removeCourse(courseId: string) {
    await deleteCourse(courseId);
    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AppShell>
      <div className="space-y-5">
        <ImportTextForm onCreated={refresh} />
        <section className="space-y-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} onDelete={removeCourse} />
          ))}
        </section>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 6: Build frontend**

Run:

```bash
cd apps/web && pnpm build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add services/api apps/web
git commit -m "feat: add course deletion"
```

## Task 11: End-to-End Smoke Test

**Files:**
- Create: `apps/web/tests/course-flow.spec.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add Playwright smoke test**

Create `apps/web/tests/course-flow.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("user imports text and sees it in the course list", async ({ page }) => {
  await page.goto("/courses");

  await page.getByPlaceholder("课程标题").fill("通勤学习课程");
  await page.getByPlaceholder("先粘贴一段课程正文，后续任务会接入 URL 和文件上传").fill("第一句。第二句。");
  await page.getByRole("button", { name: "导入文本" }).click();

  await expect(page.getByText("通勤学习课程")).toBeVisible();
  await expect(page.getByText("6 字")).toBeVisible();
});
```

Modify `apps/web/package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "playwright test",
    "test:ui": "playwright test --ui"
  }
}
```

- [ ] **Step 2: Run smoke test**

Run backend and frontend in separate terminals:

```bash
make api
make web
```

Then run:

```bash
cd apps/web && pnpm test
```

Expected: smoke test PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests apps/web/package.json
git commit -m "test: add H5 import smoke test"
```

## Task 12: Foundation Completion Review

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README with implemented slice**

Add this section to `README.md`:

```markdown
## Implemented foundation slice

- FastAPI health endpoint.
- Course text import API.
- Course list/detail APIs.
- Sentence segmentation.
- Fake TTS service for deterministic local timeline tests.
- Celery audio job skeleton.
- H5 course list.
- H5 course detail and sentence player skeleton.
- Playback progress API.
- Course deletion API.
```

- [ ] **Step 2: Run all available verification**

Run:

```bash
make test-api
cd apps/web && pnpm build
```

Expected:

- API tests PASS.
- Next.js build succeeds.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document foundation slice"
```

## Plan Self-Review

Spec coverage in this foundation plan:

- Covered: H5/Web course list, course detail, text import, sentence list, player skeleton, playback progress, course deletion, backend model shape, async job skeleton, fake TTS timeline mechanism.
- Covered as explicit follow-up plans: Chrome extension, real OCR, real local TTS, cloud TTS, file upload, URL extraction, quota and billing.
- No placeholder markers are used as implementation details. The phrase "separate implementation plans" marks intentionally excluded subsystems, not an unfinished step.
- Type consistency: API schemas use snake_case to match backend responses; frontend types intentionally mirror backend response fields.

## Execution Order

Implement tasks in order. Do not start H5 work before the course API tests pass. Do not integrate real TTS before fake TTS timeline tests pass. Commit after each task.
