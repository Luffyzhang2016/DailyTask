const crypto = require("crypto");
const dns = require("dns");
const OSS = require("ali-oss");

dns.setDefaultResultOrder("ipv4first");

const required = ["OSS_REGION", "OSS_BUCKET", "SESSION_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "API_PUBLIC_URL", "FRONTEND_URL", "ALLOWED_ORIGIN"];

exports.handler = async (event, context, callback) => {
  try {
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) return callback(null, response(500, { error: `缺少环境变量：${missing.join(", ")}` }));

    const request = parseEvent(event);
    if (request.method === "OPTIONS") return callback(null, response(204, ""));

    const oss = createOssClient(context);
    let result;
    if (request.method === "GET" && request.path.endsWith("/auth/github/start")) result = githubStart();
    else if (request.method === "POST" && request.path.endsWith("/auth/github/exchange")) result = await githubExchange(request);
    else if (request.method === "GET" && request.path.endsWith("/auth/google/start")) result = googleStart();
    else if (request.method === "POST" && request.path.endsWith("/auth/google/exchange")) result = await googleExchange(request);
    else if (request.path.endsWith("/api/state") && request.method === "GET") result = await getState(request, oss);
    else if (request.path.endsWith("/api/state") && request.method === "PUT") result = await putState(request, oss);
    else result = response(404, { error: "接口不存在" });
    callback(null, result);
  } catch (error) {
    console.error(error);
    callback(null, response(500, { error: "服务器暂时无法处理请求，请稍后重试" }));
  }
};

function parseEvent(event) {
  const serialized = Buffer.isBuffer(event) || event instanceof Uint8Array ? Buffer.from(event).toString("utf8") : event;
  const value = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
  const method = value.requestContext?.http?.method || value.httpMethod || "GET";
  const path = value.requestContext?.http?.path || value.rawPath || value.path || "/";
  const headers = Object.fromEntries(Object.entries(value.headers || {}).map(([key, item]) => [key.toLowerCase(), item]));
  const query = value.queryParameters || value.queryStringParameters || Object.fromEntries(new URLSearchParams(value.rawQueryString || ""));
  let body = value.body || "";
  if (value.isBase64Encoded && body) body = Buffer.from(body, "base64").toString("utf8");
  if (typeof body === "string" && body) body = JSON.parse(body);
  return { method: method.toUpperCase(), path, headers, query, body: body || {} };
}

function createOssClient(context) {
  const credentials = context?.credentials || {};
  return new OSS({
    region: process.env.OSS_REGION,
    bucket: process.env.OSS_BUCKET,
    accessKeyId: credentials.accessKeyId || process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
    accessKeySecret: credentials.accessKeySecret || process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
    stsToken: credentials.securityToken || process.env.ALIBABA_CLOUD_SECURITY_TOKEN,
    secure: true,
  });
}

function createOAuthState(provider) {
  return signToken({ provider, nonce: crypto.randomBytes(16).toString("hex"), exp: Math.floor(Date.now() / 1000) + 600 });
}

function githubStart() {
  const state = createOAuthState("github");
  const params = new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID, redirect_uri: frontendCallbackUrl(), state });
  return response(200, { authorizationUrl: `https://github.com/login/oauth/authorize?${params}` });
}

async function githubExchange(request) {
  const state = verifySignedValue(request.body.state);
  if (!state || state.provider !== "github" || !request.body.code) return authFailure("invalid_request");
  const tokenResponse = await fetchWithRetry("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code: request.body.code, redirect_uri: frontendCallbackUrl() }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) return authFailure("github_denied");
  const userResponse = await fetchWithRetry("https://api.github.com/user", { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "DailyTask" } });
  const githubUser = await userResponse.json();
  if (!githubUser.id) return authFailure("user_lookup_failed");
  const user = { provider: "github", providerId: String(githubUser.id), login: githubUser.login, avatar: githubUser.avatar_url };
  return finishLogin(user);
}

function googleStart() {
  const state = createOAuthState("google");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: frontendCallbackUrl(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return response(200, { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
}

async function googleExchange(request) {
  const state = verifySignedValue(request.body.state);
  if (!state || state.provider !== "google" || !request.body.code) return authFailure("invalid_request");
  const tokenResponse = await fetchWithRetry("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code: request.body.code,
      grant_type: "authorization_code",
      redirect_uri: frontendCallbackUrl(),
    }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) return authFailure("google_denied");
  const userResponse = await fetchWithRetry("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const googleUser = await userResponse.json();
  if (!googleUser.sub || !googleUser.email) return authFailure("user_lookup_failed");
  const user = { provider: "google", providerId: String(googleUser.sub), login: googleUser.name || googleUser.email, email: googleUser.email, avatar: googleUser.picture || "" };
  return finishLogin(user);
}

function finishLogin(user) {
  const token = signToken({ sub: digest(`${user.provider}:${user.providerId}`), ...user, exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600 });
  return response(200, { token, user });
}

function authFailure(code) { return response(400, { error: code }); }
function frontendCallbackUrl() { return `${process.env.FRONTEND_URL.replace(/\/$/, "")}/`; }

async function getState(request, oss) {
  const user = authorize(request);
  if (!user) return response(401, { error: "登录已失效，请重新登录" });
  const data = await readJson(oss, `daytask/users/${user.sub}/state.json`);
  return response(200, { state: data || null, user: { provider: user.provider, login: user.login, email: user.email, avatar: user.avatar } });
}

async function putState(request, oss) {
  const user = authorize(request);
  if (!user) return response(401, { error: "登录已失效，请重新登录" });
  const state = request.body.state;
  if (!state || !Array.isArray(state.tasks) || typeof state.completions !== "object") return response(400, { error: "任务数据格式不正确" });
  const payload = { ...state, updatedAt: new Date().toISOString() };
  await writeJson(oss, `daytask/users/${user.sub}/state.json`, payload);
  return response(200, { ok: true, updatedAt: payload.updatedAt });
}

function authorize(request) {
  const value = request.headers.authorization || "";
  if (!value.startsWith("Bearer ")) return null;
  const token = value.slice(7);
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, hmac(payload, process.env.SESSION_SECRET))) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return user.exp > Math.floor(Date.now() / 1000) ? user : null;
  } catch { return null; }
}

function verifySignedValue(token) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, hmac(payload, process.env.SESSION_SECRET))) return null;
  try { const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); return value.exp > Math.floor(Date.now() / 1000) ? value : null; } catch { return null; }
}

function signToken(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${hmac(payload, process.env.SESSION_SECRET)}`;
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": process.env.ALLOWED_ORIGIN || "",
      "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
      "access-control-allow-headers": "Content-Type,Authorization",
      "access-control-max-age": "3600",
      "vary": "Origin",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

function redirect(location) { return { statusCode: 302, headers: { Location: location, "cache-control": "no-store" }, body: "" }; }

async function readJson(oss, key) {
  try {
    const result = await oss.get(key);
    return JSON.parse(result.content.toString("utf8"));
  } catch (error) {
    if (error.status === 404 || error.code === "NoSuchKey") return null;
    throw error;
  }
}
async function writeJson(oss, key, data) { await oss.put(key, Buffer.from(JSON.stringify(data)), { headers: { "Content-Type": "application/json" } }); }
function digest(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function hmac(value, secret) { return crypto.createHmac("sha256", secret).update(value).digest("base64url"); }
function safeEqual(a, b) { const left = Buffer.from(String(a)); const right = Buffer.from(String(b)); return left.length === right.length && crypto.timingSafeEqual(left, right); }

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
    } catch (error) {
      lastError = error;
      console.warn(`External request attempt ${attempt}/${attempts} failed: ${new URL(url).hostname}`, error.cause?.code || error.name);
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }
  }
  throw lastError;
}
