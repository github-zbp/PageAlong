import pytest

from app.models.course import ArticleText, AudioAsset, Course, CourseSection, CourseStatus, SourceType
from app.models.generation_job import GenerationJob, JobStatus


@pytest.fixture(autouse=True)
def disable_media_compression(monkeypatch):
    monkeypatch.setattr("app.services.audio_generation_service.settings.media_compression_enabled", False)


def test_course_response_includes_sections_and_generation_error(client, db_session, monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    created = client.post(
        "/courses",
        json={"title": "带小节课程", "source_type": "manual_text", "text": "第一句。第二句。"},
    ).json()
    article_text = db_session.query(ArticleText).filter(ArticleText.course_id == created["id"]).one()
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()
    job.status = JobStatus.FAILED
    job.error_code = "provider_timeout"
    job.error_message = "腾讯云 TTS 超时"
    db_session.add(
        CourseSection(
            course_id=created["id"],
            article_text_id=article_text.id,
            section_index=0,
            title="第 1 节",
            sentence_start_index=0,
            sentence_end_index=1,
            planned_duration_seconds=420,
            status="succeeded",
        )
    )
    db_session.commit()

    response = client.get(f"/courses/{created['id']}")

    assert response.status_code == 200
    body = response.json()
    assert body["generation_status"] == "failed"
    assert body["generation_error_code"] == "provider_timeout"
    assert body["failed_reason"] == "腾讯云 TTS 超时"
    assert body["sections"][0]["title"] == "第 1 节"
    assert body["sections"][0]["sentence_start_index"] == 0


def test_course_response_uses_public_object_audio_url(client, db_session):
    course = Course(
        user_id="test_user",
        title="对象音频",
        source_type=SourceType.MANUAL_TEXT,
        status=CourseStatus.READY,
    )
    db_session.add(course)
    db_session.flush()
    article_text = ArticleText(course_id=course.id, version=1, text="第一句。")
    db_session.add(article_text)
    db_session.flush()
    audio_asset = AudioAsset(
        course_id=course.id,
        article_text_id=article_text.id,
        provider="edge_tts",
        voice_id="zh-CN-XiaoxiaoNeural",
        format="mp3",
        object_path="https://media.pagealong.test/audio/course/audio.mp3",
        storage_backend="r2",
        bucket="pagealong-media",
        object_key="audio/course/audio.mp3",
        content_type="audio/mp3",
        duration_seconds=1,
        character_count=4,
        is_current=True,
    )
    db_session.add(audio_asset)
    db_session.flush()
    course.current_audio_asset_id = audio_asset.id
    db_session.commit()

    response = client.get(f"/courses/{course.id}")

    assert response.status_code == 200
    assert response.json()["current_audio_url"] == "https://media.pagealong.test/audio/course/audio.mp3"


def test_retry_audio_generation_reuses_pending_job_for_current_user(client, db_session, monkeypatch):
    enqueued = {}
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: enqueued.update({"course_id": course_id, "job_id": job_id}) or "test-job-id",
    )
    created = client.post(
        "/courses",
        json={"title": "重试课程", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    existing_job_count = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).count()

    response = client.post(f"/courses/{created['id']}/audio-generation")

    assert response.status_code == 202
    body = response.json()
    assert body["course_id"] == created["id"]
    assert body["status"] == "pending"
    assert body["job_type"] == "tts_generate"
    assert enqueued["job_id"] == body["id"]
    second_response = client.post(f"/courses/{created['id']}/audio-generation")
    assert second_response.status_code == 202
    assert second_response.json()["id"] == body["id"]
    assert db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).count() == existing_job_count


def test_retry_audio_generation_marks_job_failed_when_enqueue_fails(client, db_session, monkeypatch):
    def fail_enqueue(course_id, job_id):
        raise RuntimeError("redis unavailable")

    monkeypatch.setattr("app.services.course_service.enqueue_audio_generation", fail_enqueue)
    course = Course(
        user_id="test_user",
        title="音频排队失败",
        source_type=SourceType.MANUAL_TEXT,
        status=CourseStatus.TEXT_READY,
    )
    db_session.add(course)
    db_session.flush()
    db_session.add(ArticleText(course_id=course.id, version=1, text="第一句。"))
    db_session.commit()

    response = client.post(f"/courses/{course.id}/audio-generation")

    assert response.status_code == 503
    db_session.expire_all()
    course = db_session.get(Course, course.id)
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == course.id).one()
    assert course.status == CourseStatus.FAILED
    assert job.status == JobStatus.FAILED
    assert job.error_code == "queue_unavailable"


def test_retry_audio_generation_is_reported_as_latest_generation_job(client, db_session, monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    created = client.post(
        "/courses",
        json={"title": "重试状态", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    old_job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()
    old_job.status = JobStatus.FAILED
    old_job.error_code = "old_failure"
    old_job.error_message = "旧失败"
    db_session.commit()

    retry_response = client.post(f"/courses/{created['id']}/audio-generation").json()
    detail = client.get(f"/courses/{created['id']}").json()

    assert retry_response["status"] == "pending"
    assert detail["current_generation_job_id"] == retry_response["id"]
    assert detail["generation_status"] == "pending"
    assert detail["generation_error_code"] is None


def test_retry_failed_course_job_restarts_failed_audio_generation_stage(client, db_session, monkeypatch):
    enqueued = {}
    monkeypatch.setattr(
        "app.api.routes.courses.enqueue_audio_generation",
        lambda course_id, job_id: enqueued.update({"course_id": course_id, "job_id": job_id}) or "test-job-id",
    )
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "initial-test-job-id",
    )
    created = client.post(
        "/courses",
        json={"title": "失败音频", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    failed_job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()
    failed_job.status = JobStatus.FAILED
    failed_job.error_code = "audio_generation_failed"
    failed_job.error_message = "TTS timeout"
    course = db_session.get(Course, created["id"])
    course.status = CourseStatus.FAILED
    db_session.commit()
    existing_job_count = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).count()

    response = client.post(f"/courses/{created['id']}/retry-failed-job")

    assert response.status_code == 202
    body = response.json()
    assert body["job_type"] == "tts_generate"
    assert body["status"] == "pending"
    assert body["error_code"] is None
    assert enqueued["job_id"] == body["id"]
    db_session.expire_all()
    course = db_session.get(Course, created["id"])
    assert course.status == CourseStatus.AUDIO_GENERATING
    assert db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).count() == existing_job_count + 1


def test_internal_generation_rejects_fixed_token_when_hmac_is_configured(client, db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    monkeypatch.setattr("app.services.audio_generation_service.settings.generated_audio_dir", str(tmp_path))
    from app.api import internal_auth

    monkeypatch.setattr(internal_auth.settings, "internal_api_hmac_secret", "secret-token")
    internal_auth.clear_internal_replay_cache()
    created = client.post(
        "/courses",
        json={"title": "内部安全", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()

    response = client.post(
        f"/internal/generation-jobs/{job.id}/run",
        headers={"X-Internal-API-Token": "secret-token"},
    )

    assert response.status_code == 401


def test_internal_generation_rejects_missing_hmac_headers(client, db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    monkeypatch.setattr("app.services.audio_generation_service.settings.generated_audio_dir", str(tmp_path))
    from app.api import internal_auth

    monkeypatch.setattr(internal_auth.settings, "internal_api_hmac_secret", "hmac-secret")
    internal_auth.clear_internal_replay_cache()
    created = client.post(
        "/courses",
        json={"title": "缺少签名", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()

    response = client.post(f"/internal/generation-jobs/{job.id}/run")

    assert response.status_code == 401


def test_internal_generation_rejects_legacy_token_without_hmac_secret(client, db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    monkeypatch.setattr("app.services.audio_generation_service.settings.generated_audio_dir", str(tmp_path))
    from app.api import internal_auth

    monkeypatch.setattr(internal_auth.settings, "internal_api_hmac_secret", "")
    monkeypatch.setattr(internal_auth.settings, "internal_api_token", "legacy-secret")
    internal_auth.clear_internal_replay_cache()
    created = client.post(
        "/courses",
        json={"title": "旧 token", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()

    response = client.post(
        f"/internal/generation-jobs/{job.id}/run",
        headers={"X-Internal-API-Token": "legacy-secret"},
    )

    assert response.status_code == 401


def test_internal_generation_accepts_hmac_signature_and_rejects_replay(client, db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    monkeypatch.setattr("app.services.audio_generation_service.settings.generated_audio_dir", str(tmp_path))
    from app.api import internal_auth

    monkeypatch.setattr(internal_auth.settings, "internal_api_hmac_secret", "hmac-secret")
    monkeypatch.setattr(internal_auth.settings, "internal_api_signature_ttl_seconds", 300)
    internal_auth.clear_internal_replay_cache()
    created = client.post(
        "/courses",
        json={"title": "内部签名", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()
    path = f"/internal/generation-jobs/{job.id}/run"
    headers = internal_auth.sign_internal_request(
        method="POST",
        path_with_query=path,
        body=b"",
        secret="hmac-secret",
        timestamp="1900000000",
        nonce="nonce-1",
    )
    monkeypatch.setattr(internal_auth.time, "time", lambda: 1900000000)

    accepted = client.post(path, headers=headers)
    replayed = client.post(path, headers=headers)

    assert accepted.status_code == 200
    assert replayed.status_code == 401


def test_internal_generation_does_not_reserve_nonce_after_invalid_signature(client, db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    monkeypatch.setattr("app.services.audio_generation_service.settings.generated_audio_dir", str(tmp_path))
    from app.api import internal_auth

    monkeypatch.setattr(internal_auth.settings, "internal_api_hmac_secret", "hmac-secret")
    monkeypatch.setattr(internal_auth.settings, "internal_api_signature_ttl_seconds", 300)
    monkeypatch.setattr(internal_auth.settings, "internal_api_replay_store", "memory")
    internal_auth.clear_internal_replay_cache()
    created = client.post(
        "/courses",
        json={"title": "内部签名失败", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()
    path = f"/internal/generation-jobs/{job.id}/run"
    valid_headers = internal_auth.sign_internal_request(
        method="POST",
        path_with_query=path,
        body=b"",
        secret="hmac-secret",
        timestamp="1900000000",
        nonce="invalid-signature-nonce",
    )
    invalid_headers = valid_headers | {"X-Internal-Signature": "sha256=invalid"}
    monkeypatch.setattr(internal_auth.time, "time", lambda: 1900000000)

    invalid = client.post(path, headers=invalid_headers)
    reused = client.post(path, headers=valid_headers)

    assert invalid.status_code == 401
    assert reused.status_code == 200


def test_internal_generation_rejects_future_timestamp(client, db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    monkeypatch.setattr("app.services.audio_generation_service.settings.generated_audio_dir", str(tmp_path))
    from app.api import internal_auth

    monkeypatch.setattr(internal_auth.settings, "internal_api_hmac_secret", "hmac-secret")
    monkeypatch.setattr(internal_auth.settings, "internal_api_signature_ttl_seconds", 300)
    monkeypatch.setattr(internal_auth.settings, "internal_api_replay_store", "memory")
    internal_auth.clear_internal_replay_cache()
    created = client.post(
        "/courses",
        json={"title": "未来时间戳", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()
    path = f"/internal/generation-jobs/{job.id}/run"
    headers = internal_auth.sign_internal_request(
        method="POST",
        path_with_query=path,
        body=b"",
        secret="hmac-secret",
        timestamp="1900000100",
        nonce="future-timestamp-nonce",
    )
    monkeypatch.setattr(internal_auth.time, "time", lambda: 1900000000)

    response = client.post(path, headers=headers)

    assert response.status_code == 401


def test_internal_generation_rejects_expired_timestamp(client, db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    monkeypatch.setattr("app.services.audio_generation_service.settings.generated_audio_dir", str(tmp_path))
    from app.api import internal_auth

    monkeypatch.setattr(internal_auth.settings, "internal_api_hmac_secret", "hmac-secret")
    monkeypatch.setattr(internal_auth.settings, "internal_api_signature_ttl_seconds", 300)
    monkeypatch.setattr(internal_auth.settings, "internal_api_replay_store", "memory")
    internal_auth.clear_internal_replay_cache()
    created = client.post(
        "/courses",
        json={"title": "过期时间戳", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()
    path = f"/internal/generation-jobs/{job.id}/run"
    headers = internal_auth.sign_internal_request(
        method="POST",
        path_with_query=path,
        body=b"",
        secret="hmac-secret",
        timestamp="1899999699",
        nonce="expired-timestamp-nonce",
    )
    monkeypatch.setattr(internal_auth.time, "time", lambda: 1900000000)

    response = client.post(path, headers=headers)

    assert response.status_code == 401


def test_internal_generation_rejects_signature_for_different_path(client, db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    monkeypatch.setattr("app.services.audio_generation_service.settings.generated_audio_dir", str(tmp_path))
    from app.api import internal_auth

    monkeypatch.setattr(internal_auth.settings, "internal_api_hmac_secret", "hmac-secret")
    monkeypatch.setattr(internal_auth.settings, "internal_api_signature_ttl_seconds", 300)
    monkeypatch.setattr(internal_auth.settings, "internal_api_replay_store", "memory")
    internal_auth.clear_internal_replay_cache()
    created = client.post(
        "/courses",
        json={"title": "路径绑定", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()
    path = f"/internal/generation-jobs/{job.id}/run"
    headers = internal_auth.sign_internal_request(
        method="POST",
        path_with_query="/internal/generation-jobs/other-job/run",
        body=b"",
        secret="hmac-secret",
        timestamp="1900000000",
        nonce="path-tamper-nonce",
    )
    monkeypatch.setattr(internal_auth.time, "time", lambda: 1900000000)

    response = client.post(path, headers=headers)

    assert response.status_code == 401


def test_internal_generation_can_use_redis_replay_store(client, db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    monkeypatch.setattr("app.services.audio_generation_service.settings.generated_audio_dir", str(tmp_path))
    from app.api import internal_auth

    class FakeRedis:
        def __init__(self):
            self.keys = set()

        def set(self, key, value, *, ex, nx):
            if nx and key in self.keys:
                return False
            self.keys.add(key)
            return True

    fake_redis = FakeRedis()
    monkeypatch.setattr(internal_auth.settings, "internal_api_hmac_secret", "hmac-secret")
    monkeypatch.setattr(internal_auth.settings, "internal_api_signature_ttl_seconds", 300)
    monkeypatch.setattr(internal_auth.settings, "internal_api_replay_store", "redis")
    monkeypatch.setattr(internal_auth, "get_redis_client", lambda: fake_redis)
    created = client.post(
        "/courses",
        json={"title": "Redis replay", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()
    path = f"/internal/generation-jobs/{job.id}/run"
    headers = internal_auth.sign_internal_request(
        method="POST",
        path_with_query=path,
        body=b"",
        secret="hmac-secret",
        timestamp="1900000000",
        nonce="redis-nonce-1",
    )
    monkeypatch.setattr(internal_auth.time, "time", lambda: 1900000000)

    accepted = client.post(path, headers=headers)
    replayed = client.post(path, headers=headers)

    assert accepted.status_code == 200
    assert replayed.status_code == 401


def test_audio_endpoint_proxies_s3_range_request(client, db_session, monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    created = client.post(
        "/courses",
        json={"title": "对象存储音频", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    article_text = db_session.query(ArticleText).filter(ArticleText.course_id == created["id"]).one()
    course = db_session.get(Course, created["id"])
    asset = AudioAsset(
        course_id=created["id"],
        article_text_id=article_text.id,
        provider="aws_polly_standard",
        model_id="standard",
        tier="paid",
        voice_id="Zhiyu",
        format="mp3",
        object_path="courses/course_1/audio.mp3",
        storage_backend="s3",
        bucket="tts-audio",
        object_key="courses/course_1/audio.mp3",
        content_type="audio/mpeg",
        duration_seconds=1,
        character_count=4,
        is_current=True,
    )
    db_session.add(asset)
    db_session.flush()
    course.status = CourseStatus.READY
    course.current_audio_asset_id = asset.id
    db_session.commit()

    captured = {}

    class FakeBody:
        def read(self):
            return b"mp3!"

    class FakeS3Client:
        def get_object(self, **kwargs):
            captured.update(kwargs)
            return {
                "Body": FakeBody(),
                "ContentLength": 4,
                "ContentRange": "bytes 0-3/8",
                "ETag": '"etag-1"',
            }

    monkeypatch.setattr("app.api.routes.courses.get_s3_client", lambda: FakeS3Client())

    response = client.get(f"/courses/{created['id']}/audio", headers={"Range": "bytes=0-3"})

    assert response.status_code == 206
    assert captured == {
        "Bucket": "tts-audio",
        "Key": "courses/course_1/audio.mp3",
        "Range": "bytes=0-3",
    }
    assert response.headers["content-range"] == "bytes 0-3/8"
    assert response.headers["accept-ranges"] == "bytes"
    assert response.content == b"mp3!"
