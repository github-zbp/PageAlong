from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.internal_auth import verify_internal_request_signature
from app.db.session import get_db
from app.services.audio_generation_service import AudioGenerationService

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/generation-jobs/{job_id}/run")
def run_generation_job(
    job_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(verify_internal_request_signature),
) -> dict[str, str]:
    result = AudioGenerationService(db).generate_for_job(job_id)
    return {
        "course_id": result.course_id,
        "job_id": result.job_id,
        "status": "succeeded",
    }
