from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tts import TTSSegment, TTSUsageEvent


class TTSUsageService:
    def __init__(self, db: Session):
        self.db = db

    def reserve_segment(
        self,
        *,
        idempotency_key: str,
        user_id: str,
        course_id: str,
        job_id: str,
        segment: TTSSegment,
        tier: str,
        billable_characters: int,
        input_bytes: int,
        estimated_cost_cents: int,
        currency: str,
    ) -> TTSUsageEvent:
        existing = self.db.scalar(
            select(TTSUsageEvent).where(TTSUsageEvent.idempotency_key == idempotency_key)
        )
        if existing is not None:
            return existing

        event = TTSUsageEvent(
            idempotency_key=idempotency_key,
            user_id=user_id,
            course_id=course_id,
            job_id=job_id,
            segment_id=segment.id,
            tier=tier,
            provider=segment.provider,
            model_id=segment.model_id,
            voice_id=segment.voice_id,
            billable_characters=billable_characters,
            input_bytes=input_bytes,
            estimated_cost_cents=estimated_cost_cents,
            currency=currency,
            status="reserved",
            provider_attempt=segment.provider_attempt,
        )
        self.db.add(event)
        self.db.flush()
        return event

    def commit_event(self, event: TTSUsageEvent, *, audio_seconds: float) -> None:
        event.status = "committed"
        event.audio_seconds = audio_seconds
        event.committed_at = datetime.utcnow()
        event.released_at = None

    def release_event(self, event: TTSUsageEvent) -> None:
        event.status = "released"
        event.released_at = datetime.utcnow()
