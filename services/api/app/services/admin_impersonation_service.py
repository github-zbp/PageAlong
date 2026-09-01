from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.admin_content import AdminImpersonationToken
from app.models.user import User, UserRole, UserStatus
from app.services.auth_security import generate_session_token, hash_token


class ImpersonationError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


@dataclass
class ImpersonationResult:
    token: str
    target_user: User
    expires_at: datetime


class AdminImpersonationService:
    token_ttl = timedelta(minutes=30)

    def create_token(self, db: Session, *, admin: User, target_user_id: str) -> ImpersonationResult:
        if admin.role != UserRole.ADMIN:
            raise ImpersonationError("Admin access required", status_code=403)
        target_user = db.get(User, target_user_id)
        if target_user is None:
            raise ImpersonationError("User not found", status_code=404)
        if target_user.status == UserStatus.DISABLED:
            raise ImpersonationError("Cannot impersonate disabled user", status_code=400)

        token = generate_session_token()
        expires_at = datetime.utcnow() + self.token_ttl
        db.add(
            AdminImpersonationToken(
                token_hash=hash_token(token),
                admin_user_id=admin.id,
                target_user_id=target_user.id,
                expires_at=expires_at,
            )
        )
        db.commit()
        return ImpersonationResult(token=token, target_user=target_user, expires_at=expires_at)

    def authenticate_token(self, db: Session, token: str) -> tuple[User, AdminImpersonationToken] | None:
        stored_token = db.scalar(
            select(AdminImpersonationToken).where(
                AdminImpersonationToken.token_hash == hash_token(token),
                AdminImpersonationToken.revoked_at.is_(None),
                AdminImpersonationToken.expires_at > datetime.utcnow(),
            )
        )
        if stored_token is None:
            return None

        target_user = db.get(User, stored_token.target_user_id)
        if target_user is None or target_user.status == UserStatus.DISABLED:
            return None

        stored_token.last_used_at = datetime.utcnow()
        db.commit()
        return target_user, stored_token
