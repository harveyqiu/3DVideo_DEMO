# 三维剧场 Canvas 原型

这是一个本地网页应用，用 Canvas、摄像头追踪、GIF/视频素材、本地后端存储和 Kimi 语音导演代理实现三维拼贴演示。

## 运行

在项目目录启动本地服务：

```powershell
node server.js
```

然后打开编辑页：

```text
http://127.0.0.1:5174/
```

演示页：

```text
http://127.0.0.1:5174/viewer.html
```

摄像头、麦克风和部分语音能力需要在 `localhost` / `127.0.0.1` 下运行，并在浏览器里授权。

## 功能

- 支持导入 PNG、GIF、MOV、WebM，并支持为每个场景上传 MP3、WAV、OGG、M4A、AAC 音频。
- GIF 使用 DOM 媒体层覆盖在 Canvas 上，保持动画播放；关闭 GIF 循环时会用浏览器 ImageDecoder 解码并停在最后一帧。
- 场景会保存音频资源、GIF 循环、音频循环等属性，viewer.html 和 final.html 会读取同一份设置。
- 场景可以保存结束后的流转关系：不跳转、自动进入下一场景，或等待玩家对话并按关键词进入指定场景。
- 视频和图片图层支持 X、Y、深度、缩放、旋转、倾斜调节。
- 编辑页会把导入素材上传到本地 `uploads/`，并把布局保存到 `data/scene-layout-db.json`。
- 刷新网页后会从本地后端恢复上次保存的素材地址和位置信息。
- 演示页只保留三维视觉效果和视线追踪入口。
- 演示页支持通过下拉框切换场景，也支持 URL 指定场景：`viewer.html?scene=场景ID`。
- “语音对话验证”标签页可单独测试 ASR、Kimi 回复、TTS 播报和字幕生成。
- Kimi 回复以“夏仁”荒岛幸存者设定为根本提示词，按“生存→合作→冲突→背叛→结局”推进。
- 字幕预览区对应未来嵌入 3D 视频播放页最前层的字幕模块。
- MOV 透明通道能否保留取决于浏览器和系统解码器；Chrome/Edge 更建议使用 WebM alpha。

## 语音验证

如需启用 Kimi / Moonshot 语音导演能力，先在启动服务的同一个终端设置：

```powershell
$env:MOONSHOT_API_KEY="你的 Moonshot API Key"
$env:XFYUN_APP_ID="你的讯飞 AppID"
$env:XFYUN_API_KEY="你的讯飞 APIKey"
$env:XFYUN_API_SECRET="你的讯飞 APISecret"
node server.js
```

打开 `http://127.0.0.1:5174/` 后，切换到“语音对话验证”标签页：

- 点击“开始对话”测试麦克风语音识别。
- 在“文字测试”里输入一句观众台词，可绕过麦克风直接验证 Kimi 回复、TTS 播报和字幕生成。
- 后端通过 `/api/director-cue` 代理请求 Kimi，不会把 API Key 放进浏览器端代码。
- 后端通过 `/api/tts` 代理请求讯飞超拟人语音合成，默认使用聆飞逸 `x6_lingfeiyi_pro`，不会再使用浏览器自带 TTS。
- 每个场景可以单独选择讯飞发音人：聆飞逸、聆小璇、聆玉言、聆伯松。选择会保存到场景配置的 `scene.xfyunVoice`。
- 场景可勾选“需要获取年龄”。勾选后，用户语音会先被提取年龄，并无论成功失败都进入该场景配置的下一场景作为“年龄反馈场景”。反馈场景会自动调用 Kimi：成功时保存变量 `user_age` 并复述年龄，随后在语音和 GIF 播完后进入反馈场景配置的下一场景；失败时要求用户必须告诉年龄，随后回到获取年龄场景循环。

## 场景接口

场景列表：

```text
GET /api/layout?list=1
```

带完整素材和位置信息的场景列表：

```text
GET /api/layout?list=1&details=1
```

读取指定场景：

```text
GET /api/layout?id=场景ID
```

每个场景会记录素材文件地址、素材类型、X/Y/深度/缩放/旋转/倾斜/透明度，以及场景音频、GIF 循环、音频循环、结束后流转规则等信息，供后续剧本系统按场景 ID 调用。
