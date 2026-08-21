from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


def find_project_root(start: Path) -> Path:
    current = start if start.is_dir() else start.parent
    for candidate in (current, *current.parents):
        if (candidate / "Makefile").is_file() and (candidate / "services" / "api").is_dir():
            return candidate
    return Path(__file__).resolve().parents[4]


PROJECT_ROOT = find_project_root(Path(__file__).resolve())
PROJECT_ENV_FILE = PROJECT_ROOT / ".env"


def normalize_database_url(database_url: str) -> str:
    url = make_url(database_url)
    if url.drivername == "postgresql+asyncpg":
        return url.set(drivername="postgresql+psycopg").render_as_string(hide_password=False)
    return database_url


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://web_reader:web_reader@localhost:15432/web_reader"
    redis_url: str = "redis://localhost:16379/0"
    redis_key_prefix: str = "web_reader:"
    generated_audio_dir: str = "storage/generated_audio"
    s3_endpoint_url: str = "http://localhost:19000"
    s3_access_key_id: str = "minioadmin"
    s3_secret_access_key: str = "minioadmin"
    s3_bucket: str = "web-reader-dev"
    media_public_base_url: str = ""
    local_media_dir: str = "storage/media"
    file_import_max_file_bytes: int = 5 * 1024 * 1024
    file_import_max_text_characters: int = 50_000
    file_import_storage_backend: str = "local"
    file_import_local_dir: str = "storage/import_uploads"
    file_import_max_files_per_batch: int = 100
    file_import_doc_converter_command: str = ""
    url_import_image_storage_backend: str = ""
    url_import_image_max_count: int = 20
    url_import_image_max_bytes: int = 8 * 1024 * 1024
    media_compression_enabled: bool = True
    media_compression_failure_mode: str = "strict"
    media_compression_timeout_seconds: int = 300
    audio_compression_enabled: bool = True
    audio_compression_format: str = "mp3"
    audio_compression_bitrate: str = "64k"
    audio_compression_sample_rate: int = 24000
    audio_compression_channels: int = 1
    image_compression_enabled: bool = True
    image_compression_format: str = "webp"
    image_compression_quality: int = 80
    image_compression_max_width: int = 1600
    image_compression_max_height: int = 1600
    cors_allow_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    internal_api_token: str = ""
    internal_api_hmac_secret: str = ""
    internal_api_signature_ttl_seconds: int = 300
    internal_api_replay_store: str = "memory"

    auth_dev_bypass: bool = True
    auth_session_ttl_seconds: int = 30 * 24 * 60 * 60
    auth_session_cookie_name: str = "pagealong_session"
    auth_session_cookie_secure: bool = False
    auth_session_cookie_samesite: str = "lax"
    auth_session_cookie_domain: str = ""
    auth_code_ttl_seconds: int = 10 * 60
    auth_code_cooldown_seconds: int = 60
    auth_code_max_attempts: int = 5
    auth_code_hash_secret: str = "dev-auth-code-secret"
    auth_verification_store_backend: str = "memory"

    brevo_smtp_host: str = "smtp-relay.brevo.com"
    brevo_smtp_port: int = 587
    brevo_smtp_username: str = ""
    brevo_smtp_password: str = ""
    mail_from_email: str = "no-reply@localhost"
    mail_from_name: str = "PageAlong"

    admin_bootstrap_email: str = ""
    admin_bootstrap_password: str = ""

    tts_provider_mode: str = "auto"
    tts_default_free_provider: str = "edge_tts"
    tts_free_fallback_provider: str = "kokoro_onnx_cpu"
    tts_default_paid_provider: str = "tencent_cloud_tts"
    tts_paid_fallback_provider: str = "aws_polly_standard"
    tts_paid_user_ids: str = ""

    tts_edge_enabled: bool = True
    tts_edge_timeout_seconds: int = 20
    tts_edge_max_concurrency: int = 2

    tts_kokoro_model_path: str = ""
    tts_kokoro_voices_path: str = ""
    tts_kokoro_voice: str = "zf_xiaobei"
    tts_kokoro_voice_path: str = ""
    tts_kokoro_max_concurrency: int = 1

    tts_tencent_app_id: str = ""
    tts_tencent_secret_id: str = ""
    tts_tencent_secret_key: str = ""
    tts_tencent_region: str = "ap-guangzhou"
    tts_tencent_voice_type: str = "101001"
    tts_tencent_codec: str = "mp3"
    tts_tencent_sample_rate: int = 16000
    tts_tencent_timeout_seconds: int = 30
    tts_tencent_max_concurrency: int = 16
    tts_tencent_max_chinese_chars: int = 560
    tts_tencent_max_english_letters: int = 1600

    tts_aws_region: str = "us-east-1"
    tts_aws_polly_voice_id: str = "Zhiyu"
    tts_aws_polly_engine: str = "standard"
    tts_aws_polly_max_concurrency: int = 60
    tts_aws_polly_max_characters: int = 2500

    free_tts_monthly_course_limit: int = 3
    free_tts_daily_course_limit: int = 10
    free_tts_monthly_audio_minutes: int = 60
    free_tts_max_course_characters: int = 12000
    paid_tts_max_auto_characters: int = 120000

    tts_storage_backend: str = "local"
    tts_signed_url_ttl_seconds: int = 900

    model_config = SettingsConfigDict(env_file=PROJECT_ENV_FILE, extra="ignore")

    @field_validator("database_url")
    @classmethod
    def use_sync_postgres_driver(cls, database_url: str) -> str:
        return normalize_database_url(database_url)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]

    @property
    def paid_user_ids(self) -> set[str]:
        return {user_id.strip() for user_id in self.tts_paid_user_ids.split(",") if user_id.strip()}


settings = Settings()
