import json

from app.models.course import ArticleImageAsset, ArticleText, Course, CourseStatus, SourceType
from app.models.generation_job import GenerationJob, JobStatus, JobType
from app.core.config import settings
from app.services.url_import_service import UrlImportService


def test_create_url_import_course_returns_extracting_course(client, db_session, monkeypatch):
    enqueued = {}
    monkeypatch.setattr(
        "app.api.routes.courses.enqueue_url_import",
        lambda course_id, job_id: enqueued.update({"course_id": course_id, "job_id": job_id}) or "celery-import-id",
    )

    response = client.post("/courses/import-url", json={"url": "https://example.com/article"})

    assert response.status_code == 201
    body = response.json()
    assert body["source_type"] == "url_import"
    assert body["status"] == "extracting_text"
    course = db_session.get(Course, body["id"])
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == course.id).one()
    assert course.source_type == SourceType.URL_IMPORT
    assert course.status == CourseStatus.EXTRACTING_TEXT
    assert job.job_type == JobType.URL_IMPORT
    assert enqueued["course_id"] == course.id
    assert enqueued["job_id"] == job.id


def test_create_url_import_rejects_empty_url(client):
    response = client.post("/courses/import-url", json={"url": ""})

    assert response.status_code == 422


def test_create_url_import_marks_course_failed_when_enqueue_fails(client, db_session, monkeypatch):
    def fail_enqueue(course_id, job_id):
        raise RuntimeError("redis unavailable")

    monkeypatch.setattr("app.api.routes.courses.enqueue_url_import", fail_enqueue)

    response = client.post("/courses/import-url", json={"url": "https://example.com/article"})

    assert response.status_code == 503
    course = db_session.query(Course).one()
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == course.id).one()
    assert course.status == CourseStatus.FAILED
    assert job.status == JobStatus.FAILED
    assert job.error_code == "queue_unavailable"


def test_create_extension_sync_course_enqueues_auto_import(client, db_session, monkeypatch):
    enqueued = {}
    monkeypatch.setattr(
        "app.api.routes.courses.enqueue_url_import",
        lambda course_id, job_id: enqueued.update({"course_id": course_id, "job_id": job_id}) or "celery-import-id",
    )

    response = client.post(
        "/courses/import-url/extension-sync",
        json={
            "url": "https://example.com/article",
            "title": "插件标题",
            "article_html": "<article><p>第一段正文内容足够长。</p><p>第二段正文继续补充。</p></article>",
            "text_excerpt": "第一段正文内容足够长。第二段正文继续补充。",
            "images": [{"url": "https://example.com/hero.png", "alt": "配图", "width": 800, "height": 400}],
            "client_metadata": {"extension_version": "0.1.0", "extractor_version": "browser-v1"},
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["source_type"] == "chrome_extension"
    assert body["status"] == "extracting_text"
    course = db_session.get(Course, body["id"])
    job = db_session.query(GenerationJob).filter(GenerationJob.course_id == course.id).one()
    payload = json.loads(job.input_json)
    assert payload["mode"] == "extension_sync"
    assert payload["auto_generate_audio"] is True
    assert payload["images"][0]["alt"] == "配图"
    assert enqueued["course_id"] == course.id
    assert enqueued["job_id"] == job.id
    assert course.source_type == SourceType.CHROME_EXTENSION
    assert course.status == CourseStatus.EXTRACTING_TEXT
    assert job.job_type == JobType.URL_IMPORT


def test_create_extension_sync_rejects_missing_url(client):
    response = client.post(
        "/courses/import-url/extension-sync",
        json={"url": "", "article_html": "<article></article>", "text_excerpt": ""},
    )

    assert response.status_code == 422


def test_course_image_route_serves_local_imported_image(client, db_session, tmp_path):
    image_path = tmp_path / "hero.png"
    image_path.write_bytes(b"png-bytes")
    course = Course(
        user_id="test_user",
        title="带图网页",
        source_type=SourceType.URL_IMPORT,
        status=CourseStatus.NEEDS_REVIEW,
    )
    db_session.add(course)
    db_session.flush()
    article_text = ArticleText(course_id=course.id, version=1, text="第一句。")
    db_session.add(article_text)
    db_session.flush()
    image_asset = ArticleImageAsset(
        course_id=course.id,
        article_text_id=article_text.id,
        source_url="https://example.com/hero.png",
        alt_text="配图",
        object_path=str(image_path),
        object_key="articles/course/images/hash.png",
        content_type="image/png",
        byte_size=len(b"png-bytes"),
        checksum_sha256="a" * 64,
    )
    db_session.add(image_asset)
    db_session.commit()

    response = client.get(f"/courses/{course.id}/images/{image_asset.id}")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content == b"png-bytes"


def test_url_import_review_course_can_be_confirmed_for_audio_generation(client, db_session, monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.courses.enqueue_url_import",
        lambda course_id, job_id: "celery-import-id",
    )
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "celery-audio-id",
    )
    monkeypatch.setattr(
        "app.services.url_import_service.fetch_public_html",
        lambda url: type(
            "Fetch",
            (),
            {
                "original_url": url,
                "final_url": url,
                "status_code": 200,
                "content_type": "text/html",
                "html": "<html></html>",
                "elapsed_ms": 1,
            },
        )(),
    )
    monkeypatch.setattr(
        "app.services.url_import_service.extract_article_content",
        lambda html, original_url, final_url: type(
            "Extracted",
            (),
            {
                "title": "网页标题",
                "normalized": type(
                    "Normalized",
                    (),
                    {
                        "content_markdown": "# 网页标题\n\n第一句。",
                        "tts_text": "网页标题\n\n第一句。",
                        "content_hash": "hash_1",
                    },
                )(),
                "source_metadata": {"source_kind": "url", "locator": original_url, "final_url": final_url},
                "extraction_metadata": {},
            },
        )(),
    )

    created = client.post("/courses/import-url", json={"url": "https://example.com/article"}).json()
    import_job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()
    UrlImportService(db_session).run_import_job(import_job.id)

    response = client.post(f"/courses/{created['id']}/audio-generation")

    assert response.status_code == 202
    body = response.json()
    assert body["job_type"] == "tts_generate"
    assert body["status"] == "pending"
    db_session.expire_all()
    course = db_session.get(Course, created["id"])
    article_text = db_session.query(ArticleText).filter(ArticleText.course_id == created["id"]).one()
    assert course.status == CourseStatus.AUDIO_GENERATING
    assert article_text.confirmed_by_user is True


def test_url_import_review_confirmation_rejects_free_text_over_character_limit(client, db_session, monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.courses.enqueue_url_import",
        lambda course_id, job_id: "celery-import-id",
    )
    enqueued_audio_jobs = []
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: enqueued_audio_jobs.append((course_id, job_id)) or "celery-audio-id",
    )
    monkeypatch.setattr(settings, "free_tts_max_course_characters", 4)
    monkeypatch.setattr(
        "app.services.url_import_service.fetch_public_html",
        lambda url: type(
            "Fetch",
            (),
            {
                "original_url": url,
                "final_url": url,
                "status_code": 200,
                "content_type": "text/html",
                "html": "<html></html>",
                "elapsed_ms": 1,
            },
        )(),
    )
    monkeypatch.setattr(
        "app.services.url_import_service.extract_article_content",
        lambda html, original_url, final_url: type(
            "Extracted",
            (),
            {
                "title": "网页标题",
                "normalized": type(
                    "Normalized",
                    (),
                    {
                        "content_markdown": "# 网页标题\n\n第一句。第二句。",
                        "tts_text": "第一句。第二句。",
                        "content_hash": "hash_1",
                    },
                )(),
                "source_metadata": {"source_kind": "url", "locator": original_url, "final_url": final_url},
                "extraction_metadata": {},
            },
        )(),
    )

    created = client.post("/courses/import-url", json={"url": "https://example.com/article"}).json()
    import_job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()
    UrlImportService(db_session).run_import_job(import_job.id)

    response = client.post(f"/courses/{created['id']}/audio-generation")

    assert response.status_code == 422
    assert "超过了 4 个字" in response.json()["detail"]
    assert enqueued_audio_jobs == []
    db_session.expire_all()
    course = db_session.get(Course, created["id"])
    article_text = db_session.query(ArticleText).filter(ArticleText.course_id == created["id"]).one()
    assert course.status == CourseStatus.NEEDS_REVIEW
    assert article_text.confirmed_by_user is False
    assert (
        db_session.query(GenerationJob)
        .filter(GenerationJob.course_id == created["id"], GenerationJob.job_type == JobType.TTS_GENERATE)
        .count()
        == 0
    )


def test_retry_failed_course_job_restarts_failed_url_import_stage(client, db_session, monkeypatch):
    enqueued = {}
    monkeypatch.setattr(
        "app.api.routes.courses.enqueue_url_import",
        lambda course_id, job_id: enqueued.update({"course_id": course_id, "job_id": job_id}) or "celery-import-id",
    )
    created = client.post("/courses/import-url", json={"url": "https://example.com/article"}).json()
    failed_job = db_session.query(GenerationJob).filter(GenerationJob.course_id == created["id"]).one()
    failed_job.status = JobStatus.FAILED
    failed_job.error_code = "fetch_error"
    failed_job.error_message = "Fetching URL failed"
    course = db_session.get(Course, created["id"])
    course.status = CourseStatus.FAILED
    db_session.commit()

    response = client.post(f"/courses/{created['id']}/retry-failed-job")

    assert response.status_code == 202
    body = response.json()
    assert body["job_type"] == "url_import"
    assert body["status"] == "pending"
    assert body["error_code"] is None
    assert enqueued["job_id"] == body["id"]
    db_session.expire_all()
    course = db_session.get(Course, created["id"])
    retry_job = db_session.get(GenerationJob, body["id"])
    assert course.status == CourseStatus.EXTRACTING_TEXT
    assert retry_job.input_json == failed_job.input_json
    assert (
        db_session.query(GenerationJob)
        .filter(GenerationJob.course_id == created["id"], GenerationJob.job_type == JobType.URL_IMPORT)
        .count()
        == 2
    )
