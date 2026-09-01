# AGENTS.md

## 项目背景

- 本仓库是页相随 PageAlong：一个面向移动学习场景的 Web Reader，用于把粘贴的文本转成可管理的有声课程记录。
- 当前基础架构包括 FastAPI API、Celery worker、PostgreSQL、Redis、MinIO 兼容对象存储，以及 Next.js H5/Web 前端。
- 真实 TTS、URL 导入、文件上传、OCR、认证、支付和生产可观测性尚未实现。不要把这些描述成已经可用的功能。

## 仓库结构

- `services/api/`：FastAPI 应用、SQLAlchemy 模型、API 路由、业务服务逻辑和 API 测试。
- `services/worker/`：Celery worker 应用、音频生成任务骨架和 worker 测试。
- `apps/web/`：Next.js 13 + React 18 前端、TypeScript 组件、App Router 路由和 Playwright 测试。
- `scripts/`：本地辅助脚本，例如数据库初始化。
- `docs/`：本地/生产运行文档，以及规划和设计记录。
- `.agents/`：本项目的产品和营销上下文。

## 本地开发

- 本地运行命令优先参考 `docs/local-development.md`。
- 在这台开发机上，本地 API 命令应使用 `8070` 端口，避免和长期占用的 `8000` 端口冲突。
- 本地端口调整使用命令级环境变量覆盖：
  - API：`API_PORT=8070 make api`
  - Web：`API_BASE_URL=http://127.0.0.1:8070 NEXT_PUBLIC_API_BASE_URL=http://localhost:8070 make web`
- 不要为了这个本地端口偏好去修改 `Makefile` 默认 API 端口、`.env.example` 默认值、生产运行文档或源码默认值。
- `make up` 用于管理本地 Postgres、Redis 和 MinIO 服务。启动或停止 Docker 前，先确认用户当前环境是否需要。

## 常用命令

- 安装依赖：`make deps`
- 启动本地依赖服务：`make up`
- 初始化数据库：`make init-db`
- 本地启动 API：`API_PORT=8070 make api`
- 启动 worker：`make worker`
- 本地启动 Web：`API_BASE_URL=http://127.0.0.1:8070 NEXT_PUBLIC_API_BASE_URL=http://localhost:8070 make web`
- 后端测试：`make test-api`
- Worker 测试：`cd services/worker && .venv/bin/python -m pytest -q`
- Web 测试：`make test-web`
- 全量测试目标：`make test`

## 工程约定

- 优先沿用现有模式，不要过早引入新抽象。
- 后端业务逻辑放在 `services/api/app/services/`，路由层 HTTP 细节放在 `services/api/app/api/routes/`。
- Worker 编排逻辑放在 `services/worker/app/tasks/`。
- 前端 API 访问集中在 `apps/web/src/lib/api.ts`，界面文案集中在 `apps/web/src/lib/i18n.ts`。
- 公开官网页（首页、指南、博客、产品故事、下载、隐私政策、用户条款）必须保持服务端渲染；即便页面暂时只是占位内容，也不要改成纯客户端渲染，首屏正文和导航应由 App Router 的 server component 直接输出。
- 前端使用 npm；没有明确要求时不要切换包管理器。
- Python 沿用现有 `venv + pip` 工作流；没有明确要求时不要引入 `uv` 或 Poetry。
- 除非任务明确要求接入真实音频生成，否则保留当前 fake TTS 流程。
- 本地开发当前使用固定的 `X-User-Id` 请求头。除非明确实现认证，否则不要加入认证假设。
- APP 的自定义顶部栏不能和手机系统顶部栏重合，任何原生页面顶部工具栏都必须预留 safe area / 状态栏内边距。

## 安全和 Git 约束

- 工作区可能包含用户已有改动。除非用户明确要求，否则不要回滚你没有做过的改动。
- 不要提交或打包生成目录和缓存，例如 `node_modules`、`.next`、`.venv`、`.pytest_cache` 或 `__pycache__`。
- 不要提交 `.env` 中的密钥或私有配置。
- `web_reader-src.tar.gz` 是生成的源码归档。除非用户明确要求重新打包，否则不要更新它。

## 验证要求

- 代码改动先运行最小但有意义的测试；如果影响共享行为，再扩大验证范围。
- 后端 API 改动运行 `make test-api`。
- Worker 改动运行 `cd services/worker && .venv/bin/python -m pytest -q`。
- 前端行为改动运行 `make test-web`；如果改到路由、Server Component 或 API 连接方式，再考虑运行 `cd apps/web && npm run build`。
- 仅文档改动使用有针对性的 `rg` 检查和 `git diff` 验证，不需要跑全量测试。

## APP端和web端的代码边界

- APP端的代码位于apps/mobile目录下，web端的代码位于apps/web目录下；
- 之后凡是明确提出“APP端的优化点或者需求点”时请在apps/mobile目录范围内查看代码，不要把web端和APP端的代码搞混，导致代码改错位置；