# DailyTask 阿里云函数后端

Node.js 20 事件函数，通过 HTTP 触发器提供 GitHub / Google OAuth 登录和用户数据同步。任务数据写入私有 OSS，不需要邮件服务。

## 环境变量

| 名称 | 示例 |
|---|---|
| `OSS_REGION` | `oss-cn-hangzhou` |
| `OSS_BUCKET` | `dailytask-data` |
| `ALLOWED_ORIGIN` | `https://luffyzhang2016.github.io` |
| `FRONTEND_URL` | `https://luffyzhang2016.github.io/DailyTask` |
| `API_PUBLIC_URL` | 函数 HTTP 触发器的公网地址，不带末尾斜杠 |
| `SESSION_SECRET` | 至少 32 字节随机字符串 |
| `GITHUB_CLIENT_ID` | GitHub OAuth App 的 Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App 的 Client Secret |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Web Client Secret |

不要把 Client Secret 或 SESSION_SECRET 写进代码或提交到 GitHub。函数必须绑定具有指定 Bucket 前缀读写权限的 RAM 执行角色。

## OAuth 回调地址

- GitHub OAuth App：`${FRONTEND_URL}/`
- Google OAuth Web Client：`${FRONTEND_URL}/`

回调地址必须与控制台填写内容完全一致。Google OAuth 同意屏幕处于测试状态时，需要把实际登录邮箱加入测试用户。

## 打包

在本目录执行 `npm install --omit=dev`，将 `index.js`、`package.json`、`package-lock.json` 和 `node_modules` 一起压缩为 ZIP，然后上传函数计算。处理函数填写 `index.handler`。
