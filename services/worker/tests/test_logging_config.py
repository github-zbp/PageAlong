from pathlib import Path

from app.core.logging import build_logging_config
from app.core.logging import get_log_file_path


def test_worker_log_file_path_points_to_service_storage():
    project_root = Path(__file__).resolve().parents[3]

    assert get_log_file_path() == project_root / "services" / "worker" / "storage" / "logs" / "worker.log"


def test_worker_logging_config_uses_daily_rotation_and_two_week_retention(tmp_path):
    log_file = tmp_path / "worker.log"

    config = build_logging_config(log_file, named_loggers=("celery", "celery.worker"))

    assert config["handlers"]["file"]["class"] == "logging.handlers.TimedRotatingFileHandler"
    assert config["handlers"]["file"]["when"] == "midnight"
    assert config["handlers"]["file"]["backupCount"] == 14
    assert config["loggers"]["celery"]["handlers"] == ["console", "file"]
    assert config["loggers"]["celery.worker"]["propagate"] is False
