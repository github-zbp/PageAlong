from app.models.course import ArticleText, Course, CourseStatus, SourceType
from app.models.generation_job import GenerationJob, JobStatus, JobType
from app.services.course_service import request_audio_generation
from app.services.url_import_service import ExtensionImageInput, ExtensionSyncInput, ImportUrlInput, UrlImportService
from app.services.web_extraction import ExtractionError
import json


def test_url_import_service_persists_markdown_text_sentences_and_waits_for_confirmation(db_session, monkeypatch):
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
                "extractor": "trafilatura",
                "normalized": type(
                    "Normalized",
                    (),
                {
                    "content_markdown": "# 网页标题\n\n第一句。第二句。",
                    "tts_text": "网页标题\n\n第一句。第二句。",
                    "content_hash": "hash_1",
                },
            )(),
            "source_metadata": {"source_kind": "url", "locator": original_url, "final_url": final_url},
            "extraction_metadata": {"extractor": "trafilatura"},
        },
    )(),
    )

    course, job = UrlImportService(db_session).create_import_course(
        "user_1",
        ImportUrlInput(url="https://example.com/a"),
    )
    UrlImportService(db_session).run_import_job(job.id)

    db_session.expire_all()
    course = db_session.get(Course, course.id)
    article_text = db_session.query(ArticleText).filter(ArticleText.course_id == course.id).one()
    import_job = db_session.get(GenerationJob, job.id)

    assert course.source_type == SourceType.URL_IMPORT
    assert course.status == CourseStatus.NEEDS_REVIEW
    assert article_text.content_markdown.startswith("# 网页标题")
    assert article_text.text.startswith("网页标题")
    assert article_text.confirmed_by_user is False
    assert import_job.status == JobStatus.SUCCEEDED
    assert (
        db_session.query(GenerationJob)
        .filter(GenerationJob.course_id == course.id, GenerationJob.job_type == JobType.TTS_GENERATE)
        .count()
        == 0
    )


def test_url_import_service_rewrites_article_images_and_records_counts(db_session, monkeypatch):
    monkeypatch.setattr(
        "app.services.url_import_service.fetch_public_html",
        lambda url: type(
            "Fetch",
            (),
            {
                "original_url": url,
                "final_url": "https://example.com/articles/a",
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
                "extractor": "trafilatura",
                "normalized": type(
                    "Normalized",
                    (),
                    {
                        "content_markdown": "# 网页标题\n\n![配图](/hero.png)\n\n第一句。",
                        "tts_text": "网页标题\n\n第一句。",
                        "content_hash": "hash_1",
                    },
                )(),
                "source_metadata": {"source_kind": "url", "locator": original_url, "final_url": final_url},
                "extraction_metadata": {"extractor": "trafilatura"},
            },
        )(),
    )
    calls = []

    def fake_import_article_images(db, *, course, article_text, markdown, base_url):
        calls.append(
            {
                "course_id": course.id,
                "article_text_id": article_text.id,
                "markdown": markdown,
                "base_url": base_url,
            }
        )
        rewritten = "# 网页标题\n\n![配图](https://media.pagealong.test/articles/course/image.png)\n\n第一句。"
        article_text.content_markdown = rewritten
        return type(
            "ImageResult",
            (),
            {
                "rewritten_markdown": rewritten,
                "imported_count": 1,
                "failed_count": 0,
                "skipped_count": 0,
            },
        )()

    monkeypatch.setattr("app.services.url_import_service.import_article_images", fake_import_article_images, raising=False)

    course, job = UrlImportService(db_session).create_import_course(
        "user_1",
        ImportUrlInput(url="https://example.com/a"),
    )
    UrlImportService(db_session).run_import_job(job.id)

    db_session.expire_all()
    article_text = db_session.query(ArticleText).filter(ArticleText.course_id == course.id).one()
    metadata = json.loads(article_text.extraction_metadata_json)

    assert calls[0]["base_url"] == "https://example.com/articles/a"
    assert calls[0]["markdown"] == "# 网页标题\n\n![配图](/hero.png)\n\n第一句。"
    assert "https://media.pagealong.test/articles/course/image.png" in article_text.content_markdown
    assert metadata["images"] == {"imported": 1, "failed": 0, "skipped": 0}


def test_url_import_service_skips_already_succeeded_job(db_session, monkeypatch):
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
                        "content_markdown": "第一句。",
                        "tts_text": "第一句。",
                        "content_hash": "hash_1",
                    },
                )(),
                "source_metadata": {"source_kind": "url", "locator": original_url, "final_url": final_url},
                "extraction_metadata": {},
            },
        )(),
    )
    course, job = UrlImportService(db_session).create_import_course("user_1", ImportUrlInput(url="https://example.com/a"))
    UrlImportService(db_session).run_import_job(job.id)
    UrlImportService(db_session).run_import_job(job.id)

    article_count = db_session.query(ArticleText).filter(ArticleText.course_id == course.id).count()
    audio_count = (
        db_session.query(GenerationJob)
        .filter(GenerationJob.course_id == course.id, GenerationJob.job_type == JobType.TTS_GENERATE)
        .count()
    )
    assert article_count == 1
    assert audio_count == 0


def test_request_audio_generation_confirms_latest_url_import_article_text(db_session, monkeypatch):
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
                        "content_markdown": "第一句。",
                        "tts_text": "第一句。",
                        "content_hash": "hash_1",
                    },
                )(),
                "source_metadata": {"source_kind": "url", "locator": original_url, "final_url": final_url},
                "extraction_metadata": {},
            },
        )(),
    )
    enqueued = {}
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: enqueued.update({"course_id": course_id, "job_id": job_id}) or "celery-audio-id",
    )

    course, job = UrlImportService(db_session).create_import_course("user_1", ImportUrlInput(url="https://example.com/a"))
    UrlImportService(db_session).run_import_job(job.id)
    db_session.expire_all()
    course = db_session.get(Course, course.id)

    audio_job = request_audio_generation(db_session, course)

    db_session.expire_all()
    article_text = db_session.query(ArticleText).filter(ArticleText.course_id == course.id).one()
    course = db_session.get(Course, course.id)

    assert article_text.confirmed_by_user is True
    assert course.status == CourseStatus.AUDIO_GENERATING
    assert audio_job.status == JobStatus.PENDING
    assert enqueued["course_id"] == course.id


def test_url_import_service_marks_unexpected_errors_as_failed(db_session, monkeypatch):
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

    def explode(*_args, **_kwargs):
        raise RuntimeError("parser crashed")

    monkeypatch.setattr("app.services.url_import_service.extract_article_content", explode)

    course, job = UrlImportService(db_session).create_import_course("user_1", ImportUrlInput(url="https://example.com/a"))

    try:
        UrlImportService(db_session).run_import_job(job.id)
    except RuntimeError:
        pass

    db_session.expire_all()
    course = db_session.get(Course, course.id)
    job = db_session.get(GenerationJob, job.id)
    assert course.status == CourseStatus.FAILED
    assert job.status == JobStatus.FAILED
    assert job.error_code == "url_import_failed"


def test_extension_sync_uses_browser_payload_and_auto_requests_audio(db_session, monkeypatch):
    enqueued = {}
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: enqueued.update({"course_id": course_id, "job_id": job_id}) or "celery-audio-id",
    )
    monkeypatch.setattr(
        "app.services.url_import_service.fetch_public_html",
        lambda url: (_ for _ in ()).throw(AssertionError("backend fetch should not run for usable extension payload")),
    )
    monkeypatch.setattr(
        "app.services.url_import_service.extract_extension_article_content",
        lambda *, article_html, text_excerpt, title, original_url, final_url, client_metadata: type(
            "Extracted",
            (),
            {
                "title": "插件标题",
                "extractor": "extension_payload",
                "normalized": type(
                    "Normalized",
                    (),
                    {
                        "content_markdown": "# 插件标题\n\n第一段正文内容足够长，用来验证插件同步。\n\n第二段正文继续补充内容。",
                        "tts_text": "插件标题\n\n第一段正文内容足够长，用来验证插件同步。\n\n第二段正文继续补充内容。",
                        "content_hash": "hash_browser",
                    },
                )(),
                "source_metadata": {"source_kind": "url", "locator": original_url, "final_url": final_url},
                "extraction_metadata": {"extractor": "extension_payload"},
            },
        )(),
    )

    course, job = UrlImportService(db_session).create_extension_sync_course(
        "user_1",
        ExtensionSyncInput(
            url="https://example.com/a",
            title="插件标题",
            article_html="<article><h1>插件标题</h1><p>第一段正文内容足够长，用来验证插件同步。</p><p>第二段正文继续补充内容。</p></article>",
            text_excerpt="第一段正文内容足够长，用来验证插件同步。第二段正文继续补充内容。",
            images=[],
            client_metadata={"extension_version": "0.1.0", "extractor_version": "browser-v1"},
        ),
    )

    UrlImportService(db_session).run_import_job(job.id)

    db_session.expire_all()
    course = db_session.get(Course, course.id)
    article_text = db_session.query(ArticleText).filter(ArticleText.course_id == course.id).one()
    import_job = db_session.get(GenerationJob, job.id)
    audio_job = (
        db_session.query(GenerationJob)
        .filter(GenerationJob.course_id == course.id, GenerationJob.job_type == JobType.TTS_GENERATE)
        .one()
    )

    assert course.status == CourseStatus.AUDIO_GENERATING
    assert article_text.confirmed_by_user is True
    assert "插件标题" in article_text.content_markdown
    assert import_job.status == JobStatus.SUCCEEDED
    assert audio_job.status == JobStatus.PENDING
    assert enqueued["course_id"] == course.id


def test_extension_sync_rewrites_article_images_and_records_counts(db_session, monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "celery-audio-id",
    )
    monkeypatch.setattr(
        "app.services.url_import_service.fetch_public_html",
        lambda url: (_ for _ in ()).throw(AssertionError("backend fetch should not run for usable extension payload")),
    )
    monkeypatch.setattr(
        "app.services.url_import_service.extract_extension_article_content",
        lambda *, article_html, text_excerpt, title, original_url, final_url, client_metadata: type(
            "Extracted",
            (),
            {
                "title": "插件标题",
                "extractor": "extension_payload",
                "normalized": type(
                    "Normalized",
                    (),
                    {
                        "content_markdown": "# 插件标题\n\n![配图](/hero.png)\n\n第一段正文内容足够长，用来验证插件同步。",
                        "tts_text": "插件标题\n\n第一段正文内容足够长，用来验证插件同步。",
                        "content_hash": "hash_browser",
                    },
                )(),
                "source_metadata": {"source_kind": "url", "locator": original_url, "final_url": final_url},
                "extraction_metadata": {"extractor": "extension_payload"},
            },
        )(),
    )
    calls = []

    def fake_import_article_images(db, *, course, article_text, markdown, base_url):
        calls.append({"course_id": course.id, "article_text_id": article_text.id, "markdown": markdown, "base_url": base_url})
        rewritten = "# 插件标题\n\n![配图](https://media.pagealong.test/articles/course/image.png)\n\n第一段正文内容足够长，用来验证插件同步。"
        article_text.content_markdown = rewritten
        return type(
            "ImageResult",
            (),
            {
                "rewritten_markdown": rewritten,
                "imported_count": 1,
                "failed_count": 0,
                "skipped_count": 0,
            },
        )()

    monkeypatch.setattr("app.services.url_import_service.import_article_images", fake_import_article_images, raising=False)

    course, job = UrlImportService(db_session).create_extension_sync_course(
        "user_1",
        ExtensionSyncInput(
            url="https://example.com/a",
            title="插件标题",
            article_html="<article><h1>插件标题</h1><img src=\"/hero.png\" alt=\"配图\" /><p>第一段正文内容足够长，用来验证插件同步。</p></article>",
            text_excerpt="第一段正文内容足够长，用来验证插件同步。",
            images=[ExtensionImageInput(url="https://example.com/hero.png", alt="配图", width=800, height=400)],
            client_metadata={"extension_version": "0.1.0", "extractor_version": "browser-v1"},
        ),
    )

    UrlImportService(db_session).run_import_job(job.id)

    db_session.expire_all()
    article_text = db_session.query(ArticleText).filter(ArticleText.course_id == course.id).one()
    metadata = json.loads(article_text.extraction_metadata_json)

    assert calls[0]["base_url"] == "https://example.com/a"
    assert "https://media.pagealong.test/articles/course/image.png" in article_text.content_markdown
    assert metadata["images"] == {"imported": 1, "failed": 0, "skipped": 0}


def test_extension_sync_falls_back_to_backend_fetch_when_payload_is_low_quality(db_session, monkeypatch):
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
                "title": "后端标题",
                "extractor": "trafilatura",
                "normalized": type(
                    "Normalized",
                    (),
                    {
                        "content_markdown": "# 后端标题\n\n后端抽取正文第一句。后端抽取正文第二句。",
                        "tts_text": "后端标题\n\n后端抽取正文第一句。后端抽取正文第二句。",
                        "content_hash": "hash_backend",
                    },
                )(),
                "source_metadata": {"source_kind": "url", "locator": original_url, "final_url": final_url},
                "extraction_metadata": {"extractor": "trafilatura"},
            },
        )(),
    )

    course, job = UrlImportService(db_session).create_extension_sync_course(
        "user_1",
        ExtensionSyncInput(
            url="https://example.com/a",
            title="低质量",
            article_html="<nav>首页 登录</nav>",
            text_excerpt="首页 登录",
            images=[],
            client_metadata={"extension_version": "0.1.0"},
        ),
    )

    UrlImportService(db_session).run_import_job(job.id)

    db_session.expire_all()
    article_text = db_session.query(ArticleText).filter(ArticleText.course_id == course.id).one()
    metadata = json.loads(article_text.extraction_metadata_json)

    assert "后端标题" in article_text.content_markdown
    assert metadata["fallback_from_extension_payload"] is True
