def test_delete_course_removes_it_from_list(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    created = client.post(
        "/courses",
        json={"title": "课程", "source_type": "manual_text", "text": "第一句。"},
    ).json()

    response = client.delete(f"/courses/{created['id']}")

    assert response.status_code == 204
    assert client.get("/courses").json()["items"] == []
