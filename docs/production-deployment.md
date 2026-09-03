# 部署与安装

PageAlong 现在提供两条官方部署入口：

- `make bootstrap-prod`：宿主机安装与启动，自动补齐缺失的系统依赖，必要时回退到 Docker 本地服务。
- `make compose-prod`：只容器化 API、worker、Web，数据库和 Redis 继续使用外部服务。

## `.env` 是否必须先准备

不必须。两个入口都会在根目录缺少 `.env` 时先从 `.env.example` 复制一份。`make compose-prod` 会在执行过程中检查最小运行配置；如果数据库、Redis 或存储配置仍为空或还是 `.env.example` 默认值，它会提示输入示例值并自动写回 `.env`，然后继续部署。

不过，首次公开部署前仍然要检查这些值是否符合你的环境：

- 数据库和 Redis 连接串
- 对象存储 / MinIO / R2 配置
- 认证、内部签名和邮箱相关密钥
- 如果端口冲突，`API_HOST_PORT` 和 `WEB_HOST_PORT`

## 宿主机方式

适合想继续用 tmux / 本机进程管理的服务器。

```bash
git clone <repo>
cd web_reader
make bootstrap-prod
```

这条路径会做这些事：

1. 检测 `git`、`make`、`curl`、`tmux`、`ffmpeg`、`docker`、`node`、`npm` 和 Python 3.12。
2. 在 Debian / Ubuntu 上用 `apt-get` 自动安装缺失依赖；在 macOS 上用 Homebrew 自动安装可装的缺失依赖。
3. 生成 `.env`（如果还没有）。
4. 当数据库、Redis 或对象存储仍指向本地服务时，调用 `make up` 补齐本地依赖。
5. 安装项目依赖、初始化数据库、构建 Web、重启应用进程。

## 容器方式

适合不想在宿主机装 Python / Node 的服务器。

```bash
git clone <repo>
cd web_reader
make compose-prod
```

这条路径会：

1. 生成 `.env`（如果缺失）。
2. 检查 `DATABASE_URL`、`REDIS_URL` 和媒体存储配置；缺失或仍是默认值时，按提示输入并自动写回 `.env`。
3. 生成 `storage/deploy/compose-prod.env`。
4. 构建 API / worker 共享镜像和 Web 镜像。
5. 启动 API、worker、Web 三个容器。
6. 在 API 容器内执行一次数据库初始化，并提示输入第一位管理员账号；如果该账号已存在，会更新密码。

如果 `.env` 里还是示例默认的 `localhost` 地址，脚本会把数据库、Redis 和对象存储端点重写到 `host.docker.internal`，让容器连接宿主机上已经跑起来的服务。

容器模式里：

- Web 对外监听 `WEB_HOST_PORT`，默认 `3000`。
- API 对外监听 `API_HOST_PORT`，默认 `8000`。
- Web 内部通过 `/api` 访问 API，compose 里已经配好了代理。

## 升级

重复执行同一个入口即可：

- 宿主机方案：重新跑 `make bootstrap-prod`
- 容器方案：重新跑 `make compose-prod`

## 相关文档

- [环境变量说明](environment-variables.md)
- [宝塔 / 手工部署附录](baota-deployment.md)
