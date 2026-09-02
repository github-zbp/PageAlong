#!/usr/bin/env bash

bootstrap_admin_email_is_valid() {
  local email="$1"

  [[ "$email" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]
}

bootstrap_admin_trim_line() {
  local text="$1"

  text="${text%$'\r'}"
  text="${text#"${text%%[![:space:]]*}"}"
  text="${text%"${text##*[![:space:]]}"}"
  printf '%s' "$text"
}

prompt_bootstrap_admin_account() {
  local email=""
  local password=""

  if [[ -n "${ADMIN_BOOTSTRAP_EMAIL:-}" && -n "${ADMIN_BOOTSTRAP_PASSWORD:-}" ]]; then
    return 0
  fi

  cat >&2 <<'EOF'
Initialize the first admin account.
EOF

  while true; do
    printf '  admin email: ' >&2
    if ! IFS= read -r email; then
      printf '\n' >&2
      die "Input required for ADMIN_BOOTSTRAP_EMAIL."
    fi
    email="$(bootstrap_admin_trim_line "$email")"
    if bootstrap_admin_email_is_valid "$email"; then
      break
    fi
    printf '  ADMIN_BOOTSTRAP_EMAIL must be a valid email address.\n' >&2
  done

  while true; do
    printf '  admin password: ' >&2
    if ! IFS= read -r -s password; then
      printf '\n' >&2
      die "Input required for ADMIN_BOOTSTRAP_PASSWORD."
    fi
    printf '\n' >&2
    if [[ -n "$password" ]]; then
      break
    fi
    printf '  ADMIN_BOOTSTRAP_PASSWORD cannot be empty.\n' >&2
  done

  export ADMIN_BOOTSTRAP_EMAIL="$email"
  export ADMIN_BOOTSTRAP_PASSWORD="$password"
}
