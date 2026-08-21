#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"
PROJECT_NAME="web_reader"
NETWORK_NAME="web_reader"
POSTGRES_CONTAINER="web_reader_postgres"
REDIS_CONTAINER="web_reader_redis"
MINIO_CONTAINER="web_reader_minio"
POSTGRES_VOLUME="web_reader_postgres_data"
MINIO_VOLUME="web_reader_minio_data"
MINIO_IMAGE="quay.io/minio/minio:RELEASE.2025-06-13T11-33-47Z"

load_env_file() {
  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
}

load_env_file

POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-15432}"
REDIS_HOST_PORT="${REDIS_HOST_PORT:-16379}"
MINIO_API_HOST_PORT="${MINIO_API_HOST_PORT:-19000}"
MINIO_CONSOLE_HOST_PORT="${MINIO_CONSOLE_HOST_PORT:-19001}"

usage() {
  echo "Usage: scripts/dev-services.sh up|down" >&2
}

has_docker_compose_plugin() {
  docker compose version >/dev/null 2>&1
}

has_docker_compose_binary() {
  command -v docker-compose >/dev/null 2>&1
}

ensure_docker_daemon() {
  if ! docker info >/dev/null 2>&1; then
    cat >&2 <<'EOF'
Docker daemon 未运行或当前 Docker CLI 无法连接 daemon。

请先启动 Docker Desktop，或确认 Docker daemon/socket 正常后再执行：

  make up

如果你只安装了 Homebrew 的 docker CLI，没有安装/启动 Docker Desktop，也会出现这个错误。
EOF
    exit 1
  fi
}

compose_up() {
  ensure_network
  ensure_volume "${POSTGRES_VOLUME}"
  ensure_volume "${MINIO_VOLUME}"
  cleanup_compose_name_conflicts

  if has_docker_compose_plugin; then
    docker compose up -d
  elif has_docker_compose_binary; then
    docker-compose up -d
  else
    return 1
  fi
}

container_exists() {
  local container_name="$1"
  docker container inspect "${container_name}" >/dev/null 2>&1
}

is_compose_container() {
  local container_name="$1"
  local project_label

  project_label="$(docker container inspect \
    --format '{{ index .Config.Labels "com.docker.compose.project" }}' \
    "${container_name}" 2>/dev/null || true)"
  [[ "${project_label}" == "${PROJECT_NAME}" ]]
}

remove_container_preserve_volumes() {
  local container_name="$1"

  if container_exists "${container_name}"; then
    echo "检测到旧容器 ${container_name}，移除容器但保留数据卷。"
    docker rm -f "${container_name}" >/dev/null
  fi
}

remove_plain_container_if_needed() {
  local container_name="$1"

  if container_exists "${container_name}" && ! is_compose_container "${container_name}"; then
    remove_container_preserve_volumes "${container_name}"
  fi
}

cleanup_compose_name_conflicts() {
  remove_plain_container_if_needed "${POSTGRES_CONTAINER}"
  remove_plain_container_if_needed "${REDIS_CONTAINER}"
  remove_plain_container_if_needed "${MINIO_CONTAINER}"

  remove_container_preserve_volumes "web_reader-postgres-1"
  remove_container_preserve_volumes "web_reader-redis-1"
  remove_container_preserve_volumes "web_reader-minio-1"
  remove_container_preserve_volumes "web_reader_postgres_1"
  remove_container_preserve_volumes "web_reader_redis_1"
  remove_container_preserve_volumes "web_reader_minio_1"
}

compose_down() {
  if has_docker_compose_plugin; then
    docker compose down
  elif has_docker_compose_binary; then
    docker-compose down
  else
    return 1
  fi
}

ensure_network() {
  docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1 || docker network create "${NETWORK_NAME}" >/dev/null
}

ensure_volume() {
  local volume_name="$1"
  docker volume inspect "${volume_name}" >/dev/null 2>&1 || docker volume create "${volume_name}" >/dev/null
}

start_or_create_postgres() {
  ensure_volume "${POSTGRES_VOLUME}"
  if docker container inspect "${POSTGRES_CONTAINER}" >/dev/null 2>&1; then
    docker start "${POSTGRES_CONTAINER}" >/dev/null
    return
  fi

  docker run -d \
    --name "${POSTGRES_CONTAINER}" \
    --network "${NETWORK_NAME}" \
    --log-driver json-file \
    --log-opt max-size=10m \
    --log-opt max-file=5 \
    -e POSTGRES_DB=web_reader \
    -e POSTGRES_USER=web_reader \
    -e POSTGRES_PASSWORD=web_reader \
    -p "${POSTGRES_HOST_PORT}:5432" \
    -v "${POSTGRES_VOLUME}:/var/lib/postgresql/data" \
    postgres:16 >/dev/null
}

start_or_create_redis() {
  if docker container inspect "${REDIS_CONTAINER}" >/dev/null 2>&1; then
    docker start "${REDIS_CONTAINER}" >/dev/null
    return
  fi

  docker run -d \
    --name "${REDIS_CONTAINER}" \
    --network "${NETWORK_NAME}" \
    --log-driver json-file \
    --log-opt max-size=10m \
    --log-opt max-file=5 \
    -p "${REDIS_HOST_PORT}:6379" \
    redis:7 >/dev/null
}

start_or_create_minio() {
  ensure_volume "${MINIO_VOLUME}"
  if docker container inspect "${MINIO_CONTAINER}" >/dev/null 2>&1; then
    docker start "${MINIO_CONTAINER}" >/dev/null
    return
  fi

  docker run -d \
    --name "${MINIO_CONTAINER}" \
    --network "${NETWORK_NAME}" \
    --log-driver json-file \
    --log-opt max-size=10m \
    --log-opt max-file=5 \
    -e MINIO_ROOT_USER=minioadmin \
    -e MINIO_ROOT_PASSWORD=minioadmin \
    -p "${MINIO_API_HOST_PORT}:9000" \
    -p "${MINIO_CONSOLE_HOST_PORT}:9001" \
    -v "${MINIO_VOLUME}:/data" \
    "${MINIO_IMAGE}" server /data --console-address ":9001" >/dev/null
}

plain_docker_up() {
  echo "未检测到 Docker Compose，使用 docker run 启动本地服务。"
  ensure_network
  start_or_create_postgres
  start_or_create_redis
  start_or_create_minio
  docker ps --filter "name=web_reader_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

plain_docker_down() {
  echo "未检测到 Docker Compose，停止 docker run 启动的本地服务。"
  docker rm -f "${POSTGRES_CONTAINER}" "${REDIS_CONTAINER}" "${MINIO_CONTAINER}" >/dev/null 2>&1 || true
}

case "${ACTION}" in
  up)
    ensure_docker_daemon
    if has_docker_compose_plugin || has_docker_compose_binary; then
      compose_up
    else
      plain_docker_up
    fi
    ;;
  down)
    ensure_docker_daemon
    if has_docker_compose_plugin || has_docker_compose_binary; then
      compose_down
    else
      plain_docker_down
    fi
    ;;
  *)
    usage
    exit 2
    ;;
esac
