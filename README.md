# 日程 · 每日任务

移动优先的 PWA。未登录时任务保存在浏览器 `localStorage`；配置阿里云函数计算后，可通过 GitHub 或 Google 登录，并将不同用户的数据隔离保存到私有 OSS Bucket。

## 本地预览

需要通过 HTTP 服务打开，Service Worker 才能工作：

```powershell
npx serve .
```

## 云端架构

生产结构：GitHub Pages（静态前端）→ GitHub / Google OAuth → 阿里云函数计算 HTTP 触发器（鉴权、数据校验）→ 私有 OSS（按用户分区保存 JSON）。不要把 OSS AccessKey 或 OAuth Client Secret 写入前端。

后端代码及部署说明位于 `backend/`。部署成功后，把函数 HTTPS 地址填写到 `config.js` 的 `API_BASE`，再提交并推送即可启用云同步。后端使用短数据令牌作为 Bearer 凭证，并将 CORS 限制为 GitHub Pages 来源。
