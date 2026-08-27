#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-restart}"
TARGET="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"

SESSION_PREFIX="${SESSION_PREFIX:-web_reader}"
API_SESSION="${API_SESSION:-${SESSION_PREFIX}_api}"
WORKER_SESSION="${WORKER_SESSION:-${SESSION_PREFIX}_worker}"
WEB_SESSION="${WEB_SESSION:-${SESSION_PREFIX}_web}"

API_HOST="${API_HOST:-0.0.0.0}"
API_PORT="${API_PORT:-8000}"
WEB_HOST="${WEB_HOST:-127.0.0.1}"
WEB_PORT="${WEB_PORT:-3000}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${API_PORT}}"
NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-/api}"

usage() {
  cat >&2 <<EOF
Usage:
  scripts/prod-apps.sh [restart|start|stop|status|doctor|build-web]
  scripts/prod-apps.sh logs [api|worker|web]
  scripts/prod-apps.sh attach [api|worker|web]

Default action:
  restart

Environment overrides:
  PROJECT_ROOT=/www/web_reader
  API_PORT=8000
  WEB_PORT=3000
  API_BASE_URL=http://127.0.0.1:8000
  NEXT_PUBLIC_API_BASE_URL=/api
  WEB_BUILD_NODE_OPTIONS=--max-old-space-size=256
  WEB_BUILD_CPUS=1
  SESSION_PREFIX=web_reader

This script only manages the API, worker, and Web tmux sessions.
It does not start, stop, or recreate Postgres, Redis, or MinIO.
EOF
}

quote() {
  printf "%q" "$1"
}

require_tmux() {
  if ! command -v tmux >/dev/null 2>&1; then
    echo "tmux is required. Install tmux first, then run this script again." >&2
    exit 1
  fi
}

require_npm() {
  if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required for build-web." >&2
    exit 1
  fi
}

require_path() {
  local path="$1"
  local message="$2"

  if [[ ! -e "${path}" ]]; then
    echo "${message}" >&2
    exit 1
  fi
}

require_api_python_module() {
  local module="$1"
  local install_hint="$2"

  if ! "${PROJECT_ROOT}/services/api/.venv/bin/python" -c "import ${module}" >/dev/null 2>&1; then
    echo "Missing ${module} in API virtualenv. ${install_hint}" >&2
    exit 1
  fi
}

target_to_session() {
  case "$1" in
    api) echo "${API_SESSION}" ;;
    worker) echo "${WORKER_SESSION}" ;;
    web) echo "${WEB_SESSION}" ;;
    *)
      echo "Unknown target: $1" >&2
      echo "Expected one of: api, worker, web" >&2
      exit 2
      ;;
  esac
}

api_command() {
  printf "cd %s && env API_HOST=%s API_PORT=%s make api-prod" \
    "$(quote "${PROJECT_ROOT}")" \
    "$(quote "${API_HOST}")" \
    "$(quote "${API_PORT}")"
}

worker_command() {
  printf "cd %s && make worker" "$(quote "${PROJECT_ROOT}")"
}

web_command() {
  printf "cd %s && env API_BASE_URL=%s NEXT_PUBLIC_API_BASE_URL=%s ./node_modules/.bin/next start -H %s -p %s" \
    "$(quote "${PROJECT_ROOT}/apps/web")" \
    "$(quote "${API_BASE_URL}")" \
    "$(quote "${NEXT_PUBLIC_API_BASE_URL}")" \
    "$(quote "${WEB_HOST}")" \
    "$(quote "${WEB_PORT}")"
}

target_to_command() {
  case "$1" in
    api) api_command ;;
    worker) worker_command ;;
    web) web_command ;;
    *)
      echo "Unknown target: $1" >&2
      echo "Expected one of: api, worker, web" >&2
      exit 2
      ;;
  esac
}

target_log_file() {
  case "$1" in
    api) echo "${PROJECT_ROOT}/services/api/storage/logs/api.log" ;;
    worker) echo "${PROJECT_ROOT}/services/worker/storage/logs/worker.log" ;;
    *)
      return 1
      ;;
  esac
}

session_exists() {
  tmux has-session -t "$1" >/dev/null 2>&1
}

canonical_dir() {
  local path="$1"
  (cd "${path}" 2>/dev/null && pwd -P)
}

process_cwd() {
  local pid="$1"
  local proc_root="${PROC_ROOT:-/proc}"

  canonical_dir "${proc_root}/${pid}/cwd"
}

find_project_worker_pids() {
  local worker_root
  local pid
  local cwd

  worker_root="$(canonical_dir "${PROJECT_ROOT}/services/worker")" || return

  if ! command -v pgrep >/dev/null 2>&1; then
    return
  fi

  while IFS= read -r pid; do
    [[ "${pid}" =~ ^[0-9]+$ ]] || continue
    cwd="$(process_cwd "${pid}")" || continue
    if [[ "${cwd}" == "${worker_root}" || "${cwd}" == "${worker_root}/"* ]]; then
      printf '%s\n' "${pid}"
    fi
  done < <(pgrep -f "[c]elery -A app.celery_app worker" 2>/dev/null || true)
}

wait_for_pids_exit() {
  local pids=("$@")
  local pid
  local alive

  for _ in {1..40}; do
    alive=0
    for pid in "${pids[@]}"; do
      if kill -0 "${pid}" >/dev/null 2>&1; then
        alive=1
        break
      fi
    done
    if [[ "${alive}" -eq 0 ]]; then
      return 0
    fi
    sleep 0.25
  done

  return 1
}

running_pids_text() {
  local pids=("$@")
  local running=()
  local pid

  for pid in "${pids[@]}"; do
    if kill -0 "${pid}" >/dev/null 2>&1; then
      running+=("${pid}")
    fi
  done

  echo "${running[*]}"
}

stop_project_worker_processes() {
  local pids=()
  local pid
  local running

  while IFS= read -r pid; do
    [[ -n "${pid}" ]] && pids+=("${pid}")
  done < <(find_project_worker_pids)

  if [[ "${#pids[@]}" -eq 0 ]]; then
    return
  fi

  echo "worker: stopping celery process(es): ${pids[*]}" >&2
  for pid in "${pids[@]}"; do
    kill "${pid}" >/dev/null 2>&1 || true
  done

  if wait_for_pids_exit "${pids[@]}"; then
    return
  fi

  for pid in "${pids[@]}"; do
    kill -9 "${pid}" >/dev/null 2>&1 || true
  done

  if wait_for_pids_exit "${pids[@]}"; then
    return
  fi

  running="$(running_pids_text "${pids[@]}")"
  echo "worker: celery process(es) still running after SIGKILL: ${running}" >&2
  return 1
}

api_port_available() {
  "${PROJECT_ROOT}/services/api/.venv/bin/python" - "${API_HOST}" "${API_PORT}" <<'PY' >/dev/null 2>&1
import socket
import sys

host = sys.argv[1]
port = int(sys.argv[2])

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind((host, port))
    except OSError:
        sys.exit(1)
PY
}

print_api_port_diagnostics() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${API_PORT}" -sTCP:LISTEN >&2 || true
  else
    echo "lsof is not available; cannot list the process using API_PORT=${API_PORT}." >&2
  fi
}

kill_api_port_listeners() {
  local pids=()

  if api_port_available; then
    return
  fi

  if ! command -v lsof >/dev/null 2>&1; then
    echo "api: lsof is required to reclaim ${API_HOST}:${API_PORT} during restart" >&2
    exit 1
  fi

  while IFS= read -r pid; do
    [[ -n "${pid}" ]] && pids+=("${pid}")
  done < <(lsof -t -iTCP:"${API_PORT}" -sTCP:LISTEN 2>/dev/null || true)
  if [[ "${#pids[@]}" -eq 0 ]]; then
    return
  fi

  echo "api: ${API_HOST}:${API_PORT} is still in use after stopping tmux session ${API_SESSION}; killing listener(s): ${pids[*]}" >&2
  for pid in "${pids[@]}"; do
    kill "${pid}" >/dev/null 2>&1 || true
  done

  for _ in {1..40}; do
    if api_port_available; then
      return
    fi
    sleep 0.25
  done

  for pid in "${pids[@]}"; do
    kill -9 "${pid}" >/dev/null 2>&1 || true
  done

  for _ in {1..40}; do
    if api_port_available; then
      return
    fi
    sleep 0.25
  done

  echo "api: ${API_HOST}:${API_PORT} is still in use after killing listener(s) ${pids[*]}" >&2
  print_api_port_diagnostics
  exit 1
}

ensure_api_port_available() {
  if api_port_available; then
    return
  fi

  echo "api: ${API_HOST}:${API_PORT} is already in use; not starting tmux session ${API_SESSION}" >&2
  print_api_port_diagnostics
  exit 1
}

wait_for_api_port_release() {
  for _ in {1..40}; do
    if api_port_available; then
      return
    fi
    sleep 0.25
  done

  echo "api: ${API_HOST}:${API_PORT} is still in use after stopping tmux session ${API_SESSION}" >&2
  print_api_port_diagnostics
  exit 1
}

check_start_prerequisites() {
  require_path "${PROJECT_ROOT}/Makefile" "Missing Makefile under PROJECT_ROOT=${PROJECT_ROOT}."
  require_path "${PROJECT_ROOT}/services/api/.venv/bin/python" "Missing API virtualenv. Run: cd ${PROJECT_ROOT} && make deps"
  require_path "${PROJECT_ROOT}/services/worker/.venv/bin/python" "Missing worker virtualenv. Run: cd ${PROJECT_ROOT} && make deps"
  require_path "${PROJECT_ROOT}/apps/web/node_modules/.bin/next" "Missing Web dependencies. Run: cd ${PROJECT_ROOT}/apps/web && npm install"
  require_path "${PROJECT_ROOT}/apps/web/.next/BUILD_ID" "Missing Web production build. Run: cd ${PROJECT_ROOT} && scripts/prod-apps.sh build-web"
  require_api_python_module "edge_tts" "Run: cd ${PROJECT_ROOT} && make deps"
}

start_one() {
  local target="$1"
  local session
  local command

  session="$(target_to_session "${target}")"
  command="$(target_to_command "${target}")"

  if [[ "${target}" == "worker" ]]; then
    if session_exists "${session}"; then
      echo "${target}: stopping tmux session ${session} before cleaning celery processes"
      tmux kill-session -t "${session}"
    fi
    stop_project_worker_processes
  fi

  if session_exists "${session}"; then
    echo "${target}: already running in tmux session ${session}"
    return
  fi

  if [[ "${target}" == "api" ]]; then
    ensure_api_port_available
  fi

  echo "${target}: starting in tmux session ${session}"
  tmux new-session -d -s "${session}" "${command}"
}

stop_one() {
  local target="$1"
  local session

  session="$(target_to_session "${target}")"

  if ! session_exists "${session}"; then
    echo "${target}: tmux session ${session} is not running"
    if [[ "${target}" == "worker" ]]; then
      stop_project_worker_processes
    fi
    return
  fi

  echo "${target}: stopping tmux session ${session}"
  tmux kill-session -t "${session}"
  if [[ "${target}" == "worker" ]]; then
    stop_project_worker_processes
  fi
}

status_one() {
  local target="$1"
  local session

  session="$(target_to_session "${target}")"

  if session_exists "${session}"; then
    echo "${target}: running (${session})"
  else
    echo "${target}: stopped (${session})"
  fi
}

status_all() {
  status_one api
  status_one worker
  status_one web

  if command -v curl >/dev/null 2>&1; then
    if curl -fsS --max-time 2 "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
      echo "api health: ok"
    else
      echo "api health: unavailable at http://127.0.0.1:${API_PORT}/health"
    fi
  fi
}

start_all() {
  check_start_prerequisites
  start_checked_all
}

stop_all() {
  stop_one web
  stop_one worker
  stop_one api
}

start_checked_all() {
  start_one api
  start_one worker
  start_one web
  status_all
}

restart_all() {
  check_start_prerequisites
  stop_all
  kill_api_port_listeners
  wait_for_api_port_release
  start_checked_all
}

show_logs() {
  local target="$1"
  local session
  local log_file

  if [[ -z "${target}" ]]; then
    usage
    exit 2
  fi

  if log_file="$(target_log_file "${target}" 2>/dev/null)" && [[ -f "${log_file}" ]]; then
    tail -n 120 "${log_file}"
    return
  fi

  session="$(target_to_session "${target}")"
  if ! session_exists "${session}"; then
    echo "${target}: tmux session ${session} is not running" >&2
    exit 1
  fi

  tmux capture-pane -t "${session}" -p -S -120
}

attach_session() {
  local target="$1"
  local session

  if [[ -z "${target}" ]]; then
    usage
    exit 2
  fi

  session="$(target_to_session "${target}")"
  if ! session_exists "${session}"; then
    echo "${target}: tmux session ${session} is not running" >&2
    exit 1
  fi

  exec tmux attach-session -t "${session}"
}

build_web() {
  require_npm
  require_path "${PROJECT_ROOT}/apps/web/package.json" "Missing Web package.json under PROJECT_ROOT=${PROJECT_ROOT}."

  cd "${PROJECT_ROOT}/apps/web"

  if command -v tmux >/dev/null 2>&1 && session_exists "${WEB_SESSION}"; then
    echo "web: stopping tmux session ${WEB_SESSION} before rebuilding"
    tmux kill-session -t "${WEB_SESSION}"
  fi

  local static_backup=""
  local build_backup=""
  if [[ -d .next ]]; then
    build_backup="$(mktemp -d)"
    cp -a .next "${build_backup}/next"
  fi

  if [[ -d .next/static ]]; then
    static_backup="$(mktemp -d)"
    cp -a .next/static/. "${static_backup}/"
  fi

  local build_node_options="${WEB_BUILD_NODE_OPTIONS:-${NODE_OPTIONS:-}}"
  if [[ -z "${build_node_options}" ]]; then
    build_node_options="--max-old-space-size=256"
  elif [[ "${build_node_options}" != *"--max-old-space-size="* ]]; then
    build_node_options="${build_node_options} --max-old-space-size=256"
  fi

  local build_cpus="${WEB_BUILD_CPUS:-${NEXT_BUILD_CPUS:-1}}"
  if ! [[ "${build_cpus}" =~ ^[1-9][0-9]*$ ]]; then
    echo "WEB_BUILD_CPUS/NEXT_BUILD_CPUS must be a positive integer, got: ${build_cpus}" >&2
    rm -rf "${static_backup}" "${build_backup}"
    exit 2
  fi

  set +e
  npm install
  local install_status="$?"
  set -e
  if [[ "${install_status}" -ne 0 ]]; then
    echo "web: npm install failed with exit code ${install_status}" >&2
    rm -rf "${static_backup}" "${build_backup}"
    return "${install_status}"
  fi

  rm -rf .next

  set +e
  env \
    NODE_OPTIONS="${build_node_options}" \
    NEXT_BUILD_CPUS="${build_cpus}" \
    NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL}" \
    npm run build
  local build_status="$?"
  set -e

  if [[ "${build_status}" -ne 0 ]]; then
    if [[ -n "${build_backup}" && -d "${build_backup}/next" ]]; then
      rm -rf .next
      cp -a "${build_backup}/next" .next
      echo "web: build failed; restored the previous .next build." >&2
    else
      rm -rf .next
    fi

    rm -rf "${static_backup}" "${build_backup}"

    if [[ "${build_status}" -eq 137 ]]; then
      cat >&2 <<EOF
web: npm run build exited with 137 (SIGKILL).
web: this usually means the server or hosting panel killed Next.js because memory was exhausted.
web: check on the server with: free -h; dmesg -T | grep -Ei 'killed process|out of memory|oom'
web: low-memory defaults are active: NODE_OPTIONS=${build_node_options} NEXT_BUILD_CPUS=${build_cpus}
web: if memory allows, retry with WEB_BUILD_NODE_OPTIONS='--max-old-space-size=384' or add swap before building.
EOF
    else
      echo "web: npm run build failed with exit code ${build_status}" >&2
    fi

    return "${build_status}"
  fi

  if [[ -n "${static_backup}" ]]; then
    mkdir -p .next/static
    cp -a "${static_backup}/." .next/static/
    rm -rf "${static_backup}"
  fi
  rm -rf "${build_backup}"

  cat .next/BUILD_ID
}

doctor() {
  check_start_prerequisites

  cat <<EOF
Project root: ${PROJECT_ROOT}
Sessions:
  api: ${API_SESSION}
  worker: ${WORKER_SESSION}
  web: ${WEB_SESSION}
Ports:
  api: ${API_HOST}:${API_PORT}
  web: ${WEB_HOST}:${WEB_PORT}
API URLs:
  API_BASE_URL=${API_BASE_URL}
  NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
Commands:
  api: $(api_command)
  worker: $(worker_command)
  web: $(web_command)
EOF
}

case "${ACTION}" in
  restart)
    require_tmux
    restart_all
    ;;
  start)
    require_tmux
    start_all
    ;;
  stop)
    require_tmux
    stop_all
    ;;
  status)
    require_tmux
    status_all
    ;;
  logs)
    require_tmux
    show_logs "${TARGET}"
    ;;
  attach)
    require_tmux
    attach_session "${TARGET}"
    ;;
  build-web)
    build_web
    ;;
  doctor)
    require_tmux
    doctor
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 2
    ;;
esac
