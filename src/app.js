const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d", { alpha: false });
const urlParams = new URLSearchParams(window.location.search);
const appMode = document.body.dataset.mode || "editor";
const isEditor = appMode === "editor";
const isViewer = appMode === "viewer";
const isFinal = appMode === "final";
const isIntroDemo = appMode === "intro-demo";
const isIntroEmbed = (isFinal && urlParams.get("intro") === "1") || isIntroDemo;
const introEmbedProjectionScale = 0.62;

const ui = {
  fileInput: document.querySelector("#fileInput"),
  cameraButton: document.querySelector("#cameraButton"),
  autoLayoutButton: document.querySelector("#autoLayoutButton"),
  saveLayoutButton: document.querySelector("#saveLayoutButton"),
  saveAsLayoutButton: document.querySelector("#saveAsLayoutButton"),
  sceneGroupSelect: document.querySelector("#sceneGroupSelect"),
  newSceneGroupButton: document.querySelector("#newSceneGroupButton"),
  renameSceneGroupButton: document.querySelector("#renameSceneGroupButton"),
  deleteSceneGroupButton: document.querySelector("#deleteSceneGroupButton"),
  sceneGroupCoverInput: document.querySelector("#sceneGroupCoverInput"),
  sceneGroupCoverName: document.querySelector("#sceneGroupCoverName"),
  finalSceneGroupSelect: document.querySelector("#finalSceneGroupSelect"),
  finalSceneGroupCards: document.querySelector("#finalSceneGroupCards"),
  finalGroupRail: document.querySelector(".final-group-rail"),
  sceneSelect: document.querySelector("#sceneSelect"),
  sceneGroupSceneList: document.querySelector("#sceneGroupSceneList"),
  sceneLogicPane: document.querySelector(".scene-logic-pane"),
  sceneLogicGraph: document.querySelector("#sceneLogicGraph"),
  sceneLogicGroupName: document.querySelector("#sceneLogicGroupName"),
  sceneLogicToggle: document.querySelector("#sceneLogicToggle"),
  sceneNameInput: document.querySelector("#sceneNameInput"),
  finalStartSceneSelect: document.querySelector("#finalStartSceneSelect"),
  xfyunVoiceSelect: document.querySelector("#xfyunVoiceSelect"),
  sceneAudioInput: document.querySelector("#sceneAudioInput"),
  sceneAudioName: document.querySelector("#sceneAudioName"),
  sceneAudio: document.querySelector("#sceneAudio"),
  gifLoopToggle: document.querySelector("#gifLoopToggle"),
  audioLoopToggle: document.querySelector("#audioLoopToggle"),
  webmLoopToggle: document.querySelector("#webmLoopToggle"),
  ageRequiredToggle: document.querySelector("#ageRequiredToggle"),
  realtimeReplyToggle: document.querySelector("#realtimeReplyToggle"),
  sceneEndMode: document.querySelector("#sceneEndMode"),
  sceneNextSceneSelect: document.querySelector("#sceneNextSceneSelect"),
  flowVisibleSections: document.querySelectorAll("[data-flow-visible]"),
  flowRouteRows: document.querySelectorAll("[data-flow-route]"),
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
  playPauseButton: document.querySelector("#playPauseButton"),
  finalIntroModal: document.querySelector("#finalIntroModal"),
  finalIntroClose: document.querySelector("#finalIntroClose"),
  finalIntroPrimary: document.querySelector("#finalIntroPrimary"),
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
  lastLayoutSaveSignature: "",
  pendingLayoutSaveSignature: "",
  currentSceneId: urlParams.get("scene") || "default",
  currentSceneName: "默认场景",
  sceneGroups: [],
  finalGroupPreviewCache: new Map(),
  finalGroupRailTimer: null,
  activeSceneGroupId: urlParams.get("group") || "default-group",
  finalSceneGroupId: urlParams.get("group") || "default-group",
  finalStartSceneId: "default",
  scenes: [],
  loadingScene: true,
  sceneAudioAsset: null,
  audioLoop: true,
  gifLoop: true,
  webmLoop: true,
  sceneFlow: {
    mode: "none",
    nextSceneId: "",
    routes: [],
  },
  sceneEnded: false,
  xfyunVoice: "x6_lingfeiyi_pro",
  ageRequired: false,
  realtimeReply: false,
  userVariables: {},
  pendingAgeFlow: null,
  activeTts: null,
  gifElements: new Map(),
  gifPlayers: new Map(),
  gifPauseFrames: new Map(),
  scenePlaybackToken: 0,
  paused: isFinal || isIntroDemo,
  transitionToken: 0,
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
  scaleRange: { itemKey: "scale", min: 0.3, max: 4.0 },
  rotationRange: { itemKey: "rotation", min: degreesToRadians(-35), max: degreesToRadians(35), neutral: 50 },
  tiltRange: { itemKey: "tilt", min: degreesToRadians(-45), max: degreesToRadians(45), neutral: 50 },
};

const controls = ["xRange", "yRange", "zRange", "scaleRange", "rotationRange", "tiltRange"];

init();

async function init() {
  if (isIntroEmbed) {
    document.body.classList.add("intro-embed-final");
    ui.finalIntroModal?.setAttribute("hidden", "");
    if (!isMobileMotionDevice()) {
      showIntroEmbedUnsupported();
      bindEvents();
      resize();
      requestAnimationFrame(draw);
      return;
    }
    setupIntroEmbedMotionTracking();
  }
  bindEvents();
  resize();
  await loadInitialScene();
  syncControls();
  requestAnimationFrame(draw);
  if (isViewer) {
    ui.viewerStartButton?.addEventListener("click", () => {
      startCamera();
      playSceneAudio();
    });
  }
  if (isFinal) {
    updateCaption("");
  }
}

function bindEvents() {
  on(window, "resize", resize);
  on(window, "pointerdown", () => playSceneAudio(), { once: true });
  on(window, "keydown", () => playSceneAudio(), { once: true });

  ui.tabButtons.forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tabTarget));
  });

  on(ui.fileInput, "change", async (event) => {
    await addFiles([...event.target.files]);
    ui.fileInput.value = "";
  });

  on(ui.cameraButton, "click", () => {
    if (state.cameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
    playSceneAudio();
  });

  on(ui.cameraSelect, "change", () => {
    state.cameraDeviceId = ui.cameraSelect.value;
    if (state.cameraOn) startCamera();
  });

  on(ui.autoLayoutButton, "click", () => {
    autoLayout();
    syncControls();
    renderLayerList();
    scheduleSaveLayout();
  });

  on(ui.exportButton, "click", exportFrame);
  on(ui.deleteButton, "click", deleteSelected);
  on(ui.layerList, "click", (event) => {
    const button = event.target.closest("[data-layer-id]");
    if (!button || !ui.layerList.contains(button)) return;
    state.selectedId = button.dataset.layerId;
    syncControls();
    renderLayerList();
  });
  ui.saveLayoutButton?.addEventListener("click", () => saveLayoutNow());
  ui.saveAsLayoutButton?.addEventListener("click", () => saveAsLayout());
  ui.sceneGroupSelect?.addEventListener("change", async () => switchSceneGroup(ui.sceneGroupSelect.value));
  ui.finalSceneGroupSelect?.addEventListener("change", async () => {
    if (isFinal) {
      await switchFinalSceneGroup(ui.finalSceneGroupSelect.value);
      return;
    }
    state.finalSceneGroupId = ui.finalSceneGroupSelect.value || state.activeSceneGroupId;
    await saveAppSettings();
  });
  ui.newSceneGroupButton?.addEventListener("click", () => createSceneGroup());
  ui.renameSceneGroupButton?.addEventListener("click", () => renameActiveSceneGroup());
  ui.deleteSceneGroupButton?.addEventListener("click", () => deleteActiveSceneGroup());
  ui.sceneGroupSceneList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scene-id]");
    if (!button || !ui.sceneGroupSceneList.contains(button)) return;
    switchScene(button.dataset.sceneId);
  });
  ui.sceneLogicGraph?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scene-id]");
    if (!button || !ui.sceneLogicGraph.contains(button)) return;
    switchScene(button.dataset.sceneId);
  });
  ui.sceneLogicToggle?.addEventListener("click", () => toggleSceneLogicPane());
  ui.finalSceneGroupCards?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-group-id]");
    if (!button || !ui.finalSceneGroupCards.contains(button)) return;
    await switchFinalSceneGroup(button.dataset.groupId);
  });
  ui.finalGroupRail?.addEventListener("pointerenter", () => showFinalGroupRail());
  ui.finalGroupRail?.addEventListener("pointerleave", () => scheduleFinalGroupRailHide(1000));
  ui.sceneSelect?.addEventListener("change", () => switchScene(ui.sceneSelect.value));
  ui.finalStartSceneSelect?.addEventListener("change", async () => {
    state.finalStartSceneId = ui.finalStartSceneSelect.value || "default";
    updateActiveSceneGroup({ finalStartSceneId: state.finalStartSceneId });
    renderSceneGroupStructure();
    await saveAppSettings();
  });
  ui.xfyunVoiceSelect?.addEventListener("change", () => {
    state.xfyunVoice = normalizeXfyunVoice(ui.xfyunVoiceSelect.value);
    ui.xfyunVoiceSelect.value = state.xfyunVoice;
    scheduleSaveLayout();
  });
  ui.sceneAudioInput?.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file || !isSupportedAudioFile(file)) return;
    const asset = await uploadAsset(file).catch(() => localAssetFromFile(file));
    state.sceneAudioAsset = asset;
    setupSceneAudio();
    scheduleSaveLayout();
    ui.sceneAudioInput.value = "";
  });
  ui.sceneGroupCoverInput?.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file || !isSupportedImageFile(file)) return;
    try {
      const asset = await uploadAsset(file);
      if (!isUploadedAsset(asset)) throw new Error("cover upload did not return uploads url");
      updateActiveSceneGroup({ coverAsset: asset });
      state.finalGroupPreviewCache.delete(state.activeSceneGroupId);
      syncSceneGroupCoverControls();
      renderFinalSceneGroupCards();
      await saveAppSettings();
      setLayoutStatus(`场景组封面已上传：${asset.name}`, "good");
    } catch {
      setLayoutStatus("场景组封面上传失败，请确认已重启 node server.js", "warn");
    } finally {
      ui.sceneGroupCoverInput.value = "";
    }
  });
  ui.gifLoopToggle?.addEventListener("change", () => {
    state.gifLoop = ui.gifLoopToggle.checked;
    resetGifPlayback();
    scheduleSaveLayout();
  });
  ui.audioLoopToggle?.addEventListener("change", () => {
    state.audioLoop = ui.audioLoopToggle.checked;
    setupSceneAudio();
    scheduleSaveLayout();
  });
  ui.webmLoopToggle?.addEventListener("change", () => {
    state.webmLoop = ui.webmLoopToggle.checked;
    applyVideoLoopSettings();
    scheduleSaveLayout();
  });
  ui.ageRequiredToggle?.addEventListener("change", () => {
    state.ageRequired = ui.ageRequiredToggle.checked;
    scheduleSaveLayout();
  });
  ui.realtimeReplyToggle?.addEventListener("change", () => {
    state.realtimeReply = ui.realtimeReplyToggle.checked;
    scheduleSaveLayout();
  });
  ui.sceneAudio?.addEventListener("ended", () => handleSceneMediaEnded());
  ui.sceneEndMode?.addEventListener("change", () => {
    state.sceneFlow.mode = ui.sceneEndMode.value;
    syncSceneFlowControls();
    renderSceneGroupStructure();
    scheduleSaveLayout();
  });
  ui.sceneNextSceneSelect?.addEventListener("change", () => {
    state.sceneFlow.nextSceneId = ui.sceneNextSceneSelect.value;
    renderSceneGroupStructure();
    scheduleSaveLayout();
  });
  ui.flowRouteRows.forEach((row) => {
    row.querySelector("[data-flow-keywords]")?.addEventListener("input", () => {
      state.sceneFlow.routes = readSceneFlowRoutesFromControls();
      renderSceneGroupStructure();
      scheduleSaveLayout();
    });
    row.querySelector("[data-flow-scene]")?.addEventListener("change", () => {
      state.sceneFlow.routes = readSceneFlowRoutesFromControls();
      renderSceneGroupStructure();
      scheduleSaveLayout();
    });
  });
  on(ui.voiceButton, "click", toggleVoiceListening);
  ui.voiceTextSendButton?.addEventListener("click", () => sendManualVoiceText());
  ui.micLevelButton?.addEventListener("click", () => toggleMicLevelMonitor());
  ui.voiceTextInput?.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      sendManualVoiceText();
    }
  });
  ui.playPauseButton?.addEventListener("click", togglePlayback);
  ui.finalIntroClose?.addEventListener("click", closeFinalIntroModal);
  ui.finalIntroPrimary?.addEventListener("click", closeFinalIntroModal);
  ui.finalIntroModal?.addEventListener("click", (event) => {
    if (event.target === ui.finalIntroModal) closeFinalIntroModal();
  });
  on(window, "keydown", (event) => {
    if (event.key === "Escape") closeFinalIntroModal();
  });
  on(ui.scriptBeatSelect, "change", () => {
    setVoiceStatus(`已切换到：${getCurrentBeat().title}`);
  });

  on(ui.focalRange, "input", () => {
    state.focal = rangeToValue("focalRange", ui.focalRange.value);
    updateRangeDisplays();
    scheduleSaveLayout();
  });
  on(ui.parallaxRange, "input", () => {
    state.parallax = rangeToValue("parallaxRange", ui.parallaxRange.value);
    updateRangeDisplays();
    scheduleSaveLayout();
  });
  on(ui.gridToggle, "change", () => {
    state.showGrid = ui.gridToggle.checked;
    scheduleSaveLayout();
  });

  for (const id of controls) {
    on(ui[id], "input", () => {
      const selected = getSelected();
      if (!selected) return;
      selected[rangeConfigs[id].itemKey] = rangeToValue(id, ui[id].value);
      updateRangeDisplays();
      renderLayerList();
      scheduleSaveLayout();
    });
  }

  on(canvas, "pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    state.pointerHead.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    state.pointerHead.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

    if (!isEditor || !state.dragging) return;
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

  on(canvas, "pointerdown", (event) => {
    if (!isEditor) return;
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

  on(canvas, "pointerup", (event) => {
    state.dragging = null;
    canvas.classList.remove("dragging");
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  });

  on(
    canvas,
    "wheel",
    (event) => {
      if (!isEditor) return;
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

  on(window, "pagehide", () => {
    stopCamera({ silent: true });
    stopMicLevelMonitor();
    if (state.voice.recognition) {
      state.voice.recognition.stop();
      state.voice.recognition = null;
    }
  });
}

function on(target, type, handler, options) {
  target?.addEventListener(type, handler, options);
}

function isMobileMotionDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || matchMedia("(pointer: coarse)").matches;
}

function showIntroEmbedUnsupported() {
  const message = document.createElement("div");
  message.className = "intro-embed-unsupported";
  message.textContent = "该功能暂不支持PC端，请从移动端体验";
  canvas.parentElement?.append(message);
}

function setupIntroEmbedMotionTracking() {
  const updateFromOrientation = (event) => {
    const gamma = clamp(Number(event.gamma || 0) / 28, -1, 1);
    const beta = clamp((Number(event.beta || 0) - 45) / 36, -1, 1);
    const alpha = Number(event.alpha || 0);
    state.pointerHead.x = gamma;
    state.pointerHead.y = clamp(-beta, -1, 1);
    state.pointerHead.z = Number.isFinite(alpha) ? Math.sin((alpha * Math.PI) / 180) * 0.35 : 0;
  };

  const enable = async () => {
    try {
      const orientationEvent = globalThis.DeviceOrientationEvent;
      if (typeof orientationEvent?.requestPermission === "function") {
        const permission = await orientationEvent.requestPermission();
        if (permission !== "granted") return;
      }
      window.addEventListener("deviceorientation", updateFromOrientation, true);
    } catch {}
  };

  enable();
  on(ui.playPauseButton, "click", enable, { once: true });
  on(window, "pointerdown", enable, { once: true });
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const nextDpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const nextWidth = Math.max(1, rect.width);
  const nextHeight = Math.max(1, rect.height);
  const pixelWidth = Math.round(nextWidth * nextDpr);
  const pixelHeight = Math.round(nextHeight * nextDpr);
  if (state.width === nextWidth && state.height === nextHeight && state.dpr === nextDpr) return;
  state.dpr = nextDpr;
  state.width = nextWidth;
  state.height = nextHeight;
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

async function addFiles(files) {
  if (!isEditor) return;
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
    const timer = setTimeout(() => reject(new Error("图片加载超时")), 15000);
    image.onload = () => {
      clearTimeout(timer);
      const mediaType = isGifAsset(asset) ? "gif" : "image";
      const item = createItem(asset.name, asset.url, image, mediaType);
      item.status = mediaType === "gif" ? "GIF" : "图片";
      resolve(assignAssetMeta(item, asset));
    };
    image.onerror = (error) => {
      clearTimeout(timer);
      reject(error);
    };
    image.src = asset.url;
  });
}

function createPendingVideoItem(asset) {
  const item = createPlaceholderItem(asset.name, "视频加载中", "video");
  item.src = asset.url;
  item.objectUrl = asset.url;
  return assignAssetMeta(item, asset);
}

function createReadyImageItem(asset, image) {
  const mediaType = isGifAsset(asset) ? "gif" : "image";
  const item = createItem(asset.name, asset.url, image, mediaType);
  item.status = mediaType === "gif" ? "GIF" : "图片";
  return assignAssetMeta(item, asset);
}

function createReadyVideoItem(asset, video) {
  video.muted = true;
  video.loop = shouldLoopVideoAsset(asset);
  video.playsInline = true;
  video.preload = "auto";
  video.addEventListener("ended", () => handleSceneMediaEnded());
  const item = createItem(asset.name, asset.url, video, "video");
  item.status = asset.name.toLowerCase().endsWith(".webm") ? "WebM" : "MOV";
  item.thumbnail = makeVideoThumbnail(video);
  return assignAssetMeta(item, asset);
}

function hydrateVideoItem(asset, item) {
  const video = document.createElement("video");
  video.muted = true;
  video.loop = shouldLoopVideoAsset(asset);
  video.playsInline = true;
  video.autoplay = false;
  video.preload = "auto";
  let hasRenderableFrame = false;

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
    if (!state.paused) video.play().catch(() => {});
    updateLayer();
  };
  const onFrame = () => {
    if (!video.videoWidth || !video.videoHeight) return;
    if (hasRenderableFrame) {
      video.loop = shouldLoopVideoItem(item);
      if (!state.paused && video.paused) video.play().catch(() => {});
      return;
    }
    hasRenderableFrame = true;
    clearTimeout(timer);
    video.removeEventListener("loadeddata", onFrame);
    video.removeEventListener("canplay", onFrame);
    video.removeEventListener("playing", onFrame);
    item.media = video;
    item.mediaType = "video";
    item.status = asset.name.toLowerCase().endsWith(".webm") ? "WebM" : "MOV";
    item.thumbnail = makeVideoThumbnail(video);
    video.loop = shouldLoopVideoItem(item);
    if (!state.paused && video.paused) video.play().catch(() => {});
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
  video.addEventListener("ended", () => handleSceneMediaEnded());
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

  if (isWebmLayerItem(item)) {
    Object.assign(item, {
      x: rangeToValue("xRange", 50),
      y: rangeToValue("yRange", 56),
      scale: rangeToValue("scaleRange", 20),
      rotation: rangeToValue("rotationRange", 50),
      tilt: rangeToValue("tiltRange", 50),
    });
  }
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

function assignAssetMeta(item, asset) {
  item.assetKey = asset.key;
  item.assetUrl = asset.url;
  item.assetType = asset.type;
  return item;
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

function isSupportedImageFile(file) {
  return /^image\/(png|jpeg|webp|gif)$/.test(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

function isSupportedAudioFile(file) {
  return /^audio\//.test(file.type) || /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name);
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

function isWebmAsset(asset) {
  return asset.type === "video/webm" || /\.webm(?:$|\?)/i.test(asset.url || asset.name || "");
}

function isWebmVideoItem(item) {
  return item.mediaType === "video" && (item.assetType === "video/webm" || /\.webm(?:$|\?)/i.test(item.assetUrl || item.src || item.name || ""));
}

function isWebmLayerItem(item) {
  return item.assetType === "video/webm" || /\.webm(?:$|\?)/i.test(item.assetUrl || item.src || item.name || "");
}

function shouldLoopVideoAsset(asset) {
  return !isWebmAsset(asset) || state.webmLoop;
}

function shouldLoopVideoItem(item) {
  return !isWebmVideoItem(item) || state.webmLoop;
}

function applyVideoLoopSettings() {
  state.items.forEach((item) => {
    if (item.mediaType !== "video" || !item.media) return;
    item.media.loop = shouldLoopVideoItem(item);
  });
}

function isGifAsset(asset) {
  return asset.type === "image/gif" || /\.gif$/i.test(asset.url);
}

function isAudioAsset(asset) {
  return /^audio\//.test(asset.type) || /\.(mp3|wav|ogg|m4a|aac)$/i.test(asset.url);
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

function isUploadedAsset(asset) {
  return Boolean(asset?.url && asset.url.startsWith("/uploads/"));
}

function localAssetFromFile(file) {
  return {
    key: `local/${file.name}-${Date.now()}`,
    name: file.name,
    url: URL.createObjectURL(file),
    type:
      file.type ||
      (isMovFile(file)
        ? "video/quicktime"
        : isSupportedAudioFile(file)
          ? inferAssetType(file.name)
          : "application/octet-stream"),
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
    await loadAppSettings();
    if (isFinal) {
      resetFinalPlaybackState();
      state.currentSceneId = getFinalSceneGroup().finalStartSceneId || state.finalStartSceneId || "default";
    } else if (isIntroDemo) {
      state.currentSceneId = getActiveSceneGroup().finalStartSceneId || state.finalStartSceneId || "default";
    }
    syncSceneControls();
    const loaded = await loadSceneById(state.currentSceneId);
    if (loaded) return;
  } catch {
    setLayoutStatus("未连接布局数据库", "warn");
  } finally {
    state.loadingScene = false;
  }

  if (isEditor) {
    seedDemoImages();
    syncSceneControls();
    syncControls();
  } else {
    setLayoutStatus("演示页暂无保存布局", "warn");
  }
}

async function loadSceneById(sceneId) {
  state.loadingScene = true;
  const layout = await fetchSceneLayout(sceneId);
  if (!layout) {
    state.loadingScene = false;
    return false;
  }
  return applySceneLayout(layout, sceneId);
}

async function fetchSceneLayout(sceneId) {
  const response = await fetch(`/api/layout?id=${encodeURIComponent(sceneId)}`);
  if (!response.ok) return null;
  return response.json();
}

async function applySceneLayout(layout, sceneId, preloadedAssets = new Map()) {
  state.loadingScene = true;
  const hasItems = Array.isArray(layout.items) && layout.items.length > 0;
  state.currentSceneId = layout.id || sceneId;
  state.currentSceneName =
    state.currentSceneId === "default" ? "默认场景" : layout.name || state.currentSceneId;
  state.focal = Number(layout.scene?.focal ?? state.focal);
  state.parallax = Number(layout.scene?.parallax ?? state.parallax);
  state.showGrid = layout.scene?.showGrid !== false;
  state.sceneAudioAsset = normalizeSceneAudioAsset(layout.scene?.audioAsset);
  state.audioLoop = layout.scene?.audioLoop !== false;
  state.gifLoop = layout.scene?.gifLoop !== false;
  state.webmLoop = layout.scene?.webmLoop !== false;
  state.sceneFlow = normalizeSceneFlow(layout.scene?.flow || layout.scene?.sceneFlow);
  state.xfyunVoice = normalizeXfyunVoice(layout.scene?.xfyunVoice || layout.scene?.ttsVoice);
  state.ageRequired = Boolean(layout.scene?.ageRequired);
  state.realtimeReply = Boolean(layout.scene?.realtimeReply);
  state.sceneEnded = false;
  ui.focalRange.value = String(valueToRange("focalRange", state.focal));
  ui.parallaxRange.value = String(valueToRange("parallaxRange", state.parallax));
  ui.gridToggle.checked = state.showGrid;
  syncSceneMediaControls();

  clearSceneMedia();
  if (hasItems) {
    await restoreLayoutItems(layout.items, preloadedAssets);
  } else {
    state.items = [];
    state.selectedId = null;
    syncControls();
    renderLayerList();
  }

  syncSceneControls();
  syncSceneFlowControls();
  state.lastLayoutSaveSignature = getLayoutSaveSignature();
  state.pendingLayoutSaveSignature = "";
  restartScenePlayback({ autoplay: (isViewer || isFinal) && !isIntroEmbed });
  updateRangeDisplays();
  setLayoutStatus(hasItems ? `已切换：${state.currentSceneName}` : `空场景：${state.currentSceneName}`, hasItems ? "good" : "warn");
  state.loadingScene = false;
  maybeRunPendingAgeFeedback();
  return hasItems;
}

async function loadSceneList() {
  if (!ui.sceneSelect) return;
  const response = await fetch("/api/layout?list=1&details=1");
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

async function loadAppSettings() {
  try {
    const response = await fetch("/api/settings");
    if (!response.ok) return;
    const payload = await response.json();
    const settings = normalizeAppSettings(payload.settings);
    state.sceneGroups = settings.sceneGroups;
    const requestedGroup = urlParams.get("group");
    if (isIntroDemo) {
      state.activeSceneGroupId = hasSceneGroup(requestedGroup) ? requestedGroup : settings.activeSceneGroupId;
      state.finalSceneGroupId = state.activeSceneGroupId;
    } else {
      state.activeSceneGroupId = settings.activeSceneGroupId;
      state.finalSceneGroupId = settings.finalSceneGroupId;
      if (requestedGroup && hasSceneGroup(requestedGroup)) {
        if (isFinal) state.finalSceneGroupId = requestedGroup;
        else state.activeSceneGroupId = requestedGroup;
      }
    }
    state.finalStartSceneId = isFinal ? getFinalSceneGroup().finalStartSceneId : getActiveSceneGroup().finalStartSceneId;
    renderSceneGroupOptions();
    renderFinalStartSceneOptions();
  } catch {}
}

async function saveAppSettings() {
  try {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serializeAppSettings()),
    });
    if (!response.ok) throw new Error("settings save failed");
    setLayoutStatus(`场景组已保存：${getSceneGroupLabel(state.activeSceneGroupId)}`, "good");
  } catch {
    setLayoutStatus("场景组设置保存失败", "warn");
  }
}

function normalizeAppSettings(settings = {}) {
  const fallbackStart = hasScene(settings.finalStartSceneId) ? settings.finalStartSceneId : "default";
  const sceneGroups = normalizeSceneGroups(settings.sceneGroups, fallbackStart);
  const activeSceneGroupId = hasSceneGroup(settings.activeSceneGroupId, sceneGroups)
    ? settings.activeSceneGroupId
    : sceneGroups[0].id;
  const finalSceneGroupId = hasSceneGroup(settings.finalSceneGroupId, sceneGroups)
    ? settings.finalSceneGroupId
    : activeSceneGroupId;
  return { sceneGroups, activeSceneGroupId, finalSceneGroupId };
}

function normalizeSceneGroups(groups, fallbackStartSceneId = "default") {
  const source = Array.isArray(groups) && groups.length
    ? groups
    : [{ id: "default-group", name: "默认场景组", finalStartSceneId: fallbackStartSceneId }];
  const seen = new Set();
  const normalized = source
    .map((group, index) => {
      const id = makeSceneGroupId(group?.id || group?.name || (index === 0 ? "default-group" : "scene-group"));
      if (seen.has(id)) return null;
      seen.add(id);
      const finalStartSceneId = hasScene(group?.finalStartSceneId) ? group.finalStartSceneId : fallbackStartSceneId;
      return {
        id,
        name: String(group?.name || (id === "default-group" ? "默认场景组" : id)).trim() || "默认场景组",
        finalStartSceneId,
        coverAsset: normalizeSceneGroupCoverAsset(group?.coverAsset),
      };
    })
    .filter(Boolean);
  return normalized.length
    ? normalized
    : [{ id: "default-group", name: "默认场景组", finalStartSceneId: fallbackStartSceneId }];
}

function serializeAppSettings() {
  return {
    finalStartSceneId: getFinalSceneGroup().finalStartSceneId || "default",
    activeSceneGroupId: state.activeSceneGroupId,
    finalSceneGroupId: state.finalSceneGroupId,
    sceneGroups: state.sceneGroups,
  };
}

function normalizeSceneGroupCoverAsset(asset) {
  if (!asset || typeof asset !== "object") return null;
  const url = asset.url || asset.assetUrl || "";
  if (!url) return null;
  return {
    key: asset.key || asset.assetKey || url,
    name: asset.name || decodeURIComponent(url.split("/").pop() || "scene-group-cover"),
    url,
    type: asset.type || asset.assetType || inferAssetType(url),
    size: Number(asset.size || 0),
  };
}

function hasScene(sceneId) {
  return state.scenes.some((scene) => scene.id === sceneId);
}

function hasSceneGroup(groupId, groups = state.sceneGroups) {
  return groups.some((group) => group.id === groupId);
}

function getActiveSceneGroup() {
  return state.sceneGroups.find((group) => group.id === state.activeSceneGroupId) || state.sceneGroups[0] || {
    id: "default-group",
    name: "默认场景组",
    finalStartSceneId: "default",
  };
}

function getFinalSceneGroup() {
  return state.sceneGroups.find((group) => group.id === state.finalSceneGroupId) || getActiveSceneGroup();
}

function getSceneGroupLabel(groupId) {
  const group = state.sceneGroups.find((item) => item.id === groupId);
  return group?.name || groupId;
}

function updateActiveSceneGroup(patch) {
  state.sceneGroups = state.sceneGroups.map((group) =>
    group.id === state.activeSceneGroupId ? { ...group, ...patch } : group,
  );
  const active = getActiveSceneGroup();
  state.finalStartSceneId = active.finalStartSceneId || state.finalStartSceneId || "default";
}

function renderSceneOptions() {
  if (!ui.sceneSelect) return;
  renderSceneGroupOptions();
  populateSceneSelect(ui.sceneSelect, { selected: state.currentSceneId });
  renderFinalStartSceneOptions();
  renderSceneFlowOptions();
  renderSceneGroupStructure();
}

function renderSceneGroupOptions() {
  populateSceneGroupSelect(ui.sceneGroupSelect, state.activeSceneGroupId);
  populateSceneGroupSelect(ui.finalSceneGroupSelect, state.finalSceneGroupId);
  renderFinalSceneGroupCards();
  syncSceneGroupCoverControls();
}

function syncSceneGroupCoverControls() {
  if (!ui.sceneGroupCoverName) return;
  const cover = getActiveSceneGroup().coverAsset;
  ui.sceneGroupCoverName.textContent = cover?.name || "未设置封面";
  ui.sceneGroupCoverName.classList.toggle("empty", !cover);
}

function renderFinalStartSceneOptions() {
  if (!ui.finalStartSceneSelect) return;
  const selected = getActiveSceneGroup().finalStartSceneId || state.finalStartSceneId || ui.finalStartSceneSelect.value || "default";
  populateSceneSelect(ui.finalStartSceneSelect, { selected: hasScene(selected) ? selected : "default" });
}

function populateSceneGroupSelect(select, selected = "") {
  if (!select) return;
  const fragment = document.createDocumentFragment();
  state.sceneGroups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    fragment.append(option);
  });
  select.replaceChildren(fragment);
  select.value = hasSceneGroup(selected) ? selected : state.sceneGroups[0]?.id || "";
}

function renderFinalSceneGroupCards() {
  if (!ui.finalSceneGroupCards) return;
  const fragment = document.createDocumentFragment();
  state.sceneGroups.forEach((group) => {
    const card = document.createElement("button");
    card.type = "button";
    card.dataset.groupId = group.id;
    card.className = `final-group-card${group.id === state.finalSceneGroupId ? " active" : ""}`;

    const image = document.createElement("img");
    image.className = "final-group-card-image";
    image.alt = "";
    image.loading = "lazy";
    image.src = getSceneGroupPreviewUrl(group);
    const copy = document.createElement("span");
    copy.className = "final-group-card-copy";
    const title = document.createElement("strong");
    title.textContent = group.name;
    copy.append(title);
    card.append(image, copy);
    fragment.append(card);
  });
  ui.finalSceneGroupCards.replaceChildren(fragment);
  hydrateFinalSceneGroupPreviews();
}

function getSceneById(sceneId) {
  return state.scenes.find((scene) => scene.id === sceneId);
}

function getSceneGroupPreviewUrl(group) {
  return group.coverAsset?.url || state.finalGroupPreviewCache.get(group.id) || makeSceneGroupPreviewPlaceholder(group);
}

function makeSceneGroupPreviewPlaceholder(group) {
  const scene = getSceneById(group.finalStartSceneId);
  const buffer = makePlaceholderMedia(group.name, scene ? getSceneLabel(scene.id) : "未设置首场景");
  return buffer.toDataURL("image/png");
}

function hydrateFinalSceneGroupPreviews() {
  if (!ui.finalSceneGroupCards) return;
  state.sceneGroups.forEach((group) => {
    if (group.coverAsset?.url) return;
    if (state.finalGroupPreviewCache.has(group.id)) return;
    renderSceneGroupPreview(group)
      .then((url) => {
        state.finalGroupPreviewCache.set(group.id, url);
        const image = ui.finalSceneGroupCards?.querySelector(`[data-group-id="${CSS.escape(group.id)}"] .final-group-card-image`);
        if (image) image.src = url;
      })
      .catch(() => {});
  });
}

async function renderSceneGroupPreview(group) {
  const scene = getSceneById(group.finalStartSceneId);
  const layout = scene?.layout;
  if (!layout) return makeSceneGroupPreviewPlaceholder(group);
  const buffer = document.createElement("canvas");
  buffer.width = 320;
  buffer.height = 180;
  const context = buffer.getContext("2d");
  context.fillStyle = "#0d1210";
  context.fillRect(0, 0, buffer.width, buffer.height);
  drawPreviewGrid(context, buffer.width, buffer.height);

  const records = Array.isArray(layout.items) ? layout.items.slice(0, 5) : [];
  const sorted = records.sort((a, b) => Number(b.z || 0) - Number(a.z || 0));
  const media = await Promise.allSettled(sorted.map(loadPreviewMedia));
  media.forEach((result, index) => {
    if (result.status !== "fulfilled" || !result.value) return;
    drawPreviewItem(context, result.value, sorted[index], buffer.width, buffer.height);
  });

  context.fillStyle = "rgba(0,0,0,0.56)";
  context.fillRect(0, buffer.height - 34, buffer.width, 34);
  context.fillStyle = "#f3f1e8";
  context.font = "700 18px Inter, sans-serif";
  context.fillText(shortenName(group.name), 14, buffer.height - 12);
  return buffer.toDataURL("image/png");
}

function drawPreviewGrid(context, width, height) {
  context.save();
  context.strokeStyle = "rgba(139,215,197,0.14)";
  context.lineWidth = 1;
  for (let x = -width; x < width * 2; x += 28) {
    context.beginPath();
    context.moveTo(x, height);
    context.lineTo(width / 2 + (x - width / 2) * 0.28, height * 0.45);
    context.stroke();
  }
  for (let y = height * 0.48; y < height; y += 18) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.restore();
}

async function loadPreviewMedia(record) {
  const asset = assetFromLayoutRecord(record);
  if (!asset.url) return null;
  if (isVideoAsset(asset)) {
    const video = await preloadVideoAsset(asset);
    return video.videoWidth ? video : null;
  }
  const image = await preloadImageAsset(asset.url);
  return image;
}

function drawPreviewItem(context, media, record, width, height) {
  const focal = 860;
  const depth = focal + Number(record.z || 0);
  const projectedScale = clamp(focal / Math.max(220, depth), 0.28, 2.2);
  const x = width / 2 + Number(record.x || 0) * 0.2 * projectedScale;
  const y = height * 0.48 + Number(record.y || 0) * 0.2 * projectedScale;
  const mediaWidth = getMediaWidth(media);
  const mediaHeight = getMediaHeight(media);
  const base = Number(record.scale || 1) * projectedScale * 0.34;
  const drawWidth = mediaWidth * base;
  const drawHeight = mediaHeight * base;
  context.save();
  context.translate(x, y);
  context.rotate(Number(record.rotation || 0));
  context.globalAlpha = clamp(Number(record.alpha ?? 1), 0, 1);
  context.drawImage(media, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  context.restore();
}

function renderSceneGroupStructure() {
  const group = getActiveSceneGroup();
  const graph = buildSceneGroupGraph(group);
  if (ui.sceneLogicGroupName) ui.sceneLogicGroupName.textContent = group.name;
  renderSceneGroupSceneList(graph);
  renderSceneLogicGraph(graph);
}

function buildSceneGroupGraph(group = getActiveSceneGroup(), { includeCurrent = true } = {}) {
  const startSceneId = hasScene(group.finalStartSceneId) ? group.finalStartSceneId : state.currentSceneId || "default";
  const nodes = [];
  const edges = [];
  const seen = new Set();
  const queued = [startSceneId].filter(Boolean);
  while (queued.length && nodes.length < 80) {
    const sceneId = queued.shift();
    if (!sceneId || seen.has(sceneId)) continue;
    seen.add(sceneId);
    nodes.push(sceneId);
    const flow = getSceneFlowForGraph(sceneId);
    const nextEdges = getSceneFlowEdges(sceneId, flow);
    nextEdges.forEach((edge) => {
      edges.push(edge);
      if (edge.to && !seen.has(edge.to)) queued.push(edge.to);
    });
  }
  if (includeCurrent && !seen.has(state.currentSceneId)) nodes.push(state.currentSceneId);
  return { group, startSceneId, nodes: nodes.filter(Boolean), edges };
}

function getSceneFlowForGraph(sceneId) {
  if (sceneId === state.currentSceneId) return normalizeSceneFlow(state.sceneFlow);
  const scene = state.scenes.find((item) => item.id === sceneId);
  return normalizeSceneFlow(scene?.layout?.scene?.flow || scene?.layout?.scene?.sceneFlow);
}

function getSceneFlowEdges(sceneId, flow) {
  if (flow.mode === "auto" && flow.nextSceneId) {
    return [{ from: sceneId, to: flow.nextSceneId, label: "自动" }];
  }
  if (flow.mode === "dialog") {
    return flow.routes
      .filter((route) => route.sceneId)
      .map((route) => ({ from: sceneId, to: route.sceneId, label: route.keywords || "关键词" }));
  }
  return [];
}

function renderSceneGroupSceneList(graph) {
  if (!ui.sceneGroupSceneList) return;
  const fragment = document.createDocumentFragment();
  graph.nodes.forEach((sceneId, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.sceneId = sceneId;
    button.className = `scene-group-chip${sceneId === state.currentSceneId ? " active" : ""}`;
    button.textContent = `${index + 1}. ${getSceneLabel(sceneId)}`;
    fragment.append(button);
  });
  if (!fragment.childNodes.length) {
    const empty = document.createElement("span");
    empty.className = "scene-group-empty";
    empty.textContent = "当前组还没有可达场景";
    fragment.append(empty);
  }
  ui.sceneGroupSceneList.replaceChildren(fragment);
}

function renderSceneLogicGraph(graph) {
  if (!ui.sceneLogicGraph) return;
  const fragment = document.createDocumentFragment();
  const edgeMap = new Map();
  graph.edges.forEach((edge) => {
    if (!edge.to) return;
    const key = `${edge.from}->${edge.to}`;
    const labels = edgeMap.get(key) || [];
    labels.push(edge.label);
    edgeMap.set(key, labels);
  });
  graph.nodes.forEach((sceneId, index) => {
    const node = document.createElement("button");
    node.type = "button";
    node.dataset.sceneId = sceneId;
    node.className = `scene-logic-node${sceneId === state.currentSceneId ? " active" : ""}`;
    node.innerHTML = `<span>${index + 1}</span><strong></strong>`;
    node.querySelector("strong").textContent = getSceneLabel(sceneId);
    fragment.append(node);

    const outgoing = graph.edges.filter((edge) => edge.from === sceneId && edge.to);
    outgoing.forEach((edge) => {
      const branch = document.createElement("div");
      branch.className = "scene-logic-edge";
      const labels = edgeMap.get(`${edge.from}->${edge.to}`) || [edge.label];
      branch.textContent = `${labels.join(" / ")} → ${getSceneLabel(edge.to)}`;
      fragment.append(branch);
    });
  });
  if (!fragment.childNodes.length) {
    const empty = document.createElement("div");
    empty.className = "scene-logic-empty";
    empty.textContent = "选择首场景后会显示流程";
    fragment.append(empty);
  }
  ui.sceneLogicGraph.replaceChildren(fragment);
}

function toggleSceneLogicPane() {
  if (!ui.sceneLogicPane) return;
  const minimized = ui.sceneLogicPane.classList.toggle("is-minimized");
  if (ui.sceneLogicToggle) {
    ui.sceneLogicToggle.textContent = minimized ? "+" : "−";
    ui.sceneLogicToggle.setAttribute("aria-label", minimized ? "展开场景逻辑" : "最小化场景逻辑");
  }
}

function renderSceneFlowOptions() {
  const controls = [
    ui.sceneNextSceneSelect,
    ...[...ui.flowRouteRows].map((row) => row.querySelector("[data-flow-scene]")),
  ].filter(Boolean);
  controls.forEach((select) => {
    populateSceneSelect(select, { selected: select.value, includeEmpty: true, emptyLabel: "不指定" });
  });
}

function populateSceneSelect(select, { selected = "", includeEmpty = false, emptyLabel = "" } = {}) {
  if (!select) return;
  const fragment = document.createDocumentFragment();
  if (includeEmpty) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = emptyLabel;
    fragment.append(empty);
  }
  state.scenes.forEach((scene) => {
    const option = document.createElement("option");
    option.value = scene.id;
    option.textContent = getSceneLabel(scene.id);
    fragment.append(option);
  });
  select.replaceChildren(fragment);
  select.value = selected && [...select.options].some((option) => option.value === selected) ? selected : "";
}

function resolveSceneAlias(alias) {
  const number = String(alias).match(/\d+/)?.[0] ?? "";
  if (!number) return "";
  const exact = state.scenes.find((scene) => {
    const text = `${scene.id} ${scene.name}`.toLowerCase();
    return new RegExp(`(?:场景|scene)?\\s*${number}\\b`).test(text);
  });
  if (exact) return exact.id;
  const loose = state.scenes.find((scene) => `${scene.id} ${scene.name}`.includes(number));
  return loose?.id || (number === "1" ? state.scenes.find((scene) => scene.id === "default")?.id || "" : "");
}

function syncSceneControls() {
  renderSceneOptions();
  if (ui.sceneNameInput) {
    ui.sceneNameInput.value = state.currentSceneId === "default" ? "默认场景" : state.currentSceneName;
  }
  if (ui.xfyunVoiceSelect) {
    ui.xfyunVoiceSelect.value = state.xfyunVoice;
  }
  renderFinalStartSceneOptions();
  syncSceneMediaControls();
  syncSceneFlowControls();
  const demo = document.querySelector(".demo-link");
  if (demo) {
    demo.href = `./viewer.html?scene=${encodeURIComponent(state.currentSceneId)}&group=${encodeURIComponent(state.activeSceneGroupId)}`;
  }
}

function syncSceneFlowControls() {
  renderSceneFlowOptions();
  if (ui.sceneEndMode) ui.sceneEndMode.value = state.sceneFlow.mode || "none";
  if (ui.ageRequiredToggle) ui.ageRequiredToggle.checked = state.ageRequired;
  if (ui.realtimeReplyToggle) ui.realtimeReplyToggle.checked = state.realtimeReply;
  if (ui.sceneNextSceneSelect) ui.sceneNextSceneSelect.value = state.sceneFlow.nextSceneId || "";
  const flowMode = ui.sceneEndMode?.value || state.sceneFlow.mode || "none";
  ui.flowVisibleSections.forEach((element) => {
    element.hidden = element.dataset.flowVisible !== flowMode;
  });
  ui.flowRouteRows.forEach((row, index) => {
    const route = state.sceneFlow.routes[index] || {};
    const keywords = row.querySelector("[data-flow-keywords]");
    const scene = row.querySelector("[data-flow-scene]");
    if (keywords) keywords.value = route.keywords || "";
    if (scene) scene.value = route.sceneId || "";
  });
}

function readSceneFlowRoutesFromControls() {
  return [...ui.flowRouteRows]
    .map((row) => ({
      keywords: row.querySelector("[data-flow-keywords]")?.value.trim() || "",
      sceneId: row.querySelector("[data-flow-scene]")?.value || "",
    }))
    .filter((route) => route.keywords || route.sceneId);
}

function normalizeSceneFlow(flow) {
  const mode = ["none", "auto", "dialog"].includes(flow?.mode) ? flow.mode : "none";
  return {
    mode,
    nextSceneId: String(flow?.nextSceneId || ""),
    routes: Array.isArray(flow?.routes)
      ? flow.routes.slice(0, 4).map((route) => ({
          keywords: String(route.keywords || ""),
          sceneId: String(route.sceneId || ""),
        }))
      : [],
  };
}

function syncSceneMediaControls() {
  if (ui.gifLoopToggle) ui.gifLoopToggle.checked = state.gifLoop;
  if (ui.audioLoopToggle) ui.audioLoopToggle.checked = state.audioLoop;
  if (ui.webmLoopToggle) ui.webmLoopToggle.checked = state.webmLoop;
  if (ui.sceneAudioName) {
    ui.sceneAudioName.textContent = state.sceneAudioAsset?.name || "未设置音频";
    ui.sceneAudioName.classList.toggle("empty", !state.sceneAudioAsset);
  }
}

function normalizeSceneAudioAsset(asset) {
  if (typeof asset === "string") {
    return {
      key: asset,
      name: decodeURIComponent(asset.split("/").pop() || "scene-audio"),
      url: asset,
      type: inferAssetType(asset),
      size: 0,
    };
  }
  if (!asset || typeof asset !== "object") return null;
  const url = asset.url || asset.assetUrl || "";
  if (!url) return null;
  return {
    key: asset.key || asset.assetKey || url,
    name: asset.name || decodeURIComponent(url.split("/").pop() || "scene-audio"),
    url,
    type: asset.type || asset.assetType || inferAssetType(url),
    size: Number(asset.size || 0),
  };
}

function restartScenePlayback({ autoplay = false } = {}) {
  state.scenePlaybackToken += 1;
  state.sceneEnded = false;
  resetGifPlayback();
  restartSceneVideos({ autoplay });
  setupSceneAudio({ autoplay, restart: true });
}

function restartSceneVideos({ autoplay = false } = {}) {
  state.items.forEach((item) => {
    if (item.mediaType !== "video" || !item.media) return;
    item.media.loop = shouldLoopVideoItem(item);
    try {
      item.media.currentTime = 0;
    } catch {}
    if (autoplay && !state.paused) item.media.play?.().catch(() => {});
    else item.media.pause?.();
  });
}

function scenePlaybackUrl(url) {
  if (!url || /^(data|blob):/i.test(url)) return url;
  try {
    const next = new URL(url, window.location.href);
    next.searchParams.set("__scenePlay", String(state.scenePlaybackToken));
    return next.href;
  } catch {
    return url;
  }
}

function setupSceneAudio({ autoplay = false, restart = false } = {}) {
  syncSceneMediaControls();
  if (!ui.sceneAudio) return;
  ui.sceneAudio.loop = state.audioLoop;
  ui.sceneAudio.preload = "auto";
  if (!state.sceneAudioAsset || !isAudioAsset(state.sceneAudioAsset)) {
    ui.sceneAudio.pause();
    ui.sceneAudio.removeAttribute("src");
    ui.sceneAudio.load?.();
    return;
  }
  const nextSrc = new URL(state.sceneAudioAsset.url, window.location.href).href;
  if (ui.sceneAudio.src !== nextSrc) {
    ui.sceneAudio.pause();
    ui.sceneAudio.src = state.sceneAudioAsset.url;
  }
  if (restart) {
    try {
      ui.sceneAudio.currentTime = 0;
    } catch {}
  }
  if (autoplay && !state.paused) playSceneAudio({ restart });
}

function playSceneAudio({ restart = false } = {}) {
  if (!ui.sceneAudio || !state.sceneAudioAsset || state.paused) return;
  if (!restart && !state.audioLoop && isSceneAudioFinished()) return;
  if (restart) {
    try {
      ui.sceneAudio.currentTime = 0;
    } catch {}
  }
  ui.sceneAudio.loop = state.audioLoop;
  ui.sceneAudio.play?.().catch(() => {});
}

function isSceneAudioFinished() {
  if (!ui.sceneAudio) return false;
  if (ui.sceneAudio.ended) return true;
  const duration = Number(ui.sceneAudio.duration);
  return Number.isFinite(duration) && duration > 0 && ui.sceneAudio.currentTime >= duration - 0.05;
}

function hasFiniteScenePlayback() {
  const hasFiniteAudio = Boolean(state.sceneAudioAsset && !state.audioLoop);
  const hasFiniteGif = !state.gifLoop && state.items.some((item) => item.mediaType === "gif");
  const hasFiniteWebm = !state.webmLoop && state.items.some((item) => isWebmVideoItem(item));
  return hasFiniteAudio || hasFiniteGif || hasFiniteWebm;
}

function isScenePlaybackFinished() {
  if (!hasFiniteScenePlayback()) return false;
  const audioDone =
    !state.sceneAudioAsset || state.audioLoop || !ui.sceneAudio || ui.sceneAudio.ended || ui.sceneAudio.duration === 0;
  const gifDone =
    state.gifLoop ||
    state.items
      .filter((item) => item.mediaType === "gif")
      .every((item) => state.gifPlayers.get(item.id)?.ended === true || !("ImageDecoder" in window));
  const webmDone =
    state.webmLoop ||
    state.items
      .filter((item) => isWebmVideoItem(item))
      .every((item) => item.media?.ended === true || item.media?.duration === 0);
  return audioDone && gifDone && webmDone;
}

async function handleSceneMediaEnded() {
  if (!(isViewer || isFinal || isIntroDemo) || state.sceneEnded || !isScenePlaybackFinished()) return;
  state.sceneEnded = true;
  if (state.sceneFlow.mode === "auto" && state.sceneFlow.nextSceneId) {
    setLayoutStatus(`场景结束，正在进入：${getSceneLabel(state.sceneFlow.nextSceneId)}`);
    await switchScene(state.sceneFlow.nextSceneId);
    return;
  }
  if (state.sceneFlow.mode === "dialog") {
    setLayoutStatus("场景结束，等待玩家对话触发下一场景", "warn");
    setVoiceStatus("请说出选择，系统会按关键词进入下一场景。", "listening");
  }
}

function getSceneLabel(sceneId) {
  const scene = state.scenes.find((item) => item.id === sceneId);
  return scene?.name || sceneId;
}

function matchSceneFlowRoute(text) {
  const normalized = normalizeKeywordText(text);
  return state.sceneFlow.routes.find((route) => {
    if (!route.sceneId || !route.keywords) return false;
    return route.keywords
      .split(/[,\s，、|/]+/)
      .map((keyword) => normalizeKeywordText(keyword))
      .filter(Boolean)
      .some((keyword) => normalized.includes(keyword));
  });
}

function normalizeKeywordText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

async function triggerSceneFlowKeywordSwitch(text) {
  if (state.sceneFlow.mode !== "dialog") return "";
  if (!state.sceneEnded && hasFiniteScenePlayback()) return "";
  const route = matchSceneFlowRoute(text);
  if (!route?.sceneId || route.sceneId === state.currentSceneId) return "";
  await switchScene(route.sceneId);
  return route.sceneId;
}

async function switchScene(sceneId) {
  if (!sceneId) return;
  if (sceneId === state.currentSceneId) {
    if (isViewer || isFinal || isIntroDemo) restartScenePlayback({ autoplay: !state.paused });
    return;
  }
  if (isFinal) {
    await switchFinalScene(sceneId);
    return;
  }
  setLayoutStatus("正在切换场景");
  const loaded = await loadSceneById(sceneId);
  if (loaded || isViewer || isIntroDemo) updateSceneUrl();
}

async function switchSceneGroup(groupId) {
  if (!hasSceneGroup(groupId)) return;
  state.activeSceneGroupId = groupId;
  const group = getActiveSceneGroup();
  state.finalStartSceneId = hasScene(group.finalStartSceneId) ? group.finalStartSceneId : "default";
  renderSceneGroupOptions();
  renderFinalStartSceneOptions();
  renderSceneGroupStructure();
  await saveAppSettings();
  updateSceneUrl();
  if (state.finalStartSceneId !== state.currentSceneId) await switchScene(state.finalStartSceneId);
}

async function switchFinalSceneGroup(groupId) {
  if (!hasSceneGroup(groupId)) return;
  state.finalSceneGroupId = groupId;
  state.finalStartSceneId = getFinalSceneGroup().finalStartSceneId || "default";
  renderSceneGroupOptions();
  renderSceneGroupStructure();
  updateSceneUrl();
  await switchScene(state.finalStartSceneId);
}

async function createSceneGroup() {
  if (!isEditor) return;
  const name = window.prompt("请输入新场景组名称", "新场景组");
  if (!name?.trim()) return;
  const cleanName = name.trim().slice(0, 80);
  const sceneId = makeSceneId(`${cleanName}-起始场景`);
  const group = {
    id: makeSceneGroupId(`${cleanName}-${Date.now().toString(36)}`),
    name: cleanName,
    finalStartSceneId: sceneId,
  };
  state.sceneGroups = [...state.sceneGroups, group];
  state.activeSceneGroupId = group.id;
  resetEditorToBlankScene(sceneId, `${cleanName} 起始场景`);
  state.finalStartSceneId = sceneId;
  renderSceneGroupOptions();
  renderFinalStartSceneOptions();
  renderSceneGroupStructure();
  await saveLayoutNow();
  await saveAppSettings();
  updateSceneUrl();
}

function resetEditorToBlankScene(sceneId, sceneName) {
  clearSceneMedia();
  state.currentSceneId = sceneId;
  state.currentSceneName = sceneName;
  state.focal = 860;
  state.parallax = 92;
  state.showGrid = true;
  state.sceneAudioAsset = null;
  state.audioLoop = true;
  state.gifLoop = true;
  state.webmLoop = true;
  state.ageRequired = false;
  state.realtimeReply = false;
  state.sceneFlow = normalizeSceneFlow();
  state.sceneEnded = false;
  restartScenePlayback({ autoplay: false });
  ui.focalRange.value = String(valueToRange("focalRange", state.focal));
  ui.parallaxRange.value = String(valueToRange("parallaxRange", state.parallax));
  ui.gridToggle.checked = state.showGrid;
  if (ui.sceneNameInput) ui.sceneNameInput.value = sceneName;
  syncSceneMediaControls();
  syncSceneFlowControls();
  syncControls();
  renderLayerList();
}

async function renameActiveSceneGroup() {
  if (!isEditor) return;
  const group = getActiveSceneGroup();
  const name = window.prompt("请输入新的场景组名称", group.name);
  if (!name?.trim()) return;
  state.sceneGroups = state.sceneGroups.map((item) =>
    item.id === group.id ? { ...item, name: name.trim().slice(0, 80) } : item,
  );
  renderSceneGroupOptions();
  renderSceneGroupStructure();
  await saveAppSettings();
}

async function deleteActiveSceneGroup() {
  if (!isEditor) return;
  const group = getActiveSceneGroup();
  if (state.sceneGroups.length <= 1) {
    setLayoutStatus("至少需要保留一个场景组", "warn");
    return;
  }
  const groupScenes = getDeletableSceneIdsForGroup(group.id);
  const ok = window.confirm(
    `确定删除场景组“${group.name}”吗？\n将同时删除该组独占的 ${groupScenes.length} 个场景。其他场景组引用的场景会保留。`,
  );
  if (!ok) return;

  const remainingGroups = state.sceneGroups.filter((item) => item.id !== group.id);
  state.sceneGroups = remainingGroups;
  state.activeSceneGroupId = remainingGroups[0].id;
  if (state.finalSceneGroupId === group.id) state.finalSceneGroupId = remainingGroups[0].id;
  state.finalStartSceneId = getActiveSceneGroup().finalStartSceneId || "default";

  await Promise.all(groupScenes.map((sceneId) => deleteSceneLayout(sceneId)));
  await saveAppSettings();
  await loadSceneList();
  renderSceneGroupOptions();
  renderFinalStartSceneOptions();
  renderSceneGroupStructure();
  updateSceneUrl();
  await switchScene(state.finalStartSceneId);
}

function getDeletableSceneIdsForGroup(groupId) {
  const group = state.sceneGroups.find((item) => item.id === groupId);
  if (!group) return [];
  const groupSceneIds = new Set(buildSceneGroupGraph(group, { includeCurrent: false }).nodes);
  const remainingSceneIds = new Set();
  state.sceneGroups
    .filter((item) => item.id !== groupId)
    .forEach((item) =>
      buildSceneGroupGraph(item, { includeCurrent: false }).nodes.forEach((sceneId) => remainingSceneIds.add(sceneId)),
    );
  return [...groupSceneIds].filter((sceneId) => sceneId !== "default" && !remainingSceneIds.has(sceneId));
}

async function deleteSceneLayout(sceneId) {
  const response = await fetch(`/api/layout?id=${encodeURIComponent(sceneId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`delete scene failed: ${sceneId}`);
}

function updateSceneUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("scene", state.currentSceneId);
  const groupId = isFinal && !isIntroDemo ? state.finalSceneGroupId : state.activeSceneGroupId;
  if (groupId) url.searchParams.set("group", groupId);
  window.history.replaceState({}, "", url);
}

async function switchFinalScene(sceneId) {
  const token = (state.transitionToken += 1);
  const layout = await fetchSceneLayout(sceneId);
  if (!layout || token !== state.transitionToken) return;
  setLayoutStatus("正在预加载下一场景");
  const preloadedAssets = await preloadSceneAssets(layout);
  if (token !== state.transitionToken) return;

  pauseSceneMediaForTransition();
  const stage = document.querySelector(".final-stage");
  const ghost = createSceneGhost({ freeze: true });
  setLayoutStatus("正在准备下一场景");
  await delay(1000);
  if (token !== state.transitionToken) {
    ghost?.remove();
    return;
  }
  stage?.classList.add("scene-is-loading");
  await applySceneLayout(layout, sceneId, preloadedAssets);
  if (token !== state.transitionToken) {
    ghost?.remove();
    return;
  }
  await waitForNextSceneVisualReady();
  if (token !== state.transitionToken) {
    ghost?.remove();
    return;
  }
  updateSceneUrl();
  requestAnimationFrame(() => {
    stage?.classList.remove("scene-is-loading");
    stage?.classList.add("scene-clarifying");
    ghost?.classList.add("fading");
    requestAnimationFrame(() => stage?.classList.remove("scene-clarifying"));
    window.setTimeout(() => ghost?.remove(), 260);
  });
}

function createSceneGhost({ freeze = false } = {}) {
  if (!isFinal || !canvas.parentElement) return null;
  const ghost = document.createElement("div");
  ghost.className = `scene-ghost${freeze ? " frozen" : ""}`;

  const backdrop = document.createElement("img");
  backdrop.className = "scene-ghost-backdrop";
  backdrop.alt = "";
  backdrop.src = canvas.toDataURL("image/png");
  ghost.append(backdrop);

  state.gifElements.forEach((element) => {
    if (freeze) {
      const frame = document.createElement("canvas");
      frame.className = "gif-pause-frame scene-ghost-gif-frame";
      captureGifFrame(element, frame);
      frame.style.width = element.style.width;
      frame.style.height = element.style.height;
      frame.style.transform = element.style.transform;
      frame.style.zIndex = element.style.zIndex;
      frame.style.opacity = element.style.opacity;
      ghost.append(frame);
      return;
    }
    const clone = element.cloneNode(true);
    clone.classList.remove("paused");
    ghost.append(clone);
  });

  canvas.parentElement.append(ghost);
  return ghost;
}

function pauseSceneMediaForTransition() {
  state.items.forEach((item) => {
    if (item.mediaType === "video") item.media.pause?.();
  });
  ui.sceneAudio?.pause?.();
}

async function waitForNextSceneVisualReady() {
  updateHead();
  updateGifOverlays();
  await nextAnimationFrame();
  updateGifOverlays();
  const gifImages = [...state.gifElements.values()].filter((element) => element.tagName === "IMG");
  const gifReady = gifImages.map((image) => waitForImageElementReady(image));
  const videosReady = state.items
    .filter((item) => item.mediaType === "video")
    .map((item) => waitForVideoItemReady(item.media));
  await Promise.race([
    Promise.allSettled([...gifReady, ...videosReady]),
    delay(1800),
  ]);
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function waitForImageElementReady(image) {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      clearTimeout(timer);
      image.removeEventListener("load", done);
      image.removeEventListener("error", done);
    };
    const timer = setTimeout(done, 1500);
    image.addEventListener("load", done, { once: true });
    image.addEventListener("error", done, { once: true });
  });
}

function waitForVideoItemReady(video) {
  if (!video || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("loadeddata", done);
      video.removeEventListener("canplay", done);
      video.removeEventListener("error", done);
    };
    const timer = setTimeout(done, 1500);
    video.addEventListener("loadeddata", done, { once: true });
    video.addEventListener("canplay", done, { once: true });
    video.addEventListener("error", done, { once: true });
  });
}

async function preloadSceneAssets(layout) {
  const preloaded = new Map();
  const records = Array.isArray(layout.items) ? layout.items : [];
  const results = await Promise.allSettled(records.map((record) => preloadSceneItem(record, preloaded)));
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.warn(`[preload] 第 ${i + 1} 个素材加载失败：`, result.reason);
    }
  });
  const audioAsset = normalizeSceneAudioAsset(layout.scene?.audioAsset);
  if (audioAsset && isAudioAsset(audioAsset)) {
    await preloadAudioAsset(audioAsset.url).catch(() => {});
  }
  return preloaded;
}

async function preloadSceneItem(record, preloaded) {
  const asset = assetFromLayoutRecord(record);
  if (!asset.url) return;
  if (isVideoAsset(asset)) {
    const video = await preloadVideoAsset(asset);
    preloaded.set(asset.url, { type: "video", media: video });
    return;
  }
  const image = await preloadImageAsset(asset.url);
  preloaded.set(asset.url, { type: isGifAsset(asset) ? "gif" : "image", media: image });
}

function assetFromLayoutRecord(record) {
  const url = record.assetUrl || record.src || "";
  return {
    key: record.assetKey,
    name: record.name || decodeURIComponent(url.split("/").pop() || "asset"),
    url,
    type: record.assetType || inferAssetType(url),
    size: 0,
  };
}

function preloadImageAsset(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = async () => {
      try {
        await image.decode?.();
      } catch {}
      resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });
}

function preloadVideoAsset(asset) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let settled = false;
    const done = () => {
      if (settled || !video.videoWidth || !video.videoHeight) return;
      settled = true;
      cleanup();
      try {
        video.currentTime = 0;
      } catch {}
      resolve(video);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("video preload failed"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("loadeddata", done);
      video.removeEventListener("canplay", done);
      video.removeEventListener("error", fail);
    };
    const timer = setTimeout(() => {
      if (video.videoWidth && video.videoHeight) done();
      else fail();
    }, 7000);
    video.muted = true;
    video.loop = shouldLoopVideoAsset(asset);
    video.playsInline = true;
    video.preload = "auto";
    video.addEventListener("loadeddata", done);
    video.addEventListener("canplay", done);
    video.addEventListener("error", fail);
    video.src = asset.url;
    video.load();
  });
}

function preloadAudioAsset(url) {
  return new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const cleanup = () => {
      clearTimeout(timer);
      audio.removeEventListener("canplaythrough", done);
      audio.removeEventListener("loadedmetadata", done);
      audio.removeEventListener("error", done);
    };
    const timer = setTimeout(done, 4000);
    audio.preload = "auto";
    audio.addEventListener("canplaythrough", done);
    audio.addEventListener("loadedmetadata", done);
    audio.addEventListener("error", done);
    audio.src = url;
    audio.load();
  });
}

async function restoreLayoutItems(items, preloadedAssets = new Map()) {
  clearSceneMedia();
  for (const record of items) {
    const asset = assetFromLayoutRecord(record);
    if (!asset.url) continue;

    let item;
    const preloaded = preloadedAssets.get(asset.url);
    if (isVideoAsset(asset) && preloaded?.media) {
      item = createReadyVideoItem(asset, preloaded.media);
    } else if (!isVideoAsset(asset) && preloaded?.media) {
      item = createReadyImageItem(asset, preloaded.media);
    } else if (isVideoAsset(asset)) {
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
  state.selectedId = isEditor ? state.items[0]?.id ?? null : null;
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
  state.gifPlayers.forEach((player) => releaseGifPlayer(player));
  state.gifPlayers.clear();
  state.gifPauseFrames.forEach((frame) => frame.remove());
  state.gifPauseFrames.clear();
  state.items = [];
  state.selectedId = null;
}

function resetGifPlayback() {
  state.gifElements.forEach((element) => element.remove());
  state.gifElements.clear();
  state.gifPlayers.forEach((player) => releaseGifPlayer(player));
  state.gifPlayers.clear();
  state.gifPauseFrames.forEach((frame) => frame.remove());
  state.gifPauseFrames.clear();
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
    name:
      state.currentSceneId === "default"
        ? "默认场景"
        : ui.sceneNameInput?.value?.trim() || state.currentSceneName,
    scene: {
      focal: state.focal,
      parallax: state.parallax,
      showGrid: state.showGrid,
      audioAsset: state.sceneAudioAsset,
      audioLoop: state.audioLoop,
      gifLoop: state.gifLoop,
      webmLoop: state.webmLoop,
      flow: state.sceneFlow,
      xfyunVoice: state.xfyunVoice,
      ageRequired: state.ageRequired,
      realtimeReply: state.realtimeReply,
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

function getLayoutSaveSignature(payload = serializeLayout()) {
  return JSON.stringify(payload);
}

function scheduleSaveLayout() {
  if (state.loadingScene || !isEditor) return;
  const signature = getLayoutSaveSignature();
  if (signature === state.lastLayoutSaveSignature && !state.layoutSaveTimer) return;
  state.pendingLayoutSaveSignature = signature;
  clearTimeout(state.layoutSaveTimer);
  setLayoutStatus("有更改，准备自动保存", "warn");
  state.layoutSaveTimer = setTimeout(() => saveLayoutNow(), 650);
}

async function saveLayoutNow() {
  if (!isEditor) return;
  try {
    const payload = serializeLayout();
    const response = await fetch("/api/layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("save failed");
    const result = await response.json();
    state.currentSceneId = result.id || state.currentSceneId;
    state.currentSceneName = result.name || payload.name;
    state.lastLayoutSaveSignature = state.pendingLayoutSaveSignature || getLayoutSaveSignature(payload);
    state.pendingLayoutSaveSignature = "";
    await loadSceneList();
    syncSceneControls();
    setLayoutStatus(`已保存：${state.currentSceneName}`, "good");
  } catch {
    setLayoutStatus("布局保存失败，请确认使用 node server.js 启动", "warn");
  }
}

async function saveAsLayout() {
  if (!isEditor) return;
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

function makeSceneGroupId(name) {
  return (
    String(name || "default-group")
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "default-group"
  );
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
  if (/\.jpe?g$/i.test(url)) return "image/jpeg";
  if (/\.webp$/i.test(url)) return "image/webp";
  if (/\.mov$/i.test(url)) return "video/quicktime";
  if (/\.webm$/i.test(url)) return "video/webm";
  if (/\.mp4$/i.test(url)) return "video/mp4";
  if (/\.mp3$/i.test(url)) return "audio/mpeg";
  if (/\.wav$/i.test(url)) return "audio/wav";
  if (/\.ogg$/i.test(url)) return "audio/ogg";
  if (/\.m4a$/i.test(url)) return "audio/mp4";
  if (/\.aac$/i.test(url)) return "audio/aac";
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
    if (item.id === state.selectedId && isEditor) drawSelection(projection, w, h, item.rotation);
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

  if (selected && isEditor) drawSelection(projection, w, h, item.rotation);
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
    const element = ensureGifOverlayElement(item);

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
      item.id === state.selectedId && isEditor ? "2px dashed rgba(139,215,197,0.9)" : "0";
    element.classList.toggle("paused", state.paused);
    syncGifPauseFrame(item.id, element);
    if (element.tagName === "CANVAS") advanceGifPlayer(item.id);
  });

  for (const [id, element] of state.gifElements) {
    if (visibleGifIds.has(id)) continue;
    element.remove();
    state.gifElements.delete(id);
    state.gifPauseFrames.get(id)?.remove();
    state.gifPauseFrames.delete(id);
    releaseGifPlayer(state.gifPlayers.get(id));
    state.gifPlayers.delete(id);
  }
}

function ensureGifOverlayElement(item) {
  const shouldUseCanvas = !state.gifLoop && "ImageDecoder" in window;
  let element = state.gifElements.get(item.id);
  const needsReplacement =
    !element || (shouldUseCanvas && element.tagName !== "CANVAS") || (!shouldUseCanvas && element.tagName !== "IMG");

  if (needsReplacement) {
    element?.remove();
    state.gifPauseFrames.get(item.id)?.remove();
    state.gifPauseFrames.delete(item.id);
    releaseGifPlayer(state.gifPlayers.get(item.id));
    state.gifPlayers.delete(item.id);

    element = document.createElement(shouldUseCanvas ? "canvas" : "img");
    element.className = "gif-layer";
    element.alt = "";
    if (!shouldUseCanvas) element.src = scenePlaybackUrl(item.assetUrl || item.src);
    ui.mediaOverlay.append(element);
    state.gifElements.set(item.id, element);

    if (shouldUseCanvas) {
      const player = {
        id: item.id,
        canvas: element,
        context: element.getContext("2d"),
        frames: [],
        index: 0,
        lastAt: performance.now(),
        ended: false,
        decoding: true,
        cancelled: false,
        source: scenePlaybackUrl(item.assetUrl || item.src),
      };
      state.gifPlayers.set(item.id, player);
      decodeGifFrames(player);
    }
  }

  return element;
}

async function decodeGifFrames(player) {
  try {
    const response = await fetch(player.source);
    const bytes = await response.arrayBuffer();
    const decoder = new ImageDecoder({ data: bytes, type: "image/gif" });
    await decoder.tracks.ready;
    const frameCount = decoder.tracks.selectedTrack?.frameCount || 1;
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      if (player.cancelled) break;
      const { image } = await decoder.decode({ frameIndex });
      const bitmap = await createImageBitmap(image);
      const duration = normalizeGifFrameDuration(image.duration);
      image.close?.();
      if (player.cancelled) bitmap.close?.();
      else player.frames.push({ bitmap, duration });
    }
    player.decoding = false;
    if (!player.cancelled) drawGifPlayerFrame(player);
  } catch {
    player.decoding = false;
    player.failed = true;
    if (!player.cancelled) fallbackGifPlayerToImage(player);
  }
}

function fallbackGifPlayerToImage(player) {
  const current = state.gifElements.get(player.id);
  if (current !== player.canvas) return;
  const image = document.createElement("img");
  image.className = "gif-layer";
  image.alt = "";
  image.src = player.source;
  player.canvas.replaceWith(image);
  state.gifElements.set(player.id, image);
  releaseGifPlayer(player);
  state.gifPlayers.delete(player.id);
}

function normalizeGifFrameDuration(duration) {
  const fallback = 100;
  if (!Number.isFinite(duration) || duration <= 0) return fallback;
  return duration > 1000 ? Math.max(20, duration / 1000) : Math.max(20, duration);
}

function advanceGifPlayer(id) {
  const player = state.gifPlayers.get(id);
  if (!player || !player.frames.length) return;
  if (state.paused || player.ended) {
    drawGifPlayerFrame(player);
    return;
  }

  const now = performance.now();
  const current = player.frames[player.index];
  if (now - player.lastAt >= current.duration) {
    player.lastAt = now;
    if (player.index >= player.frames.length - 1) {
      if (state.gifLoop) {
        player.index = 0;
      } else {
        player.index = player.frames.length - 1;
        player.ended = true;
        handleSceneMediaEnded();
      }
    } else {
      player.index += 1;
    }
  }
  drawGifPlayerFrame(player);
}

function drawGifPlayerFrame(player) {
  const frame = player.frames[player.index];
  if (!frame || !player.context) return;
  const width = frame.bitmap.width || 1;
  const height = frame.bitmap.height || 1;
  if (player.canvas.width !== width || player.canvas.height !== height) {
    player.canvas.width = width;
    player.canvas.height = height;
  }
  player.context.clearRect(0, 0, width, height);
  player.context.drawImage(frame.bitmap, 0, 0, width, height);
}

function releaseGifPlayer(player) {
  if (!player) return;
  player.cancelled = true;
  player.frames.forEach((frame) => frame.bitmap?.close?.());
  player.frames = [];
}

function syncGifPauseFrame(id, element) {
  let frame = state.gifPauseFrames.get(id);
  if (!state.paused) {
    frame?.remove();
    state.gifPauseFrames.delete(id);
    resumeGifElement(element);
    return;
  }

  if (!frame) {
    frame = document.createElement("canvas");
    frame.className = "gif-pause-frame";
    ui.mediaOverlay.append(frame);
    state.gifPauseFrames.set(id, frame);
    captureGifFrame(element, frame);
    pauseGifElement(element);
  }

  frame.style.width = element.style.width;
  frame.style.height = element.style.height;
  frame.style.transform = element.style.transform;
  frame.style.zIndex = element.style.zIndex;
  frame.style.opacity = element.style.opacity;
}

function captureGifFrame(element, frame) {
  const width = Math.max(1, element.naturalWidth || element.clientWidth || 1);
  const height = Math.max(1, element.naturalHeight || element.clientHeight || 1);
  frame.width = width;
  frame.height = height;
  const frameContext = frame.getContext("2d");
  frameContext.clearRect(0, 0, width, height);
  try {
    frameContext.drawImage(element, 0, 0, width, height);
  } catch {}
}

function pauseGifElement(element) {
  if (!element.src) return;
  element.dataset.playSrc = element.currentSrc || element.src;
  element.removeAttribute("src");
}

function resumeGifElement(element) {
  const src = element.dataset.playSrc;
  if (!src || element.src) return;
  element.src = src;
}

function togglePlayback() {
  const wasPaused = state.paused;
  state.paused = !state.paused;
  ui.playPauseButton?.classList.toggle("paused", state.paused);
  ui.playPauseButton?.classList.toggle("playing", !state.paused);
  ui.playPauseButton?.setAttribute("aria-label", state.paused ? "播放画面" : "暂停画面");
  if (!state.paused) {
    if (isIntroEmbed && wasPaused) restartScenePlayback({ autoplay: true });
    state.gifPauseFrames.forEach((frame) => frame.remove());
    state.gifPauseFrames.clear();
    state.gifElements.forEach((element) => resumeGifElement(element));
  } else {
    state.gifElements.forEach((element, id) => {
      let frame = state.gifPauseFrames.get(id);
      if (!frame) {
        frame = document.createElement("canvas");
        frame.className = "gif-pause-frame";
        ui.mediaOverlay.append(frame);
        state.gifPauseFrames.set(id, frame);
      }
      captureGifFrame(element, frame);
      pauseGifElement(element);
    });
  }
  state.items.forEach((item) => {
    if (item.mediaType !== "video") return;
    if (state.paused) item.media.pause?.();
    else {
      item.media.loop = shouldLoopVideoItem(item);
      if (item.media.ended) {
        try {
          item.media.currentTime = 0;
        } catch {}
      }
      item.media.play?.().catch(() => {});
    }
  });
  if (ui.sceneAudio) {
    if (state.paused) ui.sceneAudio.pause();
    else playSceneAudio();
  }
  if (isFinal) {
    if (state.paused) showFinalGroupRail();
    else scheduleFinalGroupRailHide(1500);
  }
}

function closeFinalIntroModal() {
  if (!ui.finalIntroModal || ui.finalIntroModal.hidden) return;
  ui.finalIntroModal.hidden = true;
  if (isFinal && !state.paused) scheduleFinalGroupRailHide(1500);
}

function showFinalGroupRail() {
  if (!ui.finalGroupRail) return;
  clearTimeout(state.finalGroupRailTimer);
  ui.finalGroupRail.classList.remove("is-collapsed");
}

function resetFinalPlaybackState() {
  if (!isFinal) return;
  state.paused = true;
  ui.playPauseButton?.classList.add("paused");
  ui.playPauseButton?.classList.remove("playing");
  ui.playPauseButton?.setAttribute("aria-label", "鎾斁鐢婚潰");
  showFinalGroupRail();
}

function scheduleFinalGroupRailHide(delay = 1000) {
  if (!ui.finalGroupRail || !isFinal) return;
  clearTimeout(state.finalGroupRailTimer);
  state.finalGroupRailTimer = window.setTimeout(() => {
    if (state.paused) return;
    ui.finalGroupRail.classList.add("is-collapsed");
  }, delay);
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
  const scale = clamp(state.focal / Math.max(220, depth), 0.28, 2.2) * (isIntroEmbed ? introEmbedProjectionScale : 1);
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
  if (!ui.layerList) return;
  const fragment = document.createDocumentFragment();
  const nearFirst = [...state.items].sort((a, b) => a.z - b.z);
  for (const item of nearFirst) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `layer-item${item.id === state.selectedId ? " selected" : ""}`;
    button.dataset.layerId = item.id;

    const thumb = document.createElement("span");
    thumb.className = "layer-thumb";
    thumb.style.backgroundImage = `url("${String(item.thumbnail || "").replace(/"/g, "%22")}")`;

    const copy = document.createElement("span");
    copy.className = "layer-copy";
    const name = document.createElement("span");
    name.className = "layer-name";
    name.textContent = item.name;
    const status = document.createElement("span");
    status.className = "layer-status";
    status.textContent = item.status || item.mediaType;
    copy.append(name, status);

    const depth = document.createElement("span");
    depth.className = "layer-depth";
    depth.textContent = String(Math.round(item.z));

    button.append(thumb, copy, depth);
    fragment.append(button);
  }
  ui.layerList.replaceChildren(fragment);
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
  for (let i = 0; i < samples.length; i++) {
    const centered = (samples[i] - 128) / 128;
    sum += centered * centered;
    const abs = centered < 0 ? -centered : centered;
    if (abs > peak) peak = abs;
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
  if (isFinal) {
    state.voice.busy = true;
    state.voice.listening = false;
    ui.voiceButton.classList.remove("active");
    ui.voiceButton.textContent = "生成中";
    setVoiceStatus("正在生成回应", "thinking");
    ui.voiceTranscript.textContent = text;
    let switched = "";
    try {
      switched = await triggerSceneFlowKeywordSwitch(text);
      if (!switched) switched = await triggerKeywordSceneSwitch(text);
      if (!state.realtimeReply) {
        const reply = switched ? "" : makeFinalReply(text, switched);
        ui.voiceReply.textContent = reply;
        updateCaption(reply);
        state.voice.conversation.push({ role: "user", content: text }, { role: "assistant", content: reply });
        state.voice.conversation = state.voice.conversation.slice(-10);
        setVoiceStatus(switched ? "场景已切换，未调用实时回复" : "未调用实时回复");
        return;
      }
      const cue = await getDirectorCue(text);
      await applyCueFlow(cue);
      const reply = cue.reply || makeFinalReply(text, switched);
      ui.voiceReply.textContent = reply;
      updateCaption(reply);
      speakReply(reply);
      state.voice.conversation.push({ role: "user", content: text }, { role: "assistant", content: reply });
      state.voice.conversation = state.voice.conversation.slice(-10);
      if (cue.nextBeat && scriptBeats[cue.nextBeat]) ui.scriptBeatSelect.value = cue.nextBeat;
      setVoiceStatus(switched ? "场景已切换，回应已生成" : "回应已生成");
    } catch (error) {
      const reply = makeFinalReply(text, switched);
      ui.voiceReply.textContent = reply;
      updateCaption(reply);
      speakReply(reply);
      setVoiceStatus(error.message || "Kimi 暂不可用，已使用本地回应", "error");
    } finally {
      state.voice.busy = false;
      ui.voiceButton.textContent = "语音";
      if (ui.voiceTextInput) ui.voiceTextInput.value = "";
    }
    return;
  }
  state.voice.busy = true;
  state.voice.listening = false;
  ui.voiceButton.classList.remove("active");
  ui.voiceButton.textContent = "生成中";
  setVoiceStatus("正在根据剧本走向生成回应", "thinking");

  try {
    if (!state.realtimeReply) {
      const fallback = makeLocalDirectorCue(text);
      applyDirectorCue(fallback);
      ui.voiceReply.textContent = fallback.reply;
      updateCaption(fallback.reply);
      state.voice.conversation.push({ role: "user", content: text }, { role: "assistant", content: fallback.reply });
      state.voice.conversation = state.voice.conversation.slice(-10);
      setVoiceStatus("未调用实时回复，已使用本地规则");
      return;
    }
    const cue = await getDirectorCue(text);
    await applyCueFlow(cue);
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

async function getDirectorCue(text, overrides = {}) {
  const clientStartedAt = performance.now();
  const scenePayload = {
    id: state.currentSceneId,
    ageRequired: state.ageRequired,
    nextSceneId: state.sceneFlow.nextSceneId,
    ...(overrides.scene || {}),
  };
  const response = await fetch(state.voice.directorEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      beatKey: ui.scriptBeatSelect.value,
      conversation: state.voice.conversation.slice(-6),
      scene: scenePayload,
      variables: overrides.variables || state.userVariables,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const clientMs = Math.round(performance.now() - clientStartedAt);
    if (payload.timing) {
      renderKimiDebug({
        response: payload,
        timing: {
          ...payload.timing,
          clientMs,
        },
      });
    }
    const message = payload.message || payload.error || response.statusText;
    throw new Error(`Kimi 请求失败：${response.status} ${message}（网页等待 ${formatDuration(clientMs)}）`);
  }

  const payload = await response.json();
  const clientMs = Math.round(performance.now() - clientStartedAt);
  if (payload.debug) {
    payload.debug.timing = {
      ...(payload.debug.timing || {}),
      clientMs,
    };
  }
  renderKimiDebug(payload.debug);
  const serverMs = payload.debug?.timing?.upstreamMs;
  setVoiceStatus(
    `Kimi 已返回：网页等待 ${formatDuration(clientMs)}${serverMs ? `，服务端 ${formatDuration(serverMs)}` : ""}`,
  );
  if (payload.cue) return payload.cue;
  const content = payload.choices?.[0]?.message?.content ?? "";
  return parseDirectorCue(content) ?? makeLocalDirectorCue(text);
}

async function applyCueFlow(cue) {
  const flow = cue?.flow;
  if (!flow || typeof flow !== "object") return;

  if (flow.variables && typeof flow.variables === "object") {
    state.userVariables = { ...state.userVariables, ...flow.variables };
  }

  if (flow.user_age !== undefined) {
    const age = Number(flow.user_age);
    if (Number.isFinite(age)) state.userVariables.user_age = age;
  }

  if (flow.ageRequired && flow.feedbackSceneId) {
    state.pendingAgeFlow = {
      feedbackSceneId: flow.feedbackSceneId,
      sourceSceneId: flow.sourceSceneId || state.currentSceneId,
      successNextSceneId: flow.successNextSceneId || "",
      ageExtracted: Boolean(flow.ageExtracted),
      user_age: flow.user_age ?? state.userVariables.user_age ?? null,
      handled: false,
    };
    await switchScene(flow.feedbackSceneId);
    return;
  }

  if (flow.ageExtracted && flow.nextSceneId) {
    await switchScene(flow.nextSceneId);
  }
}

function maybeRunPendingAgeFeedback() {
  const flow = state.pendingAgeFlow;
  if (!flow || flow.handled || flow.feedbackSceneId !== state.currentSceneId) return;
  flow.handled = true;
  runPendingAgeFeedback(flow).catch((error) => {
    setVoiceStatus(error.message || "年龄反馈流程失败", "error");
  });
}

async function runPendingAgeFeedback(flow) {
  const prompt = flow.ageExtracted
    ? `年龄已获取：${flow.user_age}岁。请直接回应并复述年龄。`
    : "年龄没有获取到。请直接要求用户必须告诉年龄。";
  const cue = await getDirectorCue(prompt, {
    scene: {
      id: state.currentSceneId,
      ageFeedback: true,
      ageExtracted: flow.ageExtracted,
      user_age: flow.user_age,
      sourceSceneId: flow.sourceSceneId,
      successNextSceneId: flow.successNextSceneId,
    },
    variables: state.userVariables,
  });
  const reply = cue.reply || makeT5LocalReply(flow.user_age, flow.ageExtracted);
  ui.voiceReply.textContent = reply;
  updateCaption(reply);
  const ttsPromise = speakReply(reply);
  state.voice.conversation.push({ role: "user", content: prompt }, { role: "assistant", content: reply });
  state.voice.conversation = state.voice.conversation.slice(-10);
  await Promise.all([ttsPromise, waitForScenePlaybackComplete()]);

  const nextSceneId = flow.ageExtracted
    ? flow.successNextSceneId || state.sceneFlow.nextSceneId
    : flow.sourceSceneId;
  state.pendingAgeFlow = null;
  if (nextSceneId) await switchScene(nextSceneId);
}

function waitForScenePlaybackComplete() {
  if (!hasFiniteScenePlayback() || isScenePlaybackFinished()) return Promise.resolve();
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const check = () => {
      if (isScenePlaybackFinished() || Date.now() - startedAt > 45000) {
        resolve();
        return;
      }
      setTimeout(check, 180);
    };
    check();
  });
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
        timing: debug.timing,
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

async function triggerKeywordSceneSwitch(text) {
  const normalized = String(text || "").trim();
  const targetAlias = /火/.test(normalized) ? "scene2" : /水/.test(normalized) ? "scene3" : "";
  if (!targetAlias) return "";
  const sceneId = resolveSceneAlias(targetAlias);
  if (!sceneId || sceneId === state.currentSceneId) return "";
  await switchScene(sceneId);
  return targetAlias;
}

function makeFinalReply(text, switched) {
  if (state.ageRequired) {
    const age = extractAgeFromText(text);
    return makeT5LocalReply(age, Boolean(age));
  }
  if (switched === "scene2") return "火。可以，但动作要快。";
  if (switched === "scene3") return "水更重要。先确认能不能喝。";
  if (switched) return "";
  return text ? "我听见了。继续说重点。" : "先说你的选择。";
}

function makeT5LocalReply(age, hasAge) {
  const variants = hasAge
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

function extractAgeFromText(text) {
  const value = String(text || "");
  const direct = value.match(/(?:我)?\s*(?:今年)?\s*(\d{1,3})\s*(?:岁|歲|周岁|周歲|了)?/);
  if (!direct) return null;
  const age = Number(direct[1]);
  return age >= 1 && age <= 120 ? age : null;
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

function normalizeXfyunVoice(value) {
  const allowed = new Set([
    "x6_lingfeiyi_pro",
    "x6_lingxiaoxuan_pro",
    "x6_lingyuyan_pro",
    "x6_lingbosong_pro",
  ]);
  return allowed.has(value) ? value : "x6_lingfeiyi_pro";
}

function speakReply(text) {
  const promise = playXfyunTts(text).catch((error) => {
    setVoiceStatus(`讯飞语音合成失败：${error.message}`, "error");
  });
  state.activeTts = promise;
  return promise;
}

async function playXfyunTts(text) {
  if (!text) return;
  setVoiceStatus("正在用讯飞聆飞逸合成语音", "thinking");
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, voice: state.xfyunVoice }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || payload.error || response.statusText);
  }

  const blob = await response.blob();
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);
  audio.addEventListener("ended", () => URL.revokeObjectURL(audioUrl), { once: true });
  audio.addEventListener("error", () => URL.revokeObjectURL(audioUrl), { once: true });
  await audio.play();
  await new Promise((resolve) => {
    audio.addEventListener("ended", resolve, { once: true });
    audio.addEventListener("error", resolve, { once: true });
  });
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

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value) {
  return (value * 180) / Math.PI;
}

function makeId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function formatDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value)) return "--";
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}
