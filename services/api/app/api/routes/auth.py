from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentSession, get_current_session, get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    EmailCodeRequest,
    LoginRequest,
    PasswordResetCodeRequest,
    PasswordResetConfirmRequest,
    RegisterRequest,
    UserRead,
)
from app.schemas.preferences import ThemePreferencesRead, ThemePreferencesUpdate
from app.services.auth_service import AuthError, AuthService
from app.services.user_preferences_service import get_or_create_user_preferences, update_user_preferences

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service() -> AuthService:
    return AuthService()


def serialize_user(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        email=user.email,
        role=user.role.value,
        status=user.status.value,
        email_verified_at=user.email_verified_at,
        must_change_password_at_next_login=user.must_change_password_at_next_login,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


def auth_response(result) -> AuthResponse:
    return AuthResponse(token=result.token, user=serialize_user(result.user))


def serialize_theme_preferences(preferences) -> ThemePreferencesRead:
    return ThemePreferencesRead(
        theme_id=preferences.theme_id,
        background_color=preferences.background_color,
    )


def client_ip(request: Request) -> str:
    return request.client.host if request.client is not None else ""


def user_agent(request: Request) -> str:
    return request.headers.get("user-agent", "")


def raise_http_auth_error(exc: AuthError) -> None:
    headers = {}
    if hasattr(exc, "retry_after_seconds"):
        headers["Retry-After"] = str(exc.retry_after_seconds)
    raise HTTPException(status_code=exc.status_code, detail=exc.detail, headers=headers) from exc


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.auth_session_cookie_name,
        value=token,
        max_age=settings.auth_session_ttl_seconds,
        httponly=True,
        secure=settings.auth_session_cookie_secure,
        samesite=settings.auth_session_cookie_samesite,
        domain=settings.auth_session_cookie_domain or None,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.auth_session_cookie_name,
        httponly=True,
        secure=settings.auth_session_cookie_secure,
        samesite=settings.auth_session_cookie_samesite,
        domain=settings.auth_session_cookie_domain or None,
        path="/",
    )


@router.post("/email/code", status_code=status.HTTP_204_NO_CONTENT)
def request_email_code(payload: EmailCodeRequest, db: Session = Depends(get_db)) -> Response:
    try:
        get_auth_service().request_email_code(db, email=payload.email, purpose=payload.purpose)
    except AuthError as exc:
        raise_http_auth_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    try:
        result = get_auth_service().register(
            db,
            email=payload.email,
            password=payload.password,
            code=payload.code,
            user_agent=user_agent(request),
            ip_address=client_ip(request),
        )
    except AuthError as exc:
        raise_http_auth_error(exc)
    set_session_cookie(response, result.token)
    return auth_response(result)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        result = get_auth_service().login(
            db,
            email=payload.email,
            password=payload.password,
            user_agent=user_agent(request),
            ip_address=client_ip(request),
        )
    except AuthError as exc:
        raise_http_auth_error(exc)
    set_session_cookie(response, result.token)
    return auth_response(result)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return serialize_user(current_user)


@router.get("/me/preferences", response_model=ThemePreferencesRead)
def me_preferences(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ThemePreferencesRead:
    preferences = get_or_create_user_preferences(db, current_user)
    return serialize_theme_preferences(preferences)


@router.put("/me/preferences", response_model=ThemePreferencesRead)
def update_me_preferences(
    payload: ThemePreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ThemePreferencesRead:
    try:
        preferences = update_user_preferences(
            db,
            current_user,
            theme_id=payload.theme_id,
            background_color=payload.background_color,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return serialize_theme_preferences(preferences)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(current_session: CurrentSession = Depends(get_current_session), db: Session = Depends(get_db)) -> Response:
    get_auth_service().logout(db, current_session.session)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_session_cookie(response)
    return response


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    get_auth_service().logout_all(db, current_user)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_session_cookie(response)
    return response


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        get_auth_service().change_password(
            db,
            user=current_user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    except AuthError as exc:
        raise_http_auth_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/password-reset/code", status_code=status.HTTP_204_NO_CONTENT)
def request_password_reset_code(payload: PasswordResetCodeRequest, db: Session = Depends(get_db)) -> Response:
    try:
        get_auth_service().request_password_reset_code(db, email=payload.email)
    except AuthError as exc:
        raise_http_auth_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
def confirm_password_reset(payload: PasswordResetConfirmRequest, db: Session = Depends(get_db)) -> Response:
    try:
        get_auth_service().reset_password(
            db,
            email=payload.email,
            code=payload.code,
            new_password=payload.new_password,
        )
    except AuthError as exc:
        raise_http_auth_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
