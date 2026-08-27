from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.internal_auth import verify_internal_request_signature
from app.db.session import get_db
from app.services.job_service import run_generation_job as dispatch_generation_job

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/generation-jobs/{job_id}/run")
def run_generation_job(
    job_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(verify_internal_request_signature),
) -> dict[str, str]:
    return dispatch_generation_job(db, job_id)
