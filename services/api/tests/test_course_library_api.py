from app.models.course import Course


def stub_audio_queue(monkeypatch):
    monkeypatch.setattr(
        "app.services.course_service.enqueue_audio_generation",
        lambda course_id, job_id: "test-job-id",
    )


def create_text_course(client, title: str, **overrides):
    payload = {
        "title": title,
        "source_type": "manual_text",
        "text": "第一句。第二句。",
    }
    payload.update(overrides)
    response = client.post("/courses", json=payload)
    assert response.status_code == 201
    return response.json()


def test_fragmented_courses_and_series_are_listed_separately(client, monkeypatch):
    stub_audio_queue(monkeypatch)
    create_text_course(client, "通勤碎片", tags=["通勤"], is_starred=True)
    create_text_course(client, "英语第一课", series_title="英语精听", tags=["英语"], is_starred=True)

    fragmented_response = client.get("/courses", params={"library_type": "fragmented"})
    series_response = client.get("/courses/series")

    assert fragmented_response.status_code == 200
    assert [item["title"] for item in fragmented_response.json()["items"]] == ["通勤碎片"]
    assert fragmented_response.json()["items"][0]["library_type"] == "fragmented"
    assert [tag["name"] for tag in fragmented_response.json()["items"][0]["tags"]] == ["通勤"]
    assert fragmented_response.json()["items"][0]["is_starred"] is True

    assert series_response.status_code == 200
    assert series_response.json()["items"] == [
        {
            "id": series_response.json()["items"][0]["id"],
            "title": "英语精听",
            "article_count": 1,
            "tags": ["英语"],
            "is_starred": True,
            "updated_at": series_response.json()["items"][0]["updated_at"],
            "last_read_at": None,
            "last_read_course_id": None,
            "latest_course_id": series_response.json()["items"][0]["latest_course_id"],
        }
    ]


def test_library_filters_by_query_tag_and_starred(client, monkeypatch):
    stub_audio_queue(monkeypatch)
    create_text_course(client, "通勤碎片", tags=["通勤"], is_starred=True)
    create_text_course(client, "会议复盘", tags=["工作"])
    create_text_course(client, "英语第一课", series_title="英语精听", tags=["英语"], is_starred=True)
    create_text_course(client, "Python 第一课", series_title="编程入门", tags=["编程"])

    fragment_query = client.get(
        "/courses",
        params={"library_type": "fragmented", "query": "通勤", "tag": "通勤", "starred": "true"},
    )
    series_query = client.get("/courses/series", params={"query": "Python", "tag": "编程"})

    assert [item["title"] for item in fragment_query.json()["items"]] == ["通勤碎片"]
    assert [item["title"] for item in series_query.json()["items"]] == ["编程入门"]


def test_library_list_paginates_filtered_results(client, monkeypatch):
    stub_audio_queue(monkeypatch)
    create_text_course(client, "课程 A", tags=["A"])
    create_text_course(client, "课程 B", tags=["B"])
    create_text_course(client, "课程 C", tags=["C"])

    response = client.get(
        "/courses",
        params={"library_type": "fragmented", "query": "课程", "page": 2, "page_size": 1},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["pagination"] == {
        "page": 2,
        "page_size": 1,
        "total": 3,
        "total_pages": 3,
        "has_previous": True,
        "has_next": True,
    }
    assert [item["title"] for item in body["items"]] == ["课程 B"]


def test_series_list_returns_paginated_metadata_and_validates_page_arguments(client, monkeypatch):
    stub_audio_queue(monkeypatch)
    create_text_course(client, "系列 A-1", series_title="系列 A")
    create_text_course(client, "系列 A-2", series_title="系列 A")
    create_text_course(client, "系列 B-1", series_title="系列 B")

    response = client.get("/courses/series", params={"query": "系列", "page": 1, "page_size": 2})
    invalid_page = client.get("/courses/series", params={"page": 0})

    assert response.status_code == 200
    body = response.json()
    assert body["pagination"] == {
        "page": 1,
        "page_size": 2,
        "total": 2,
        "total_pages": 1,
        "has_previous": False,
        "has_next": False,
    }
    assert [item["title"] for item in body["items"]] == ["系列 B", "系列 A"]
    assert invalid_page.status_code == 422


def test_course_can_move_between_fragmented_and_series(client, db_session, monkeypatch):
    stub_audio_queue(monkeypatch)
    created = create_text_course(client, "待整理课程")

    move_to_series = client.patch(
        f"/courses/{created['id']}/library",
        json={
            "library_type": "series",
            "series_title": "阅读训练",
            "tags": ["阅读"],
            "is_starred": True,
        },
    )

    assert move_to_series.status_code == 200
    body = move_to_series.json()
    assert body["library_type"] == "series"
    assert body["series_title"] == "阅读训练"
    assert [tag["name"] for tag in body["tags"]] == ["阅读"]
    assert body["is_starred"] is True
    assert client.get("/courses", params={"library_type": "fragmented"}).json()["items"] == []

    move_to_fragmented = client.patch(
        f"/courses/{created['id']}/library",
        json={"library_type": "fragmented", "tags": ["单篇"], "is_starred": False},
    )

    assert move_to_fragmented.status_code == 200
    assert move_to_fragmented.json()["library_type"] == "fragmented"
    assert move_to_fragmented.json()["series_id"] is None
    assert [tag["name"] for tag in move_to_fragmented.json()["tags"]] == ["单篇"]
    db_session.expire_all()
    course = db_session.get(Course, created["id"])
    assert course.series_id is None


def test_series_can_be_created_listed_read_and_deleted_only_when_empty(client, monkeypatch):
    stub_audio_queue(monkeypatch)

    created_series = client.post("/courses/series", json={"title": "英语精听"})
    assert created_series.status_code == 201
    series = created_series.json()
    assert series["title"] == "英语精听"
    assert series["article_count"] == 0
    assert series["last_read_course_id"] is None

    first = create_text_course(client, "第一课", series_id=series["id"])
    second = create_text_course(client, "第二课", series_id=series["id"])
    response = client.put(
        f"/courses/{second['id']}/progress",
        json={"position_seconds": 18, "sentence_index": 1},
    )
    assert response.status_code == 200

    detail = client.get(f"/courses/series/{series['id']}").json()
    assert detail["article_count"] == 2
    assert detail["last_read_course_id"] == second["id"]
    assert detail["latest_course_id"] in {first["id"], second["id"]}

    delete_blocked = client.delete(f"/courses/series/{series['id']}")
    assert delete_blocked.status_code == 409

    emptied = client.post(f"/courses/series/{series['id']}/move-to-fragments")
    assert emptied.status_code == 200
    assert emptied.json()["moved_count"] == 2
    assert client.get("/courses/series").json()["items"][0]["article_count"] == 0


def test_created_series_persists_across_fresh_requests(monkeypatch):
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from app.api.deps import get_current_user_id
    from app.db.base import Base
    from app.db.session import get_db
    from app.main import app as fastapi_app
    import app.models as _models  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    fastapi_app.dependency_overrides[get_current_user_id] = lambda: "test_user"
    try:
        with TestClient(fastapi_app) as test_client:
            created = test_client.post("/courses/series", json={"title": "英语精听"})
            assert created.status_code == 201

            listed = test_client.get("/courses/series")
            assert [item["title"] for item in listed.json()["items"]] == ["英语精听"]
    finally:
        fastapi_app.dependency_overrides.clear()


def test_series_metadata_can_update_and_move_articles_to_fragments(client, monkeypatch):
    stub_audio_queue(monkeypatch)
    first = create_text_course(client, "第一课", series_title="产品课")
    create_text_course(client, "第二课", series_id=first["series_id"])

    updated = client.patch(
        f"/courses/series/{first['series_id']}",
        json={"title": "产品训练营", "tags": ["产品", "方法"], "is_starred": True},
    )

    assert updated.status_code == 200
    assert updated.json()["title"] == "产品训练营"
    assert updated.json()["article_count"] == 2
    assert updated.json()["tags"] == ["产品", "方法"]
    assert updated.json()["is_starred"] is True

    moved = client.post(f"/courses/series/{first['series_id']}/move-to-fragments")

    assert moved.status_code == 200
    assert moved.json()["moved_count"] == 2
    assert client.get("/courses/series").json()["items"][0]["article_count"] == 0
    fragments = client.get("/courses", params={"library_type": "fragmented"}).json()["items"]
    assert {item["title"] for item in fragments} == {"第一课", "第二课"}
    assert all([tag["name"] for tag in item["tags"]] == ["产品", "方法"] for item in fragments)


def test_importing_with_existing_series_title_appends_to_same_series(client, monkeypatch):
    stub_audio_queue(monkeypatch)
    first = create_text_course(client, "第一课", series_title="英语精听", tags=["英语"], is_starred=True)
    second = create_text_course(client, "第二课", series_title="英语精听")

    series_response = client.get("/courses/series")
    detail_response = client.get(f"/courses/series/{first['series_id']}")

    assert second["series_id"] == first["series_id"]
    assert series_response.json()["items"][0]["article_count"] == 2
    assert series_response.json()["items"][0]["tags"] == ["英语"]
    assert series_response.json()["items"][0]["is_starred"] is True
    assert {course["title"] for course in detail_response.json()["courses"]} == {"第一课", "第二课"}


def test_progress_updates_course_and_series_last_read_at(client, monkeypatch):
    stub_audio_queue(monkeypatch)
    course = create_text_course(client, "英语第一课", series_title="英语精听")

    response = client.put(
        f"/courses/{course['id']}/progress",
        json={"position_seconds": 18, "sentence_index": 1},
    )

    assert response.status_code == 200
    detail = client.get(f"/courses/{course['id']}").json()
    series = client.get("/courses/series").json()["items"][0]
    assert detail["last_read_at"] is not None
    assert series["last_read_at"] == detail["last_read_at"]


def test_tag_list_returns_unique_course_and_series_tags(client, monkeypatch):
    stub_audio_queue(monkeypatch)
    create_text_course(client, "通勤碎片", tags=["通勤", "复盘"])
    create_text_course(client, "英语第一课", series_title="英语精听", tags=["英语", "复盘"])

    response = client.get("/courses/tags")

    assert response.status_code == 200
    assert [item["name"] for item in response.json()["items"]] == ["复盘", "英语", "通勤"]
