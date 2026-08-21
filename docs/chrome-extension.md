# Chrome 扩展本地开发

## 范围

桌面 Chrome 扩展支持当前页剪藏、本地 Chrome TTS 朗读、网页高亮、倍速控制和同步到 PageAlong。移动端继续使用 PageAlong Web 的 `/{locale}/extension/import` 入口提交 URL。

## 启动本地服务

API 使用 8070 端口：

```bash
API_PORT=8070 make api
```

Web 使用 3000 端口，并指向 8070 API：

```bash
API_BASE_URL=http://127.0.0.1:8070 NEXT_PUBLIC_API_BASE_URL=http://localhost:8070 make web
```

## 安装和构建扩展

```bash
cd apps/extension
npm install
npm run build
```

Chrome 打开 `chrome://extensions`，开启 Developer mode，加载 `apps/extension/dist` 作为 unpacked extension。

扩展默认指向线上服务 `https://web-reader.zbpblog.cn`，所以 Chrome 里看到的站点授权也会是这个域名。

提示：Chrome 默认会把扩展放在扩展菜单里，不会自动固定到顶部栏；需要手动 pin。点击扩展图标会打开 popup 小窗，popup 内展示当前页剪藏、朗读、同步和设置内容。MV3 的 service worker 也会在空闲后自动休眠，看到“无效/Inactive”不一定是坏掉了，先确认加载的是 `apps/extension/dist`。

## 验证路径

1. 打开一篇普通网页。
2. 点击页相随 PageAlong 扩展图标。
3. popup 小窗显示正文分段。
4. 点击播放，网页正文和 popup 当前句同步高亮。
5. 切换倍速后重新播放。
6. 登录 PageAlong Web。
7. 点击同步至 PageAlong。
8. 打开课程详情查看同步状态。

## 展开入口

popup 顶部提供“侧边栏”和“独立页”入口，可在需要更大阅读空间时展开当前源 tab。
