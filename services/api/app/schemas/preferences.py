from __future__ import annotations

from pydantic import BaseModel, Field


class ThemePreferencesRead(BaseModel):
    theme_id: str = Field(pattern="^(newspaper|forest|mist|amber|night)$")
    background_color: str = Field(pattern="^white$")


class ThemePreferencesUpdate(BaseModel):
    theme_id: str = Field(pattern="^(newspaper|forest|mist|amber|night)$")
    background_color: str = Field(pattern="^white$")
