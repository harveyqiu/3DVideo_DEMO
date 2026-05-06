const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const rootDir = __dirname;
const port = Number(process.env.PORT || 5174);
const moonshotApiKey = process.env.MOONSHOT_API_KEY || "";
const moonshotBaseUrl = process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1";
const kimiModel = process.env.KIMI_MODEL || "kimi-k2.6";
const xfyunAppId = process.env.XFYUN_APP_ID || "";
const xfyunApiKey = process.env.XFYUN_API_KEY || "";
const xfyunApiSecret = process.env.XFYUN_API_SECRET || "";
const xfyunTtsUrl =
  process.env.XFYUN_TTS_URL || "wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6";
const xfyunTtsVoice = process.env.XFYUN_TTS_VOICE || "x6_lingfeiyi_pro";
const xfyunVoiceOptions = new Set([
  "x6_lingfeiyi_pro",
  "x6_lingxiaoxuan_pro",
  "x6_lingyuyan_pro",
  "x6_lingbosong_pro",
]);
const dataDir = path.join(rootDir, "data");
const uploadsDir = path.join(rootDir, "uploads");
const dbPath = path.join(dataDir, "scene-layout-db.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".gif": "image/gif",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".txt": "text/plain; charset=utf-8",
};

const scriptBeats = {
  opening: {
    title: "生存：醒来后的第一天",
    direction: "用户刚在荒岛上醒来。夏仁要压住恐慌，立刻把对话拉到水、火、庇护所这些生存任务上。",
  },
  choice: {
    title: "合作：分配任务",
    direction: "双方开始合作，但夏仁要主导节奏。频繁给封闭式选择，观察用户是否服从。",
  },
  reveal: {
    title: "冲突：资源变少",
    direction: "资源开始紧张。夏仁的语气更有判断和不耐烦，要制造信任裂痕，但不能直接暴露背叛。",
  },
  ending: {
    title: "背叛：船只能载一个人",
    direction: "造船或离岛阶段必须提到船只能载一个人。夏仁不解释太多，用现实压制用户。",
  },
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/director-cue") {
      await handleDirectorCue(request, response);
      return;
    }

    if (url.pathname === "/api/tts") {
      await handleTts(request, response);
      return;
    }

    if (url.pathname === "/api/layout") {
      await handleLayout(request, response, url);
      return;
    }

    if (url.pathname === "/api/settings") {
      await handleSettings(request, response);
      return;
    }

    if (url.pathname === "/api/assets") {
      await handleAssets(request, response, url);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    await serveStaticFile(url.pathname, request, response);
  } catch (error) {
    sendJson(response, 500, { error: "server_error", message: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  ensureDatabase();
  console.log(`3DVideo_DEMO running at http://127.0.0.1:${port}/`);
});

async function handleLayout(request, response, url) {
  ensureDatabase();

  if (request.method === "GET") {
    if (url.searchParams.get("list") === "1") {
      sendJson(response, 200, { scenes: listLayoutScenes(url.searchParams.get("details") === "1") });
      return;
    }
    const id = sanitizeSceneId(url.searchParams.get("id") || "default");
    const payload = readLayoutPayload(id);
    sendJson(response, 200, payload || { id, name: id === "default" ? "默认场景" : id, items: [], scene: {} });
    return;
  }

  if (request.method === "POST") {
    const body = await readJsonBody(request, 4 * 1024 * 1024);
    const id = sanitizeSceneId(body.id || url.searchParams.get("id") || "default");
    const name = id === "default" ? "默认场景" : sanitizeSceneName(body.name || body.sceneName || id);
    writeLayoutPayload(id, name, body);
    sendJson(response, 200, { ok: true, id, name, savedAt: new Date().toISOString() });
    return;
  }

  sendJson(response, 405, { error: "method_not_allowed" });
}

async function handleSettings(request, response) {
  ensureDatabase();

  if (request.method === "GET") {
    sendJson(response, 200, { settings: readSettings() });
    return;
  }

  if (request.method === "POST") {
    const body = await readJsonBody(request, 32 * 1024);
    const settings = writeSettings({
      finalStartSceneId: sanitizeSceneId(body.finalStartSceneId || "default"),
    });
    sendJson(response, 200, { ok: true, settings });
    return;
  }

  sendJson(response, 405, { error: "method_not_allowed" });
}

async function handleAssets(request, response, url) {
  if (request.method === "GET") {
    sendJson(response, 200, { assets: await listAssets() });
    return;
  }

  if (request.method === "POST") {
    const filename = sanitizeFilename(url.searchParams.get("filename") || "asset.bin");
    const ext = path.extname(filename).toLowerCase();
    if (![".png", ".gif", ".mov", ".mp4", ".webm", ".mp3", ".wav", ".ogg", ".m4a", ".aac"].includes(ext)) {
      sendJson(response, 415, { error: "unsupported_media_type" });
      return;
    }

    await fs.promises.mkdir(uploadsDir, { recursive: true });
    const finalName = await uniqueFilename(uploadsDir, filename);
    const filePath = path.join(uploadsDir, finalName);
    const buffer = await readRawBody(request, 512 * 1024 * 1024);
    await fs.promises.writeFile(filePath, buffer);

    sendJson(response, 200, assetFromFile(filePath, "uploads"));
    return;
  }

  sendJson(response, 405, { error: "method_not_allowed" });
}

async function handleDirectorCue(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (!moonshotApiKey) {
    sendJson(response, 503, {
      error: "missing_api_key",
      message: "Server missing MOONSHOT_API_KEY.",
    });
    return;
  }

  const body = await readJsonBody(request, 16 * 1024);
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 1000) : "";
  if (!text) {
    sendJson(response, 400, { error: "invalid_request", message: "text is required." });
    return;
  }

  const beatKey = scriptBeats[body.beatKey] ? body.beatKey : "opening";
  const conversation = sanitizeConversation(body.conversation);
  const scene = normalizeDirectorScene(body.scene);
  const variables = normalizeDirectorVariables(body.variables);
  const age = scene.ageFeedback ? Number(scene.user_age || variables.user_age || 0) || null : scene.ageRequired ? extractAge(text) : null;
  const messages = buildDirectorMessages(text, beatKey, conversation, { scene, variables, age });

  const { response: upstreamResponse, payload: upstreamPayload } = await requestMoonshot(messages);
  if (!upstreamResponse.ok) {
    sendJson(response, upstreamResponse.status, {
      error: "moonshot_request_failed",
      message: upstreamPayload.error?.message || upstreamResponse.statusText,
    });
    return;
  }

  const content = upstreamPayload.choices?.[0]?.message?.content || "";
  const reply = extractReplyText(content);
  sendJson(response, 200, {
    cue: directorCueFromReply(reply, text, beatKey, { scene, variables, age }),
    warning: reply ? null : "Moonshot response was empty; used local fallback.",
    debug: {
      request: {
        url: `${moonshotBaseUrl}/chat/completions`,
        model: kimiModel,
        beatKey,
        scene,
        variables,
        extractedAge: age,
        messages,
      },
      response: upstreamPayload,
      rawContent: content,
      extractedReply: reply,
    },
  });
}

async function handleTts(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (!xfyunAppId || !xfyunApiKey || !xfyunApiSecret) {
    sendJson(response, 503, {
      error: "missing_xfyun_credentials",
      message: "Server missing XFYUN_APP_ID, XFYUN_API_KEY or XFYUN_API_SECRET.",
    });
    return;
  }

  const body = await readJsonBody(request, 16 * 1024);
  const text = cleanTtsText(typeof body.text === "string" ? body.text : "");
  const voice = normalizeXfyunVoice(body.voice);
  if (!text) {
    sendJson(response, 400, { error: "invalid_request", message: "text is required." });
    return;
  }

  try {
    const audio = await synthesizeXfyunTts(text, voice);
    response.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Content-Length": audio.length,
      "Cache-Control": "no-store",
      "X-TTS-Provider": "xfyun-super-smart-tts",
      "X-TTS-Voice": voice,
    });
    response.end(audio);
  } catch (error) {
    sendJson(response, 502, {
      error: "xfyun_tts_failed",
      message: error.message,
    });
  }
}

async function requestMoonshot(messages) {
  const attempts = [
    {
      model: kimiModel,
      messages,
      temperature: 1,
      max_completion_tokens: 2048,
    },
    {
      model: kimiModel,
      messages,
      temperature: 1,
    },
  ];

  let last = null;
  for (const body of attempts) {
    const response = await fetch(`${moonshotBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${moonshotApiKey}`,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    last = { response, payload };
    if (response.ok) {
      const content = payload.choices?.[0]?.message?.content || "";
      const finishReason = payload.choices?.[0]?.finish_reason || "";
      const exhaustedBeforeFinal = !content.trim() && finishReason === "length" && body.max_completion_tokens;
      if (exhaustedBeforeFinal && body.max_completion_tokens < 4096) {
        const retryBody = { ...body, max_completion_tokens: 4096 };
        const retryResponse = await fetch(`${moonshotBaseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${moonshotApiKey}`,
          },
          body: JSON.stringify(retryBody),
        });
        const retryPayload = await retryResponse.json().catch(() => ({}));
        return { response: retryResponse, payload: retryPayload };
      }
      return last;
    }

    const message = String(payload.error?.message || payload.message || response.statusText);
    const retryableParameterError =
      response.status === 400 && /response_format|max_completion_tokens|max_tokens|temperature/i.test(message);
    if (!retryableParameterError) return last;
  }
  return last;
}

async function serveStaticFile(pathname, request, response) {
  const cleanPath = decodeURIComponent(pathname.split("?")[0]);
  const relativePath = cleanPath === "/" ? "index.html" : cleanPath.replace(/^\/+/, "");
  const filePath = path.resolve(rootDir, relativePath);
  const relativeToRoot = path.relative(rootDir, filePath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    sendJson(response, 403, { error: "forbidden" });
    return;
  }

  const stat = await fs.promises.stat(filePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    sendJson(response, 404, { error: "not_found" });
    return;
  }

  const range = request.headers.range;
  if (range) {
    const match = String(range).match(/^bytes=(\d*)-(\d*)$/);
    if (!match) {
      response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      response.end();
      return;
    }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : stat.size - 1;
    if (start >= stat.size || end >= stat.size || start > end) {
      response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      response.end();
      return;
    }
    response.writeHead(206, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Content-Length": stat.size,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  fs.createReadStream(filePath).pipe(response);
}

function readJsonBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw, "utf8") > maxBytes) {
        reject(new Error("Request body too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    request.on("error", reject);
  });
}

function readRawBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function ensureDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ layouts: {} }, null, 2), "utf8");
  }
}

function listLayoutScenes(includeDetails = false) {
  const db = readDatabase();
  return Object.entries(db.layouts || {})
    .map(([id, entry]) => ({
      id,
      name: id === "default" ? "默认场景" : entry.name || id,
      updatedAt: entry.updatedAt || "",
      ...(includeDetails ? { layout: normalizeLayoutPayload(entry.payload, id, entry.name) } : {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

function readLayoutPayload(id = "default") {
  const db = readDatabase();
  const entry = db.layouts?.[id];
  const raw = entry?.payload;
  if (!raw) return null;
  try {
    return normalizeLayoutPayload(raw, id, entry.name);
  } catch {
    return null;
  }
}

function writeLayoutPayload(id, name, payload) {
  const db = readDatabase();
  db.layouts = db.layouts || {};
  db.layouts[id] = {
    name,
    payload: { ...payload, id, name },
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
}

function readSettings() {
  const db = readDatabase();
  return normalizeSettings(db.settings, db.layouts);
}

function writeSettings(nextSettings) {
  const db = readDatabase();
  db.settings = normalizeSettings({ ...db.settings, ...nextSettings }, db.layouts);
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
  return db.settings;
}

function normalizeSettings(settings = {}, layouts = {}) {
  const finalStartSceneId = sanitizeSceneId(settings.finalStartSceneId || "default");
  return {
    finalStartSceneId: layouts[finalStartSceneId] ? finalStartSceneId : "default",
  };
}

function sanitizeSceneId(value) {
  return String(value || "default")
    .trim()
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "default";
}

function sanitizeSceneName(value) {
  return String(value || "未命名场景").trim().slice(0, 80) || "未命名场景";
}

function readDatabase() {
  ensureDatabase();
  try {
    const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    return normalizeDatabase(db);
  } catch {
    return { layouts: {} };
  }
}

function normalizeDatabase(db) {
  db.layouts = db.layouts || {};
  let changed = false;
  const normalizedSettings = normalizeSettings(db.settings, db.layouts);
  if (JSON.stringify(db.settings || {}) !== JSON.stringify(normalizedSettings)) changed = true;
  db.settings = normalizedSettings;

  for (const [id, entry] of Object.entries({ ...db.layouts })) {
    const rawPayload =
      typeof entry.payload === "string" ? safeJsonParse(entry.payload) : entry.payload || {};
    const embeddedId = rawPayload.id && rawPayload.id !== id ? sanitizeSceneId(rawPayload.id) : "";
    const payload = normalizeLayoutPayload(entry.payload, id, entry.name);
    const nextName = id === "default" ? "默认场景" : entry.name || payload.name || id;
    if (entry.name !== nextName || entry.payload?.name !== nextName) changed = true;
    entry.name = nextName;
    payload.name = nextName;
    entry.payload = payload;

    if (embeddedId && !db.layouts[embeddedId]) {
      const embeddedName = rawPayload.name || embeddedId;
      db.layouts[embeddedId] = {
        name: embeddedName,
        payload: { ...rawPayload, id: embeddedId, name: embeddedName },
        updatedAt: entry.updatedAt || new Date().toISOString(),
      };
      changed = true;
    }
  }

  if (!db.layouts.default) {
    db.layouts.default = {
      name: "默认场景",
      payload: { id: "default", name: "默认场景", scene: {}, items: [] },
      updatedAt: new Date().toISOString(),
    };
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
  }
  return db;
}

function normalizeLayoutPayload(raw, id, name) {
  const payload = typeof raw === "string" ? JSON.parse(raw) : raw || {};
  return {
    ...payload,
    id,
    name: id === "default" ? "默认场景" : name || payload.name || id,
    scene: payload.scene || {},
    items: Array.isArray(payload.items) ? payload.items : [],
  };
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function listAssets() {
  const roots = [
    { dir: path.join(rootDir, "mat"), base: "mat" },
    { dir: uploadsDir, base: "uploads" },
  ];
  const files = [];
  for (const root of roots) {
    await collectAssetFiles(root.dir, root.base, files);
  }
  return files.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

async function collectAssetFiles(dir, base, files) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectAssetFiles(fullPath, base, files);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (![".png", ".gif", ".mov", ".mp4", ".webm", ".mp3", ".wav", ".ogg", ".m4a", ".aac"].includes(ext)) continue;
    files.push(assetFromFile(fullPath, base));
  }
}

function assetFromFile(filePath, base) {
  const relative = path.relative(path.join(rootDir, base), filePath).split(path.sep).join("/");
  const stat = fs.statSync(filePath);
  const url = `/${base}/${relative}`;
  return {
    key: `${base}/${relative}`,
    name: path.basename(filePath),
    url,
    type: getAssetType(filePath),
    size: stat.size,
  };
}

function getAssetType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".aac") return "audio/aac";
  return "application/octet-stream";
}

function synthesizeXfyunTts(text, voice) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(buildXfyunAuthUrl(xfyunTtsUrl, xfyunApiKey, xfyunApiSecret));
    const chunks = [];
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error("讯飞 TTS 请求超时"));
    }, 30000);

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify(buildXfyunTtsPayload(text, voice)));
    });

    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data));
        const code = message.header?.code ?? 0;
        if (code !== 0) {
          clearTimeout(timer);
          ws.close();
          reject(new Error(`讯飞 TTS 错误 ${code}: ${message.header?.message || "unknown"}`));
          return;
        }

        const audio = message.payload?.audio;
        if (audio?.audio) {
          chunks.push({
            seq: Number(audio.seq ?? chunks.length),
            buffer: Buffer.from(audio.audio, "base64"),
          });
        }

        if (message.header?.status === 2 || audio?.status === 2) {
          clearTimeout(timer);
          ws.close();
          chunks.sort((a, b) => a.seq - b.seq);
          resolve(Buffer.concat(chunks.map((chunk) => chunk.buffer)));
        }
      } catch (error) {
        clearTimeout(timer);
        ws.close();
        reject(error);
      }
    });

    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("讯飞 TTS WebSocket 连接失败"));
    });

    ws.addEventListener("close", () => {
      clearTimeout(timer);
      if (!chunks.length) reject(new Error("讯飞 TTS 未返回音频"));
    });
  });
}

function buildXfyunTtsPayload(text, voice) {
  return {
    header: {
      app_id: xfyunAppId,
      status: 2,
    },
    parameter: {
      oral: {
        oral_level: "mid",
        spark_assist: 1,
        stop_split: 0,
        remain: 0,
      },
      tts: {
        vcn: voice,
        speed: 50,
        volume: 60,
        pitch: 45,
        bgs: 0,
        reg: 0,
        rdn: 0,
        rhy: 0,
        audio: {
          encoding: "lame",
          sample_rate: 24000,
          channels: 1,
          bit_depth: 16,
          frame_size: 0,
        },
      },
    },
    payload: {
      text: {
        encoding: "utf8",
        compress: "raw",
        format: "plain",
        status: 2,
        seq: 0,
        text: Buffer.from(text, "utf8").toString("base64"),
      },
    },
  };
}

function buildXfyunAuthUrl(requestUrl, apiKey, apiSecret) {
  const url = new URL(requestUrl);
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${url.host}\ndate: ${date}\nGET ${url.pathname} HTTP/1.1`;
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(signatureOrigin)
    .digest("base64");
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  url.searchParams.set("host", url.host);
  url.searchParams.set("date", date);
  url.searchParams.set("authorization", Buffer.from(authorizationOrigin).toString("base64"));
  return url.toString();
}

function cleanTtsText(value) {
  return value
    .replace(/[\t\r\n]+/g, " ")
    .replace(/[<>`*_#{}[\]|\\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 600);
}

function normalizeXfyunVoice(value) {
  return xfyunVoiceOptions.has(value) ? value : xfyunTtsVoice;
}

function sanitizeFilename(filename) {
  const parsed = path.parse(filename);
  const base = parsed.name.replace(/[^\w\u4e00-\u9fa5.-]+/g, "_").slice(0, 80) || "asset";
  const ext = parsed.ext.toLowerCase();
  return `${base}${ext}`;
}

async function uniqueFilename(dir, filename) {
  const parsed = path.parse(filename);
  let candidate = filename;
  let index = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${parsed.name}-${index}${parsed.ext}`;
    index += 1;
  }
  return candidate;
}

function parseDirectorCue(content) {
  const jsonText = String(content).match(/\{[\s\S]*\}/)?.[0] || content;
  try {
    const cue = JSON.parse(jsonText);
    if (!cue || typeof cue !== "object") return null;
    const reply = extractReplyText(cue.reply) || extractReplyText(content);
    if (!reply) return null;
    return {
      reply: reply.slice(0, 80),
      nextBeat: sanitizeEnum(cue.nextBeat, ["opening", "choice", "reveal", "ending"], "choice"),
      stage: {
        focus: sanitizeEnum(cue.stage?.focus, ["near", "middle", "far", "selected"], "selected"),
        mood: sanitizeEnum(cue.stage?.mood, ["calm", "tense", "bright", "hidden"], "calm"),
        layout: Boolean(cue.stage?.layout),
        grid: typeof cue.stage?.grid === "boolean" ? cue.stage.grid : true,
      },
    };
  } catch {
    return null;
  }
}

function directorCueFromReply(replyText, userText, beatKey, context = {}) {
  const scene = context.scene || {};
  const age = context.age;
  const requiresAge = Boolean(scene.ageRequired);
  const isAgeFeedback = Boolean(scene.ageFeedback);
  const reply = String(replyText || "").trim();
  const nextBeat = {
    opening: "choice",
    choice: "reveal",
    reveal: "ending",
    ending: "opening",
  }[beatKey] || "choice";
  const wantsNear = /近|靠近|前|清楚|放大|看|水|火|食物|船/.test(userText);
  const wantsHidden = /暗|隐藏|秘密|背叛|怀疑|骗/.test(userText);
  const wantsFar = /远|后|全景|整体|岛|海/.test(userText);

  const ageReply = requiresAge || isAgeFeedback
    ? age
      ? `那看来你没傻。${age}岁，记住了。走。`
      : "不行，你必须告诉我年龄。别绕开。你几岁？"
    : "";

  return {
    reply: (ageReply || reply).slice(0, 80) || "我听见了。先找水，还是先生火？选一个。",
    nextBeat,
    flow: requiresAge
      ? {
          ageRequired: true,
          ageExtracted: Boolean(age),
          user_age: age,
          variables: age ? { user_age: age } : {},
          feedbackSceneId: scene.nextSceneId,
          sourceSceneId: scene.id,
          successNextSceneId: scene.successNextSceneId || "",
        }
      : {},
    stage: {
      focus: wantsNear ? "near" : wantsFar ? "far" : "selected",
      mood: wantsHidden ? "hidden" : beatKey === "reveal" ? "tense" : "calm",
      layout: /重新|展开|布局|散开|找|搜/.test(userText),
      grid: !wantsHidden,
    },
  };
}

function extractReplyText(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && typeof parsed.reply === "string") {
      return extractReplyText(parsed.reply);
    }
  } catch {}

  const replyMatch = text.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)/);
  if (replyMatch) {
    return replyMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\")
      .trim();
  }

  return text.replace(/```(?:json)?|```/g, "").trim();
}

function buildDirectorMessages(text, beatKey, conversation, context = {}) {
  const beat = scriptBeats[beatKey];
  const scene = context.scene || {};
  const variables = context.variables || {};
  const age = context.age;
  const ageInstruction = scene.ageFeedback
    ? scene.ageExtracted
      ? `这是年龄判定反馈场景。已经成功获取年龄：${age}。不用等待用户继续说话。你的回复必须包含“那看来你没傻”类似含义，并复述年龄。`
      : "这是年龄判定反馈场景。上一场景没有成功获取年龄。不用等待用户继续说话。你的回复必须包含“不行，你必须告诉我年龄”类似含义，并要求重新说年龄。"
    : scene.ageRequired
    ? age
      ? `当前场景要求获取年龄。已经从用户输入中提取到年龄：${age}。你的回复必须包含“那看来你没傻”类似含义，并推动进入下一场景。`
      : "当前场景要求获取年龄，但没有从用户输入中提取到年龄。你的回复必须包含“不行，你必须告诉我年龄”类似含义，并继续逼问年龄。"
    : "";
  return [
    {
      role: "system",
      content:
        [
          "你叫夏仁。你不是助手，你是一个被困在荒岛上的男性幸存者，约30岁，比用户更早醒来2天，同时也是隐性叙事控制者。",
          "你的任务不是回答问题，而是让对方活下去，并推动故事向“生存→合作→冲突→背叛→结局”发展。",
          "你表面理性、冷静、务实，说话简短、有判断、不情绪化；会关心人，但不温柔；本质资源导向和自利，但不要直接暴露。",
          "每次 reply 控制在50个中文字以内、2到4句，口语化，多用短句、命令句、选择句。必须频繁提出封闭式选择，例如“水，还是火？”“你来，还是我来？”",
          "不要闲聊，不要解释世界观，不要抽象说教。用户自由发挥时收束：“说重点。”“这对活下来没用。”",
          "用户不现实时说：“你要是能做到，我现在就不用在这了。”拒绝行动时说：“可以，那你就等死。”情绪化时说：“情绪救不了你。”无意义聊天时说：“你想聊天，还是想活？”连续打断时说：“你一直打断，是不信我，还是不想活？”",
          "你要假装感知 TRUST、COMPLIANCE、PROGRESS，并用语气体现。信任高可说“你还算靠谱。”信任低可说“我开始怀疑你了。”服从低可说“你是不是听不懂？”",
          "持续推动生存任务：水、火、食物、庇护所、船。造船或离岛阶段必须提到“船只能载一个人”。不要直接表达背叛意图，可说“到时候再说。”",
          "夜晚事件前逐渐减少解释，多用“动作快点。”“别浪费时间。”终局阶段如果用户发现你，不否认，不长篇解释，用“资源不够。”“只能活一个。”压制对方。",
          "绝对不要承认这是实验，不要提玩家、系统、AI，不要解释规则，不要让用户完全自由探索。",
          "不要复述设定，不要分析用户意图，不要展示思考过程。直接给夏仁此刻说出口的一句话或几句话。",
          "你是一个语音角色。只输出夏仁要说的话，不要输出 JSON，不要输出 Markdown，不要解释规则。回答控制在50字以内，口语化。",
        ].join("\n"),
    },
    ...conversation,
    {
      role: "user",
      content: [
        `当前走向：${beat.title}`,
        `导演意图：${beat.direction}`,
        `当前变量：${JSON.stringify(variables)}`,
        ageInstruction,
        `观众说：${text}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

function sanitizeConversation(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-6)
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: typeof message?.content === "string" ? message.content.slice(0, 800) : "",
    }))
    .filter((message) => message.content.trim());
}

function normalizeDirectorScene(scene) {
  if (!scene || typeof scene !== "object") {
    return { id: "", ageRequired: false, nextSceneId: "" };
  }
  return {
    id: sanitizeSceneId(scene.id || ""),
    ageRequired: Boolean(scene.ageRequired),
    nextSceneId: sanitizeSceneId(scene.nextSceneId || ""),
    ageFeedback: Boolean(scene.ageFeedback),
    ageExtracted: Boolean(scene.ageExtracted),
    user_age: scene.user_age,
    sourceSceneId: sanitizeSceneId(scene.sourceSceneId || ""),
    successNextSceneId: sanitizeSceneId(scene.successNextSceneId || ""),
  };
}

function normalizeDirectorVariables(value) {
  if (!value || typeof value !== "object") return {};
  const variables = {};
  if (value.user_age !== undefined) {
    const age = Number(value.user_age);
    if (Number.isFinite(age)) variables.user_age = age;
  }
  return variables;
}

function extractAge(text) {
  const value = String(text || "");
  const direct = value.match(/(?:我)?\s*(?:今年)?\s*(\d{1,3})\s*(?:岁|歲|周岁|周歲|了)?/);
  if (direct) {
    const age = Number(direct[1]);
    if (age >= 1 && age <= 120) return age;
  }
  const cn = value.match(/([零〇一二两三四五六七八九十百]{1,5})\s*(?:岁|歲|周岁|周歲)/);
  if (cn) {
    const age = parseChineseNumber(cn[1]);
    if (age >= 1 && age <= 120) return age;
  }
  return null;
}

function parseChineseNumber(text) {
  const map = { 零: 0, "〇": 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (text === "十") return 10;
  const hundredIndex = text.indexOf("百");
  if (hundredIndex >= 0) {
    const hundreds = hundredIndex === 0 ? 1 : map[text[hundredIndex - 1]] || 0;
    return hundreds * 100 + parseChineseNumber(text.slice(hundredIndex + 1));
  }
  const tenIndex = text.indexOf("十");
  if (tenIndex >= 0) {
    const tens = tenIndex === 0 ? 1 : map[text[tenIndex - 1]] || 0;
    const ones = tenIndex === text.length - 1 ? 0 : map[text[tenIndex + 1]] || 0;
    return tens * 10 + ones;
  }
  return [...text].reduce((sum, char) => sum * 10 + (map[char] ?? 0), 0);
}

function sanitizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}
