from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class EmailCodeRequest(BaseModel):
    email: str
    purpose: str = Field(pattern="^(register|password_reset|login)$")


class LoginCapabilitiesRead(BaseModel):
    email_password: bool = True
    email_code: bool = True
    wechat: bool = False
    one_tap: bool = False


class RegisterRequest(BaseModel):
    email: str
    password: str
    code: str


class LoginRequest(BaseModel):
    email: str
    password: str


class EmailCodeLoginRequest(BaseModel):
    email: str
    code: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class PasswordResetCodeRequest(BaseModel):
    email: str


class PasswordResetConfirmRequest(BaseModel):
    email: str
    code: str
    new_password: str


class WechatExchangeRequest(BaseModel):
    code: str
    state: str | None = None


class OneTapExchangeRequest(BaseModel):
    credential: str
    provider: str | None = None


class UserRead(BaseModel):
    id: str
    email: str
    role: str
    status: str
    email_verified_at: datetime | None
    must_change_password_at_next_login: bool
    last_login_at: datetime | None
    last_dashboard_at: datetime | None = None
    last_dashboard_locale: str = ""
    created_at: datetime


class AuthResponse(BaseModel):
    token: str
    user: UserRead
