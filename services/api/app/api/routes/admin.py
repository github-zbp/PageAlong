from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user
from app.api.routes.auth import raise_http_auth_error, serialize_user
from app.db.session import get_db
from app.models.admin_content import Announcement, AnnouncementStatus, BlogPost, BlogPostStatus
from app.models.course import Course
from app.models.user import User
from app.schemas.admin import (
    AdminCourseDetail,
    AdminCourseList,
    AdminCourseListItem,
    AdminCourseResourceCounts,
    AdminUserList,
    AdminUserRead,
    AnnouncementCreate,
    AnnouncementDetail,
    AnnouncementList,
    AnnouncementListItem,
    AnnouncementReorder,
    AnnouncementUpdate,
    BlogCreate,
    BlogDetail,
    BlogList,
    BlogListItem,
    BlogUpdate,
    BulkActionResult,
    BulkBlogAction,
    CourseBulkDelete,
    ImpersonationCreate,
    ImpersonationRead,
)
from app.schemas.auth import UserRead
from app.schemas.job import DownloadRequestRead
from app.services.admin_announcement_service import (
    create_announcement,
    get_announcement_or_raise,
    list_announcements,
    reorder_announcements,
    set_announcement_status,
    update_announcement,
)
from app.services.admin_blog_service import (
    bulk_blog_action,
    create_blog_post,
    get_blog_or_raise,
    list_blog_posts,
    set_blog_status,
    update_blog_post,
)
from app.services.admin_course_service import (
    get_admin_course_or_raise,
    latest_course_markdown,
    list_admin_courses as list_admin_course_records,
    resource_counts_for_course,
    soft_delete_admin_course,
    user_email_for_course,
)
from app.services.admin_impersonation_service import AdminImpersonationService, ImpersonationError
from app.services.auth_service import AdminGuardError, AuthError, AuthService
from app.services.course_service import AudioGenerationQueueUnavailable
from app.services.job_service import request_course_download
from app.services.pagination import paginate_sequence

router = APIRouter(prefix="/admin", tags=["admin"])


def get_admin_service() -> AuthService:
    return AuthService()


def get_target_user_or_404(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def guard_error(exc: AdminGuardError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc) or exc.detail) from exc


def impersonation_error(exc: ImpersonationError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def serialize_admin_user(user: User) -> AdminUserRead:
    return AdminUserRead(**serialize_user(user).model_dump())


def blog_author_email(db: Session, post: BlogPost) -> str:
    author = db.get(User, post.author_user_id)
    return author.email if author is not None else ""


def serialize_blog_item(db: Session, post: BlogPost) -> BlogListItem:
    return BlogListItem(
        id=post.id,
        title=post.title,
        slug=post.slug,
        language=post.language,
        author_email=blog_author_email(db, post),
        summary=post.summary,
        cover_image_url=post.cover_image_url,
        status=post.status.value,
        published_at=post.published_at,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def serialize_blog_detail(db: Session, post: BlogPost) -> BlogDetail:
    item = serialize_blog_item(db, post)
    return BlogDetail(
        **item.model_dump(),
        body_markdown=post.body_markdown,
        body_html=post.body_html,
        seo_title=post.seo_title,
        seo_description=post.seo_description,
    )


def blog_not_found(exc: ValueError) -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


def serialize_admin_course_item(db: Session, course: Course) -> AdminCourseListItem:
    counts = resource_counts_for_course(db, course)
    return AdminCourseListItem(
        id=course.id,
        title=course.title,
        user_email=user_email_for_course(db, course),
        source_type=course.source_type.value,
        status=course.status.value,
        created_at=course.created_at,
        updated_at=course.updated_at,
        resource_counts=AdminCourseResourceCounts(**counts),
        audio_download_url=f"/admin/courses/{course.id}/downloads/audio" if counts["audio"] > 0 else None,
        pdf_download_url=f"/admin/courses/{course.id}/downloads/pdf",
        docx_download_url=f"/admin/courses/{course.id}/downloads/docx",
        markdown_download_url=f"/admin/courses/{course.id}/downloads/markdown",
    )


def serialize_admin_course_detail(db: Session, course: Course) -> AdminCourseDetail:
    item = serialize_admin_course_item(db, course)
    return AdminCourseDetail(**item.model_dump(), content_markdown=latest_course_markdown(course))


def course_not_found(exc: ValueError) -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


def serialize_announcement_item(announcement: Announcement) -> AnnouncementListItem:
    return AnnouncementListItem(
        id=announcement.id,
        title=announcement.title,
        language=announcement.language,
        status=announcement.status.value,
        roadmap_status=announcement.roadmap_status.value,
        display_position=announcement.display_position,
        sort_order=announcement.sort_order,
        is_pinned=announcement.is_pinned,
        published_at=announcement.published_at,
        created_at=announcement.created_at,
        updated_at=announcement.updated_at,
    )


def serialize_announcement_detail(announcement: Announcement) -> AnnouncementDetail:
    item = serialize_announcement_item(announcement)
    return AnnouncementDetail(
        **item.model_dump(),
        body_markdown=announcement.body_markdown,
        body_html=announcement.body_html,
    )


def announcement_not_found(exc: ValueError) -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/users", response_model=AdminUserList)
def list_admin_users(
    query: str = "",
    role: str = Query(default="", pattern="^(|user|admin)$"),
    status_filter: str = Query(default="", alias="status", pattern="^(|active|disabled)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AdminUserList:
    users = get_admin_service().list_users(db, query=query, role=role, status=status_filter)
    page_items, pagination = paginate_sequence(users, page, page_size)
    return AdminUserList(items=[serialize_admin_user(user) for user in page_items], pagination=pagination)


@router.post("/impersonation", response_model=ImpersonationRead, status_code=status.HTTP_201_CREATED)
def create_impersonation_token(
    payload: ImpersonationCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> ImpersonationRead:
    try:
        result = AdminImpersonationService().create_token(db, admin=admin, target_user_id=payload.target_user_id)
    except ImpersonationError as exc:
        impersonation_error(exc)
    return ImpersonationRead(
        token=result.token,
        target_user=serialize_admin_user(result.target_user),
        expires_at=result.expires_at,
    )


@router.get("/blogs", response_model=BlogList)
def list_admin_blogs(
    query: str = "",
    status_filter: str = Query(default="", alias="status", pattern="^(|draft|published|offline)$"),
    language: str = Query(default="", pattern="^(|zh|en)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> BlogList:
    posts = list_blog_posts(db, query=query, status=status_filter, language=language)
    page_posts, pagination = paginate_sequence(posts, page, page_size)
    return BlogList(items=[serialize_blog_item(db, post) for post in page_posts], pagination=pagination)


@router.post("/blogs", response_model=BlogDetail, status_code=status.HTTP_201_CREATED)
def create_admin_blog(
    payload: BlogCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> BlogDetail:
    post = create_blog_post(db, actor=admin, payload=payload)
    return serialize_blog_detail(db, post)


@router.post("/blogs/bulk", response_model=BulkActionResult)
def bulk_update_admin_blogs(
    payload: BulkBlogAction,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> BulkActionResult:
    updated_count, failed_ids = bulk_blog_action(db, ids=payload.ids, action=payload.action)
    return BulkActionResult(updated_count=updated_count, failed_ids=failed_ids)


@router.get("/blogs/{blog_id}", response_model=BlogDetail)
def get_admin_blog(
    blog_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> BlogDetail:
    try:
        post = get_blog_or_raise(db, blog_id)
    except ValueError as exc:
        blog_not_found(exc)
    return serialize_blog_detail(db, post)


@router.patch("/blogs/{blog_id}", response_model=BlogDetail)
def update_admin_blog(
    blog_id: str,
    payload: BlogUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> BlogDetail:
    try:
        post = get_blog_or_raise(db, blog_id)
    except ValueError as exc:
        blog_not_found(exc)
    return serialize_blog_detail(db, update_blog_post(db, post, payload))


@router.post("/blogs/{blog_id}/publish", response_model=BlogDetail)
def publish_admin_blog(
    blog_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> BlogDetail:
    try:
        post = get_blog_or_raise(db, blog_id)
    except ValueError as exc:
        blog_not_found(exc)
    return serialize_blog_detail(db, set_blog_status(db, post, BlogPostStatus.PUBLISHED))


@router.post("/blogs/{blog_id}/offline", response_model=BlogDetail)
def offline_admin_blog(
    blog_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> BlogDetail:
    try:
        post = get_blog_or_raise(db, blog_id)
    except ValueError as exc:
        blog_not_found(exc)
    return serialize_blog_detail(db, set_blog_status(db, post, BlogPostStatus.OFFLINE))


@router.delete("/blogs/{blog_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_blog(
    blog_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> Response:
    try:
        post = get_blog_or_raise(db, blog_id)
    except ValueError as exc:
        blog_not_found(exc)
    set_blog_status(db, post, BlogPostStatus.DELETED)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/courses", response_model=AdminCourseList)
def list_admin_courses_route(
    query: str = "",
    email: str = "",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AdminCourseList:
    courses = list_admin_course_records(db, query=query, email=email)
    page_courses, pagination = paginate_sequence(courses, page, page_size)
    return AdminCourseList(
        items=[serialize_admin_course_item(db, course) for course in page_courses],
        pagination=pagination,
    )


@router.post("/courses/bulk-delete", response_model=BulkActionResult)
def bulk_delete_admin_courses(
    payload: CourseBulkDelete,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> BulkActionResult:
    updated_count = 0
    failed_ids: list[str] = []
    for course_id in payload.ids:
        try:
            course = get_admin_course_or_raise(db, course_id)
        except ValueError:
            failed_ids.append(course_id)
            continue
        soft_delete_admin_course(db, course)
        updated_count += 1
    return BulkActionResult(updated_count=updated_count, failed_ids=failed_ids)


@router.get("/courses/{course_id}", response_model=AdminCourseDetail)
def get_admin_course(
    course_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AdminCourseDetail:
    try:
        course = get_admin_course_or_raise(db, course_id)
    except ValueError as exc:
        course_not_found(exc)
    return serialize_admin_course_detail(db, course)


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_course(
    course_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> Response:
    try:
        course = get_admin_course_or_raise(db, course_id)
    except ValueError as exc:
        course_not_found(exc)
    soft_delete_admin_course(db, course)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/courses/{course_id}/downloads/{export_format}")
def request_admin_course_download(
    course_id: str,
    export_format: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> JSONResponse:
    try:
        course = get_admin_course_or_raise(db, course_id)
    except ValueError as exc:
        course_not_found(exc)
    try:
        result = request_course_download(db, course, export_format)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except AudioGenerationQueueUnavailable as exc:
        raise HTTPException(status_code=503, detail="Audio generation queue is unavailable") from exc
    payload = DownloadRequestRead(
        status=result.status,  # type: ignore[arg-type]
        job_id=result.job_id,
        job_type=result.job_type or "",
        resource_id=result.resource_id,
        download_url=result.download_url,
        message=result.message,
    )
    return JSONResponse(status_code=200 if result.status == "ready" else 202, content=payload.model_dump())


@router.get("/announcements", response_model=AnnouncementList)
def list_admin_announcements(
    query: str = "",
    status_filter: str = Query(default="", alias="status", pattern="^(|draft|published|offline)$"),
    language: str = Query(default="", pattern="^(|zh|en)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AnnouncementList:
    announcements = list_announcements(db, query=query, status=status_filter, language=language)
    page_announcements, pagination = paginate_sequence(announcements, page, page_size)
    return AnnouncementList(
        items=[serialize_announcement_item(announcement) for announcement in page_announcements],
        pagination=pagination,
    )


@router.post("/announcements", response_model=AnnouncementDetail, status_code=status.HTTP_201_CREATED)
def create_admin_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AnnouncementDetail:
    announcement = create_announcement(db, payload=payload)
    return serialize_announcement_detail(announcement)


@router.post("/announcements/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_admin_announcements(
    payload: AnnouncementReorder,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> Response:
    try:
        reorder_announcements(db, items=payload.items)
    except ValueError as exc:
        announcement_not_found(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/announcements/{announcement_id}", response_model=AnnouncementDetail)
def get_admin_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AnnouncementDetail:
    try:
        announcement = get_announcement_or_raise(db, announcement_id)
    except ValueError as exc:
        announcement_not_found(exc)
    return serialize_announcement_detail(announcement)


@router.patch("/announcements/{announcement_id}", response_model=AnnouncementDetail)
def update_admin_announcement(
    announcement_id: str,
    payload: AnnouncementUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AnnouncementDetail:
    try:
        announcement = get_announcement_or_raise(db, announcement_id)
    except ValueError as exc:
        announcement_not_found(exc)
    return serialize_announcement_detail(update_announcement(db, announcement, payload))


@router.post("/announcements/{announcement_id}/publish", response_model=AnnouncementDetail)
def publish_admin_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AnnouncementDetail:
    try:
        announcement = get_announcement_or_raise(db, announcement_id)
    except ValueError as exc:
        announcement_not_found(exc)
    return serialize_announcement_detail(set_announcement_status(db, announcement, AnnouncementStatus.PUBLISHED))


@router.post("/announcements/{announcement_id}/offline", response_model=AnnouncementDetail)
def offline_admin_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AnnouncementDetail:
    try:
        announcement = get_announcement_or_raise(db, announcement_id)
    except ValueError as exc:
        announcement_not_found(exc)
    return serialize_announcement_detail(set_announcement_status(db, announcement, AnnouncementStatus.OFFLINE))


@router.delete("/announcements/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> Response:
    try:
        announcement = get_announcement_or_raise(db, announcement_id)
    except ValueError as exc:
        announcement_not_found(exc)
    set_announcement_status(db, announcement, AnnouncementStatus.DELETED)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/users/{user_id}", response_model=UserRead)
def get_admin_user(
    user_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> UserRead:
    return serialize_user(get_target_user_or_404(db, user_id))


@router.post("/users/{user_id}/disable", response_model=UserRead)
def disable_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> UserRead:
    target = get_target_user_or_404(db, user_id)
    try:
        return serialize_user(get_admin_service().disable_user(db, target_user=target, actor=admin))
    except AdminGuardError as exc:
        guard_error(exc)


@router.post("/users/{user_id}/enable", response_model=UserRead)
def enable_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> UserRead:
    target = get_target_user_or_404(db, user_id)
    return serialize_user(get_admin_service().enable_user(db, target_user=target, actor=admin))


@router.post("/users/{user_id}/promote", response_model=UserRead)
def promote_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> UserRead:
    target = get_target_user_or_404(db, user_id)
    return serialize_user(get_admin_service().promote_user(db, target_user=target, actor=admin))


@router.post("/users/{user_id}/demote", response_model=UserRead)
def demote_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> UserRead:
    target = get_target_user_or_404(db, user_id)
    try:
        return serialize_user(get_admin_service().demote_user(db, target_user=target, actor=admin))
    except AdminGuardError as exc:
        guard_error(exc)


@router.post("/users/{user_id}/force-logout", status_code=status.HTTP_204_NO_CONTENT)
def force_logout_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> Response:
    target = get_target_user_or_404(db, user_id)
    get_admin_service().force_logout_user(db, target_user=target, actor=admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/users/{user_id}/send-password-reset", status_code=status.HTTP_204_NO_CONTENT)
def send_password_reset(
    user_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> Response:
    target = get_target_user_or_404(db, user_id)
    try:
        get_admin_service().request_password_reset_code(db, email=target.email)
    except AuthError as exc:
        raise_http_auth_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
