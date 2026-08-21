def stub_audio_queue(monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )


def test_tag_crud_and_course_binding(client, monkeypatch):
    stub_audio_queue(monkeypatch)

    created_tag = client.post("/courses/tags", json={"name": "英语"})
    assert created_tag.status_code == 201
    tag = created_tag.json()
    assert tag["name"] == "英语"
    assert tag["color"]
    assert tag["usage_count"] == 0

    created_course = client.post(
        "/courses",
        json={
            "title": "标签课程",
            "source_type": "manual_text",
            "text": "第一句。",
            "tag_ids": [tag["id"]],
        },
    )
    assert created_course.status_code == 201
    course = created_course.json()
    assert course["tags"][0]["id"] == tag["id"]
    assert course["tags"][0]["name"] == "英语"

    tags_response = client.get("/courses/tags")
    assert tags_response.status_code == 200
    assert tags_response.json()["items"][0]["usage_count"] == 1

    deleted_tag = client.delete(f"/courses/tags/{tag['id']}")
    assert deleted_tag.status_code == 204
    assert client.get(f"/courses/{course['id']}").json()["tags"] == []
