# 本地开发运行指南

这份文档说明如何在本地运行当前项目的基础版本。

当前版本已经具备：

- 后端 API。
- 异步任务 worker 骨架。
- H5/Web 课程列表和课程详情页。
- 文本导入、句子切分、播放进度保存、课程删除。
- fake TTS 流程骨架，但还没有接入真实 MP3 生成。

## 环境要求

本地需要准备：

- Docker Desktop，或其他兼容 Docker 的运行环境。
- Python 3.12 或更高版本。
- Node.js 和 npm。

注意：`make up` 不强制要求安装 Docker Compose。它会优先使用 `docker compose` / `docker-compose`，如果都没有，会自动退回到普通 `docker run`。但无论哪种方式，都必须先启动 Docker Desktop 或 Docker daemon。

当前 Makefile 默认使用系统里的 `python3` 和 `npm`：

```bash
python3
npm
```

如果服务器或本机 Python 路径不同，安装依赖时可以这样指定：

```bash
make deps PYTHON=/path/to/python3.13
```

例如：

```bash
make deps PYTHON=/usr/bin/python3.12
make deps PYTHON=/usr/local/bin/python3.12
```

## 第一次运行

在项目根目录执行：

```bash
cp .env.example .env
make deps
make up

# 执行db变更
make init-db

# 如果改前端代码新增了依赖，需要
cd /www/web_reader/apps/web
npm install
rm -rf .next
npm run build
cat .next/BUILD_ID    # 看到了BUILD_ID才说明构建成功了
tmux kill-session -t web_reader_web 2>/dev/null || true   # 删除旧的web_reader_web
tmux new-session -d -s web_reader_web 'cd /www/web_reader/apps/web && ./node_modules/.bin/next start -H 127.0.0.1 -p 3000'
```

说明：

- `cp .env.example .env`：创建本地环境变量文件。
- `make deps`：安装后端、worker、前端依赖。
- `make up`：启动 Postgres、Redis、MinIO 等本地基础服务。

如果 `make up` 提示 Docker daemon 未运行，请先打开 Docker Desktop，等 Docker 启动完成后再重试。

### 重启服务
make down || true
docker rm -f web_reader_postgres web_reader_redis web_reader_minio 2>/dev/null || true
make up  

### 启动前后端服务进程
然后打开 3 个终端分别运行。

终端 1：启动后端 API：

```bash
cd /www/web_reader && make api-prod

# 后台运行
cd /www/web_reader && tmux new-session -s web_reader_api 'make api-prod'

# 查看后台运行
tmux attach-session -t web_reader_api

# 回到前台
Ctrl + b
按下 d
```

终端 2：启动异步任务 worker：

```bash
cd /www/web_reader && make worker

# 后台运行
cd /www/web_reader && tmux new-session -s web_reader_worker 'make worker'
tmux attach-session -t web_reader_api
```

终端 3：启动 H5/Web 前端：

```bash
cd /www/web_reader && tmux new-session -s web_reader_web 'make web'
tmux attach-session -t web_reader_api
```

## 检查后端是否启动成功

执行：

```bash
curl http://localhost:8000/health
```

预期返回：

```json
{"status":"ok"}
```

## 本地服务地址

`make up` 会启动：

- Postgres：`localhost:15432`
- Redis：`localhost:16379`
- MinIO API：`http://localhost:19000`
- MinIO 管理后台：`http://localhost:19001`

MinIO 本地账号：

```text
username: minioadmin
password: minioadmin
```

## 生产环境对象存储示例

如果生产环境使用 Cloudflare R2 存放生成音频和 URL 导入图片，可以沿用现有 S3-compatible 配置，再补一个浏览器可访问的公开媒体域名：

```env
S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=<r2-access-key>
S3_SECRET_ACCESS_KEY=<r2-secret-key>
S3_BUCKET=pagealong-media-prod
MEDIA_PUBLIC_BASE_URL=https://media.pagealong.com
TTS_STORAGE_BACKEND=r2
URL_IMPORT_IMAGE_STORAGE_BACKEND=r2
```

说明：

- `S3_ENDPOINT_URL` 是后端上传对象时使用的 R2 S3 API 地址。
- `MEDIA_PUBLIC_BASE_URL` 建议配置为 R2 Custom Domain，给浏览器直接访问音频和图片。
- `TTS_STORAGE_BACKEND` 和 `URL_IMPORT_IMAGE_STORAGE_BACKEND` 可以都指向 `r2`，也可以在需要时使用不同后端。
- 如果不配置 `MEDIA_PUBLIC_BASE_URL`, 后端仍可保留音频和图片读取路由作为 fallback，但浏览器直链和缓存效果会差一些。

停止本地服务：

```bash
make down
```

---

## 一个命令启动所有服务
scripts/prod-apps.sh restart

### 常用命令：
scripts/prod-apps.sh status
scripts/prod-apps.sh logs api
scripts/prod-apps.sh logs worker
scripts/prod-apps.sh logs web
scripts/prod-apps.sh attach web

`api` 和 `worker` 的 `logs` 会直接读取持久化文件日志，位置分别是 `services/api/storage/logs/api.log` 和 `services/worker/storage/logs/worker.log`；`web` 仍然读取 tmux 窗口输出。
`prod-apps.sh stop` 和 `prod-apps.sh start` 会清理工作目录属于 `PROJECT_ROOT/services/worker` 的历史 Celery worker 进程，避免多次启动后残留的 worker 持续占用内存。

### 如果前端改过，需要先构建
cd /www/web_reader && scripts/prod-apps.sh build-web
cd /www/web_reader && scripts/prod-apps.sh restart

---

## APP端真机测试流程

手机需要安装 Expo go

```
cd apps/mobile
source ~/.nvm/nvm.sh
nvm use 24
npm run start -- --clear

# 本地调试需要把环境变量加上
EXPO_PUBLIC_WEB_BASE_URL=https://web-reader.zbpblog.cn EXPO_PUBLIC_API_BASE_URL=https://web-reader.zbpblog.cn/api npm run start -- --clear
```

## Apk包构建
配置文件位于：apps/mobile/eas.json

EAS 云端构建不会依赖本机未提交的 `apps/mobile/.env`。`preview` 和 `production` 包使用 `apps/mobile/eas.json` 里的公开 `EXPO_PUBLIC_*` 构建变量；本地真机/模拟器调试仍可继续在命令行或 `apps/mobile/.env` 中覆盖。

执行如下命令即可构建Apk包：
```
cd apps/mobile
eas login
eas build:configure
eas build -p android --profile preview --clear-cache
```

## 脚本

### 设置系统管理员

```bash
services/api/.venv/bin/python scripts/promote_user_to_admin.py --email user@example.com
```

也可以按用户 ID 设置：--user-id <user_id>
