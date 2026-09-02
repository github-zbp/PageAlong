# 环境变量说明

本文说明服务器部署时 `.env` 中各环境变量的含义、是否必填，以及推荐填写方式。

`make bootstrap-prod` 和 `make compose-prod` 都会在缺少 `.env` 时先从 `.env.example` 复制一份，所以第一次部署不要求你先手工创建 `.env`。`make compose-prod` 会在执行过程中提示补齐数据库、Redis 和媒体存储的最小运行配置，并自动写回 `.env`；首次公开部署前仍然要检查认证、邮箱和各类密钥是否符合你的环境。

注意：

- 不要把真实数据库密码、Redis 密码、对象存储密钥、SMTP 密钥提交到 Git。
- 真实 TTS、URL 导入、文件上传、OCR、认证、支付和生产可观测性仍在演进中。不要把未完整实现的能力当作已稳定上线能力配置或宣传。
- 如果已经把真实 `.env` 内容发到聊天、日志或提交记录里，建议轮换对应密钥。

## 最小生产必填

如果服务器使用 PostgreSQL、Redis、Nginx 反代 API 和 Web，最小生产配置建议如下：

```env
DATABASE_URL=postgresql+psycopg://<db_user>:<db_password>@<db_host>:5432/web_reader
REDIS_URL=redis://:<redis_password>@<redis_host>:6379/0

API_HOST=127.0.0.1
API_PORT=8000
WEB_HOST=127.0.0.1
WEB_PORT=3000

API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_BASE_URL=/api
CORS_ALLOW_ORIGINS=https://你的域名
```

说明：

- `DATABASE_URL` 和 `REDIS_URL` 是 API、worker、初始化脚本真正依赖的核心连接配置。
- 如果 Nginx 把同一个域名下的 `/api` 转发到 `http://127.0.0.1:8000`，`NEXT_PUBLIC_API_BASE_URL` 推荐填 `/api`。
- `API_BASE_URL` 给 Next.js 服务端访问 API 使用，生产反代部署推荐填内网地址。
- 修改 `NEXT_PUBLIC_API_BASE_URL` 后，需要重新构建前端，例如运行 `scripts/prod-apps.sh build-web`。

## 核心运行变量

| 变量 | 含义 | 是否必填 | 推荐填写 |
| --- | --- | --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串，API 和 `make init-db` 使用 | 生产必填 | `postgresql+psycopg://用户:密码@主机:端口/库名` |
| `REDIS_URL` | Celery broker 和 result backend，API 发任务、worker 消费任务 | 生产必填 | `redis://:密码@主机:6379/0` |
| `REDIS_KEY_PREFIX` | Redis key 前缀，避免共享 Redis 时 key 冲突 | 可选 | 共享 Redis 时建议 `web_reader:` |
| `API_HOST` | API 监听地址 | 脚本使用 | 反代部署建议 `127.0.0.1`；需要外部直连时才用 `0.0.0.0` |
| `API_PORT` | API 监听端口 | 脚本使用 | 默认 `8000`；本机开发可用 `8070` 避免端口冲突 |
| `API_HOST_PORT` | compose 模式下宿主机暴露的 API 端口 | 可选 | 默认 `8000`，如果宿主机 8000 被占用可以改掉 |
| `WEB_HOST` | Next.js Web 监听地址 | 脚本使用 | 反代部署建议 `127.0.0.1` |
| `WEB_PORT` | Next.js Web 监听端口 | 脚本使用 | 默认 `3000` |
| `WEB_HOST_PORT` | compose 模式下宿主机暴露的 Web 端口 | 可选 | 默认 `3000`，如果宿主机 3000 被占用可以改掉 |
| `API_BASE_URL` | Next.js 服务端访问 API 的地址 | 生产建议填 | `http://127.0.0.1:8000` |
| `NEXT_PUBLIC_API_BASE_URL` | 浏览器访问 API 的地址，会进入前端构建产物 | 生产必填 | 同域反代填 `/api`；分域填 `https://api.example.com` |
| `CORS_ALLOW_ORIGINS` | 允许跨域访问 API 的前端 origin 列表 | 分域部署必填 | 多个用逗号分隔，如 `https://www.example.com,https://example.com` |

如果 `DATABASE_URL` 密码中包含 `@`、`:`、`/`、`#`、`?` 等特殊字符，需要 URL encode。

## 本地 Docker 辅助变量

这些变量主要给 `make up`、`docker-compose.yml` 和 `scripts/dev-services.sh` 使用。生产环境如果使用外部 PostgreSQL、Redis、R2/S3，可以不依赖这些变量。

| 变量 | 含义 | 生产建议 |
| --- | --- | --- |
| `POSTGRES_HOST` | 本地开发辅助信息 | 外部数据库部署可不填 |
| `POSTGRES_HOST_PORT` | 本地 Docker Postgres 映射到宿主机的端口 | 只给本地 `make up` 使用 |
| `POSTGRES_PORT` | 示例中的数据库端口 | 应用实际主要看 `DATABASE_URL` |
| `POSTGRES_DB` | 本地 Postgres 容器初始化数据库名 | 生产连接写进 `DATABASE_URL` |
| `POSTGRES_USER` | 本地 Postgres 容器初始化用户名 | 生产连接写进 `DATABASE_URL` |
| `POSTGRES_PASSWORD` | 本地 Postgres 容器初始化密码 | 生产连接写进 `DATABASE_URL` |
| `REDIS_HOST_PORT` | 本地 Docker Redis 映射到宿主机的端口 | 只给本地 `make up` 使用 |
| `MINIO_API_HOST_PORT` | 本地 MinIO API 映射端口 | 只给本地 `make up` 使用 |
| `MINIO_CONSOLE_HOST_PORT` | 本地 MinIO Console 映射端口 | 只给本地 `make up` 使用 |

## 认证和邮箱变量

当前代码已有邮箱验证码、登录会话和管理员账号初始化配置，但认证能力仍处于项目演进阶段。公开服务器上不要保留开发绕过。

| 变量 | 含义 | 是否必填 | 推荐填写 |
| --- | --- | --- | --- |
| `AUTH_DEV_BYPASS` | 没有登录 token 时允许使用 `X-User-Id` 或默认 `dev_user` | 公开服务器必须处理 | 公开服务器设 `false`；本地开发可设 `true` |
| `AUTH_SESSION_TTL_SECONDS` | 登录会话有效期 | 可选 | 默认 30 天：`2592000` |
| `AUTH_SESSION_COOKIE_NAME` | 登录 cookie 名称，代码支持但 `.env.example` 未列 | 可选 | 默认 `pagealong_session` |
| `AUTH_SESSION_COOKIE_SECURE` | 登录 cookie 是否只允许 HTTPS | HTTPS 生产建议填 | HTTPS 站点设 `true` |
| `AUTH_SESSION_COOKIE_SAMESITE` | 登录 cookie SameSite 策略 | 可选 | 默认 `lax` |
| `AUTH_SESSION_COOKIE_DOMAIN` | 登录 cookie 域名 | 跨子域时填写 | 如 `.example.com`；单域部署留空 |
| `AUTH_CODE_TTL_SECONDS` | 邮箱验证码有效期 | 可选 | 默认 `600` |
| `AUTH_CODE_COOLDOWN_SECONDS` | 重新发送验证码冷却时间 | 可选 | 默认 `60` |
| `AUTH_CODE_MAX_ATTEMPTS` | 单个验证码最大尝试次数 | 可选 | 默认 `5` |
| `AUTH_CODE_HASH_SECRET` | 邮箱验证码 HMAC secret | 关闭开发绕过并启用验证码时必填 | 使用随机长字符串，例如 `openssl rand -base64 48` |
| `AUTH_VERIFICATION_STORE_BACKEND` | 验证码存储后端配置项 | 可选 | 当前代码实际仍使用进程内 memory，多进程部署要谨慎 |
| `BREVO_SMTP_HOST` | Brevo SMTP 主机 | 启用邮箱验证码时必填 | `smtp-relay.brevo.com` |
| `BREVO_SMTP_PORT` | Brevo SMTP 端口 | 启用邮箱验证码时必填 | `587`，或按服务商配置使用 `465` |
| `BREVO_SMTP_USERNAME` | Brevo SMTP 登录名 | 启用邮箱验证码时必填 | Brevo 后台 SMTP 登录名 |
| `BREVO_SMTP_PASSWORD` | Brevo SMTP 密钥 | 启用邮箱验证码时必填 | Brevo SMTP key，不是 Brevo 账号密码，也不是 API key |
| `MAIL_FROM_EMAIL` | 发件邮箱 | 启用邮箱验证码时必填 | Brevo 中已验证的 sender 地址 |
| `MAIL_FROM_NAME` | 发件人显示名 | 可选 | `PageAlong` |
| `ADMIN_BOOTSTRAP_EMAIL` | 初始化管理员邮箱 | 部署脚本会在初始化时提示输入；也可手工预置 | 你的管理员邮箱 |
| `ADMIN_BOOTSTRAP_PASSWORD` | 初始化管理员密码 | 部署脚本会在初始化时提示输入；也可手工预置 | 强密码；初始化后不要长期保留明文 |

如果 `AUTH_DEV_BYPASS=false`，注册和找回密码依赖邮箱验证码，因此 SMTP 相关变量需要可用。当前验证码存储实现是进程内内存，如果 API 多进程或多实例，验证码可能只在发码的那个进程有效。

## 内部接口保护变量

| 变量 | 含义 | 是否必填 | 推荐填写 |
| --- | --- | --- | --- |
| `INTERNAL_API_HMAC_SECRET` | `/internal` 接口 HMAC 签名 secret | 生产安全建议填 | 随机长字符串，例如 `openssl rand -base64 48` |
| `INTERNAL_API_SIGNATURE_TTL_SECONDS` | HMAC 请求签名有效期 | 可选 | 默认 `300` |
| `INTERNAL_API_REPLAY_STORE` | HMAC nonce 防重放存储 | 多实例时建议配置 | 单实例可 `memory`；多实例建议 `redis` |
| `INTERNAL_API_TOKEN` | 旧的内部接口 token 配置 | 不建议使用 | 留空 |

当前 worker 实际通过本地 CLI 子进程执行音频生成和 URL 导入任务，不依赖 `/internal` HTTP 接口。但如果未来改成 HTTP 内部调用，应启用 HMAC。

## 对象存储和媒体变量

音频和 URL 导入图片可以写本地目录，也可以上传到 S3-compatible 存储，例如 Cloudflare R2、S3、MinIO。

| 变量 | 含义 | 是否必填 | 推荐填写 |
| --- | --- | --- | --- |
| `TTS_STORAGE_BACKEND` | 音频存储后端 | 生产建议明确填 | 不接对象存储填 `local`；R2 填 `r2`；也支持 `s3`、`minio` |
| `URL_IMPORT_IMAGE_STORAGE_BACKEND` | URL 导入图片存储后端 | 可选 | 留空则跟随 `TTS_STORAGE_BACKEND`；R2 填 `r2` |
| `S3_ENDPOINT_URL` | S3/R2/MinIO API endpoint | 使用 `r2/s3/minio` 时必填 | R2：`https://<account-id>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID` | S3/R2 access key | 使用 `r2/s3/minio` 时必填 | 对象存储后台创建的 key |
| `S3_SECRET_ACCESS_KEY` | S3/R2 secret key | 使用 `r2/s3/minio` 时必填 | 对象存储后台创建的 secret |
| `S3_BUCKET` | 存储桶名 | 使用 `r2/s3/minio` 时必填 | 如 `pagealong-media-prod` |
| `MEDIA_PUBLIC_BASE_URL` | 浏览器可访问媒体的公开基础 URL | R2/S3 生产强烈建议填 | R2 Custom Domain，如 `https://media.example.com` |
| `LOCAL_MEDIA_DIR` | 本地媒体目录 | `local` 后端时使用 | 放在持久化目录，如 `storage/media` 或 `/data/pagealong/media` |
| `TTS_SIGNED_URL_TTL_SECONDS` | 音频/图片读取路由缓存 TTL | 可选 | 默认即可 |
| `URL_IMPORT_IMAGE_MAX_COUNT` | 单篇 URL 导入文章最多导入图片数 | 可选 | 默认 `20` |
| `URL_IMPORT_IMAGE_MAX_BYTES` | 单张 URL 导入图片最大字节数 | 可选 | 默认 `8388608`，即 8MB |

Cloudflare R2 示例：

```env
TTS_STORAGE_BACKEND=r2
URL_IMPORT_IMAGE_STORAGE_BACKEND=r2
S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=<r2-access-key>
S3_SECRET_ACCESS_KEY=<r2-secret-key>
S3_BUCKET=pagealong-media-prod
MEDIA_PUBLIC_BASE_URL=https://media.example.com
```

如果不配置 `MEDIA_PUBLIC_BASE_URL`，对象路径可能无法作为浏览器直链使用，后端读取路由会成为 fallback，缓存和访问效果会差一些。

## 媒体压缩变量

这些变量在 `Settings` 中支持，但当前 `.env.example` 没有完整列出。音频压缩依赖服务器安装 `ffmpeg`。

| 变量 | 含义 | 推荐填写 |
| --- | --- | --- |
| `MEDIA_COMPRESSION_ENABLED` | 是否启用媒体压缩总开关 | 默认 `true` |
| `MEDIA_COMPRESSION_FAILURE_MODE` | 压缩失败策略 | 默认 `strict`；想失败时保留原文件可填 `fallback_original` |
| `MEDIA_COMPRESSION_TIMEOUT_SECONDS` | 压缩命令超时 | 默认 `300` |
| `AUDIO_COMPRESSION_ENABLED` | 是否启用音频压缩 | 默认 `true` |
| `AUDIO_COMPRESSION_FORMAT` | 音频压缩输出格式 | 默认 `mp3` |
| `AUDIO_COMPRESSION_BITRATE` | 音频码率 | 默认 `64k` |
| `AUDIO_COMPRESSION_SAMPLE_RATE` | 音频采样率 | 默认 `24000` |
| `AUDIO_COMPRESSION_CHANNELS` | 音频声道数 | 默认 `1` |
| `IMAGE_COMPRESSION_ENABLED` | 是否启用图片压缩 | 默认 `true` |
| `IMAGE_COMPRESSION_FORMAT` | 图片压缩格式 | 当前实现输出 `webp` |
| `IMAGE_COMPRESSION_QUALITY` | 图片质量 | 默认 `80` |
| `IMAGE_COMPRESSION_MAX_WIDTH` | 图片最大宽度 | 默认 `1600` |
| `IMAGE_COMPRESSION_MAX_HEIGHT` | 图片最大高度 | 默认 `1600` |

## TTS 路由和供应商变量

如果只是先部署稳定演示环境，建议使用 fake TTS：

```env
TTS_PROVIDER_MODE=fake
TTS_STORAGE_BACKEND=local
```

如果启用 `auto` 或 `real`，代码会走分段 TTS 供应商路由。对应依赖和供应商账号需要真实可用。

| 变量 | 含义 | 推荐填写 |
| --- | --- | --- |
| `TTS_PROVIDER_MODE` | TTS 模式 | `fake` 使用 fake TTS；`auto`/`real` 走供应商路由 |
| `TTS_DEFAULT_FREE_PROVIDER` | 免费用户默认供应商 | 默认 `edge_tts` |
| `TTS_FREE_FALLBACK_PROVIDER` | 免费用户备用供应商 | 默认 `kokoro_onnx_cpu` |
| `TTS_DEFAULT_PAID_PROVIDER` | 付费用户默认供应商 | 默认 `tencent_cloud_tts` |
| `TTS_PAID_FALLBACK_PROVIDER` | 付费用户备用供应商 | 默认 `aws_polly_standard` |
| `TTS_PAID_USER_IDS` | 临时付费用户 ID 列表 | 逗号分隔，认证/支付完整前用于临时路由 |

### Edge TTS

| 变量 | 含义 | 推荐填写 |
| --- | --- | --- |
| `TTS_EDGE_ENABLED` | Edge TTS 是否启用的配置项 | 示例默认 `true`；当前路由主要看 provider id |
| `TTS_EDGE_TIMEOUT_SECONDS` | Edge TTS 超时配置项 | 示例默认 `20` |
| `TTS_EDGE_MAX_CONCURRENCY` | Edge TTS 最大并发配置 | 默认 `2` |

### Kokoro ONNX CPU

| 变量 | 含义 | 使用条件 |
| --- | --- | --- |
| `TTS_KOKORO_MODEL_PATH` | Kokoro ONNX 模型文件路径 | 使用 `kokoro_onnx_cpu` 时必填 |
| `TTS_KOKORO_VOICES_PATH` | Kokoro voices 文件路径 | 使用 `kokoro_onnx_cpu` 时必填 |
| `TTS_KOKORO_VOICE` | Kokoro 音色 | 默认 `zf_xiaobei` |
| `TTS_KOKORO_VOICE_PATH` | 兼容旧 voices 路径变量 | 如果没有 `TTS_KOKORO_VOICES_PATH`，代码会尝试使用它 |
| `TTS_KOKORO_MAX_CONCURRENCY` | Kokoro 最大并发 | 默认 `1` |

### 腾讯云 TTS

| 变量 | 含义 | 使用条件 |
| --- | --- | --- |
| `TTS_TENCENT_APP_ID` | 腾讯云 TTS AppId | 使用 `tencent_cloud_tts` 时必填 |
| `TTS_TENCENT_SECRET_ID` | 腾讯云 SecretId | 使用 `tencent_cloud_tts` 时必填 |
| `TTS_TENCENT_SECRET_KEY` | 腾讯云 SecretKey | 使用 `tencent_cloud_tts` 时必填 |
| `TTS_TENCENT_REGION` | 腾讯云区域配置 | 默认 `ap-guangzhou` |
| `TTS_TENCENT_VOICE_TYPE` | 腾讯云音色 ID | 默认 `101001` |
| `TTS_TENCENT_CODEC` | 输出格式 | 默认 `mp3` |
| `TTS_TENCENT_SAMPLE_RATE` | 采样率 | 默认 `16000` |
| `TTS_TENCENT_TIMEOUT_SECONDS` | 请求超时 | 默认 `30` |
| `TTS_TENCENT_MAX_CONCURRENCY` | 最大并发 | 默认 `16` |
| `TTS_TENCENT_MAX_CHINESE_CHARS` | 单段中文字符限制 | 默认 `560` |
| `TTS_TENCENT_MAX_ENGLISH_LETTERS` | 单段英文字符限制 | 默认 `1600` |

### AWS Polly

| 变量 | 含义 | 使用条件 |
| --- | --- | --- |
| `TTS_AWS_REGION` | AWS Polly 区域 | 默认 `us-east-1` |
| `TTS_AWS_POLLY_VOICE_ID` | Polly voice id | 默认 `Zhiyu` |
| `TTS_AWS_POLLY_ENGINE` | Polly engine | 默认 `standard` |
| `TTS_AWS_POLLY_MAX_CONCURRENCY` | 最大并发 | 默认 `60` |
| `TTS_AWS_POLLY_MAX_CHARACTERS` | 单段最大字符数 | 默认 `2500` |
| `AWS_ACCESS_KEY_ID` | AWS access key | 使用 Polly 时必填，boto3 标准变量 |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | 使用 Polly 时必填，boto3 标准变量 |
| `AWS_SESSION_TOKEN` | AWS session token | 使用临时凭据时填写 |

### TTS 配额

| 变量 | 含义 | 推荐填写 |
| --- | --- | --- |
| `FREE_TTS_MONTHLY_COURSE_LIMIT` | 免费用户每月课程数限制配置 | 示例默认 `3` |
| `FREE_TTS_DAILY_COURSE_LIMIT` | 免费用户每日生成次数限制 | 代码默认 `10`；`.env.example` 示例为 `0`，`0` 表示不限制 |
| `FREE_TTS_MONTHLY_AUDIO_MINUTES` | 免费用户每月音频分钟限制配置 | 示例默认 `60` |
| `FREE_TTS_MAX_COURSE_CHARACTERS` | 免费用户单课程最大字符数 | 默认 `12000` |
| `PAID_TTS_MAX_AUTO_CHARACTERS` | 付费用户自动生成最大字符数 | 默认 `120000` |

## Worker CLI 变量

当前 worker 收到 Celery 任务后，会调用 API 项目的 CLI 模块执行任务。默认仓库布局下不用配置。

| 变量 | 含义 | 什么时候填 |
| --- | --- | --- |
| `API_CLI_WORKDIR` | worker 调用 API CLI 时的工作目录 | 自定义部署目录或 worker/API 分离部署时填写 |
| `API_CLI_PYTHON` | worker 调用 API CLI 时使用的 Python 路径 | 自定义 venv 路径时填写 |

## 推荐生产 `.env` 模板

下面是一个偏保守的生产模板。按实际域名、数据库、Redis、对象存储和邮件服务替换占位符。

```env
DATABASE_URL=postgresql+psycopg://<db_user>:<db_password>@<db_host>:5432/web_reader
REDIS_URL=redis://:<redis_password>@<redis_host>:6379/0
REDIS_KEY_PREFIX=web_reader:

API_HOST=127.0.0.1
API_PORT=8000
WEB_HOST=127.0.0.1
WEB_PORT=3000
API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_BASE_URL=/api
CORS_ALLOW_ORIGINS=https://example.com

AUTH_DEV_BYPASS=false
AUTH_CODE_HASH_SECRET=<random-long-secret>
AUTH_SESSION_COOKIE_SECURE=true

BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_USERNAME=<brevo-smtp-login>
BREVO_SMTP_PASSWORD=<brevo-smtp-key>
MAIL_FROM_EMAIL=no-reply@example.com
MAIL_FROM_NAME=PageAlong

INTERNAL_API_HMAC_SECRET=<random-long-secret>
INTERNAL_API_SIGNATURE_TTL_SECONDS=300
INTERNAL_API_REPLAY_STORE=memory
INTERNAL_API_TOKEN=

TTS_PROVIDER_MODE=fake
TTS_STORAGE_BACKEND=local
LOCAL_MEDIA_DIR=storage/media
URL_IMPORT_IMAGE_STORAGE_BACKEND=
```

如果使用 Cloudflare R2，把对象存储部分替换为：

```env
TTS_STORAGE_BACKEND=r2
URL_IMPORT_IMAGE_STORAGE_BACKEND=r2
S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=<r2-access-key>
S3_SECRET_ACCESS_KEY=<r2-secret-key>
S3_BUCKET=pagealong-media-prod
MEDIA_PUBLIC_BASE_URL=https://media.example.com
```
