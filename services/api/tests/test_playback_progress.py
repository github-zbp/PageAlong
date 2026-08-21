def test_save_and_restore_playback_progress(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )
    created = client.post(
        "/courses",
        json={"title": "课程", "source_type": "manual_text", "text": "第一句。"},
    ).json()

    response = client.put(
        f"/courses/{created['id']}/progress",
        json={"position_seconds": 12, "sentence_index": 0},
    )

    assert response.status_code == 200
    assert response.json()["position_seconds"] == 12

    detail = client.get(f"/courses/{created['id']}")
    assert detail.json()["last_playback_position_seconds"] == 12
