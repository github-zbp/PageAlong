from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.user import User, UserPreference

DEFAULT_THEME_ID = "newspaper"
DEFAULT_BACKGROUND_COLOR = "white"
ALLOWED_THEME_IDS = {"newspaper", "forest", "mist", "amber", "night"}
ALLOWED_BACKGROUND_COLORS = {"white"}


def normalize_theme_id(theme_id: str | None) -> str:
    value = (theme_id or DEFAULT_THEME_ID).strip().lower()
    if value not in ALLOWED_THEME_IDS:
        raise ValueError(f"Unsupported theme_id: {theme_id}")
    return value


def normalize_background_color(background_color: str | None) -> str:
    value = (background_color or DEFAULT_BACKGROUND_COLOR).strip().lower()
    if value not in ALLOWED_BACKGROUND_COLORS:
        raise ValueError(f"Unsupported background_color: {background_color}")
    return value


def get_or_create_user_preferences(db: Session, user: User) -> UserPreference:
    preferences = db.query(UserPreference).filter(UserPreference.user_id == user.id).one_or_none()
    if preferences is None:
        preferences = UserPreference(
            user_id=user.id,
            theme_id=DEFAULT_THEME_ID,
            background_color=DEFAULT_BACKGROUND_COLOR,
        )
        db.add(preferences)
        db.commit()
        db.refresh(preferences)
    return preferences


def update_user_preferences(
    db: Session,
    user: User,
    *,
    theme_id: str | None = None,
    background_color: str | None = None,
) -> UserPreference:
    preferences = get_or_create_user_preferences(db, user)
    preferences.theme_id = normalize_theme_id(theme_id)
    preferences.background_color = normalize_background_color(background_color)
    db.add(preferences)
    db.commit()
    db.refresh(preferences)
    return preferences
