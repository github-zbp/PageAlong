#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

TMP_DIR="$(mktemp -d)"
SERVER_PID=""
API_PROCESS_PID=""
cleanup() {
  if [[ -n "${SERVER_PID}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${API_PROCESS_PID}" ]]; then
    kill "${API_PROCESS_PID}" >/dev/null 2>&1 || true
    wait "${API_PROCESS_PID}" >/dev/null 2>&1 || true
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

cat >"${TMP_DIR}/bin/lsof" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

want_t=0
port=""

for arg in "$@"; do
  case "${arg}" in
    -t)
      want_t=1
      ;;
    -iTCP:*)
      port="${arg#-iTCP:}"
      ;;
  esac
done

if [[ -n "${LSOF_LISTEN_PORT:-}" && "${port:-}" == "${LSOF_LISTEN_PORT}" ]]; then
  if [[ "${want_t}" -eq 1 ]]; then
    if [[ -n "${LSOF_LISTEN_PID:-}" ]]; then
      printf '%s\n' "${LSOF_LISTEN_PID}"
    fi
  else
    printf '%s\n' "COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME"
    printf '%s\n' "python  ${LSOF_LISTEN_PID:-0} root   11u  IPv4 0t0  TCP *:${LSOF_LISTEN_PORT} (LISTEN)"
  fi
fi
EOF
chmod +x "${TMP_DIR}/bin/lsof"

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

    if [[ -n "${BUILD_NODE_OPTIONS_LOG:-}" ]]; then
      printf '%s\n' "${NODE_OPTIONS:-}" > "${BUILD_NODE_OPTIONS_LOG}"
    fi
    if [[ -n "${BUILD_CPUS_LOG:-}" ]]; then
      printf '%s\n' "${NEXT_BUILD_CPUS:-}" > "${BUILD_CPUS_LOG}"
    fi

    mkdir -p .next/static/chunks
    printf '%s\n' "new-build-id" > .next/BUILD_ID
    printf '%s\n' "new chunk" > .next/static/chunks/webpack-new.js
    exit "${NPM_BUILD_EXIT_STATUS:-0}"
    ;;
  *)
    echo "unexpected npm command: $*" >&2
    exit 1
    ;;
esac
EOF
chmod +x "${TMP_DIR}/bin/npm"

cat >"${TMP_DIR}/bin/pgrep" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "$*" == *"app.celery_app worker"* ]]; then
  for pid in ${PGREP_CELERY_PIDS:-}; do
    printf '%s\n' "${pid}"
  done
fi

if [[ "$*" == *"app.main:app"* ]]; then
  for pid in ${PGREP_API_PIDS:-}; do
    printf '%s\n' "${pid}"
  done
fi
EOF
chmod +x "${TMP_DIR}/bin/pgrep"

mkdir -p "${TMP_DIR}/bin-no-lsof"
cp "${TMP_DIR}/bin/tmux" "${TMP_DIR}/bin-no-lsof/tmux"
cp "${TMP_DIR}/bin/pgrep" "${TMP_DIR}/bin-no-lsof/pgrep"
chmod +x "${TMP_DIR}/bin-no-lsof/tmux" "${TMP_DIR}/bin-no-lsof/pgrep"
cat >"${TMP_DIR}/bin-no-lsof/lsof" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "${TMP_DIR}/bin-no-lsof/lsof"

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

wait_for_pid_exit() {
  local pid="$1"

  for _ in {1..40}; do
    if ! kill -0 "${pid}" >/dev/null 2>&1; then
      return
    fi
    sleep 0.1
  done

  if kill -0 "${pid}" >/dev/null 2>&1; then
    printf "Expected process %s to exit, but it is still running.\n" "${pid}" >&2
    exit 1
  fi
}

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
restart_output="$(
  PATH="${TMP_DIR}/bin:${PATH}" \
  PROJECT_ROOT="${FAKE_ROOT}" \
  API_HOST=127.0.0.1 \
  API_PORT="${busy_port}" \
  LSOF_LISTEN_PORT="${busy_port}" \
  LSOF_LISTEN_PID="${SERVER_PID}" \
  TMUX_CALL_LOG="${TMP_DIR}/tmux-calls-restart" \
  "${PROJECT_ROOT}/scripts/prod-apps.sh" restart 2>&1
)"
restart_status="$?"
set -e

if [[ "${restart_status}" -ne 0 ]]; then
  printf "Expected restart to succeed after reclaiming the busy API port.\n\nActual output:\n%s\n" \
    "${restart_output}" >&2
  exit 1
fi

if ! grep -F "killing listener(s): ${SERVER_PID}" <<<"${restart_output}" >/dev/null; then
  printf "Expected restart output to mention killing the busy API listener.\n\nActual output:\n%s\n" \
    "${restart_output}" >&2
  exit 1
fi

wait_for_pid_exit "${SERVER_PID}"

if ! grep -F "new-session -d -s web_reader_api" "${TMP_DIR}/tmux-calls-restart" >/dev/null; then
  printf "Expected restart to start a new api tmux session.\n\nCalls:\n%s\n" \
    "$(cat "${TMP_DIR}/tmux-calls-restart")" >&2
  exit 1
fi

PROC_ROOT="${TMP_DIR}/proc-api"
API_PROCESS_PID=""
mkdir -p "${PROC_ROOT}"

orphan_port="$(
  python3 - <<'PY'
import socket

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.bind(("127.0.0.1", 0))
    print(sock.getsockname()[1])
PY
)"

python3 - "${orphan_port}" "${TMP_DIR}/api-server-ready" <<'PY' &
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
API_PROCESS_PID="$!"

for _ in {1..40}; do
  if [[ -f "${TMP_DIR}/api-server-ready" ]]; then
    break
  fi
  sleep 0.1
done

mkdir -p "${PROC_ROOT}/${API_PROCESS_PID}"
ln -s "${FAKE_ROOT}/services/api" "${PROC_ROOT}/${API_PROCESS_PID}/cwd"

set +e
orphan_restart_output="$(
  PATH="${TMP_DIR}/bin-no-lsof:${PATH}" \
  PROJECT_ROOT="${FAKE_ROOT}" \
  PROC_ROOT="${PROC_ROOT}" \
  PGREP_API_PIDS="${API_PROCESS_PID}" \
  API_HOST=127.0.0.1 \
  API_PORT="${orphan_port}" \
  TMUX_CALL_LOG="${TMP_DIR}/tmux-calls-orphan-restart" \
  "${PROJECT_ROOT}/scripts/prod-apps.sh" restart 2>&1
)"
orphan_restart_status="$?"
set -e

if [[ "${orphan_restart_status}" -ne 0 ]]; then
  printf "Expected restart to clean up an orphaned API process without lsof.\n\nActual output:\n%s\n" \
    "${orphan_restart_output}" >&2
  exit 1
fi

if ! grep -F "api: stopping uvicorn process(es): ${API_PROCESS_PID}" <<<"${orphan_restart_output}" >/dev/null; then
  printf "Expected restart output to mention cleaning the orphaned API process.\n\nActual output:\n%s\n" \
    "${orphan_restart_output}" >&2
  exit 1
fi

wait_for_pid_exit "${API_PROCESS_PID}"

if ! grep -F "new-session -d -s web_reader_api" "${TMP_DIR}/tmux-calls-orphan-restart" >/dev/null; then
  printf "Expected restart to start a new api tmux session after orphan cleanup.\n\nCalls:\n%s\n" \
    "$(cat "${TMP_DIR}/tmux-calls-orphan-restart")" >&2
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

PROC_ROOT="${TMP_DIR}/proc"
PROJECT_WORKER_PID="9999911"
OTHER_WORKER_PID="9999912"
mkdir -p "${PROC_ROOT}/${PROJECT_WORKER_PID}" "${PROC_ROOT}/${OTHER_WORKER_PID}" "${TMP_DIR}/other-worker"
ln -s "${FAKE_ROOT}/services/worker" "${PROC_ROOT}/${PROJECT_WORKER_PID}/cwd"
ln -s "${TMP_DIR}/other-worker" "${PROC_ROOT}/${OTHER_WORKER_PID}/cwd"

set +e
stale_worker_output="$(
  PATH="${TMP_DIR}/bin:${PATH}" \
  PROJECT_ROOT="${FAKE_ROOT}" \
  PROC_ROOT="${PROC_ROOT}" \
  PGREP_CELERY_PIDS="${PROJECT_WORKER_PID} ${OTHER_WORKER_PID}" \
  "${PROJECT_ROOT}/scripts/prod-apps.sh" stop 2>&1
)"
stale_worker_status="$?"
set -e

if [[ "${stale_worker_status}" -ne 0 ]]; then
  printf "Expected stop to succeed while cleaning stale worker processes.\n\nActual output:\n%s\n" \
    "${stale_worker_output}" >&2
  exit 1
fi

if ! grep -F "worker: stopping celery process(es): ${PROJECT_WORKER_PID}" <<<"${stale_worker_output}" >/dev/null; then
  printf "Expected stop to clean stale worker processes in this project.\n\nActual output:\n%s\n" \
    "${stale_worker_output}" >&2
  exit 1
fi

if grep -F "${OTHER_WORKER_PID}" <<<"${stale_worker_output}" >/dev/null; then
  printf "Expected stale worker cleanup to ignore worker processes from other directories.\n\nActual output:\n%s\n" \
    "${stale_worker_output}" >&2
  exit 1
fi

START_PROJECT_WORKER_PID="9999913"
START_OTHER_WORKER_PID="9999914"
mkdir -p "${PROC_ROOT}/${START_PROJECT_WORKER_PID}" "${PROC_ROOT}/${START_OTHER_WORKER_PID}"
ln -s "${FAKE_ROOT}/services/worker" "${PROC_ROOT}/${START_PROJECT_WORKER_PID}/cwd"
ln -s "${TMP_DIR}/other-worker" "${PROC_ROOT}/${START_OTHER_WORKER_PID}/cwd"

set +e
start_cleanup_output="$(
  PATH="${TMP_DIR}/bin:${PATH}" \
  PROJECT_ROOT="${FAKE_ROOT}" \
  PROC_ROOT="${PROC_ROOT}" \
  PGREP_CELERY_PIDS="${START_PROJECT_WORKER_PID} ${START_OTHER_WORKER_PID}" \
  TMUX_CALL_LOG="${TMP_DIR}/tmux-calls-start-cleanup" \
  "${PROJECT_ROOT}/scripts/prod-apps.sh" start 2>&1
)"
start_cleanup_status="$?"
set -e

if [[ "${start_cleanup_status}" -ne 0 ]]; then
  printf "Expected start to succeed while cleaning stale worker processes.\n\nActual output:\n%s\n" \
    "${start_cleanup_output}" >&2
  exit 1
fi

if ! grep -F "worker: stopping celery process(es): ${START_PROJECT_WORKER_PID}" <<<"${start_cleanup_output}" >/dev/null; then
  printf "Expected start to clean stale worker processes in this project before starting worker.\n\nActual output:\n%s\n" \
    "${start_cleanup_output}" >&2
  exit 1
fi

if grep -F "${START_OTHER_WORKER_PID}" <<<"${start_cleanup_output}" >/dev/null; then
  printf "Expected start cleanup to ignore worker processes from other directories.\n\nActual output:\n%s\n" \
    "${start_cleanup_output}" >&2
  exit 1
fi

if ! grep -F "new-session -d -s web_reader_worker" "${TMP_DIR}/tmux-calls-start-cleanup" >/dev/null; then
  printf "Expected start to start a new worker tmux session after cleanup.\n\nCalls:\n%s\n" \
    "$(cat "${TMP_DIR}/tmux-calls-start-cleanup")" >&2
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
  BUILD_NODE_OPTIONS_LOG="${TMP_DIR}/node-options.log" \
  BUILD_CPUS_LOG="${TMP_DIR}/build-cpus.log" \
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

if ! grep -F -- "--max-old-space-size=256" "${TMP_DIR}/node-options.log" >/dev/null; then
  printf "Expected build-web to cap Node heap for the build.\n\nNODE_OPTIONS:\n%s\n" \
    "$(cat "${TMP_DIR}/node-options.log")" >&2
  exit 1
fi

if ! grep -Fx "1" "${TMP_DIR}/build-cpus.log" >/dev/null; then
  printf "Expected build-web to limit Next build concurrency by default.\n\nNEXT_BUILD_CPUS:\n%s\n" \
    "$(cat "${TMP_DIR}/build-cpus.log")" >&2
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

printf '%s\n' "previous-build-id" > "${FAKE_ROOT}/apps/web/.next/BUILD_ID"
printf '%s\n' "previous chunk" > "${FAKE_ROOT}/apps/web/.next/static/chunks/webpack-old.js"

set +e
killed_build_output="$(
  PATH="${TMP_DIR}/bin:${PATH}" \
  PROJECT_ROOT="${FAKE_ROOT}" \
  NPM_BUILD_EXIT_STATUS=137 \
  "${PROJECT_ROOT}/scripts/prod-apps.sh" build-web 2>&1
)"
killed_build_status="$?"
set -e

if [[ "${killed_build_status}" -ne 137 ]]; then
  printf "Expected killed build-web to exit with 137.\n\nActual status: %s\n\nActual output:\n%s\n" \
    "${killed_build_status}" \
    "${killed_build_output}" >&2
  exit 1
fi

if ! grep -F "npm run build exited with 137" <<<"${killed_build_output}" >/dev/null; then
  printf "Expected killed build-web output to explain the SIGKILL/OOM failure.\n\nActual output:\n%s\n" \
    "${killed_build_output}" >&2
  exit 1
fi

if [[ "$(cat "${FAKE_ROOT}/apps/web/.next/BUILD_ID")" != "previous-build-id" ]]; then
  printf "Expected killed build-web to restore the previous build id.\n\nActual BUILD_ID:\n%s\n" \
    "$(cat "${FAKE_ROOT}/apps/web/.next/BUILD_ID")" >&2
  exit 1
fi

if [[ "$(cat "${FAKE_ROOT}/apps/web/.next/static/chunks/webpack-old.js")" != "previous chunk" ]]; then
  printf "Expected killed build-web to restore the previous static chunk.\n" >&2
  exit 1
fi
