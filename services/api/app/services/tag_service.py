from __future__ import annotations

import json
import random
from collections import defaultdict

from sqlalchemy import and_, func, select, text
from sqlalchemy.orm import Session, selectinload

from app.models.course import Course, CourseSeries
from app.models.tag import CourseTag, TAG_COLOR_PALETTE, Tag
from app.schemas.course import TagRead


class TagAlreadyExistsError(ValueError):
    pass


class TagNotFoundError(ValueError):
    pass


def pick_tag_color() -> str:
    return random.choice(TAG_COLOR_PALETTE)


def normalize_tag_name(value: str) -> str:
    return str(value or "").strip()[:128]


def normalize_tag_names(values: list[str] | None) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values or []:
        name = normalize_tag_name(value)
        if not name or name in seen:
            continue
        normalized.append(name)
        seen.add(name)
    return normalized[:20]


def decode_tag_names(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return normalize_tag_names([str(item) for item in parsed])


def encode_tag_names(values: list[str] | None) -> str:
    return json.dumps(normalize_tag_names(values), ensure_ascii=False)


def get_tag_by_id(db: Session, user_id: str, tag_id: str) -> Tag:
    tag = db.scalar(select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id))
    if tag is None:
        raise TagNotFoundError(f"Tag not found: {tag_id}")
    return tag


def get_tag_by_name(db: Session, user_id: str, name: str) -> Tag | None:
    normalized_name = normalize_tag_name(name)
    if not normalized_name:
        return None
    return db.scalar(select(Tag).where(Tag.user_id == user_id, Tag.name == normalized_name))


def create_tag(db: Session, user_id: str, name: str, color: str | None = None) -> Tag:
    normalized_name = normalize_tag_name(name)
    if not normalized_name:
        raise ValueError("Tag name is required")
    if get_tag_by_name(db, user_id, normalized_name) is not None:
        raise TagAlreadyExistsError(f"Tag already exists: {normalized_name}")

    tag = Tag(user_id=user_id, name=normalized_name, color=color or pick_tag_color())
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


def update_tag(db: Session, tag: Tag, *, name: str | None = None, color: str | None = None) -> Tag:
    if name is not None:
        normalized_name = normalize_tag_name(name)
        if not normalized_name:
            raise ValueError("Tag name is required")
        existing = get_tag_by_name(db, tag.user_id, normalized_name)
        if existing is not None and existing.id != tag.id:
            raise TagAlreadyExistsError(f"Tag already exists: {normalized_name}")
        old_name = tag.name
        if normalized_name != old_name:
            tag.name = normalized_name
            _replace_legacy_tag_name(db, tag.user_id, old_name, normalized_name)
    if color is not None:
        tag.color = color
    db.commit()
    db.refresh(tag)
    return tag


def delete_tag(db: Session, tag: Tag) -> None:
    _remove_legacy_tag_name(db, tag.user_id, tag.name)
    db.query(CourseTag).filter(CourseTag.tag_id == tag.id).delete(synchronize_session=False)
    db.delete(tag)
    db.commit()


def resolve_tags_by_ids(db: Session, user_id: str, tag_ids: list[str] | None) -> list[Tag]:
    ordered_ids = [tag_id for tag_id in tag_ids or [] if tag_id]
    if not ordered_ids:
        return []

    rows = list(
        db.scalars(
            select(Tag).where(
                Tag.user_id == user_id,
                Tag.id.in_(ordered_ids),
            )
        )
    )
    by_id = {tag.id: tag for tag in rows}
    missing = [tag_id for tag_id in ordered_ids if tag_id not in by_id]
    if missing:
        raise TagNotFoundError(f"Tag not found: {missing[0]}")

    resolved: list[Tag] = []
    seen: set[str] = set()
    for tag_id in ordered_ids:
        if tag_id in seen:
            continue
        seen.add(tag_id)
        resolved.append(by_id[tag_id])
    return resolved


def resolve_or_create_tags_by_names(db: Session, user_id: str, names: list[str] | None) -> list[Tag]:
    resolved: list[Tag] = []
    seen: set[str] = set()
    for name in normalize_tag_names(names):
        tag = get_tag_by_name(db, user_id, name)
        if tag is None:
            tag = Tag(user_id=user_id, name=name, color=pick_tag_color())
            db.add(tag)
            db.flush()
        if tag.id in seen:
            continue
        seen.add(tag.id)
        resolved.append(tag)
    return resolved


def sync_course_tags(
    db: Session,
    course: Course,
    *,
    direct_tag_ids: list[str] | None = None,
    direct_tag_names: list[str] | None = None,
    series_tag_names: list[str] | None = None,
) -> list[Tag]:
    if direct_tag_ids is not None:
        direct_tags = resolve_tags_by_ids(db, course.user_id, direct_tag_ids)
        direct_names = [tag.name for tag in direct_tags]
    else:
        direct_names = normalize_tag_names(direct_tag_names if direct_tag_names is not None else decode_tag_names(course.tags_json))
        direct_tags = resolve_or_create_tags_by_names(db, course.user_id, direct_names)

    if series_tag_names is None and course.series is not None and not course.series.is_deleted:
        series_tag_names = decode_tag_names(course.series.tags_json)
    series_names = normalize_tag_names(series_tag_names)

    materialized: list[Tag] = []
    seen_ids: set[str] = set()
    for tag in direct_tags + resolve_or_create_tags_by_names(db, course.user_id, series_names):
        if tag.id in seen_ids:
            continue
        seen_ids.add(tag.id)
        materialized.append(tag)

    course.tags_json = encode_tag_names(direct_names)
    course.tags = materialized
    db.flush()
    return materialized


def sync_series_courses_tags(db: Session, series: CourseSeries) -> None:
    series_tag_names = decode_tag_names(series.tags_json)
    for course in series.courses:
        if course.is_deleted:
            continue
        sync_course_tags(
            db,
            course,
            direct_tag_names=decode_tag_names(course.tags_json),
            series_tag_names=series_tag_names,
        )


def list_tags(db: Session, user_id: str, query: str | None = None) -> list[TagRead]:
    normalized_query = normalize_tag_name(query or "").lower()
    rows = list(
        db.execute(
            select(
                Tag,
                func.count(func.distinct(CourseTag.course_id)).label("usage_count"),
            )
            .outerjoin(CourseTag, Tag.id == CourseTag.tag_id)
            .outerjoin(
                Course,
                and_(
                    Course.id == CourseTag.course_id,
                    Course.is_deleted.is_(False),
                ),
            )
            .where(Tag.user_id == user_id)
            .group_by(Tag.id)
            .order_by(Tag.name.asc())
        ).all()
    )

    tags: list[TagRead] = []
    for tag, usage_count in rows:
        if normalized_query and normalized_query not in tag.name.lower():
            continue
        tags.append(
            TagRead(
                id=tag.id,
                name=tag.name,
                color=tag.color,
                usage_count=int(usage_count or 0),
                updated_at=tag.updated_at,
            )
        )
    return tags


def backfill_legacy_tags(db: Session) -> None:
    course_rows = list(
        db.execute(
            select(
                Course.id,
                Course.user_id,
                Course.tags_json,
                Course.series_id,
                Course.is_deleted,
            )
        ).mappings()
    )
    series_rows = {
        row["id"]: row
        for row in db.execute(
            select(
                CourseSeries.id,
                CourseSeries.user_id,
                CourseSeries.tags_json,
                CourseSeries.is_deleted,
            )
        ).mappings()
    }

    for course_row in course_rows:
        if course_row["is_deleted"]:
            continue
        direct_tag_names = decode_tag_names(course_row["tags_json"])
        series_row = series_rows.get(course_row["series_id"])
        series_tag_names = decode_tag_names(series_row["tags_json"]) if series_row and not series_row["is_deleted"] else []

        direct_tags = resolve_or_create_tags_by_names(db, course_row["user_id"], direct_tag_names)
        series_tags = resolve_or_create_tags_by_names(db, course_row["user_id"], series_tag_names)
        materialized: list[Tag] = []
        seen_ids: set[str] = set()
        for tag in direct_tags + series_tags:
            if tag.id in seen_ids:
                continue
            seen_ids.add(tag.id)
            materialized.append(tag)

        db.query(CourseTag).filter(CourseTag.course_id == course_row["id"]).delete(synchronize_session=False)
        for tag in materialized:
            db.add(CourseTag(course_id=course_row["id"], tag_id=tag.id))

    db.flush()
    db.commit()


def _replace_legacy_tag_name(db: Session, user_id: str, old_name: str, new_name: str) -> None:
    course_rows = list(
        db.execute(
            select(Course.id, Course.tags_json).where(Course.user_id == user_id, Course.is_deleted.is_(False))
        ).mappings()
    )
    for row in course_rows:
        direct_names = decode_tag_names(row["tags_json"])
        updated = [new_name if name == old_name else name for name in direct_names]
        if updated != direct_names:
            db.execute(
                text("UPDATE courses SET tags_json = :tags_json WHERE id = :course_id"),
                {"tags_json": encode_tag_names(updated), "course_id": row["id"]},
            )
    series_rows = list(
        db.execute(
            select(CourseSeries.id, CourseSeries.tags_json).where(
                CourseSeries.user_id == user_id,
                CourseSeries.is_deleted.is_(False),
            )
        ).mappings()
    )
    for row in series_rows:
        legacy_names = decode_tag_names(row["tags_json"])
        updated = [new_name if name == old_name else name for name in legacy_names]
        if updated != legacy_names:
            db.execute(
                text("UPDATE course_series SET tags_json = :tags_json WHERE id = :series_id"),
                {"tags_json": encode_tag_names(updated), "series_id": row["id"]},
            )


def _remove_legacy_tag_name(db: Session, user_id: str, tag_name: str) -> None:
    course_rows = list(
        db.execute(
            select(Course.id, Course.tags_json).where(Course.user_id == user_id, Course.is_deleted.is_(False))
        ).mappings()
    )
    for row in course_rows:
        direct_names = decode_tag_names(row["tags_json"])
        updated = [name for name in direct_names if name != tag_name]
        if updated != direct_names:
            db.execute(
                text("UPDATE courses SET tags_json = :tags_json WHERE id = :course_id"),
                {"tags_json": encode_tag_names(updated), "course_id": row["id"]},
            )
    series_rows = list(
        db.execute(
            select(CourseSeries.id, CourseSeries.tags_json).where(
                CourseSeries.user_id == user_id,
                CourseSeries.is_deleted.is_(False),
            )
        ).mappings()
    )
    for row in series_rows:
        legacy_names = decode_tag_names(row["tags_json"])
        updated = [name for name in legacy_names if name != tag_name]
        if updated != legacy_names:
            db.execute(
                text("UPDATE course_series SET tags_json = :tags_json WHERE id = :series_id"),
                {"tags_json": encode_tag_names(updated), "series_id": row["id"]},
            )
