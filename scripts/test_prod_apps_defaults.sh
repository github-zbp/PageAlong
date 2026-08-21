#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

TMP_DIR="$(mktemp -d)"
SERVER_PID=""
cleanup() {
  if [[ -n "${SERVER_PID}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

FAKE_ROOT="${TMP_DIR}/web_reader"
mkdir -p \
  "${TMP_DIR}/bin" \
  "${FAKE_ROOT}/services/api/.venv/bin" \
  "${FAKE_ROOT}/services/worker/.venv/bin" \
  "${FAKE_ROOT}/apps/web/node_modules/.bin" \
  "${FAKE_ROOT}/apps/web/.next"

touch \
  "${FAKE_ROOT}/Makefile" \
  "${FAKE_ROOT}/services/worker/.venv/bin/python" \
  "${FAKE_ROOT}/apps/web/node_modules/.bin/next" \
  "${FAKE_ROOT}/apps/web/.next/BUILD_ID" \
  "${FAKE_ROOT}/apps/web/package.json"

cat >"${FAKE_ROOT}/services/api/.venv/bin/python" <<'EOF'
#!/usr/bin/env bash
if [[ "$*" == "-c import edge_tts" ]]; then
  exit "${EDGE_TTS_IMPORT_STATUS:-0}"
fi
exec python3 "$@"
EOF
chmod +x "${FAKE_ROOT}/services/api/.venv/bin/python"

cat >"${TMP_DIR}/bin/tmux" <<'EOF'
#!/usr/bin/env bash
case "$1" in
  has-session)
    if [[ "${TMUX_WEB_SESSION_PRESENT:-0}" == "1" && "${3:-}" == "${WEB_SESSION_NAME:-web_reader_web}" ]]; then
      exit 0
    fi
    exit 1
    ;;
  new-session)
    printf '%s\n' "$*" >>"${TMUX_CALL_LOG}"
    exit 0
    ;;
  kill-session)
    printf '%s\n' "$*" >>"${TMUX_CALL_LOG}"
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
EOF
chmod +x "${TMP_DIR}/bin/tmux"

cat >"${TMP_DIR}/bin/npm" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

case "$1" in
  install)
    exit 0
    ;;
  run)
    if [[ "${2:-}" != "build" ]]; then
      echo "unexpected npm command: $*" >&2
      exit 1
    fi

    mkdir -p .next/static/chunks
    printf '%s\n' "new-build-id" > .next/BUILD_ID
    printf '%s\n' "new chunk" > .next/static/chunks/webpack-new.js
    exit 0
    ;;
  *)
    echo "unexpected npm command: $*" >&2
    exit 1
    ;;
esac
EOF
chmod +x "${TMP_DIR}/bin/npm"

output="$(
  PATH="${TMP_DIR}/bin:${PATH}" \
  PROJECT_ROOT="${FAKE_ROOT}" \
  "${PROJECT_ROOT}/scripts/prod-apps.sh" doctor
)"

assert_contains() {
  local expected="$1"

  if ! grep -F "${expected}" <<<"${output}" >/dev/null; then
    printf "Expected doctor output to contain: %s\n\nActual output:\n%s\n" \
      "${expected}" \
      "${output}" >&2
    exit 1
  fi
}

assert_contains "api: 0.0.0.0:8000"
assert_contains "API_BASE_URL=http://127.0.0.1:8000"
assert_contains "NEXT_PUBLIC_API_BASE_URL=/api"
assert_contains "make api-prod"
assert_contains "next start -H 127.0.0.1 -p 3000"

busy_port="$(
  python3 - <<'PY'
import socket

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.bind(("127.0.0.1", 0))
    print(sock.getsockname()[1])
PY
)"
python3 - "${busy_port}" "${TMP_DIR}/server-ready" <<'PY' &
import socket
import sys
import time
from pathlib import Path

port = int(sys.argv[1])
ready_path = Path(sys.argv[2])

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.bind(("127.0.0.1", port))
    sock.listen()
    ready_path.write_text("ready")
    time.sleep(30)
PY
SERVER_PID="$!"

for _ in {1..40}; do
  if [[ -f "${TMP_DIR}/server-ready" ]]; then
    break
  fi
  sleep 0.1
done

set +e
busy_output="$(
  PATH="${TMP_DIR}/bin:${PATH}" \
  PROJECT_ROOT="${FAKE_ROOT}" \
  API_HOST=127.0.0.1 \
  API_PORT="${busy_port}" \
  TMUX_CALL_LOG="${TMP_DIR}/tmux-calls" \
  "${PROJECT_ROOT}/scripts/prod-apps.sh" start 2>&1
)"
busy_status="$?"
set -e

if [[ "${busy_status}" -eq 0 ]]; then
  printf "Expected start to fail when API port is busy.\n\nActual output:\n%s\n" "${busy_output}" >&2
  exit 1
fi

if ! grep -F "api: 127.0.0.1:${busy_port} is already in use" <<<"${busy_output}" >/dev/null; then
  printf "Expected busy-port output to mention occupied API port.\n\nActual output:\n%s\n" "${busy_output}" >&2
  exit 1
fi

if [[ -f "${TMP_DIR}/tmux-calls" ]]; then
  printf "Expected tmux new-session not to be called when API port is busy.\n\nCalls:\n%s\n" \
    "$(cat "${TMP_DIR}/tmux-calls")" >&2
  exit 1
fi

set +e
missing_edge_output="$(
  PATH="${TMP_DIR}/bin:${PATH}" \
  PROJECT_ROOT="${FAKE_ROOT}" \
  EDGE_TTS_IMPORT_STATUS=1 \
  TMUX_CALL_LOG="${TMP_DIR}/tmux-calls-missing-edge" \
  "${PROJECT_ROOT}/scripts/prod-apps.sh" start 2>&1
)"
missing_edge_status="$?"
set -e

if [[ "${missing_edge_status}" -eq 0 ]]; then
  printf "Expected start to fail when edge_tts is missing from the API virtualenv.\n\nActual output:\n%s\n" \
    "${missing_edge_output}" >&2
  exit 1
fi

if ! grep -F "Missing edge_tts in API virtualenv" <<<"${missing_edge_output}" >/dev/null; then
  printf "Expected missing edge_tts output to explain the dependency check.\n\nActual output:\n%s\n" \
    "${missing_edge_output}" >&2
  exit 1
fi

if [[ -f "${TMP_DIR}/tmux-calls-missing-edge" ]]; then
  printf "Expected tmux new-session not to be called when edge_tts is missing.\n\nCalls:\n%s\n" \
    "$(cat "${TMP_DIR}/tmux-calls-missing-edge")" >&2
  exit 1
fi

mkdir -p "${FAKE_ROOT}/apps/web/.next/static/chunks"
touch "${FAKE_ROOT}/apps/web/.next/static/chunks/webpack-old.js"

set +e
build_output="$(
  PATH="${TMP_DIR}/bin:${PATH}" \
  PROJECT_ROOT="${FAKE_ROOT}" \
  TMUX_WEB_SESSION_PRESENT=1 \
  WEB_SESSION_NAME="web_reader_web" \
  TMUX_CALL_LOG="${TMP_DIR}/tmux-calls-build-web" \
  NEXT_PUBLIC_API_BASE_URL="/api" \
  "${PROJECT_ROOT}/scripts/prod-apps.sh" build-web 2>&1
)"
build_status="$?"
set -e

if [[ "${build_status}" -ne 0 ]]; then
  printf "Expected build-web to succeed.\n\nActual output:\n%s\n" "${build_output}" >&2
  exit 1
fi

if ! grep -F "new-build-id" <<<"${build_output}" >/dev/null; then
  printf "Expected build-web to print the new build id.\n\nActual output:\n%s\n" "${build_output}" >&2
  exit 1
fi

if ! grep -F "kill-session -t web_reader_web" "${TMP_DIR}/tmux-calls-build-web" >/dev/null; then
  printf "Expected build-web to stop the running web session before rebuilding.\n\nCalls:\n%s\n" \
    "$(cat "${TMP_DIR}/tmux-calls-build-web")" >&2
  exit 1
fi

if [[ ! -f "${FAKE_ROOT}/apps/web/.next/static/chunks/webpack-old.js" ]]; then
  printf "Expected build-web to preserve the previous static chunk.\n" >&2
  exit 1
fi

if [[ ! -f "${FAKE_ROOT}/apps/web/.next/static/chunks/webpack-new.js" ]]; then
  printf "Expected build-web to keep the new build output.\n" >&2
  exit 1
fi
