const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d", { alpha: false });
const appMode = document.body.dataset.mode || "editor";
const isViewer = appMode === "viewer";

const ui = {
  fileInput: document.querySelector("#fileInput"),
  cameraButton: document.querySelector("#cameraButton"),
  autoLayoutButton: document.querySelector("#autoLayoutButton"),
  saveLayoutButton: document.querySelector("#saveLayoutButton"),
  saveAsLayoutButton: document.querySelector("#saveAsLayoutButton"),
  sceneSelect: document.querySelector("#sceneSelect"),
  sceneNameInput: document.querySelector("#sceneNameInput"),
  exportButton: document.querySelector("#exportButton"),
  deleteButton: document.querySelector("#deleteButton"),
  layerList: document.querySelector("#layerList"),
  mediaOverlay: document.querySelector("#mediaOverlay"),
  cameraPreview: document.querySelector("#cameraPreview"),
  cameraSelect: document.querySelector("#cameraSelect"),
  cameraDiagnostics: document.querySelector("#cameraDiagnostics"),
  trackingState: document.querySelector("#trackingState"),
  trackingMeta: document.querySelector("#trackingMeta"),
  voiceButton: document.querySelector("#voiceButton"),
  voiceStatus: document.querySelector("#voiceStatus"),
  voiceTranscript: document.querySelector("#voiceTranscript"),
  voiceReply: document.querySelector("#voiceReply"),
  voiceCaptionPreview: document.querySelector("#voiceCaptionPreview"),
  voiceTextInput: document.querySelector("#voiceTextInput"),
  voiceTextSendButton: document.querySelector("#voiceTextSendButton"),
  micLevelButton: document.querySelector("#micLevelButton"),
  micLevelBar: document.querySelector("#micLevelBar"),
  micLevelStatus: document.querySelector("#micLevelStatus"),
  kimiRequestDebug: document.querySelector("#kimiRequestDebug"),
  kimiResponseDebug: document.querySelector("#kimiResponseDebug"),
  scriptBeatSelect: document.querySelector("#scriptBeatSelect"),
  stageSubtitle: document.querySelector("#stageSubtitle"),
  tabButtons: document.querySelectorAll("[data-tab-target]"),
  tabPages: document.querySelectorAll(".tab-page"),
  focalRange: document.querySelector("#focalRange"),
  parallaxRange: document.querySelector("#parallaxRange"),
  gridToggle: document.querySelector("#gridToggle"),
  xRange: document.querySelector("#xRange"),
  yRange: document.querySelector("#yRange"),
  zRange: document.querySelector("#zRange"),
  scaleRange: document.querySelector("#scaleRange"),
  rotationRange: document.querySelector("#rotationRange"),
  tiltRange: document.querySelector("#tiltRange"),
  layoutStatus: document.querySelector("#layoutStatus"),
  viewerStartButton: document.querySelector("#viewerStartButton"),
  values: {
    focalRange: document.querySelector("#focalValue"),
    parallaxRange: document.querySelector("#parallaxValue"),
    xRange: document.querySelector("#xValue"),
    yRange: document.querySelector("#yValue"),
    zRange: document.querySelector("#zValue"),
    scaleRange: document.querySelector("#scaleValue"),
    rotationRange: document.querySelector("#rotationValue"),
    tiltRange: document.querySelector("#tiltValue"),
  },
};

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  items: [],
  selectedId: null,
  focal: 860,
  parallax: 92,
  showGrid: true,
  pointerHead: { x: 0, y: 0, z: 0 },
  trackedHead: { x: 0, y: 0, z: 0 },
  currentHead: { x: 0, y: 0, z: 0 },
  cameraOn: false,
  cameraDeviceId: "",
  cameraHealthTimer: null,
  blackFrameCount: 0,
  tracker: null,
  dragging: null,
  layoutSaveTimer: null,
  currentSceneId: new URLSearchParams(window.location.search).get("scene") || "default",
  currentSceneName: "默认场景",
  scenes: [],
  loadingScene: true,
  gifElements: new Map(),
  voice: {
    recognition: null,
    listening: false,
    busy: false,
    conversation: [],
    directorEndpoint: "/api/director-cue",
    micStream: null,
    micAudioContext: null,
    micAnalyser: null,
    micLevelTimer: null,
    micMonitoring: false,
    minListenMs: 10000,
    listenStartedAt: 0,
    listenStopTimer: null,
    manualStop: false,
    transcriptBuffer: "",
    interimTranscript: "",
    restartingRecognition: false,
  },
};

const scriptBeats = {
  opening: {
    title: "生存：醒来后的第一天",
    next: "choice",
    direction:
      "用户刚在荒岛上醒来。夏仁要压住恐慌，立刻把对话拉到水、火、庇护所这些生存任务上。",
  },
  choice: {
    title: "合作：分配任务",
    next: "reveal",
    direction:
      "双方开始合作，但夏仁要主导节奏。频繁给封闭式选择，观察用户是否服从。",
  },
  reveal: {
    title: "冲突：资源变少",
    next: "ending",
    direction:
      "资源开始紧张。夏仁的语气更有判断和不耐烦，要制造信任裂痕，但不能直接暴露背叛。",
  },
  ending: {
    title: "背叛：船只能载一个人",
    next: "opening",
    direction:
      "造船或离岛阶段必须提到船只能载一个人。夏仁不解释太多，用现实压制用户。",
  },
};

const rangeConfigs = {
  focalRange: { stateKey: "focal", min: 520, max: 1300 },
  parallaxRange: { stateKey: "parallax", min: 0, max: 180 },
  xRange: { itemKey: "x", min: -520, max: 520, neutral: 50 },
  yRange: { itemKey: "y", min: -320, max: 320, neutral: 50 },
  zRange: { itemKey: "z", min: -260, max: 980 },
  scaleRange: { itemKey: "scale", min: 0.3, max: 1.8 },
  rotationRange: { itemKey: "rotation", min: degreesToRadians(-35), max: degreesToRadians(35), neutral: 50 },
  tiltRange: { itemKey: "tilt", min: degreesToRadians(-45), max: degreesToRadians(45), neutral: 50 },
};

const controls = ["xRange", "yRange", "zRange", "scaleRange", "rotationRange", "tiltRange"];

init();

async function init() {
  bindEvents();
  resize();
  await loadInitialScene();
  syncControls();
  requestAnimationFrame(draw);
  if (isViewer) {
    ui.viewerStartButton?.addEventListener("click", () => startCamera());
  }
}

function bindEvents() {
  window.addEventListener("resize", resize);

  ui.tabButtons.forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tabTarget));
  });

  ui.fileInput.addEventListener("change", async (event) => {
    await addFiles([...event.target.files]);
    ui.fileInput.value = "";
  });

  ui.cameraButton.addEventListener("click", () => {
    if (state.cameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
  });

  ui.cameraSelect.addEventListener("change", () => {
    state.cameraDeviceId = ui.cameraSelect.value;
    if (state.cameraOn) startCamera();
  });

  ui.autoLayoutButton.addEventListener("click", () => {
    autoLayout();
    syncControls();
    renderLayerList();
    scheduleSaveLayout();
  });

  ui.exportButton.addEventListener("click", exportFrame);
  ui.deleteButton.addEventListener("click", deleteSelected);
  ui.saveLayoutButton?.addEventListener("click", () => saveLayoutNow());
  ui.saveAsLayoutButton?.addEventListener("click", () => saveAsLayout());
  ui.sceneSelect?.addEventListener("change", () => switchScene(ui.sceneSelect.value));
  ui.voiceButton.addEventListener("click", toggleVoiceListening);
  ui.voiceTextSendButton?.addEventListener("click", () => sendManualVoiceText());
  ui.micLevelButton?.addEventListener("click", () => toggleMicLevelMonitor());
  ui.voiceTextInput?.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      sendManualVoiceText();
    }
  });
  ui.scriptBeatSelect.addEventListener("change", () => {
    setVoiceStatus(`已切换到：${getCurrentBeat().title}`);
  });

  ui.focalRange.addEventListener("input", () => {
    state.focal = rangeToValue("focalRange", ui.focalRange.value);
    updateRangeDisplays();
    scheduleSaveLayout();
  });
  ui.parallaxRange.addEventListener("input", () => {
    state.parallax = rangeToValue("parallaxRange", ui.parallaxRange.value);
    updateRangeDisplays();
    scheduleSaveLayout();
  });
  ui.gridToggle.addEventListener("change", () => {
    state.showGrid = ui.gridToggle.checked;
    scheduleSaveLayout();
  });

  for (const id of controls) {
    ui[id].addEventListener("input", () => {
      const selected = getSelected();
      if (!selected) return;
      selected[rangeConfigs[id].itemKey] = rangeToValue(id, ui[id].value);
      updateRangeDisplays();
      renderLayerList();
      scheduleSaveLayout();
    });
  }

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    state.pointerHead.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    state.pointerHead.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

    if (!state.dragging) return;
    const selected = getSelected();
    if (!selected) return;
    canvas.classList.add("dragging");
    const projection = project(selected);
    const depthScale = Math.max(0.35, projection.scale);
    selected.x = state.dragging.startX + (event.clientX - state.dragging.clientX) / depthScale;
    selected.y = state.dragging.startY + (event.clientY - state.dragging.clientY) / depthScale;
    syncControls();
    renderLayerList();
    scheduleSaveLayout();
  });

  canvas.addEventListener("pointerdown", (event) => {
    const hit = hitTest(event);
    if (!hit) return;
    state.selectedId = hit.id;
    syncControls();
    renderLayerList();
    const selected = getSelected();
    state.dragging = {
      clientX: event.clientX,
      clientY: event.clientY,
      startX: selected.x,
      startY: selected.y,
    };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointerup", (event) => {
    state.dragging = null;
    canvas.classList.remove("dragging");
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      const selected = getSelected();
      if (!selected) return;
      event.preventDefault();
      selected.z = clamp(selected.z + event.deltaY * 0.45, -260, 980);
      syncControls();
      renderLayerList();
      scheduleSaveLayout();
    },
    { passive: false },
  );
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  state.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  state.width = Math.max(1, rect.width);
  state.height = Math.max(1, rect.height);
  canvas.width = Math.round(state.width * state.dpr);
  canvas.height = Math.round(state.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

async function addFiles(files) {
  const valid = files.filter(isSupportedMediaFile);
  let nextIndex = state.items.length;

  for (const file of valid) {
    const asset = await uploadAsset(file).catch(() => localAssetFromFile(file));

    if (isVideoAsset(asset)) {
      const item = createPendingVideoItem(asset);
      placeNewItem(item, nextIndex);
      nextIndex += 1;
      state.items.push(item);
      state.selectedId = item.id;
      hydrateVideoItem(asset, item);
      scheduleSaveLayout();
      continue;
    }

    try {
      const item = await loadImageItemFromAsset(asset);
      placeNewItem(item, nextIndex);
      nextIndex += 1;
      state.items.push(item);
      state.selectedId = item.id;
      scheduleSaveLayout();
    } catch {
      const item = createPlaceholderItem(file.name, "图片无法加载", "image");
      placeNewItem(item, nextIndex);
      nextIndex += 1;
      state.items.push(item);
      state.selectedId = item.id;
      scheduleSaveLayout();
    }
  }

  syncControls();
  renderLayerList();
}

function loadImageItemFromAsset(asset) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const mediaType = isGifAsset(asset) ? "gif" : "image";
      const item = createItem(asset.name, asset.url, image, mediaType);
      item.status = mediaType === "gif" ? "GIF" : "图片";
      item.assetKey = asset.key;
      item.assetUrl = asset.url;
      item.assetType = asset.type;
      resolve(item);
    };
    image.onerror = reject;
    image.src = asset.url;
  });
}

function createPendingVideoItem(asset) {
  const item = createPlaceholderItem(asset.name, "视频加载中", "video");
  item.src = asset.url;
  item.objectUrl = asset.url;
  item.assetKey = asset.key;
  item.assetUrl = asset.url;
  item.assetType = asset.type;
  return item;
}

function hydrateVideoItem(asset, item) {
  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.autoplay = true;
  video.preload = "auto";

  const updateLayer = () => {
    syncControls();
    renderLayerList();
  };
  const fail = (status) => {
    clearTimeout(timer);
    item.media = makePlaceholderMedia(asset.name, status);
    item.mediaType = "placeholder";
    item.status = status;
    item.thumbnail = item.media.toDataURL("image/png");
    updateLayer();
  };
  const onMetadata = () => {
    if (!video.videoWidth || !video.videoHeight) return;
    item.pendingMedia = video;
    item.status = "MOV 准备中";
    item.thumbnail = makePlaceholderMedia(asset.name, "等待视频帧").toDataURL("image/png");
    video.play().catch(() => {});
    updateLayer();
  };
  const onFrame = () => {
    if (!video.videoWidth || !video.videoHeight) return;
    clearTimeout(timer);
    item.media = video;
    item.mediaType = "video";
    item.status = asset.name.toLowerCase().endsWith(".webm") ? "WebM" : "MOV";
    item.thumbnail = makeVideoThumbnail(video);
    video.play().catch(() => {});
    updateLayer();
  };
  const onError = () => fail("视频无法解码");
  const timer = setTimeout(() => {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) fail("视频无可绘制帧");
  }, 7000);

  video.addEventListener("loadedmetadata", onMetadata);
  video.addEventListener("loadeddata", onFrame);
  video.addEventListener("canplay", onFrame);
  video.addEventListener("error", onError);
  video.src = item.objectUrl;
  video.load();

  video.addEventListener("playing", onFrame);
}

function placeNewItem(item, index) {
  const angle = index * 1.17;
  Object.assign(item, {
    x: Math.cos(angle) * 190,
    y: Math.sin(angle * 0.8) * 105,
    z: -120 + (index % 6) * 180,
    scale: 0.82 + (index % 3) * 0.12,
    rotation: degreesToRadians((index % 5 - 2) * 5),
    tilt: degreesToRadians((index % 4 - 1.5) * 11),
  });
}

function createItem(name, src, media, mediaType) {
  const maxSide = Math.max(getMediaWidth(media), getMediaHeight(media), 1);
  const base = clamp(260 / maxSide, 0.28, 1.1);
  return {
    id: makeId(),
    name,
    src,
    media,
    mediaType,
    thumbnail: src,
    status: mediaType === "video" ? "MOV" : "图片",
    assetKey: "",
    assetUrl: src,
    assetType: "",
    x: 0,
    y: 0,
    z: 0,
    scale: base,
    rotation: 0,
    tilt: 0,
    alpha: 1,
  };
}

function createPlaceholderItem(name, status, mediaType) {
  const media = makePlaceholderMedia(name, status);
  const item = createItem(name, media.toDataURL("image/png"), media, "placeholder");
  item.status = status;
  item.originalMediaType = mediaType;
  item.thumbnail = item.src;
  return item;
}

function isSupportedMediaFile(file) {
  return /image\/(png|gif)/.test(file.type) || isMovFile(file) || isWebmFile(file);
}

function isMovFile(file) {
  return file.type === "video/quicktime" || /\.mov$/i.test(file.name);
}

function isWebmFile(file) {
  return file.type === "video/webm" || /\.webm$/i.test(file.name);
}

function isVideoAsset(asset) {
  return /^video\//.test(asset.type) || /\.(mov|mp4|webm)$/i.test(asset.url);
}

function isGifAsset(asset) {
  return asset.type === "image/gif" || /\.gif$/i.test(asset.url);
}

async function uploadAsset(file) {
  const response = await fetch(`/api/assets?filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) throw new Error("asset upload failed");
  return response.json();
}

function localAssetFromFile(file) {
  return {
    key: `local/${file.name}-${Date.now()}`,
    name: file.name,
    url: URL.createObjectURL(file),
    type: file.type || (isMovFile(file) ? "video/quicktime" : "application/octet-stream"),
    size: file.size,
  };
}

function getMediaWidth(media) {
  return media.videoWidth || media.naturalWidth || media.width || 1;
}

function getMediaHeight(media) {
  return media.videoHeight || media.naturalHeight || media.height || 1;
}

function makePlaceholderMedia(name, status) {
  const buffer = document.createElement("canvas");
  buffer.width = 420;
  buffer.height = 260;
  const b = buffer.getContext("2d");
  const gradient = b.createLinearGradient(0, 0, buffer.width, buffer.height);
  gradient.addColorStop(0, "#16211f");
  gradient.addColorStop(1, "#28251b");
  b.fillStyle = gradient;
  b.fillRect(0, 0, buffer.width, buffer.height);

  b.strokeStyle = "rgba(139,215,197,0.45)";
  b.lineWidth = 3;
  b.strokeRect(14, 14, buffer.width - 28, buffer.height - 28);

  b.fillStyle = "#f3f1e8";
  b.font = "700 34px Inter, sans-serif";
  b.fillText(status, 34, 100);
  b.fillStyle = "rgba(243,241,232,0.72)";
  b.font = "600 22px Inter, sans-serif";
  b.fillText(shortenName(name), 34, 148);
  return buffer;
}

function shortenName(name) {
  return name.length > 24 ? `${name.slice(0, 21)}...` : name;
}

function makeVideoThumbnail(video) {
  if (!video.videoWidth || !video.videoHeight) return "";
  const buffer = document.createElement("canvas");
  const side = 96;
  buffer.width = side;
  buffer.height = side;
  const b = buffer.getContext("2d");
  const scale = Math.max(side / video.videoWidth, side / video.videoHeight);
  const width = video.videoWidth * scale;
  const height = video.videoHeight * scale;
  b.fillStyle = "#0b0e0d";
  b.fillRect(0, 0, side, side);
  b.drawImage(video, (side - width) / 2, (side - height) / 2, width, height);
  b.fillStyle = "rgba(0,0,0,0.52)";
  b.fillRect(0, side - 26, side, 26);
  b.fillStyle = "#ffffff";
  b.font = "700 14px Inter, sans-serif";
  b.fillText("MOV", 10, side - 9);
  return buffer.toDataURL("image/png");
}

async function loadInitialScene() {
  state.loadingScene = true;
  setLayoutStatus("正在读取布局");
  try {
    await loadSceneList();
    syncSceneControls();
    const loaded = await loadSceneById(state.currentSceneId);
    if (loaded) return;
  } catch {
    setLayoutStatus("未连接布局数据库", "warn");
  } finally {
    state.loadingScene = false;
  }

  if (!isViewer) {
    seedDemoImages();
    syncSceneControls();
    syncControls();
  } else {
    setLayoutStatus("演示页暂无保存布局", "warn");
  }
}

async function loadSceneById(sceneId) {
  state.loadingScene = true;
  const response = await fetch(`/api/layout?id=${encodeURIComponent(sceneId)}`);
  if (!response.ok) {
    state.loadingScene = false;
    return false;
  }

  const layout = await response.json();
  const hasItems = Array.isArray(layout.items) && layout.items.length > 0;
  state.currentSceneId = layout.id || sceneId;
  state.currentSceneName = layout.name || state.currentSceneId;
  state.focal = Number(layout.scene?.focal ?? state.focal);
  state.parallax = Number(layout.scene?.parallax ?? state.parallax);
  state.showGrid = layout.scene?.showGrid !== false;
  ui.focalRange.value = String(valueToRange("focalRange", state.focal));
  ui.parallaxRange.value = String(valueToRange("parallaxRange", state.parallax));
  ui.gridToggle.checked = state.showGrid;

  clearSceneMedia();
  if (hasItems) {
    await restoreLayoutItems(layout.items);
  } else {
    state.items = [];
    state.selectedId = null;
    syncControls();
    renderLayerList();
  }

  syncSceneControls();
  updateRangeDisplays();
  setLayoutStatus(hasItems ? `已切换：${state.currentSceneName}` : `空场景：${state.currentSceneName}`, hasItems ? "good" : "warn");
  state.loadingScene = false;
  return hasItems;
}

async function loadSceneList() {
  if (!ui.sceneSelect) return;
  const response = await fetch("/api/layout?list=1");
  if (!response.ok) return;
  const payload = await response.json();
  state.scenes = Array.isArray(payload.scenes) ? payload.scenes : [];
  if (!state.scenes.some((scene) => scene.id === state.currentSceneId)) {
    state.scenes.push({
      id: state.currentSceneId,
      name: state.currentSceneId === "default" ? "默认场景" : state.currentSceneId,
      updatedAt: "",
    });
  }
  renderSceneOptions();
}

function renderSceneOptions() {
  if (!ui.sceneSelect) return;
  ui.sceneSelect.innerHTML = "";
  state.scenes.forEach((scene) => {
    const option = document.createElement("option");
    option.value = scene.id;
    option.textContent = scene.name;
    ui.sceneSelect.append(option);
  });
  ui.sceneSelect.value = state.currentSceneId;
}

function syncSceneControls() {
  renderSceneOptions();
  if (ui.sceneNameInput) ui.sceneNameInput.value = state.currentSceneName;
  const demo = document.querySelector(".demo-link");
  if (demo) demo.href = `./viewer.html?scene=${encodeURIComponent(state.currentSceneId)}`;
}

async function switchScene(sceneId) {
  if (!sceneId || sceneId === state.currentSceneId) return;
  setLayoutStatus("正在切换场景");
  const loaded = await loadSceneById(sceneId);
  if (loaded || isViewer) updateSceneUrl();
}

function updateSceneUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("scene", state.currentSceneId);
  window.history.replaceState({}, "", url);
}

async function restoreLayoutItems(items) {
  clearSceneMedia();
  for (const record of items) {
    const asset = {
      key: record.assetKey,
      name: record.name,
      url: record.assetUrl || record.src,
      type: record.assetType || inferAssetType(record.assetUrl || record.src),
      size: 0,
    };
    if (!asset.url) continue;

    let item;
    if (isVideoAsset(asset)) {
      item = createPendingVideoItem(asset);
      hydrateVideoItem(asset, item);
    } else {
      item = await loadImageItemFromAsset(asset).catch(() =>
        createPlaceholderItem(asset.name, "素材无法加载", "image"),
      );
    }

    applyLayoutRecord(item, record);
    state.items.push(item);
  }
  state.selectedId = isViewer ? null : state.items[0]?.id ?? null;
  syncControls();
  renderLayerList();
}

function clearSceneMedia() {
  state.items.forEach((item) => {
    if (item.mediaType === "video") {
      item.media.pause?.();
      item.media.removeAttribute?.("src");
      item.media.load?.();
    }
  });
  state.gifElements.forEach((element) => element.remove());
  state.gifElements.clear();
  state.items = [];
  state.selectedId = null;
}

function applyLayoutRecord(item, record) {
  item.id = record.id || item.id;
  item.x = Number(record.x || 0);
  item.y = Number(record.y || 0);
  item.z = Number(record.z || 0);
  item.scale = Number(record.scale || item.scale || 1);
  item.rotation = Number(record.rotation || 0);
  item.tilt = Number(record.tilt || 0);
  item.alpha = Number(record.alpha || 1);
  item.assetKey = record.assetKey || item.assetKey;
  item.assetUrl = record.assetUrl || item.assetUrl || item.src;
  item.assetType = record.assetType || item.assetType;
}

function serializeLayout() {
  return {
    id: state.currentSceneId,
    name: ui.sceneNameInput?.value?.trim() || state.currentSceneName,
    scene: {
      focal: state.focal,
      parallax: state.parallax,
      showGrid: state.showGrid,
    },
    items: state.items
      .filter((item) => item.assetUrl || item.src)
      .map((item) => ({
        id: item.id,
        name: item.name,
        assetKey: item.assetKey,
        assetUrl: item.assetUrl || item.src,
        assetType: item.assetType || inferAssetType(item.assetUrl || item.src),
        x: item.x,
        y: item.y,
        z: item.z,
        scale: item.scale,
        rotation: item.rotation,
        tilt: item.tilt,
        alpha: item.alpha,
      })),
  };
}

function scheduleSaveLayout() {
  if (state.loadingScene || isViewer) return;
  clearTimeout(state.layoutSaveTimer);
  setLayoutStatus("有更改，准备自动保存", "warn");
  state.layoutSaveTimer = setTimeout(() => saveLayoutNow(), 650);
}

async function saveLayoutNow() {
  if (isViewer) return;
  try {
    const sceneName = ui.sceneNameInput?.value?.trim() || state.currentSceneName;
    const response = await fetch("/api/layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...serializeLayout(), id: state.currentSceneId, name: sceneName }),
    });
    if (!response.ok) throw new Error("save failed");
    const result = await response.json();
    state.currentSceneId = result.id || state.currentSceneId;
    state.currentSceneName = result.name || sceneName;
    await loadSceneList();
    syncSceneControls();
    setLayoutStatus(`已保存：${state.currentSceneName}`, "good");
  } catch {
    setLayoutStatus("布局保存失败，请确认使用 node server.js 启动", "warn");
  }
}

async function saveAsLayout() {
  if (isViewer) return;
  const name = window.prompt("请输入新场景名称", `${ui.sceneNameInput?.value || "新场景"} 副本`);
  if (!name) return;
  state.currentSceneId = makeSceneId(name);
  state.currentSceneName = name.trim();
  if (ui.sceneNameInput) ui.sceneNameInput.value = state.currentSceneName;
  await saveLayoutNow();
}

function makeSceneId(name) {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "scene";
  return `${base}-${Date.now().toString(36)}`;
}

function setLayoutStatus(message, tone = "") {
  if (!ui.layoutStatus) return;
  ui.layoutStatus.textContent = message;
  ui.layoutStatus.classList.toggle("good", tone === "good");
  ui.layoutStatus.classList.toggle("warn", tone === "warn");
}

function inferAssetType(url = "") {
  if (/\.gif$/i.test(url)) return "image/gif";
  if (/\.png$/i.test(url)) return "image/png";
  if (/\.mov$/i.test(url)) return "video/quicktime";
  if (/\.webm$/i.test(url)) return "video/webm";
  if (/\.mp4$/i.test(url)) return "video/mp4";
  return "application/octet-stream";
}

function seedDemoImages() {
  const demos = [
    { name: "入口层.png", colors: ["#243b38", "#8bd7c5", "#f4efe0"], mark: "A" },
    { name: "中景层.png", colors: ["#3b2931", "#e2b866", "#f1b6a5"], mark: "B" },
    { name: "远景层.png", colors: ["#1f2e43", "#7eb3e8", "#f0f3ff"], mark: "C" },
    { name: "焦点层.png", colors: ["#312a1d", "#d9d36d", "#a7d68b"], mark: "D" },
  ];

  demos.forEach((demo, index) => {
    const image = new Image();
    image.onload = () => {
      const item = createItem(demo.name, image.src, image, "image");
      item.x = [-230, 70, 250, -20][index];
      item.y = [105, -72, 82, -8][index];
      item.z = [-180, 100, 480, 260][index];
      item.scale = [0.88, 0.72, 0.66, 0.78][index];
      item.rotation = degreesToRadians([-8, 5, -4, 2][index]);
      item.tilt = degreesToRadians([-18, 8, 22, -6][index]);
      state.items.push(item);
      state.selectedId = state.items[0]?.id ?? item.id;
      syncControls();
      renderLayerList();
    };
    image.src = makeDemoTexture(demo.colors, demo.mark);
  });
}

function makeDemoTexture(colors, mark) {
  const buffer = document.createElement("canvas");
  buffer.width = 520;
  buffer.height = 360;
  const b = buffer.getContext("2d");
  const gradient = b.createLinearGradient(0, 0, 520, 360);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.55, colors[1]);
  gradient.addColorStop(1, colors[2]);
  b.fillStyle = gradient;
  b.fillRect(0, 0, 520, 360);

  b.globalAlpha = 0.22;
  b.strokeStyle = "#ffffff";
  b.lineWidth = 2;
  for (let x = -120; x < 620; x += 44) {
    b.beginPath();
    b.moveTo(x, 0);
    b.lineTo(x + 190, 360);
    b.stroke();
  }
  for (let y = 28; y < 360; y += 54) {
    b.beginPath();
    b.moveTo(0, y);
    b.lineTo(520, y + 18);
    b.stroke();
  }

  b.globalAlpha = 1;
  b.fillStyle = "rgba(0,0,0,0.23)";
  b.fillRect(32, 232, 456, 70);
  b.fillStyle = "#ffffff";
  b.font = "700 74px Inter, sans-serif";
  b.fillText(mark, 42, 104);
  b.font = "600 30px Inter, sans-serif";
  b.fillText("PNG / GIF", 54, 276);
  return buffer.toDataURL("image/png");
}

function draw() {
  updateHead();
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  drawBackdrop();
  if (state.showGrid) drawPerspectiveGrid();
  drawItems();
  updateGifOverlays();
  drawReticle();
  requestAnimationFrame(draw);
}

function updateHead() {
  const source = state.cameraOn ? state.trackedHead : state.pointerHead;
  state.currentHead.x += (source.x - state.currentHead.x) * 0.12;
  state.currentHead.y += (source.y - state.currentHead.y) * 0.12;
  state.currentHead.z += (source.z - state.currentHead.z) * 0.1;
}

function drawBackdrop() {
  const { width, height } = state;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#171b18");
  gradient.addColorStop(0.52, "#101719");
  gradient.addColorStop(1, "#1b1711");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let i = 0; i < 90; i += 1) {
    const x = (i * 137.5) % width;
    const y = (i * 61.7) % height;
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawPerspectiveGrid() {
  const vanishing = getVanishingPoint();
  const floorY = state.height * 0.72 - state.currentHead.y * 24;
  const horizonY = vanishing.y;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(139,215,197,0.16)";
  for (let i = -9; i <= 9; i += 1) {
    const baseX = state.width / 2 + i * Math.max(54, state.width / 16);
    ctx.beginPath();
    ctx.moveTo(baseX, state.height);
    ctx.lineTo(vanishing.x, horizonY);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(226,184,102,0.17)";
  for (let depth = 0; depth < 11; depth += 1) {
    const t = depth / 10;
    const y = floorY + (state.height - floorY) * (1 - Math.pow(t, 1.75));
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(state.width, horizonY);
  ctx.stroke();

  ctx.fillStyle = "rgba(139,215,197,0.75)";
  ctx.beginPath();
  ctx.arc(vanishing.x, vanishing.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawItems() {
  const sorted = [...state.items].sort((a, b) => b.z - a.z);
  for (const item of sorted) drawItem(item);
}

function drawItem(item) {
  if (item.mediaType === "gif") {
    const projection = project(item);
    const w = getMediaWidth(item.media) * item.scale * projection.scale;
    const h = getMediaHeight(item.media) * item.scale * projection.scale;
    if (item.id === state.selectedId && !isViewer) drawSelection(projection, w, h, item.rotation);
    return;
  }
  if (item.mediaType === "video" && item.media.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }
  const projection = project(item);
  const w = getMediaWidth(item.media) * item.scale * projection.scale;
  const h = getMediaHeight(item.media) * item.scale * projection.scale;
  const selected = item.id === state.selectedId;
  const yaw = item.tilt + state.currentHead.x * 0.18 - item.x * 0.00018;
  const squash = clamp(Math.cos(yaw), 0.45, 1);
  const skew = Math.sin(yaw) * 0.16;

  ctx.save();
  ctx.translate(projection.x, projection.y);
  ctx.rotate(item.rotation + state.currentHead.x * 0.035);
  ctx.transform(squash, 0, skew, 1, 0, 0);

  ctx.globalAlpha = item.alpha;
  roundRectPath(-w / 2, -h / 2, w, h, 7);
  ctx.clip();
  ctx.shadowColor = "rgba(0,0,0,0.38)";
  ctx.shadowBlur = clamp(24 * projection.scale, 8, 34);
  ctx.shadowOffsetY = clamp(14 * projection.scale, 4, 22);
  ctx.drawImage(item.media, -w / 2, -h / 2, w, h);
  ctx.shadowColor = "transparent";
  ctx.globalAlpha = 1;
  ctx.restore();

  if (selected && !isViewer) drawSelection(projection, w, h, item.rotation);
}

function drawSelection(projection, w, h, rotation) {
  ctx.save();
  ctx.translate(projection.x, projection.y);
  ctx.rotate(rotation);
  ctx.strokeStyle = "rgba(139,215,197,0.9)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  roundRectPath(-w / 2 - 9, -h / 2 - 9, w + 18, h + 18, 8);
  ctx.stroke();
  ctx.restore();
}

function updateGifOverlays() {
  if (!ui.mediaOverlay) return;
  const visibleGifIds = new Set();
  const sorted = [...state.items].sort((a, b) => b.z - a.z);

  sorted.forEach((item, index) => {
    if (item.mediaType !== "gif") return;
    visibleGifIds.add(item.id);
    let element = state.gifElements.get(item.id);
    if (!element) {
      element = document.createElement("img");
      element.className = "gif-layer";
      element.alt = "";
      element.src = item.assetUrl || item.src;
      ui.mediaOverlay.append(element);
      state.gifElements.set(item.id, element);
    }

    const projection = project(item);
    const width = getMediaWidth(item.media) * item.scale * projection.scale;
    const height = getMediaHeight(item.media) * item.scale * projection.scale;
    const yaw = item.tilt + state.currentHead.x * 0.18 - item.x * 0.00018;
    const squash = clamp(Math.cos(yaw), 0.45, 1);
    const skew = Math.sin(yaw) * 0.16;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.transform = `translate(${projection.x - width / 2}px, ${projection.y - height / 2}px) rotate(${item.rotation + state.currentHead.x * 0.035}rad) matrix(${squash}, 0, ${skew}, 1, 0, 0)`;
    element.style.zIndex = String(1000 + index);
    element.style.opacity = String(item.alpha);
    element.style.outline =
      item.id === state.selectedId && !isViewer ? "2px dashed rgba(139,215,197,0.9)" : "0";
  });

  for (const [id, element] of state.gifElements) {
    if (visibleGifIds.has(id)) continue;
    element.remove();
    state.gifElements.delete(id);
  }
}

function drawReticle() {
  const vanishing = getVanishingPoint();
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(vanishing.x - 16, vanishing.y);
  ctx.lineTo(vanishing.x + 16, vanishing.y);
  ctx.moveTo(vanishing.x, vanishing.y - 16);
  ctx.lineTo(vanishing.x, vanishing.y + 16);
  ctx.stroke();
  ctx.restore();
}

function project(item) {
  const head = state.currentHead;
  const cameraX = head.x * state.parallax * 1.9;
  const cameraY = head.y * state.parallax * 1.05;
  const cameraZ = head.z * 120;
  const depth = state.focal + item.z - cameraZ;
  const scale = clamp(state.focal / Math.max(220, depth), 0.28, 2.2);
  const vanish = getVanishingPoint();
  return {
    x: vanish.x + (item.x - cameraX) * scale,
    y: vanish.y + (item.y - cameraY) * scale,
    scale,
  };
}

function getVanishingPoint() {
  return {
    x: state.width / 2 - state.currentHead.x * state.parallax * 1.25,
    y: state.height * 0.46 - state.currentHead.y * state.parallax * 0.72,
  };
}

function hitTest(event) {
  const rect = canvas.getBoundingClientRect();
  const point = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  const nearFirst = [...state.items].sort((a, b) => a.z - b.z);
  for (const item of nearFirst) {
    const projection = project(item);
    const w = getMediaWidth(item.media) * item.scale * projection.scale;
    const h = getMediaHeight(item.media) * item.scale * projection.scale;
    const dx = point.x - projection.x;
    const dy = point.y - projection.y;
    const angle = -item.rotation;
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
    if (Math.abs(localX) <= w / 2 && Math.abs(localY) <= h / 2) return item;
  }
  return null;
}

function renderLayerList() {
  ui.layerList.innerHTML = "";
  const nearFirst = [...state.items].sort((a, b) => a.z - b.z);
  for (const item of nearFirst) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `layer-item${item.id === state.selectedId ? " selected" : ""}`;
    button.innerHTML = `
      <span class="layer-thumb" style="background-image:url('${item.thumbnail}')"></span>
      <span class="layer-copy">
        <span class="layer-name">${escapeHTML(item.name)}</span>
        <span class="layer-status">${escapeHTML(item.status || item.mediaType)}</span>
      </span>
      <span class="layer-depth">${Math.round(item.z)}</span>
    `;
    button.addEventListener("click", () => {
      state.selectedId = item.id;
      syncControls();
      renderLayerList();
    });
    ui.layerList.append(button);
  }
}

function syncControls() {
  const selected = getSelected();
  const disabled = !selected;
  for (const id of controls) ui[id].disabled = disabled;
  ui.deleteButton.disabled = disabled;
  ui.focalRange.value = String(valueToRange("focalRange", state.focal));
  ui.parallaxRange.value = String(valueToRange("parallaxRange", state.parallax));
  if (!selected) {
    for (const id of controls) {
      ui[id].value = String(rangeConfigs[id].neutral ?? 50);
    }
    updateRangeDisplays();
    return;
  }
  for (const id of controls) {
    ui[id].value = String(valueToRange(id, selected[rangeConfigs[id].itemKey]));
  }
  updateRangeDisplays();
}

function rangeToValue(id, rangeValue) {
  const config = rangeConfigs[id];
  const percent = clamp(Number(rangeValue), 0, 100) / 100;
  return config.min + (config.max - config.min) * percent;
}

function valueToRange(id, value) {
  const config = rangeConfigs[id];
  const percent = ((Number(value) - config.min) / (config.max - config.min)) * 100;
  return Math.round(clamp(percent, 0, 100));
}

function updateRangeDisplays() {
  for (const id of Object.keys(ui.values)) {
    if (!ui.values[id] || !ui[id]) continue;
    ui.values[id].textContent = String(Math.round(Number(ui[id].value)));
  }
}

function autoLayout() {
  const count = Math.max(1, state.items.length);
  state.items.forEach((item, index) => {
    const layer = index / Math.max(1, count - 1);
    const angle = index * 1.83;
    item.x = Math.cos(angle) * (160 + layer * 210);
    item.y = Math.sin(angle * 1.2) * 130 - 34 + layer * 55;
    item.z = -220 + layer * 880;
    item.scale = clamp(0.96 - layer * 0.28, 0.48, 1.05);
    item.rotation = degreesToRadians(Math.sin(angle) * 12);
    item.tilt = degreesToRadians(Math.cos(angle * 0.7) * 24);
  });
  scheduleSaveLayout();
}

function deleteSelected() {
  const selected = getSelected();
  if (!selected) return;
  state.items = state.items.filter((item) => item.id !== selected.id);
  state.gifElements.get(selected.id)?.remove();
  state.gifElements.delete(selected.id);
  state.selectedId = state.items[0]?.id ?? null;
  syncControls();
  renderLayerList();
  scheduleSaveLayout();
}

function exportFrame() {
  const link = document.createElement("a");
  link.download = `canvas-3d-collage-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function startCamera() {
  try {
    stopCamera({ silent: true });
    state.cameraOn = true;
    ui.cameraButton.classList.add("active");
    ui.cameraButton.textContent = "关闭摄像头跟随";
    ui.trackingState.textContent = "正在请求摄像头";
    ui.trackingMeta.textContent = "请在浏览器权限窗口中允许摄像头";

    assertCameraSupport();
    const devices = await refreshCameraDevices();
    const stream = await requestCameraStream(state.cameraDeviceId);
    ui.cameraPreview.srcObject = stream;
    await waitForVideoReady(ui.cameraPreview);

    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== "live") {
      throw new Error("浏览器没有返回可用的视频轨道");
    }

    bindTrackState(track);
    await refreshCameraDevices(track.getSettings?.().deviceId);
    startCameraHealthMonitor(track);
    ui.trackingState.textContent = "摄像头已打开";
    ui.trackingMeta.textContent = describeCameraTrack(track, devices);

    createTracker()
      .then((tracker) => {
        if (!state.cameraOn) {
          tracker.close?.();
          return;
        }
        state.tracker = tracker;
        ui.trackingState.textContent = "眼部追踪已就绪";
        ui.trackingMeta.textContent = tracker.name;
        requestAnimationFrame(trackCameraFrame);
      })
      .catch((error) => {
        if (!state.cameraOn) return;
        state.tracker = createNoopTracker(error);
        ui.trackingState.textContent = "摄像头已打开";
        ui.trackingMeta.textContent = "眼部追踪模型未加载，画布仍可手动编辑";
      });
  } catch (error) {
    state.cameraOn = false;
    ui.cameraButton.classList.remove("active");
    ui.cameraButton.textContent = "开启摄像头跟随";
    ui.trackingState.textContent = "摄像头未启用";
    ui.trackingMeta.textContent = explainCameraError(error);
    stopCamera({ silent: true });
  }
}

function stopCamera(options = {}) {
  state.cameraOn = false;
  if (!options.silent) {
    ui.cameraButton.classList.remove("active");
    ui.cameraButton.textContent = "开启摄像头跟随";
    ui.trackingState.textContent = "未连接摄像头";
    ui.trackingMeta.textContent = "等待视觉输入";
  }
  const stream = ui.cameraPreview.srcObject;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  clearInterval(state.cameraHealthTimer);
  state.cameraHealthTimer = null;
  state.blackFrameCount = 0;
  ui.cameraPreview.srcObject = null;
  ui.cameraPreview.removeAttribute("src");
  ui.cameraPreview.load();
  state.tracker?.close?.();
  state.tracker = null;
  state.trackedHead = { x: 0, y: 0, z: 0 };
  setCameraDiagnostics("尚未检测视频帧");
}

async function createTracker() {
  const mediapipe = await withTimeout(createMediaPipeTracker(), 9000).catch(() => null);
  if (mediapipe) return mediapipe;

  if ("FaceDetector" in window) {
    const detector = new window.FaceDetector({
      fastMode: true,
      maxDetectedFaces: 1,
    });
    return {
      name: "浏览器人脸检测",
      async detect(video) {
        const [face] = await detector.detect(video);
        if (!face) return null;
        const box = face.boundingBox;
        return {
          x: clamp(1 - ((box.x + box.width / 2) / video.videoWidth) * 2, -1, 1),
          y: clamp(((box.y + box.height * 0.38) / video.videoHeight - 0.5) * 2, -1, 1),
          z: clamp((170 - box.width) / 170, -0.8, 0.8),
        };
      },
    };
  }

  return {
    name: "摄像头已开，当前浏览器无关键点检测",
    async detect() {
      return null;
    },
  };
}

function assertCameraSupport() {
  if (!window.isSecureContext) {
    throw new Error("摄像头需要通过 http://127.0.0.1 或 https 页面打开");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("当前浏览器不支持摄像头 API");
  }
}

async function refreshCameraDevices(selectedDeviceId = state.cameraDeviceId) {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    renderCameraOptions(cameras, selectedDeviceId);
    return cameras;
  } catch {
    return [];
  }
}

function renderCameraOptions(cameras, selectedDeviceId) {
  const current = selectedDeviceId || state.cameraDeviceId || "";
  ui.cameraSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "默认摄像头";
  ui.cameraSelect.append(defaultOption);

  cameras.forEach((camera, index) => {
    const option = document.createElement("option");
    option.value = camera.deviceId;
    option.textContent = camera.label || `摄像头 ${index + 1}`;
    ui.cameraSelect.append(option);
  });

  if ([...ui.cameraSelect.options].some((option) => option.value === current)) {
    ui.cameraSelect.value = current;
  }
  state.cameraDeviceId = ui.cameraSelect.value;
}

async function requestCameraStream(deviceId = "") {
  const preferred = {
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "user" } }),
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, max: 60 },
    },
    audio: false,
  };

  try {
    return await navigator.mediaDevices.getUserMedia(preferred);
  } catch (error) {
    if (error.name === "OverconstrainedError" || error.name === "ConstraintNotSatisfiedError") {
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    throw error;
  }
}

function waitForVideoReady(video) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("playing", onReady);
      video.removeEventListener("error", onError);
    };
    const onReady = async () => {
      try {
        if (video.paused) await video.play();
        if (video.videoWidth > 0 && video.videoHeight > 0) done();
      } catch (error) {
        fail(error);
      }
    };
    const onError = () => fail(new Error("视频预览元素无法播放摄像头画面"));
    const timer = setTimeout(() => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        done();
      } else {
        fail(new Error("摄像头已授权，但浏览器没有收到视频画面"));
      }
    }, 6500);

    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("canplay", onReady);
    video.addEventListener("playing", onReady);
    video.addEventListener("error", onError);
    onReady();
  });
}

function bindTrackState(track) {
  track.onmute = () => {
    if (!state.cameraOn) return;
    ui.trackingState.textContent = "摄像头暂时无画面";
    ui.trackingMeta.textContent = "请检查是否被其他应用占用或系统隐私设置拦截";
  };
  track.onunmute = () => {
    if (!state.cameraOn) return;
    ui.trackingState.textContent = "摄像头已打开";
    ui.trackingMeta.textContent = describeCameraTrack(track, []);
  };
  track.onended = () => {
    if (!state.cameraOn) return;
    stopCamera({ silent: true });
    ui.cameraButton.classList.remove("active");
    ui.cameraButton.textContent = "开启摄像头跟随";
    ui.trackingState.textContent = "摄像头已断开";
    ui.trackingMeta.textContent = "视频轨道已结束，请重新开启摄像头";
  };
}

function describeCameraTrack(track, devices) {
  const settings = track.getSettings?.() ?? {};
  const label = track.label || devices[0]?.label || "默认摄像头";
  const size =
    settings.width && settings.height ? `${settings.width} × ${settings.height}` : "等待分辨率";
  return `${label} · ${size} · ${track.readyState}`;
}

function startCameraHealthMonitor(track) {
  clearInterval(state.cameraHealthTimer);
  state.blackFrameCount = 0;
  const probe = document.createElement("canvas");
  probe.width = 48;
  probe.height = 36;
  const probeCtx = probe.getContext("2d", { willReadFrequently: true });

  state.cameraHealthTimer = setInterval(() => {
    if (!state.cameraOn || track.readyState !== "live") return;
    const video = ui.cameraPreview;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
      setCameraDiagnostics("没有收到视频帧", "warn");
      return;
    }

    probeCtx.drawImage(video, 0, 0, probe.width, probe.height);
    const frame = probeCtx.getImageData(0, 0, probe.width, probe.height).data;
    let brightness = 0;
    let variance = 0;
    const samples = frame.length / 4;
    for (let index = 0; index < frame.length; index += 4) {
      const value = (frame[index] + frame[index + 1] + frame[index + 2]) / 3;
      brightness += value;
      variance += value * value;
    }
    brightness /= samples;
    variance = variance / samples - brightness * brightness;

    const blackFrame = brightness < 4 && variance < 5;
    state.blackFrameCount = blackFrame ? state.blackFrameCount + 1 : 0;

    if (state.blackFrameCount >= 4) {
      setCameraDiagnostics("收到的是黑帧：请换一个摄像头，或检查 Windows 隐私/占用", "warn");
      return;
    }

    setCameraDiagnostics(
      `视频帧正常 · ${video.videoWidth} × ${video.videoHeight} · 亮度 ${brightness.toFixed(0)}`,
      "good",
    );
  }, 900);
}

function setCameraDiagnostics(message, tone = "") {
  ui.cameraDiagnostics.textContent = message;
  ui.cameraDiagnostics.classList.toggle("good", tone === "good");
  ui.cameraDiagnostics.classList.toggle("warn", tone === "warn");
}

function explainCameraError(error) {
  if (error.name === "NotAllowedError") return "浏览器或系统拒绝了摄像头权限";
  if (error.name === "NotFoundError") return "没有检测到可用摄像头";
  if (error.name === "NotReadableError") return "摄像头可能正被其他应用占用";
  if (error.name === "AbortError") return "摄像头启动被系统中断，请重试";
  return error.message || "浏览器阻止了摄像头访问";
}

function createNoopTracker(error) {
  return {
    name: error?.message || "无关键点检测",
    async detect() {
      return null;
    },
  };
}

function withTimeout(promise, timeout) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("追踪模型加载超时")), timeout);
    }),
  ]);
}

async function createMediaPipeTracker() {
  const version = "0.10.35";
  const visionModule = await import(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${version}/+esm`
  );
  const { FaceLandmarker, FilesetResolver } = visionModule;
  const fileset = await FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${version}/wasm`,
  );
  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
  });

  return {
    name: "MediaPipe 眼部关键点跟随",
    detect(video) {
      const result = landmarker.detectForVideo(video, performance.now());
      const face = result.faceLandmarks?.[0];
      if (!face) return null;
      const leftEye = midpoint(face[33], face[133]);
      const rightEye = midpoint(face[362], face[263]);
      const eyeCenter = midpoint(leftEye, rightEye);
      const eyeDistance = distance(leftEye, rightEye);
      return {
        x: clamp(1 - eyeCenter.x * 2, -1, 1),
        y: clamp((eyeCenter.y - 0.5) * 2, -1, 1),
        z: clamp((0.18 - eyeDistance) / 0.11, -0.9, 0.9),
      };
    },
    close() {
      landmarker.close();
    },
  };
}

async function trackCameraFrame() {
  if (!state.cameraOn || !state.tracker) return;
  try {
    const detected = await state.tracker.detect(ui.cameraPreview);
    if (detected) {
      state.trackedHead.x += (detected.x - state.trackedHead.x) * 0.36;
      state.trackedHead.y += (detected.y - state.trackedHead.y) * 0.36;
      state.trackedHead.z += (detected.z - state.trackedHead.z) * 0.28;
      ui.trackingState.textContent = "正在跟随眼睛位置";
      ui.trackingMeta.textContent = `x ${state.trackedHead.x.toFixed(2)} · y ${state.trackedHead.y.toFixed(2)}`;
    } else if (state.tracker.name.includes("无关键点")) {
      ui.trackingState.textContent = "摄像头已连接";
      ui.trackingMeta.textContent = "当前浏览器不支持眼部检测";
    } else {
      ui.trackingState.textContent = "寻找眼睛位置";
      ui.trackingMeta.textContent = state.tracker.name;
    }
  } catch (error) {
    ui.trackingState.textContent = "追踪暂停";
    ui.trackingMeta.textContent = error.message || "检测器暂时不可用";
  }
  requestAnimationFrame(trackCameraFrame);
}

function activateTab(targetId) {
  if (!targetId) return;
  ui.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tabTarget === targetId);
  });
  ui.tabPages.forEach((page) => {
    page.classList.toggle("active", page.id === targetId);
  });
  resize();
}

function sendManualVoiceText() {
  const text = ui.voiceTextInput?.value.trim() ?? "";
  if (!text || state.voice.busy) return;
  ui.voiceTranscript.textContent = text;
  handleAudienceSpeech(text);
}

async function toggleMicLevelMonitor() {
  if (state.voice.micMonitoring) {
    stopMicLevelMonitor();
    return;
  }
  await startMicLevelMonitor();
}

async function startMicLevelMonitor() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicLevelStatus("当前浏览器不支持麦克风检测");
      return;
    }

    if (state.voice.micMonitoring) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.55;
    audioContext.createMediaStreamSource(stream).connect(analyser);

    state.voice.micStream = stream;
    state.voice.micAudioContext = audioContext;
    state.voice.micAnalyser = analyser;
    state.voice.micMonitoring = true;
    ui.micLevelButton.textContent = "停止检测";
    setMicLevelStatus("麦克风已连接，请说话测试电平");
    updateMicLevel();
  } catch (error) {
    setMicLevelStatus(describeMicError(error));
  }
}

function stopMicLevelMonitor() {
  cancelAnimationFrame(state.voice.micLevelTimer);
  state.voice.micLevelTimer = null;
  state.voice.micStream?.getTracks().forEach((track) => track.stop());
  state.voice.micAudioContext?.close?.();
  state.voice.micStream = null;
  state.voice.micAudioContext = null;
  state.voice.micAnalyser = null;
  state.voice.micMonitoring = false;
  if (ui.micLevelButton) ui.micLevelButton.textContent = "检测麦克风";
  if (ui.micLevelBar) ui.micLevelBar.style.width = "0%";
  setMicLevelStatus("麦克风电平未检测");
}

function updateMicLevel() {
  const analyser = state.voice.micAnalyser;
  if (!analyser || !state.voice.micMonitoring) return;

  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);
  let sum = 0;
  let peak = 0;
  for (const value of samples) {
    const centered = (value - 128) / 128;
    sum += centered * centered;
    peak = Math.max(peak, Math.abs(centered));
  }
  const rms = Math.sqrt(sum / samples.length);
  const level = Math.min(100, Math.max(rms * 420, peak * 120));
  if (ui.micLevelBar) ui.micLevelBar.style.width = `${level.toFixed(0)}%`;
  setMicLevelStatus(level > 4 ? `检测到声音：${level.toFixed(0)}%` : "麦克风已连接，但当前几乎没有声音");
  state.voice.micLevelTimer = requestAnimationFrame(updateMicLevel);
}

function setMicLevelStatus(message) {
  if (ui.micLevelStatus) ui.micLevelStatus.textContent = message;
}

function describeMicError(error) {
  if (error.name === "NotAllowedError") return "麦克风权限被拒绝，请检查浏览器或系统权限";
  if (error.name === "NotFoundError") return "没有检测到可用麦克风";
  if (error.name === "NotReadableError") return "麦克风可能正被其他应用占用";
  return error.message || "麦克风检测失败";
}

function toggleVoiceListening() {
  if (state.voice.busy) return;
  const recognition = getSpeechRecognition();
  if (!recognition) {
    setVoiceStatus("当前浏览器不支持语音识别，请使用 Chrome 或 Edge。", "error");
    return;
  }

  if (state.voice.listening) {
    state.voice.manualStop = true;
    clearTimeout(state.voice.listenStopTimer);
    state.voice.listenStopTimer = null;
    recognition.stop();
    return;
  }

  try {
    state.voice.listening = true;
    state.voice.manualStop = false;
    state.voice.restartingRecognition = false;
    state.voice.transcriptBuffer = "";
    state.voice.interimTranscript = "";
    state.voice.listenStartedAt = Date.now();
    ui.voiceButton.classList.add("active");
    ui.voiceButton.textContent = "停止聆听";
    ui.voiceTranscript.textContent = "正在听，请说话。至少会听 10 秒。";
    setVoiceStatus("正在聆听观众说话", "listening");
    startMicLevelMonitor();
    clearTimeout(state.voice.listenStopTimer);
    state.voice.listenStopTimer = setTimeout(() => {
      if (!state.voice.listening || state.voice.manualStop) return;
      recognition.stop();
    }, state.voice.minListenMs);
    recognition.start();
  } catch (error) {
    state.voice.listening = false;
    ui.voiceButton.classList.remove("active");
    ui.voiceButton.textContent = "开始对话";
    setVoiceStatus(error.message || "语音识别启动失败", "error");
  }
}

function getSpeechRecognition() {
  if (state.voice.recognition) return state.voice.recognition;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.addEventListener("result", (event) => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0]?.transcript ?? "";
      if (event.results[index].isFinal) {
        state.voice.transcriptBuffer = `${state.voice.transcriptBuffer} ${transcript}`.trim();
      } else {
        interim = `${interim} ${transcript}`.trim();
      }
    }
    state.voice.interimTranscript = interim;
    const displayText = [state.voice.transcriptBuffer, state.voice.interimTranscript]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (displayText) ui.voiceTranscript.textContent = displayText;
  });

  recognition.addEventListener("audiostart", () => {
    setVoiceStatus("浏览器已开始接收麦克风音频", "listening");
  });

  recognition.addEventListener("soundstart", () => {
    setVoiceStatus("检测到声音，正在识别文字", "listening");
  });

  recognition.addEventListener("speechstart", () => {
    setVoiceStatus("检测到语音，正在转文字", "listening");
  });

  recognition.addEventListener("nomatch", () => {
    setVoiceStatus("听到了声音，但没有识别出文字。请靠近麦克风再试。", "error");
  });

  recognition.addEventListener("end", () => {
    const elapsed = Date.now() - state.voice.listenStartedAt;
    if (state.voice.listening && !state.voice.manualStop && elapsed < state.voice.minListenMs) {
      state.voice.restartingRecognition = true;
      setVoiceStatus("识别暂停，继续聆听到 10 秒", "listening");
      setTimeout(() => {
        try {
          if (state.voice.listening && !state.voice.manualStop) recognition.start();
        } catch {}
      }, 180);
      return;
    }
    finalizeVoiceListening();
  });

  recognition.addEventListener("error", (event) => {
    if (state.voice.listening && event.error === "no-speech") return;
    state.voice.manualStop = true;
    clearTimeout(state.voice.listenStopTimer);
    state.voice.listenStopTimer = null;
    state.voice.listening = false;
    ui.voiceButton.classList.remove("active");
    ui.voiceButton.textContent = "开始对话";
    setVoiceStatus(describeSpeechError(event.error), "error");
  });

  state.voice.recognition = recognition;
  return recognition;
}

function finalizeVoiceListening() {
  clearTimeout(state.voice.listenStopTimer);
  state.voice.listenStopTimer = null;
  state.voice.listening = false;
  state.voice.manualStop = false;
  state.voice.restartingRecognition = false;
  ui.voiceButton.classList.remove("active");
  ui.voiceButton.textContent = "开始对话";

  const finalText = [state.voice.transcriptBuffer, state.voice.interimTranscript]
    .filter(Boolean)
    .join(" ")
    .trim();
  state.voice.transcriptBuffer = "";
  state.voice.interimTranscript = "";

  if (finalText) {
    ui.voiceTranscript.textContent = finalText;
    handleAudienceSpeech(finalText);
    return;
  }

  if (!state.voice.busy) {
    ui.voiceTranscript.textContent = "没有识别到文字。电平条有动作的话，请再靠近麦克风说一遍。";
    setVoiceStatus("没有识别到文字", "error");
  }
}

async function handleAudienceSpeech(text) {
  if (state.voice.busy) return;
  state.voice.busy = true;
  state.voice.listening = false;
  ui.voiceButton.classList.remove("active");
  ui.voiceButton.textContent = "生成中";
  setVoiceStatus("正在根据剧本走向生成回应", "thinking");

  try {
    const cue = await getDirectorCue(text);
    applyDirectorCue(cue);
    const reply = cue.reply || "我听见了。画面会跟着你的选择继续向前。";
    ui.voiceReply.textContent = reply;
    updateCaption(reply);
    speakReply(reply);
    state.voice.conversation.push({ role: "user", content: text }, { role: "assistant", content: reply });
    state.voice.conversation = state.voice.conversation.slice(-10);
    setVoiceStatus(`已回应：${getCurrentBeat().title}`);
  } catch (error) {
    const fallback = makeLocalDirectorCue(text);
    applyDirectorCue(fallback);
    ui.voiceReply.textContent = fallback.reply;
    updateCaption(fallback.reply);
    speakReply(fallback.reply);
    setVoiceStatus(error.message || "Kimi 暂不可用，已使用本地剧本回应", "error");
  } finally {
    state.voice.busy = false;
    ui.voiceButton.textContent = "开始对话";
    if (ui.voiceTextInput) ui.voiceTextInput.value = "";
  }
}

async function getDirectorCue(text) {
  const response = await fetch(state.voice.directorEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      beatKey: ui.scriptBeatSelect.value,
      conversation: state.voice.conversation.slice(-6),
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.message || payload.error || response.statusText;
    throw new Error(`Kimi 请求失败：${response.status} ${message}`);
  }

  const payload = await response.json();
  renderKimiDebug(payload.debug);
  if (payload.cue) return payload.cue;
  const content = payload.choices?.[0]?.message?.content ?? "";
  return parseDirectorCue(content) ?? makeLocalDirectorCue(text);
}

function renderKimiDebug(debug) {
  if (!debug) {
    if (ui.kimiResponseDebug) ui.kimiResponseDebug.textContent = "后端没有返回 debug 字段。";
    return;
  }
  if (ui.kimiRequestDebug) {
    ui.kimiRequestDebug.textContent = JSON.stringify(debug.request ?? {}, null, 2);
  }
  if (ui.kimiResponseDebug) {
    ui.kimiResponseDebug.textContent = JSON.stringify(
      {
        rawContent: debug.rawContent,
        extractedReply: debug.extractedReply,
        response: debug.response,
      },
      null,
      2,
    );
  }
}

function parseDirectorCue(content) {
  const jsonText = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
  try {
    const cue = JSON.parse(jsonText);
    if (!cue || typeof cue !== "object") return null;
    return cue;
  } catch {
    return null;
  }
}

function makeLocalDirectorCue(text) {
  const beat = getCurrentBeat();
  const wantsNear = /近|靠近|前|清楚|放大|看/.test(text);
  const wantsHidden = /暗|隐藏|秘密|线索|背后/.test(text);
  const wantsFar = /远|后|全景|整体/.test(text);
  return {
    reply: wantsHidden
      ? "我会把线索压暗一点，让真正重要的东西从深处浮出来。"
      : wantsNear
        ? "好，画面会向你靠近。请继续说出你想追问的那一层。"
        : wantsFar
          ? "我会把空间拉开，让你先看到这段故事的全貌。"
          : "我听见了。这个选择会改变接下来的空间重心。",
    nextBeat: beat.next,
    stage: {
      focus: wantsNear ? "near" : wantsFar ? "far" : "selected",
      mood: wantsHidden ? "hidden" : "calm",
      layout: /重新|展开|布局|散开/.test(text),
      grid: !wantsHidden,
    },
  };
}

function applyDirectorCue(cue) {
  const stage = cue.stage ?? {};
  const focus = stage.focus ?? "selected";

  if (stage.layout) autoLayout();
  state.showGrid = typeof stage.grid === "boolean" ? stage.grid : state.showGrid;
  ui.gridToggle.checked = state.showGrid;

  if (focus === "near") {
    state.focal = 720;
    state.parallax = 130;
    selectItemByDepth("near");
  } else if (focus === "far") {
    state.focal = 1120;
    state.parallax = 62;
    selectItemByDepth("far");
  } else if (focus === "middle") {
    state.focal = 900;
    state.parallax = 92;
    selectItemByDepth("middle");
  } else if (!getSelected()) {
    state.selectedId = state.items[0]?.id ?? null;
  }

  const selected = getSelected();
  if (selected) {
    selected.scale = clamp(selected.scale * 1.08, 0.34, 1.35);
    selected.alpha = stage.mood === "hidden" ? 0.78 : 1;
    selected.z = clamp(selected.z - 35, -260, 980);
  }

  if (stage.mood === "tense") {
    state.parallax = clamp(state.parallax + 24, 0, 180);
  } else if (stage.mood === "bright") {
    state.focal = clamp(state.focal - 80, 520, 1300);
  } else if (stage.mood === "hidden") {
    state.parallax = clamp(state.parallax - 18, 0, 180);
  }

  if (cue.nextBeat && scriptBeats[cue.nextBeat]) {
    ui.scriptBeatSelect.value = cue.nextBeat;
  }

  ui.focalRange.value = Math.round(state.focal);
  ui.parallaxRange.value = Math.round(state.parallax);
  syncControls();
  renderLayerList();
}

function selectItemByDepth(mode) {
  if (!state.items.length) return;
  const sorted = [...state.items].sort((a, b) => a.z - b.z);
  if (mode === "near") state.selectedId = sorted[0].id;
  if (mode === "far") state.selectedId = sorted[sorted.length - 1].id;
  if (mode === "middle") state.selectedId = sorted[Math.floor(sorted.length / 2)].id;
}

function updateCaption(text) {
  if (ui.voiceCaptionPreview) ui.voiceCaptionPreview.textContent = text;
  if (!ui.stageSubtitle) return;
  ui.stageSubtitle.textContent = text;
  ui.stageSubtitle.classList.toggle("visible", Boolean(text));
}

function speakReply(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function getCurrentBeat() {
  return scriptBeats[ui.scriptBeatSelect.value] ?? scriptBeats.opening;
}

function setVoiceStatus(message, tone = "") {
  ui.voiceStatus.textContent = message;
  ui.voiceStatus.classList.toggle("listening", tone === "listening");
  ui.voiceStatus.classList.toggle("thinking", tone === "thinking");
  ui.voiceStatus.classList.toggle("error", tone === "error");
}

function describeSpeechError(error) {
  if (error === "not-allowed") return "浏览器拒绝了麦克风权限";
  if (error === "no-speech") return "没有听到清晰语音，请再试一次";
  if (error === "audio-capture") return "没有检测到可用麦克风";
  return "语音识别暂时不可用";
}

function getSelected() {
  return state.items.find((item) => item.id === state.selectedId) ?? null;
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function roundRectPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value) {
  return (value * 180) / Math.PI;
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char];
  });
}

function makeId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}
