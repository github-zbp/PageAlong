# 页相随 PageAlong Android 分享收藏导入设计

日期：2026-08-31

这是 2026-08-27 安卓应用总设计中的 Spec 8。
Spec 6 继续负责 App 内主动发起的 URL / 文本 / 文件导入；本 spec 只负责 Android 系统分享接收和导入直达。

## 1. 目标

把“分享到页相随”做成 Android 端的一级入口。

用户从其他 App 分享一个网页到 PageAlong 后，应用应当：

- 立刻进入一个独立的分享处理中转页。
- 自动复用现有 URL 导入流程。
- 在正文解析完成后自动跳到对应课程阅读页。
- 音频继续后台异步生成，不阻塞阅读。

这个功能只做 Android。iOS 先不做分享扩展。

## 2. 范围

### 支持

- 接收 Android 系统分享。
- 接收网页 URL 分享。
- 接收 `text/plain` 和 `text/uri-list` 类型的分享。
- 处理单条分享和多条分享中的第一个有效 URL。
- 使用分享页作为独立中转页，不进入任务中心。

### 不支持

- iOS 分享扩展。
- 图片、文件、截图、PDF、笔记正文的分享直导入。
- 只包含普通文本、但不包含网页 URL 的分享。
- 新的课程来源类型、任务类型或导入队列类型。
- 先展示内容再导入的“预览收藏”模式。

## 3. 用户流程

1. 用户在别的 App 里点“分享”。
2. Android 把分享意图交给 PageAlong。
3. PageAlong 打开独立的分享处理中转页。
4. 页面先做 URL 校验和归一化。
5. 如果当前未登录，页面保留分享内容，先引导登录。
6. 登录成功后自动继续导入。
7. 后端开始 URL 导入并自动请求音频生成。
8. 页面轮询课程详情，直到正文内容已经落库。
9. 页面自动跳转到该课程的阅读页。

跳转条件只看正文是否已经解析完成，不等音频完成。

## 4. 运行时结构

### 4.1 Android 入口

通过 Expo 的 incoming share 能力接收系统分享，而不是写一套自定义原生页面壳。

本 spec 假定：

- `app.config.ts` 启用 Android incoming share。
- `text/plain` 和 `text/uri-list` 作为首批支持的 MIME 类型。
- 分享内容由 `useIncomingShare()` 读出。
- `app/+native-intent.ts` 把 `expo-sharing` 入口重定向到 `/share/receive`。

### 4.2 分享处理中转页

新增一个不属于底部 Tab 的独立路由页：

- `/share/receive`

这个页面只负责：

- 读分享内容。
- 规范化 URL。
- 触发导入。
- 轮询正文解析状态。
- 跳转阅读页。

它不承担搜索、课程库、任务中心或导入页的职责。

### 4.3 客户端 helper

新增一个很小的分享 helper 模块，用来做三件事：

- 从分享 payload 里提取第一个可用网页 URL。
- 复用现有 URL 归一化规则。
- 在需要跨登录时把临时 pending share 记录存到 `AsyncStorage`。

## 5. 数据流

### 5.1 解析分享内容

页面优先使用 resolved share payload。

提取规则：

1. 先看 resolved payload 里的网页 URL。
2. 再看 raw payload 中的文本。
3. 从文本里找第一个可归一化为 `http` / `https` 的 URL。
4. 只接受网页 URL，拒绝其他 scheme。

URL 归一化规则和现有 URL 导入页保持一致：

- trim。
- 缺 scheme 时补 `https://`。
- 拒绝非 `http(s)`。

### 5.2 发起导入

页面调用现有 URL 导入接口，只是额外传一个开关：

- `auto_generate_audio: true`

这样后端在正文解析完成后会自动请求音频生成。

导入请求不需要新接口。它仍然复用：

- `POST /courses/import-url`

### 5.3 等待正文解析

导入请求返回后，页面拿到 `course_id`，然后轮询课程详情。

跳转阅读页的条件：

- `content_markdown` 已经存在，或
- `sentences` 已经生成，或
- 课程状态已经不再是 `extracting_text`

只要正文已经可读，就跳转。

音频是否已经生成，不影响跳转。

### 5.4 清理分享状态

当导入请求已经返回 `course_id`，并且页面开始用这个 `course_id` 轮询时，清理 native share payload。

这样可以避免同一份系统分享被重复消费。

如果导入还没真正发出去，payload 不能提前清掉。

## 6. 登录态

分享是系统入口，所以不能假设用户一定已经登录。

如果页面在接收分享时发现当前是未登录状态：

- 保留已经解析出来的分享内容。
- 把这份 pending share 记录暂存到 `AsyncStorage`。
- 跳转到现有登录流程。
- 登录成功后优先恢复 pending share，再执行导入。

现有登录页默认登录后回工作台，这条规则需要改成“如果存在 pending share，先回分享处理页；否则回工作台”。

## 7. 后端改动

### 7.1 URL 导入请求

给 `CourseUrlImportCreate` 增加一个可选字段：

- `auto_generate_audio: bool = false`

`create_url_import_course` 需要把这个字段写进 job input JSON。

### 7.2 Worker 行为

URL 导入 worker 里已经有“正文解析后请求音频”的流程，只要 job input 里带上 `auto_generate_audio` 就能跑起来。

这个功能不需要新的 worker task。

### 7.3 数据语义

分享导入仍然是 `source_type=url_import`。

不新增 `android_share` 这类新来源，先保持和普通 URL 导入同一语义。

## 8. 错误处理

- 非网页分享：页面提示不支持，只允许网页链接。
- URL 不合法：页面提示错误并保留原始分享内容。
- 401 未登录：保留 pending share，走登录，再续跑。
- 导入请求失败：停留在分享页，允许重试。
- 正文解析超时：页面继续显示处理中状态，允许重试或返回。
- 音频队列失败：不拦阅读。正文一旦可读，仍然跳阅读页，音频失败按现有课程/任务行为处理。

## 9. 测试

### 前端

- 分享 payload URL 提取单测。
- `+native-intent.ts` 路由重定向单测。
- 分享页状态流单测：
  - 已登录成功导入。
  - 未登录时保留 pending share。
  - 无有效 URL 时显示错误。
  - 正文解析完成后自动跳转课程页。

### 后端

- `POST /courses/import-url` 接收 `auto_generate_audio`。
- job input JSON 正确保留该字段。
- 旧的普通 URL 导入默认不自动生成音频。

### 手工验证

- 在 Android debug 包里，从 Chrome 分享一个网页到 PageAlong。
- 确认先进入分享处理中转页。
- 确认正文解析完成后自动进入课程阅读页。
- 确认音频随后继续后台生成。
