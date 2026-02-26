import * as THREE from "./vendor/three/build/three.module.js";
import { GLTFLoader } from "./vendor/three/examples/jsm/loaders/GLTFLoader.js";

import { buildWorldObjects } from "./worldObjects.js";

const BASE = "/heli-game";

// ----------------------------------------------------
// LOADING OVERLAY (создаём прямо из JS, без правки HTML)
// ----------------------------------------------------
function ensureLoadingUI() {
  let wrap = document.getElementById("loading");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "loading";
    wrap.style.position = "fixed";
    wrap.style.left = "0";
    wrap.style.top = "0";
    wrap.style.right = "0";
    wrap.style.bottom = "0";
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "center";
    wrap.style.flexDirection = "column";
    wrap.style.background = "#0b1220";
    wrap.style.color = "white";
    wrap.style.zIndex = "9999";
    wrap.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    wrap.style.userSelect = "none";

    const title = document.createElement("div");
    title.textContent = "Загрузка…";
    title.style.fontSize = "22px";
    title.style.marginBottom = "10px";
    title.style.opacity = "0.9";

    const barWrap = document.createElement("div");
    barWrap.style.width = "min(420px, 80vw)";
    barWrap.style.height = "10px";
    barWrap.style.borderRadius = "999px";
    barWrap.style.background = "rgba(255,255,255,0.15)";
    barWrap.style.overflow = "hidden";

    const bar = document.createElement("div");
    bar.id = "loadingBar";
    bar.style.height = "100%";
    bar.style.width = "0%";
    bar.style.background = "rgba(255,255,255,0.9)";
    bar.style.borderRadius = "999px";

    barWrap.appendChild(bar);

    const pct = document.createElement("div");
    pct.id = "loadingPct";
    pct.textContent = "0%";
    pct.style.marginTop = "10px";
    pct.style.opacity = "0.85";

    wrap.appendChild(title);
    wrap.appendChild(barWrap);
    wrap.appendChild(pct);

    document.body.appendChild(wrap);
  }

  return wrap;
}

const loadingUI = ensureLoadingUI();
const loadingBar = document.getElementById("loadingBar");
const loadingPct = document.getElementById("loadingPct");

// ---------------- TIMER (без setInterval) ----------------
const timerEl = document.getElementById("timer");
let gameStartTime = 0;

// ---------------- SCENE ----------------
const canvas = document.getElementById("game");
if (!canvas) throw new Error("No canvas#game");

// чтобы на мобилках не скроллило/не зумило при управлении
canvas.style.touchAction = "none";
document.body.style.touchAction = "none";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 80, 700);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2500);

const isTouchDevice =
  ("ontouchstart" in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

// =========================================================
// AUTO QUALITY (NEW) — добавлено, остальной код не трогаю
// =========================================================
const dpr = devicePixelRatio || 1;
const cpuCores = navigator.hardwareConcurrency || 4;
const smallScreen = Math.min(window.innerWidth, window.innerHeight) <= 820;

// эвристика “слабого девайса” (можешь потом подкрутить)
const isLowEnd =
  (isTouchDevice && (dpr >= 2.5 || cpuCores <= 4 || smallScreen)) ||
  (cpuCores <= 2);

const QUALITY = isLowEnd ? "low" : "high";

// параметры качества
const qualitySettings = {
  pixelRatio: Math.min(dpr, isLowEnd ? 1.0 : 2.0),
  antialias: !isTouchDevice && !isLowEnd,
  shadows: !isLowEnd,                // low: тени выключаем
  shadowMapSize: isLowEnd ? 1024 : 2048,
  cameraFar: isLowEnd ? 1400 : 2500, // low: меньше дальность
  fogNear: 80,
  fogFar: isLowEnd ? 520 : 700,      // low: туман ближе
};

// применяем камеру/туман до рендера
camera.far = qualitySettings.cameraFar;
camera.updateProjectionMatrix();

scene.fog.near = qualitySettings.fogNear;
scene.fog.far = qualitySettings.fogFar;
// =========================================================

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: qualitySettings.antialias,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(qualitySettings.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = qualitySettings.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------------- LIGHT ----------------
scene.add(new THREE.HemisphereLight(0xffffff, 0x3b4b3b, 1.0));

const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(80, 140, 60);
sun.castShadow = qualitySettings.shadows;

sun.shadow.mapSize.set(qualitySettings.shadowMapSize, qualitySettings.shadowMapSize);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 800;
sun.shadow.camera.left = -260;
sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260;
sun.shadow.camera.bottom = -260;
scene.add(sun);

// ---------------- GROUND ----------------
const GROUND_Y = -2;

const groundMat = new THREE.MeshStandardMaterial({ color: 0x3fa34d, roughness: 1.0 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = GROUND_Y;
ground.receiveShadow = qualitySettings.shadows;
scene.add(ground);

// ---------------- LOADING MANAGER ----------------
const manager = new THREE.LoadingManager();

let itemsLoaded = 0;
let itemsTotal = 0;

function updateLoadingUI() {
  if (itemsTotal <= 0) return;
  const p = Math.floor((itemsLoaded / itemsTotal) * 100);
  if (loadingBar) loadingBar.style.width = `${p}%`;
  if (loadingPct) loadingPct.textContent = `${p}%`;
}

manager.onStart = (_url, loaded, total) => {
  itemsLoaded = loaded;
  itemsTotal = total;
  updateLoadingUI();
};

manager.onProgress = (_url, loaded, total) => {
  itemsLoaded = loaded;
  itemsTotal = total;
  updateLoadingUI();
};

manager.onLoad = () => {
  loadingUI.style.display = "none";
  startGame();
};

// ---------------- grass texture (через manager) ----------------
new THREE.TextureLoader(manager).load(
  `${BASE}/assets/textures/grass.jpg`,
  (tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(45, 45);
    groundMat.map = tex;
    groundMat.color.set(0xffffff);
    groundMat.needsUpdate = true;
  },
  undefined,
  () => {}
);

// ---------------- GLTF (через manager) ----------------
const loader = new GLTFLoader(manager);

function loadModel(url) {
  return new Promise((resolve, reject) => loader.load(url, (g) => resolve(g.scene), undefined, reject));
}

function setupShadows(root) {
  if (!qualitySettings.shadows) return; // ✅ NEW: на low вообще не трогаем тени
  root.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
}

function fitModelToSize(model, targetSize) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  model.scale.multiplyScalar(targetSize / maxDim);
}

function placeOnGround(model, groundY) {
  const box = new THREE.Box3().setFromObject(model);
  model.position.y += groundY - box.min.y;
}

// ---------------- PLANE ----------------
const plane = new THREE.Group();
scene.add(plane);

const PLANE_URL = `${BASE}/assets/models/plane.glb`;

function addFallbackPlane() {
  plane.clear();
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.8, 4.0, 10),
    new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.7 })
  );
  body.rotation.x = Math.PI / 2;
  body.castShadow = qualitySettings.shadows;

  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.15, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x8ecae6, roughness: 0.8 })
  );
  wing.position.set(0, 0, 0.4);
  wing.castShadow = qualitySettings.shadows;

  plane.add(body);
  plane.add(wing);
}

loadModel(PLANE_URL)
  .then((model) => {
    setupShadows(model);
    fitModelToSize(model, 7);
    model.position.set(0, 0, 0);
    placeOnGround(model, 0);
    model.rotation.y = 0;

    plane.clear();
    plane.add(model);
    plane.position.set(0, GROUND_Y, 0);
  })
  .catch(() => {
    addFallbackPlane();
    plane.position.set(0, GROUND_Y, 0);
  });

// ---------------- WORLD OBJECTS (через manager) ----------------
buildWorldObjects(scene, GROUND_Y, BASE, manager);

// ---------------- INVISIBLE BOUNDS ----------------
const WORLD_HALF = 700 / 2;
const BOUNDS_MARGIN = 6;
const MIN_X = -WORLD_HALF + BOUNDS_MARGIN;
const MAX_X = WORLD_HALF - BOUNDS_MARGIN;
const MIN_Z = -WORLD_HALF + BOUNDS_MARGIN;
const MAX_Z = WORLD_HALF - BOUNDS_MARGIN;

let bounceCooldown = 0;

// ---------------- INPUT (PC) ----------------
const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.code));
window.addEventListener("keyup", (e) => keys.delete(e.code));

// ---------------- INPUT (MOBILE) ----------------
const touchInput = {
  yaw: 0,
  w: false,
  s: false,
  climb: false,
  boost: false,
};

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function createMobileControls() {
  if (!isTouchDevice) return;

  const ui = document.createElement("div");
  ui.id = "mobileUI";
  ui.style.position = "fixed";
  ui.style.left = "0";
  ui.style.top = "0";
  ui.style.right = "0";
  ui.style.bottom = "0";
  ui.style.pointerEvents = "none";
  ui.style.zIndex = "9998";
  ui.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
  document.body.appendChild(ui);

  const joyWrap = document.createElement("div");
  joyWrap.style.position = "absolute";
  joyWrap.style.left = "16px";
  joyWrap.style.bottom = "16px";
  joyWrap.style.width = "140px";
  joyWrap.style.height = "140px";
  joyWrap.style.pointerEvents = "auto";
  joyWrap.style.touchAction = "none";
  ui.appendChild(joyWrap);

  const joyBase = document.createElement("div");
  joyBase.style.position = "absolute";
  joyBase.style.left = "0";
  joyBase.style.top = "0";
  joyBase.style.width = "140px";
  joyBase.style.height = "140px";
  joyBase.style.borderRadius = "999px";
  joyBase.style.background = "rgba(0,0,0,0.25)";
  joyBase.style.border = "1px solid rgba(255,255,255,0.25)";
  joyWrap.appendChild(joyBase);

  const joyKnob = document.createElement("div");
  joyKnob.style.position = "absolute";
  joyKnob.style.left = "50%";
  joyKnob.style.top = "50%";
  joyKnob.style.width = "58px";
  joyKnob.style.height = "58px";
  joyKnob.style.marginLeft = "-29px";
  joyKnob.style.marginTop = "-29px";
  joyKnob.style.borderRadius = "999px";
  joyKnob.style.background = "rgba(255,255,255,0.7)";
  joyKnob.style.boxShadow = "0 8px 20px rgba(0,0,0,0.25)";
  joyWrap.appendChild(joyKnob);

  const joyRadius = 45;
  let joyActive = false;
  let joyPointerId = null;
  let centerX = 0;
  let centerY = 0;

  function resetJoy() {
    joyKnob.style.transform = `translate(0px, 0px)`;
    touchInput.yaw = 0;
    joyActive = false;
    joyPointerId = null;
  }

  joyWrap.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    joyActive = true;
    joyPointerId = e.pointerId;
    joyWrap.setPointerCapture(joyPointerId);

    const rect = joyWrap.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
  });

  joyWrap.addEventListener("pointermove", (e) => {
    if (!joyActive || e.pointerId !== joyPointerId) return;
    e.preventDefault();

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const mag = Math.min(len, joyRadius);

    const mx = nx * mag;
    const my = ny * mag;

    joyKnob.style.transform = `translate(${mx}px, ${my}px)`;
    touchInput.yaw = clamp(-dx / joyRadius, -1, 1);
  });

  const joyEnd = (e) => {
    if (e.pointerId !== joyPointerId) return;
    e.preventDefault();
    resetJoy();
  };

  joyWrap.addEventListener("pointerup", joyEnd);
  joyWrap.addEventListener("pointercancel", joyEnd);
  joyWrap.addEventListener("lostpointercapture", resetJoy);

  const btnWrap = document.createElement("div");
  btnWrap.style.position = "absolute";
  btnWrap.style.right = "16px";
  btnWrap.style.bottom = "16px";
  btnWrap.style.display = "grid";
  btnWrap.style.gridTemplateColumns = "repeat(2, 88px)";
  btnWrap.style.gridTemplateRows = "repeat(2, 64px)";
  btnWrap.style.gap = "10px";
  btnWrap.style.pointerEvents = "auto";
  btnWrap.style.touchAction = "none";
  ui.appendChild(btnWrap);

  function mkBtn(label) {
    const b = document.createElement("div");
    b.textContent = label;
    b.style.display = "flex";
    b.style.alignItems = "center";
    b.style.justifyContent = "center";
    b.style.borderRadius = "14px";
    b.style.background = "rgba(0,0,0,0.25)";
    b.style.border = "1px solid rgba(255,255,255,0.25)";
    b.style.color = "white";
    b.style.fontWeight = "700";
    b.style.letterSpacing = "0.5px";
    b.style.userSelect = "none";
    b.style.webkitUserSelect = "none";
    b.style.cursor = "pointer";
    return b;
  }

  function bindHold(btn, onDown, onUp) {
    const down = (e) => { e.preventDefault(); onDown(); };
    const up = (e) => { e.preventDefault(); onUp(); };

    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  }

  const btnGas = mkBtn("GAS");
  const btnBrake = mkBtn("BRAKE");
  const btnUp = mkBtn("UP");
  const btnBoost = mkBtn("BOOST");

  bindHold(btnGas, () => (touchInput.w = true), () => (touchInput.w = false));
  bindHold(btnBrake, () => (touchInput.s = true), () => (touchInput.s = false));
  bindHold(btnUp, () => (touchInput.climb = true), () => (touchInput.climb = false));
  bindHold(btnBoost, () => (touchInput.boost = true), () => (touchInput.boost = false));

  btnWrap.appendChild(btnGas);
  btnWrap.appendChild(btnBrake);
  btnWrap.appendChild(btnUp);
  btnWrap.appendChild(btnBoost);
}

createMobileControls();

// ---------------- ARCADE FLIGHT ----------------
let speed = 0;
let altitude = 0;
let vAlt = 0;

const MAX_SPEED = 95;
const ACCEL = 34;
const BRAKE = 28;
const DRAG = 14;

const TAKEOFF_SPEED = 28;
const STALL_SPEED = 18;

const DESCENT_POWER = 10;
const V_DAMP = 3.5;

const YAW_RATE = 1.6;
const BANK_MAX = 0.55;
const BANK_SMOOTH = 5.0;

const tmpV = new THREE.Vector3();

function handleWorldBounds(dt) {
  bounceCooldown = Math.max(0, bounceCooldown - dt);

  const x = plane.position.x;
  const z = plane.position.z;

  const out = x < MIN_X || x > MAX_X || z < MIN_Z || z > MAX_Z;
  if (!out) return;

  plane.position.x = THREE.MathUtils.clamp(plane.position.x, MIN_X, MAX_X);
  plane.position.z = THREE.MathUtils.clamp(plane.position.z, MIN_Z, MAX_Z);

  if (bounceCooldown > 0) return;

  plane.rotation.y += Math.PI;
  speed *= 0.65;
  bounceCooldown = 0.25;
}

function updateFlight(dt) {
  const w = keys.has("KeyW") || touchInput.w;
  const s = keys.has("KeyS") || touchInput.s;
  const boost = keys.has("ShiftLeft") || keys.has("ShiftRight") || touchInput.boost;
  const climb = keys.has("Space") || touchInput.climb;

  if (w) speed += ACCEL * (boost ? 1.2 : 1.0) * dt;
  else speed -= DRAG * dt;

  if (s) speed -= BRAKE * dt;

  speed = THREE.MathUtils.clamp(speed, 0, MAX_SPEED);

  const keyYaw =
    (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) -
    (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);

  const yawInput = THREE.MathUtils.clamp(keyYaw + touchInput.yaw, -1, 1);
  plane.rotation.y += yawInput * YAW_RATE * dt;

  const targetBank = THREE.MathUtils.clamp(-yawInput * 0.45, -BANK_MAX, BANK_MAX);
  plane.rotation.z = THREE.MathUtils.lerp(
    plane.rotation.z,
    targetBank,
    1 - Math.pow(0.001, dt * BANK_SMOOTH)
  );

  let targetV = 0;
  if (climb) targetV += 9.0;

  if (speed < TAKEOFF_SPEED) {
    const t = (TAKEOFF_SPEED - speed) / TAKEOFF_SPEED;
    targetV += -THREE.MathUtils.lerp(0.8, DESCENT_POWER, THREE.MathUtils.clamp(t, 0, 1));
  }

  if (speed < STALL_SPEED) targetV *= 1.15;

  vAlt = THREE.MathUtils.lerp(vAlt, targetV, 1 - Math.pow(0.001, dt * V_DAMP));
  altitude += vAlt * dt;

  const bankAbs = Math.abs(plane.rotation.z);
  const extraClearance = bankAbs * 6.0;
  const minAlt = extraClearance;

  altitude = THREE.MathUtils.clamp(altitude, minAlt, 220);

  const forward = tmpV.set(0, 0, 1).applyQuaternion(plane.quaternion).normalize();
  plane.position.addScaledVector(forward, speed * dt);

  handleWorldBounds(dt);

  plane.position.y = GROUND_Y + altitude;
}

// ---------------- CAMERA ----------------
const desiredPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const tmp = new THREE.Vector3();

function updateCamera(dt) {
  const k = speed / MAX_SPEED;
  const dist = THREE.MathUtils.lerp(22, 30, k);
  const height = THREE.MathUtils.lerp(6.5, 9.0, k);

  const backOffset = new THREE.Vector3(0, height, -dist).applyQuaternion(plane.quaternion);
  desiredPos.copy(plane.position).add(backOffset);

  camera.position.lerp(desiredPos, 1 - Math.pow(0.001, dt));
  lookAt.copy(plane.position).add(tmp.set(0, 3.0, 10.0).applyQuaternion(plane.quaternion));
  camera.lookAt(lookAt);
}

// ---------------- GAME START (после полной загрузки) ----------------
let last = performance.now();
function startGame() {
  gameStartTime = performance.now();
  last = performance.now();
  requestAnimationFrame(animate);
}

// ---------------- LOOP ----------------
function animate() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  // таймер без рывков
  if (timerEl && gameStartTime) {
    const sec = Math.floor((now - gameStartTime) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    timerEl.textContent = `${mm}:${ss}`;
  }

  updateFlight(dt);
  updateCamera(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// ---------------- RESIZE ----------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.far = qualitySettings.cameraFar; // ✅ сохраняем выбранную дальность
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  // ⚠️ pixelRatio можно не трогать при resize, но на всякий оставим:
  renderer.setPixelRatio(qualitySettings.pixelRatio);
});

// (необязательно) просто для себя: увидеть что выбрало авто-качество
console.log("[Quality]", QUALITY, qualitySettings);
