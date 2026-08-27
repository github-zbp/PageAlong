from pathlib import Path

from app.core.logging import build_logging_config
from app.core.logging import get_log_file_path


def test_api_log_file_path_points_to_service_storage():
    project_root = Path(__file__).resolve().parents[3]

    assert get_log_file_path() == project_root / "services" / "api" / "storage" / "logs" / "api.log"


def test_api_logging_config_uses_daily_rotation_and_two_week_retention(tmp_path):
    log_file = tmp_path / "api.log"

    config = build_logging_config(log_file, named_loggers=("uvicorn.error", "uvicorn.access"))

    assert config["handlers"]["file"]["class"] == "logging.handlers.TimedRotatingFileHandler"
    assert config["handlers"]["file"]["when"] == "midnight"
    assert config["handlers"]["file"]["backupCount"] == 14
    assert config["loggers"]["uvicorn.error"]["handlers"] == ["console", "file"]
    assert config["loggers"]["uvicorn.access"]["propagate"] is False
