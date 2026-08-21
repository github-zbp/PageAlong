import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"

from app.api.deps import get_current_user_id
from app.db.base import Base
from app.db.session import get_db
from app.main import app
import app.models as _models  # noqa: F401


@pytest.fixture
def db_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with TestingSessionLocal() as session:
        yield session


@pytest.fixture(autouse=True)
def default_tts_provider_mode(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "tts_provider_mode", "fake")


@pytest.fixture
def client(db_session: Session) -> TestClient:
    def override_get_db():
        yield db_session

    def override_user():
        return "test_user"

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_id] = override_user
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
