from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PlaybackProgress(Base):
    __tablename__ = "playback_progress"

    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), primary_key=True)
    audio_asset_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    position_seconds: Mapped[int] = mapped_column(Integer, default=0)
    sentence_index: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

