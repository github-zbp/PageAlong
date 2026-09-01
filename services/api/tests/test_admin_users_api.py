from __future__ import annotations

from datetime import datetime

from app.models.user import User, UserRole, UserStatus
from app.services.auth_security import hash_password
from app.services.auth_service import AuthService


def create_user(db_session, *, email: str, role: UserRole = UserRole.USER) -> User:
    user = User(
        email=email,
        password_hash=hash_password("abc12345"),
        role=role,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.flush()
    return user


def issue_token(db_session, user: User) -> str:
    result = AuthService().create_session(db_session, user=user, user_agent="pytest", ip_address="127.0.0.1")
    db_session.commit()
    return result.token


def test_admin_users_are_paginated_and_include_dashboard_activity(client, db_session):
    admin = create_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    reader = create_user(db_session, email="reader@example.com")
    reader.last_dashboard_at = datetime(2026, 8, 26, 10, 0, 0)
    reader.last_dashboard_locale = "zh"
    db_session.commit()
    token = issue_token(db_session, admin)

    response = client.get("/admin/users?query=reader&page=1&page_size=10", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["email"] == "reader@example.com"
    assert body["items"][0]["last_dashboard_at"] == "2026-08-26T10:00:00"
    assert body["items"][0]["last_dashboard_locale"] == "zh"
    assert body["pagination"]["total"] == 1


def test_dashboard_activity_endpoint_updates_user_locale(client, db_session):
    user = create_user(db_session, email="reader@example.com")
    token = issue_token(db_session, user)

    response = client.post("/auth/me/dashboard-activity", json={"locale": "en"}, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 204
    db_session.refresh(user)
    assert user.last_dashboard_at is not None
    assert user.last_dashboard_locale == "en"


def test_admin_can_create_impersonation_token_and_read_as_target_user(client, db_session):
    admin = create_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    reader = create_user(db_session, email="reader@example.com")
    admin_token = issue_token(db_session, admin)

    response = client.post(
        "/admin/impersonation",
        json={"target_user_id": reader.id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 201
    impersonation_token = response.json()["token"]
    me_response = client.get("/auth/me", headers={"Authorization": f"Bearer {impersonation_token}"})
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "reader@example.com"
