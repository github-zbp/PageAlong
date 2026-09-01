from __future__ import annotations

import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base

ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def test_auth_security_hashes_password_and_normalizes_email():
    from app.services.auth_security import hash_password, normalize_email, verify_password

    password_hash = hash_password("1q2w3e4R")

    assert normalize_email("  User@Example.COM ") == "user@example.com"
    assert password_hash != "1q2w3e4R"
    assert verify_password("1q2w3e4R", password_hash)
    assert not verify_password("wrong-password", password_hash)


def test_verification_code_logs_plain_code_and_enforces_cooldown(db_session, caplog):
    from app.services.auth_service import AuthService, InMemoryVerificationCodeStore, VerificationCodeCooldown
    from app.services.email_delivery import RecordingEmailSender

    sender = RecordingEmailSender()
    service = AuthService(code_store=InMemoryVerificationCodeStore(), email_sender=sender)

    with caplog.at_level(logging.INFO, logger="app.auth"):
        service.request_email_code(db_session, email="User@Example.COM", purpose="register")

    assert sender.messages[0].to_email == "user@example.com"
    assert sender.messages[0].code in caplog.text
    assert "purpose=register" in caplog.text

    with pytest.raises(VerificationCodeCooldown) as exc_info:
        service.request_email_code(db_session, email="user@example.com", purpose="register")
    assert exc_info.value.retry_after_seconds > 0


def test_verification_code_delivery_failure_clears_cooldown(db_session):
    from app.services.auth_service import AuthService, EmailCodeDeliveryFailed, InMemoryVerificationCodeStore
    from app.services.email_delivery import EmailDeliveryError, RecordingEmailSender

    class FailingOnceEmailSender:
        def __init__(self):
            self.calls = 0
            self.recorder = RecordingEmailSender()

        @property
        def messages(self):
            return self.recorder.messages

        def send_verification_code(self, *, to_email: str, purpose: str, code: str) -> None:
            self.calls += 1
            if self.calls == 1:
                raise EmailDeliveryError("provider rejected message")
            self.recorder.send_verification_code(to_email=to_email, purpose=purpose, code=code)

    sender = FailingOnceEmailSender()
    service = AuthService(code_store=InMemoryVerificationCodeStore(), email_sender=sender)

    with pytest.raises(EmailCodeDeliveryFailed):
        service.request_email_code(db_session, email="reader@example.com", purpose="register")

    service.request_email_code(db_session, email="reader@example.com", purpose="register")

    assert sender.calls == 2
    assert sender.messages[-1].to_email == "reader@example.com"


def test_auth_capabilities_hide_provider_buttons_when_disabled(client, monkeypatch):
    from app.api.routes import auth

    monkeypatch.setattr(auth.settings, "auth_wechat_enabled", False)
    monkeypatch.setattr(auth.settings, "auth_one_tap_enabled", False)

    response = client.get("/auth/capabilities")

    assert response.status_code == 200
    assert response.json() == {
        "email_password": True,
        "email_code": True,
        "wechat": False,
        "one_tap": False,
    }


def test_email_code_route_returns_service_unavailable_on_delivery_failure(client, monkeypatch):
    from app.api.routes import auth
    from app.services.auth_service import AuthService, InMemoryVerificationCodeStore
    from app.services.email_delivery import EmailDeliveryError

    class FailingEmailSender:
        def send_verification_code(self, *, to_email: str, purpose: str, code: str) -> None:
            raise EmailDeliveryError("provider rejected message")

    service = AuthService(code_store=InMemoryVerificationCodeStore(), email_sender=FailingEmailSender())
    monkeypatch.setattr(auth, "get_auth_service", lambda: service)

    response = client.post(
        "/auth/email/code",
        json={"email": "reader@example.com", "purpose": "register"},
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Email delivery is temporarily unavailable"}


def test_email_code_login_issues_a_session_for_existing_user(client, db_session, monkeypatch):
    from app.api.routes import auth
    from app.models.user import User, UserRole, UserStatus
    from app.services.auth_security import hash_password
    from app.services.auth_service import AuthService, InMemoryVerificationCodeStore
    from app.services.email_delivery import RecordingEmailSender

    user = User(
        email="reader@example.com",
        password_hash=hash_password("abc12345"),
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    sender = RecordingEmailSender()
    service = AuthService(code_store=InMemoryVerificationCodeStore(), email_sender=sender)
    monkeypatch.setattr(auth, "get_auth_service", lambda: service)

    client.post("/auth/email/code", json={"email": "reader@example.com", "purpose": "login"})
    code = sender.messages[-1].code
    response = client.post("/auth/email/login", json={"email": "reader@example.com", "code": code})

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "reader@example.com"


def test_provider_exchange_routes_return_auth_response(client, db_session, monkeypatch):
    from app.api.routes import auth
    from app.models.user import User, UserRole, UserStatus
    from app.services.auth_security import hash_password
    from app.services.auth_service import AuthService

    user = User(
        email="wechat-reader@example.com",
        password_hash=hash_password("abc12345"),
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    fake_auth_result = SimpleNamespace(token="wechat-token", user=user)
    service = AuthService()
    monkeypatch.setattr(auth, "get_auth_service", lambda: service)
    monkeypatch.setattr(service, "exchange_wechat_identity", lambda *args, **kwargs: fake_auth_result)

    response = client.post("/auth/wechat/exchange", json={"code": "wechat-code", "state": "abc"})

    assert response.status_code == 200
    assert response.json()["token"] == "wechat-token"


def test_register_consumes_code_and_login_returns_bearer_token(db_session):
    from app.models.user import User
    from app.services.auth_service import AuthService, InMemoryVerificationCodeStore
    from app.services.email_delivery import RecordingEmailSender

    sender = RecordingEmailSender()
    service = AuthService(code_store=InMemoryVerificationCodeStore(), email_sender=sender)
    service.request_email_code(db_session, email="reader@example.com", purpose="register")
    code = sender.messages[-1].code

    registered = service.register(
        db_session,
        email="reader@example.com",
        password="abc12345",
        code=code,
        user_agent="pytest",
        ip_address="127.0.0.1",
    )

    user = db_session.query(User).filter(User.email == "reader@example.com").one()
    assert registered.user.id == user.id
    assert registered.token
    assert user.email_verified_at is not None

    login = service.login(
        db_session,
        email="reader@example.com",
        password="abc12345",
        user_agent="pytest",
        ip_address="127.0.0.1",
    )
    assert login.user.id == user.id
    assert login.token != registered.token

    with pytest.raises(Exception):
        service.register(
            db_session,
            email="another@example.com",
            password="abc12345",
            code=code,
            user_agent="pytest",
            ip_address="127.0.0.1",
        )


def test_auth_routes_register_login_me_and_logout(client, db_session, monkeypatch):
    from app.api.routes import auth
    from app.services.auth_service import AuthService, InMemoryVerificationCodeStore
    from app.services.email_delivery import RecordingEmailSender

    sender = RecordingEmailSender()
    service = AuthService(code_store=InMemoryVerificationCodeStore(), email_sender=sender)
    monkeypatch.setattr(auth, "get_auth_service", lambda: service)

    code_response = client.post(
        "/auth/email/code",
        json={"email": "reader@example.com", "purpose": "register"},
    )
    assert code_response.status_code == 204
    code = sender.messages[-1].code

    register_response = client.post(
        "/auth/register",
        json={"email": "reader@example.com", "password": "abc12345", "code": code},
    )
    assert register_response.status_code == 201
    token = register_response.json()["token"]

    me_response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "reader@example.com"

    logout_response = client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_response.status_code == 204

    after_logout_response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert after_logout_response.status_code == 401


def test_auth_routes_manage_theme_preferences(client, db_session, monkeypatch):
    from app.api.routes import auth
    from app.models.user import UserPreference
    from app.services.auth_service import AuthService, InMemoryVerificationCodeStore
    from app.services.email_delivery import RecordingEmailSender

    sender = RecordingEmailSender()
    service = AuthService(code_store=InMemoryVerificationCodeStore(), email_sender=sender)
    monkeypatch.setattr(auth, "get_auth_service", lambda: service)

    code_response = client.post(
        "/auth/email/code",
        json={"email": "theme-reader@example.com", "purpose": "register"},
    )
    assert code_response.status_code == 204
    code = sender.messages[-1].code

    register_response = client.post(
        "/auth/register",
        json={"email": "theme-reader@example.com", "password": "abc12345", "code": code},
    )
    assert register_response.status_code == 201
    token = register_response.json()["token"]
    user_id = register_response.json()["user"]["id"]

    current_response = client.get("/auth/me/preferences", headers={"Authorization": f"Bearer {token}"})
    assert current_response.status_code == 200
    assert current_response.json() == {"theme_id": "newspaper", "background_color": "white"}

    update_response = client.put(
        "/auth/me/preferences",
        headers={"Authorization": f"Bearer {token}"},
        json={"theme_id": "mist", "background_color": "white"},
    )
    assert update_response.status_code == 200
    assert update_response.json() == {"theme_id": "mist", "background_color": "white"}

    repeat_response = client.get("/auth/me/preferences", headers={"Authorization": f"Bearer {token}"})
    assert repeat_response.status_code == 200
    assert repeat_response.json() == {"theme_id": "mist", "background_color": "white"}

    db_session.expire_all()
    stored_preferences = db_session.query(UserPreference).filter(UserPreference.user_id == user_id).one()
    assert stored_preferences.theme_id == "mist"
    assert stored_preferences.background_color == "white"


def test_auth_routes_set_session_cookie_on_login_and_use_it_for_me(client, db_session, monkeypatch):
    from app.api.routes import auth
    from app.models.user import User, UserRole, UserStatus
    from app.services.auth_security import hash_password
    from app.services.auth_service import AuthService, InMemoryVerificationCodeStore
    from app.services.email_delivery import RecordingEmailSender

    user = User(
        email="cookie-reader@example.com",
        password_hash=hash_password("abc12345"),
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    service = AuthService(code_store=InMemoryVerificationCodeStore(), email_sender=RecordingEmailSender())
    monkeypatch.setattr(auth, "get_auth_service", lambda: service)

    login_response = client.post(
        "/auth/login",
        json={"email": "cookie-reader@example.com", "password": "abc12345"},
    )

    assert login_response.status_code == 200
    assert login_response.cookies.get("pagealong_session") is not None

    me_response = client.get("/auth/me")

    assert me_response.status_code == 200
    assert me_response.json()["email"] == "cookie-reader@example.com"


def test_logout_clears_session_cookie(client, db_session, monkeypatch):
    from app.api.routes import auth
    from app.models.user import User, UserRole, UserStatus
    from app.services.auth_security import hash_password
    from app.services.auth_service import AuthService, InMemoryVerificationCodeStore
    from app.services.email_delivery import RecordingEmailSender

    user = User(
        email="logout-cookie@example.com",
        password_hash=hash_password("abc12345"),
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    service = AuthService(code_store=InMemoryVerificationCodeStore(), email_sender=RecordingEmailSender())
    monkeypatch.setattr(auth, "get_auth_service", lambda: service)

    login_response = client.post(
        "/auth/login",
        json={"email": "logout-cookie@example.com", "password": "abc12345"},
    )
    assert login_response.status_code == 200

    logout_response = client.post("/auth/logout")

    assert logout_response.status_code == 204
    assert "pagealong_session" in logout_response.headers.get("set-cookie", "")
    assert "Max-Age=0" in logout_response.headers.get("set-cookie", "")


def test_seed_initial_admin_creates_account_once(monkeypatch):
    import app.models  # noqa: F401
    from app.models.user import User, UserRole
    from scripts.init_database import seed_initial_admin

    engine = create_engine("sqlite://")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)

    monkeypatch.setenv("ADMIN_BOOTSTRAP_EMAIL", "Admin@Example.COM")
    monkeypatch.setenv("ADMIN_BOOTSTRAP_PASSWORD", "1q2w3e4R")

    with SessionLocal() as session:
        seed_initial_admin(session)
        first = session.query(User).filter(User.email == "admin@example.com").one()
        first_hash = first.password_hash

    monkeypatch.setenv("ADMIN_BOOTSTRAP_PASSWORD", "changed-password")
    with SessionLocal() as session:
        seed_initial_admin(session)
        users = session.query(User).filter(User.email == "admin@example.com").all()
        assert len(users) == 1
        assert users[0].password_hash == first_hash
        assert users[0].role == UserRole.ADMIN
        assert users[0].must_change_password_at_next_login is True


def test_seed_initial_admin_uses_default_bootstrap_credentials(monkeypatch):
    import app.models  # noqa: F401
    from app.models.user import User, UserRole
    from app.services.auth_security import verify_password
    from scripts.init_database import seed_initial_admin

    engine = create_engine("sqlite://")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)

    monkeypatch.delenv("ADMIN_BOOTSTRAP_EMAIL", raising=False)
    monkeypatch.delenv("ADMIN_BOOTSTRAP_PASSWORD", raising=False)

    with SessionLocal() as session:
        seed_initial_admin(session)
        user = session.query(User).filter(User.email == "wenzhangxiang@yeah.net").one()
        assert user.role == UserRole.ADMIN
        assert user.must_change_password_at_next_login is True
        assert verify_password("1q2w3e4R", user.password_hash)


def test_authenticated_course_requests_use_bearer_user(client, db_session, monkeypatch):
    from app.models.user import User, UserRole, UserStatus
    from app.services.auth_service import AuthService
    from app.services.auth_security import hash_password

    user = User(
        email="course-owner@example.com",
        password_hash=hash_password("abc12345"),
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    issued = AuthService().create_session(
        db_session,
        user=user,
        user_agent="pytest",
        ip_address="127.0.0.1",
        expires_delta=timedelta(minutes=30),
    )
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )

    response = client.post(
        "/courses",
        headers={"Authorization": f"Bearer {issued.token}"},
        json={"title": "私人课程", "source_type": "manual_text", "text": "第一句。"},
    )

    assert response.status_code == 201
    assert response.json()["title"] == "私人课程"
