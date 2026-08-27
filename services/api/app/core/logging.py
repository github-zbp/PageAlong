from __future__ import annotations

import logging.config
from pathlib import Path
from collections.abc import Sequence

LOG_RETENTION_COUNT = 14
LOG_FILE_NAME = "api.log"


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_log_directory() -> Path:
    return get_project_root() / "storage" / "logs"


def get_log_file_path() -> Path:
    return get_log_directory() / LOG_FILE_NAME


def build_logging_config(log_file_path: Path, named_loggers: Sequence[str] = ()) -> dict[str, object]:
    log_file_path.parent.mkdir(parents=True, exist_ok=True)

    formatter = {"format": "%(asctime)s %(levelname)s [%(name)s] %(message)s"}
    handlers = {
        "console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "standard",
            "stream": "ext://sys.stderr",
        },
        "file": {
            "class": "logging.handlers.TimedRotatingFileHandler",
            "level": "INFO",
            "formatter": "standard",
            "filename": str(log_file_path),
            "when": "midnight",
            "interval": 1,
            "backupCount": LOG_RETENTION_COUNT,
            "encoding": "utf-8",
            "delay": True,
        },
    }
    loggers = {
        name: {"level": "INFO", "handlers": ["console", "file"], "propagate": False}
        for name in named_loggers
    }

    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {"standard": formatter},
        "handlers": handlers,
        "root": {"level": "INFO", "handlers": ["console", "file"]},
        "loggers": loggers,
    }


def configure_logging() -> None:
    logging.config.dictConfig(
        build_logging_config(get_log_file_path(), ("uvicorn.error", "uvicorn.access"))
    )
