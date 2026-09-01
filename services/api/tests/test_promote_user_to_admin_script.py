import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from scripts import promote_user_to_admin  # noqa: E402


def test_promote_user_to_admin_marks_existing_user_as_admin():
    import app.models  # noqa: F401,E402
    from app.db.base import Base  # noqa: E402
    from app.models.user import User, UserRole, UserStatus  # noqa: E402
    from app.services.auth_security import hash_password  # noqa: E402

    engine = create_engine("sqlite://")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)

    with SessionLocal() as session:
        user = User(
            email="reader@example.com",
            password_hash=hash_password("abc12345"),
            role=UserRole.USER,
            status=UserStatus.DISABLED,
        )
        session.add(user)
        session.commit()

        updated = promote_user_to_admin.promote_user_to_admin(session, email="reader@example.com")

        assert updated.id == user.id
        assert updated.email == "reader@example.com"
        assert updated.role == UserRole.ADMIN
        assert updated.status == UserStatus.ACTIVE
