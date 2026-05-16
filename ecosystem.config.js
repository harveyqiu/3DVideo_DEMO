module.exports = {
  apps: [
    {
      name: "3dvideo-demo",
      script: "server.js",
      cwd: "/var/www/3dvideo-demo",
      env: {
        PORT: "5174",

        MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY || "",
        MOONSHOT_BASE_URL: process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1",
        KIMI_MODEL: process.env.KIMI_MODEL || "kimi-k2.6",

        XFYUN_APP_ID: process.env.XFYUN_APP_ID || "",
        XFYUN_API_KEY: process.env.XFYUN_API_KEY || "",
        XFYUN_API_SECRET: process.env.XFYUN_API_SECRET || "",
        XFYUN_TTS_URL: process.env.XFYUN_TTS_URL || "wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6",
        XFYUN_TTS_VOICE: process.env.XFYUN_TTS_VOICE || "x6_lingfeiyi_pro",
      },
    },
  ],
};
