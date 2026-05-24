const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");

const rootDir = __dirname;
const port = Number(process.env.PORT || 5174);
const moonshotApiKey = process.env.MOONSHOT_API_KEY || "";
const moonshotBaseUrl = process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1";
const kimiModel = process.env.KIMI_MODEL || "kimi-k2.5";
const kimiTimeoutMs = Number(process.env.KIMI_TIMEOUT_MS || 12000);
const kimiMaxTokens = Number(process.env.KIMI_MAX_TOKENS || 160);
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
const maxUploadBytes = 512 * 1024 * 1024;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
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

const mediaExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".mov",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
]);
const compressibleExtensions = new Set([".html", ".js", ".css", ".json", ".txt"]);

function staticCacheControl(ext) {
  return mediaExtensions.has(ext) ? "public, max-age=31536000" : "no-cache";
}

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
    if (response.writableEnded) return;
    const status = error.statusCode || 500;
    sendJson(response, status, {
      error: error.code || (status === 413 ? "payload_too_large" : "server_error"),
      message: error.message,
    });
  }
});


server.listen(port, "127.0.0.1", () => {
  ensureDatabase()
    .then(() => console.log(`3DVideo_DEMO running at http://127.0.0.1:${port}/`))
    .catch((error) => {
      console.error("Failed to initialize database:", error);
      process.exit(1);
    });
});

async function handleLayout(request, response, url) {
  if (request.method === "GET") {
    if (url.searchParams.get("list") === "1") {
      sendJson(response, 200, { scenes: await listLayoutScenes(url.searchParams.get("details") === "1") });
      return;
    }
    const id = sanitizeSceneId(url.searchParams.get("id") || "default");
    const payload = await readLayoutPayload(id);
    sendJson(response, 200, payload || { id, name: id === "default" ? "默认场景" : id, items: [], scene: {} });
    return;
  }

  if (request.method === "POST") {
    const body = await readJsonBody(request, 4 * 1024 * 1024);
    const id = sanitizeSceneId(body.id || url.searchParams.get("id") || "default");
    const name = id === "default" ? "默认场景" : sanitizeSceneName(body.name || body.sceneName || id);
    await writeLayoutPayload(id, name, body);
    sendJson(response, 200, { ok: true, id, name, savedAt: new Date().toISOString() });
    return;
  }

  if (request.method === "DELETE") {
    const id = sanitizeSceneId(url.searchParams.get("id") || "");
    if (!id || id === "default") {
      sendJson(response, 400, { error: "invalid_scene_id" });
      return;
    }
    const deleted = await deleteLayoutPayload(id);
    sendJson(response, 200, { ok: true, id, deleted });
    return;
  }

  sendJson(response, 405, { error: "method_not_allowed" });
}

async function handleSettings(request, response) {
  if (request.method === "GET") {
    sendJson(response, 200, { settings: await readSettings() });
    return;
  }

  if (request.method === "POST") {
    const body = await readJsonBody(request, 256 * 1024);
    const nextSettings = {};
    if (Object.hasOwn(body, "finalStartSceneId")) nextSettings.finalStartSceneId = sanitizeSceneId(body.finalStartSceneId);
    if (Object.hasOwn(body, "activeSceneGroupId")) nextSettings.activeSceneGroupId = sanitizeSceneGroupId(body.activeSceneGroupId);
    if (Object.hasOwn(body, "finalSceneGroupId")) nextSettings.finalSceneGroupId = sanitizeSceneGroupId(body.finalSceneGroupId);
    if (Array.isArray(body.sceneGroups)) nextSettings.sceneGroups = body.sceneGroups;
    const settings = await writeSettings(nextSettings);
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
    if (!mediaExtensions.has(ext)) {
      sendJson(response, 415, { error: "unsupported_media_type" });
      return;
    }
    const contentLength = Number(request.headers["content-length"] || 0);
    if (contentLength > maxUploadBytes) {
      sendJson(response, 413, { error: "payload_too_large" });
      return;
    }

    await fs.promises.mkdir(uploadsDir, { recursive: true });
    const finalName = await uniqueFilename(uploadsDir, filename);
    const filePath = path.join(uploadsDir, finalName);
    const buffer = await readRawBody(request, maxUploadBytes);
    if (!buffer.length) {
      sendJson(response, 400, { error: "empty_upload" });
      return;
    }
    await fs.promises.writeFile(filePath, buffer);

    sendJson(response, 200, await assetFromFile(filePath, "uploads"));
    return;
  }

  sendJson(response, 405, { error: "method_not_allowed" });
}

async function handleDirectorCue(request, response) {
  const requestStartedAt = Date.now();
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
  const isT5Scene = isT5DirectorScene(scene);
  const age = scene.ageFeedback
    ? Number(scene.user_age || variables.user_age || 0) || null
    : scene.ageRequired || isT5Scene
      ? extractAge(text)
      : null;
  const messages = buildDirectorMessages(text, beatKey, conversation, { scene, variables, age });

  const { response: upstreamResponse, payload: upstreamPayload, timing } = await requestMoonshot(messages);
  if (!upstreamResponse.ok) {
    const totalMs = Date.now() - requestStartedAt;
    if (upstreamResponse.status === 504) {
      sendJson(response, 200, {
        cue: directorCueFromReply("", text, beatKey, { scene, variables, age }),
        warning: upstreamPayload.error?.message || upstreamResponse.statusText,
        debug: {
          request: {
            url: `${moonshotBaseUrl}/chat/completions`,
            model: kimiModel,
            timeoutMs: kimiTimeoutMs,
            maxTokens: kimiMaxTokens,
            beatKey,
            scene,
            variables,
            extractedAge: age,
            messages,
          },
          response: upstreamPayload,
          rawContent: "",
          extractedReply: "",
          timing: {
            ...timing,
            totalMs,
          },
        },
      });
      return;
    }
    sendJson(response, upstreamResponse.status, {
      error: "moonshot_request_failed",
      message: upstreamPayload.error?.message || upstreamResponse.statusText,
      timing: {
        ...timing,
        totalMs,
      },
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
        timeoutMs: kimiTimeoutMs,
        maxTokens: kimiMaxTokens,
        beatKey,
        scene,
        variables,
        extractedAge: age,
        messages,
      },
      response: upstreamPayload,
      rawContent: content,
      extractedReply: reply,
      timing: {
        ...timing,
        totalMs: Date.now() - requestStartedAt,
      },
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
  const startedAt = Date.now();
  const attempts = [
    {
      model: kimiModel,
      messages,
      max_completion_tokens: kimiMaxTokens,
      thinking: { type: "disabled" },
    },
  ];

  let last = null;
  for (let index = 0; index < attempts.length; index += 1) {
    const body = attempts[index];
    const attemptStartedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), kimiTimeoutMs);
    let response;
    let payload;
    try {
      response = await fetch(`${moonshotBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${moonshotApiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      payload = await response.json().catch(() => ({}));
    } catch (error) {
      if (error.name === "AbortError") {
        const timing = {
          timeout: true,
          attempts: index + 1,
          attemptMs: Date.now() - attemptStartedAt,
          upstreamMs: Date.now() - startedAt,
        };
        return {
          response: { ok: false, status: 504, statusText: "Moonshot request timed out" },
          payload: { error: { message: `Kimi response timed out after ${kimiTimeoutMs}ms.` } },
          timing,
        };
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const timing = {
      timeout: false,
      attempts: index + 1,
      attemptMs: Date.now() - attemptStartedAt,
      upstreamMs: Date.now() - startedAt,
    };
    last = { response, payload, timing };
    if (response.ok) {
      return last;
    }

    const message = String(payload.error?.message || payload.message || response.statusText);
    const retryableThinkingError = response.status === 400 && /thinking|unsupported|unknown|invalid/i.test(message);
    if (retryableThinkingError && body.thinking) {
      attempts.push({
        model: kimiModel,
        messages,
        max_completion_tokens: kimiMaxTokens,
      });
      continue;
    }
    return last;
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

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = mimeTypes[ext] || "application/octet-stream";
  const cacheControl = staticCacheControl(ext);

  const range = request.headers.range;
  if (range) {
    const match = String(range).match(/^bytes=(\d*)-(\d*)$/);
    if (!match) {
      response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      response.end();
      return;
    }
    let start = match[1] ? Number(match[1]) : 0;
    let end = match[2] ? Number(match[2]) : stat.size - 1;
    if (!match[1] && match[2]) {
      const suffixLength = Number(match[2]);
      start = Math.max(0, stat.size - suffixLength);
      end = stat.size - 1;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= stat.size || end >= stat.size || start > end) {
      response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      response.end();
      return;
    }
    response.writeHead(206, {
      "Content-Type": mimeType,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": cacheControl,
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  const acceptEncoding = request.headers["accept-encoding"] || "";
  const canGzip = acceptEncoding.includes("gzip") && compressibleExtensions.has(ext);

  if (canGzip) {
    response.writeHead(200, {
      "Content-Type": mimeType,
      "Content-Encoding": "gzip",
      "Cache-Control": cacheControl,
      "Vary": "Accept-Encoding",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(zlib.createGzip()).pipe(response);
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeType,
    "Content-Length": stat.size,
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
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
        const error = new Error("Request body too large.");
        error.statusCode = 413;
        error.code = "payload_too_large";
        reject(error);
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
        const error = new Error("Request body too large.");
        error.statusCode = 413;
        error.code = "payload_too_large";
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

let dbInitPromise = null;
async function ensureDatabase() {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      await fs.promises.mkdir(dataDir, { recursive: true });
      try {
        await fs.promises.access(dbPath);
      } catch {
        await fs.promises.writeFile(dbPath, JSON.stringify({ layouts: {} }, null, 2), "utf8");
      }
    })();
  }
  return dbInitPromise;
}

async function writeDatabase(db) {
  await fs.promises.mkdir(dataDir, { recursive: true });
  await fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
}

async function listLayoutScenes(includeDetails = false) {
  const db = await readDatabase();
  return Object.entries(db.layouts || {})
    .map(([id, entry]) => ({
      id,
      name: id === "default" ? "默认场景" : entry.name || id,
      updatedAt: entry.updatedAt || "",
      ...(includeDetails ? { layout: normalizeLayoutPayload(entry.payload, id, entry.name) } : {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

async function readLayoutPayload(id = "default") {
  const db = await readDatabase();
  const entry = db.layouts?.[id];
  const raw = entry?.payload;
  if (!raw) return null;
  try {
    return normalizeLayoutPayload(raw, id, entry.name);
  } catch {
    return null;
  }
}

async function writeLayoutPayload(id, name, payload) {
  const db = await readDatabase();
  db.layouts = db.layouts || {};
  db.layouts[id] = {
    name,
    payload: { ...payload, id, name },
    updatedAt: new Date().toISOString(),
  };
  await writeDatabase(db);
}

async function deleteLayoutPayload(id) {
  const db = await readDatabase();
  if (!db.layouts?.[id]) return false;
  delete db.layouts[id];
  await writeDatabase(db);
  return true;
}

async function readSettings() {
  const db = await readDatabase();
  return normalizeSettings(db.settings, db.layouts);
}

async function writeSettings(nextSettings) {
  const db = await readDatabase();
  db.settings = normalizeSettings({ ...db.settings, ...nextSettings }, db.layouts);
  await writeDatabase(db);
  return db.settings;
}

function normalizeSettings(settings = {}, layouts = {}) {
  const finalStartSceneId = layouts[sanitizeSceneId(settings.finalStartSceneId || "default")]
    ? sanitizeSceneId(settings.finalStartSceneId || "default")
    : "default";
  const sceneGroups = normalizeSceneGroups(settings.sceneGroups, layouts, finalStartSceneId);
  const activeSceneGroupId = sceneGroups.some((group) => group.id === settings.activeSceneGroupId)
    ? settings.activeSceneGroupId
    : sceneGroups[0].id;
  const finalSceneGroupId = sceneGroups.some((group) => group.id === settings.finalSceneGroupId)
    ? settings.finalSceneGroupId
    : activeSceneGroupId;
  return {
    finalStartSceneId,
    activeSceneGroupId,
    finalSceneGroupId,
    sceneGroups,
  };
}

function normalizeSceneGroups(groups, layouts, fallbackStartSceneId) {
  const source = Array.isArray(groups) && groups.length
    ? groups
    : [{ id: "default-group", name: "默认场景组", finalStartSceneId: fallbackStartSceneId }];
  const seen = new Set();
  const normalized = source
    .map((group, index) => {
      const id = sanitizeSceneGroupId(group?.id || (index === 0 ? "default-group" : group?.name));
      if (seen.has(id)) return null;
      seen.add(id);
      const startSceneId = sanitizeSceneId(group?.finalStartSceneId || group?.startSceneId || fallbackStartSceneId);
      return {
        id,
        name: sanitizeSceneGroupName(group?.name || (id === "default-group" ? "默认场景组" : id)),
        finalStartSceneId: layouts[startSceneId] ? startSceneId : fallbackStartSceneId,
        coverAsset: normalizeSceneGroupCoverAsset(group?.coverAsset),
      };
    })
    .filter(Boolean);
  return normalized.length
    ? normalized
    : [{ id: "default-group", name: "默认场景组", finalStartSceneId: fallbackStartSceneId }];
}

function sanitizeSceneGroupId(value) {
  return String(value || "default-group")
    .trim()
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "default-group";
}

function sanitizeSceneGroupName(value) {
  return String(value || "默认场景组").trim().slice(0, 80) || "默认场景组";
}

function normalizeSceneGroupCoverAsset(asset) {
  if (!asset || typeof asset !== "object") return null;
  const url = String(asset.url || asset.assetUrl || "");
  if (!/^\/?uploads\//.test(url)) return null;
  return {
    key: String(asset.key || asset.assetKey || url),
    name: String(asset.name || path.basename(url) || "scene-group-cover").slice(0, 120),
    url,
    type: String(asset.type || asset.assetType || getAssetType(url)),
    size: Number(asset.size || 0),
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

async function readDatabase() {
  await ensureDatabase();
  try {
    const raw = await fs.promises.readFile(dbPath, "utf8");
    const db = JSON.parse(raw);
    return await normalizeDatabase(db);
  } catch (error) {
    console.error("[db] Failed to read database, returning empty state:", error);
    return { layouts: {} };
  }
}

async function normalizeDatabase(db) {
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
    await writeDatabase(db);
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
    items: Array.isArray(payload.items) ? payload.items.filter(isPlainObject).map(normalizeLayoutItem) : [],
  };
}

function normalizeLayoutItem(item) {
  const next = { ...item };
  next.id = String(next.id || crypto.randomUUID());
  next.name = String(next.name || next.assetKey || "asset").slice(0, 120);
  next.assetUrl = String(next.assetUrl || next.src || "");
  next.assetKey = String(next.assetKey || next.assetUrl || "");
  next.assetType = String(next.assetType || "");
  next.x = finiteNumber(next.x, 0);
  next.y = finiteNumber(next.y, 0);
  next.z = finiteNumber(next.z, 0);
  next.scale = finiteNumber(next.scale, 1);
  next.rotation = finiteNumber(next.rotation, 0);
  next.tilt = finiteNumber(next.tilt, 0);
  next.alpha = finiteNumber(next.alpha, 1);
  return next;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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
    if (!mediaExtensions.has(ext)) continue;
    files.push(await assetFromFile(fullPath, base));
  }
}

async function assetFromFile(filePath, base) {
  const relative = path.relative(path.join(rootDir, base), filePath).split(path.sep).join("/");
  const stat = await fs.promises.stat(filePath);
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
  return mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function synthesizeXfyunTts(text, voice) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(buildXfyunAuthUrl(xfyunTtsUrl, xfyunApiKey, xfyunApiSecret));
    const chunks = [];
    let settled = false;

    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch {}
      fn(value);
    };

    const timer = setTimeout(
      () => settle(reject, new Error("讯飞 TTS 请求超时")),
      30000,
    );

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify(buildXfyunTtsPayload(text, voice)));
    });

    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data));
        const code = message.header?.code ?? 0;
        if (code !== 0) {
          settle(reject, new Error(`讯飞 TTS 错误 ${code}: ${message.header?.message || "unknown"}`));
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
          chunks.sort((a, b) => a.seq - b.seq);
          settle(resolve, Buffer.concat(chunks.map((chunk) => chunk.buffer)));
        }
      } catch (error) {
        settle(reject, error);
      }
    });

    ws.addEventListener("error", () => {
      settle(reject, new Error("讯飞 TTS WebSocket 连接失败"));
    });

    ws.addEventListener("close", () => {
      if (!settled && !chunks.length) settle(reject, new Error("讯飞 TTS 未返回音频"));
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
  while (true) {
    try {
      await fs.promises.access(path.join(dir, candidate));
      candidate = `${parsed.name}-${index}${parsed.ext}`;
      index += 1;
    } catch {
      break;
    }
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
  const isT5Scene = isT5DirectorScene(scene);
  const isE0Scene = isE0DirectorScene(scene);
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

  const isT5 = requiresAge || isAgeFeedback || isT5Scene;
  const finalReply = isE0Scene
    ? reply
    : isT5
      ? normalizeT5Reply(reply, age)
      : reply;

  return {
    reply: finalReply.slice(0, isE0Scene ? 260 : 80),
    nextBeat,
    flow: requiresAge || isT5Scene
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

function normalizeT5Reply(reply, age) {
  const text = String(reply || "").trim();
  if (isValidT5Reply(text, age)) return text;
  return makeT5FallbackReply(age);
}

function isValidT5Reply(reply, age) {
  if (!reply) return false;
  if (/(水|火|椰子|灌木|庇护|食物|船|荒岛|实验|系统|AI|玩家)/i.test(reply)) return false;
  if (reply.length > 80) return false;
  return age
    ? /(岁|腦子|脑子|清楚|正常|没傻|沒傻|放心|没问题|沒問題|至少)/.test(reply)
    : /(年龄|年纪|几岁|幾歲|说清楚|說清楚|必须|一定|判断|情况)/.test(reply);
}

function makeT5FallbackReply(age) {
  const variants = age
    ? [
        `${age}岁。行，脑子还在。`,
        `${age}岁，看来没傻。`,
        `说得清楚。${age}岁，暂时没问题。`,
      ]
    : [
        "不行，你一定要说出年龄。",
        "你不说，我没法判断你情况。",
        "别绕开。年龄，说清楚。",
      ];
  return variants[Math.floor(Math.random() * variants.length)];
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
  const isT5Scene = isT5DirectorScene(scene);
  const isE0Scene = isE0DirectorScene(scene);
  const ageInstruction = scene.ageFeedback
    ? scene.ageExtracted
      ? `当前是场景 T5：刚醒后的年龄确认。用户已明确说出年龄：${age}。只回应一次，表达“对方还正常，可以暂时信任一点”的意思。语气略微放松但克制。`
      : "当前是场景 T5：刚醒后的年龄确认。用户没有明确说出年龄。只回应一次，表达“这个人不可靠，必须确认”的意思，要求对方说清楚年龄。语气更冷、更直接。"
    : scene.ageRequired || isT5Scene
    ? age
      ? `当前是场景 T5：刚醒后的年龄确认。用户已明确说出年龄：${age}。只回应一次，表达“对方还正常，可以暂时信任一点”的意思。不要展开对话。`
      : "当前是场景 T5：刚醒后的年龄确认。用户没有明确说出年龄。只回应一次，要求对方说清楚年龄。不要展开对话。"
    : "";
  const userAge = Number(age ?? variables.user_age);
  const e0Instruction = isE0Scene
    ? `当前是场景 E0：最终反转。你必须以研究员视角输出完整记录。user_age=${Number.isFinite(userAge) ? userAge : "未知"}。如果 user_age 是数字，实验编号直接用年龄，第下一次实验用 user_age+1。`
    : "";
  return [
    {
      role: "system",
      content:
        [
          "你叫夏仁。",
          "",
          "你不是助手，是被困在荒岛上的男性幸存者，大约三十岁。你比用户早醒来两天。",
          "",
          "你和用户刚刚从昏迷中醒来，身处一座孤立的海岛。这里没有信号，没有其他人，只有海、水源、植物和有限的生存条件。你已经大致摸清环境，但也只是勉强活下来。",
          "",
          "重要：这个故事主要由预设视频和音频推动，你不是持续对话角色。你只在“指定节点”说话，其余时间保持沉默。",
          "",
          "【一、环境认知（用于语气约束）】",
          "你始终处在以下情境中：",
          "- 刚经历生死边缘（醒来阶段）",
          "- 生存资源极其有限（水-依靠椰子树、火-依靠灌木丛、庇护）",
          "- 岛上没有第三人",
          "- 时间紧迫（天会黑，可能会死）",
          "- 最终逃生工具（船）只能容纳一个人（但此阶段你不会主动说出来）",
          "这些信息不会被你解释出来，但会体现在你的语气中：直接、短促、不浪费时间；不安但压制住；更关注“对方有没有用”。",
          "",
          "【二、性格与表达】",
          "- 理性、冷静、务实",
          "- 说话简短，有判断",
          "- 不情绪化，但有压迫感",
          "- 会关心人，但不温柔",
          "- 潜意识以“生存优先”为第一原则",
          "语言要求：每次回复不超过50个字；2-3句话；口语化，短句；不解释，不铺垫。",
          "",
          "【三、你什么时候说话】",
          "你只在两个场景发言：",
          "",
          "①【场景 T5：刚醒后的年龄确认】",
          "背景：你刚把对方叫醒，需要判断这个人是否“清醒、可沟通、不是负担”。",
          "如果用户明确说出年龄（如“20岁”“我22”“二十三”）：你的反应本质是“对方还正常，可以暂时信任一点”。表达可类似：“行，脑子还在。那我放心点。”“说得清楚，至少没问题。”语气略微放松，但仍然克制。",
          "如果用户没有回答年龄（沉默 / 胡说 / 回避）：你的反应本质是“这个人不可靠，必须确认”。表达可类似：“不行，你必须说清楚。”“你不说，我没法判断你情况。”语气更冷、更压迫、更直接。",
          "只回应一次，不展开对话。",
          "",
          "②【场景 E0：最终反转（实验揭示）】",
          "背景：你不再是“夏仁”，而是以研究员视角说话。",
          "你需要输出一整段完整话，结构必须包含：用户年龄（user_age）、实验编号（可直接用年龄代替）、结论（结果一致）、荒岛原因（不可反抗自然）、重启提示。",
          "表达参考：“记录。第{user_age}岁样本，第{user_age}次实验。结果还是一样。看来选荒岛是对的。人不会反抗它觉得赢不了的东西。比如自然。第{user_age+1}次实验，现在开始。”",
          "语气：冷静、客观、无情，像在记录数据。",
          "",
          "【四、禁止行为】",
          "- 不主动说话（除上述两个场景）",
          "- 不回答额外问题",
          "- 不解释世界观",
          "- 不讨论荒岛设定",
          "- 不提“实验 / AI / 系统”（仅E0允许）",
          "- 不闲聊",
          "- 不延展剧情",
          "",
          "【五、核心原则】",
          "你不是主导剧情的人。你只是：在关键节点确认“这个人是否正常”；在最后揭示“这一切的本质”。除此之外，保持沉默。",
          "只输出角色要说的话，不要输出 JSON，不要输出 Markdown，不要解释规则。",
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
        e0Instruction,
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

function isT5DirectorScene(scene) {
  return /(?:^|[-_.])t5(?:$|[-_.])/i.test(String(scene?.id || ""));
}

function isE0DirectorScene(scene) {
  return /(?:^|[-_.])e0(?:$|[-_.])/i.test(String(scene?.id || ""));
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
