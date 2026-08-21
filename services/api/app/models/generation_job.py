import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class JobType(str, enum.Enum):
    SENTENCE_SEGMENT = "sentence_segment"
    URL_IMPORT = "url_import"
    TTS_GENERATE = "tts_generate"
    AUDIO_CONCAT = "audio_concat"


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    job_type: Mapped[JobType] = mapped_column(Enum(JobType))
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    fallback_provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tier: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    voice_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    speed_factor: Mapped[float] = mapped_column(Float, default=1.0)
    input_json: Mapped[str] = mapped_column(Text, default="{}")
    idempotency_key: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    lease_owner: Mapped[str | None] = mapped_column(String(128), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    progress_current: Mapped[int] = mapped_column(Integer, default=0)
    progress_total: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.status is None:
            self.status = JobStatus.PENDING
        if self.attempt_count is None:
            self.attempt_count = 0
        if self.speed_factor is None:
            self.speed_factor = 1.0
        if self.input_json is None:
            self.input_json = "{}"
        if self.progress_current is None:
            self.progress_current = 0
        if self.progress_total is None:
            self.progress_total = 0
