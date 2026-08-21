from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TTSSegment(Base):
    __tablename__ = "tts_segments"
    __table_args__ = (
        UniqueConstraint("job_id", "provider", "segment_index", "text_hash", name="uq_tts_segment_job_provider_text"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str] = mapped_column(ForeignKey("generation_jobs.id"), index=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    article_text_id: Mapped[str] = mapped_column(ForeignKey("article_texts.id"), index=True)
    section_id: Mapped[str | None] = mapped_column(ForeignKey("course_sections.id"), nullable=True, index=True)
    segment_index: Mapped[int] = mapped_column(Integer)
    sentence_start_index: Mapped[int] = mapped_column(Integer)
    sentence_end_index: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text, default="")
    text_hash: Mapped[str] = mapped_column(String(128))
    provider: Mapped[str] = mapped_column(String(64), index=True)
    model_id: Mapped[str] = mapped_column(String(128), default="")
    voice_id: Mapped[str] = mapped_column(String(128), default="")
    speed_factor: Mapped[float] = mapped_column(Float, default=1.0)
    provider_speed: Mapped[str | None] = mapped_column(String(32), nullable=True)
    response_format: Mapped[str] = mapped_column(String(16), default="mp3")
    status: Mapped[str] = mapped_column(String(64), default="pending")
    provider_attempt: Mapped[int] = mapped_column(Integer, default=1)
    idempotency_key: Mapped[str] = mapped_column(String(255), unique=True)
    object_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0)
    character_count: Mapped[int] = mapped_column(Integer, default=0)
    timing_json: Mapped[str] = mapped_column(Text, default="[]")
    byte_size: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    committed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.text is None:
            self.text = ""
        if self.model_id is None:
            self.model_id = ""
        if self.voice_id is None:
            self.voice_id = ""
        if self.speed_factor is None:
            self.speed_factor = 1.0
        if self.response_format is None:
            self.response_format = "mp3"
        if self.status is None:
            self.status = "pending"
        if self.provider_attempt is None:
            self.provider_attempt = 1
        if self.duration_seconds is None:
            self.duration_seconds = 0
        if self.character_count is None:
            self.character_count = 0
        if self.timing_json is None:
            self.timing_json = "[]"
        if self.byte_size is None:
            self.byte_size = 0


class TTSUsageEvent(Base):
    __tablename__ = "tts_usage_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    idempotency_key: Mapped[str] = mapped_column(String(255), unique=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("generation_jobs.id"), index=True)
    segment_id: Mapped[str | None] = mapped_column(ForeignKey("tts_segments.id"), nullable=True, index=True)
    tier: Mapped[str] = mapped_column(String(32), index=True)
    provider: Mapped[str] = mapped_column(String(64), index=True)
    model_id: Mapped[str] = mapped_column(String(128), default="")
    voice_id: Mapped[str] = mapped_column(String(128), default="")
    billable_characters: Mapped[int] = mapped_column(Integer, default=0)
    input_bytes: Mapped[int] = mapped_column(Integer, default=0)
    audio_seconds: Mapped[float] = mapped_column(Float, default=0)
    estimated_cost_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(16), default="USD")
    status: Mapped[str] = mapped_column(String(64), default="reserved")
    provider_attempt: Mapped[int] = mapped_column(Integer, default=1)
    reserved_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    committed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.model_id is None:
            self.model_id = ""
        if self.voice_id is None:
            self.voice_id = ""
        if self.billable_characters is None:
            self.billable_characters = 0
        if self.input_bytes is None:
            self.input_bytes = 0
        if self.audio_seconds is None:
            self.audio_seconds = 0
        if self.estimated_cost_cents is None:
            self.estimated_cost_cents = 0
        if self.currency is None:
            self.currency = "USD"
        if self.status is None:
            self.status = "reserved"
        if self.provider_attempt is None:
            self.provider_attempt = 1


class TTSQuotaPeriod(Base):
    __tablename__ = "tts_quota_periods"
    __table_args__ = (UniqueConstraint("user_id", "tier", "period_start", "period_end", name="uq_tts_quota_period"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    tier: Mapped[str] = mapped_column(String(32), index=True)
    period_start: Mapped[datetime] = mapped_column(DateTime)
    period_end: Mapped[datetime] = mapped_column(DateTime)
    courses_generated: Mapped[int] = mapped_column(Integer, default=0)
    characters_reserved: Mapped[int] = mapped_column(Integer, default=0)
    characters_committed: Mapped[int] = mapped_column(Integer, default=0)
    audio_seconds_committed: Mapped[float] = mapped_column(Float, default=0)
    estimated_cost_cents: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.courses_generated is None:
            self.courses_generated = 0
        if self.characters_reserved is None:
            self.characters_reserved = 0
        if self.characters_committed is None:
            self.characters_committed = 0
        if self.audio_seconds_committed is None:
            self.audio_seconds_committed = 0
        if self.estimated_cost_cents is None:
            self.estimated_cost_cents = 0
