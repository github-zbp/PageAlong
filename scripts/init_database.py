from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import URL, Engine, make_url
from sqlalchemy.orm import Session

ROOT_DIR = Path(__file__).resolve().parents[1]
API_DIR = ROOT_DIR / "services" / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

DEFAULT_DATABASE_URL = "postgresql+psycopg://web_reader:web_reader@localhost:15432/web_reader"
DEFAULT_ADMIN_BOOTSTRAP_EMAIL = "wenzhangxiang@yeah.net"
DEFAULT_ADMIN_BOOTSTRAP_PASSWORD_HASH = "pbkdf2_sha256$260000$oouuBwdGZNYDJ84l3eivLQ==$FL-Mt3jA_xYb1XZ6_gRoLFSPbGA_1mCszxxJ9ce7vVg="
SIMPLE_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def load_env_file(env_path: Path = ROOT_DIR / ".env") -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def get_database_url() -> str:
    load_env_file()
    from app.core.config import normalize_database_url

    return normalize_database_url(os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL))


def build_maintenance_database_url(database_url: str) -> tuple[URL, str]:
    url = make_url(database_url)
    if not url.drivername.startswith("postgresql"):
        raise ValueError("DATABASE_URL must use a PostgreSQL driver")
    if not url.database:
        raise ValueError("DATABASE_URL must include a target database name")
    return url.set(database="postgres"), url.database


def quote_postgres_identifier(identifier: str) -> str:
    if SIMPLE_IDENTIFIER_PATTERN.match(identifier):
        return identifier
    return '"' + identifier.replace('"', '""') + '"'


def ensure_database_exists(database_url: str) -> None:
    admin_url, database_name = build_maintenance_database_url(database_url)
    engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with engine.begin() as connection:
            exists = connection.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :database_name"),
                {"database_name": database_name},
            ).scalar_one_or_none()
            if exists is None:
                quoted_database_name = quote_postgres_identifier(database_name)
                connection.execute(text(f"CREATE DATABASE {quoted_database_name}"))
    finally:
        engine.dispose()


def create_application_tables(engine: Engine) -> None:
    import app.models  # noqa: F401
    from app.db.base import Base
    from app.services.tag_service import backfill_legacy_tags

    Base.metadata.create_all(bind=engine)
    ensure_course_library_schema(engine)
    ensure_article_text_schema(engine)
    ensure_tts_schema(engine)
    ensure_media_schema(engine)
    ensure_file_import_schema(engine)
    ensure_auth_schema(engine)
    with Session(engine) as session:
        seed_initial_admin(session)
        backfill_legacy_tags(session)


def ensure_course_library_schema(engine: Engine) -> None:
    with engine.begin() as connection:
        table_names = set(inspect(connection).get_table_names())
        if "courses" not in table_names:
            return

        existing_columns = {column["name"] for column in inspect(connection).get_columns("courses")}
        dialect_name = connection.dialect.name
        column_definitions = {
            "series_id": "VARCHAR(36)",
            "tags_json": "TEXT NOT NULL DEFAULT '[]'",
            "is_starred": "BOOLEAN NOT NULL DEFAULT FALSE"
            if dialect_name == "postgresql"
            else "BOOLEAN NOT NULL DEFAULT 0",
            "last_read_at": "TIMESTAMP WITHOUT TIME ZONE" if dialect_name == "postgresql" else "DATETIME",
            "current_audio_resource_id": "VARCHAR(36)",
        }
        for column_name, column_definition in column_definitions.items():
            if column_name not in existing_columns:
                connection.execute(text(f"ALTER TABLE courses ADD COLUMN {column_name} {column_definition}"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_courses_series_id ON courses (series_id)"))
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_courses_current_audio_resource_id "
                "ON courses (current_audio_resource_id)"
            )
        )

        if "course_series" in table_names:
            series_columns = {column["name"] for column in inspect(connection).get_columns("course_series")}
            if "last_read_course_id" not in series_columns:
                connection.execute(text("ALTER TABLE course_series ADD COLUMN last_read_course_id VARCHAR(36)"))
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_course_series_last_read_course_id "
                    "ON course_series (last_read_course_id)"
                )
            )


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


def ensure_tts_schema(engine: Engine) -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        table_names = set(inspector.get_table_names())
        dialect_name = connection.dialect.name
        timestamp_type = "TIMESTAMP WITHOUT TIME ZONE" if dialect_name == "postgresql" else "DATETIME"

        if "generation_jobs" in table_names:
            if dialect_name == "postgresql":
                _ensure_postgres_enum_value(connection, "jobtype", "URL_IMPORT")
                _ensure_postgres_enum_value(connection, "jobtype", "COURSE_EXPORT_MARKDOWN")
                _ensure_postgres_enum_value(connection, "jobtype", "COURSE_EXPORT_DOCX")
                _ensure_postgres_enum_value(connection, "jobtype", "COURSE_EXPORT_PDF")
            _ensure_columns(
                connection,
                "generation_jobs",
                {
                    "target_type": "VARCHAR(64) NOT NULL DEFAULT 'course'",
                    "target_id": "VARCHAR(36) NOT NULL DEFAULT ''",
                    "provider": "VARCHAR(64)",
                    "fallback_provider": "VARCHAR(64)",
                    "tier": "VARCHAR(32)",
                    "model_id": "VARCHAR(128)",
                    "voice_id": "VARCHAR(128)",
                    "speed_factor": "FLOAT NOT NULL DEFAULT 1.0",
                    "input_json": "TEXT NOT NULL DEFAULT '{}'",
                    "idempotency_key": "VARCHAR(255)",
                    "lease_owner": "VARCHAR(128)",
                    "lease_expires_at": timestamp_type,
                    "heartbeat_at": timestamp_type,
                    "progress_current": "INTEGER NOT NULL DEFAULT 0",
                    "progress_total": "INTEGER NOT NULL DEFAULT 0",
                    "result_resource_id": "VARCHAR(36)",
                    "created_at": timestamp_type,
                    "updated_at": timestamp_type,
                },
            )
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_generation_jobs_idempotency_key "
                    "ON generation_jobs (idempotency_key)"
                )
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_generation_jobs_result_resource_id "
                    "ON generation_jobs (result_resource_id)"
                )
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_generation_jobs_target_type_target_id "
                    "ON generation_jobs (target_type, target_id)"
                )
            )
            connection.execute(
                text(
                    "UPDATE generation_jobs "
                    "SET target_type = 'course', target_id = course_id "
                    "WHERE (target_type IS NULL OR target_type = '') "
                    "AND course_id IS NOT NULL"
                )
            )

        if "audio_assets" in table_names:
            _ensure_columns(
                connection,
                "audio_assets",
                {
                    "generation_job_id": "VARCHAR(36)",
                    "resource_id": "VARCHAR(36)",
                    "model_id": "VARCHAR(128) NOT NULL DEFAULT ''",
                    "tier": "VARCHAR(32) NOT NULL DEFAULT 'free'",
                    "storage_backend": "VARCHAR(32) NOT NULL DEFAULT 'local'",
                    "bucket": "VARCHAR(255)",
                    "object_key": "VARCHAR(1024)",
                    "content_type": "VARCHAR(128) NOT NULL DEFAULT 'audio/mpeg'",
                    "byte_size": "INTEGER NOT NULL DEFAULT 0",
                    "etag": "VARCHAR(255)",
                    "checksum_sha256": "VARCHAR(128)",
                    "metadata_json": "TEXT NOT NULL DEFAULT '{}'",
                },
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_audio_assets_generation_job_id ON audio_assets (generation_job_id)")
            )
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_audio_assets_resource_id ON audio_assets (resource_id)"))

        if "tts_segments" in table_names:
            _ensure_columns(
                connection,
                "tts_segments",
                {"timing_json": "TEXT NOT NULL DEFAULT '[]'"},
            )


def ensure_media_schema(engine: Engine) -> None:
    with engine.begin() as connection:
        table_names = set(inspect(connection).get_table_names())
        if "article_image_assets" not in table_names:
            return
        _ensure_columns(
            connection,
            "article_image_assets",
            {
                "resource_id": "VARCHAR(36)",
                "metadata_json": "TEXT NOT NULL DEFAULT '{}'",
            },
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_article_image_assets_resource_id "
                "ON article_image_assets (resource_id)"
            )
        )


def ensure_file_import_schema(engine: Engine) -> None:
    with engine.begin() as connection:
        table_names = set(inspect(connection).get_table_names())
        if "file_import_items" not in table_names:
            return
        _ensure_columns(
            connection,
            "file_import_items",
            {
                "resource_id": "VARCHAR(36)",
            },
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_file_import_items_resource_id "
                "ON file_import_items (resource_id)"
            )
        )


def ensure_auth_schema(engine: Engine) -> None:
    with engine.begin() as connection:
        table_names = set(inspect(connection).get_table_names())
        if "users" not in table_names:
            return
        dialect_name = connection.dialect.name
        timestamp_type = "TIMESTAMP WITHOUT TIME ZONE" if dialect_name == "postgresql" else "DATETIME"
        boolean_default_false = "BOOLEAN NOT NULL DEFAULT FALSE" if dialect_name == "postgresql" else "BOOLEAN NOT NULL DEFAULT 0"
        _ensure_columns(
            connection,
            "users",
            {
                "must_change_password_at_next_login": boolean_default_false,
                "last_login_at": timestamp_type,
            },
        )
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)"))


def seed_initial_admin(session: Session) -> None:
    from app.models.user import User, UserRole, UserStatus
    from app.services.auth_security import hash_password, normalize_email

    email = normalize_email(os.environ.get("ADMIN_BOOTSTRAP_EMAIL", DEFAULT_ADMIN_BOOTSTRAP_EMAIL))
    password = os.environ.get("ADMIN_BOOTSTRAP_PASSWORD")
    password_hash = hash_password(password) if password else DEFAULT_ADMIN_BOOTSTRAP_PASSWORD_HASH

    existing = session.query(User).filter(User.email == email).one_or_none()
    if existing is not None:
        if existing.role != UserRole.ADMIN or existing.status != UserStatus.ACTIVE:
            existing.role = UserRole.ADMIN
            existing.status = UserStatus.ACTIVE
            session.commit()
        return

    admin = User(
        email=email,
        password_hash=password_hash,
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
        must_change_password_at_next_login=True,
    )
    session.add(admin)
    session.commit()


def _ensure_columns(connection, table_name: str, column_definitions: dict[str, str]) -> None:
    existing_columns = {column["name"] for column in inspect(connection).get_columns(table_name)}
    for column_name, column_definition in column_definitions.items():
        if column_name not in existing_columns:
            connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}"))


def _ensure_postgres_enum_value(connection, type_name: str, label: str) -> None:
    exists = connection.execute(
        text("SELECT 1 FROM pg_enum WHERE enumlabel = :label AND enumtypid = to_regtype(:type_name)"),
        {"label": label, "type_name": type_name},
    ).scalar_one_or_none()
    if exists is None:
        connection.execute(text(f"ALTER TYPE {quote_postgres_identifier(type_name)} ADD VALUE '{label}'"))


def ensure_application_tables(database_url: str) -> None:
    engine = create_engine(database_url)
    try:
        create_application_tables(engine)
    finally:
        engine.dispose()


def main() -> None:
    database_url = get_database_url()
    ensure_database_exists(database_url)
    ensure_application_tables(database_url)
    print("Database and application tables are ready.")


if __name__ == "__main__":
    main()
