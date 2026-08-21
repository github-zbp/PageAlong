# Chrome 插件设计

Date: 2026-08-04

## Goal

为页相随 PageAlong 增加一个桌面 Chrome 插件，让用户在当前网页中剪藏正文、使用 Chrome 浏览器自带 TTS 朗读、跟随朗读高亮网页内容，并可一键同步为 PageAlong 平台里的碎片课程。

本设计同时定义移动端兼容边界：手机端不做桌面扩展形态，而是通过 PageAlong Web 的轻入口同步网页。

## Current Context

- 当前后端已有 FastAPI、Celery、PostgreSQL、Redis、MinIO 兼容对象存储。
- URL 导入已经具备后端抓取、正文抽取、Markdown 归一化、图片下载上传、课程创建和异步任务基础。
- 控制台 URL 导入当前是两段式流程：先抽取并进入 `needs_review`，用户确认后再发起音频生成。
- 账号体系正在接入中，前端当前主要通过 `localStorage` 中的 bearer token 调用 API。
- Web 阅读器已经有 Markdown 正文、句子时间轴、播放器和句子高亮的基础交互。
- 真实 TTS、生产级认证、支付和完整生产可观测性仍不应被描述为已经可用的线上能力。

## Confirmed Decisions

- 桌面端采用 Chrome Manifest V3 扩展。
- 插件默认以 Chrome `sidePanel` 承载，不以短命 popup 作为主体验。
- 移动端不承诺 Chrome 扩展能力，使用 PageAlong Web 轻入口兼容 Android 和 iPhone 浏览器场景。
- 同步导入复用用户已经登录的 PageAlong 会话。
- 为了让扩展复用登录态，API 增加 HttpOnly session cookie 桥接；Web 前端可继续保留 bearer token。
- 插件不生成最终展示 Markdown。插件只提供浏览器上下文中的页面原料，最终清洗、Markdown 规范化、TTS 文本派生和图片落库仍由后端统一处理。
- 插件同步流程不进入控制台 URL 导入的人工确认步骤，而是抽取和 TTS 串成一个异步流程。

## Scope

### In scope

- 桌面 Chrome 扩展项目骨架。
- 当前页正文剪藏和图片候选提取。
- 侧边栏朗读界面。
- 使用 `chrome.tts` 进行本地朗读播放。
- 播放、暂停、停止、前后跳句、倍速控制。
- 网页正文和侧边栏正文同步高亮。
- 高亮颜色设置。
- 默认使用 side panel 展示，并支持用户切换到独立扩展页展示。
- 自动滚动当前朗读句。
- 同步至 PageAlong 平台按钮。
- 未登录检测和登录页跳转提示。
- 新的插件同步导入 API 和异步 worker 流程。
- 移动端 PageAlong Web 轻入口，用于复制或分享 URL 后同步。
- 插件内轻量引流文案。

### Out of scope

- 在移动 Chrome 或 iPhone Chrome 中实现桌面扩展式侧边栏。
- 录制或上传 Chrome 本地 TTS 播放出的音频文件。
- 让插件直接决定平台课程的最终 Markdown 展示格式。
- 登录墙、付费墙或需要用户网页 cookie 的后端抓取。
- OCR。
- PDF viewer 内的深度解析。
- iOS Safari Web Extension 独立发布。
- 支付、订阅和付费权益 UI。

## Platform Boundary

### Desktop Chrome

桌面 Chrome 是完整插件体验：

- 用户点击扩展图标后默认打开 side panel。
- 插件在当前 tab 注入 content script，抽取正文候选并建立句子到 DOM 位置的映射。
- side panel 展示剪藏内容、播放控制、同步按钮和设置。
- content script 负责网页内高亮和自动滚动。
- side panel 通过 extension messaging 控制 content script 和 TTS 播放状态。

相关 Chrome 能力参考：

- `sidePanel`: https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- `tts`: https://developer.chrome.com/docs/extensions/reference/api/tts
- `scripting`: https://developer.chrome.com/docs/extensions/reference/api/scripting
- `storage`: https://developer.chrome.com/docs/extensions/reference/api/storage

### Mobile Web

移动端使用 PageAlong Web 轻入口，而不是桌面扩展 UI：

- 用户从手机浏览器复制 URL 或通过系统分享入口进入 PageAlong 移动导入页。
- 移动导入页检测 PageAlong 登录态。
- 已登录时提交 URL 同步任务。
- 未登录时跳转登录，登录后回到导入页继续。
- 移动端不提供网页内高亮朗读和 side panel。

这个边界避免依赖移动浏览器不支持或不稳定的扩展能力，同时让 Android 和 iPhone 都能完成核心的“同步成课程”任务。

## Recommended Architecture

采用“桌面 Chrome 扩展 + 移动 Web 轻入口”的组合。

### Extension modules

- `manifest.json`: Manifest V3 配置、权限、side panel 入口和资源声明。
- `background service worker`: 处理扩展图标点击、side panel 打开策略、tab 状态协调。
- `side panel app`: 插件主界面，包含朗读、同步和设置。
- `content script`: 页面正文抽取、DOM 句子定位、高亮、滚动和清理。
- `extractor`: 浏览器端正文候选提取器，输出原料而不是最终 Markdown。
- `tts controller`: 基于 `chrome.tts` 的句子级朗读队列和播放状态机。
- `pagealong client`: 调用 PageAlong API，检测登录态和提交同步任务。
- `settings store`: 管理用户偏好。

### Permissions

权限应按最小可用范围设计：

- `sidePanel`: 承载默认界面。
- `storage`: 保存偏好和临时状态。
- `tts`: 调用 Chrome 本地 TTS。
- `scripting` + `activeTab`: 用户主动点击扩展后注入当前页。
- PageAlong API 域名的 host permission: 允许同步 API 请求。

默认不申请 `<all_urls>` 的长期主机权限。当前页内容读取依赖用户主动点击后的 `activeTab` 临时权限。

## Desktop Extension UI

插件默认展示为 side panel。参考竞品的交互骨架，但视觉语言使用 PageAlong 自己的安静阅读器方向。

### Visual direction

- 背景：暖白纸色。
- 主文字：深墨色。
- 次级文字：低对比灰褐色。
- 主操作：PageAlong 绿色。
- 朗读高亮：默认琥珀色。
- 分隔：轻细线。
- 控件：扁平、稳定尺寸、小圆角，不使用大面积深色面板或蓝紫渐变。

### Sections

侧边栏分为 3 个页签：

- `朗读`: 当前页剪藏正文、正文分段、播放控制、当前句状态。
- `同步`: 同步至 PageAlong 平台、登录态、异步任务状态、同步完成后的课程入口。
- `设置`: 高亮颜色、默认 side panel 展示、自动滚动。

### Reader panel

- 顶部显示页面标题和来源域名。
- 正文以连续分段展示，避免像管理后台表格。
- 当前朗读句在侧边栏中同步高亮。
- 点击侧边栏句子可跳转朗读位置。
- 当前页不可抽取时展示原因和替代操作。

### Player dock

底部固定播放器包含：

- 播放/暂停。
- 停止。
- 上一句/下一句。
- 倍速选择：`0.75x`, `1x`, `1.25x`, `1.5x`, `2x`。
- 当前句摘要。
- `同步至 PageAlong平台` 主按钮。

Chrome TTS 本身提供朗读播放能力，但不提供可持久化的课程音频文件。插件本地朗读不写入平台音频资产；平台音频仍由 PageAlong 后端的异步 TTS 流程生成。

### Promotion copy

插件内文案保持克制，不做营销页。

建议文案：

- “同步后可在 PageAlong 继续听、按句回放、整理系列、跨设备续播。”
- “保存正文和图片，不用保持当前网页打开。”
- “适合把零散网页整理成碎片课程。”

## Highlighting Design

高亮是插件的核心体验。

### Mapping

- content script 从可读正文中切句。
- 每个句子保存 DOM Range 信息、文本摘要和顺序 index。
- side panel 和网页内容共享同一个句子 index。
- 如果 DOM 在播放中发生变化，优先保持 side panel 高亮，网页高亮降级为最近可匹配文本。

### Rendering

- 网页内高亮使用扩展前缀 class，例如 `pa-ext-current-sentence`。
- 高亮样式由 CSS 变量驱动，颜色来自设置。
- 停止播放、切换页面或关闭 panel 时清理注入的高亮节点。
- 不修改页面业务数据，不持久化网页 DOM 改动。

### Auto scroll

- 默认开启自动滚动当前句。
- 用户可在设置中关闭。
- 自动滚动只在当前句离开视口时触发，避免频繁抢滚动。

## TTS Playback Model

TTS 控制器以句子为单位管理队列：

1. 对正文进行句子切分。
2. 调用 `chrome.tts.speak(sentenceText, { enqueue, rate })`。
3. 每个句子开始时更新 active index。
4. active index 变化后通知 content script 和 side panel。
5. 暂停、继续、停止映射到 `chrome.tts.pause`、`chrome.tts.resume`、`chrome.tts.stop`。

这样可以稳定实现句子级高亮，不依赖不同 TTS voice 对 word event 的支持差异。

## PageAlong Login Bridge

现有 Web 登录可继续返回 bearer token，并保存到 Web 前端的 `localStorage`。为了让扩展复用登录态，API 额外设置 HttpOnly session cookie。

### Auth behavior

- 登录、注册成功后设置 session cookie。
- `/auth/me` 同时支持 bearer token 和 session cookie。
- 受保护课程 API 同时支持 bearer token 和 session cookie。
- 生产环境 cookie 使用 `Secure`、`HttpOnly`、合适的 `SameSite` 策略。
- 开发环境继续允许 `AUTH_DEV_BYPASS` 和 `X-User-Id`，但扩展同步优先走真实会话。

### Extension login check

插件同步前请求 `/auth/me`：

- 200: 认为用户已登录，允许同步。
- 401: 提示“未登录 PageAlong，即将打开登录页”，然后打开 PageAlong 登录页。
- 登录完成后，用户回到插件重新点击同步。

## Extension Sync API

新增插件同步导入入口：

`POST /courses/import-url/extension-sync`

### Request

字段建议：

- `url`: 当前页面 URL。
- `title`: 当前页面标题。
- `article_html`: 插件抽取出的正文 HTML 片段。
- `text_excerpt`: 插件抽取出的正文纯文本摘要，用于质量检查和兜底。
- `images`: 图片候选列表，只包含 URL、alt、尺寸和附近文本。
- `series_id`: 可选。
- `series_title`: 可选。
- `tags`: 可选。
- `is_starred`: 可选，默认 false。
- `client_metadata`: 扩展版本、抽取器版本、页面语言、抽取评分。

插件不提交最终 `content_markdown`，也不提交浏览器 cookie 或页面认证头。

### Response

创建成功后返回课程摘要：

- `course_id`
- `status=extracting_text`
- `import_job_id`
- `sync_mode=extension_sync`

前端可以继续轮询 `GET /courses/{course_id}` 查看 `extracting_text`、`audio_generating`、`ready` 或 `failed`。

## Backend Sync Flow

插件同步使用新的 URL import job 模式，而不是控制台 URL 导入的人工确认模式。

1. API 校验登录态。
2. 创建 `source_type=url_import` 的课程，默认作为碎片课程。
3. 创建 `GenerationJob(job_type=URL_IMPORT)`。
4. `input_json` 标记 `mode=extension_sync`、`auto_generate_audio=true`，并保存插件提供的页面原料。
5. 入队异步执行 URL import worker。
6. Worker 优先使用插件原料走统一清洗和 Markdown 归一化。
7. 如果插件原料质量不足，回退到现有后端 URL 抓取流程。
8. 后端下载、校验、压缩、上传图片，并改写 Markdown 图片地址。
9. 派生 TTS 文本并写入 `ArticleText`。
10. `confirmed_by_user=true`。
11. 直接请求音频生成，课程进入 `audio_generating`。
12. 音频生成完成后课程进入 `ready`。

如果正文已经成功保存但音频生成受额度或长度限制阻止，课程不应丢失。课程保留为 `text_ready`，插件提示“已保存到 PageAlong，但音频生成未开始”，并给出打开平台处理的入口。

## Difference From Console URL Import

控制台 URL 导入：

- 用户粘贴 URL。
- 后端抓取网页。
- 抽取后进入 `needs_review`。
- 用户确认后才生成音频。

插件同步导入：

- 用户在当前网页主动点击同步。
- 插件提供浏览器端抽取原料。
- 后端统一归一化。
- 抽取和 TTS 串联异步执行。
- 不进入 `needs_review`。

两条流程共享内容归一化、图片导入、课程模型和音频生成入口，避免平台展示格式分裂。

## Mobile Web Entry

新增移动端导入入口：

- `/{locale}/extension/import`

页面能力：

- 支持从 query 参数读取 `url` 和 `title`。
- 支持用户手动粘贴 URL。
- 检测 PageAlong 登录态。
- 已登录时提交同步任务。
- 未登录时跳转登录，并带回 `next`。
- 同步成功后显示“去 PageAlong 查看课程”。

移动端入口复用后端同步 API，但不提交 `article_html` 时，后端直接走现有 URL 抓取流程。

## Settings Model

插件设置：

- `highlightColor`: 默认 `amber`。
- `sidebarEnabled`: 默认 true。
- `autoScroll`: 默认 true。
- `playbackRate`: 默认 `1`。

存储策略：

- 用户偏好使用 `chrome.storage.sync`。
- 当前 tab 的抽取内容、朗读状态和同步状态使用 `chrome.storage.session`。
- content script 的 DOM 映射只保留在当前页面运行时内存中。

## Error Handling

错误状态必须给明确原因和主操作。

### Not logged in

文案：

“未登录 PageAlong，即将打开登录页。”

主操作：

- `打开登录页`

### Unsupported page

触发场景：

- `chrome://` 页面。
- Chrome Web Store。
- 扩展自身页面。
- 受限制 PDF viewer。
- 页面不允许注入脚本。

主操作：

- `复制链接到 PageAlong`
- `手动粘贴正文`

### Extraction failed

触发场景：

- 正文过短。
- 页面主要依赖动态渲染且无法识别正文。
- 当前页面需要登录或付费墙，插件无法得到稳定正文。

主操作：

- `重新剪藏`
- `同步 URL 让 PageAlong 尝试抓取`

### TTS playback failed

触发场景：

- Chrome 没有可用 voice。
- `chrome.tts` 返回错误。
- 文本为空。

主操作：

- `重新朗读`
- `打开系统语音设置`

### Sync failed

触发场景：

- API 网络错误。
- 登录态过期。
- 后端同步任务失败。
- 音频生成额度或长度限制。

主操作：

- `重试同步`
- `打开 PageAlong 查看详情`

## Privacy And Security

- 插件只在用户主动点击后读取当前 tab。
- 不长期申请所有网站读取权限。
- 插件不传递用户在目标网站上的 cookie、认证头或浏览器会话。
- 同步 API 只接收当前页面的内容原料和公开资源 URL。
- 后端下载图片时继续执行现有 URL 安全校验，避免 SSRF。
- 插件提交的 HTML 仍视为不可信输入，服务端必须清洗后再生成 Markdown。
- raw HTML 不直接渲染到 PageAlong 客户端。

## Data Compatibility

插件同步后的课程仍使用现有核心模型：

- `Course.source_type=url_import`
- `ArticleText.text`: TTS 文本。
- `ArticleText.content_markdown`: 统一 Markdown 阅读内容。
- `ArticleText.source_metadata_json`: URL、来源域名、插件版本等来源信息。
- `ArticleText.extraction_metadata_json`: 抽取器、质量评分、图片导入统计、fallback 信息。
- `ArticleImageAsset`: 导入图片。
- `GenerationJob`: URL import 和 TTS generate 任务。

这保证插件同步课程在 Web 端课程库、阅读器、导出和后续管理流程中表现一致。

## Testing Strategy

### API tests

- session cookie 可以通过 `/auth/me` 识别用户。
- bearer token 登录路径不回归。
- `POST /courses/import-url/extension-sync` 创建 URL import job。
- 插件原料质量足够时不调用后端 fetch。
- 插件原料质量不足时回退到后端 URL import。
- 插件同步成功后 `confirmed_by_user=true`，并请求音频生成。
- TTS 限制触发时正文仍保存，课程保持可查看。

### Worker tests

- `mode=extension_sync` job 使用插件原料。
- fallback URL 抓取失败时返回清晰错误。
- 图片导入失败不阻塞正文保存。
- 导入成功后正确串联音频生成。

### Extension tests

- 当前页可抽取时显示正文分段。
- 播放时 side panel 和网页当前句同步高亮。
- 倍速、暂停、继续、停止状态稳定。
- 设置写入和读取正常。
- 未登录时显示提示并打开登录页。
- 受限页面显示替代操作。

### Web tests

- 移动导入入口在未登录时跳登录。
- 登录后可提交 URL 同步。
- 同步成功后可跳转课程详情。

## Open Implementation Notes

- 新增扩展项目目录建议放在 `apps/extension/`，使用 npm，不切换包管理器。
- 扩展 UI 可以复用 PageAlong 色彩 token，但不直接依赖 Next.js 应用运行时。
- 后端应尽量复用 `UrlImportService`、`content_normalization`、`article_image_import` 和 `request_audio_generation`，只为插件同步增加必要参数和 job 模式。
- 实现时需要确认生产 API 域名、Chrome extension ID 和 CORS/credentials 配置。
