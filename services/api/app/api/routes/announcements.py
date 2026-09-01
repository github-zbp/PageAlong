from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.admin_content import Announcement
from app.schemas.admin import AnnouncementList, AnnouncementListItem
from app.schemas.pagination import PaginationRead
from app.services.admin_announcement_service import list_public_dashboard_announcements

router = APIRouter(prefix="/announcements", tags=["announcements"])


def serialize_public_announcement(announcement: Announcement) -> AnnouncementListItem:
    return AnnouncementListItem(
        id=announcement.id,
        title=announcement.title,
        language=announcement.language,
        status=announcement.status.value,
        roadmap_status=announcement.roadmap_status.value,
        display_position=announcement.display_position,
        sort_order=announcement.sort_order,
        is_pinned=announcement.is_pinned,
        published_at=announcement.published_at,
        created_at=announcement.created_at,
        updated_at=announcement.updated_at,
    )


@router.get("/dashboard", response_model=AnnouncementList)
def list_dashboard_announcements(
    lang: str = Query(default="zh", pattern="^(zh|en)$"),
    db: Session = Depends(get_db),
) -> AnnouncementList:
    announcements = list_public_dashboard_announcements(db, language=lang)
    return AnnouncementList(
        items=[serialize_public_announcement(item) for item in announcements],
        pagination=PaginationRead(
            page=1,
            page_size=len(announcements),
            total=len(announcements),
            total_pages=1,
            has_previous=False,
            has_next=False,
        ),
    )
