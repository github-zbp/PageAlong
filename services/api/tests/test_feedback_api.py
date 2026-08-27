from datetime import datetime

from app.api.deps import get_current_user
from app.main import app
from app.models.user import User, UserRole, UserStatus


def make_user() -> User:
    return User(
        id="feedback-user",
        email="reader@example.com",
        password_hash="password-hash",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )


def test_feedback_route_requires_auth(client):
    response = client.post(
        "/feedback",
        json={
            "category": "suggestion",
            "summary": "Add a roadmap",
            "message": "Show upcoming features on the dashboard.",
            "page_path": "/zh/dashboard",
        },
    )

    assert response.status_code == 401


def test_feedback_route_sends_mail_to_admin(client, monkeypatch):
    from app.api.routes import feedback
    from app.services.email_delivery import RecordingEmailSender
    from app.services.feedback_service import FeedbackService

    user = make_user()
    sender = RecordingEmailSender()
    service = FeedbackService(email_sender=sender)
    monkeypatch.setattr(feedback, "get_feedback_service", lambda: service)
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = client.post(
            "/feedback",
            json={
                "category": "bug",
                "summary": "Sidebar button overlaps",
                "message": "The feedback button should sit on the border edge.",
                "page_path": "/zh/dashboard",
            },
            headers={"user-agent": "pytest"},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 204
    assert sender.feedback_messages[0].to_email == "juhuatang@outlook.com"
    assert sender.feedback_messages[0].reply_to_email == "reader@example.com"
    assert sender.feedback_messages[0].category == "bug"
    assert "PageAlong feedback - Bug" in sender.feedback_messages[0].subject
    assert "/zh/dashboard" in sender.feedback_messages[0].body
    assert "Sidebar button overlaps" in sender.feedback_messages[0].body


def test_feedback_route_returns_503_when_delivery_fails(client, monkeypatch):
    from app.api.routes import feedback
    from app.services.email_delivery import EmailDeliveryError
    from app.services.feedback_service import FeedbackService

    class FailingEmailSender:
        def send_feedback(self, **kwargs) -> None:
            raise EmailDeliveryError("provider rejected message")

    user = make_user()
    service = FeedbackService(email_sender=FailingEmailSender())
    monkeypatch.setattr(feedback, "get_feedback_service", lambda: service)
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = client.post(
            "/feedback",
            json={
                "category": "feature",
                "summary": "Add OCR",
                "message": "We need OCR for image-based notes.",
                "page_path": "/zh/dashboard",
            },
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 503
    assert response.json() == {"detail": "Feedback delivery is temporarily unavailable"}
