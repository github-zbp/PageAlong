from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.admin_content import Announcement, AnnouncementRoadmapStatus, AnnouncementStatus
from app.services.admin_content_service import render_markdown_to_safe_html


def list_announcements(db: Session, *, query: str = "", status: str = "", language: str = "") -> list[Announcement]:
    statement = select(Announcement).where(Announcement.status != AnnouncementStatus.DELETED)
    if query.strip():
        statement = statement.where(func.lower(Announcement.title).contains(query.strip().lower()))
    if status:
        statement = statement.where(Announcement.status == AnnouncementStatus(status))
    if language:
        statement = statement.where(Announcement.language == language)
    return list(
        db.scalars(
            statement.order_by(
                Announcement.is_pinned.desc(),
                Announcement.sort_order.asc(),
                Announcement.updated_at.desc(),
            )
        ).all()
    )


def list_public_dashboard_announcements(db: Session, *, language: str) -> list[Announcement]:
    return list(
        db.scalars(
            select(Announcement)
            .where(
                Announcement.status == AnnouncementStatus.PUBLISHED,
                Announcement.language == language,
                Announcement.display_position == "dashboard",
                Announcement.deleted_at.is_(None),
            )
            .order_by(
                Announcement.is_pinned.desc(),
                Announcement.sort_order.asc(),
                Announcement.published_at.desc().nullslast(),
                Announcement.created_at.desc(),
            )
        )
    )


def get_announcement_or_raise(db: Session, announcement_id: str) -> Announcement:
    announcement = db.get(Announcement, announcement_id)
    if announcement is None or announcement.status == AnnouncementStatus.DELETED:
        raise ValueError("Announcement not found")
    return announcement


def create_announcement(db: Session, *, payload) -> Announcement:
    announcement = Announcement(
        title=payload.title.strip(),
        language=payload.language,
        body_markdown=payload.body_markdown,
        body_html=render_markdown_to_safe_html(payload.body_markdown),
        roadmap_status=AnnouncementRoadmapStatus(payload.roadmap_status),
        display_position=payload.display_position,
        sort_order=payload.sort_order,
        is_pinned=payload.is_pinned,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return announcement


def update_announcement(db: Session, announcement: Announcement, payload) -> Announcement:
    if payload.title is not None:
        announcement.title = payload.title.strip()
    if payload.language is not None:
        announcement.language = payload.language
    if payload.body_markdown is not None:
        announcement.body_markdown = payload.body_markdown
        announcement.body_html = render_markdown_to_safe_html(payload.body_markdown)
    if payload.roadmap_status is not None:
        announcement.roadmap_status = AnnouncementRoadmapStatus(payload.roadmap_status)
    if payload.display_position is not None:
        announcement.display_position = payload.display_position
    if payload.sort_order is not None:
        announcement.sort_order = payload.sort_order
    if payload.is_pinned is not None:
        announcement.is_pinned = payload.is_pinned
    db.commit()
    db.refresh(announcement)
    return announcement


def set_announcement_status(db: Session, announcement: Announcement, status: AnnouncementStatus) -> Announcement:
    announcement.status = status
    if status == AnnouncementStatus.PUBLISHED and announcement.published_at is None:
        announcement.published_at = datetime.utcnow()
    if status == AnnouncementStatus.DELETED:
        announcement.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(announcement)
    return announcement


def reorder_announcements(db: Session, *, items) -> None:
    for item in items:
        announcement = get_announcement_or_raise(db, item.id)
        announcement.sort_order = item.sort_order
    db.commit()
