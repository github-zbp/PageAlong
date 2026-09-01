# 系统管理后台设计

Date: 2026-08-26

## Goal

为页相随 PageAlong 增加一个仅管理员可进入的系统管理后台，入口固定为 `/reader_admin`。

后台只覆盖本轮确认的四个模块：

- 用户管理
- 博客管理
- 课程管理
- 公告板模块

除博客管理和公告板模块采用本设计中的增强建议外，不纳入任务队列、资源管理、反馈工单、TTS 用量、运营概览、审计列表、系统配置等额外后台模块。

## Current Context

- 项目前端是 Next.js App Router，用户控制台当前按 locale 路由组织。
- 后端是 FastAPI，管理员能力应走独立的 admin API 边界。
- 当前已有 `/{locale}/admin` 用户管理页，但本轮决定废弃该入口。
- 用户管理、课程管理、博客管理、公告板都需要跨用户视角，不能复用普通用户只看自己数据的接口。
- 博客前台导航已存在，但博客内容管理模型和正式 CRUD 需要本轮补齐。
- 公告板目前没有可管理的数据模型，本轮按可发布的公告/路线图条目设计。

## Scope

### In scope

- `/reader_admin` 后台入口和管理员访问控制。
- 废弃 `/{locale}/admin` 入口。
- 用户列表、搜索、分页、角色操作和管理员代入用户页面。
- 博客 CRUD、发布/下架、批量操作、软删除、搜索、分页。
- 博客 Markdown/HTML 编辑器接入。
- 课程跨用户列表、搜索、分页、查看、软删除、批量软删除和下载导出。
- 公告板条目 CRUD、Markdown 编辑、发布/下架、软删除、排序和展示位置。

### Out of scope

- 任务/导入管理后台。
- 文件资源/存储管理后台。
- 反馈/工单管理后台。
- 系列与标签后台。
- TTS 用量/配额后台。
- 运营概览后台。
- 管理员操作审计列表后台。
- 支付、订阅、发票或真实账单管理。
- 真实 TTS、OCR 或生产可观测性能力的展示。

## Routing

### Frontend

- 新后台入口：`/reader_admin`
- 推荐子路由：
  - `/reader_admin/users`
  - `/reader_admin/blogs`
  - `/reader_admin/blogs/new`
  - `/reader_admin/blogs/[blogId]`
  - `/reader_admin/courses`
  - `/reader_admin/courses/[courseId]`
  - `/reader_admin/announcements`
  - `/reader_admin/announcements/new`
  - `/reader_admin/announcements/[announcementId]`

`/reader_admin` 默认跳转到 `/reader_admin/users`。

### Deprecated routes

`/{locale}/admin` 和 `/{locale}/admin/users` 不再作为后台入口。

过渡期建议：

- 从主导航移除旧 admin 入口。
- 旧路由直接 redirect 到 `/reader_admin/users`。
- 后续确认没有外部链接依赖后删除旧页面。

### API

后台 API 继续使用 `/admin/*` 前缀。

推荐接口分组：

- `/admin/users`
- `/admin/blogs`
- `/admin/courses`
- `/admin/announcements`
- `/admin/impersonation`

所有接口必须要求当前用户是管理员。

## Admin Access

后台访问规则：

- 未登录访问 `/reader_admin`：跳转登录页，登录后回到原路径。
- 已登录但非管理员：展示无权限页面或返回 403。
- 管理员访问：进入后台 shell。

后台 shell 独立于普通用户 console，不使用普通用户的课程库导航和反馈入口。

## User Management

### List fields

用户列表展示：

- 邮箱
- 注册时间
- 最近活跃时间
- 使用语言
- 角色

最近活跃时间以进入 dashboard 为依据，不能直接用最近登录时间替代。

### Data requirements

需要新增或补齐用户活跃字段：

- `last_dashboard_at`
- `last_dashboard_locale`

当用户进入 `/{locale}/dashboard` 时，前端调用轻量 API 记录：

- 当前用户 ID
- locale
- 当前时间

后台“使用语言”优先展示 `last_dashboard_locale`。如果用户从未进入 dashboard，则展示空值。

### Filters and pagination

用户列表支持：

- 按邮箱搜索
- 按页分页

建议分页参数：

- `page`
- `page_size`

返回：

- `items`
- `pagination`

### Actions

基础操作：

- 设置为管理员
- 进入用户页面

为避免误操作，设置管理员时：

- 目标用户必须存在且未禁用。
- 不允许把最后一个管理员降权或禁用。
- 操作成功后列表刷新。

### Impersonation

“进入用户页面”实现为管理员代入模式，而不是复用用户原登录态。

推荐流程：

1. 管理员点击“进入用户页面”。
2. 后端创建一个短期 impersonation token。
3. 前端打开普通用户 dashboard，并在请求中使用该代入 token。
4. 普通用户界面顶部显示“正在以某用户身份查看”提示。
5. 管理员可随时退出代入，回到 `/reader_admin/users`。

代入 token 建议：

- 有效期短，例如 30 分钟。
- 只能由管理员创建。
- 不暴露目标用户原始 session。
- 禁止在代入状态下修改密码、邮箱、管理员角色等高风险账号操作。

## Blog Management

### List fields

博客列表展示：

- 博客标题
- slug
- 语言
- 作者
- 摘要
- 创建时间
- 更新时间
- 发布时间
- 状态

列表接口不要返回正文内容。

### Status

博客状态：

- `draft`
- `published`
- `offline`
- `deleted`

删除是软删除，将状态置为 `deleted` 或设置 `deleted_at`。

### CRUD

支持：

- 新增博客
- 编辑博客
- 查看博客详情
- 下架/发布
- 删除
- 批量下架/发布
- 批量删除

### Search and pagination

支持：

- 按标题搜索
- 分页

可选扩展筛选：

- 状态
- 语言

### Editor

博客编辑器采用 GitHub 上开源、支持 HTML/Markdown 的编辑器。

推荐选型：Vditor。

原因：

- 开源，MIT License。
- 支持所见即所得、即时渲染和分屏预览。
- 支持 Markdown、GFM 和 Raw HTML。
- 提供 Markdown 转 HTML 能力。
- 支持 XSS filtering，适合 HTML/Markdown 混合编辑场景。

Next.js 接入要求：

- 编辑器作为 client-only 组件动态加载。
- 避免在 Server Component 中直接 import 浏览器依赖。
- 保存时以后端清洗后的 HTML 作为渲染缓存。

### Data model

建议新增 `blog_posts` 表：

- `id`
- `title`
- `slug`
- `language`
- `summary`
- `cover_image_url`
- `body_markdown`
- `body_html`
- `status`
- `author_user_id`
- `seo_title`
- `seo_description`
- `published_at`
- `created_at`
- `updated_at`
- `deleted_at`

内容存储规则：

- `body_markdown` 是主编辑内容。
- `body_html` 是服务端渲染和 sanitize 后的缓存。
- 前台展示优先使用 `body_html`。
- 管理后台详情和编辑接口可以返回正文。
- 管理后台列表接口不返回 `body_markdown` 或 `body_html`。

### Public blog behavior

前台博客列表只展示：

- `published`
- 未软删除
- 符合当前语言

前台博客详情通过 slug 访问。

下架后：

- 前台列表不展示。
- 前台详情返回 404 或下架提示，推荐 404。

## Course Management

### List fields

课程列表展示：

- 课程名称
- 用户邮箱
- 创建时间
- 资源数量
- 下载音频
- 下载 PDF
- 下载 Word
- 下载 Markdown

资源数量包括：

- 图片
- 音频
- PDF
- Word
- Markdown

列表接口不要返回正文内容。

### Search and pagination

支持：

- 按标题搜索
- 按用户邮箱搜索
- 分页

### Actions

支持：

- 查看
- 删除
- 批量删除

删除是软删除，不物理删除课程正文、音频或导出资源。

### Detail view

课程详情可展示：

- 课程基础信息
- 用户邮箱
- 来源类型
- 状态
- 创建时间
- 更新时间
- 资源统计
- 可下载资源
- 正文内容

正文只在详情接口返回。

### Downloads

下载能力以课程已有资源或现有导出能力为准：

- 音频：有当前音频资源时提供下载。
- Markdown：可由当前正文导出。
- Word：对应 docx 导出。
- PDF：对应 pdf 导出。

如果资源未生成：

- 可以显示“未生成”。
- 或触发既有导出生成流程。

不在本轮新增独立资源管理后台。

## Announcement Board

公告板不设计成单个 Markdown 配置，而是可管理的公告/路线图条目。

### List fields

公告列表展示：

- 标题
- 语言
- 状态
- 展示位置
- 排序
- 路线图状态
- 发布时间
- 创建时间
- 更新时间

列表接口不要返回完整正文。

### Status

公告发布状态：

- `draft`
- `published`
- `offline`
- `deleted`

路线图状态：

- `planned`
- `in_progress`
- `shipped`

路线图状态用于公示后续产品功能开发进度。

### Display positions

展示位置建议：

- `dashboard`
- `announcement_page`
- `global_banner`

首版可以只实现 `dashboard`。

### CRUD

支持：

- 新增公告
- 编辑公告
- 预览公告
- 发布/下架
- 删除
- 排序
- 置顶

删除是软删除。

### Data model

建议新增 `announcements` 表：

- `id`
- `title`
- `language`
- `body_markdown`
- `body_html`
- `status`
- `roadmap_status`
- `display_position`
- `sort_order`
- `is_pinned`
- `published_at`
- `created_at`
- `updated_at`
- `deleted_at`

内容存储规则与博客一致：

- Markdown 是主内容。
- HTML 是服务端渲染和 sanitize 后的缓存。
- 后台详情和编辑接口返回正文。
- 列表接口不返回正文。

## API Shape

### Pagination response

后台列表接口统一返回：

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 0,
    "total_pages": 1,
    "has_previous": false,
    "has_next": false
  }
}
```

### Users

- `GET /admin/users?query=&page=&page_size=`
- `POST /admin/users/{user_id}/promote`
- `POST /admin/impersonation`

### Blogs

- `GET /admin/blogs?query=&status=&language=&page=&page_size=`
- `POST /admin/blogs`
- `GET /admin/blogs/{blog_id}`
- `PATCH /admin/blogs/{blog_id}`
- `POST /admin/blogs/{blog_id}/publish`
- `POST /admin/blogs/{blog_id}/offline`
- `DELETE /admin/blogs/{blog_id}`
- `POST /admin/blogs/bulk`

### Courses

- `GET /admin/courses?query=&email=&page=&page_size=`
- `GET /admin/courses/{course_id}`
- `DELETE /admin/courses/{course_id}`
- `POST /admin/courses/bulk-delete`
- `POST /admin/courses/{course_id}/downloads/{format}`

### Announcements

- `GET /admin/announcements?query=&status=&language=&page=&page_size=`
- `POST /admin/announcements`
- `GET /admin/announcements/{announcement_id}`
- `PATCH /admin/announcements/{announcement_id}`
- `POST /admin/announcements/{announcement_id}/publish`
- `POST /admin/announcements/{announcement_id}/offline`
- `DELETE /admin/announcements/{announcement_id}`
- `POST /admin/announcements/reorder`

## Frontend Layout

后台使用独立 admin shell：

- 左侧导航：用户管理、博客管理、课程管理、公告板。
- 顶部显示当前管理员邮箱。
- 提供返回普通工作台入口。
- 移动端可用，但优先保证桌面管理效率。

后台文案以中文为主即可；内容本身支持中文和英文。

## Validation and Safety

### HTML safety

博客和公告都支持 HTML/Markdown，因此必须：

- 服务端统一渲染 Markdown。
- 服务端统一 sanitize HTML。
- 前台只展示清洗后的 HTML。
- 禁止保存或渲染危险脚本、事件属性和不安全链接协议。

### Soft delete

博客、课程、公告删除均为软删除。

软删除后的记录：

- 不在默认列表展示。
- 不在前台展示。
- 可按需要在后台加状态筛选查看，但首版不要求恢复能力。

### Bulk actions

批量操作需要：

- 限制单次最大数量，例如 100。
- 对不存在或无权限对象返回结构化失败信息。
- 不因单条失败导致整个批量操作不可理解。

## Testing

后端测试：

- 管理员权限校验。
- 用户列表分页和邮箱搜索。
- dashboard 活跃时间记录。
- 博客列表不返回正文。
- 博客 CRUD、发布/下架、软删除、批量操作。
- 课程列表跨用户搜索、分页、软删除。
- 课程列表不返回正文。
- 公告列表不返回正文。
- 公告 CRUD、发布/下架、软删除、排序。
- HTML sanitize。

前端测试：

- `/reader_admin` 非管理员不可进入。
- 管理员可进入用户管理。
- 旧 `/{locale}/admin` redirect 或不可见。
- 博客编辑器可输入 Markdown 和 HTML。
- 博客列表、搜索、分页、批量操作。
- 课程列表、搜索、分页、删除。
- 公告编辑、预览、发布和排序。

## Implementation Notes

- 后端业务逻辑放在 `services/api/app/services/`。
- 后台路由放在 `services/api/app/api/routes/admin.py` 或按模块拆分后由 admin router 聚合。
- 前端 API 调用集中在 `apps/web/src/lib/api.ts`。
- 后台文案仍放入 `apps/web/src/lib/i18n.ts` 或拆出 admin 专用字典，但不要散落在组件中。
- 新增表后要同步 `scripts/init_database.py`，因为当前项目没有独立 Alembic 迁移目录。
- 不修改本地端口默认值。
- 不更新 `web_reader-src.tar.gz`。
