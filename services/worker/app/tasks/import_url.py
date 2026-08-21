from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from app.celery_app import celery_app


def get_repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def get_api_dir() -> Path:
    return Path(os.getenv("API_CLI_WORKDIR", str(get_repo_root() / "services" / "api")))


def get_api_python() -> str:
    return os.getenv("API_CLI_PYTHON", str(get_api_dir() / ".venv" / "bin" / "python"))


@celery_app.task(name="import_url_for_course")
def import_url_for_course(course_id: str, job_id: str) -> dict[str, str]:
    api_dir = get_api_dir()
    env = os.environ.copy()
    env["PYTHONPATH"] = str(api_dir)
    completed = subprocess.run(
        [get_api_python(), "-m", "app.cli.import_url", job_id],
        cwd=api_dir,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(completed.stdout) if completed.stdout else {}
    return {
        "course_id": str(payload.get("course_id", course_id)),
        "job_id": str(payload.get("job_id", job_id)),
        "status": str(payload.get("status", "succeeded")),
    }
