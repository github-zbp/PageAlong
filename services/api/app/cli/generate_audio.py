from __future__ import annotations

import argparse
import json

from app.db.session import SessionLocal
from app.services.audio_generation_service import AudioGenerationService


def generate_audio_job(job_id: str) -> dict[str, str]:
    with SessionLocal() as db:
        result = AudioGenerationService(db).generate_for_job(job_id)
        return {
            "course_id": result.course_id,
            "job_id": result.job_id,
            "status": "succeeded",
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate audio for a PageAlong generation job.")
    parser.add_argument("job_id")
    args = parser.parse_args()
    print(json.dumps(generate_audio_job(args.job_id), ensure_ascii=False))


if __name__ == "__main__":
    main()
