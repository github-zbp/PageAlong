from datetime import datetime, timedelta

from app.api.deps import get_current_user
from app.main import app
from app.models.story_comment import StoryComment
from app.models.user import User, UserRole, UserStatus


def make_user() -> User:
    return User(
        id="story-comment-user",
        email="reader@example.com",
        password_hash="password-hash",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )


def test_story_comments_are_public_and_paginated(client, db_session):
    user = make_user()
    db_session.add(user)
    now = datetime.utcnow()
    db_session.add_all(
        [
            StoryComment(user_id=user.id, content="First comment", created_at=now - timedelta(minutes=2)),
            StoryComment(user_id=user.id, content="Latest comment", created_at=now),
        ]
    )
    db_session.commit()

    response = client.get("/story/comments", params={"page": 1, "page_size": 1})

    assert response.status_code == 200
    body = response.json()
    assert [item["content"] for item in body["items"]] == ["Latest comment"]
    assert body["pagination"] == {
        "page": 1,
        "page_size": 1,
        "total": 2,
        "total_pages": 2,
        "has_previous": False,
        "has_next": True,
    }
    assert body["items"][0]["author_email"] == "r***@example.com"


def test_story_comments_support_second_page(client, db_session):
    user = make_user()
    db_session.add(user)
    now = datetime.utcnow()
    db_session.add_all(
        [
            StoryComment(user_id=user.id, content="First comment", created_at=now - timedelta(minutes=3)),
            StoryComment(user_id=user.id, content="Second comment", created_at=now - timedelta(minutes=2)),
            StoryComment(user_id=user.id, content="Latest comment", created_at=now - timedelta(minutes=1)),
        ]
    )
    db_session.commit()

    response = client.get("/story/comments", params={"page": 2, "page_size": 1})

    assert response.status_code == 200
    body = response.json()
    assert [item["content"] for item in body["items"]] == ["Second comment"]
    assert body["pagination"]["page"] == 2
    assert body["pagination"]["has_previous"] is True


def test_story_comment_requires_auth(client):
    response = client.post("/story/comments", json={"content": "A public comment"})

    assert response.status_code == 401


def test_story_comment_is_created_for_authenticated_user(client, db_session):
    user = make_user()
    db_session.add(user)
    db_session.commit()
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = client.post("/story/comments", json={"content": "  A thoughtful note  "})
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 201
    assert response.json()["content"] == "A thoughtful note"
    assert response.json()["author_email"] == "r***@example.com"
    assert db_session.query(StoryComment).count() == 1


def test_story_comment_is_limited_to_300_characters(client):
    user = make_user()
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = client.post("/story/comments", json={"content": "a" * 301})
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 422


def test_story_comment_is_rate_limited_after_five_posts(client, db_session):
    user = make_user()
    db_session.add(user)
    db_session.commit()
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        for index in range(5):
            response = client.post("/story/comments", json={"content": f"Comment {index + 1}"})
            assert response.status_code == 201

        response = client.post("/story/comments", json={"content": "Comment 6"})
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 429
    assert response.json() == {"detail": "Too many requests"}
