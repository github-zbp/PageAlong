from __future__ import annotations

from app.core.config import settings
from app.models.user import User
from app.services.email_delivery import get_default_email_sender


class FeedbackService:
    def __init__(self, email_sender=None):
        self.email_sender = email_sender or get_default_email_sender()

    def submit_feedback(
        self,
        *,
        user: User,
        category: str,
        summary: str,
        message: str,
        page_path: str | None,
        user_agent: str,
        ip_address: str,
    ) -> None:
        self.email_sender.send_feedback(
            to_email=settings.feedback_recipient_email,
            reply_to_email=user.email,
            category=category,
            summary=summary,
            message=message,
            page_path=(page_path or "").strip(),
            user_agent=user_agent,
            ip_address=ip_address,
        )


def get_feedback_service() -> FeedbackService:
    return FeedbackService()
