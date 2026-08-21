from __future__ import annotations

import argparse
import json

from app.db.session import SessionLocal
from app.services.file_import_service import FileImportService


def import_file_item(item_id: str) -> dict[str, str | None]:
    with SessionLocal() as db:
        result = FileImportService(db).process_item(item_id)
        return {
            "item_id": result.item_id,
            "batch_id": result.batch_id,
            "course_id": result.course_id,
            "status": result.status,
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import a PageAlong file import item.")
    parser.add_argument("item_id")
    args = parser.parse_args()
    print(json.dumps(import_file_item(args.item_id), ensure_ascii=False))


if __name__ == "__main__":
    main()
