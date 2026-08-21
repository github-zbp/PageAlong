from pydantic import BaseModel, Field


class PlaybackProgressUpdate(BaseModel):
    position_seconds: int = Field(ge=0)
    sentence_index: int = Field(ge=0)


class PlaybackProgressRead(BaseModel):
    position_seconds: int
    sentence_index: int

