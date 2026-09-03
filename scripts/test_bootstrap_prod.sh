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
  "${FAKE_ROOT}/services/api/.venv/bin" \
  "${FAKE_ROOT}/services/worker/.venv/bin" \
  "${FAKE_ROOT}/apps/web/node_modules/.bin" \
  "${FAKE_ROOT}/apps/web/.next"

cat >"${FAKE_ROOT}/Makefile" <<'EOF'
.PHONY: deps up init-db
deps:
	@true
up:
	@true
init-db:
	@true
EOF

cat >"${FAKE_ROOT}/.env.example" <<'EOF'
DATABASE_URL=postgresql+psycopg://web_reader:web_reader@localhost:15432/web_reader
REDIS_URL=redis://localhost:16379/0
API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
API_PORT=8000
WEB_PORT=3000
EOF

cat >"${FAKE_ROOT}/scripts/prod-apps.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "${PROD_APPS_CALL_LOG:?}"

case "${1:-}" in
  build-web)
    mkdir -p "${PROJECT_ROOT}/apps/web/.next"
    printf '%s\n' "bootstrap-build-id" > "${PROJECT_ROOT}/apps/web/.next/BUILD_ID"
    ;;
  restart)
    ;;
esac
EOF
chmod +x "${FAKE_ROOT}/scripts/prod-apps.sh"

cat >"${FAKE_BIN}/make" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf 'make %s\n' "$*" >> "${MAKE_CALL_LOG:?}"

case "${1:-}" in
  deps)
    mkdir -p \
      "${PROJECT_ROOT}/services/api/.venv/bin" \
      "${PROJECT_ROOT}/services/worker/.venv/bin" \
      "${PROJECT_ROOT}/apps/web/node_modules/.bin" \
      "${PROJECT_ROOT}/apps/web/.next"
    printf '%s\n' "#!/usr/bin/env bash" > "${PROJECT_ROOT}/services/api/.venv/bin/python"
    printf '%s\n' "exit 0" >> "${PROJECT_ROOT}/services/api/.venv/bin/python"
    chmod +x "${PROJECT_ROOT}/services/api/.venv/bin/python"
    printf '%s\n' "#!/usr/bin/env bash" > "${PROJECT_ROOT}/services/worker/.venv/bin/python"
    printf '%s\n' "exit 0" >> "${PROJECT_ROOT}/services/worker/.venv/bin/python"
    chmod +x "${PROJECT_ROOT}/services/worker/.venv/bin/python"
    printf '%s\n' "#!/usr/bin/env bash" > "${PROJECT_ROOT}/apps/web/node_modules/.bin/next"
    printf '%s\n' "exit 0" >> "${PROJECT_ROOT}/apps/web/node_modules/.bin/next"
    chmod +x "${PROJECT_ROOT}/apps/web/node_modules/.bin/next"
    printf '%s\n' "build-id" > "${PROJECT_ROOT}/apps/web/.next/BUILD_ID"
    ;;
  up|init-db)
    if [[ "${1:-}" == "init-db" ]]; then
      printf 'ADMIN_BOOTSTRAP_EMAIL=%s\n' "${ADMIN_BOOTSTRAP_EMAIL:-}" >> "${MAKE_ENV_LOG:?}"
      printf 'ADMIN_BOOTSTRAP_PASSWORD=%s\n' "${ADMIN_BOOTSTRAP_PASSWORD:-}" >> "${MAKE_ENV_LOG:?}"
    fi
    ;;
esac
EOF
chmod +x "${FAKE_BIN}/make"

cat >"${FAKE_BIN}/sudo" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "${SUDO_CALL_LOG:?}"
exec "$@"
EOF
chmod +x "${FAKE_BIN}/sudo"

cat >"${FAKE_BIN}/apt-get" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf 'apt-get %s\n' "$*" >> "${APT_GET_CALL_LOG:?}"
exit 0
EOF
chmod +x "${FAKE_BIN}/apt-get"

cat >"${FAKE_BIN}/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "${DOCKER_CALL_LOG:?}"

case "${1:-}" in
  info)
    exit 0
    ;;
  compose)
    if [[ "${2:-}" == "version" ]]; then
      exit 0
    fi
    exit 0
    ;;
esac
exit 0
EOF
chmod +x "${FAKE_BIN}/docker"

cat >"${FAKE_BIN}/python3.12" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-V" || "${1:-}" == "--version" ]]; then
  echo "Python 3.12.4"
  exit 0
fi

exit 0
EOF
chmod +x "${FAKE_BIN}/python3.12"

cat >"${FAKE_BIN}/node" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-v" || "${1:-}" == "--version" ]]; then
  echo "v20.0.0"
  exit 0
fi

exit 0
EOF
chmod +x "${FAKE_BIN}/node"

cat >"${FAKE_BIN}/npm" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-v" || "${1:-}" == "--version" ]]; then
  echo "10.0.0"
  exit 0
fi

exit 0
EOF
chmod +x "${FAKE_BIN}/npm"

cat >"${FAKE_BIN}/tmux" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "${FAKE_BIN}/tmux"

cat >"${FAKE_BIN}/ffmpeg" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "${FAKE_BIN}/ffmpeg"

cat >"${FAKE_BIN}/curl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "${FAKE_BIN}/curl"

cat >"${FAKE_BIN}/git" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "${FAKE_BIN}/git"

cat >"${FAKE_BIN}/lsof" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "${FAKE_BIN}/lsof"

for command_name in cp mkdir rm touch cat sed grep awk mktemp ln chmod dirname basename head tail sort tr env id uname pwd tee mv; do
  ln -s "$(command -v "${command_name}")" "${FAKE_BIN}/${command_name}"
done
ln -s "$(command -v bash)" "${FAKE_BIN}/bash"

set +e
output="$(
  PATH="${FAKE_BIN}" \
  PROJECT_ROOT="${FAKE_ROOT}" \
  MAKE_CALL_LOG="${TMP_DIR}/make.log" \
  MAKE_ENV_LOG="${TMP_DIR}/make-env.log" \
  PROD_APPS_CALL_LOG="${TMP_DIR}/prod-apps.log" \
  SUDO_CALL_LOG="${TMP_DIR}/sudo.log" \
  APT_GET_CALL_LOG="${TMP_DIR}/apt-get.log" \
  DOCKER_CALL_LOG="${TMP_DIR}/docker.log" \
  "${PROJECT_ROOT}/scripts/bootstrap-prod.sh" <<<'bad-email
admin@example.com
Boot1234
' 2>&1
)"
status="$?"
set -e

if [[ "${status}" -ne 0 ]]; then
  printf 'bootstrap-prod failed unexpectedly.\n\nOutput:\n%s\n' "${output}" >&2
  exit 1
fi

if [[ ! -f "${FAKE_ROOT}/.env" ]]; then
  printf 'Expected bootstrap-prod to create .env from .env.example.\n' >&2
  exit 1
fi

if ! grep -F "make up" "${TMP_DIR}/make.log" >/dev/null; then
  printf 'Expected bootstrap-prod to call make up.\n' >&2
  exit 1
fi

if ! grep -F "deps" "${TMP_DIR}/make.log" >/dev/null; then
  printf 'Expected bootstrap-prod to call make deps.\n' >&2
  exit 1
fi

if ! grep -F "init-db" "${TMP_DIR}/make.log" >/dev/null; then
  printf 'Expected bootstrap-prod to call make init-db.\n' >&2
  exit 1
fi

if ! grep -F "must be a valid email address" <<<"${output}" >/dev/null; then
  printf 'Expected bootstrap-prod to validate the bootstrap email format.\n' >&2
  exit 1
fi

if ! grep -F "ADMIN_BOOTSTRAP_EMAIL=admin@example.com" "${TMP_DIR}/make-env.log" >/dev/null; then
  printf 'Expected bootstrap-prod to pass the prompted admin email to make init-db.\n' >&2
  exit 1
fi

if ! grep -F "ADMIN_BOOTSTRAP_PASSWORD=Boot1234" "${TMP_DIR}/make-env.log" >/dev/null; then
  printf 'Expected bootstrap-prod to pass the prompted admin password to make init-db.\n' >&2
  exit 1
fi

if ! grep -F "build-web" "${TMP_DIR}/prod-apps.log" >/dev/null; then
  printf 'Expected bootstrap-prod to call scripts/prod-apps.sh build-web.\n' >&2
  exit 1
fi

if ! grep -F "restart" "${TMP_DIR}/prod-apps.log" >/dev/null; then
  printf 'Expected bootstrap-prod to call scripts/prod-apps.sh restart.\n' >&2
  exit 1
fi

if ! grep -F "Application entry:" <<<"${output}" >/dev/null; then
  printf 'Expected bootstrap-prod to print the application entry.\n' >&2
  exit 1
fi

if ! grep -F "Web: http://127.0.0.1:3000" <<<"${output}" >/dev/null; then
  printf 'Expected bootstrap-prod to print the Web application URL.\n' >&2
  exit 1
fi

if ! grep -F "API health: http://127.0.0.1:8000/health" <<<"${output}" >/dev/null; then
  printf 'Expected bootstrap-prod to print the API health URL.\n' >&2
  exit 1
fi

MISSING_ROOT="${TMP_DIR}/web_reader_missing"
MISSING_BIN="${TMP_DIR}/bin-missing"
cp -R "${FAKE_ROOT}" "${MISSING_ROOT}"
rm -f "${MISSING_ROOT}/.env"
rm -rf "${MISSING_BIN}"
mkdir -p "${MISSING_BIN}"

for command_name in cp mkdir rm touch cat sed grep awk mktemp ln chmod dirname basename head tail sort tr env id uname pwd tee mv bash; do
  ln -s "$(command -v "${command_name}")" "${MISSING_BIN}/${command_name}"
done

cp "${FAKE_BIN}/make" "${MISSING_BIN}/make"
cp "${FAKE_BIN}/sudo" "${MISSING_BIN}/sudo"
cp "${FAKE_BIN}/apt-get" "${MISSING_BIN}/apt-get"
cp "${FAKE_BIN}/curl" "${MISSING_BIN}/curl"
cp "${FAKE_BIN}/tmux" "${MISSING_BIN}/tmux"
cp "${FAKE_BIN}/ffmpeg" "${MISSING_BIN}/ffmpeg"
cp "${FAKE_BIN}/lsof" "${MISSING_BIN}/lsof"

cat >"${MISSING_BIN}/python3" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-V" || "${1:-}" == "--version" ]]; then
  echo "Python 3.10.12"
  exit 0
fi

exit 1
EOF
chmod +x "${MISSING_BIN}/python3"

cat >"${MISSING_BIN}/apt-get" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf 'apt-get %s\n' "$*" >> "${APT_GET_CALL_LOG:?}"

if [[ "${1:-}" == "install" ]]; then
  cat >"${INSTALL_BIN_DIR}/git" <<'WRAPPER'
#!/usr/bin/env bash
exit 0
WRAPPER
  chmod +x "${INSTALL_BIN_DIR}/git"

  cat >"${INSTALL_BIN_DIR}/docker" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  info)
    exit 0
    ;;
  compose)
    if [[ "${2:-}" == "version" ]]; then
      exit 0
    fi
    exit 0
    ;;
esac
exit 0
WRAPPER
  chmod +x "${INSTALL_BIN_DIR}/docker"

  cat >"${INSTALL_BIN_DIR}/node" <<'WRAPPER'
#!/usr/bin/env bash
exit 0
WRAPPER
  chmod +x "${INSTALL_BIN_DIR}/node"

  cat >"${INSTALL_BIN_DIR}/npm" <<'WRAPPER'
#!/usr/bin/env bash
exit 0
WRAPPER
  chmod +x "${INSTALL_BIN_DIR}/npm"

  cat >"${INSTALL_BIN_DIR}/python3.12" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-V" || "${1:-}" == "--version" ]]; then
  echo "Python 3.12.4"
  exit 0
fi
exit 0
WRAPPER
  chmod +x "${INSTALL_BIN_DIR}/python3.12"
fi
EOF
chmod +x "${MISSING_BIN}/apt-get"

set +e
missing_output="$(
  PATH="${MISSING_BIN}" \
  PROJECT_ROOT="${MISSING_ROOT}" \
  MAKE_CALL_LOG="${TMP_DIR}/make-missing.log" \
  MAKE_ENV_LOG="${TMP_DIR}/make-env-missing.log" \
  PROD_APPS_CALL_LOG="${TMP_DIR}/prod-apps-missing.log" \
  SUDO_CALL_LOG="${TMP_DIR}/sudo-missing.log" \
  APT_GET_CALL_LOG="${TMP_DIR}/apt-get-missing.log" \
  DOCKER_CALL_LOG="${TMP_DIR}/docker-missing.log" \
  INSTALL_BIN_DIR="${MISSING_BIN}" \
  "${PROJECT_ROOT}/scripts/bootstrap-prod.sh" <<<'admin@example.com
Boot1234
' 2>&1
)"
missing_status="$?"
set -e

if [[ "${missing_status}" -ne 0 ]]; then
  printf 'bootstrap-prod missing-dependency flow failed unexpectedly.\n\nOutput:\n%s\n' "${missing_output}" >&2
  exit 1
fi

if ! grep -F "apt-get install" "${TMP_DIR}/apt-get-missing.log" >/dev/null; then
  printf 'Expected bootstrap-prod to install missing host packages.\n' >&2
  exit 1
fi

if ! grep -F "docker.io" "${TMP_DIR}/apt-get-missing.log" >/dev/null; then
  printf 'Expected bootstrap-prod to install Docker when it is missing.\n' >&2
  exit 1
fi

if ! grep -F "python3.12" "${TMP_DIR}/apt-get-missing.log" >/dev/null; then
  printf 'Expected bootstrap-prod to install Python 3.12 when it is missing.\n' >&2
  exit 1
fi

BREW_ROOT="${TMP_DIR}/web_reader_brew"
BREW_BIN="${TMP_DIR}/bin-brew"
cp -R "${FAKE_ROOT}" "${BREW_ROOT}"
rm -f "${BREW_ROOT}/.env"
rm -rf "${BREW_BIN}"
cp -R "${FAKE_BIN}" "${BREW_BIN}"
rm -f "${BREW_BIN}/apt-get" "${BREW_BIN}/tmux" "${BREW_BIN}/ffmpeg"

cat >"${BREW_BIN}/brew" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf 'brew %s\n' "$*" >> "${BREW_CALL_LOG:?}"
exit 0
EOF
chmod +x "${BREW_BIN}/brew"

set +e
brew_output="$(
  PATH="${BREW_BIN}" \
  PROJECT_ROOT="${BREW_ROOT}" \
  MAKE_CALL_LOG="${TMP_DIR}/make-brew.log" \
  MAKE_ENV_LOG="${TMP_DIR}/make-env-brew.log" \
  PROD_APPS_CALL_LOG="${TMP_DIR}/prod-apps-brew.log" \
  SUDO_CALL_LOG="${TMP_DIR}/sudo-brew.log" \
  BREW_CALL_LOG="${TMP_DIR}/brew.log" \
  DOCKER_CALL_LOG="${TMP_DIR}/docker-brew.log" \
  "${PROJECT_ROOT}/scripts/bootstrap-prod.sh" <<<'admin@example.com
Boot1234
' 2>&1
)"
brew_status="$?"
set -e

if [[ "${brew_status}" -ne 0 ]]; then
  printf 'bootstrap-prod brew flow failed unexpectedly.\n\nOutput:\n%s\n' "${brew_output}" >&2
  exit 1
fi

if ! grep -F "brew install" "${TMP_DIR}/brew.log" >/dev/null; then
  printf 'Expected bootstrap-prod to install missing host packages with brew.\n' >&2
  exit 1
fi

if ! grep -F "tmux" "${TMP_DIR}/brew.log" >/dev/null; then
  printf 'Expected bootstrap-prod to request tmux from brew.\n' >&2
  exit 1
fi

if ! grep -F "ffmpeg" "${TMP_DIR}/brew.log" >/dev/null; then
  printf 'Expected bootstrap-prod to request ffmpeg from brew.\n' >&2
  exit 1
fi

printf '%s\n' "bootstrap-prod smoke test passed"
