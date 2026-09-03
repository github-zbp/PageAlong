<p align="center">
  中文 ｜ <a href="./README_en.md">English</a>
</p>

<h1 align="center">页相随 PageAlong</h1>

<p align="center">
  <img src="apps/mobile/assets/logo/web_reader-logo.png" alt="页相随 PageAlong logo" width="128" />
</p>

## 产品介绍

页相随 PageAlong 是一个面向手机学习场景的剪藏式有声课程产品，把网页文章、课程内容和文档转成可听、可管理、可续播的音频课程，利用碎片化时间，不需要盯屏幕的通勤学习工具。

完全vibe coding给自己用的一个小工具，欢迎大家免费使用，无需付费；

这个项目目前我部署到一个小机器上，用的人多的话可能响应慢，请大家谅解；

如果大家觉得好用，想帮我升级一下服务器，也欢迎赞助😁；

### 产品官网
<https://www.pagealong.com>（后续可能更换产品官网）

### 产品形态
- Web 端
- Chrome 插件
- 安卓 APP

### 产品功能
1. 多入口导入：支持 URL、纯文本、文件、Chrome 扩展和 Android 分享收藏文章到PageAlong并生成文档+音频。
2. 自动整理正文：提取页面主文，清洗噪音内容，把内容整理成适合阅读和收听的课程正文。
3. 句子级音频课程：按句生成时间轴，支持当前句高亮、句子跳转和断点续听。
4. 课程库管理：按课程、系列和标签集中管理收藏内容，方便搜索、筛选和继续学习。
5. 生成状态可追踪：导入、正文解析、音频生成和下载都能看到状态，失败后可重试。
6. 下载留存：支持下载音频、Markdown、Word 和 PDF，便于复听、复查和再编辑。
7. 手机场景优先：通勤、做饭、睡前等不方便看屏幕的场景，可以直接接着听。

## 一键部署

支持的部署环境为 Mac/Linux。部署方式有两种：

- 容器化安装与启动（推荐）
```
# 一键安装部署
make compose-prod

# 查看容器
docker ps -a | grep web-reader

# 移除容器服务
docker compose -f docker-compose.prod.yml down
```

- 宿主机安装与启动
```
make bootstrap-prod
```

两种方式都会在根目录缺少 `.env` 时先从 `.env.example` 复制一份。`make compose-prod` 还会在执行过程中引导你补齐最小运行配置，并把填写结果写回 `.env`。

### 部署时会被引导填写的变量

#### 必填环境变量（安装时会引导填写）
| 变量 | 用途 | 配置方式 |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串 | 写入根目录 `.env`，`make compose-prod` 会提示填写 |
| `REDIS_URL` | Redis 连接串 | 同上 |
| `TTS_STORAGE_BACKEND` | 音频存储后端 | 同上，`local` / `r2` / `s3` / `minio` |
| `ADMIN_BOOTSTRAP_EMAIL` | 第一位管理员邮箱 | `make compose-prod` 会提示填写 |
| `ADMIN_BOOTSTRAP_PASSWORD` | 第一位管理员密码 | `make compose-prod` 会提示填写 |

#### 选填环境变量
| 变量 | 用途 | 配置方式 |
| --- | --- | --- |
| `URL_IMPORT_IMAGE_STORAGE_BACKEND` | URL 导入图片存储后端 | 同上，通常可与音频存储保持一致 |
| `S3_ENDPOINT_URL` | S3/R2/MinIO endpoint | 选择对象存储后填写 |
| `S3_ACCESS_KEY_ID` | 对象存储 access key | 选择对象存储后填写 |
| `S3_SECRET_ACCESS_KEY` | 对象存储 secret key | 选择对象存储后填写 |
| `S3_BUCKET` | 对象存储 bucket | 选择对象存储后填写 |
| `API_HOST_PORT` | 宿主机暴露的 API 端口 | 端口冲突时调整 |
| `WEB_HOST_PORT` | 宿主机暴露的 Web 端口 | 端口冲突时调整 |

### 最小运行环境变量

如果你想先跑一个最小可用版本，建议把下面这些写进根目录 `.env`：

```env
DATABASE_URL=postgresql+psycopg://<db_user>:<db_password>@<db_host>:5432/web_reader
REDIS_URL=redis://:<redis_password>@<redis_host>:6379/0
API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_BASE_URL=/api
CORS_ALLOW_ORIGINS=https://你的域名
TTS_PROVIDER_MODE=fake 或者 edge_tts
TTS_STORAGE_BACKEND=local
URL_IMPORT_IMAGE_STORAGE_BACKEND=local
```

配置方式：
- 根目录 `.env` 是生产和容器化部署的主要配置入口。
如果要使用真实对象存储或真实 TTS 供应商，再参考 [docs/environment-variables.md](docs/environment-variables.md) 补全对应变量。

## 技术栈

- Web 端：Next.js 13、React 18、TypeScript、Tailwind CSS、Playwright
- Chrome 插件：Vite、React 18、TypeScript、Vitest
- 安卓 APP：React Native、Expo、Expo Router、TypeScript
- 后端 API：FastAPI、SQLAlchemy、Alembic、Python 3.12
- 异步任务：Celery
- 数据与缓存：PostgreSQL、Redis
- 内容处理：readability-lxml、trafilatura、markdownify、python-docx、pypdf、EbookLib
- 媒体与对象存储：本地目录、Cloudflare R2、S3、MinIO
- TTS 供应商：Edge TTS、Kokoro ONNX CPU、Tencent Cloud TTS、AWS Polly；fake provider 仅保留用于测试
- 邮件服务：Brevo SMTP
- 部署与脚本：Makefile、Docker、Docker Compose、tmux

## 后续待开发功能

这些功能是否继续开发，取决于上线后的用户量和反馈。

- 男声和女生音色，更多其他音色和方言
- 更好看的书籍封面生成
- AI 自动生成笔记 / 总结
- 社区、评论、分享
- 同步到 Notion、Obsidian 等第三方知识管理工具

## 作者联系方式（交个朋友）

如果对这个工具有建议、意见，或者想补充功能，或者单纯想和阿沛交个朋友，欢迎联系我。

- QQ：1640632344
- 微信：zbp_01
- 邮箱：wenzhangxiang@yeah.net
- 公众号：程序员阿沛

| 个人微信二维码 | 公众号二维码 |
| --- | --- |
| <img src="apps/mobile/assets/logo/个人微信二维码.jpg" alt="个人微信二维码" width="180" /> | <img src="apps/mobile/assets/logo/qrcode_程序员阿沛.jpg" alt="公众号二维码" width="180" /> |

## 禁止商业化声明

本项目采用 [PolyForm Noncommercial License 1.0.0](LICENSE)，仅允许非商业用途，禁止任何形式的商业化使用。
