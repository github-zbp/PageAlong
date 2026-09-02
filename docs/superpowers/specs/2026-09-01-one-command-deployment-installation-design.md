# 一键部署与安装方案设计

Date: 2026-09-01

## Goal

为 PageAlong Web Reader 提供两条公开可用的部署路径：

1. 宿主机脚本式安装与部署，入口是 `make bootstrap-prod`
2. 仅应用层容器化的部署，入口是 `make compose-prod`

两条路径都要满足“公开到 GitHub 后，用户能按文档完成安装、启动和升级”的目标。现有的 `make deps`、`make up`、`make init-db`、`scripts/prod-apps.sh`、`docker-compose.yml` 保留复用，不推倒重来。

## Current Context

- 仓库已经有 API、worker、Web 三个服务层，且生产运行脚本已经能管理 tmux 后台进程。
- 本地依赖服务已经通过 Docker 提供了 PostgreSQL、Redis、MinIO 的启动逻辑。
- 当前生产文档主要偏 Baota / 手工部署，缺少一个统一的一键入口。
- `services/api` 和 `services/worker` 使用 Python 3.12 + `venv + pip`。
- `apps/web` 使用 npm + Next.js。

## Confirmed Decisions

- 宿主机部署必须先做环境检测，不满足时自动安装可自动安装的依赖。
- PostgreSQL / Redis / MinIO 不要求用户手工逐个安装；优先通过现有 Docker 依赖栈补齐。
- 如果用户已经配置了可达的外部 PostgreSQL / Redis / 对象存储，bootstrap 过程不重复创建本地依赖。
- 容器化方案只容器化应用层：API、worker、Web。
- 容器化方案继续使用外部 PostgreSQL 和 Redis。
- MinIO 不进入应用层 compose；它仍然是外部可选依赖，或者由宿主机脚本方案通过 Docker 依赖栈提供。
- 公开站点的 Nginx / SSL 配置仍由宿主机环境处理，不强行塞进应用 compose。

## Proposed Architecture

### 1. 宿主机 bootstrap：`make bootstrap-prod`

这个入口负责“从空机器到可访问站点”的首次安装，也可以重复执行做修复和重启。

执行顺序：

1. 探测宿主机能力
   - `git`
   - `make`
   - `curl`
   - `tmux`
   - `ffmpeg`
   - `python3.12`
   - `node`
   - `npm`
   - `docker`
   - `docker compose`
   - `lsof`
2. 如果缺少可自动安装的系统依赖，并且存在 `sudo` 和受支持的包管理器，则自动安装。这里包含基础运行时，也包含 Docker / Compose。
3. 读取 `.env`，检查 `DATABASE_URL`、`REDIS_URL`、存储后端配置。
4. 如果外部 PostgreSQL / Redis / 对象存储不可用，则调用现有的 Docker 依赖栈补齐：
   - `make up`
5. 安装项目依赖：
   - `make deps`
6. 初始化数据库：
   - `make init-db`
7. 构建 Web：
   - `scripts/prod-apps.sh build-web`
8. 启动或重启应用：
   - `scripts/prod-apps.sh restart`
9. 如果宿主机支持 systemd 且以 root 运行，则安装一个可选的开机自启服务，内部只负责调用 `scripts/prod-apps.sh start/stop`。

设计意图：

- 用户只记一个命令。
- 缺依赖时自动补齐，没权限时给出明确失败原因。
- 依赖层优先复用 Docker，不新增一套 native PostgreSQL / Redis / MinIO 运维分支。

### 2. 应用层容器化：`make compose-prod`

这个入口负责“只容器化 API / worker / Web”，适合不想在宿主机装 Python、Node 的用户。

compose 栈包含：

- `api`
- `worker`
- `web`

不包含：

- PostgreSQL
- Redis
- MinIO

运行规则：

- API 和 worker 共享同一套 Python 运行时镜像，减少重复构建。
- Web 使用单独的 Node / Next.js 镜像。
- 运行时由 compose 注入 `.env` 中的数据库、Redis、鉴权、对象存储等变量。
- Web 容器内部的 `API_BASE_URL` 指向 compose 网络里的 API 服务。
- 浏览器侧的 `NEXT_PUBLIC_API_BASE_URL` 仍使用 `/api`，由宿主机 Nginx 反代。
- `docker compose up -d --build` 即可完成首次部署和增量升级。

## Command Contract

### 宿主机路径

用户流程：

```bash
git clone <repo>
cd web_reader
cp .env.example .env
make bootstrap-prod
```

行为约定：

- 命令是幂等的。
- 它会在本地依赖不可用时自动补齐，而不是只输出提示。
- 它会在 Web 构建失败时保留清晰的错误输出。
- 它会在服务启动后打印健康检查与日志查看方式。

### 容器化路径

用户流程：

```bash
git clone <repo>
cd web_reader
cp .env.example .env
make compose-prod
```

行为约定：

- 它会构建或重建应用镜像。
- 它不会创建数据库或 Redis 容器。
- 如果数据库 schema 为空，compose 入口会在启动后执行一次初始化。
- 更新时用户重复执行同一命令即可。

## Environment Rules

### 宿主机 bootstrap

推荐优先支持 Debian / Ubuntu 系列，其他发行版先做存在性检测，再给出明确失败提示。

需要处理的典型环境变量：

- `DATABASE_URL`
- `REDIS_URL`
- `TTS_STORAGE_BACKEND`
- `URL_IMPORT_IMAGE_STORAGE_BACKEND`
- `S3_ENDPOINT_URL`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`

决策规则：

- 如果 `DATABASE_URL` / `REDIS_URL` 指向可达外部服务，优先复用外部服务。
- 如果不可达，则通过 `make up` 启动本地 Docker 依赖栈。
- 如果对象存储走 R2 / S3，则不要求 MinIO。
- 如果对象存储缺省为本地或未配置，则由 Docker 依赖栈提供 MinIO。

### 容器化部署

compose 方案继续复用同一份 `.env`，但需要明确两类地址：

- 宿主机对外地址：给 Nginx 和浏览器使用
- compose 内部地址：给 Web 服务端访问 API 使用

建议约定：

- `API_BASE_URL=http://api:8000`
- `NEXT_PUBLIC_API_BASE_URL=/api`
- `DATABASE_URL` / `REDIS_URL` 指向外部可达地址，若外部服务就在宿主机上，可通过 `host.docker.internal` 或宿主机 IP 访问

## File and Script Changes

### 计划新增

- `scripts/bootstrap-prod.sh`
- `scripts/compose-prod.sh`
- `docker-compose.prod.yml`
- `docker/api-worker.Dockerfile`
- `docker/web.Dockerfile`
- `.dockerignore`
- `docs/production-deployment.md`

### 计划修改

- `Makefile`
  - 新增 `bootstrap-prod`
  - 新增 `compose-prod`
- `README.md`
  - 增加部署入口说明
- `docs/environment-variables.md`
  - 补充 host / compose 两种部署的变量差异
- `docs/baota-deployment.md`
  - 调整为平台附录或引用新主文档，避免重复叙述

## Error Handling

宿主机 bootstrap 失败时必须明确区分：

- 缺系统依赖
- 没有 `sudo`
- Docker 不可用
- 数据库 / Redis 不可达
- Web 构建失败
- 数据库初始化失败

容器化部署失败时必须明确区分：

- 镜像构建失败
- 外部数据库不可达
- 外部 Redis 不可达
- Web 运行时环境变量不完整
- schema 初始化失败

两条路径都要保留最近一次启动日志的查看入口。

## Testing

### Shell 层

- 为 `bootstrap-prod` 加 shell 测试，覆盖：
  - 缺依赖时的检测结果
  - `make up` 回退路径
  - 外部数据库 / Redis 已可达时不重复拉起本地依赖
  - systemd 安装分支
- 为 `compose-prod` 加 shell 测试，覆盖：
  - compose 命令生成
  - `API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` 约定
  - 初始化命令触发

### 现有测试

- API 改动继续跑 `make test-api`
- Worker 改动继续跑 `cd services/worker && .venv/bin/python -m pytest -q`
- Web 改动继续跑 `make test-web`

### 运行验证

宿主机路径：

```bash
curl http://127.0.0.1:8000/health
curl -I http://127.0.0.1:3000
```

容器化路径：

```bash
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1:8000/health
```

## Out of Scope

- Kubernetes / Helm
- 多机集群
- CI/CD 自动推镜像到远程仓库
- 真实支付、认证、OCR、可观测性重做
- 把 Nginx / SSL 一并容器化
