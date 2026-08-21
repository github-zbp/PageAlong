# 账号体系设计

Date: 2026-08-02

## Goal

为 Web Reader 增加一套自建账号体系，覆盖注册、登录、个人账号管理和管理员用户管理。

本轮要解决的核心问题是：

- 注册需要邮箱、密码和邮件验证码。
- 登录需要邮箱+密码。
- 验证码通过 Brevo SMTP 发送，后端要打印验证码日志。
- 同一邮箱 1 分钟内不能重复发送验证码。
- 管理员后台首版只做用户管理。
- 初始管理员账号需要自动种子化。

## Current Context

- 当前后端只用 `X-User-Id` 做开发态身份隔离，默认值是 `dev_user`。
- 课程、系列、播放进度等业务表已经通过 `user_id` 做了隔离。
- 前端大多是客户端直连 API，认证调用集中在 `apps/web/src/lib/api.ts`。
- `ConsoleShell` 目前还硬编码展示 `dev_user`。
- 仓库里还没有正式的用户表、会话表或管理员后台。

## Scope

### In scope

- 注册、登录、退出登录。
- 邮箱验证码发送、校验和冷却限制。
- 个人账号管理。
- 管理员用户管理后台。
- 初始管理员账号种子。
- 开发态兼容 `X-User-Id`。

### Out of scope

- 手机号注册和短信验证码。
- 第三方 OAuth / SSO。
- 多因素认证。
- 邮箱改绑。
- 用户删除。
- 支付、订阅、风控平台。

## Recommended Approach

采用自建账号体系，认证令牌使用不透明的 bearer token。

原因：

- 当前前端与 API 直连，且多为客户端组件。
- 用 bearer token 可以直接挂到 `apps/web/src/lib/api.ts`，不需要先补一层 BFF 或反向代理。
- API 只需要保存 token 哈希，不保存明文 token。
- 开发态仍可保留 `AUTH_DEV_BYPASS` + `X-User-Id`，不打断现有本地流程。

## Authentication Model

### Session token

- 登录/注册成功后，后端返回一个 session token。
- 前端把 token 存在浏览器 `localStorage` 中。
- 所有受保护 API 请求统一附带 `Authorization: Bearer <token>`。
- 后端只存 token 哈希、过期时间和会话元数据。

### Dev bypass

- 仅本地开发和测试允许 `AUTH_DEV_BYPASS=true`。
- 该模式下，如果请求没有 `Authorization`，依然允许 `X-User-Id` 走旧流程。
- 生产环境禁用该旁路。

## Data Model

### users

字段建议：

- `id`：UUID 字符串，作为业务表的 `user_id`。
- `email`：唯一、统一小写。
- `password_hash`：密码哈希，不存明文。
- `role`：`user | admin`。
- `status`：`active | disabled`。
- `email_verified_at`：邮箱验证完成时间。
- `must_change_password_at_next_login`：初始管理员首登强制改密。
- `last_login_at`：最近登录时间。
- `created_at` / `updated_at`。

### auth_sessions

字段建议：

- `id`
- `user_id`
- `token_hash`
- `expires_at`
- `revoked_at`
- `last_seen_at`
- `user_agent`
- `ip_address`
- `created_at`

### auth_events

用于审计，不对普通用户展示。

记录：

- 验证码发送
- 注册
- 登录成功 / 失败
- 退出登录
- 改密
- 重置密码
- 管理员禁用 / 启用 / 升降权 / 强制下线

### Redis keys

验证码不落库，放 Redis：

- `auth:code:{purpose}:{email}` -> 验证码哈希、过期时间、失败次数
- `auth:cooldown:{purpose}:{email}` -> 60 秒冷却

## Verification Code Rules

- 验证码位数：6 位数字。
- 有效期：10 分钟。
- 发送间隔：同一邮箱、同一用途 60 秒内不能重发。
- 单次验证码只可使用一次。
- 连续错误次数达到上限后失效。

### Logging requirement

验证码发送成功后，后端必须打印验证码日志。

建议日志字段：

- `event=auth.verification_code_sent`
- `email`
- `purpose`
- `code`
- `expires_in_seconds`

这个日志只允许出现在后端受控日志里，不返回给前端。

## Email Provider

首版使用 Brevo SMTP。

建议环境变量：

- `BREVO_SMTP_HOST`
- `BREVO_SMTP_PORT`
- `BREVO_SMTP_USERNAME`
- `BREVO_SMTP_PASSWORD`
- `MAIL_FROM_EMAIL`
- `MAIL_FROM_NAME`

`BREVO_API_KEY` 先保留在密钥管理中，不作为 v1 发送主路径。

## Registration Flow

### 1. Request code

`POST /auth/email/code`

输入：

- `email`
- `purpose=register`

行为：

- 校验邮箱格式。
- 检查 60 秒冷却。
- 生成验证码并通过 Brevo SMTP 发送。
- 把验证码哈希写入 Redis。
- 记录审计事件和验证码日志。

失败返回：

- 冷却中：`429`
- 邮箱格式非法：`400`

### 2. Register

`POST /auth/register`

输入：

- `email`
- `password`
- `code`

行为：

- 校验验证码。
- 校验密码强度。
- 如果邮箱已存在，直接拒绝。
- 创建用户，设置 `email_verified_at`。
- 创建 session。
- 返回当前用户信息和 token。

密码规则建议：

- 最少 8 位。
- 至少包含字母和数字。

## Login Flow

`POST /auth/login`

输入：

- `email`
- `password`

行为：

- 统一按小写邮箱查用户。
- 账号被禁用时拒绝登录。
- 密码校验成功后创建 session。
- 返回 token 和当前用户信息。

特殊处理：

- 如果用户 `must_change_password_at_next_login=true`，登录成功后前端必须先跳改密页。
- 该状态也应该出现在 `GET /auth/me` 和登录响应里，供前端做路由守卫。

## Account Management

### Self-service endpoints

- `GET /auth/me`
- `POST /auth/change-password`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `POST /auth/password-reset/code`
- `POST /auth/password-reset/confirm`

### UI

个人账号页显示：

- 邮箱
- 角色
- 账号状态
- 邮箱验证状态
- 最近登录时间
- 当前登录设备信息

操作：

- 改密码
- 退出登录
- 退出所有设备
- 忘记密码

## Admin Backend

### Route

建议使用独立后台路由：

- `/admin/users`

### Permissions

仅 `role=admin` 可访问。

后端必须做权限校验，前端隐藏入口不算权限控制。

### User management scope

首版只做用户管理，不做内容管理。

功能包括：

- 用户列表
- 搜索邮箱
- 按角色筛选
- 按状态筛选
- 查看用户详情
- 禁用 / 启用账号
- 强制退出所有会话
- 升级 / 降级管理员
- 发送重置密码邮件

### Important guardrails

- 不做硬删除。
- 不能把最后一个活跃管理员降级或禁用。
- 管理员对自己操作时要二次确认。

## Admin Bootstrap

需要一个一次性种子流程创建初始管理员账号。

建议：

- 通过环境变量或初始化脚本注入管理员邮箱和密码。
- 仅在账号不存在时创建，不覆盖已有密码。
- 创建后将 `role` 设为 `admin`，`status` 设为 `active`。
- `must_change_password_at_next_login=true`。

bootstrap 账号的明文密码不能写进代码或文档正文，只能从环境变量/密钥管理提供。

## Frontend Changes

### Public auth pages

- 登录页
- 注册页
- 忘记密码页
- 重置密码页

### Auth-aware shell

- `apps/web/src/lib/api.ts` 改成统一 request helper。
- 自动读取并附带 bearer token。
- 401 后清除本地会话并跳登录页。
- `ConsoleShell` 去掉硬编码 `dev_user`，改成账号菜单。
- 管理员显示后台入口。
- 首版受保护页面继续以客户端 auth gate 为主，避免把登录态绑死在 SSR。

### Admin UI

后台首版用密集表格 + 详情面板即可，不做营销式布局。

## Security Notes

- 密码建议使用带随机盐的 PBKDF2-HMAC-SHA256 或同等级别的强哈希，不存明文。
- session token 只保存 SHA-256 哈希，不保存明文。
- 验证码打印是显式产品要求，但只应出现在后端受控日志里。
- 生产环境不要开启 `AUTH_DEV_BYPASS`。
- 验证码发送、登录失败、重置密码都应该有基础限流。

## API Summary

### Auth

- `POST /auth/email/code`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /auth/me`
- `POST /auth/change-password`
- `POST /auth/password-reset/code`
- `POST /auth/password-reset/confirm`

### Admin

- `GET /admin/users`
- `GET /admin/users/{user_id}`
- `POST /admin/users/{user_id}/disable`
- `POST /admin/users/{user_id}/enable`
- `POST /admin/users/{user_id}/promote`
- `POST /admin/users/{user_id}/demote`
- `POST /admin/users/{user_id}/force-logout`
- `POST /admin/users/{user_id}/send-password-reset`

## Tests

### Backend

- 验证码发送后打印日志。
- 60 秒冷却生效。
- 验证码过期、错误、单次使用。
- 注册创建用户并生成 session。
- 登录/退出/改密流程。
- 管理员权限校验。
- 禁用账号后不可登录。
- 不能降级最后一个管理员。
- bootstrap 管理员种子幂等。

### Frontend

- 登录、注册、忘记密码、改密。
- 未登录访问受保护页面会跳转登录。
- 管理员可见后台入口。
- 普通用户不可进入后台。

### Manual QA

- 使用 Brevo sender 发到 `juhuatang@outlook.com` 和 `wenzhangxiang@yeah.net` 验证邮件链路。
- 验证验证码在后端日志可见。
- 验证 60 秒重发限制。

## Implementation Notes

- 现有 `user_id` 字段继续保留，不做大范围表结构翻写。
- 本轮优先保证认证层和用户管理闭环，不把手机号、MFA、外部登录一起塞进来。
- 之后如果要接短信，只需要在 `auth` 模块里再加一个 `phone` identity 和对应 provider，不需要重做课程业务。
