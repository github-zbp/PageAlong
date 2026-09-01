from dataclasses import dataclass

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.admin_content import AdminImpersonationToken
from app.models.user import AuthSession, User, UserRole
from app.services.admin_impersonation_service import AdminImpersonationService
from app.services.auth_service import AccountDisabled, AuthService, InvalidCredentials


@dataclass
class CurrentSession:
    user: User
    session: AuthSession | None
    impersonation_token: AdminImpersonationToken | None = None


def bearer_token_from_authorization(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token.strip()


def get_current_session(
    authorization: str | None = Header(default=None),
    session_cookie: str | None = Cookie(default=None, alias=settings.auth_session_cookie_name),
    db: Session = Depends(get_db),
) -> CurrentSession:
    token = bearer_token_from_authorization(authorization) or (session_cookie or "").strip() or None
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        user, session = AuthService().authenticate_token(db, token)
        return CurrentSession(user=user, session=session)
    except AccountDisabled as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except InvalidCredentials as exc:
        impersonated_session = AdminImpersonationService().authenticate_token(db, token)
        if impersonated_session is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=exc.detail) from exc
        user, impersonation_token = impersonated_session
        return CurrentSession(user=user, session=None, impersonation_token=impersonation_token)


def get_current_user(current_session: CurrentSession = Depends(get_current_session)) -> User:
    return current_session.user


def get_current_admin_user(current_session: CurrentSession = Depends(get_current_session)) -> User:
    if current_session.impersonation_token is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    if current_session.user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_session.user


def get_current_user_id(
    authorization: str | None = Header(default=None),
    session_cookie: str | None = Cookie(default=None, alias=settings.auth_session_cookie_name),
    x_user_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> str:
    token = bearer_token_from_authorization(authorization) or (session_cookie or "").strip() or None
    if token is not None:
        try:
            user, _session = AuthService().authenticate_token(db, token)
        except AccountDisabled as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        except InvalidCredentials as exc:
            impersonated_session = AdminImpersonationService().authenticate_token(db, token)
            if impersonated_session is None:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=exc.detail) from exc
            user, _impersonation_token = impersonated_session
        return user.id
    if settings.auth_dev_bypass:
        return x_user_id or "dev_user"
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
