import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.getElementById("game");
const timerEl = document.getElementById("timer");

// ---------- Scene / Camera / Renderer ----------
const scene = new THREE.Scene();

// Голубое небо (просто цвет фона)
scene.background = new THREE.Color(0x87ceeb);

// Лёгкий туман по дальности (очень помогает “атмосфере”)
scene.fog = new THREE.Fog(0x87ceeb, 80, 450);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1200
);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// Тени
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------- Light ----------
scene.add(new THREE.HemisphereLight(0xffffff, 0x2b4b2b, 0.9));

const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(80, 120, 40);
sun.castShadow = true;

// Настройка карты теней (важно для качества)
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 400;
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150;
sun.shadow.camera.bottom = -150;

scene.add(sun);

// ---------- Ground with grass texture ----------
const texLoader = new THREE.TextureLoader();
const grassTex = texLoader.load("./assets/textures/grass.jpg");

// плитка травы
grassTex.wrapS = THREE.RepeatWrapping;
grassTex.wrapT = THREE.RepeatWrapping;
grassTex.repeat.set(80, 80);

// Поле (большая плоскость)
const groundGeo = new THREE.PlaneGeometry(1200, 1200, 1, 1);
const groundMat = new THREE.MeshStandardMaterial({
  map: grassTex,
  roughness: 1.0,
  metalness: 0.0,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -5;
ground.receiveShadow = true;
scene.add(ground);

// ---------- GLTF Loader ----------
const gltfLoader = new GLTFLoader();

// ---------- Plane (real model) ----------
let plane = new THREE.Group();
plane.position.set(0, 5, 0);
scene.add(plane);

function setupModelShadows(root) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      // иногда модели выглядят темнее/светлее — это норм, потом подкрутим
      obj.material?.needsUpdate && (obj.material.needsUpdate = true);
    }
  });
}

async function loadGLB(url) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => reject(err)
    );
  });
}

let planeModel = null;

(async () => {
  try {
    planeModel = await loadGLB("./assets/models/plane.glb");
    setupModelShadows(planeModel);

    // Подгони масштаб под свою модель:
    planeModel.scale.setScalar(1.0);

    // Важно: у разных моделей “вперёд” может быть не по Z.
    // Если у тебя самолет смотрит боком — крутим тут:
    planeModel.rotation.y = Math.PI; // часто нужно развернуть
    // planeModel.rotation.x = ... (если нужно)

    // Удаляем “пустую” группу и вставляем модель
    plane.clear();
    plane.add(planeModel);
  } catch (e) {
    console.warn("Не загрузилась модель самолёта plane.glb:", e);
    // На всякий — оставим простой placeholder
    const fallback = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.7 })
    );
    fallback.rotation.x = Math.PI / 2;
    fallback.castShadow = true;
    plane.add(fallback);
  }
})();

// ---------- Environment models (houses/trees/mountains) ----------
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

    // позиция
    let x = 0, z = 0;
    for (let tries = 0; tries < 30; tries++) {
      x = randBetween(-area, area);
      z = randBetween(-area, area);
      if (Math.sqrt(x * x + z * z) > avoidCenterRadius) break;
    }

    inst.position.set(x, y + randBetween(0, yJitter), z);

    // масштаб
    const s = randBetween(minScale, maxScale);
    inst.scale.setScalar(s);

    // поворот
    if (randomYaw) inst.rotation.y = randBetween(0, Math.PI * 2);

    world.add(inst);
  }
}

(async () => {
  try {
    // Домики ближе к центру (меньше их)
    await spawnMany("./assets/models/house.glb", 25, {
      area: 220,
      y: -5,
      minScale: 0.8,
      maxScale: 1.3,
      yJitter: 0.0,
      avoidCenterRadius: 40,
    });

    // Деревья шире по карте (больше)
    await spawnMany("./assets/models/tree.glb", 140, {
      area: 420,
      y: -5,
      minScale: 0.7,
      maxScale: 1.8,
      avoidCenterRadius: 25,
    });

    // Горы по краям (чтобы был “пейзаж”)
    await spawnMany("./assets/models/mountain.glb", 20, {
      area: 520,
      y: -5,
      minScale: 3.0,
      maxScale: 7.0,
      avoidCenterRadius: 180,
    });
  } catch (e) {
    console.warn("Не загрузились модели окружения:", e);
  }
})();

// ---------- Controls (same idea, but smoother plane) ----------
const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.code));
window.addEventListener("keyup", (e) => keys.delete(e.code));

const velocity = new THREE.Vector3();
const forward = new THREE.Vector3();
const tmp = new THREE.Vector3();

function updateControls(dt) {
  const baseSpeed = 18;
  const boost = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 2.0 : 1.0;

  // Повороты
  const yaw =
    (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) -
    (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);

  const pitch =
    (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
    (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);

  const upDown = (keys.has("KeyE") ? 1 : 0) - (keys.has("KeyQ") ? 1 : 0);

  // Плавные повороты (чуть мягче)
  plane.rotation.y += yaw * dt * 1.3;
  plane.rotation.x += pitch * dt * 0.9;
  plane.rotation.x = THREE.MathUtils.clamp(plane.rotation.x, -1.0, 1.0);

  // Направление вперёд (по локальной оси Z)
  forward.set(0, 0, 1).applyQuaternion(plane.quaternion).normalize();

  const speed = baseSpeed * boost;
  velocity.copy(forward).multiplyScalar(speed);
  velocity.y += upDown * speed * 0.7;

  plane.position.addScaledVector(velocity, dt);

  // ограничение по высоте (чтобы не улетать в космос)
  plane.position.y = THREE.MathUtils.clamp(plane.position.y, -2, 220);
}

// ---------- Camera (chase cam) ----------
function updateCamera(dt) {
  // чуть выше и дальше, чтобы было “смотреть пейзажи”
  const desiredOffset = new THREE.Vector3(0, 8, -18).applyQuaternion(plane.quaternion);
  const desiredPos = tmp.copy(plane.position).add(desiredOffset);

  camera.position.lerp(desiredPos, 1 - Math.pow(0.001, dt));

  const lookAt = tmp.copy(plane.position).add(new THREE.Vector3(0, 3, 0));
  camera.lookAt(lookAt);
}

// ---------- Timer ----------
const startTime = performance.now();
function updateTimer() {
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