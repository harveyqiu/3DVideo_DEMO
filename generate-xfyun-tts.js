const fs = require("node:fs");
const crypto = require("node:crypto");

const XFYUN_TTS_URL =
  process.env.XFYUN_TTS_URL || "wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6";
const DEFAULT_VOICE = process.env.XFYUN_TTS_VOICE || "x6_lingfeiyi_pro";

const voiceOptions = new Set([
  "x6_lingfeiyi_pro",
  "x6_lingxiaoxuan_pro",
  "x6_lingyuyan_pro",
  "x6_lingbosong_pro",
]);

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const text = cleanText(args.text || "我们还需要根绳子。你找找看。");
  const voice = normalizeVoice(args.voice || DEFAULT_VOICE);
  const output = args.output || `xfyun-${voice}-${Date.now()}.mp3`;

  const appId = process.env.XFYUN_APP_ID;
  const apiKey = process.env.XFYUN_API_KEY;
  const apiSecret = process.env.XFYUN_API_SECRET;
  if (!appId || !apiKey || !apiSecret) {
    throw new Error(
      "缺少讯飞环境变量。请先设置 XFYUN_APP_ID、XFYUN_API_KEY、XFYUN_API_SECRET。",
    );
  }

  console.log(`voice: ${voice}`);
  console.log(`output: ${output}`);
  const audio = await synthesize({ text, voice, appId, apiKey, apiSecret });
  fs.writeFileSync(output, audio);
  console.log(`done: ${output} (${audio.length} bytes)`);
}

function synthesize({ text, voice, appId, apiKey, apiSecret }) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(buildAuthUrl(XFYUN_TTS_URL, apiKey, apiSecret));
    const chunks = [];
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error("讯飞 TTS 请求超时"));
    }, 30000);

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify(buildPayload({ text, voice, appId })));
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

function buildPayload({ text, voice, appId }) {
  return {
    header: {
      app_id: appId,
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

function buildAuthUrl(requestUrl, apiKey, apiSecret) {
  const url = new URL(requestUrl);
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${url.host}\ndate: ${date}\nGET ${url.pathname} HTTP/1.1`;
  const signature = crypto.createHmac("sha256", apiSecret).update(signatureOrigin).digest("base64");
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  url.searchParams.set("host", url.host);
  url.searchParams.set("date", date);
  url.searchParams.set("authorization", Buffer.from(authorizationOrigin).toString("base64"));
  return url.toString();
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--text") args.text = argv[++index] || "";
    else if (arg === "--voice") args.voice = argv[++index] || "";
    else if (arg === "--output") args.output = argv[++index] || "";
  }
  return args;
}

function normalizeVoice(value) {
  return voiceOptions.has(value) ? value : DEFAULT_VOICE;
}

function cleanText(value) {
  return String(value || "")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/[<>`*_#{}[\]|\\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 600);
}
