from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

ROOT_DIR = Path(__file__).resolve().parents[1]
API_DIR = ROOT_DIR / "services" / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.db.session import SessionLocal

DEFAULT_OLD_DOMAIN = "media.zbpblog.cn"
DEFAULT_NEW_DOMAIN = "media.pagealong.com"
IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

REPLACEMENT_TARGETS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("article_texts", ("content_markdown",)),
    ("article_image_assets", ("object_path",)),
    ("audio_assets", ("object_path",)),
    ("announcements", ("body_markdown", "body_html")),
    ("blog_posts", ("cover_image_url", "body_markdown", "body_html")),
    ("file_import_items", ("object_path",)),
    ("file_resources", ("object_path",)),
    ("tts_segments", ("object_path",)),
)


@dataclass(frozen=True)
class ReplacementResult:
    table: str
    column: str
    matched_rows: int
    updated_rows: int


def quote_identifier(identifier: str) -> str:
    if not IDENTIFIER_RE.fullmatch(identifier):
        return '"' + identifier.replace('"', '""') + '"'
    return identifier


def escape_like(value: str) -> str:
    return value.replace("^", "^^").replace("%", "^%").replace("_", "^_")


def iter_replacement_targets(db: Session) -> list[tuple[str, str]]:
    inspector = inspect(db.get_bind())
    table_names = set(inspector.get_table_names())
    targets: list[tuple[str, str]] = []

    for table_name, column_names in REPLACEMENT_TARGETS:
        if table_name not in table_names:
            continue

        existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
        for column_name in column_names:
            if column_name in existing_columns:
                targets.append((table_name, column_name))

    return targets


def replace_media_domain(
    db: Session,
    *,
    old_domain: str = DEFAULT_OLD_DOMAIN,
    new_domain: str = DEFAULT_NEW_DOMAIN,
    apply_changes: bool = False,
) -> list[ReplacementResult]:
    if old_domain == new_domain:
        raise ValueError("old_domain and new_domain must be different")

    results: list[ReplacementResult] = []
    pattern = f"%{escape_like(old_domain)}%"

    for table_name, column_name in iter_replacement_targets(db):
        table_sql = quote_identifier(table_name)
        column_sql = quote_identifier(column_name)

        matched_rows = db.execute(
            text(f"SELECT COUNT(*) FROM {table_sql} WHERE {column_sql} LIKE :pattern ESCAPE '^'"),
            {"pattern": pattern},
        ).scalar_one()

        if matched_rows == 0:
            continue

        updated_rows = 0
        if apply_changes:
            db.execute(
                text(
                    f"UPDATE {table_sql} "
                    f"SET {column_sql} = REPLACE({column_sql}, :old_domain, :new_domain) "
                    f"WHERE {column_sql} LIKE :pattern ESCAPE '^'"
                ),
                {
                    "old_domain": old_domain,
                    "new_domain": new_domain,
                    "pattern": pattern,
                },
            )
            updated_rows = matched_rows

        results.append(
            ReplacementResult(
                table=table_name,
                column=column_name,
                matched_rows=int(matched_rows),
                updated_rows=int(updated_rows),
            )
        )

    if apply_changes:
        db.commit()
    else:
        db.rollback()

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Replace the legacy media domain in persisted PageAlong records.")
    parser.add_argument("--old-domain", default=DEFAULT_OLD_DOMAIN, help="Domain to replace")
    parser.add_argument("--new-domain", default=DEFAULT_NEW_DOMAIN, help="Replacement domain")
    parser.add_argument("--apply", action="store_true", help="Write the changes back to the database")
    args = parser.parse_args()

    with SessionLocal() as db:
        results = replace_media_domain(
            db,
            old_domain=args.old_domain,
            new_domain=args.new_domain,
            apply_changes=args.apply,
        )

    payload = {
        "mode": "apply" if args.apply else "dry-run",
        "old_domain": args.old_domain,
        "new_domain": args.new_domain,
        "results": [asdict(result) for result in results],
        "matched_rows": sum(result.matched_rows for result in results),
        "updated_rows": sum(result.updated_rows for result in results),
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
