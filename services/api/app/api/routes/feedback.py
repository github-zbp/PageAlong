from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.feedback import FeedbackSubmitRequest
from app.services.email_delivery import EmailDeliveryError
from app.services.feedback_service import get_feedback_service

router = APIRouter(prefix="/feedback", tags=["feedback"])


def client_ip(request: Request) -> str:
    return request.client.host if request.client is not None else ""


def user_agent(request: Request) -> str:
    return request.headers.get("user-agent", "")


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
def submit_feedback(
    payload: FeedbackSubmitRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        get_feedback_service().submit_feedback(
            user=current_user,
            category=payload.category,
            summary=payload.summary,
            message=payload.message,
            page_path=payload.page_path,
            user_agent=user_agent(request),
            ip_address=client_ip(request),
        )
    except EmailDeliveryError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Feedback delivery is temporarily unavailable",
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
