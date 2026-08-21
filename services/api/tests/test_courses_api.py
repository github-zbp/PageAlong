from datetime import datetime

import pytest

from app.models.course import ArticleText, Course, CourseStatus, SourceType
from app.models.generation_job import GenerationJob, JobStatus, JobType


@pytest.fixture(autouse=True)
def disable_media_compression(monkeypatch):
    monkeypatch.setattr("app.services.audio_generation_service.settings.media_compression_enabled", False)


def test_create_text_course_returns_course_with_sentences(client, monkeypatch):
    enqueued = {}
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: enqueued.update({"course_id": course_id, "job_id": job_id}) or "test-job-id",
    )

    response = client.post(
        "/courses",
        json={
            "title": "测试课程",
            "source_type": "manual_text",
            "text": "第一句。第二句。",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "测试课程"
    assert body["status"] == "audio_generating"
    assert body["word_count"] == 6
    assert body["word_count_unit"] == "characters"
    assert body["estimated_reading_seconds"] >= 60
    assert len(body["sentences"]) == 2
    assert enqueued["course_id"] == body["id"]


def test_create_text_course_uses_clean_tts_text_for_markdown_input(client, db_session, monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )

    response = client.post(
        "/courses",
        json={
            "title": "Markdown 文本",
            "source_type": "manual_text",
            "text": "**重点**第一句。第二句包含 *强调*。",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert [sentence["text"] for sentence in body["sentences"]] == ["重点第一句。", "第二句包含 强调。"]

    article_text = db_session.query(ArticleText).filter(ArticleText.course_id == body["id"]).one()
    assert article_text.text == "重点第一句。第二句包含 强调。"
    assert article_text.content_markdown == "**重点**第一句。第二句包含 *强调*。"


def test_create_text_course_creates_pending_generation_job(client, db_session, monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )

    response = client.post(
        "/courses",
        json={
            "title": "测试课程",
            "source_type": "manual_text",
            "text": "第一句。",
        },
    )

    assert response.status_code == 201
    course_id = response.json()["id"]
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == course_id).one()
    course = db_session.get(Course, course_id)
    assert course.status == CourseStatus.AUDIO_GENERATING
    assert job.job_type == JobType.TTS_GENERATE
    assert job.status == JobStatus.PENDING


def test_list_courses_returns_user_courses(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )

    client.post(
        "/courses",
        json={
            "title": "测试课程",
            "source_type": "manual_text",
            "text": "第一句。",
        },
    )

    response = client.get("/courses")

    assert response.status_code == 200
    assert response.json()["items"][0]["title"] == "测试课程"


def test_list_courses_returns_summary_without_reader_content(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    created = client.post(
        "/courses",
        json={
            "title": "长文课程",
            "source_type": "manual_text",
            "text": "第一句。第二句。",
        },
    ).json()

    response = client.get("/courses")

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["title"] == "长文课程"
    assert item["sentence_count"] == 2
    assert "content_markdown" not in item
    assert "sentences" not in item
    assert "sections" not in item

    detail = client.get(f"/courses/{created['id']}").json()
    assert detail["content_markdown"] == "第一句。第二句。"
    assert [sentence["text"] for sentence in detail["sentences"]] == ["第一句。", "第二句。"]


def test_get_course_returns_course_detail(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    created = client.post(
        "/courses",
        json={"title": "课程详情", "source_type": "manual_text", "text": "第一句。"},
    ).json()

    response = client.get(f"/courses/{created['id']}")

    assert response.status_code == 200
    assert response.json()["title"] == "课程详情"
    assert response.json()["sentences"][0]["text"] == "第一句。"


def test_request_audio_generation_is_idempotent_for_text_ready_course(client, db_session, monkeypatch):
    enqueued: list[tuple[str, str]] = []
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: enqueued.append((course_id, job_id)) or "test-job-id",
    )
    course = Course(
        user_id="test_user",
        title="文件课程",
        source_type=SourceType.FILE_UPLOAD,
        status=CourseStatus.TEXT_READY,
    )
    db_session.add(course)
    db_session.flush()
    db_session.add(ArticleText(course_id=course.id, version=1, text="第一句。"))
    db_session.commit()

    first = client.post(f"/courses/{course.id}/audio-generation")
    second = client.post(f"/courses/{course.id}/audio-generation")

    assert first.status_code == 202
    assert second.status_code == 202
    assert first.json()["id"] == second.json()["id"]
    assert len(enqueued) == 1


def test_get_course_returns_file_source_summary(client, db_session):
    course = Course(
        user_id="test_user",
        title="文件课程",
        source_type=SourceType.FILE_UPLOAD,
        status=CourseStatus.TEXT_READY,
    )
    db_session.add(course)
    db_session.flush()
    article_text = ArticleText(
        course_id=course.id,
        version=1,
        text="第一句。",
        source_metadata_json=(
            '{"source_kind":"file","relative_path":"notes/chapter-1.txt",'
            '"original_filename":"chapter-1.txt","content_type":"text/plain","byte_size":12}'
        ),
    )
    db_session.add(article_text)
    db_session.commit()

    response = client.get(f"/courses/{course.id}")

    assert response.status_code == 200
    assert response.json()["source"]["source_kind"] == "file"
    assert response.json()["source"]["relative_path"] == "notes/chapter-1.txt"
    assert response.json()["source"]["byte_size"] == 12


def test_free_user_daily_audio_generation_limit_blocks_new_generation_job(client, db_session, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.free_tts_daily_course_limit", 1)
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    existing_course = Course(
        user_id="test_user",
        title="已生成课程",
        source_type=SourceType.MANUAL_TEXT,
        status=CourseStatus.AUDIO_GENERATING,
    )
    db_session.add(existing_course)
    db_session.flush()
    db_session.add(
        GenerationJob(
            course_id=existing_course.id,
            job_type=JobType.TTS_GENERATE,
            status=JobStatus.PENDING,
            created_at=datetime.utcnow(),
        )
    )
    next_course = Course(
        user_id="test_user",
        title="待生成课程",
        source_type=SourceType.MANUAL_TEXT,
        status=CourseStatus.TEXT_READY,
    )
    db_session.add(next_course)
    db_session.flush()
    db_session.add(ArticleText(course_id=next_course.id, version=1, text="第一句。"))
    db_session.commit()

    response = client.post(f"/courses/{next_course.id}/audio-generation")

    assert response.status_code == 422
    assert "每天最多生成 1 次音频" in response.json()["detail"]
    assert (
        db_session.query(GenerationJob)
        .filter(GenerationJob.course_id == next_course.id, GenerationJob.job_type == JobType.TTS_GENERATE)
        .count()
        == 0
    )


def test_internal_generation_runner_marks_course_ready(client, db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    monkeypatch.setattr(
        "app.services.audio_generation_service.settings.generated_audio_dir",
        str(tmp_path),
    )
    created = client.post(
        "/courses",
        json={"title": "课程详情", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()

    response = client.post(f"/internal/generation-jobs/{job.id}/run")

    assert response.status_code == 200
    assert response.json() == {
        "course_id": created["id"],
        "job_id": job.id,
        "status": "succeeded",
    }
    db_session.expire_all()
    course = db_session.get(Course, created["id"])
    assert course.status == CourseStatus.READY


def test_ready_course_exposes_current_audio_url(client, db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    monkeypatch.setattr(
        "app.services.audio_generation_service.settings.generated_audio_dir",
        str(tmp_path),
    )
    created = client.post(
        "/courses",
        json={"title": "课程详情", "source_type": "manual_text", "text": "第一句。"},
    ).json()
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()
    client.post(f"/internal/generation-jobs/{job.id}/run")

    detail = client.get(f"/courses/{created['id']}").json()
    audio_response = client.get(detail["current_audio_url"])

    assert detail["status"] == "ready"
    assert detail["current_audio_url"] == f"/courses/{created['id']}/audio"
    assert audio_response.status_code == 200
    assert audio_response.headers["content-type"].startswith("audio/wav")
    assert audio_response.content[:4] == b"RIFF"
