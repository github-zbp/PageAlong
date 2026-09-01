from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.admin import BlogDetail, BlogList, BlogListItem
from app.services.admin_blog_service import get_public_blog_by_slug, list_public_blog_posts
from app.services.pagination import paginate_sequence

router = APIRouter(prefix="/blogs", tags=["blogs"])


@router.get("", response_model=BlogList)
def list_public_blogs(
    lang: str = Query(default="zh", pattern="^(zh|en)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> BlogList:
    posts = list_public_blog_posts(db, language=lang)
    page_posts, pagination = paginate_sequence(posts, page, page_size)
    return BlogList(
        items=[
            BlogListItem(
                id=post.id,
                title=post.title,
                slug=post.slug,
                language=post.language,
                author_email="",
                summary=post.summary,
                cover_image_url=post.cover_image_url,
                status=post.status.value,
                published_at=post.published_at,
                created_at=post.created_at,
                updated_at=post.updated_at,
            )
            for post in page_posts
        ],
        pagination=pagination,
    )


@router.get("/{slug}", response_model=BlogDetail)
def get_public_blog(
    slug: str,
    lang: str = Query(default="zh", pattern="^(zh|en)$"),
    db: Session = Depends(get_db),
) -> BlogDetail:
    try:
        post = get_public_blog_by_slug(db, slug=slug, language=lang)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return BlogDetail(
        id=post.id,
        title=post.title,
        slug=post.slug,
        language=post.language,
        author_email="",
        summary=post.summary,
        cover_image_url=post.cover_image_url,
        status=post.status.value,
        published_at=post.published_at,
        created_at=post.created_at,
        updated_at=post.updated_at,
        body_markdown=post.body_markdown,
        body_html=post.body_html,
        seo_title=post.seo_title,
        seo_description=post.seo_description,
    )
