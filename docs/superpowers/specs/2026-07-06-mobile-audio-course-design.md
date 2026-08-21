# 手机端有声课程产品设计

日期：2026-07-06

## 1. 产品定位

本项目不是单纯的“网页有声阅读 Chrome 插件”，而是一个面向手机学习者的网页/文档转有声课程工具。

用户可以把图文网页课程、长文章、PDF、Word、TXT、Markdown 导入系统。系统负责提取正文、必要时执行 OCR、生成音频、保存句子级时间轴，并让用户在通勤、走路、地铁等无法看屏幕的场景中继续学习。

Chrome 插件不是唯一主阵地，而是高质量网页采集入口。H5/Web 是第一阶段的手机端听课和管理入口。后端课程库是核心能力，未来微信小程序和 App 都复用这套课程、音频、文件和播放进度数据。

## 2. 竞品启发

调研对象大致分为四类：

- Chrome 朗读扩展：Read Aloud、Speechify、NaturalReader。
- 辅助阅读工具：Read&Write、Helperbird、Snap&Read。
- 浏览器内置朗读：Edge Read Aloud、Chrome Listen/Read Aloud、Firefox Reader View Narrate、Safari Listen to Page。
- TTS 平台：OpenAI、Azure Speech、Google Cloud Text-to-Speech、Amazon Polly、阿里云/腾讯云/讯飞等国内语音服务。

主要结论：

- 纯“网页朗读”已经拥挤，浏览器内置功能也会不断压低基础朗读价值。
- 更有价值的方向是把网页和文档变成可保存、可续播、可管理的个人有声课程。
- 句子级高亮和点击跳转不能完全依赖 TTS 服务商的 speech marks，最好由系统按句生成、拼接音频并记录时间轴。
- 国内手机用户更常在微信、手机浏览器、H5 中消费内容，不能只依赖 Chrome 插件。
- 低成本路线需要自建开源 TTS；付费用户可以选择云端高质量 TTS。

## 3. 目标用户和核心场景

### 目标用户

- 想在通勤、走路、地铁中学习课程内容的手机用户。
- 收藏了大量文章、课程笔记、PDF、Word 文档，希望转成音频学习的用户。
- 听完后仍需要回看原文、复听句子、按句定位的学习型用户。

### 核心场景

- 用户在微信或手机浏览器里看到一篇长课程文章，复制链接到 H5 导入，稍后在路上听。
- 用户在 Web 后台上传 PDF 或 Word 讲义，系统生成音频课程。
- 用户在桌面打开网页课程，用 Chrome 插件更准确地采集正文，然后在手机 H5 里听。
- 用户打开课程时自动续播到上次位置，并可以点击某个句子回听。

## 4. MVP 范围

MVP 包含 H5/Web、Chrome 插件、后端 API、异步任务系统、对象存储和可插拔 TTS Provider。

### MVP 内

- 用户账号和个人课程库。
- H5/Web 课程列表、课程详情、原文预览、音频播放、删除。
- 图文网页课程和长文章 URL 导入。
- Word、PDF、TXT、Markdown 文件上传。
- PDF OCR 从第一版开始支持。
- PDF/OCR 结果先进入确认和编辑流程。
- TXT、Markdown、Word 等可信文本格式默认自动生成音频。
- Chrome 插件识别当前网页正文并保存到课程库。
- 服务端句子切分。
- 按句子或短段生成音频。
- MP3 拼接和句子级时间轴生成。
- 播放进度同步。
- 默认使用自建开源 TTS。
- 付费用户可选择云端高质量 TTS。
- 记录 TTS 字数、OCR 页数、存储空间等基础额度。

### MVP 外

- 原生 App。
- 微信小程序。
- 视频字幕导入。
- AI 摘要、测验、知识卡片。
- 团队或机构账号。
- 完整离线下载。
- 公开分享生成后的音频。
- 在任意第三方手机网页里直接做原页高亮。
- Chrome 插件内完整播放和原网页句子级高亮控制。

## 5. 产品端形态

### H5/Web

H5/Web 是第一阶段的手机听课和课程管理中心。

核心功能：

- 登录和账号绑定。
- 课程库。
- URL 导入。
- 文件上传。
- 导入和生成状态展示。
- OCR 草稿预览和编辑。
- 音频播放器。
- 原文查看和当前句子高亮。
- 点击句子跳转音频位置。
- 播放进度保存。
- 删除课程及关联音频。
- 失败任务重试。
- 根据用户套餐选择 TTS Provider。

### Chrome 插件

Chrome 插件是桌面网页课程的高质量采集入口。

核心功能：

- 识别当前网页可阅读区域。
- 提取标题、URL、正文、段落和句子。
- 保存到用户课程库。
- 展示导入和生成状态。
- 打开 H5/Web 播放页面。

MVP 不要求在 Chrome 插件里完成复杂音频播放和原网页完整高亮。第一阶段先证明导入、生成、手机听课闭环成立。

### 后端 API

后端 API 负责用户、课程、来源、文件、正文版本、句子、音频资产、生成任务、播放进度和套餐额度。

### 异步任务系统

长耗时任务全部异步执行：

- URL 抓取。
- 正文提取。
- 文档解析。
- OCR。
- 文本清洗。
- 句子切分。
- TTS 生成。
- MP3 拼接。
- 音频上传。
- 失败重试。

### 存储

结构化数据放关系型数据库。原始文件、OCR 中间产物、分句 WAV、最终 MP3 放对象存储。

## 6. 核心数据模型

### User

用户账号、套餐、额度、默认 TTS Provider、默认声音、默认语速和偏好设置。

### Course

用户最终看到的课程对象。

关键字段：

- `id`
- `user_id`
- `title`
- `source_type`
- `status`
- `word_count`
- `duration_seconds`
- `current_audio_asset_id`
- `last_playback_position_seconds`
- `created_at`
- `updated_at`

状态：

- `importing`
- `extracting_text`
- `ocr_processing`
- `needs_review`
- `text_ready`
- `audio_generating`
- `ready`
- `failed`
- `deleted`

### ContentSource

记录内容来源。

来源类型：

- `chrome_extension`
- `url_import`
- `file_upload`
- `manual_text`
- `future_mini_program`
- `future_app_share`

关键字段：

- `course_id`
- `source_type`
- `source_url`
- `captured_html_path`
- `metadata`

### DocumentFile

记录上传文件。

关键字段：

- `course_id`
- `original_filename`
- `file_type`
- `file_size`
- `object_path`
- `page_count`
- `is_scanned_pdf`
- `ocr_status`
- `parse_status`

### ArticleText

记录清洗后的正文版本。OCR 结果可能被人工编辑，所以正文需要版本管理。

关键字段：

- `course_id`
- `version`
- `text`
- `source_quality`
- `confirmed_by_user`
- `created_at`

### Sentence

记录句子文本和音频时间轴。

关键字段：

- `course_id`
- `article_text_id`
- `index`
- `paragraph_index`
- `text`
- `audio_start_seconds`
- `audio_end_seconds`
- `generation_status`

### AudioAsset

记录音频版本。

关键字段：

- `course_id`
- `article_text_id`
- `provider`
- `voice_id`
- `speed`
- `format`
- `object_path`
- `duration_seconds`
- `character_count`
- `is_current`
- `created_at`

### GenerationJob

记录异步任务。

任务类型：

- `url_fetch`
- `text_extract`
- `document_parse`
- `ocr`
- `sentence_segment`
- `tts_generate`
- `audio_concat`

关键字段：

- `course_id`
- `job_type`
- `status`
- `attempt_count`
- `error_code`
- `error_message`
- `started_at`
- `finished_at`

### PlaybackProgress

记录用户播放进度。

关键字段：

- `user_id`
- `course_id`
- `audio_asset_id`
- `position_seconds`
- `sentence_index`
- `updated_at`

### PlanUsage

记录套餐和成本控制。

关键字段：

- `user_id`
- `period`
- `local_tts_characters`
- `cloud_tts_characters`
- `ocr_pages`
- `storage_bytes`

## 7. TTS 策略

系统使用可插拔 TTS Provider 抽象。

### 默认 TTS

普通用户默认使用自建开源 TTS，以控制成本。

初始候选：

- MeloTTS
- Kokoro

这两个方案适合先验证需求和控制外部 API 成本。

### 付费 TTS

付费用户可以选择云端高质量 TTS。

候选 Provider：

- OpenAI
- Azure Speech
- Google Cloud Text-to-Speech
- Alibaba Cloud TTS

云端 TTS 消耗付费额度。用户更换 Provider、声音或语速重新生成音频时，需要重新消耗额度。

### 时间轴策略

MVP 不依赖 TTS 服务商是否提供 speech marks。

后端流程：

1. 把正文切成句子或短段。
2. 为每个句子或短段生成音频。
3. 测量每段音频时长。
4. 拼接 WAV 片段。
5. 编码最终 MP3。
6. 保存 `sentence_id -> start_time/end_time`。

这样本地 TTS 和云端 TTS 都能共用同一套句子高亮和点击跳转机制。

## 8. 核心流程

### Chrome 插件导入

1. 用户打开桌面网页课程。
2. 用户点击插件按钮。
3. 插件提取可读标题、正文、段落和 URL。
4. 插件提交内容到后端。
5. 后端创建课程和正文版本。
6. 后端启动 TTS 生成任务。
7. 用户在 H5/Web 中打开播放页。

### H5 URL 导入

1. 用户从手机浏览器或微信复制课程 URL。
2. 用户把 URL 粘贴到 H5。
3. 后端抓取网页。
4. 后端提取可读正文。
5. 如果正文质量可接受，课程进入音频生成。
6. 如果正文提取失败，提示用户手动粘贴正文，或稍后使用 Chrome 插件导入。

### 文件上传

1. 用户上传 Word、PDF、TXT 或 Markdown。
2. 后端保存原始文件。
3. 后端判断文件类型。
4. TXT、Markdown、Word 解析成文本。
5. PDF 判断是否包含可提取文本。
6. 扫描版 PDF 进入 OCR。
7. PDF/OCR 结果进入草稿确认。
8. 用户确认或编辑文本。
9. 后端切分句子并生成音频。

### 音频生成

1. 后端根据用户套餐和课程设置选择 TTS Provider。
2. 后端按句子或短段生成音频。
3. 失败片段单独重试。
4. 音频片段拼接成 MP3。
5. 保存句子时间轴。
6. 课程状态变为 `ready`。

### 手机播放

1. 用户在 H5 打开课程。
2. 播放器加载 MP3 和句子时间轴。
3. 播放器恢复上次播放位置。
4. 播放时高亮当前句子。
5. 用户点击句子后跳转到对应音频位置。
6. 播放进度定期同步到后端。

### 课程删除

1. 用户删除课程。
2. 后端把课程标记为删除。
3. 后端删除或调度删除关联文件、音频、OCR 产物和分句音频片段。
4. 后端仅保留必要的账单和额度流水。

## 9. 失败处理

### URL 正文提取失败

兜底方式：

- 让用户手动粘贴正文。
- 提示用户在桌面端使用 Chrome 插件采集。
- 保存失败 URL，后续可重试。

### OCR 质量低

兜底方式：

- 展示低置信度提示。
- 强制用户确认后再生成 TTS。
- 允许用户编辑提取文本。
- 允许重新 OCR。

### TTS 生成失败

兜底方式：

- 重试失败句子或片段。
- 重试整篇音频生成。
- 如果用户套餐允许，切换 Provider。
- 即使音频失败，也保留正文内容。

### 文本过长

兜底方式：

- 自动拆分章节。
- 分批生成音频。
- 展示预计生成时间和额度消耗。

### 云端 TTS 额度不足

兜底方式：

- 切换成本地 TTS。
- 引导用户升级或购买加量包。
- 本地音频和云端音频作为不同版本保存。

## 10. 合规和产品约束

- 导入内容默认仅供用户个人学习使用。
- MVP 不支持公开分享生成音频。
- 批量导入必须限频。
- 付费站点、登录后页面、强反爬页面可能无法通过服务端抓取正文。
- 微信和手机浏览器里的第三方网页不能像 Chrome 插件一样被任意注入和控制。
- 手机 H5 音频播放必须假设由用户点击触发，不能依赖自动播放。

## 11. MVP 验收标准

- 用户可以通过 URL 导入普通图文网页，并生成可播放的有声课程。
- 用户可以通过 Chrome 插件导入桌面网页，并在 H5/Web 课程库中看到课程。
- 用户可以上传 PDF，必要时执行 OCR，确认文本后生成音频。
- 用户可以上传 Word、TXT、Markdown 并生成音频。
- 用户可以在手机 H5 听课，刷新页面后恢复上次进度。
- 播放器可以高亮当前句子，并支持点击句子跳转。
- 用户可以删除课程及关联音频。
- 免费/默认生成使用本地 TTS Provider。
- 付费用户可以选择云端 TTS Provider，并消耗云端 TTS 额度。

## 12. 后续路线

- 微信小程序。
- 原生 App。
- 视频字幕导入。
- AI 摘要和章节大纲。
- AI 测验和复习卡片。
- 离线下载。
- Chrome 插件内更完整的原网页播放控制。
- 机构和团队账号。
- 更多声音预设和声音市场。

