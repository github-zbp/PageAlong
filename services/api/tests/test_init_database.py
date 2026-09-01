import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.dialects import postgresql

ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from scripts import init_database  # noqa: E402


def test_build_maintenance_database_url_targets_postgres_database():
    admin_url, database_name = init_database.build_maintenance_database_url(
        "postgresql+psycopg://web_reader:web_reader@localhost:5432/web_reader"
    )

    assert str(admin_url) == "postgresql+psycopg://web_reader:***@localhost:5432/postgres"
    assert database_name == "web_reader"
    assert admin_url.render_as_string(hide_password=False) == (
        "postgresql+psycopg://web_reader:web_reader@localhost:5432/postgres"
    )


def test_get_database_url_normalizes_asyncpg_driver(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://web_reader:secret@localhost:5432/web_reader",
    )

    assert init_database.get_database_url() == (
        "postgresql+psycopg://web_reader:secret@localhost:5432/web_reader"
    )


def test_ensure_database_exists_creates_missing_database(monkeypatch):
    calls: list[tuple[str, dict[str, str] | None]] = []

    class FakeResult:
        def scalar_one_or_none(self):
            return None

    class FakeConnection:
        def execute(self, statement, params=None):
            calls.append((str(statement), params))
            return FakeResult()

    class FakeBegin:
        def __enter__(self):
            return FakeConnection()

        def __exit__(self, exc_type, exc, traceback):
            return None

    class FakeEngine:
        def begin(self):
            return FakeBegin()

        def dispose(self):
            calls.append(("dispose", None))

    def fake_create_engine(url, isolation_level=None):
        calls.append((str(url), {"isolation_level": isolation_level}))
        return FakeEngine()

    monkeypatch.setattr(init_database, "create_engine", fake_create_engine)

    init_database.ensure_database_exists(
        "postgresql+psycopg://web_reader:web_reader@localhost:5432/web_reader"
    )

    assert calls == [
        (
            "postgresql+psycopg://web_reader:***@localhost:5432/postgres",
            {"isolation_level": "AUTOCOMMIT"},
        ),
        (
            "SELECT 1 FROM pg_database WHERE datname = :database_name",
            {"database_name": "web_reader"},
        ),
        ("CREATE DATABASE web_reader", None),
        ("dispose", None),
    ]


def test_create_application_tables_registers_current_models():
    engine = create_engine("sqlite://")

    init_database.create_application_tables(engine)

    assert set(inspect(engine).get_table_names()) == {
        "admin_impersonation_tokens",
        "announcements",
        "article_image_assets",
        "article_texts",
        "auth_events",
        "auth_sessions",
        "audio_assets",
        "blog_posts",
        "course_tags",
        "course_sections",
        "course_series",
        "courses",
        "file_import_batches",
        "file_import_items",
        "file_resources",
        "generation_jobs",
        "playback_progress",
        "sentences",
        "tags",
        "tts_quota_periods",
        "tts_segments",
        "tts_usage_events",
        "user_preferences",
        "users",
    }
    user_columns = {column["name"] for column in inspect(engine).get_columns("users")}
    assert {"last_dashboard_at", "last_dashboard_locale"}.issubset(user_columns)


def test_create_application_tables_registers_file_import_tables():
    engine = create_engine("sqlite://")

    init_database.create_application_tables(engine)

    table_names = set(inspect(engine).get_table_names())
    assert "file_import_batches" in table_names
    assert "file_import_items" in table_names


def test_create_application_tables_upgrades_legacy_course_columns():
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
                    is_deleted BOOLEAN,
                    created_at DATETIME,
                    updated_at DATETIME
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO courses (
                    id, user_id, title, source_type, status, word_count,
                    duration_seconds, last_playback_position_seconds, is_deleted
                )
                VALUES (
                    'legacy_course', 'test_user', '旧课程', 'manual_text', 'ready',
                    12, 0, 0, 0
                )
                """
            )
        )

    init_database.create_application_tables(engine)

    course_columns = {column["name"] for column in inspect(engine).get_columns("courses")}
    assert {"series_id", "tags_json", "is_starred", "last_read_at", "current_audio_resource_id"}.issubset(course_columns)
    assert "course_series" in inspect(engine).get_table_names()
    with engine.begin() as connection:
        legacy_row = connection.execute(
            text("SELECT tags_json, is_starred, last_read_at FROM courses WHERE id = 'legacy_course'")
        ).mappings().one()
    assert legacy_row["tags_json"] == "[]"
    assert legacy_row["is_starred"] in {0, False}
    assert legacy_row["last_read_at"] is None


def test_create_application_tables_backfills_legacy_tags_into_tag_tables():
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


def test_create_application_tables_upgrades_legacy_tts_columns():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE generation_jobs (
                    id VARCHAR(36) PRIMARY KEY,
                    course_id VARCHAR(36),
                    job_type VARCHAR(32),
                    status VARCHAR(32),
                    attempt_count INTEGER,
                    target_type VARCHAR(64),
                    target_id VARCHAR(36),
                    error_code VARCHAR(128),
                    error_message TEXT,
                    started_at DATETIME,
                    finished_at DATETIME,
                    result_resource_id VARCHAR(36)
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE audio_assets (
                    id VARCHAR(36) PRIMARY KEY,
                    course_id VARCHAR(36),
                    article_text_id VARCHAR(36),
                    provider VARCHAR(64),
                    voice_id VARCHAR(128),
                    speed FLOAT,
                    format VARCHAR(16),
                    object_path VARCHAR(1024),
                    resource_id VARCHAR(36),
                    duration_seconds INTEGER,
                    character_count INTEGER,
                    is_current BOOLEAN,
                    created_at DATETIME
                )
                """
            )
        )

    init_database.create_application_tables(engine)

    table_names = set(inspect(engine).get_table_names())
    generation_job_columns = {column["name"] for column in inspect(engine).get_columns("generation_jobs")}
    audio_asset_columns = {column["name"] for column in inspect(engine).get_columns("audio_assets")}
    tts_segment_columns = {column["name"] for column in inspect(engine).get_columns("tts_segments")}
    assert {"course_sections", "tts_segments", "tts_usage_events", "tts_quota_periods"}.issubset(table_names)
    assert {
        "target_type",
        "target_id",
        "provider",
        "fallback_provider",
        "tier",
        "model_id",
        "voice_id",
        "speed_factor",
        "lease_owner",
        "progress_current",
        "progress_total",
        "result_resource_id",
        "created_at",
        "updated_at",
    }.issubset(generation_job_columns)
    assert {
        "generation_job_id",
        "resource_id",
        "model_id",
        "tier",
        "storage_backend",
        "bucket",
        "object_key",
        "content_type",
        "byte_size",
        "metadata_json",
    }.issubset(audio_asset_columns)
    assert "timing_json" in tts_segment_columns


def test_create_application_tables_upgrades_legacy_article_text_columns():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE article_texts (
                    id VARCHAR(36) PRIMARY KEY,
                    course_id VARCHAR(36),
                    version INTEGER,
                    text TEXT,
                    source_quality VARCHAR(64),
                    confirmed_by_user BOOLEAN,
                    created_at DATETIME
                )
                """
            )
        )

    init_database.create_application_tables(engine)

    article_text_columns = {column["name"] for column in inspect(engine).get_columns("article_texts")}
    generation_job_columns = {column["name"] for column in inspect(engine).get_columns("generation_jobs")}
    assert {
        "content_markdown",
        "outline_json",
        "content_hash",
        "source_metadata_json",
        "extraction_metadata_json",
    }.issubset(article_text_columns)
    assert "input_json" in generation_job_columns


def test_create_application_tables_upgrades_legacy_article_image_columns():
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

    image_asset_columns = {column["name"] for column in inspect(engine).get_columns("article_image_assets")}
    assert {"metadata_json", "resource_id"}.issubset(image_asset_columns)


def test_ensure_tts_schema_adds_url_import_to_postgres_jobtype_enum(monkeypatch):
    statements: list[tuple[str, dict[str, str] | None]] = []

    class FakeResult:
        def scalar_one_or_none(self):
            return None

    class FakeInspector:
        def get_table_names(self):
            return ["generation_jobs"]

        def get_columns(self, table_name):
            return []

    class FakeConnection:
        dialect = type("Dialect", (), {"name": "postgresql"})()

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return None

        def execute(self, statement, params=None):
            compiled_statement = str(statement.compile(dialect=postgresql.dialect()))
            statements.append((compiled_statement, params))
            return FakeResult()

    monkeypatch.setattr(init_database, "inspect", lambda connection: FakeInspector())

    init_database.ensure_tts_schema(type("Engine", (), {"begin": lambda self: FakeConnection()})())

    assert (
        "SELECT 1 FROM pg_enum WHERE enumlabel = %(label)s AND enumtypid = to_regtype(%(type_name)s)",
        {"label": "URL_IMPORT", "type_name": "jobtype"},
    ) in statements
    assert ("ALTER TYPE jobtype ADD VALUE 'URL_IMPORT'", None) in statements
