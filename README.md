# 3DVideo_DEMO

一个基于 Canvas 的 3D 互动视频原型，用于搭建“场景素材 + 镜头视差 + 语音互动 + 剧情跳转”的网页体验。

当前版本已经回到轻量架构：没有 Vite、Docker 或前端打包步骤，服务端由 `server.js` 使用 Node.js 原生模块提供静态文件、素材上传、场景数据读写、Kimi 导演代理和讯飞 TTS 代理；前端交互集中在 `src/app.js`。

## 当前架构

```text
3DVideo_DEMO/
├─ index.html                  # 编辑器：导入素材、调整图层、配置场景流转和语音测试
├─ viewer.html                 # 演示页：按场景播放 3D 画面，保留基础控制
├─ final.html                  # 最终展示页：全屏体验、摄像头视线追踪、语音/文字互动
├─ src/app.js                  # 前端主逻辑，按 body[data-mode] 区分 editor / viewer / final
├─ server.js                   # Node 原生 HTTP 服务和 API 代理
├─ styles.css                  # 三个页面共用样式
├─ data/scene-layout-db.json   # 场景数据库
├─ uploads/                    # 编辑器上传后的素材
├─ mat/                        # 原始/补充素材库
├─ public/                     # 兼容保留的静态素材目录
├─ .env.example                # 环境变量模板
└─ ecosystem.config.js         # PM2 部署配置示例
```

最近的提交历史体现了现在的取舍：

- `f53cec3`：改为异步文件 I/O，补充环境变量模板和资源清理。
- `35e6c61`：去重并统一错误处理、布局归一化和性能细节。
- `8c6453c`：回退 Vite/CDN/Docker 打包改造，保留当前业务代码。
- `8e5eed0`：为静态资源增加缓存头、Range 请求和 Gzip 压缩。

## 功能概览

- 在编辑器中导入 PNG、GIF、MOV、WebM 作为画面图层，也可以为场景上传 MP3、WAV、OGG、M4A、AAC 音频。
- 每个图层支持 X/Y、深度、缩放、旋转、倾斜和透明度配置。
- Canvas 负责透视投影和视差；GIF 使用 DOM/Canvas 覆盖层保持动画播放；WebM/MOV 作为视频图层参与场景播放。
- 场景配置会保存到 `data/scene-layout-db.json`，上传素材会保存到 `uploads/`。
- 场景结束后支持三种流转方式：不跳转、自动进入下一场景、等待观众对话并按关键词跳转。
- `final.html` 会读取全局设置中的 `finalSceneGroupId`，再使用该场景组自己的首场景开始展示。
- 摄像头视线追踪、浏览器语音识别和麦克风能力依赖浏览器授权；线上环境需要 HTTPS。
- Kimi 用于“导演提示/角色回复”，讯飞超拟人 TTS 用于服务端合成语音，API Key 只应放在服务端环境变量中。

当前 `data/scene-layout-db.json` 会保存多个场景组，每个场景组代表一个最终展示视频。

## 本地运行

建议使用 Node.js 22 或更高版本。项目没有 npm 依赖，主要依赖 Node 自带的 `fetch`、`AbortController`、`WebSocket`、文件系统和 HTTP 能力。

```powershell
cd 3DVideo_DEMO
npm start
```

或直接运行：

```powershell
node server.js
```

启动后访问：

```text
编辑器：http://127.0.0.1:5174/
演示页：http://127.0.0.1:5174/viewer.html
最终页：http://127.0.0.1:5174/final.html
指定场景：http://127.0.0.1:5174/final.html?scene=场景ID
```

检查语法：

```powershell
npm run check
```

## 环境变量

`server.js` 直接读取进程环境变量，不会自动加载 `.env` 文件。`.env.example` 只是模板；本地运行时可以在同一个终端里设置变量，线上部署时建议通过 PM2、系统服务或服务器面板注入变量。

PowerShell 示例：

```powershell
$env:MOONSHOT_API_KEY="你的 Moonshot API Key"
$env:MOONSHOT_BASE_URL="https://api.moonshot.cn/v1"
$env:KIMI_MODEL="kimi-k2.6"

$env:XFYUN_APP_ID="你的讯飞 AppID"
$env:XFYUN_API_KEY="你的讯飞 APIKey"
$env:XFYUN_API_SECRET="你的讯飞 APISecret"
$env:XFYUN_TTS_URL="wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6"
$env:XFYUN_TTS_VOICE="x6_lingfeiyi_pro"

npm start
```

可选变量：

```text
PORT=5174
KIMI_TIMEOUT_MS=12000
KIMI_MAX_TOKENS=160
```

注意：不要把真实密钥写进 README、前端代码或公开仓库。如果密钥已经提交过，建议在服务商后台轮换。

## API

### 场景

```text
GET  /api/layout?list=1
GET  /api/layout?list=1&details=1
GET  /api/layout?id=场景ID
POST /api/layout
```

场景数据包含：

- `scene.focal`、`scene.parallax`、`scene.showGrid`
- `scene.audioAsset`、`scene.audioLoop`
- `scene.gifLoop`、`scene.webmLoop`
- `scene.flow.mode`、`scene.flow.nextSceneId`、`scene.flow.routes`
- `scene.xfyunVoice`、`scene.ageRequired`、`scene.realtimeReply`
- `items[]` 中每个素材的地址、类型、坐标、深度、缩放、旋转、倾斜和透明度

### 全局设置

```text
GET  /api/settings
POST /api/settings
```

目前主要保存 `sceneGroups`、`activeSceneGroupId` 和 `finalSceneGroupId`。

### 素材

```text
GET  /api/assets
POST /api/assets?filename=文件名
```

支持的扩展名：

```text
.png .gif .mov .mp4 .webm .mp3 .wav .ogg .m4a .aac
```

上传接口单文件上限为 512 MB。`GET /api/assets` 会扫描 `mat/` 和 `uploads/`。

### 语音互动

```text
POST /api/director-cue
POST /api/tts
```

`/api/director-cue` 代理 Kimi，对观众输入生成角色回复、字幕文本和舞台提示。

`/api/tts` 代理讯飞超拟人 TTS，返回 `audio/mpeg`。

## 部署

推荐部署方式是：PM2 在服务器本机运行 Node 服务，Nginx 负责 HTTPS 和反向代理。

原因有两个：

- 代码当前监听 `127.0.0.1`，适合放在 Nginx 后面，不适合直接暴露端口。
- 摄像头和麦克风在现代浏览器中需要安全上下文；生产环境应使用 HTTPS。

### 1. 准备服务器

安装 Node.js 22+、Git、PM2 和 Nginx：

```bash
node -v
npm install -g pm2
```

把项目放到服务器，例如：

```bash
sudo mkdir -p /var/www/3dvideo-demo
sudo chown -R $USER:$USER /var/www/3dvideo-demo
cd /var/www/3dvideo-demo
git clone <你的仓库地址> .
```

如果不通过 Git，也可以把整个项目目录上传到 `/var/www/3dvideo-demo`。需要保留 `data/`、`uploads/`、`mat/` 中的实际场景和素材文件。

### 2. 配置环境变量

方式一：用服务器环境变量启动。

```bash
export PORT=5174
export MOONSHOT_API_KEY="你的 Moonshot API Key"
export MOONSHOT_BASE_URL="https://api.moonshot.cn/v1"
export KIMI_MODEL="kimi-k2.6"
export XFYUN_APP_ID="你的讯飞 AppID"
export XFYUN_API_KEY="你的讯飞 APIKey"
export XFYUN_API_SECRET="你的讯飞 APISecret"
export XFYUN_TTS_URL="wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6"
export XFYUN_TTS_VOICE="x6_lingfeiyi_pro"
```

方式二：使用 `ecosystem.config.js`。上线前请检查里面的 `cwd` 是否等于服务器实际目录，并把密钥改成你的生产环境配置。

### 3. 启动 PM2

```bash
cd /var/www/3dvideo-demo
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

查看状态和日志：

```bash
pm2 status
pm2 logs 3dvideo-demo
```

更新代码后重载：

```bash
cd /var/www/3dvideo-demo
git pull
pm2 reload 3dvideo-demo
```

### 4. 配置 Nginx

示例配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 512m;

    location / {
        proxy_pass http://127.0.0.1:5174;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用后再用 Certbot 或服务器面板签发 HTTPS 证书。HTTPS 生效后访问：

```text
https://your-domain.com/final.html
```

### 5. 验证部署

```bash
curl -I https://your-domain.com/
curl https://your-domain.com/api/layout?list=1
```

浏览器中检查：

- `final.html` 能加载首场景。
- 视频/音频素材能正常播放。
- 摄像头和麦克风能弹出授权。
- 文字输入可以触发 `/api/director-cue` 和 `/api/tts`。

## 常见问题

### 外网打不开 5174 端口

这是当前设计。`server.js` 监听 `127.0.0.1`，推荐通过 Nginx 反向代理访问。如果确实要直接暴露端口，需要把监听地址改为 `0.0.0.0`，并配置防火墙和 HTTPS。

### 摄像头或麦克风没有授权弹窗

本地请使用 `http://127.0.0.1:5174` 或 `http://localhost:5174`。线上必须使用 HTTPS。

### Kimi 或 TTS 返回 503

通常是服务端缺少 `MOONSHOT_API_KEY`、`XFYUN_APP_ID`、`XFYUN_API_KEY` 或 `XFYUN_API_SECRET`。确认变量是在运行 Node 服务的同一个进程环境中设置的。

### MOV 透明通道显示不稳定

透明 MOV 的兼容性取决于浏览器和系统解码器。Chrome/Edge 里更推荐使用 WebM alpha。

### 修改场景后线上没有变化

场景数据写在 `data/scene-layout-db.json`，上传素材写在 `uploads/`。部署或迁移时需要同步这两个目录；如果只更新代码，线上场景数据不会自动变化。

## 维护备注

- 前端场景下拉框、图层列表和场景关系面板应优先复用已有渲染 helper，避免在高频同步中重复绑定事件或重复查询 DOM。
- 新增场景字段时，需要同时检查 `serializeLayout()`、`applySceneLayout()`、`normalizeLayoutPayload()` 和 viewer/final 的播放入口。
- 新增媒体类型时，需要同步更新前端 `supportedMediaExtensions`、后端 `mediaExtensions`/`mimeTypes`，并确认浏览器是否能直接解码。
- 场景文件和位置信息以 `/api/layout?list=1&details=1` 作为后续拼接调用入口，可一次读取所有场景的素材、坐标、循环和流转信息。
