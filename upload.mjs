import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import OSS from "ali-oss";

const distDir = path.resolve("dist");
const partSize = 10 * 1024 * 1024;

const uploadExtensions = new Set([
  ".js",
  ".css",
  ".jpg",
  ".jpeg",
  ".png",
  ".svg",
  ".webp",
  ".gif",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".mp4",
  ".webm",
  ".mov",
]);

const videoExtensions = new Set([".mp4", ".webm", ".mov"]);

async function loadDotEnv() {
  const envPath = path.resolve(".env");
  const content = await fs.readFile(envPath, "utf8").catch(() => "");
  if (!content) return;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

await loadDotEnv();

const requiredEnv = ["OSS_ACCESS_KEY_ID", "OSS_ACCESS_KEY_SECRET", "OSS_BUCKET", "OSS_REGION"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length) {
  throw new Error(`Missing required OSS environment variables: ${missingEnv.join(", ")}`);
}

const client = new OSS({
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  region: process.env.OSS_REGION,
  authorizationV4: true,
});

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (entry.isFile()) files.push(fullPath);
  }

  return files;
}

function toObjectName(filePath) {
  return path.relative(distDir, filePath).split(path.sep).join("/");
}

async function uploadFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html" || !uploadExtensions.has(ext)) return { skipped: true };

  const objectName = toObjectName(filePath);
  if (videoExtensions.has(ext)) {
    await client.multipartUpload(objectName, filePath, { partSize });
    return { skipped: false, multipart: true, objectName };
  }

  await client.put(objectName, filePath);
  return { skipped: false, multipart: false, objectName };
}

const files = await walk(distDir);
let uploaded = 0;
let skipped = 0;

for (const file of files) {
  const result = await uploadFile(file);
  if (result.skipped) {
    skipped += 1;
    continue;
  }

  uploaded += 1;
  const method = result.multipart ? "multipart" : "put";
  console.log(`[${method}] ${result.objectName}`);
}

console.log(`Upload finished. Uploaded: ${uploaded}. Skipped: ${skipped}.`);
