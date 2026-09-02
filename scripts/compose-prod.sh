#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
source "${SCRIPT_DIR}/bootstrap-admin-account.sh"
ENV_FILE="${PROJECT_ROOT}/.env"
ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"
COMPOSE_ENV_DIR="${PROJECT_ROOT}/storage/deploy"
COMPOSE_ENV_FILE="${COMPOSE_ENV_DIR}/compose-prod.env"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.prod.yml"

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

compose_host_port() {
  local value="$1"
  local default_value="$2"

  if [[ -n "$value" ]]; then
    printf '%s' "$value"
  else
    printf '%s' "$default_value"
  fi
}

trim_env_line() {
  local text="$1"
  text="${text%$'\r'}"
  text="${text#"${text%%[![:space:]]*}"}"
  text="${text%"${text##*[![:space:]]}"}"
  printf '%s' "$text"
}

read_env_file_value() {
  local file="$1"
  local key="$2"
  local raw_line line value

  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    line="$(trim_env_line "$raw_line")"
    [[ -z "$line" || "$line" == \#* ]] && continue
    if [[ "$line" == export\ * ]]; then
      line="${line#export }"
      line="$(trim_env_line "$line")"
    fi
    [[ "$line" == *"="* ]] || continue
    if [[ "${line%%=*}" != "$key" ]]; then
      continue
    fi
    value="${line#*=}"
    if [[ "${#value}" -ge 2 && "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
      value="${value:1:-1}"
    elif [[ "${#value}" -ge 2 && "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
      value="${value:1:-1}"
    fi
    printf '%s' "$value"
    return 0
  done <"$file"

  return 1
}

ensure_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    [[ -f "$ENV_EXAMPLE" ]] || die "Missing .env.example at $ENV_EXAMPLE"
    cp "$ENV_EXAMPLE" "$ENV_FILE"
  fi
}

load_env_file_path() {
  local file="$1"

  if [[ -f "$file" ]]; then
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
    done <"$file"
  fi
}

load_env_file() {
  load_env_file_path "$ENV_FILE"
}

print_compose_env_examples() {
  cat >&2 <<'EOF'
  DATABASE_URL=postgresql+psycopg://<db_user>:<db_password>@<db_host>:5432/web_reader
  REDIS_URL=redis://:<redis_password>@<redis_host>:6379/0
  TTS_STORAGE_BACKEND=local
  URL_IMPORT_IMAGE_STORAGE_BACKEND=local
  # or, if you use R2/S3/MinIO:
  TTS_STORAGE_BACKEND=r2
  URL_IMPORT_IMAGE_STORAGE_BACKEND=r2
  S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
  S3_ACCESS_KEY_ID=<r2-access-key>
  S3_SECRET_ACCESS_KEY=<r2-secret-key>
  S3_BUCKET=pagealong-media-prod
EOF
}

PROMPTED_ENV_HEADER_PRINTED=0

print_compose_env_prompt_header() {
  if [[ "$PROMPTED_ENV_HEADER_PRINTED" -eq 1 ]]; then
    return 0
  fi

  cat >&2 <<EOF
compose-prod needs a few production values before it can continue.
Values left empty or unchanged from .env.example will be written back to:
  $ENV_FILE

EOF
  PROMPTED_ENV_HEADER_PRINTED=1
}

env_value_needs_input() {
  local key="$1"
  local current_value example_value

  current_value="$(read_env_file_value "$ENV_FILE" "$key" || true)"
  example_value="$(read_env_file_value "$ENV_EXAMPLE" "$key" || true)"
  if [[ -z "$current_value" || "$current_value" == "$example_value" ]]; then
    return 0
  fi

  return 1
}

compose_env_prompt_example() {
  case "$1" in
    DATABASE_URL)
      printf '%s' "postgresql+psycopg://pagealong:change-me@db.example.com:5432/pagealong"
      ;;
    REDIS_URL)
      printf '%s' "redis://:change-me@redis.example.com:6379/0"
      ;;
    S3_ENDPOINT_URL)
      printf '%s' "https://<account-id>.r2.cloudflarestorage.com"
      ;;
    S3_ACCESS_KEY_ID)
      printf '%s' "pagealong-r2-access-key"
      ;;
    S3_SECRET_ACCESS_KEY)
      printf '%s' "pagealong-r2-secret-key"
      ;;
    S3_BUCKET)
      printf '%s' "pagealong-media-prod"
      ;;
    *)
      printf '%s' "<value>"
      ;;
  esac
}

prompt_env_value() {
  local key="$1"
  local example
  local value

  example="$(compose_env_prompt_example "$key")"
  print_compose_env_prompt_header

  while true; do
    printf '%s\n' "$key" >&2
    printf '  example: %s=%s\n' "$key" "$example" >&2
    printf '  value: ' >&2
    if ! IFS= read -r value; then
      die "Input required for $key. Re-run make compose-prod and enter a value."
    fi
    value="$(trim_env_line "$value")"
    if [[ -n "$value" ]]; then
      printf '%s' "$value"
      return 0
    fi
    printf '  %s cannot be empty.\n' "$key" >&2
  done
}

prompt_storage_backend() {
  local key="$1"
  local default_value="$2"
  local value

  print_compose_env_prompt_header

  while true; do
    printf '%s\n' "$key" >&2
    printf '  choose one of: local, r2, s3, minio\n' >&2
    printf '  example: %s=local\n' "$key" >&2
    printf '  value [%s]: ' "$default_value" >&2
    if ! IFS= read -r value; then
      die "Input required for $key. Re-run make compose-prod and enter a value."
    fi
    value="$(trim_env_line "$value")"
    if [[ -z "$value" ]]; then
      value="$default_value"
    fi
    case "$value" in
      local|r2|s3|minio)
        printf '%s' "$value"
        return 0
        ;;
      *)
        printf '  %s must be one of: local, r2, s3, minio.\n' "$key" >&2
        ;;
    esac
  done
}

set_and_export_env_value() {
  local key="$1"
  local value="$2"

  set_env_value "$ENV_FILE" "$key" "$value"
  export "${key}=${value}"
}

storage_backend_requires_object_storage() {
  case "$1" in
    r2|s3|minio) return 0 ;;
    *) return 1 ;;
  esac
}

object_storage_env_needs_input() {
  local key

  for key in S3_ENDPOINT_URL S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_BUCKET; do
    if env_value_needs_input "$key"; then
      return 0
    fi
  done

  return 1
}

storage_backend_needs_input() {
  local key="$1"
  local current_value example_value

  current_value="$(read_env_file_value "$ENV_FILE" "$key" || true)"
  example_value="$(read_env_file_value "$ENV_EXAMPLE" "$key" || true)"

  if [[ -z "$current_value" ]]; then
    return 0
  fi

  if [[ "$current_value" == "$example_value" ]] \
    && storage_backend_requires_object_storage "$current_value" \
    && object_storage_env_needs_input; then
    return 0
  fi

  return 1
}

ensure_compose_env_values() {
  local value tts_backend
  local requires_object_storage=0

  if env_value_needs_input "DATABASE_URL"; then
    value="$(prompt_env_value "DATABASE_URL")"
    set_and_export_env_value "DATABASE_URL" "$value"
  fi

  if env_value_needs_input "REDIS_URL"; then
    value="$(prompt_env_value "REDIS_URL")"
    set_and_export_env_value "REDIS_URL" "$value"
  fi

  if storage_backend_needs_input "TTS_STORAGE_BACKEND"; then
    value="$(prompt_storage_backend "TTS_STORAGE_BACKEND" "local")"
    set_and_export_env_value "TTS_STORAGE_BACKEND" "$value"
  fi

  tts_backend="$(read_env_file_value "$ENV_FILE" "TTS_STORAGE_BACKEND" || true)"
  if [[ -z "$tts_backend" ]]; then
    tts_backend="${TTS_STORAGE_BACKEND:-local}"
  fi

  if storage_backend_needs_input "URL_IMPORT_IMAGE_STORAGE_BACKEND"; then
    value="$(prompt_storage_backend "URL_IMPORT_IMAGE_STORAGE_BACKEND" "$tts_backend")"
    set_and_export_env_value "URL_IMPORT_IMAGE_STORAGE_BACKEND" "$value"
  fi

  case "${TTS_STORAGE_BACKEND:-}" in
    r2|s3|minio) requires_object_storage=1 ;;
  esac

  case "${URL_IMPORT_IMAGE_STORAGE_BACKEND:-${TTS_STORAGE_BACKEND:-}}" in
    r2|s3|minio) requires_object_storage=1 ;;
  esac

  if [[ "$requires_object_storage" -eq 1 ]]; then
    for key in S3_ENDPOINT_URL S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_BUCKET; do
      if env_value_needs_input "$key"; then
        value="$(prompt_env_value "$key")"
        set_and_export_env_value "$key" "$value"
      fi
    done
  fi

  if [[ "$PROMPTED_ENV_HEADER_PRINTED" -eq 1 ]]; then
    printf '\n.env updated. Continuing compose deployment.\n' >&2
    load_env_file
  fi
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

rewrite_loopback_url_to_host_gateway() {
  local url="$1"
  local scheme userinfo host port rest

  if [[ "$url" =~ ^([a-zA-Z][a-zA-Z0-9+.-]*://)([^/@]*@)?([^/:?#]+)(:[0-9]+)?(.*)$ ]]; then
    scheme="${BASH_REMATCH[1]}"
    userinfo="${BASH_REMATCH[2]}"
    host="${BASH_REMATCH[3]}"
    port="${BASH_REMATCH[4]}"
    rest="${BASH_REMATCH[5]}"
    if is_loopback_host "$host"; then
      printf '%s%s%s%s%s' "${scheme}" "${userinfo:-}" "host.docker.internal" "${port:-}" "${rest:-}"
      return 0
    fi
  fi

  printf '%s' "$url"
}

choose_compose_command() {
  if command_exists docker && docker compose version >/dev/null 2>&1; then
    printf '%s' "docker compose"
    return 0
  fi

  if command_exists docker-compose; then
    printf '%s' "docker-compose"
    return 0
  fi

  die "Docker Compose is required for make compose-prod."
}

ensure_compose_env_dir() {
  mkdir -p "$COMPOSE_ENV_DIR"
}

ensure_storage_dirs() {
  mkdir -p \
    "${PROJECT_ROOT}/services/api/storage" \
    "${PROJECT_ROOT}/services/worker/storage"
}

generate_compose_env_file() {
  ensure_compose_env_dir
  local tmp
  tmp="$(mktemp)"

  {
    printf 'HOST_UID=%s\n' "$(id -u)"
    printf 'HOST_GID=%s\n' "$(id -g)"
    printf 'API_HOST=0.0.0.0\n'
    printf 'API_PORT=8000\n'
    printf 'WEB_HOST=0.0.0.0\n'
    printf 'WEB_PORT=3000\n'
    printf 'API_BASE_URL=http://api:8000\n'
    printf 'NEXT_PUBLIC_API_BASE_URL=/api\n'
    printf 'API_CLI_WORKDIR=/app/services/api\n'
    printf 'API_CLI_PYTHON=/opt/venv/bin/python\n'
    printf 'REDIS_KEY_PREFIX=%s\n' "${REDIS_KEY_PREFIX:-web_reader:}"
  } >"$tmp"

  if [[ -n "${DATABASE_URL:-}" ]]; then
    printf 'DATABASE_URL=%s\n' "$(rewrite_loopback_url_to_host_gateway "${DATABASE_URL}")" >>"$tmp"
  fi
  if [[ -n "${REDIS_URL:-}" ]]; then
    printf 'REDIS_URL=%s\n' "$(rewrite_loopback_url_to_host_gateway "${REDIS_URL}")" >>"$tmp"
  fi
  if [[ -n "${S3_ENDPOINT_URL:-}" ]]; then
    printf 'S3_ENDPOINT_URL=%s\n' "$(rewrite_loopback_url_to_host_gateway "${S3_ENDPOINT_URL}")" >>"$tmp"
  fi

  for key in \
    AUTH_DEV_BYPASS \
    AUTH_CODE_HASH_SECRET \
    INTERNAL_API_HMAC_SECRET \
    INTERNAL_API_SIGNATURE_TTL_SECONDS \
    INTERNAL_API_REPLAY_STORE \
    TTS_PROVIDER_MODE \
    TTS_STORAGE_BACKEND \
    URL_IMPORT_IMAGE_STORAGE_BACKEND \
    S3_ACCESS_KEY_ID \
    S3_SECRET_ACCESS_KEY \
    S3_BUCKET \
    MEDIA_PUBLIC_BASE_URL \
    LOCAL_MEDIA_DIR \
    CORS_ALLOW_ORIGINS \
    ADMIN_BOOTSTRAP_EMAIL \
    ADMIN_BOOTSTRAP_PASSWORD
  do
    if [[ -n "${!key:-}" ]]; then
      printf '%s=%s\n' "$key" "${!key}" >>"$tmp"
    fi
  done

  mv "$tmp" "$COMPOSE_ENV_FILE"
}

load_compose_env_file() {
  load_env_file_path "$COMPOSE_ENV_FILE"
}

print_compose_access_info() {
  local web_host_port api_host_port

  web_host_port="$(compose_host_port "${WEB_HOST_PORT:-}" "3000")"
  api_host_port="$(compose_host_port "${API_HOST_PORT:-}" "8000")"

  cat <<EOF
Open the app in your browser:
  local:  http://127.0.0.1:${web_host_port}
  remote: http://<server-ip-or-domain>:${web_host_port}
API health check:
  http://127.0.0.1:${api_host_port}/health
EOF
}

ensure_docker_ready() {
  command_exists docker || die "Docker is required for compose deployment."
  docker info >/dev/null 2>&1 || die "Docker daemon is not available."
}

run_compose() {
  local compose_cmd
  compose_cmd="$(choose_compose_command)"

  # shellcheck disable=SC2086
  cd "$PROJECT_ROOT" && $compose_cmd -f "docker-compose.prod.yml" "$@"
}

main() {
  ensure_env_file
  load_env_file
  ensure_compose_env_values
  ensure_docker_ready
  ensure_storage_dirs
  generate_compose_env_file
  load_compose_env_file

  log "starting application containers with docker compose"
  run_compose up -d --build

  log "collecting bootstrap admin account"
  prompt_bootstrap_admin_account

  log "initializing the database inside the api container"
  run_compose run --rm -e ADMIN_BOOTSTRAP_EMAIL -e ADMIN_BOOTSTRAP_PASSWORD api python /app/scripts/init_database.py

  log "compose deployment complete"
  printf '\n'
  print_compose_access_info
}

main "$@"
