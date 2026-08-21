from __future__ import annotations

import random
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

TAG_COLOR_PALETTE = ["#f97316", "#14b8a6", "#8b5cf6", "#ef4444", "#10b981"]


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_tags_user_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(128), index=True)
    color: Mapped[str] = mapped_column(String(32), default="#f97316")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    courses: Mapped[list["Course"]] = relationship(
        "Course",
        secondary="course_tags",
        back_populates="tags",
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.color is None:
            self.color = random.choice(TAG_COLOR_PALETTE)


class CourseTag(Base):
    __tablename__ = "course_tags"

    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), primary_key=True)
    tag_id: Mapped[str] = mapped_column(ForeignKey("tags.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

