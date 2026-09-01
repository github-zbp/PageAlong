# 宝塔部署指南

本文说明如何在宝塔面板服务器上部署页相随 PageAlong Web Reader，并通过域名访问：

```text
https://web-reader.zbpblog.cn
```

部署方式：

- 宝塔面板管理 Nginx、SSL、PostgreSQL、Redis。
- Nginx 做同域反向代理。
- API、worker、Web 使用 `tmux` 后台进程运行。
- Web 页面访问 `https://web-reader.zbpblog.cn`。
- API 访问同域路径 `https://web-reader.zbpblog.cn/api/...`。

注意：当前项目已经具备文本导入、课程列表、课程详情、播放进度保存、课程删除和 fake TTS 流程骨架。真实 TTS、URL 导入、文件上传、OCR、支付和生产可观测性仍在演进中，不要把这些能力描述成已完整上线。

## 1. 服务器环境

在宝塔面板安装或确认以下组件：

- Nginx
- PostgreSQL
- Redis
- Node.js 18 或 20
- Python 3.12

SSH 登录服务器后检查：

```bash
python3.12 --version
node -v
npm -v
git --version
tmux -V
make -v
ffmpeg -version
```

如果缺少 `tmux`、`git`、`make`、`curl`、`ffmpeg` 或编译工具，可以在 Debian/Ubuntu 系统执行：

```bash
apt update
apt install -y tmux git make curl ffmpeg build-essential
```

如果系统不是 Debian/Ubuntu，请使用对应发行版的软件包管理器安装。

## 2. 放置项目

推荐将项目放在：

```text
/www/web_reader
```

如果使用 Git：

```bash
cd /www
git clone <你的仓库地址> web_reader
cd /www/web_reader
```

如果使用压缩包上传，解压后确认目录结构：

```bash
cd /www/web_reader
ls
```

应该能看到：

```text
Makefile
services
apps
scripts
docs
```

## 3. 配置 npm 和 pip 源

服务器上常见问题是 pip 或 npm 源不可达。先设置可用源。

```bash
npm config set registry https://registry.npmmirror.com
npm config set replace-registry-host always
npm config set fetch-retries 5
npm config set fetch-timeout 120000
```

Python 依赖优先使用 PyPI：

```bash
export PIP_INDEX_URL=https://pypi.org/simple
```

如果服务器不能访问 PyPI，可以改用清华源：

```bash
export PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
```

## 4. 创建 PostgreSQL 数据库

在宝塔 PostgreSQL 管理界面创建数据库：

```text
数据库名：web_reader
用户名：web_reader
密码：使用强密码
```

生产建议 PostgreSQL 只允许本机访问，应用通过 `127.0.0.1:5432` 连接。

如果数据库密码包含 `@`、`:`、`/`、`#`、`?` 等特殊字符，写入 `DATABASE_URL` 时要 URL encode。

## 5. 配置 Redis

在宝塔 Redis 管理界面设置密码，并建议只允许本机访问。

应用通过 `127.0.0.1:6379` 连接 Redis。

## 6. 创建 `.env`

复制环境变量模板：

```bash
cd /www/web_reader
cp .env.example .env
nano .env
```

先使用下面的最小生产配置跑通网站。替换数据库密码、Redis 密码和随机 secret。

```env
DATABASE_URL=postgresql+psycopg://web_reader:<数据库密码>@127.0.0.1:5432/web_reader
REDIS_URL=redis://:<Redis密码>@127.0.0.1:6379/0
REDIS_KEY_PREFIX=web_reader:

API_HOST=127.0.0.1
API_PORT=8000
WEB_HOST=127.0.0.1
WEB_PORT=3000

API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_BASE_URL=/api
CORS_ALLOW_ORIGINS=https://web-reader.zbpblog.cn

AUTH_DEV_BYPASS=true
AUTH_CODE_HASH_SECRET=<random-long-secret>
AUTH_SESSION_COOKIE_SECURE=true

INTERNAL_API_HMAC_SECRET=<random-long-secret>
INTERNAL_API_SIGNATURE_TTL_SECONDS=300
INTERNAL_API_REPLAY_STORE=memory
INTERNAL_API_TOKEN=

TTS_PROVIDER_MODE=fake
TTS_STORAGE_BACKEND=local
LOCAL_MEDIA_DIR=storage/media
URL_IMPORT_IMAGE_STORAGE_BACKEND=
```

生成随机 secret：

```bash
openssl rand -base64 48
```

说明：

- `NEXT_PUBLIC_API_BASE_URL=/api` 表示浏览器通过同域 `/api` 访问后端。
- `API_BASE_URL=http://127.0.0.1:8000` 表示 Next.js 服务端直接访问本机 API。
- 初次跑通可以保留 `AUTH_DEV_BYPASS=true`。正式公开使用前，应该改成 `false` 并配置邮件验证码。
- 当前建议先用 `TTS_PROVIDER_MODE=fake` 跑通部署。真实 TTS 供应商配置见 `docs/environment-variables.md`。

如果需要启用邮箱验证码，补充：

```env
AUTH_DEV_BYPASS=false
BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_USERNAME=<brevo-smtp-login>
BREVO_SMTP_PASSWORD=<brevo-smtp-key>
MAIL_FROM_EMAIL=<已验证发件邮箱>
MAIL_FROM_NAME=PageAlong
```

注意：当前验证码存储实现仍是进程内内存。如果 API 多进程或多实例，验证码可能只在发码的那个进程有效。

## 7. 安装依赖

从干净状态安装：

```bash
cd /www/web_reader

rm -rf services/api/.venv services/worker/.venv apps/web/node_modules apps/extension/node_modules

PIP_INDEX_URL=https://pypi.org/simple make deps PYTHON=python3.12 NPM="npm --registry=https://registry.npmmirror.com --replace-registry-host=always"
```

如果服务器不能访问 PyPI：

```bash
PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple make deps PYTHON=python3.12 NPM="npm --registry=https://registry.npmmirror.com --replace-registry-host=always"
```

验证 Python 虚拟环境：

```bash
services/api/.venv/bin/python --version
services/worker/.venv/bin/python --version
```

都应该显示 Python 3.12。

如果 npm 没有走镜像源，先确认 registry 配置：

```bash
npm config get registry
npm config get replace-registry-host
make deps PYTHON=python3.12 NPM="npm --registry=https://registry.npmmirror.com"
```

## 8. 初始化数据库

```bash
cd /www/web_reader
make init-db
```

预期输出：

```text
Database and application tables are ready.
```

如果需要初始化管理员账号，可以在第一次执行 `make init-db` 前配置：

```env
ADMIN_BOOTSTRAP_EMAIL=<管理员邮箱>
ADMIN_BOOTSTRAP_PASSWORD=<管理员强密码>
```

初始化完成后，不要长期在 `.env` 中保留明文管理员密码。

## 9. 构建 Web

`scripts/prod-apps.sh` 本身不会自动 source `.env`，所以执行生产脚本前先加载环境变量：

```bash
cd /www/web_reader
set -a
source .env
set +a

scripts/prod-apps.sh build-web
```

看到 `.next/BUILD_ID` 输出即表示构建完成。
`build-web` 现在会跳过 Next 的内建类型和 lint 检查；需要检查时单独运行 `npm run typecheck`。脚本默认给 `next build` 加上 `NODE_OPTIONS=--max-old-space-size=256` 和 `NEXT_BUILD_CPUS=1`，用来降低低内存服务器上的 OOM 风险；如需调整，可在执行前设置 `WEB_BUILD_NODE_OPTIONS` 或 `WEB_BUILD_CPUS`。

如果构建停在 `Creating an optimized production build ...` 后显示 `Killed`，通常表示线上服务器或面板把 Next.js 构建进程用 `SIGKILL` 终止了。可以先在服务器确认：

```bash
free -h
dmesg -T | grep -Ei 'killed process|out of memory|oom'
```

内存允许时可以适当提高 V8 heap，例如：

```bash
WEB_BUILD_NODE_OPTIONS='--max-old-space-size=384' scripts/prod-apps.sh build-web
```

如果服务器总内存不足，需要先增加 swap，或在内存更大的机器上完成 Web 构建后再同步产物。

如果修改了 `NEXT_PUBLIC_API_BASE_URL`，必须重新执行：

```bash
scripts/prod-apps.sh build-web
```

## 10. 启动服务

启动 API、worker、Web 三个 tmux 后台进程：

```bash
cd /www/web_reader
set -a
source .env
set +a

scripts/prod-apps.sh restart
scripts/prod-apps.sh status
```

`prod-apps.sh stop` 和 `prod-apps.sh start` 会清理工作目录属于 `PROJECT_ROOT/services/worker` 的历史 Celery worker 进程，避免多次启动后残留的 worker 持续占用内存。清理逻辑只匹配本项目 worker 目录，不处理其他项目的同名 Celery 进程。

本机验证：

```bash
curl http://127.0.0.1:8000/health
curl -I http://127.0.0.1:3000
```

API 正常时返回：

```json
{"status":"ok"}
```

查看日志：

```bash
scripts/prod-apps.sh logs api
scripts/prod-apps.sh logs worker
scripts/prod-apps.sh logs web
```

其中 `api` 和 `worker` 会直接读取 `services/api/storage/logs/api.log` 与 `services/worker/storage/logs/worker.log`。

进入 tmux 会话：

```bash
scripts/prod-apps.sh attach api
scripts/prod-apps.sh attach worker
scripts/prod-apps.sh attach web
```

退出 tmux 会话但不停止服务：

```text
Ctrl+b
d
```

## 11. 宝塔创建站点

在宝塔面板中创建网站：

```text
域名：web-reader.zbpblog.cn
根目录：/www/wwwroot/web-reader.zbpblog.cn
PHP版本：纯静态
```

根目录只用于宝塔创建站点，不承载实际前端文件。实际请求会被 Nginx 反向代理到 `127.0.0.1:3000`。

## 12. 配置 Nginx 反向代理

在宝塔站点设置中打开 Nginx 配置，使用下面配置。若宝塔已经生成 SSL server 块，可以只替换其中的 `location` 部分。

HTTP 配置：

```nginx
server {
    listen 80;
    server_name web-reader.zbpblog.cn;

    client_max_body_size 30m;

    location = /api {
        return 308 /api/;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

保存后在宝塔中重载 Nginx。

验证：

```bash
curl http://web-reader.zbpblog.cn/api/health
curl -I http://web-reader.zbpblog.cn
```

## 13. 配置 HTTPS

在宝塔站点中为 `web-reader.zbpblog.cn` 申请 Let's Encrypt SSL。

SSL 生效后，建议让 HTTP 自动跳转 HTTPS。Nginx HTTPS 配置可参考：

```nginx
server {
    listen 80;
    server_name web-reader.zbpblog.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name web-reader.zbpblog.cn;

    ssl_certificate     /www/server/panel/vhost/cert/web-reader.zbpblog.cn/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/web-reader.zbpblog.cn/privkey.pem;

    client_max_body_size 30m;

    location = /api {
        return 308 /api/;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

如果宝塔生成的证书路径不同，以宝塔实际路径为准。

HTTPS 验证：

```bash
curl https://web-reader.zbpblog.cn/api/health
curl -I https://web-reader.zbpblog.cn
```

浏览器打开：

```text
https://web-reader.zbpblog.cn
```

## 14. 设置开机自启

在宝塔计划任务中添加 Shell 脚本，设置为开机执行：

```bash
cd /www/web_reader
set -a
source .env
set +a
scripts/prod-apps.sh start
```

也可以创建一个本地启动脚本，例如 `/www/web_reader/scripts/start-prod-from-env.sh`，但当前仓库已经有 `scripts/prod-apps.sh`，宝塔计划任务直接调用即可。

## 15. 日常更新

更新代码后：

```bash
cd /www/web_reader
git pull

set -a
source .env
set +a

scripts/prod-apps.sh build-web
scripts/prod-apps.sh restart
scripts/prod-apps.sh status
```

如果只改后端代码，不改前端构建相关内容，可以只重启：

```bash
scripts/prod-apps.sh restart
```

如果改了 `.env` 中的 `NEXT_PUBLIC_API_BASE_URL`，必须重新构建 Web。

## 16. 常见问题

### 502 Bad Gateway

先看本地服务是否运行：

```bash
cd /www/web_reader
set -a
source .env
set +a

scripts/prod-apps.sh status
curl http://127.0.0.1:8000/health
curl -I http://127.0.0.1:3000
```

再看日志：

```bash
scripts/prod-apps.sh logs api
scripts/prod-apps.sh logs web
```

### `/api/health` 返回 404

检查 Nginx：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000/;
}
```

这里 `proxy_pass` 末尾的 `/` 很重要。它会把 `/api/health` 转给后端的 `/health`。

### npm 安装超时

确认 npm registry：

```bash
npm config get registry
```

如果需要刷新 lockfile，先把 registry 设为镜像源：

```bash
npm config set registry https://registry.npmmirror.com
npm config set replace-registry-host always
```

### pip 找不到 `edge-tts`

优先使用 PyPI：

```bash
PIP_INDEX_URL=https://pypi.org/simple make deps PYTHON=python3.12
```

如果服务器无法访问 PyPI：

```bash
PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple make deps PYTHON=python3.12
```

### API 启动失败

检查：

```bash
scripts/prod-apps.sh logs api
```

重点看：

- `DATABASE_URL` 是否能连接 PostgreSQL。
- `REDIS_URL` 是否能连接 Redis。
- `API_PORT=8000` 是否被占用。
- `services/api/.venv/bin/python --version` 是否为 Python 3.12。

### worker 不消费任务

检查：

```bash
scripts/prod-apps.sh logs worker
```

重点看：

- `REDIS_URL` 是否和 API 使用同一个 Redis DB。
- `REDIS_KEY_PREFIX` 是否一致。
- `services/worker/.venv/bin/python --version` 是否为 Python 3.12。

### Docker 服务日志过大

`docker-compose.yml` 已为 Postgres、Redis、MinIO 配置 Docker 日志轮转：

```text
max-size=10m
max-file=5
```

如果服务器已经存在旧容器，需要重建容器后新日志策略才生效：

```bash
cd /www/web_reader
make down
make up
```

该操作会停止并重建容器，但不会删除外部数据卷。
