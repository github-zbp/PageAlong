from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user
from app.api.routes.auth import raise_http_auth_error, serialize_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AdminUserList, UserRead
from app.services.auth_service import AdminGuardError, AuthError, AuthService

router = APIRouter(prefix="/admin", tags=["admin"])


def get_admin_service() -> AuthService:
    return AuthService()


def get_target_user_or_404(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def guard_error(exc: AdminGuardError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc) or exc.detail) from exc


@router.get("/users", response_model=AdminUserList)
def list_admin_users(
    query: str = "",
    role: str = Query(default="", pattern="^(|user|admin)$"),
    status_filter: str = Query(default="", alias="status", pattern="^(|active|disabled)$"),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AdminUserList:
    users = get_admin_service().list_users(db, query=query, role=role, status=status_filter)
    return AdminUserList(items=[serialize_user(user) for user in users])


@router.get("/users/{user_id}", response_model=UserRead)
def get_admin_user(
    user_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> UserRead:
    return serialize_user(get_target_user_or_404(db, user_id))


@router.post("/users/{user_id}/disable", response_model=UserRead)
def disable_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> UserRead:
    target = get_target_user_or_404(db, user_id)
    try:
        return serialize_user(get_admin_service().disable_user(db, target_user=target, actor=admin))
    except AdminGuardError as exc:
        guard_error(exc)


@router.post("/users/{user_id}/enable", response_model=UserRead)
def enable_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> UserRead:
    target = get_target_user_or_404(db, user_id)
    return serialize_user(get_admin_service().enable_user(db, target_user=target, actor=admin))


@router.post("/users/{user_id}/promote", response_model=UserRead)
def promote_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> UserRead:
    target = get_target_user_or_404(db, user_id)
    return serialize_user(get_admin_service().promote_user(db, target_user=target, actor=admin))


@router.post("/users/{user_id}/demote", response_model=UserRead)
def demote_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> UserRead:
    target = get_target_user_or_404(db, user_id)
    try:
        return serialize_user(get_admin_service().demote_user(db, target_user=target, actor=admin))
    except AdminGuardError as exc:
        guard_error(exc)


@router.post("/users/{user_id}/force-logout", status_code=status.HTTP_204_NO_CONTENT)
def force_logout_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> Response:
    target = get_target_user_or_404(db, user_id)
    get_admin_service().force_logout_user(db, target_user=target, actor=admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/users/{user_id}/send-password-reset", status_code=status.HTTP_204_NO_CONTENT)
def send_password_reset(
    user_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> Response:
    target = get_target_user_or_404(db, user_id)
    try:
        get_admin_service().request_password_reset_code(db, email=target.email)
    except AuthError as exc:
        raise_http_auth_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
