# 日程 · 每日任务

移动优先的静态 PWA，每日任务数据默认存储在浏览器 `localStorage`。项目可直接托管到 GitHub Pages。

## 本地预览

需要通过 HTTP 服务打开，Service Worker 才能工作：

```powershell
npx serve .
```

## 云端架构

生产环境建议：GitHub Pages（静态前端）→ 阿里云 API 网关/函数计算（邮箱验证码、鉴权、数据校验）→ OSS（按用户分区保存 JSON）或表格存储。不要把 OSS AccessKey 写入前端。

在 `app.js` 中用正式 API 客户端替换 `cloudAdapter` 即可接入。建议服务端使用 HttpOnly 会话 Cookie，并限制 CORS 为 GitHub Pages 域名。

