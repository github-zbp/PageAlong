from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    DISABLED = "disabled"


class AuthEventType(str, enum.Enum):
    VERIFICATION_CODE_SENT = "verification_code_sent"
    REGISTERED = "registered"
    LOGIN_SUCCEEDED = "login_succeeded"
    LOGIN_FAILED = "login_failed"
    LOGGED_OUT = "logged_out"
    PASSWORD_CHANGED = "password_changed"
    PASSWORD_RESET = "password_reset"
    ADMIN_USER_UPDATED = "admin_user_updated"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.USER)
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus), default=UserStatus.ACTIVE)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    must_change_password_at_next_login: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sessions: Mapped[list[AuthSession]] = relationship(back_populates="user")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.role is None:
            self.role = UserRole.USER
        if self.status is None:
            self.status = UserStatus.ACTIVE
        if self.must_change_password_at_next_login is None:
            self.must_change_password_at_next_login = False


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    user_agent: Mapped[str] = mapped_column(String(512), default="")
    ip_address: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="sessions")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.user_agent is None:
            self.user_agent = ""
        if self.ip_address is None:
            self.ip_address = ""


class AuthEvent(Base):
    __tablename__ = "auth_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    event_type: Mapped[AuthEventType] = mapped_column(Enum(AuthEventType), index=True)
    email: Mapped[str] = mapped_column(String(320), default="", index=True)
    ip_address: Mapped[str] = mapped_column(String(128), default="")
    user_agent: Mapped[str] = mapped_column(String(512), default="")
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.email is None:
            self.email = ""
        if self.ip_address is None:
            self.ip_address = ""
        if self.user_agent is None:
            self.user_agent = ""
        if self.metadata_json is None:
            self.metadata_json = "{}"
