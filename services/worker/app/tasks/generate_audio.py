import json
import os
import subprocess
from pathlib import Path

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


def get_repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def get_api_dir() -> Path:
    return Path(os.getenv("API_CLI_WORKDIR", str(get_repo_root() / "services" / "api")))


def get_api_python() -> str:
    return os.getenv("API_CLI_PYTHON", str(get_api_dir() / ".venv" / "bin" / "python"))


@celery_app.task(name="generate_audio_for_course")
def generate_audio_for_course(course_id: str, job_id: str) -> dict[str, str]:
    api_dir = get_api_dir()
    env = os.environ.copy()
    env["PYTHONPATH"] = str(api_dir)
    completed = subprocess.run(
        [get_api_python(), "-m", "app.cli.generate_audio", job_id],
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
