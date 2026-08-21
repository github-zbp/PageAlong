from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import AuthEvent, AuthEventType, AuthSession, User, UserRole, UserStatus
from app.services.auth_security import (
    generate_session_token,
    generate_verification_code,
    hash_password,
    hash_token,
    hash_verification_code,
    normalize_email,
    validate_email,
    validate_password_strength,
    verify_password,
)
from app.services.email_delivery import EmailDeliveryError, SMTPEmailSender, get_default_email_sender

auth_logger = logging.getLogger("app.auth")


class AuthError(Exception):
    status_code = 400
    detail = "Authentication error"


class EmailAlreadyRegistered(AuthError):
    status_code = 409
    detail = "Email already registered"


class InvalidCredentials(AuthError):
    status_code = 401
    detail = "Invalid email or password"


class AccountDisabled(AuthError):
    status_code = 403
    detail = "Account is disabled"


class VerificationCodeCooldown(AuthError):
    status_code = 429
    detail = "Please wait before requesting another code"

    def __init__(self, retry_after_seconds: int):
        super().__init__(self.detail)
        self.retry_after_seconds = max(1, retry_after_seconds)


class VerificationCodeInvalid(AuthError):
    status_code = 400
    detail = "Invalid verification code"


class VerificationCodeExpired(AuthError):
    status_code = 400
    detail = "Verification code expired"


class WeakPassword(AuthError):
    status_code = 400
    detail = "Password must be at least 8 characters and include letters and numbers"


class EmailCodeDeliveryFailed(AuthError):
    status_code = 503
    detail = "Email delivery is temporarily unavailable"


class AdminGuardError(AuthError):
    status_code = 400
    detail = "Admin guard blocked this action"


@dataclass
class CodeRecord:
    code_hash: str
    expires_at: datetime
    attempts: int
    max_attempts: int


@dataclass
class AuthResult:
    user: User
    token: str
    session: AuthSession


class InMemoryVerificationCodeStore:
    def __init__(self):
        self._codes: dict[tuple[str, str], CodeRecord] = {}
        self._cooldowns: dict[tuple[str, str], datetime] = {}

    def set_code(
        self,
        *,
        purpose: str,
        email: str,
        code_hash: str,
        ttl_seconds: int,
        cooldown_seconds: int,
        max_attempts: int,
        now: datetime | None = None,
    ) -> None:
        current_time = now or datetime.utcnow()
        key = (purpose, normalize_email(email))
        cooldown_expires_at = self._cooldowns.get(key)
        if cooldown_expires_at and cooldown_expires_at > current_time:
            retry_after = int((cooldown_expires_at - current_time).total_seconds())
            raise VerificationCodeCooldown(retry_after)
        self._codes[key] = CodeRecord(
            code_hash=code_hash,
            expires_at=current_time + timedelta(seconds=ttl_seconds),
            attempts=0,
            max_attempts=max_attempts,
        )
        self._cooldowns[key] = current_time + timedelta(seconds=cooldown_seconds)

    def clear_code(self, *, purpose: str, email: str) -> None:
        key = (purpose, normalize_email(email))
        self._codes.pop(key, None)
        self._cooldowns.pop(key, None)

    def verify_code(
        self,
        *,
        purpose: str,
        email: str,
        code_hash: str,
        now: datetime | None = None,
    ) -> None:
        current_time = now or datetime.utcnow()
        key = (purpose, normalize_email(email))
        record = self._codes.get(key)
        if record is None:
            raise VerificationCodeInvalid()
        if record.expires_at <= current_time:
            self._codes.pop(key, None)
            raise VerificationCodeExpired()
        if record.attempts >= record.max_attempts:
            self._codes.pop(key, None)
            raise VerificationCodeInvalid()
        record.attempts += 1
        if record.code_hash != code_hash:
            if record.attempts >= record.max_attempts:
                self._codes.pop(key, None)
            raise VerificationCodeInvalid()
        self._codes.pop(key, None)


_default_code_store = InMemoryVerificationCodeStore()


class AuthService:
    def __init__(
        self,
        *,
        code_store: InMemoryVerificationCodeStore | None = None,
        email_sender: SMTPEmailSender | None = None,
    ):
        self.code_store = code_store or _default_code_store
        self.email_sender = email_sender or get_default_email_sender()

    def request_email_code(self, db: Session, *, email: str, purpose: str) -> None:
        normalized_email = validate_email(email)
        code = generate_verification_code()
        code_hash = self._hash_code(purpose=purpose, email=normalized_email, code=code)
        self.code_store.set_code(
            purpose=purpose,
            email=normalized_email,
            code_hash=code_hash,
            ttl_seconds=settings.auth_code_ttl_seconds,
            cooldown_seconds=settings.auth_code_cooldown_seconds,
            max_attempts=settings.auth_code_max_attempts,
        )
        try:
            self.email_sender.send_verification_code(to_email=normalized_email, purpose=purpose, code=code)
        except EmailDeliveryError as exc:
            self.code_store.clear_code(purpose=purpose, email=normalized_email)
            auth_logger.exception(
                "event=auth.verification_code_delivery_failed email=%s purpose=%s",
                normalized_email,
                purpose,
            )
            raise EmailCodeDeliveryFailed() from exc
        auth_logger.info(
            "event=auth.verification_code_sent email=%s purpose=%s code=%s expires_in_seconds=%s",
            normalized_email,
            purpose,
            code,
            settings.auth_code_ttl_seconds,
        )
        self._record_event(
            db,
            event_type=AuthEventType.VERIFICATION_CODE_SENT,
            email=normalized_email,
        )
        db.commit()

    def register(
        self,
        db: Session,
        *,
        email: str,
        password: str,
        code: str,
        user_agent: str,
        ip_address: str,
    ) -> AuthResult:
        normalized_email = validate_email(email)
        self._validate_password(password)
        if self._get_user_by_email(db, normalized_email) is not None:
            raise EmailAlreadyRegistered()
        self._verify_code(purpose="register", email=normalized_email, code=code)
        user = User(
            email=normalized_email,
            password_hash=hash_password(password),
            role=UserRole.USER,
            status=UserStatus.ACTIVE,
            email_verified_at=datetime.utcnow(),
        )
        db.add(user)
        db.flush()
        result = self.create_session(db, user=user, user_agent=user_agent, ip_address=ip_address)
        self._record_event(
            db,
            event_type=AuthEventType.REGISTERED,
            user_id=user.id,
            email=user.email,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        db.commit()
        db.refresh(user)
        return result

    def login(
        self,
        db: Session,
        *,
        email: str,
        password: str,
        user_agent: str,
        ip_address: str,
    ) -> AuthResult:
        normalized_email = validate_email(email)
        user = self._get_user_by_email(db, normalized_email)
        if user is None or not verify_password(password, user.password_hash):
            self._record_event(
                db,
                event_type=AuthEventType.LOGIN_FAILED,
                email=normalized_email,
                user_agent=user_agent,
                ip_address=ip_address,
            )
            db.commit()
            raise InvalidCredentials()
        if user.status == UserStatus.DISABLED:
            raise AccountDisabled()
        user.last_login_at = datetime.utcnow()
        result = self.create_session(db, user=user, user_agent=user_agent, ip_address=ip_address)
        self._record_event(
            db,
            event_type=AuthEventType.LOGIN_SUCCEEDED,
            user_id=user.id,
            email=user.email,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        db.commit()
        return result

    def create_session(
        self,
        db: Session,
        *,
        user: User,
        user_agent: str,
        ip_address: str,
        expires_delta: timedelta | None = None,
    ) -> AuthResult:
        token = generate_session_token()
        session = AuthSession(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=datetime.utcnow() + (expires_delta or timedelta(seconds=settings.auth_session_ttl_seconds)),
            user_agent=user_agent[:512],
            ip_address=ip_address[:128],
        )
        db.add(session)
        db.flush()
        return AuthResult(user=user, token=token, session=session)

    def authenticate_token(self, db: Session, token: str) -> tuple[User, AuthSession]:
        session = db.scalar(
            select(AuthSession).where(
                AuthSession.token_hash == hash_token(token),
                AuthSession.revoked_at.is_(None),
                AuthSession.expires_at > datetime.utcnow(),
            )
        )
        if session is None:
            raise InvalidCredentials()
        user = db.get(User, session.user_id)
        if user is None:
            raise InvalidCredentials()
        if user.status == UserStatus.DISABLED:
            raise AccountDisabled()
        session.last_seen_at = datetime.utcnow()
        return user, session

    def logout(self, db: Session, session: AuthSession) -> None:
        session.revoked_at = datetime.utcnow()
        self._record_event(
            db,
            event_type=AuthEventType.LOGGED_OUT,
            user_id=session.user_id,
        )
        db.commit()

    def logout_all(self, db: Session, user: User) -> None:
        now = datetime.utcnow()
        sessions = db.scalars(
            select(AuthSession).where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
        ).all()
        for session in sessions:
            session.revoked_at = now
        self._record_event(db, event_type=AuthEventType.LOGGED_OUT, user_id=user.id, email=user.email)
        db.commit()

    def change_password(
        self,
        db: Session,
        *,
        user: User,
        current_password: str,
        new_password: str,
    ) -> None:
        if not verify_password(current_password, user.password_hash):
            raise InvalidCredentials()
        self._validate_password(new_password)
        user.password_hash = hash_password(new_password)
        user.must_change_password_at_next_login = False
        self._record_event(db, event_type=AuthEventType.PASSWORD_CHANGED, user_id=user.id, email=user.email)
        db.commit()

    def request_password_reset_code(self, db: Session, *, email: str) -> None:
        self.request_email_code(db, email=email, purpose="password_reset")

    def reset_password(self, db: Session, *, email: str, code: str, new_password: str) -> None:
        normalized_email = validate_email(email)
        self._validate_password(new_password)
        user = self._get_user_by_email(db, normalized_email)
        if user is None:
            raise VerificationCodeInvalid()
        self._verify_code(purpose="password_reset", email=normalized_email, code=code)
        user.password_hash = hash_password(new_password)
        user.must_change_password_at_next_login = False
        self.logout_all(db, user)
        self._record_event(db, event_type=AuthEventType.PASSWORD_RESET, user_id=user.id, email=user.email)
        db.commit()

    def list_users(
        self,
        db: Session,
        *,
        query: str = "",
        role: str = "",
        status: str = "",
    ) -> list[User]:
        statement = select(User)
        normalized_query = query.strip().lower()
        if normalized_query:
            statement = statement.where(func.lower(User.email).contains(normalized_query))
        if role:
            statement = statement.where(User.role == UserRole(role))
        if status:
            statement = statement.where(User.status == UserStatus(status))
        return list(db.scalars(statement.order_by(User.created_at.desc(), User.email.asc())).all())

    def get_user_or_raise(self, db: Session, user_id: str) -> User:
        user = db.get(User, user_id)
        if user is None:
            raise AuthError("User not found")
        return user

    def disable_user(self, db: Session, *, target_user: User, actor: User) -> User:
        self._ensure_not_last_active_admin(db, target_user)
        target_user.status = UserStatus.DISABLED
        self._record_admin_event(db, actor=actor, target_user=target_user, action="disable")
        db.commit()
        db.refresh(target_user)
        return target_user

    def enable_user(self, db: Session, *, target_user: User, actor: User) -> User:
        target_user.status = UserStatus.ACTIVE
        self._record_admin_event(db, actor=actor, target_user=target_user, action="enable")
        db.commit()
        db.refresh(target_user)
        return target_user

    def promote_user(self, db: Session, *, target_user: User, actor: User) -> User:
        target_user.role = UserRole.ADMIN
        self._record_admin_event(db, actor=actor, target_user=target_user, action="promote")
        db.commit()
        db.refresh(target_user)
        return target_user

    def demote_user(self, db: Session, *, target_user: User, actor: User) -> User:
        self._ensure_not_last_active_admin(db, target_user)
        target_user.role = UserRole.USER
        self._record_admin_event(db, actor=actor, target_user=target_user, action="demote")
        db.commit()
        db.refresh(target_user)
        return target_user

    def force_logout_user(self, db: Session, *, target_user: User, actor: User) -> None:
        now = datetime.utcnow()
        for session in db.scalars(
            select(AuthSession).where(AuthSession.user_id == target_user.id, AuthSession.revoked_at.is_(None))
        ).all():
            session.revoked_at = now
        self._record_admin_event(db, actor=actor, target_user=target_user, action="force_logout")
        db.commit()

    def _verify_code(self, *, purpose: str, email: str, code: str) -> None:
        self.code_store.verify_code(
            purpose=purpose,
            email=email,
            code_hash=self._hash_code(purpose=purpose, email=email, code=code),
        )

    def _hash_code(self, *, purpose: str, email: str, code: str) -> str:
        return hash_verification_code(
            secret=settings.auth_code_hash_secret,
            purpose=purpose,
            email=email,
            code=code,
        )

    def _validate_password(self, password: str) -> None:
        try:
            validate_password_strength(password)
        except ValueError as exc:
            raise WeakPassword() from exc

    def _get_user_by_email(self, db: Session, email: str) -> User | None:
        return db.scalar(select(User).where(func.lower(User.email) == normalize_email(email)))

    def _record_event(
        self,
        db: Session,
        *,
        event_type: AuthEventType,
        user_id: str | None = None,
        email: str = "",
        user_agent: str = "",
        ip_address: str = "",
        metadata_json: str = "{}",
    ) -> None:
        db.add(
            AuthEvent(
                user_id=user_id,
                event_type=event_type,
                email=normalize_email(email) if email else "",
                user_agent=user_agent[:512],
                ip_address=ip_address[:128],
                metadata_json=metadata_json,
            )
        )

    def _ensure_not_last_active_admin(self, db: Session, target_user: User) -> None:
        if target_user.role != UserRole.ADMIN or target_user.status != UserStatus.ACTIVE:
            return
        active_admin_count = db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role == UserRole.ADMIN, User.status == UserStatus.ACTIVE)
        )
        if active_admin_count is not None and active_admin_count <= 1:
            raise AdminGuardError("Cannot modify the last active admin")

    def _record_admin_event(self, db: Session, *, actor: User, target_user: User, action: str) -> None:
        self._record_event(
            db,
            event_type=AuthEventType.ADMIN_USER_UPDATED,
            user_id=actor.id,
            email=target_user.email,
            metadata_json=f'{{"action":"{action}","target_user_id":"{target_user.id}"}}',
        )
