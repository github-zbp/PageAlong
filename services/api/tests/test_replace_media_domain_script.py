from __future__ import annotations

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.models.admin_content import BlogPost, BlogPostStatus
from app.models.course import ArticleText, Course, SourceType
from app.models.file_resource import FileResource, ResourceKind, ResourceVariant
from app.models.user import User, UserRole, UserStatus
from app.services.auth_security import hash_password
from scripts import replace_media_domain


def test_replace_media_domain_updates_only_targeted_columns(db_session):
    user = User(
        email="writer@example.com",
        password_hash=hash_password("abc12345"),
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
    )
    db_session.add(user)
    db_session.flush()

    course = Course(user_id=user.id, title="测试课程", source_type=SourceType.MANUAL_TEXT)
    db_session.add(course)
    db_session.flush()

    article_text = ArticleText(
        course_id=course.id,
        text="raw text with https://media.zbpblog.cn/raw/keep-me.txt",
        content_markdown="![img](https://media.zbpblog.cn/articles/cover.png)",
    )
    resource = FileResource(
        user_id=user.id,
        owner_type="course",
        owner_id=course.id,
        resource_kind=ResourceKind.EXPORT,
        resource_variant=ResourceVariant.PDF,
        object_path="https://media.zbpblog.cn/files/course.pdf",
    )
    post = BlogPost(
        title="故事",
        slug="story",
        language="zh",
        summary="summary with https://media.zbpblog.cn/summary/keep",
        cover_image_url="https://media.zbpblog.cn/blog/cover.jpg",
        body_markdown="![cover](https://media.zbpblog.cn/blog/body.md.png)",
        body_html='<p><img src="https://media.zbpblog.cn/blog/body.html.png"></p>',
        status=BlogPostStatus.DRAFT,
        author_user_id=user.id,
    )

    db_session.add_all([article_text, resource, post])
    db_session.commit()

    results = replace_media_domain.replace_media_domain(db_session, apply_changes=True)
    db_session.refresh(article_text)
    db_session.refresh(resource)
    db_session.refresh(post)

    assert [result.table for result in results] == [
        "article_texts",
        "blog_posts",
        "blog_posts",
        "blog_posts",
        "file_resources",
    ]
    assert article_text.content_markdown == "![img](https://media.pagealong.com/articles/cover.png)"
    assert article_text.text == "raw text with https://media.zbpblog.cn/raw/keep-me.txt"
    assert resource.object_path == "https://media.pagealong.com/files/course.pdf"
    assert post.cover_image_url == "https://media.pagealong.com/blog/cover.jpg"
    assert post.body_markdown == "![cover](https://media.pagealong.com/blog/body.md.png)"
    assert post.body_html == '<p><img src="https://media.pagealong.com/blog/body.html.png"></p>'
    assert post.summary == "summary with https://media.zbpblog.cn/summary/keep"
