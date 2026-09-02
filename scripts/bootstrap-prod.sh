#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
source "${SCRIPT_DIR}/bootstrap-admin-account.sh"
ENV_FILE="${PROJECT_ROOT}/.env"
ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"

log() {
  printf '%s\n' "$*"
}

die() {
  printf '%s\n' "$*" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

trim_env_line() {
  local text="$1"
  text="${text%$'\r'}"
  text="${text#"${text%%[![:space:]]*}"}"
  text="${text%"${text##*[![:space:]]}"}"
  printf '%s' "$text"
}

python_runtime_meets_minimum() {
  local python_bin="$1"

  "$python_bin" - <<'PY' >/dev/null 2>&1
import sys

raise SystemExit(0 if sys.version_info >= (3, 12) else 1)
PY
}

set_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp
  tmp="$(mktemp)"

  awk -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    $0 ~ "^" key "=" {
      print key "=" value
      found = 1
      next
    }
    { print }
    END {
      if (!found) {
        print key "=" value
      }
    }
  ' "$file" >"$tmp"
  mv "$tmp" "$file"
}

ensure_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ ! -f "$ENV_EXAMPLE" ]]; then
      die "Missing .env.example at $ENV_EXAMPLE"
    fi
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    set_env_value "$ENV_FILE" "API_HOST" "127.0.0.1"
    set_env_value "$ENV_FILE" "WEB_HOST" "127.0.0.1"
    set_env_value "$ENV_FILE" "API_BASE_URL" "http://127.0.0.1:8000"
    set_env_value "$ENV_FILE" "NEXT_PUBLIC_API_BASE_URL" "/api"
    set_env_value "$ENV_FILE" "CORS_ALLOW_ORIGINS" "http://127.0.0.1:3000,http://localhost:3000"
  fi
}

load_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    local raw_line line key value
    while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
      line="$(trim_env_line "$raw_line")"
      [[ -z "$line" || "$line" == \#* ]] && continue
      if [[ "$line" == export\ * ]]; then
        line="${line#export }"
        line="$(trim_env_line "$line")"
      fi
      [[ "$line" == *"="* ]] || continue
      key="${line%%=*}"
      value="${line#*=}"
      key="$(trim_env_line "$key")"
      [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
      if [[ "${#value}" -ge 2 && "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
        value="${value:1:-1}"
      elif [[ "${#value}" -ge 2 && "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
        value="${value:1:-1}"
      fi
      export "${key}=${value}"
    done <"$ENV_FILE"
  fi
}

is_loopback_host() {
  case "$1" in
    localhost|127.0.0.1|0.0.0.0|"") return 0 ;;
    *) return 1 ;;
  esac
}

url_host() {
  local url="$1"
  local host=""
  if [[ "$url" =~ ^[a-zA-Z][a-zA-Z0-9+.-]*://([^/@]+@)?([^/:?#]+) ]]; then
    host="${BASH_REMATCH[2]}"
  fi
  printf '%s' "$host"
}

needs_local_services() {
  local database_host redis_host storage_backend image_backend s3_endpoint_host
  database_host="$(url_host "${DATABASE_URL:-}")"
  redis_host="$(url_host "${REDIS_URL:-}")"
  storage_backend="${TTS_STORAGE_BACKEND:-}"
  image_backend="${URL_IMPORT_IMAGE_STORAGE_BACKEND:-}"
  s3_endpoint_host="$(url_host "${S3_ENDPOINT_URL:-}")"

  if is_loopback_host "$database_host" || is_loopback_host "$redis_host"; then
    return 0
  fi

  case "$storage_backend" in
    local|minio) return 0 ;;
  esac

  case "$image_backend" in
    local|minio) return 0 ;;
  esac

  if is_loopback_host "$s3_endpoint_host"; then
    return 0
  fi

  return 1
}

pick_python_bin() {
  if command_exists python3.12 && python_runtime_meets_minimum python3.12; then
    printf '%s' "python3.12"
    return 0
  fi
  if command_exists python3 && python_runtime_meets_minimum python3; then
    printf '%s' "python3"
    return 0
  fi
  return 1
}

check_required_commands() {
  local missing=()
  local candidate

  for candidate in git make curl tmux ffmpeg lsof docker node npm; do
    if ! command_exists "$candidate"; then
      missing+=("$candidate")
    fi
  done

  if ! command_exists python3.12 || ! python_runtime_meets_minimum python3.12; then
    if ! command_exists python3 || ! python_runtime_meets_minimum python3; then
      missing+=("python3.12")
    fi
  fi

  if [[ "${#missing[@]}" -gt 0 ]]; then
    install_missing_commands "${missing[@]}"
  fi
}

install_missing_commands() {
  local missing=("$@")
  local packages=()

  if ! command_exists apt-get; then
    die "Missing host commands: ${missing[*]}. Install them manually or use a Debian/Ubuntu host with apt-get."
  fi

  log "installing missing host dependencies: ${missing[*]}"

  case " ${missing[*]} " in
    *" git "*) packages+=("git") ;;
  esac
  case " ${missing[*]} " in
    *" make "*) packages+=("make") ;;
  esac
  case " ${missing[*]} " in
    *" curl "*) packages+=("curl") ;;
  esac
  case " ${missing[*]} " in
    *" tmux "*) packages+=("tmux") ;;
  esac
  case " ${missing[*]} " in
    *" ffmpeg "*) packages+=("ffmpeg") ;;
  esac
  case " ${missing[*]} " in
    *" lsof "*) packages+=("lsof") ;;
  esac
  case " ${missing[*]} " in
    *" docker "*) packages+=("docker.io" "docker-compose-plugin") ;;
  esac
  case " ${missing[*]} " in
    *" node "*) packages+=("nodejs") ;;
  esac
  case " ${missing[*]} " in
    *" npm "*) packages+=("npm") ;;
  esac
  case " ${missing[*]} " in
    *" python3.12 "*) packages+=("python3.12" "python3.12-venv" "python3.12-dev" "python3-pip") ;;
  esac

  if [[ "${#packages[@]}" -eq 0 ]]; then
    packages=("git" "make" "curl" "tmux" "ffmpeg" "lsof" "docker.io" "docker-compose-plugin" "nodejs" "npm" "python3.12" "python3.12-venv" "python3.12-dev" "python3-pip")
  fi

  if command_exists sudo && [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    sudo apt-get update
    sudo apt-get install -y "${packages[@]}"
  else
    apt-get update
    apt-get install -y "${packages[@]}"
  fi
}

ensure_docker_ready() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi

  if command_exists systemctl && command_exists sudo; then
    sudo systemctl enable --now docker >/dev/null 2>&1 || true
    if docker info >/dev/null 2>&1; then
      return 0
    fi
  fi

  die "Docker daemon is not available. Start Docker or install it via the bootstrap package step."
}

main() {
  ensure_env_file
  load_env_file
  check_required_commands
  ensure_docker_ready

  if needs_local_services; then
    log "bootstrapping local dependency services with make up"
    (cd "$PROJECT_ROOT" && make up)
  fi

  local python_bin
  python_bin="$(pick_python_bin)" || die "Python 3.12 or newer is required."

  log "installing project dependencies with make deps"
  (cd "$PROJECT_ROOT" && make deps PYTHON="$python_bin")

  log "collecting bootstrap admin account"
  prompt_bootstrap_admin_account

  log "initializing database with make init-db"
  (cd "$PROJECT_ROOT" && make init-db)

  log "building Web with scripts/prod-apps.sh build-web"
  (cd "$PROJECT_ROOT" && scripts/prod-apps.sh build-web)

  log "restarting services with scripts/prod-apps.sh restart"
  (cd "$PROJECT_ROOT" && scripts/prod-apps.sh restart)

  log "bootstrap complete"
}

main "$@"
