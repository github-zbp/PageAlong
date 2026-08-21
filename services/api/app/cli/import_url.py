from __future__ import annotations

import argparse
import json

from app.db.session import SessionLocal
from app.services.url_import_service import UrlImportService


def import_url_job(job_id: str) -> dict[str, str]:
    with SessionLocal() as db:
        result = UrlImportService(db).run_import_job(job_id)
        return {"course_id": result.course_id, "job_id": result.job_id, "status": result.status}


def main() -> None:
    parser = argparse.ArgumentParser(description="Import a PageAlong URL import job.")
    parser.add_argument("job_id")
    args = parser.parse_args()
    print(json.dumps(import_url_job(args.job_id), ensure_ascii=False))


if __name__ == "__main__":
    main()
