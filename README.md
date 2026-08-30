# 日程 · 每日任务

移动优先的 PWA。未登录时任务保存在浏览器 `localStorage`；配置阿里云函数计算后，可通过 GitHub 或 Google 登录，并将不同用户的数据隔离保存到私有 OSS Bucket。

重复任务支持每日、工作日、周末和指定日期区间。设置截止时间后，可开启截止前 60 分钟与 30 分钟两次提醒；应用会提供应用内提示，并在用户授权后发送系统通知。当前提醒调度由运行中的网页或已安装 PWA 执行，进程被系统彻底关闭后不保证后台准时触发；完整后台提醒需另行部署 Web Push 与服务端定时任务。

## 本地预览

需要通过 HTTP 服务打开，Service Worker 才能工作：

```powershell
npx serve .
```

## 云端架构

生产结构：GitHub Pages（静态前端）→ GitHub / Google OAuth → 阿里云函数计算 HTTP 触发器（鉴权、数据校验）→ 私有 OSS（按用户分区保存 JSON）。不要把 OSS AccessKey 或 OAuth Client Secret 写入前端。

后端代码及部署说明位于 `backend/`。部署成功后，把函数 HTTPS 地址填写到 `config.js` 的 `API_BASE`，再提交并推送即可启用云同步。后端使用短数据令牌作为 Bearer 凭证，并将 CORS 限制为 GitHub Pages 来源。
