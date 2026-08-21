ENV_API_HOST := $(if $(filter environment,$(origin API_HOST)),$(API_HOST))
ENV_API_PORT := $(if $(filter environment,$(origin API_PORT)),$(API_PORT))
ENV_API_BASE_URL := $(if $(filter environment,$(origin API_BASE_URL)),$(API_BASE_URL))
ENV_NEXT_PUBLIC_API_BASE_URL := $(if $(filter environment,$(origin NEXT_PUBLIC_API_BASE_URL)),$(NEXT_PUBLIC_API_BASE_URL))
ENV_WEB_HOST := $(if $(filter environment,$(origin WEB_HOST)),$(WEB_HOST))
ENV_WEB_PORT := $(if $(filter environment,$(origin WEB_PORT)),$(WEB_PORT))

ifneq (,$(wildcard .env))
include .env
endif

PYTHON ?= python3
NPM ?= npm
API_HOST ?= 0.0.0.0
API_PORT ?= 8000
WEB_HOST ?= 0.0.0.0
WEB_PORT ?= 3000
KOKORO_ASSET_DIR ?= services/api/storage/kokoro
KOKORO_RELEASE_URL_BASE ?= https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1
KOKORO_MODEL_FILE ?= kokoro-v1.1-zh.onnx
KOKORO_VOICES_FILE ?= voices-v1.1-zh.bin
KOKORO_MODEL_PATH := $(KOKORO_ASSET_DIR)/$(KOKORO_MODEL_FILE)
KOKORO_VOICES_PATH := $(KOKORO_ASSET_DIR)/$(KOKORO_VOICES_FILE)

ifneq ($(ENV_API_HOST),)
API_HOST := $(ENV_API_HOST)
endif
ifneq ($(ENV_API_PORT),)
API_PORT := $(ENV_API_PORT)
endif
ifneq ($(ENV_API_BASE_URL),)
API_BASE_URL := $(ENV_API_BASE_URL)
endif
ifneq ($(ENV_NEXT_PUBLIC_API_BASE_URL),)
NEXT_PUBLIC_API_BASE_URL := $(ENV_NEXT_PUBLIC_API_BASE_URL)
endif
ifneq ($(ENV_WEB_HOST),)
WEB_HOST := $(ENV_WEB_HOST)
endif
ifneq ($(ENV_WEB_PORT),)
WEB_PORT := $(ENV_WEB_PORT)
endif

export

.PHONY: deps deps-extension deps-kokoro up down init-db api api-prod worker web test-api test-web test-extension build-extension test

deps:
	cd services/api && $(PYTHON) -m venv .venv && .venv/bin/python -m pip install --upgrade pip && .venv/bin/python -m pip install fastapi 'uvicorn[standard]' sqlalchemy alembic 'psycopg[binary]' pydantic-settings python-multipart 'celery[redis]' boto3 'edge-tts' websockets httpx lxml markdownify pillow python-docx readability-lxml reportlab trafilatura pytest pytest-asyncio ruff
	cd services/worker && $(PYTHON) -m venv .venv && .venv/bin/python -m pip install --upgrade pip && .venv/bin/python -m pip install 'celery[redis]' pydantic-settings pytest ruff
	cd apps/web && $(NPM) install
	cd apps/extension && $(NPM) install

deps-extension:
	cd apps/extension && $(NPM) install

deps-kokoro:
	cd services/api && .venv/bin/python -c 'import sys; sys.exit("kokoro-onnx currently requires a Python runtime with onnxruntime wheels; use Python 3.12 for this venv.") if sys.version_info >= (3, 13) else None'
	mkdir -p "$(KOKORO_ASSET_DIR)"
	test -f "$(KOKORO_MODEL_PATH)" || (curl -L --fail -o "$(KOKORO_MODEL_PATH).tmp" "$(KOKORO_RELEASE_URL_BASE)/$(KOKORO_MODEL_FILE)" && mv "$(KOKORO_MODEL_PATH).tmp" "$(KOKORO_MODEL_PATH)")
	test -f "$(KOKORO_VOICES_PATH)" || (curl -L --fail -o "$(KOKORO_VOICES_PATH).tmp" "$(KOKORO_RELEASE_URL_BASE)/$(KOKORO_VOICES_FILE)" && mv "$(KOKORO_VOICES_PATH).tmp" "$(KOKORO_VOICES_PATH)")
	@echo "Set TTS_KOKORO_MODEL_PATH=$(CURDIR)/$(KOKORO_MODEL_PATH)"
	@echo "Set TTS_KOKORO_VOICES_PATH=$(CURDIR)/$(KOKORO_VOICES_PATH)"
	cd services/api && .venv/bin/python -m pip install '.[kokoro]'

up:
	bash scripts/dev-services.sh up

down:
	bash scripts/dev-services.sh down

init-db:
	PYTHONPATH=services/api services/api/.venv/bin/python scripts/init_database.py

api:
	cd services/api && .venv/bin/python -m uvicorn app.main:app --reload --host $(API_HOST) --port $(API_PORT)

api-prod:
	cd services/api && .venv/bin/python -m uvicorn app.main:app --host $(API_HOST) --port $(API_PORT)

worker:
	cd services/worker && .venv/bin/python -m celery -A app.celery_app worker --loglevel=info

web:
	cd apps/web && $(NPM) run dev -- --hostname $(WEB_HOST) --port $(WEB_PORT)

test-api:
	cd services/api && .venv/bin/python -m pytest -q

test-web:
	cd apps/web && API_BASE_URL= NEXT_PUBLIC_API_BASE_URL= $(NPM) test

test-extension:
	cd apps/extension && $(NPM) test

build-extension:
	cd apps/extension && $(NPM) run build

test: test-api test-web test-extension
