import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

/** ---------- helpers: safe UI + error overlay ---------- */
function showOverlay(msg) {
  let el = document.getElementById("overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "overlay";
    el.style.position = "fixed";
    el.style.left = "12px";
    el.style.bottom = "12px";
    el.style.maxWidth = "520px";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "10px";
    el.style.background = "rgba(0,0,0,0.6)";
    el.style.color = "#fff";
    el.style.fontFamily = "system-ui, sans-serif";
    el.style.fontSize = "12px";
    el.style.whiteSpace = "pre-wrap";
    el.style.zIndex = "9999";
    document.body.appendChild(el);
  }
  el.textContent = msg;
}

function safeGet(id) {
  return document.getElementById(id);
}

// На случай если script загрузился раньше DOM
if (document.readyState === "loading") {
  await new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }));
}

const canvas = safeGet("game");
const timerEl = safeGet("timer");

if (!canvas) {
  showOverlay("❌ Не найден <canvas id='game'>.\nПроверь index.html: canvas должен иметь id='game'.");
  throw new Error("Canvas #game not found");
}

// ---------- Scene / Camera / Renderer ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 80, 450);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------- Light ----------
scene.add(new THREE.HemisphereLight(0xffffff, 0x2b4b2b, 0.9));

const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(80, 120, 40);
sun.castShadow = true;

sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 400;
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150;
sun.shadow.camera.bottom = -150;

scene.add(sun);

// ---------- Ground (grass if possible, otherwise green fallback) ----------
const groundGeo = new THREE.PlaneGeometry(1200, 1200, 1, 1);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x2f8f2f, // fallback green
  roughness: 1.0,
  metalness: 0.0,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -5;
ground.receiveShadow = true;
scene.add(ground);

const texLoader = new THREE.TextureLoader();
texLoader.load(
  "./assets/textures/grass.jpg",
  (grassTex) => {
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(80, 80);
    groundMat.map = grassTex;
    groundMat.color.set(0xffffff);
    groundMat.needsUpdate = true;
    showOverlay(""); // убрать сообщение, если было
  },
  undefined,
  (err) => {
    showOverlay(
      "⚠️ Текстура травы не загрузилась: ./assets/textures/grass.jpg\n" +
        "Пол будет зелёным (fallback).\n" +
        "Проверь, что файл существует и путь/регистр совпадают."
    );
    console.warn("Grass texture load error:", err);
  }
);

// ---------- GLTF Loader ----------
const gltfLoader = new GLTFLoader();

function setupModelShadows(root) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

function loadGLB(url) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });
}

// ---------- Plane ----------
const plane = new THREE.Group();
plane.position.set(0, 5, 0);
scene.add(plane);

// Заглушка самолёта — чтобы точно было что летает
function makePlaneFallback() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.7 })
  );
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  g.add(body);

  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.12, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x8ecae6, roughness: 0.8 })
  );
  wing.position.set(0, 0, 0.2);
  wing.castShadow = true;
  g.add(wing);

  return g;
}

(async () => {
  try {
    const planeModel = await loadGLB("./assets/models/plane.glb");
    setupModelShadows(planeModel);

    planeModel.scale.setScalar(1.0);
    planeModel.rotation.y = Math.PI;

    plane.clear();
    plane.add(planeModel);
  } catch (e) {
    showOverlay(
      "⚠️ Самолёт не загрузился: ./assets/models/plane.glb\n" +
        "Использую простую модель-заглушку.\n" +
        "Проверь путь/название файла и открой Console (F12) для деталей."
    );
    console.warn("Plane GLB load error:", e);

    plane.clear();
    plane.add(makePlaneFallback());
  }
})();

// ---------- World models ----------
const world = new THREE.Group();
scene.add(world);

function randBetween(a, b) {
  return a + Math.random() * (b - a);
}

async function spawnMany(modelUrl, count, options = {}) {
  const base = await loadGLB(modelUrl);
  setupModelShadows(base);

  const {
    area = 450,
    y = -5,
    minScale = 0.8,
    maxScale = 1.4,
    yJitter = 0.0,
    avoidCenterRadius = 30,
    randomYaw = true,
  } = options;

  for (let i = 0; i < count; i++) {
    const inst = base.clone(true);

    let x = 0,
      z = 0;
    for (let tries = 0; tries < 30; tries++) {
      x = randBetween(-area, area);
      z = randBetween(-area, area);
      if (Math.sqrt(x * x + z * z) > avoidCenterRadius) break;
    }

    inst.position.set(x, y + randBetween(0, yJitter), z);
    inst.scale.setScalar(randBetween(minScale, maxScale));
    if (randomYaw) inst.rotation.y = randBetween(0, Math.PI * 2);

    world.add(inst);
  }
}

(async () => {
  try {
    await spawnMany("./assets/models/house.glb", 25, { area: 220, avoidCenterRadius: 40 });
    await spawnMany("./assets/models/tree.glb", 140, { area: 420, avoidCenterRadius: 25 });
    await spawnMany("./assets/models/mountain.glb", 20, {
      area: 520,
      minScale: 3.0,
      maxScale: 7.0,
      avoidCenterRadius: 180,
    });
  } catch (e) {
    showOverlay(
      "⚠️ Окружение (дом/дерево/гора) не загрузилось.\n" +
        "Проверь файлы:\n" +
        "- ./assets/models/house.glb\n" +
        "- ./assets/models/tree.glb\n" +
        "- ./assets/models/mountain.glb\n"
    );
    console.warn("World GLB load error:", e);

    // минимальные кубики-заглушки, чтобы мир не был пустым
    const boxGeo = new THREE.BoxGeometry(2, 2, 2);
    for (let i = 0; i < 40; i++) {
      const cube = new THREE.Mesh(
        boxGeo,
        new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.6, 0.55), roughness: 0.9 })
      );
      cube.position.set(randBetween(-200, 200), randBetween(-4, 10), randBetween(-200, 200));
      cube.castShadow = true;
      cube.receiveShadow = true;
      world.add(cube);
    }
  }
})();

// ---------- Controls ----------
const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.code));
window.addEventListener("keyup", (e) => keys.delete(e.code));

const velocity = new THREE.Vector3();
const forward = new THREE.Vector3();
const tmp = new THREE.Vector3();

function updateControls(dt) {
  const baseSpeed = 18;
  const boost = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 2.0 : 1.0;

  const yaw = (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) - (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);
  const pitch = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  const upDown = (keys.has("KeyE") ? 1 : 0) - (keys.has("KeyQ") ? 1 : 0);

  plane.rotation.y += yaw * dt * 1.3;
  plane.rotation.x += pitch * dt * 0.9;
  plane.rotation.x = THREE.MathUtils.clamp(plane.rotation.x, -1.0, 1.0);

  forward.set(0, 0, 1).applyQuaternion(plane.quaternion).normalize();

  const speed = baseSpeed * boost;
  velocity.copy(forward).multiplyScalar(speed);
  velocity.y += upDown * speed * 0.7;

  plane.position.addScaledVector(velocity, dt);
  plane.position.y = THREE.MathUtils.clamp(plane.position.y, -2, 220);
}

// ---------- Camera ----------
function updateCamera(dt) {
  const desiredOffset = new THREE.Vector3(0, 8, -18).applyQuaternion(plane.quaternion);
  const desiredPos = tmp.copy(plane.position).add(desiredOffset);

  camera.position.lerp(desiredPos, 1 - Math.pow(0.001, dt));
  camera.lookAt(tmp.copy(plane.position).add(new THREE.Vector3(0, 3, 0)));
}

// ---------- Timer (safe) ----------
const startTime = performance.now();
function updateTimer() {
  if (!timerEl) return; // чтобы никогда не падало
  const ms = performance.now() - startTime;
  const totalSec = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  timerEl.textContent = `${mm}:${ss}`;
}

// ---------- Loop ----------
let last = performance.now();
function animate() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  updateControls(dt);
  updateCamera(dt);
  updateTimer();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// ---------- Resize ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
