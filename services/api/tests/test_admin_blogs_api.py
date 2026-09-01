from datetime import datetime

from app.models.admin_content import BlogPost, BlogPostStatus
from app.models.user import User, UserRole, UserStatus
from app.services.auth_security import hash_password
from app.services.admin_content_service import render_markdown_to_safe_html
from app.services.auth_service import AuthService


def test_blog_model_defaults_and_html_sanitizer(db_session):
    html = render_markdown_to_safe_html("# 标题\n\n<script>alert(1)</script>\n\n<a href=\"javascript:alert(1)\">bad</a>")

    assert "<h1" in html
    assert "<script" not in html
    assert "javascript:" not in html

    post = BlogPost(
        title="后台规划",
        slug="reader-admin",
        language="zh",
        body_markdown="# 正文",
        body_html="<h1>正文</h1>",
        author_user_id="admin_1",
    )
    db_session.add(post)
    db_session.commit()

    assert post.status == BlogPostStatus.DRAFT
    assert post.deleted_at is None


def create_admin(db_session):
    user = User(
        email="admin@example.com",
        password_hash=hash_password("abc12345"),
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
        email_verified_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.flush()
    token = AuthService().create_session(db_session, user=user, user_agent="pytest", ip_address="127.0.0.1").token
    db_session.commit()
    return user, token


def test_admin_blog_crud_list_omits_body_and_public_only_shows_published(client, db_session):
    _admin, token = create_admin(db_session)

    create_response = client.post(
        "/admin/blogs",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "后台规划",
            "slug": "reader-admin",
            "language": "zh",
            "summary": "后台模块规划",
            "cover_image_url": "https://media.pagealong.test/blog-cover.jpg",
            "body_markdown": "# 后台规划\n\n正文 <script>alert(1)</script>",
            "seo_title": "后台规划",
            "seo_description": "后台模块规划",
        },
    )
    assert create_response.status_code == 201
    post_id = create_response.json()["id"]

    list_response = client.get("/admin/blogs", headers={"Authorization": f"Bearer {token}"})
    assert list_response.status_code == 200
    item = list_response.json()["items"][0]
    assert item["title"] == "后台规划"
    assert item["cover_image_url"] == "https://media.pagealong.test/blog-cover.jpg"
    assert "body_markdown" not in item
    assert "body_html" not in item

    detail_response = client.get(f"/admin/blogs/{post_id}", headers={"Authorization": f"Bearer {token}"})
    assert detail_response.status_code == 200
    assert "<script" not in detail_response.json()["body_html"]

    assert client.get("/blogs?lang=zh").json()["items"] == []

    publish_response = client.post(f"/admin/blogs/{post_id}/publish", headers={"Authorization": f"Bearer {token}"})
    assert publish_response.status_code == 200
    public_response = client.get("/blogs?lang=zh")
    public_item = public_response.json()["items"][0]
    assert public_item["slug"] == "reader-admin"
    assert public_item["cover_image_url"] == "https://media.pagealong.test/blog-cover.jpg"


def test_admin_blog_bulk_offline_and_soft_delete(client, db_session):
    _admin, token = create_admin(db_session)
    first = client.post(
        "/admin/blogs",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "一", "slug": "one", "language": "zh", "body_markdown": "正文"},
    ).json()
    second = client.post(
        "/admin/blogs",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "二", "slug": "two", "language": "zh", "body_markdown": "正文"},
    ).json()

    bulk_response = client.post(
        "/admin/blogs/bulk",
        headers={"Authorization": f"Bearer {token}"},
        json={"ids": [first["id"], second["id"]], "action": "delete"},
    )

    assert bulk_response.status_code == 200
    assert bulk_response.json()["updated_count"] == 2
    assert client.get("/admin/blogs", headers={"Authorization": f"Bearer {token}"}).json()["items"] == []
