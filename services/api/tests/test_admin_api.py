from __future__ import annotations

from datetime import datetime

from app.models.user import AuthSession, User, UserRole, UserStatus
from app.services.auth_security import hash_password
from app.services.auth_service import AuthService


def create_user(db_session, *, email: str, role: UserRole = UserRole.USER, status: UserStatus = UserStatus.ACTIVE) -> User:
    user = User(
        email=email,
        password_hash=hash_password("abc12345"),
        role=role,
        status=status,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.flush()
    return user


def issue_token(db_session, user: User) -> str:
    result = AuthService().create_session(
        db_session,
        user=user,
        user_agent="pytest",
        ip_address="127.0.0.1",
    )
    db_session.commit()
    return result.token


def test_admin_users_requires_admin_role(client, db_session):
    user = create_user(db_session, email="normal@example.com")
    token = issue_token(db_session, user)

    response = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 403


def test_admin_lists_and_filters_users(client, db_session):
    admin = create_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    create_user(db_session, email="reader@example.com")
    create_user(db_session, email="disabled@example.com", status=UserStatus.DISABLED)
    token = issue_token(db_session, admin)

    response = client.get(
        "/admin/users?query=reader&role=user&status=active",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert [item["email"] for item in response.json()["items"]] == ["reader@example.com"]


def test_admin_can_disable_enable_and_force_logout_user(client, db_session):
    admin = create_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    user = create_user(db_session, email="reader@example.com")
    admin_token = issue_token(db_session, admin)
    user_token = issue_token(db_session, user)

    disable_response = client.post(
        f"/admin/users/{user.id}/disable",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert disable_response.status_code == 200
    assert disable_response.json()["status"] == "disabled"

    me_response = client.get("/auth/me", headers={"Authorization": f"Bearer {user_token}"})
    assert me_response.status_code == 403

    enable_response = client.post(
        f"/admin/users/{user.id}/enable",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert enable_response.status_code == 200
    assert enable_response.json()["status"] == "active"

    force_logout_response = client.post(
        f"/admin/users/{user.id}/force-logout",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert force_logout_response.status_code == 204
    db_session.expire_all()
    session = db_session.query(AuthSession).filter(AuthSession.user_id == user.id).one()
    assert session.revoked_at is not None


def test_admin_cannot_demote_or_disable_last_active_admin(client, db_session):
    admin = create_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    token = issue_token(db_session, admin)

    demote_response = client.post(
        f"/admin/users/{admin.id}/demote",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert demote_response.status_code == 400

    disable_response = client.post(
        f"/admin/users/{admin.id}/disable",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert disable_response.status_code == 400


def test_admin_send_password_reset_returns_service_unavailable_on_delivery_failure(client, db_session, monkeypatch):
    from app.api.routes import admin as admin_routes
    from app.services.auth_service import AuthService, InMemoryVerificationCodeStore
    from app.services.email_delivery import EmailDeliveryError

    class FailingEmailSender:
        def send_verification_code(self, *, to_email: str, purpose: str, code: str) -> None:
            raise EmailDeliveryError("provider rejected message")

    service = AuthService(code_store=InMemoryVerificationCodeStore(), email_sender=FailingEmailSender())
    monkeypatch.setattr(admin_routes, "get_admin_service", lambda: service)
    admin = create_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    user = create_user(db_session, email="reader@example.com")
    token = issue_token(db_session, admin)

    response = client.post(
        f"/admin/users/{user.id}/send-password-reset",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Email delivery is temporarily unavailable"}
