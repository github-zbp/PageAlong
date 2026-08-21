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
```

## 第一次运行

在项目根目录执行：

```bash
cp .env.example .env
make deps
make up   # 本地运行不需要make up启动Docker

# 执行db变更
make init-db

# 如果改前端代码新增了依赖，需要
cd /www/web_reader/apps/web
npm install
rm -rf .next
NEXT_PUBLIC_API_BASE_URL=http://localhost:8070 npm run build
cat .next/BUILD_ID    # 看到了BUILD_ID才说明构建成功了
tmux kill-session -t web_reader_web 2>/dev/null || true   # 删除旧的web_reader_web
tmux new-session -d -s web_reader_web 'cd /www/web_reader/apps/web && API_BASE_URL=http://127.0.0.1:8070 NEXT_PUBLIC_API_BASE_URL=http://localhost:8070 ./node_modules/.bin/next start -H 127.0.0.1 -p 3000'
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
本地开发后端 API 使用 `8070` 端口，避免和本机长期占用的 `8000` 端口冲突。这里通过启动命令临时覆盖端口，不修改 Makefile 默认值，也不影响线上部署端口。

然后打开 3 个终端分别运行。

终端 1：启动后端 API：

```bash
cd /www/web_reader && API_PORT=8070 make api

# 后台运行
tmux new-session -s web_reader_api 'cd /www/web_reader && API_PORT=8070 make api'

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
tmux new-session -s web_reader_worker 'cd /www/web_reader && make worker'
tmux attach-session -t web_reader_worker
```

终端 3：启动 H5/Web 前端：

```bash
cd /www/web_reader && API_BASE_URL=http://127.0.0.1:8070 NEXT_PUBLIC_API_BASE_URL=http://localhost:8070 make web

# 后台运行
tmux new-session -s web_reader_web 'cd /www/web_reader && API_BASE_URL=http://127.0.0.1:8070 NEXT_PUBLIC_API_BASE_URL=http://localhost:8070 make web'

tmux attach-session -t web_reader_web
```

## 检查后端是否启动成功

执行：

```bash
curl http://localhost:8070/health
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

## 媒体对象存储配置

本地默认 `TTS_STORAGE_BACKEND=local`，生成音频和 URL 导入图片会写入本地忽略目录。生产接入 Cloudflare R2 或其他 S3-compatible 存储时，使用现有 S3 配置：

```env
S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=<r2-access-key>
S3_SECRET_ACCESS_KEY=<r2-secret-key>
S3_BUCKET=<bucket-name>
TTS_STORAGE_BACKEND=r2
URL_IMPORT_IMAGE_STORAGE_BACKEND=r2
MEDIA_PUBLIC_BASE_URL=https://media.example.com
```

`MEDIA_PUBLIC_BASE_URL` 建议配置为 R2 Custom Domain。未配置公开域名时，后端仍保留课程音频和课程图片读取路由作为 fallback。

停止本地服务：

```bash
make down
```
