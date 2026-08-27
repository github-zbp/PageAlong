from __future__ import annotations

import argparse
import json

from app.db.session import SessionLocal
from app.services.job_service import run_generation_job


def run_job(job_id: str) -> dict[str, str]:
    with SessionLocal() as db:
        return run_generation_job(db, job_id)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a PageAlong generation job.")
    parser.add_argument("job_id")
    args = parser.parse_args()
    print(json.dumps(run_job(args.job_id), ensure_ascii=False))


if __name__ == "__main__":
    main()
