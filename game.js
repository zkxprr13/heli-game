import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * ✅ ВАЖНО ДЛЯ GITHUB PAGES:
 * твой сайт: https://zkxprr13.github.io/heli-game/
 * поэтому все ассеты грузим через /heli-game/...
 */
const BASE = "/heli-game";

// ---------- UI: badge + overlay ----------
const timerEl = document.getElementById("timer");

document.body.insertAdjacentHTML(
  "beforeend",
  "<div id='boot-badge' style='position:fixed;left:12px;top:12px;z-index:99999;background:rgba(0,0,0,0.65);color:#fff;padding:8px 10px;border-radius:10px;font:12px system-ui'>game.js loaded ✅</div>"
);

function overlay(msg) {
  let el = document.getElementById("overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "overlay";
    el.style.position = "fixed";
    el.style.left = "12px";
    el.style.bottom = "12px";
    el.style.maxWidth = "760px";
    el.style.maxHeight = "42vh";
    el.style.overflow = "auto";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "10px";
    el.style.background = "rgba(0,0,0,0.75)";
    el.style.color = "#fff";
    el.style.font = "12px system-ui";
    el.style.whiteSpace = "pre-wrap";
    el.style.zIndex = "99999";
    document.body.appendChild(el);
  }
  el.textContent = msg || "";
}

window.addEventListener("error", (e) => overlay("❌ JS error:\n" + (e?.message || e)));
window.addEventListener("unhandledrejection", (e) =>
  overlay("❌ Promise error:\n" + (e?.reason?.message || e?.reason || e))
);

// ---------- Timer (always) ----------
const start = performance.now();
setInterval(() => {
  if (!timerEl) return;
  const sec = Math.floor((performance.now() - start) / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  timerEl.textContent = `${mm}:${ss}`;
}, 250);

// ---------- Scene / Camera / Renderer ----------
const canvas = document.getElementById("game");
if (!canvas) {
  overlay('❌ Нет <canvas id="game"></canvas> в index.html');
  throw new Error("canvas#game missing");
}
canvas.style.width = "100vw";
canvas.style.height = "100vh";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 80, 700);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2500);
camera.position.set(0, 18, -38);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------- Light ----------
scene.add(new THREE.HemisphereLight(0xffffff, 0x2b4b2b, 0.95));

const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(80, 140, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 800;
sun.shadow.camera.left = -260;
sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260;
sun.shadow.camera.bottom = -260;
scene.add(sun);

// ---------- Ground + grass texture ----------
const GROUND_Y = -5;

const groundMat = new THREE.MeshStandardMaterial({
  color: 0x2f8f2f,
  roughness: 1.0,
  metalness: 0.0,
});

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = GROUND_Y;
ground.receiveShadow = true;
scene.add(ground);

// grass texture (optional)
new THREE.TextureLoader().load(
  `${BASE}/assets/textures/grass.jpg`,
  (tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(90, 90);
    groundMat.map = tex;
    groundMat.color.set(0xffffff);
    groundMat.needsUpdate = true;
  },
  undefined,
  () => overlay(`⚠️ Не загрузилась трава: ${BASE}/assets/textures/grass.jpg\nПол будет зелёным.`)
);

// тестовый куб (чтобы всегда видеть сцену)
const testCube = new THREE.Mesh(
  new THREE.BoxGeometry(3, 3, 3),
  new THREE.MeshStandardMaterial({ color: 0xff00ff })
);
testCube.position.set(6, GROUND_Y + 2, 0);
testCube.castShadow = true;
testCube.receiveShadow = true;
scene.add(testCube);

// ---------- Model helpers ----------
const gltfLoader = new GLTFLoader();

function setupModelShadows(root) {
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
  const s = targetSize / maxDim;
  model.scale.multiplyScalar(s);
}

function placeModelOnGround(model, groundY) {
  const box = new THREE.Box3().setFromObject(model);
  model.position.y += groundY - box.min.y;
}

function randBetween(a, b) {
  return a + Math.random() * (b - a);
}

function loadGLB(url) {
  return new Promise((resolve, reject) => {
    console.log("Loading model:", url);
    gltfLoader.load(
      url,
      (gltf) => {
        console.log("Loaded OK:", url);
        resolve(gltf.scene);
      },
      undefined,
      (err) => {
        console.error("FAILED:", url, err);
        overlay(`❌ Не загрузилась модель:\n${url}\n(Открой F12 → Network, увидишь 404 если путь неверный)`);
        reject(err);
      }
    );
  });
}

function cloneDeep(obj) {
  return obj.clone(true);
}

// ---------- Plane ----------
const plane = new THREE.Group();
plane.position.set(0, 12, 0);
scene.add(plane);

// fallback plane
function addPlaneFallback() {
  plane.clear();
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.7 })
  );
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;

  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.12, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x8ecae6, roughness: 0.8 })
  );
  wing.position.set(0, 0, 0.2);
  wing.castShadow = true;

  plane.add(body);
  plane.add(wing);
}

loadGLB(`${BASE}/assets/models/plane.glb`)
  .then((model) => {
    setupModelShadows(model);
    fitModelToSize(model, 5);
    placeModelOnGround(model, 0);

    // если самолёт смотрит не туда — тут крути
    model.rotation.y = Math.PI;

    plane.clear();
    plane.add(model);
    plane.position.y = 10;
  })
  .catch(() => {
    overlay(`⚠️ plane.glb не загрузился: ${BASE}/assets/models/plane.glb\nИспользую заглушку.`);
    addPlaneFallback();
  });

// ---------- World ----------
const world = new THREE.Group();
scene.add(world);

async function spawnMany(modelUrl, count, opts) {
  const base = await loadGLB(modelUrl);
  setupModelShadows(base);

  // нормализуем базу
  fitModelToSize(base, opts.targetSize);
  placeModelOnGround(base, GROUND_Y);

  for (let i = 0; i < count; i++) {
    const obj = cloneDeep(base);

    obj.position.set(randBetween(-opts.area, opts.area), 0, randBetween(-opts.area, opts.area));
    obj.rotation.y = randBetween(0, Math.PI * 2);

    const s = randBetween(opts.minScale, opts.maxScale);
    obj.scale.multiplyScalar(s);

    placeModelOnGround(obj, GROUND_Y);
    world.add(obj);
  }
}

(async () => {
  try {
    await spawnMany(`${BASE}/assets/models/house.glb`, 25, {
      targetSize: 10,
      area: 260,
      minScale: 0.85,
      maxScale: 1.2,
    });

    await spawnMany(`${BASE}/assets/models/tree.glb`, 120, {
      targetSize: 12,
      area: 520,
      minScale: 0.7,
      maxScale: 1.5,
    });

    await spawnMany(`${BASE}/assets/models/mountain.glb`, 16, {
      targetSize: 110,
      area: 700,
      minScale: 0.8,
      maxScale: 1.25,
    });

    // если всё ок — очищаем overlay
    overlay("");
  } catch (e) {
    console.warn("World spawn failed:", e);
    // overlay уже покажет конкретный файл
  }
})();

// ---------- Mouse look (OrbitControls) ----------
// Мышь крутит камеру вокруг самолёта, но не влияет на движение самолёта.
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableZoom = false;
controls.enableDamping = true;
controls.dampingFactor = 0.06;

// Чтобы вращение было вокруг самолёта:
controls.target.copy(plane.position);

// ---------- Controls (WASD/QE/Shift) ----------
const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.code));
window.addEventListener("keyup", (e) => keys.delete(e.code));

const velocity = new THREE.Vector3();
const forward = new THREE.Vector3();

function updatePlane(dt) {
  const baseSpeed = 20;
  const boost = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 2.0 : 1.0;

  const yaw =
    (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) -
    (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);

  const pitch =
    (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
    (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);

  const upDown = (keys.has("KeyE") ? 1 : 0) - (keys.has("KeyQ") ? 1 : 0);

  // Повороты самолёта только с клавиатуры
  plane.rotation.y += yaw * dt * 1.25;
  plane.rotation.x += pitch * dt * 0.9;
  plane.rotation.x = THREE.MathUtils.clamp(plane.rotation.x, -1.0, 1.0);

  // Вперёд по локальной оси Z
  forward.set(0, 0, 1).applyQuaternion(plane.quaternion).normalize();

  const speed = baseSpeed * boost;
  velocity.copy(forward).multiplyScalar(speed);
  velocity.y += upDown * speed * 0.7;

  plane.position.addScaledVector(velocity, dt);
  plane.position.y = THREE.MathUtils.clamp(plane.position.y, GROUND_Y + 2, 240);

  // чтобы OrbitControls вращал вокруг самолёта
  controls.target.copy(plane.position);
}

// ---------- Loop ----------
let last = performance.now();
function animate() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  updatePlane(dt);

  // Мышь управляет камерой
  controls.update();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// ---------- Resize ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

// Done
document.getElementById("boot-badge").textContent = "Three.js running ✅";
