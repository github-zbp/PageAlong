from __future__ import annotations

from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.course import ArticleImageAsset, ArticleText, AudioAsset, Course
from app.models.file_resource import FileResource, ResourceStatus, ResourceVariant
from app.models.user import User


def list_admin_courses(db: Session, *, query: str = "", email: str = "") -> list[Course]:
    statement = (
        select(Course)
        .options(selectinload(Course.article_texts))
        .where(Course.is_deleted.is_(False))
        .order_by(Course.created_at.desc(), Course.id.desc())
    )
    if query.strip():
        statement = statement.where(func.lower(Course.title).contains(query.strip().lower()))
    if email.strip():
        matching_user_ids = select(User.id).where(func.lower(User.email).contains(email.strip().lower()))
        statement = statement.where(Course.user_id.in_(matching_user_ids))
    return list(db.scalars(statement).all())


def get_admin_course_or_raise(db: Session, course_id: str) -> Course:
    course = db.scalar(
        select(Course)
        .options(selectinload(Course.article_texts))
        .where(Course.id == course_id, Course.is_deleted.is_(False))
    )
    if course is None:
        raise ValueError("Course not found")
    return course


def latest_course_markdown(course: Course) -> str | None:
    if not course.article_texts:
        return None
    latest = sorted(course.article_texts, key=lambda item: (item.version, item.created_at, item.id), reverse=True)[0]
    return latest.content_markdown


def resource_counts_for_course(db: Session, course: Course) -> dict[str, int]:
    counts = Counter({"image": 0, "audio": 0, "pdf": 0, "docx": 0, "markdown": 0})
    image_count = db.scalar(
        select(func.count()).select_from(ArticleImageAsset).where(ArticleImageAsset.course_id == course.id)
    )
    audio_count = db.scalar(select(func.count()).select_from(AudioAsset).where(AudioAsset.course_id == course.id))
    counts["image"] = int(image_count or 0)
    counts["audio"] = int(audio_count or 0)

    rows = db.execute(
        select(FileResource.resource_variant, func.count(FileResource.id))
        .where(
            FileResource.owner_type == "course",
            FileResource.owner_id == course.id,
            FileResource.status == ResourceStatus.READY,
        )
        .group_by(FileResource.resource_variant)
    ).all()
    for variant, total in rows:
        if variant == ResourceVariant.PDF:
            counts["pdf"] += int(total)
        elif variant == ResourceVariant.DOCX:
            counts["docx"] += int(total)
        elif variant == ResourceVariant.MARKDOWN:
            counts["markdown"] += int(total)
        elif variant == ResourceVariant.AUDIO:
            counts["audio"] += int(total)
    return dict(counts)


def user_email_for_course(db: Session, course: Course) -> str:
    user = db.get(User, course.user_id)
    return user.email if user is not None else ""


def soft_delete_admin_course(db: Session, course: Course) -> None:
    course.is_deleted = True
    db.commit()
