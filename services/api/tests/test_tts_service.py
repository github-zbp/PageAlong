from app.services.tts_service import FakeTTSProvider


def test_fake_tts_creates_timeline_for_each_sentence(tmp_path):
    provider = FakeTTSProvider(output_dir=tmp_path)

    result = provider.synthesize_article(
        course_id="course_1",
        sentences=["第一句。", "第二句。"],
        voice_id="fake-cn",
        speed=1.0,
    )

    assert result.provider == "fake"
    assert result.duration_seconds > 0
    assert result.character_count == 6
    assert result.audio_path.exists()
    assert len(result.timeline) == 2
    assert result.timeline[0].start_seconds == 0
    assert result.timeline[0].end_seconds <= result.timeline[1].start_seconds

