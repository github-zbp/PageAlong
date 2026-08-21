import os
from pathlib import Path

from celery import Celery


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def load_project_env_file(env_path: Path | None = None) -> Path | None:
    resolved_env_path = env_path or get_project_root() / ".env"
    if not resolved_env_path.exists():
        return None

    for raw_line in resolved_env_path.read_text(encoding="utf-8").splitlines():
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
    return resolved_env_path


load_project_env_file()

redis_url = os.getenv("REDIS_URL", "redis://localhost:16379/0")
redis_key_prefix = os.getenv("REDIS_KEY_PREFIX", "web_reader:")
celery_app = Celery("web_reader_worker", broker=redis_url, backend=redis_url)
celery_app.conf.update(
    broker_transport_options={"global_keyprefix": redis_key_prefix},
    result_backend_transport_options={"global_keyprefix": redis_key_prefix},
)

# Import task modules so `celery -A app.celery_app worker` registers them on startup.
import app.tasks.generate_audio  # noqa: E402,F401
import app.tasks.import_file  # noqa: E402,F401
import app.tasks.import_url  # noqa: E402,F401
