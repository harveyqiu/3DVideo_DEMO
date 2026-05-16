import { defineConfig, loadEnv } from "vite";
import obfuscator from "rollup-plugin-obfuscator";

function normalizeBase(value) {
  if (!value) return "/";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "/";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function getProdBase(env) {
  const explicitCdn = env.OSS_CDN_BASE_URL || env.OSS_CDN_DOMAIN;
  if (explicitCdn) return normalizeBase(explicitCdn);

  if (env.OSS_BUCKET && env.OSS_REGION) {
    return normalizeBase(`https://${env.OSS_BUCKET}.${env.OSS_REGION}.aliyuncs.com/`);
  }

  return "/";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isProd = mode === "production";

  return {
    base: isProd ? getProdBase(env) : "/",
    publicDir: "public",
    server: {
      proxy: {
        "/api": "http://127.0.0.1:5174",
      },
    },
    build: {
      minify: "esbuild",
      rollupOptions: {
        input: {
          index: "index.html",
          viewer: "viewer.html",
          final: "final.html",
        },
        output: {
          manualChunks: undefined,
        },
      },
    },
    esbuild: isProd
      ? {
          minifyIdentifiers: true,
          minifySyntax: true,
          minifyWhitespace: true,
        }
      : undefined,
    plugins: isProd
      ? [
          obfuscator({
            options: {
              compact: true,
              controlFlowFlattening: false,
              deadCodeInjection: false,
              stringArray: true,
              rotateStringArray: true,
            },
          }),
        ]
      : [],
  };
});
