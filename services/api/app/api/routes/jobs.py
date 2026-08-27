from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id
from app.models.course import Course
from app.models.generation_job import GenerationJob
from app.db.session import get_db
from app.schemas.job import GenerationJobList, GenerationJobRead
from app.services.pagination import paginate_sequence
from app.services.job_service import list_jobs, serialize_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=GenerationJobList)
def list_generation_jobs(
    scope: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> GenerationJobList:
    jobs = list_jobs(db, user_id=user_id, scope=scope)
    paginated_jobs, pagination = paginate_sequence(jobs, page, page_size)
    return GenerationJobList(items=paginated_jobs, pagination=pagination)


@router.get("/{job_id}", response_model=GenerationJobRead)
def get_generation_job(
    job_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> GenerationJobRead:
    job = db.scalar(select(GenerationJob).where(GenerationJob.id == job_id))
    if job is None:
        raise HTTPException(status_code=404, detail="Generation job not found")
    course = db.scalar(
        select(Course).where(
            Course.id == job.course_id,
            Course.user_id == user_id,
            Course.is_deleted.is_(False),
        )
    )
    if course is None:
        raise HTTPException(status_code=404, detail="Generation job not found")
    return serialize_job(db, job)
