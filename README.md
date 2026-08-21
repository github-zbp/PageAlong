# 有声课程 Web Reader

面向手机学习场景的有声课程产品：把网页文章、课程内容和文档转成可听、可管理、可续播的音频课程。

## 本地运行

查看 [本地开发运行指南](docs/local-development.md)，里面包含安装依赖、启动服务、运行测试和常见问题命令。

当前基础版本先使用 fake TTS provider，用来验证课程创建、句子时间轴和 H5 播放流程。真实 TTS 引擎会在后续阶段接入。

## 已实现的基础能力

- FastAPI 健康检查接口。
- 课程文本导入 API。
- 课程列表和详情 API。
- 句子切分。
- fake TTS 服务，用于本地稳定测试时间轴流程。
- Celery 异步音频任务骨架。
- H5 课程列表。
- H5 课程详情和播放器骨架。
- 播放进度保存 API。
- 课程删除 API。

## 工具链说明

- 本地后端默认使用 `/opt/homebrew/bin/python3.13`，每个 Python 服务使用独立 `.venv`。
- 当前机器没有安装 `uv`，所以 Makefile 使用标准 `venv + pip`。
- H5 前端使用 npm。
- H5 前端使用 Next 13 和 React 18，以兼容当前 Node 16 环境。

## Chrome 扩展打包

先构建 `dist/`，再把 `dist/` 里的文件打成 zip：

```bash
cd apps/extension && npm run build
cd dist && zip -r ../pagealong-extension.zip .
```

如果只想走仓库里的封装命令，也可以用：

```bash
make build-extension
```

## 如何打包项目上传远程服务器
大的都是本地生成目录，已经被 .gitignore 忽略：

apps/web/node_modules   277M
apps/web/.next           42M
services/api/.venv      167M
services/worker/.venv    82M

所以不要直接压缩整个项目目录上传。

如果上传到 Git 远程

直接用 git：

git push -u origin feature/mvp-foundation

不会上传 node_modules、.venv、.next。

如果要打源码包上传

用这个命令，不要用 Finder/zip 压整个目录：

git archive --format=tar.gz -o /Users/jqsf/Downloads/web_reader-src.tar.gz HEAD

生成的包只包含 Git 跟踪的源码文件，不包含本地依赖。

解压时执行：
tar -xzf /www/web_reader-src.tar.gz -C /www/web_reader

如果想先瘦身本地目录

rm -rf apps/web/node_modules apps/web/.next
rm -rf services/api/.venv services/worker/.venv
rm -rf services/api/.pytest_cache services/worker/.pytest_cache
find . -name '__pycache__' -type d -prune -exec rm -rf {} +

之后需要运行项目时再执行：

make deps
