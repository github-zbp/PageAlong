FROM python:3.12-slim-bookworm

ARG HOST_UID=1000
ARG HOST_GID=1000

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH="/opt/venv/bin:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN python -m venv /opt/venv \
    && pip install --upgrade pip setuptools wheel

COPY --chown=${HOST_UID}:${HOST_GID} services/api /app/services/api
COPY --chown=${HOST_UID}:${HOST_GID} services/worker /app/services/worker
COPY --chown=${HOST_UID}:${HOST_GID} scripts /app/scripts

RUN pip install -e /app/services/api \
    && pip install -e /app/services/worker
