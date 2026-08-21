from app.cli.import_url import import_url_job


def test_import_url_job_returns_service_payload(monkeypatch):
    monkeypatch.setattr(
        "app.cli.import_url.UrlImportService",
        lambda db: type(
            "Service",
            (),
            {
                "run_import_job": lambda self, job_id: type(
                    "Result",
                    (),
                    {"course_id": "course_1", "job_id": job_id, "status": "pending"},
                )()
            },
        )(),
    )

    assert import_url_job("job_1") == {"course_id": "course_1", "job_id": "job_1", "status": "pending"}
