from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SentenceRead(BaseModel):
    index: int
    text: str
    audio_start_seconds: float | None = None
    audio_end_seconds: float | None = None


class CourseSectionRead(BaseModel):
    section_index: int
    title: str
    sentence_start_index: int
    sentence_end_index: int
    planned_duration_seconds: int
    audio_start_seconds: float | None = None
    audio_end_seconds: float | None = None
    status: str


class GenerationJobRead(BaseModel):
    id: str
    course_id: str
    job_type: str
    status: str
    provider: str | None = None
    fallback_provider: str | None = None
    tier: str | None = None
    progress_current: int = 0
    progress_total: int = 0
    error_code: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class GenerationJobList(BaseModel):
    items: list[GenerationJobRead]


class TagRead(BaseModel):
    id: str
    name: str
    color: str
    usage_count: int = 0
    updated_at: datetime


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    color: str | None = Field(default=None, max_length=32)


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    color: str | None = Field(default=None, max_length=32)


class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    source_type: str
    text: str = Field(min_length=1)
    series_id: str | None = None
    series_title: str | None = Field(default=None, max_length=512)
    tags: list[str] = Field(default_factory=list)
    tag_ids: list[str] = Field(default_factory=list)
    is_starred: bool = False


class CourseUrlImportCreate(BaseModel):
    url: str = Field(min_length=1, max_length=4096)
    title: str | None = Field(default=None, max_length=512)
    series_id: str | None = None
    series_title: str | None = Field(default=None, max_length=512)
    tags: list[str] = Field(default_factory=list)
    tag_ids: list[str] = Field(default_factory=list)
    is_starred: bool = False


class CourseExtensionImageCandidate(BaseModel):
    url: str = Field(min_length=1, max_length=4096)
    alt: str = Field(default="", max_length=512)
    width: int | None = Field(default=None, ge=1)
    height: int | None = Field(default=None, ge=1)
    nearby_text: str = Field(default="", max_length=1000)


class CourseExtensionSyncCreate(BaseModel):
    url: str = Field(min_length=1, max_length=4096)
    title: str | None = Field(default=None, max_length=512)
    article_html: str = Field(default="", max_length=2_000_000)
    text_excerpt: str = Field(default="", max_length=120_000)
    images: list[CourseExtensionImageCandidate] = Field(default_factory=list)
    series_id: str | None = None
    series_title: str | None = Field(default=None, max_length=512)
    tags: list[str] = Field(default_factory=list)
    tag_ids: list[str] = Field(default_factory=list)
    is_starred: bool = False
    client_metadata: dict[str, object] = Field(default_factory=dict)


class CourseSourceRead(BaseModel):
    source_kind: str | None = None
    locator: str | None = None
    canonical_locator: str | None = None
    final_url: str | None = None
    source_domain: str | None = None
    author: str | None = None
    published_at: str | None = None
    original_filename: str | None = None
    relative_path: str | None = None
    file_extension: str | None = None
    content_type: str | None = None
    byte_size: int | None = None
    storage_backend: str | None = None
    object_key: str | None = None


class CourseSummaryRead(BaseModel):
    id: str
    title: str
    source_type: str
    status: str
    word_count: int
    word_count_unit: Literal["characters", "words"] = "characters"
    estimated_reading_seconds: int = 0
    duration_seconds: int
    current_audio_url: str | None = None
    last_playback_position_seconds: int
    library_type: Literal["fragmented", "series"]
    series_id: str | None = None
    series_title: str | None = None
    tags: list[TagRead] = Field(default_factory=list)
    is_starred: bool = False
    created_at: datetime
    updated_at: datetime
    last_read_at: datetime | None = None
    sentence_count: int = 0
    import_status: str | None = None
    import_error_code: str | None = None
    import_error_message: str | None = None
    current_generation_job_id: str | None = None
    generation_status: str | None = None
    generation_error_code: str | None = None
    failed_reason: str | None = None


class CourseRead(BaseModel):
    id: str
    title: str
    source_type: str
    status: str
    word_count: int
    word_count_unit: Literal["characters", "words"] = "characters"
    estimated_reading_seconds: int = 0
    duration_seconds: int
    current_audio_url: str | None = None
    last_playback_position_seconds: int
    library_type: Literal["fragmented", "series"]
    series_id: str | None = None
    series_title: str | None = None
    tags: list[TagRead] = Field(default_factory=list)
    is_starred: bool = False
    created_at: datetime
    updated_at: datetime
    last_read_at: datetime | None = None
    sentences: list[SentenceRead] = Field(default_factory=list)
    sections: list[CourseSectionRead] = Field(default_factory=list)
    content_markdown: str | None = None
    source: CourseSourceRead | None = None
    import_status: str | None = None
    import_error_code: str | None = None
    import_error_message: str | None = None
    current_generation_job_id: str | None = None
    generation_status: str | None = None
    generation_error_code: str | None = None
    failed_reason: str | None = None


class CourseList(BaseModel):
    items: list[CourseSummaryRead]


class CourseLibraryUpdate(BaseModel):
    library_type: Literal["fragmented", "series"] | None = None
    series_id: str | None = None
    series_title: str | None = Field(default=None, max_length=512)
    tags: list[str] | None = None
    tag_ids: list[str] | None = None
    is_starred: bool | None = None


class CourseSeriesRead(BaseModel):
    id: str
    title: str
    article_count: int
    tags: list[str] = Field(default_factory=list)
    is_starred: bool
    updated_at: datetime
    last_read_at: datetime | None = None
    last_read_course_id: str | None = None
    latest_course_id: str | None = None


class CourseSeriesList(BaseModel):
    items: list[CourseSeriesRead]


class CourseSeriesDetail(CourseSeriesRead):
    courses: list[CourseRead] = Field(default_factory=list)


class CourseSeriesCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    is_starred: bool = False


class CourseSeriesUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    tags: list[str] | None = None
    is_starred: bool | None = None


class SeriesMoveResult(BaseModel):
    moved_count: int


class TagList(BaseModel):
    items: list[TagRead]
