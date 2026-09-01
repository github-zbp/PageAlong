from datetime import datetime
from urllib.parse import parse_qs, urlparse

import pytest

from app.models.course import ArticleText, Course, CourseStatus, SourceType
from app.models.file_resource import FileResource, ResourceKind, ResourceStatus, ResourceVariant
from app.models.generation_job import GenerationJob
from app.models.generation_job import JobStatus, JobType


def create_exportable_course(db_session):
    course = Course(
        user_id="test_user",
        title="可下载课程",
        source_type=SourceType.URL_IMPORT,
        status=CourseStatus.NEEDS_REVIEW,
    )
    db_session.add(course)
    db_session.flush()
    article_text = ArticleText(
        course_id=course.id,
        version=1,
        text="可下载课程\n\n第一句。第二句。",
        content_markdown="# 可下载课程\n\n第一句。第二句。",
    )
    db_session.add(article_text)
    db_session.commit()
    return course, article_text


def test_jobs_api_lists_resource_jobs_and_job_detail(client, db_session, monkeypatch):
    course, _ = create_exportable_course(db_session)
    monkeypatch.setattr(
        "app.services.job_service.enqueue_generation_job",
        lambda job_id: "queued-job-id",
    )

    first_queued = client.post(f"/courses/{course.id}/downloads/markdown")
    second_queued = client.post(f"/courses/{course.id}/downloads/pdf")
    assert first_queued.status_code == 202
    assert second_queued.status_code == 202
    first_job_id = first_queued.json()["job_id"]
    second_job_id = second_queued.json()["job_id"]

    list_response = client.get("/jobs", params={"scope": "resource", "page": 1, "page_size": 1})
    second_page_response = client.get("/jobs", params={"scope": "resource", "page": 2, "page_size": 1})
    assert list_response.status_code == 200
    assert list_response.json()["pagination"] == {
        "page": 1,
        "page_size": 1,
        "total": 2,
        "total_pages": 2,
        "has_previous": False,
        "has_next": True,
    }
    items = list_response.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == second_job_id
    assert items[0]["job_type"] == "course_export_pdf"
    assert items[0]["target_label"] == course.title
    assert items[0]["download_url"] is None
    assert second_page_response.status_code == 200
    assert second_page_response.json()["pagination"]["page"] == 2
    assert second_page_response.json()["items"][0]["id"] == first_job_id

    detail_response = client.get(f"/jobs/{first_job_id}")
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == first_job_id
    assert detail_response.json()["target_type"] == "course"
    assert detail_response.json()["target_id"] == course.id

    job = db_session.query(GenerationJob).filter(GenerationJob.id == first_job_id).one()
    assert job.course_id == course.id


@pytest.mark.parametrize(
    ("job_type", "resource_kind", "resource_variant", "filename", "content_type", "object_path", "expected_path"),
    [
        (
            JobType.COURSE_EXPORT_PDF,
            ResourceKind.EXPORT,
            ResourceVariant.PDF,
            "ready.pdf",
            "application/pdf",
            "https://media.pagealong.test/downloads/ready.pdf",
            "/courses/{course_id}/resources/{resource_id}/download",
        ),
        (
            JobType.TTS_GENERATE,
            ResourceKind.AUDIO,
            ResourceVariant.AUDIO,
            "ready.mp3",
            "audio/mpeg",
            "https://media.pagealong.test/audio/ready.mp3",
            "/courses/{course_id}/resources/{resource_id}/download",
        ),
    ],
)
def test_jobs_api_serializes_download_url_for_completed_resource_jobs(
    client,
    db_session,
    job_type,
    resource_kind,
    resource_variant,
    filename,
    content_type,
    object_path,
    expected_path,
):
    course, _ = create_exportable_course(db_session)
    resource = FileResource(
        user_id=course.user_id,
        owner_type="course",
        owner_id=course.id,
        resource_kind=resource_kind,
        resource_variant=resource_variant,
        status=ResourceStatus.READY,
        title=course.title,
        filename=filename,
        storage_backend="local",
        object_path=object_path,
        content_type=content_type,
        byte_size=12,
        checksum_sha256="a" * 64,
        metadata_json="{}",
    )
    db_session.add(resource)
    db_session.flush()
    job = GenerationJob(
        course_id=course.id,
        job_type=job_type,
        status=JobStatus.SUCCEEDED,
        result_resource_id=resource.id,
        created_at=datetime.utcnow(),
        finished_at=datetime.utcnow(),
    )
    db_session.add(job)
    db_session.commit()

    expected_download_url = object_path

    list_response = client.get("/jobs", params={"scope": "resource"})
    assert list_response.status_code == 200
    assert list_response.json()["items"][0]["id"] == job.id
    download_url = list_response.json()["items"][0]["download_url"]
    parsed = urlparse(download_url)
    assert f"{parsed.scheme}://{parsed.netloc}{parsed.path}" == expected_download_url
    query = parse_qs(parsed.query)
    assert query["response-content-disposition"][0].startswith("attachment;")
    assert query["response-content-type"][0] == content_type

    detail_response = client.get(f"/jobs/{job.id}")
    assert detail_response.status_code == 200
    detail_url = detail_response.json()["download_url"]
    parsed = urlparse(detail_url)
    assert f"{parsed.scheme}://{parsed.netloc}{parsed.path}" == expected_download_url
    query = parse_qs(parsed.query)
    assert query["response-content-disposition"][0].startswith("attachment;")
    assert query["response-content-type"][0] == content_type


def test_jobs_api_rejects_invalid_page_arguments(client, db_session, monkeypatch):
    course, _ = create_exportable_course(db_session)
    monkeypatch.setattr(
        "app.services.job_service.enqueue_generation_job",
        lambda job_id: "queued-job-id",
    )
    client.post(f"/courses/{course.id}/downloads/markdown")

    invalid_page = client.get("/jobs", params={"scope": "resource", "page": 0})
    invalid_page_size = client.get("/jobs", params={"scope": "resource", "page_size": 101})

    assert invalid_page.status_code == 422
    assert invalid_page_size.status_code == 422
