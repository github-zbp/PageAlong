from datetime import datetime

from app.models.admin_content import Announcement, AnnouncementRoadmapStatus, AnnouncementStatus
from app.models.user import User, UserRole, UserStatus
from app.services.auth_security import hash_password
from app.services.auth_service import AuthService


def test_announcement_model_defaults(db_session):
    announcement = Announcement(
        title="文件导入优化",
        language="zh",
        body_markdown="正在开发文件导入体验。",
        body_html="<p>正在开发文件导入体验。</p>",
        display_position="dashboard",
    )
    db_session.add(announcement)
    db_session.commit()

    assert announcement.status == AnnouncementStatus.DRAFT
    assert announcement.roadmap_status == AnnouncementRoadmapStatus.PLANNED
    assert announcement.sort_order == 0
    assert announcement.is_pinned is False


def create_admin_token(db_session) -> str:
    admin = User(
        email="admin@example.com",
        password_hash=hash_password("abc12345"),
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(admin)
    db_session.flush()
    token = AuthService().create_session(db_session, user=admin, user_agent="pytest", ip_address="127.0.0.1").token
    db_session.commit()
    return token


def test_admin_announcement_crud_list_omits_body_and_dashboard_only_shows_published(client, db_session):
    token = create_admin_token(db_session)
    create_response = client.post(
        "/admin/announcements",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "文件导入优化",
            "language": "zh",
            "body_markdown": "正在开发 <script>alert(1)</script>",
            "roadmap_status": "in_progress",
            "display_position": "dashboard",
            "sort_order": 3,
            "is_pinned": True,
        },
    )
    assert create_response.status_code == 201
    announcement_id = create_response.json()["id"]

    list_response = client.get("/admin/announcements", headers={"Authorization": f"Bearer {token}"})
    item = list_response.json()["items"][0]
    assert item["title"] == "文件导入优化"
    assert "body_markdown" not in item
    assert "body_html" not in item

    assert client.get("/announcements/dashboard?lang=zh").json()["items"] == []
    publish_response = client.post(
        f"/admin/announcements/{announcement_id}/publish",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert publish_response.status_code == 200
    dashboard_response = client.get("/announcements/dashboard?lang=zh")
    assert dashboard_response.json()["items"][0]["title"] == "文件导入优化"


def test_admin_announcement_reorder(client, db_session):
    token = create_admin_token(db_session)
    first = client.post(
        "/admin/announcements",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "一", "language": "zh", "body_markdown": "正文", "sort_order": 1},
    ).json()
    second = client.post(
        "/admin/announcements",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "二", "language": "zh", "body_markdown": "正文", "sort_order": 2},
    ).json()

    response = client.post(
        "/admin/announcements/reorder",
        headers={"Authorization": f"Bearer {token}"},
        json={"items": [{"id": second["id"], "sort_order": 1}, {"id": first["id"], "sort_order": 2}]},
    )

    assert response.status_code == 204
