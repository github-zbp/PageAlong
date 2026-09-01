from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from sqlalchemy.orm import Session

ROOT_DIR = Path(__file__).resolve().parents[1]
API_DIR = ROOT_DIR / "services" / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.db.session import SessionLocal
from app.models.user import User, UserRole, UserStatus
from app.services.auth_security import normalize_email


def get_target_user(db: Session, *, email: str | None = None, user_id: str | None = None) -> User:
    if bool(email) == bool(user_id):
        raise ValueError("Provide exactly one of --email or --user-id.")

    if email is not None:
        normalized_email = normalize_email(email)
        user = db.query(User).filter(User.email == normalized_email).one_or_none()
    else:
        user = db.get(User, user_id)

    if user is None:
        identifier = email if email is not None else user_id
        raise LookupError(f"User not found: {identifier}")
    return user


def promote_user_to_admin(db: Session, *, email: str | None = None, user_id: str | None = None) -> User:
    user = get_target_user(db, email=email, user_id=user_id)
    user.role = UserRole.ADMIN
    user.status = UserStatus.ACTIVE
    db.commit()
    db.refresh(user)
    return user


def main() -> None:
    parser = argparse.ArgumentParser(description="Promote a PageAlong user to system admin.")
    selector = parser.add_mutually_exclusive_group(required=True)
    selector.add_argument("--email", help="User email to promote")
    selector.add_argument("--user-id", help="User ID to promote")
    args = parser.parse_args()

    try:
        with SessionLocal() as db:
            user = promote_user_to_admin(db, email=args.email, user_id=args.user_id)
    except (LookupError, ValueError) as exc:
        parser.error(str(exc))
        return

    print(
        json.dumps(
            {
                "id": user.id,
                "email": user.email,
                "role": user.role.value,
                "status": user.status.value
            },
            ensure_ascii=False
        )
    )


if __name__ == "__main__":
    main()
