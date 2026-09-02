# One-Command Deployment and Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a host bootstrap command and an app-layer container deployment command so a GitHub user can install and run PageAlong with one command per deployment mode.

**Architecture:** Reuse the existing dependency scripts and production process manager instead of introducing a new platform. `make bootstrap-prod` will install missing host dependencies, ensure `.env`, start local Docker-backed dependencies when needed, install app dependencies, initialize the database, build Web, and restart the app processes. `make compose-prod` will build and run only API/worker/Web containers while leaving PostgreSQL and Redis external.

**Tech Stack:** Bash, Make, Docker Compose, Python 3.12 venv/pip, npm, Next.js 13, FastAPI, Celery

**Spec:** `docs/superpowers/specs/2026-09-01-one-command-deployment-installation-design.md`

## Global Constraints

- 宿主机部署必须先做环境检测，不满足时自动安装可自动安装的依赖。
- PostgreSQL / Redis / MinIO 不要求用户手工逐个安装；优先通过现有 Docker 依赖栈补齐。
- 如果用户已经配置了可达的外部 PostgreSQL / Redis / 对象存储，bootstrap 过程不重复创建本地依赖。
- 容器化方案只容器化应用层：API、worker、Web。
- 容器化方案继续使用外部 PostgreSQL 和 Redis。
- MinIO 不进入应用层 compose；它仍然是外部可选依赖，或者由宿主机脚本方案通过 Docker 依赖栈提供。
- 公开站点的 Nginx / SSL 配置仍由宿主机环境处理，不强行塞进应用 compose。

---

### Task 1: Add bootstrap-prod host installer

**Files:**
- Create: `scripts/bootstrap-prod.sh`
- Modify: `Makefile`
- Test: `scripts/test_bootstrap_prod.sh`

**Interfaces:**
- Consumes: `make deps`, `make up`, `make init-db`, `scripts/prod-apps.sh build-web`, `scripts/prod-apps.sh restart`
- Produces: `make bootstrap-prod` and a shell entrypoint that can run from a bare checkout

- [ ] **Step 1: Write the failing test**

```bash
#!/usr/bin/env bash
set -euo pipefail

output="$(
  PATH="${TMP_DIR}/bin:${PATH}" \
  PROJECT_ROOT="${FAKE_ROOT}" \
  "${PROJECT_ROOT}/scripts/bootstrap-prod.sh" 2>&1
)"

grep -F "installing missing host dependencies" <<<"${output}"
grep -F "make up" <<<"${output}"
grep -F "make init-db" <<<"${output}"
grep -F "scripts/prod-apps.sh build-web" <<<"${output}"
grep -F "scripts/prod-apps.sh restart" <<<"${output}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash scripts/test_bootstrap_prod.sh`
Expected: fail because `scripts/bootstrap-prod.sh` does not exist yet

- [ ] **Step 3: Write minimal implementation**

Implement:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "installing missing host dependencies"
echo "make up"
echo "make init-db"
echo "scripts/prod-apps.sh build-web"
echo "scripts/prod-apps.sh restart"
```

Then replace the stub with real host dependency detection, `.env` bootstrap, Docker fallback for local Postgres/Redis/MinIO, build, init, and restart logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `bash scripts/test_bootstrap_prod.sh`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/bootstrap-prod.sh scripts/test_bootstrap_prod.sh Makefile
git commit -m "feat: add host bootstrap deployment"
```

### Task 2: Add app-layer compose deployment

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `docker/api-worker.Dockerfile`
- Create: `docker/web.Dockerfile`
- Create: `.dockerignore`
- Create: `scripts/compose-prod.sh`
- Modify: `Makefile`
- Test: `scripts/test_compose_prod.sh`

**Interfaces:**
- Consumes: external `DATABASE_URL`, `REDIS_URL`, `API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`
- Produces: `make compose-prod` and a compose stack for API / worker / Web only

- [ ] **Step 1: Write the failing test**

```bash
#!/usr/bin/env bash
set -euo pipefail

output="$(
  PATH="${TMP_DIR}/bin:${PATH}" \
  PROJECT_ROOT="${FAKE_ROOT}" \
  "${PROJECT_ROOT}/scripts/compose-prod.sh" 2>&1
)"

grep -F "docker compose -f docker-compose.prod.yml up -d --build" <<<"${output}"
grep -F "API_BASE_URL=http://api:8000" <<<"${output}"
grep -F "NEXT_PUBLIC_API_BASE_URL=/api" <<<"${output}"
grep -F "docker compose -f docker-compose.prod.yml run --rm api" <<<"${output}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash scripts/test_compose_prod.sh`
Expected: fail because `scripts/compose-prod.sh` does not exist yet

- [ ] **Step 3: Write minimal implementation**

Implement the compose wrapper first, then add the Dockerfiles and compose file:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "docker compose -f docker-compose.prod.yml up -d --build"
echo "API_BASE_URL=http://api:8000"
echo "NEXT_PUBLIC_API_BASE_URL=/api"
echo "docker compose -f docker-compose.prod.yml run --rm api"
```

Then replace the stub with:
- a generated compose env file
- service start and health wait
- db init inside the api container
- translated host-local database / redis URLs when needed
- actual build/runtime Dockerfiles

- [ ] **Step 4: Run test to verify it passes**

Run: `bash scripts/test_compose_prod.sh`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docker-compose.prod.yml docker/api-worker.Dockerfile docker/web.Dockerfile .dockerignore scripts/compose-prod.sh scripts/test_compose_prod.sh Makefile
git commit -m "feat: add app compose deployment"
```

### Task 3: Update docs and verify both deployment paths

**Files:**
- Create: `docs/production-deployment.md`
- Modify: `docs/baota-deployment.md`
- Modify: `docs/environment-variables.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the two deployment entrypoints from Tasks 1 and 2
- Produces: a single user-facing deployment guide that explains both modes and the `.env` bootstrap behavior

- [ ] **Step 1: Write the failing doc check**

```bash
rg -n "make bootstrap-prod|make compose-prod|.env.example|docker-compose.prod.yml" docs README.md
```

- [ ] **Step 2: Run the doc check before edits**

Run: `rg -n "make bootstrap-prod|make compose-prod|.env.example|docker-compose.prod.yml" docs README.md`
Expected: incomplete coverage before the doc updates land

- [ ] **Step 3: Write the documentation updates**

Add the new deployment guide, point README to it, and keep the Baota page as a platform-specific appendix.

- [ ] **Step 4: Run the doc check again**

Run: `rg -n "make bootstrap-prod|make compose-prod|.env.example|docker-compose.prod.yml" docs README.md`
Expected: the new commands and files are referenced from the user-facing docs

- [ ] **Step 5: Commit**

```bash
git add docs/production-deployment.md docs/baota-deployment.md docs/environment-variables.md README.md
git commit -m "docs: add deployment guide"
```

