#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

FAKE_ROOT="${TMP_DIR}/web_reader"
FAKE_BIN="${TMP_DIR}/bin"
mkdir -p \
  "${FAKE_BIN}" \
  "${FAKE_ROOT}/scripts" \
  "${FAKE_ROOT}/storage/deploy"

cat >"${FAKE_ROOT}/.env.example" <<'EOF'
DATABASE_URL=postgresql+psycopg://web_reader:web_reader@localhost:15432/web_reader
REDIS_URL=redis://localhost:16379/0
S3_ENDPOINT_URL=http://localhost:19000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=web-reader-dev
API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
AUTH_CODE_HASH_SECRET=replace-with-random-secret
INTERNAL_API_HMAC_SECRET=replace-with-random-secret
TTS_STORAGE_BACKEND=r2
URL_IMPORT_IMAGE_STORAGE_BACKEND=r2
EOF

cat >"${FAKE_ROOT}/docker-compose.prod.yml" <<'EOF'
services: {}
EOF

cat >"${FAKE_BIN}/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "${DOCKER_CALL_LOG:?}"
printf 'DATABASE_URL=%s\n' "${DATABASE_URL:-}" >> "${DOCKER_ENV_LOG:?}"
printf 'REDIS_URL=%s\n' "${REDIS_URL:-}" >> "${DOCKER_ENV_LOG:?}"
printf 'S3_ENDPOINT_URL=%s\n' "${S3_ENDPOINT_URL:-}" >> "${DOCKER_ENV_LOG:?}"
printf 'API_BASE_URL=%s\n' "${API_BASE_URL:-}" >> "${DOCKER_ENV_LOG:?}"
printf 'NEXT_PUBLIC_API_BASE_URL=%s\n' "${NEXT_PUBLIC_API_BASE_URL:-}" >> "${DOCKER_ENV_LOG:?}"
printf 'API_CLI_PYTHON=%s\n' "${API_CLI_PYTHON:-}" >> "${DOCKER_ENV_LOG:?}"
printf 'ADMIN_BOOTSTRAP_EMAIL=%s\n' "${ADMIN_BOOTSTRAP_EMAIL:-}" >> "${DOCKER_ENV_LOG:?}"
printf 'ADMIN_BOOTSTRAP_PASSWORD=%s\n' "${ADMIN_BOOTSTRAP_PASSWORD:-}" >> "${DOCKER_ENV_LOG:?}"

case "${1:-}" in
  compose)
    if [[ "${2:-}" == "version" ]]; then
      exit 0
    fi
    exit 0
    ;;
  info)
    exit 0
    ;;
esac
exit 0
EOF
chmod +x "${FAKE_BIN}/docker"

for command_name in cp mkdir rm cat sed grep awk mktemp ln chmod dirname basename head tail sort tr env id uname pwd tee mv touch; do
  ln -s "$(command -v "${command_name}")" "${FAKE_BIN}/${command_name}"
done
ln -s "$(command -v bash)" "${FAKE_BIN}/bash"

set +e
input="$(
  printf '%s\n' \
    "postgresql+psycopg://pagealong:secret@localhost:15432/pagealong_prod" \
    "redis://:secret@localhost:16379/0" \
    "local" \
    "local" \
    "admin@example.com" \
    "Compose1234"
)"
output="$(
  PATH="${FAKE_BIN}:${PATH}" \
  PROJECT_ROOT="${FAKE_ROOT}" \
  WEB_HOST_PORT="4300" \
  API_HOST_PORT="8400" \
  DOCKER_CALL_LOG="${TMP_DIR}/docker.log" \
  DOCKER_ENV_LOG="${TMP_DIR}/docker-env.log" \
  "${PROJECT_ROOT}/scripts/compose-prod.sh" <<<"${input}" 2>&1
)"
status="$?"
set -e

if [[ "${status}" -ne 0 ]]; then
  printf 'compose-prod failed unexpectedly.\n\nOutput:\n%s\n' "${output}" >&2
  exit 1
fi

if ! grep -F "DATABASE_URL=postgresql+psycopg://pagealong:secret@localhost:15432/pagealong_prod" "${FAKE_ROOT}/.env" >/dev/null; then
  printf 'Expected compose-prod to write prompted DATABASE_URL to .env.\n' >&2
  exit 1
fi

if ! grep -F "REDIS_URL=redis://:secret@localhost:16379/0" "${FAKE_ROOT}/.env" >/dev/null; then
  printf 'Expected compose-prod to write prompted REDIS_URL to .env.\n' >&2
  exit 1
fi

if ! grep -F "TTS_STORAGE_BACKEND=local" "${FAKE_ROOT}/.env" >/dev/null; then
  printf 'Expected compose-prod to write prompted TTS_STORAGE_BACKEND to .env.\n' >&2
  exit 1
fi

if ! grep -F "URL_IMPORT_IMAGE_STORAGE_BACKEND=local" "${FAKE_ROOT}/.env" >/dev/null; then
  printf 'Expected compose-prod to write prompted URL_IMPORT_IMAGE_STORAGE_BACKEND to .env.\n' >&2
  exit 1
fi

compose_env_file="${FAKE_ROOT}/storage/deploy/compose-prod.env"
if [[ ! -f "${compose_env_file}" ]]; then
  printf 'Expected compose-prod to write a generated env file.\n' >&2
  exit 1
fi

if ! grep -F "DATABASE_URL=postgresql+psycopg://pagealong:secret@host.docker.internal:15432/pagealong_prod" "${compose_env_file}" >/dev/null; then
  printf 'Expected compose-prod to rewrite localhost DATABASE_URL for containers.\n' >&2
  exit 1
fi

if ! grep -F "REDIS_URL=redis://:secret@host.docker.internal:16379/0" "${compose_env_file}" >/dev/null; then
  printf 'Expected compose-prod to rewrite localhost REDIS_URL for containers.\n' >&2
  exit 1
fi

if ! grep -F "S3_ENDPOINT_URL=http://host.docker.internal:19000" "${compose_env_file}" >/dev/null; then
  printf 'Expected compose-prod to rewrite localhost S3_ENDPOINT_URL for containers.\n' >&2
  exit 1
fi

if ! grep -F "API_BASE_URL=http://api:8000" "${compose_env_file}" >/dev/null; then
  printf 'Expected compose-prod to set the internal API base URL.\n' >&2
  exit 1
fi

if ! grep -F "NEXT_PUBLIC_API_BASE_URL=/api" "${compose_env_file}" >/dev/null; then
  printf 'Expected compose-prod to set the browser API base URL to /api.\n' >&2
  exit 1
fi

if ! grep -F "compose -f docker-compose.prod.yml up -d --build" "${TMP_DIR}/docker.log" >/dev/null; then
  printf 'Expected compose-prod to bring the stack up with docker compose.\n' >&2
  exit 1
fi

if ! grep -F "compose -f docker-compose.prod.yml run --rm -e ADMIN_BOOTSTRAP_EMAIL -e ADMIN_BOOTSTRAP_PASSWORD api python /app/scripts/init_database.py" "${TMP_DIR}/docker.log" >/dev/null; then
  printf 'Expected compose-prod to pass bootstrap admin env vars to the init container.\n' >&2
  exit 1
fi

if ! grep -F "ADMIN_BOOTSTRAP_EMAIL=admin@example.com" "${TMP_DIR}/docker-env.log" >/dev/null; then
  printf 'Expected compose-prod to provide the prompted admin email to docker compose run.\n' >&2
  exit 1
fi

if ! grep -F "ADMIN_BOOTSTRAP_PASSWORD=Compose1234" "${TMP_DIR}/docker-env.log" >/dev/null; then
  printf 'Expected compose-prod to provide the prompted admin password to docker compose run.\n' >&2
  exit 1
fi

if ! grep -F "Open the app in your browser:" <<<"${output}" >/dev/null; then
  printf 'Expected compose-prod to print browser access instructions.\n' >&2
  exit 1
fi

if ! grep -F "http://127.0.0.1:4300" <<<"${output}" >/dev/null; then
  printf 'Expected compose-prod to print the web access URL.\n' >&2
  exit 1
fi

if ! grep -F "http://127.0.0.1:8400/health" <<<"${output}" >/dev/null; then
  printf 'Expected compose-prod to print the API health URL.\n' >&2
  exit 1
fi

PROJECT_ROOT="${PROJECT_ROOT}" node --input-type=module <<'EOF'
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

process.env.API_BASE_URL = "http://api:8000";
process.env.NEXT_PUBLIC_API_BASE_URL = "/api";

const configModule = await import(`${pathToFileURL(`${process.env.PROJECT_ROOT}/apps/web/next.config.mjs`).href}?t=${Date.now()}`);
const rewrites = await configModule.default.rewrites();

assert.equal(rewrites.length, 1);
assert.deepEqual(rewrites[0], {
  source: "/api/:path*",
  destination: "http://api:8000/:path*"
});
EOF

printf '%s\n' "compose-prod smoke test passed"
