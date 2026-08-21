from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class EmailCodeRequest(BaseModel):
    email: str
    purpose: str = Field(pattern="^(register|password_reset)$")


class RegisterRequest(BaseModel):
    email: str
    password: str
    code: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class PasswordResetCodeRequest(BaseModel):
    email: str


class PasswordResetConfirmRequest(BaseModel):
    email: str
    code: str
    new_password: str


class UserRead(BaseModel):
    id: str
    email: str
    role: str
    status: str
    email_verified_at: datetime | None
    must_change_password_at_next_login: bool
    last_login_at: datetime | None
    created_at: datetime


class AuthResponse(BaseModel):
    token: str
    user: UserRead


class AdminUserList(BaseModel):
    items: list[UserRead]
