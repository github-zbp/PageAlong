from pathlib import Path

from app.core.config import Settings
from app.core import config


def test_cors_origins_are_parsed_from_comma_separated_env_value():
    settings = Settings(cors_allow_origins="http://localhost:3000, http://example.com")

    assert settings.cors_origins == ["http://localhost:3000", "http://example.com"]


def test_asyncpg_database_url_is_normalized_to_sync_psycopg_driver():
    settings = Settings(database_url="postgresql+asyncpg://web_reader:secret@localhost:5432/web_reader")

    assert settings.database_url == "postgresql+psycopg://web_reader:secret@localhost:5432/web_reader"


def test_settings_env_file_points_to_project_root(monkeypatch):
    project_root = Path(__file__).resolve().parents[3]
    monkeypatch.chdir(project_root / "services" / "api")

    env_file = Path(config.Settings.model_config["env_file"])

    assert env_file == project_root / ".env"
    assert env_file.is_absolute()


def test_auth_and_brevo_settings_have_safe_defaults():
    settings = Settings()

    assert settings.auth_dev_bypass is True
    assert settings.auth_code_cooldown_seconds == 60
    assert settings.auth_code_ttl_seconds == 600
    assert settings.auth_session_ttl_seconds == 30 * 24 * 60 * 60
    assert settings.brevo_smtp_host == "smtp-relay.brevo.com"
    assert settings.brevo_smtp_port == 587
    assert settings.brevo_smtp_password == ""
    assert settings.admin_bootstrap_email == ""


def test_file_import_settings_have_safe_defaults():
    settings = Settings()

    assert settings.file_import_max_file_bytes == 5 * 1024 * 1024
    assert settings.file_import_max_text_characters == 50_000
    assert settings.file_import_storage_backend == "local"
    assert settings.file_import_local_dir == "storage/import_uploads"
    assert settings.file_import_max_files_per_batch == 100
    assert settings.file_import_doc_converter_command == ""


def test_env_example_includes_account_management_settings():
    env_example = (Path(__file__).resolve().parents[3] / ".env.example").read_text()

    assert "AUTH_DEV_BYPASS=true" in env_example
    assert "AUTH_SESSION_TTL_SECONDS=2592000" in env_example
    assert "AUTH_CODE_TTL_SECONDS=600" in env_example
    assert "AUTH_CODE_COOLDOWN_SECONDS=60" in env_example
    assert "AUTH_CODE_MAX_ATTEMPTS=5" in env_example
    assert "AUTH_CODE_HASH_SECRET=replace-with-random-secret" in env_example
    assert "AUTH_VERIFICATION_STORE_BACKEND=memory" in env_example
    assert "BREVO_SMTP_HOST=smtp-relay.brevo.com" in env_example
    assert "BREVO_SMTP_PORT=587" in env_example
    assert "BREVO_SMTP_USERNAME=" in env_example
    assert "BREVO_SMTP_PASSWORD=" in env_example
    assert "MAIL_FROM_EMAIL=" in env_example
    assert "MAIL_FROM_NAME=PageAlong" in env_example
    assert "ADMIN_BOOTSTRAP_EMAIL=" in env_example
    assert "ADMIN_BOOTSTRAP_PASSWORD=" in env_example
    assert "INTERNAL_API_TOKEN=" in env_example


def test_env_example_includes_file_import_settings():
    env_example = (Path(__file__).resolve().parents[3] / ".env.example").read_text()

    assert "FILE_IMPORT_MAX_FILE_BYTES=5242880" in env_example
    assert "FILE_IMPORT_MAX_TEXT_CHARACTERS=50000" in env_example
    assert "FILE_IMPORT_STORAGE_BACKEND=local" in env_example
    assert "FILE_IMPORT_LOCAL_DIR=storage/import_uploads" in env_example
    assert "FILE_IMPORT_MAX_FILES_PER_BATCH=100" in env_example
    assert "FILE_IMPORT_DOC_CONVERTER_COMMAND=" in env_example
