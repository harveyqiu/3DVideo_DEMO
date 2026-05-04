const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d", { alpha: false });

const ui = {
  fileInput: document.querySelector("#fileInput"),
  cameraButton: document.querySelector("#cameraButton"),
  autoLayoutButton: document.querySelector("#autoLayoutButton"),
  exportButton: document.querySelector("#exportButton"),
  deleteButton: document.querySelector("#deleteButton"),
  layerList: document.querySelector("#layerList"),
  cameraPreview: document.querySelector("#cameraPreview"),
  cameraSelect: document.querySelector("#cameraSelect"),
  cameraDiagnostics: document.querySelector("#cameraDiagnostics"),
  trackingState: document.querySelector("#trackingState"),
  trackingMeta: document.querySelector("#trackingMeta"),
  focalRange: document.querySelector("#focalRange"),
  parallaxRange: document.querySelector("#parallaxRange"),
  gridToggle: document.querySelector("#gridToggle"),
  xRange: document.querySelector("#xRange"),
  yRange: document.querySelector("#yRange"),
  zRange: document.querySelector("#zRange"),
  scaleRange: document.querySelector("#scaleRange"),
  rotationRange: document.querySelector("#rotationRange"),
  tiltRange: document.querySelector("#tiltRange"),
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
};

const controls = [
  ["xRange", "x", Number],
  ["yRange", "y", Number],
  ["zRange", "z", Number],
  ["scaleRange", "scale", (value) => Number(value) / 100],
  ["rotationRange", "rotation", (value) => degreesToRadians(Number(value))],
  ["tiltRange", "tilt", (value) => degreesToRadians(Number(value))],
];

init();

function init() {
  seedDemoImages();
  bindEvents();
  resize();
  syncControls();
  requestAnimationFrame(draw);
}

function bindEvents() {
  window.addEventListener("resize", resize);

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
  });

  ui.exportButton.addEventListener("click", exportFrame);
  ui.deleteButton.addEventListener("click", deleteSelected);

  ui.focalRange.addEventListener("input", () => {
    state.focal = Number(ui.focalRange.value);
  });
  ui.parallaxRange.addEventListener("input", () => {
    state.parallax = Number(ui.parallaxRange.value);
  });
  ui.gridToggle.addEventListener("change", () => {
    state.showGrid = ui.gridToggle.checked;
  });

  for (const [id, key, parse] of controls) {
    ui[id].addEventListener("input", () => {
      const selected = getSelected();
      if (!selected) return;
      selected[key] = parse(ui[id].value);
      renderLayerList();
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
  const valid = files.filter((file) => /image\/(png|gif)/.test(file.type));
  const loaded = await Promise.all(valid.map(loadItemFromFile));
  const baseIndex = state.items.length;
  loaded.forEach((item, index) => {
    const angle = (baseIndex + index) * 1.17;
    Object.assign(item, {
      x: Math.cos(angle) * 190,
      y: Math.sin(angle * 0.8) * 105,
      z: -120 + ((baseIndex + index) % 6) * 180,
      scale: 0.82 + ((baseIndex + index) % 3) * 0.12,
      rotation: degreesToRadians(((baseIndex + index) % 5 - 2) * 5),
      tilt: degreesToRadians(((baseIndex + index) % 4 - 1.5) * 11),
    });
    state.items.push(item);
    state.selectedId = item.id;
  });
  syncControls();
  renderLayerList();
}

function loadItemFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve(createItem(file.name, url, image));
    };
    image.onerror = reject;
    image.src = url;
  });
}

function createItem(name, src, image) {
  const maxSide = Math.max(image.naturalWidth, image.naturalHeight, 1);
  const base = clamp(260 / maxSide, 0.28, 1.1);
  return {
    id: makeId(),
    name,
    src,
    image,
    x: 0,
    y: 0,
    z: 0,
    scale: base,
    rotation: 0,
    tilt: 0,
    alpha: 1,
  };
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
      const item = createItem(demo.name, image.src, image);
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
  const projection = project(item);
  const w = item.image.naturalWidth * item.scale * projection.scale;
  const h = item.image.naturalHeight * item.scale * projection.scale;
  const selected = item.id === state.selectedId;
  const yaw = item.tilt + state.currentHead.x * 0.18 - item.x * 0.00018;
  const squash = clamp(Math.cos(yaw), 0.45, 1);
  const skew = Math.sin(yaw) * 0.16;

  ctx.save();
  ctx.translate(projection.x, projection.y);
  ctx.rotate(item.rotation + state.currentHead.x * 0.035);
  ctx.transform(squash, 0, skew, 1, 0, 0);

  ctx.shadowColor = "rgba(0,0,0,0.42)";
  ctx.shadowBlur = clamp(35 * projection.scale, 10, 44);
  ctx.shadowOffsetY = clamp(22 * projection.scale, 7, 30);
  roundRectPath(-w / 2 - 7, -h / 2 - 7, w + 14, h + 14, 8);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.globalAlpha = item.alpha;
  roundRectPath(-w / 2, -h / 2, w, h, 7);
  ctx.clip();
  ctx.drawImage(item.image, -w / 2, -h / 2, w, h);
  ctx.globalAlpha = 1;

  const shine = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  shine.addColorStop(0, "rgba(255,255,255,0.20)");
  shine.addColorStop(0.36, "rgba(255,255,255,0.03)");
  shine.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = shine;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();

  if (selected) drawSelection(projection, w, h, item.rotation);
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
    const w = item.image.naturalWidth * item.scale * projection.scale;
    const h = item.image.naturalHeight * item.scale * projection.scale;
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
      <span class="layer-thumb" style="background-image:url('${item.src}')"></span>
      <span class="layer-name">${escapeHTML(item.name)}</span>
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
  for (const [id] of controls) ui[id].disabled = disabled;
  ui.deleteButton.disabled = disabled;
  if (!selected) return;
  ui.xRange.value = Math.round(selected.x);
  ui.yRange.value = Math.round(selected.y);
  ui.zRange.value = Math.round(selected.z);
  ui.scaleRange.value = Math.round(selected.scale * 100);
  ui.rotationRange.value = Math.round(radiansToDegrees(selected.rotation));
  ui.tiltRange.value = Math.round(radiansToDegrees(selected.tilt));
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
}

function deleteSelected() {
  const selected = getSelected();
  if (!selected) return;
  state.items = state.items.filter((item) => item.id !== selected.id);
  state.selectedId = state.items[0]?.id ?? null;
  syncControls();
  renderLayerList();
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
