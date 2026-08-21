from datetime import datetime

from app.core.config import Settings
from app.models.course import AudioAsset, CourseSection
from app.models.tts import TTSSegment, TTSQuotaPeriod, TTSUsageEvent


def test_tts_settings_defaults_are_present():
    settings = Settings()

    assert settings.tts_provider_mode == "auto"
    assert settings.tts_default_free_provider == "edge_tts"
    assert settings.tts_free_fallback_provider == "kokoro_onnx_cpu"
    assert settings.tts_default_paid_provider == "tencent_cloud_tts"
    assert settings.tts_paid_fallback_provider == "aws_polly_standard"
    assert settings.tts_tencent_max_chinese_chars == 560
    assert settings.tts_tencent_max_english_letters == 1600
    assert settings.tts_tencent_codec == "mp3"
    assert settings.tts_tencent_sample_rate == 16000
    assert settings.tts_kokoro_voice == "zf_xiaobei"
    assert settings.free_tts_daily_course_limit == 10


def test_tts_models_can_be_inserted(db_session):
    section = CourseSection(
        course_id="course_1",
        article_text_id="article_1",
        section_index=0,
        title="第 1 节",
        sentence_start_index=0,
        sentence_end_index=2,
        planned_duration_seconds=420,
    )
    segment = TTSSegment(
        job_id="job_1",
        course_id="course_1",
        article_text_id="article_1",
        section_id="section_1",
        segment_index=0,
        sentence_start_index=0,
        sentence_end_index=0,
        text_hash="hash_1",
        provider="tencent_cloud_tts",
        model_id="standard",
        voice_id="101001",
        speed_factor=1.25,
        provider_speed="2",
        idempotency_key="segment-key",
    )
    usage = TTSUsageEvent(
        idempotency_key="usage-key",
        user_id="user_1",
        course_id="course_1",
        job_id="job_1",
        segment_id="segment_1",
        tier="paid",
        provider="tencent_cloud_tts",
        model_id="standard",
        voice_id="101001",
        billable_characters=8,
        input_bytes=24,
        estimated_cost_cents=1,
        currency="CNY",
        status="reserved",
    )
    quota = TTSQuotaPeriod(
        user_id="user_1",
        tier="free",
        period_start=datetime(2026, 7, 1),
        period_end=datetime(2026, 8, 1),
    )
    asset = AudioAsset(
        course_id="course_1",
        article_text_id="article_1",
        provider="fake",
        model_id="fake",
        tier="free",
        voice_id="fake-cn",
        format="wav",
        object_path="storage/generated_audio/course.wav",
        duration_seconds=1,
        character_count=8,
        storage_backend="local",
    )

    db_session.add_all([section, segment, usage, quota, asset])
    db_session.commit()

    assert section.id
    assert segment.id
    assert usage.id
    assert quota.id
    assert asset.model_id == "fake"
