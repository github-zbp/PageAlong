from __future__ import annotations

from datetime import datetime

from app.models.course import ArticleText, Course, CourseStatus, SourceType
from app.models.file_resource import FileResource, ResourceKind, ResourceStatus, ResourceVariant
from app.models.user import User, UserRole, UserStatus
from app.services.auth_security import hash_password
from app.services.auth_service import AuthService


def create_user(db_session, *, email: str, role: UserRole = UserRole.USER):
    user = User(
        email=email,
        password_hash=hash_password("abc12345"),
        role=role,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.flush()
    return user


def token_for(db_session, user: User) -> str:
    token = AuthService().create_session(db_session, user=user, user_agent="pytest", ip_address="127.0.0.1").token
    db_session.commit()
    return token


def create_course(db_session, *, user_id: str, title: str) -> Course:
    course = Course(user_id=user_id, title=title, source_type=SourceType.MANUAL_TEXT, status=CourseStatus.READY)
    db_session.add(course)
    db_session.flush()
    db_session.add(ArticleText(course_id=course.id, version=1, text="正文", content_markdown="正文"))
    db_session.add(
        FileResource(
            user_id=user_id,
            owner_type="course",
            owner_id=course.id,
            resource_kind=ResourceKind.EXPORT,
            resource_variant=ResourceVariant.PDF,
            status=ResourceStatus.READY,
            title=title,
            filename=f"{title}.pdf",
            object_path="/tmp/course.pdf",
            content_type="application/pdf",
        )
    )
    db_session.commit()
    return course


def test_admin_course_list_searches_title_and_email_without_body(client, db_session):
    admin = create_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    reader = create_user(db_session, email="reader@example.com")
    create_course(db_session, user_id=reader.id, title="英语阅读")
    token = token_for(db_session, admin)

    response = client.get(
        "/admin/courses?query=英语&email=reader&page=1&page_size=20",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["title"] == "英语阅读"
    assert body["items"][0]["user_email"] == "reader@example.com"
    assert body["items"][0]["resource_counts"]["pdf"] == 1
    assert "content_markdown" not in body["items"][0]
    assert body["pagination"]["total"] == 1


def test_admin_course_detail_returns_body_and_delete_soft_deletes(client, db_session):
    admin = create_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    reader = create_user(db_session, email="reader@example.com")
    course = create_course(db_session, user_id=reader.id, title="英语阅读")
    token = token_for(db_session, admin)

    detail = client.get(f"/admin/courses/{course.id}", headers={"Authorization": f"Bearer {token}"})
    assert detail.status_code == 200
    assert detail.json()["content_markdown"] == "正文"

    delete_response = client.delete(f"/admin/courses/{course.id}", headers={"Authorization": f"Bearer {token}"})
    assert delete_response.status_code == 204
    db_session.refresh(course)
    assert course.is_deleted is True
