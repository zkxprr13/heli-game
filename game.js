import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const BASE = "/heli-game";

// ---------------- TIMER ----------------
const timerEl = document.getElementById("timer");
const start = performance.now();
setInterval(() => {
  if (!timerEl) return;
  const sec = Math.floor((performance.now() - start) / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  timerEl.textContent = `${mm}:${ss}`;
}, 250);

// ---------------- SCENE ----------------
const canvas = document.getElementById("game");
if (!canvas) throw new Error('No canvas#game');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 80, 700);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2500);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------------- LIGHT ----------------
scene.add(new THREE.HemisphereLight(0xffffff, 0x3b4b3b, 1.0));

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

// ---------------- GROUND (smaller) ----------------
const GROUND_Y = -2;

const groundMat = new THREE.MeshStandardMaterial({ color: 0x3fa34d, roughness: 1.0 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = GROUND_Y;
ground.receiveShadow = true;
scene.add(ground);

// optional grass texture (if you still want it; fast anyway)
new THREE.TextureLoader().load(
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

// ---------------- GLTF LOADER ----------------
const loader = new GLTFLoader();
function loadModel(url) {
  return new Promise((resolve, reject) => loader.load(url, (g) => resolve(g.scene), undefined, reject));
}
function setupShadows(root) {
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
function randBetween(a, b) {
  return a + Math.random() * (b - a);
}

// ---------------- PLANE ----------------
const plane = new THREE.Group();
scene.add(plane);

// сменишь имя если у тебя новый файл, например: plane2.glb
const PLANE_URL = `${BASE}/assets/models/plane.glb`;

function addFallbackPlane() {
  plane.clear();
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.8, 4.0, 10),
    new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.7 })
  );
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;

  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.15, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x8ecae6, roughness: 0.8 })
  );
  wing.position.set(0, 0, 0.4);
  wing.castShadow = true;

  plane.add(body);
  plane.add(wing);
}

let planeVisual = null;

loadModel(PLANE_URL)
  .then((model) => {
    setupShadows(model);

    // нормализуем размер (делаем одинаковый “приятный” размер независимо от модели)
    fitModelToSize(model, 7);

    // ставим на землю (по низу модели)
    model.position.set(0, 0, 0);
    placeOnGround(model, 0);

    // часто нужно развернуть самолёт
    model.rotation.y = Math.PI;

    plane.clear();
    plane.add(model);
    planeVisual = model;

    // стартовая позиция самолёта
    plane.position.set(0, GROUND_Y, 0);
  })
  .catch(() => {
    addFallbackPlane();
    plane.position.set(0, GROUND_Y, 0);
  });

// ---------------- WORLD: 2 houses + fewer trees ----------------
async function buildWorld() {
  try {
    const houseBase = await loadModel(`${BASE}/assets/models/house.glb`);
    setupShadows(houseBase);
    fitModelToSize(houseBase, 12);
    placeOnGround(houseBase, GROUND_Y);

    // 2 дома в разных местах
    const h1 = houseBase.clone(true);
    h1.position.set(-220, GROUND_Y, -140);
    h1.rotation.y = 0.6;
    scene.add(h1);

    const h2 = houseBase.clone(true);
    h2.position.set(200, GROUND_Y, 160);
    h2.rotation.y = -1.2;
    scene.add(h2);
  } catch {}

  try {
    const treeBase = await loadModel(`${BASE}/assets/models/tree.glb`);
    setupShadows(treeBase);
    fitModelToSize(treeBase, 10);
    placeOnGround(treeBase, GROUND_Y);

    // меньше деревьев (например 25)
    for (let i = 0; i < 25; i++) {
      const t = treeBase.clone(true);
      t.position.set(randBetween(-300, 300), GROUND_Y, randBetween(-300, 300));
      t.rotation.y = randBetween(0, Math.PI * 2);
      const s = randBetween(0.8, 1.35);
      t.scale.multiplyScalar(s);
      scene.add(t);
    }
  } catch {}
}
buildWorld();

// ---------------- SIMPLE TAKEOFF / LANDING PHYSICS ----------------
//
// Идея:
// - на земле: y = GROUND_Y и скорость набирается/сбрасывается
// - когда скорость выше TAKEOFF_SPEED: самолёт “отлипает” и плавно набирает высоту
// - когда скорость падает ниже STALL_SPEED: самолёт теряет высоту и приземляется
//
const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.code));
window.addEventListener("keyup", (e) => keys.delete(e.code));

let speed = 0;          // горизонтальная скорость
let vspeed = 0;         // вертикальная скорость
let altitude = 0;       // высота относительно земли (0 = на земле)
let airborne = false;

const MAX_SPEED = 85;
const ACCEL = 28;
const DRAG = 18;

const TAKEOFF_SPEED = 30;
const STALL_SPEED = 22;

const LIFT = 22;        // насколько сильно “поднимает” при скорости
const GRAVITY = 28;     // насколько тянет вниз
const CLIMB = 18;       // Q/E (вверх/вниз) при полёте

// Повороты
const YAW_RATE = 1.7;     // поворот по Y
const BANK_MAX = 0.55;    // максимальный наклон (красиво)
const BANK_RATE = 3.0;    // скорость наклона

function updatePhysics(dt) {
  const boosting = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const wantForward = keys.has("KeyW");
  const wantBrake = keys.has("KeyS");

  // скорость вперёд/тормоз
  if (wantForward) speed += ACCEL * (boosting ? 1.25 : 1.0) * dt;
  else speed -= DRAG * dt;

  if (wantBrake) speed -= ACCEL * 1.2 * dt;

  speed = THREE.MathUtils.clamp(speed, 0, MAX_SPEED);

  // поворот (всегда)
  const yawInput =
    (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) -
    (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);

  plane.rotation.y += yawInput * YAW_RATE * dt;

  // красивый наклон в повороте (bank)
  const targetBank = THREE.MathUtils.clamp(-yawInput * 0.45, -BANK_MAX, BANK_MAX);
  plane.rotation.z = THREE.MathUtils.lerp(plane.rotation.z, targetBank, 1 - Math.pow(0.001, dt * BANK_RATE));

  // взлёт/полёт/посадка
  if (!airborne) {
    altitude = 0;
    vspeed = 0;

    if (speed >= TAKEOFF_SPEED) {
      airborne = true;
      vspeed = 3;
    }
  } else {
    // подъемная сила зависит от скорости
    const lift = (speed / MAX_SPEED) * LIFT;
    vspeed += (lift - GRAVITY) * dt;

    // управление высотой Q/E (аккуратно, чтобы не было “лифта”)
    if (keys.has("KeyQ")) vspeed += CLIMB * dt;
    if (keys.has("KeyE")) vspeed -= CLIMB * dt;

    // сваливание
    if (speed < STALL_SPEED) {
      vspeed -= GRAVITY * 1.2 * dt;
    }

    altitude += vspeed * dt;

    // приземление
    if (altitude <= 0) {
      altitude = 0;
      vspeed = 0;
      airborne = false;
    }

    // ограничение высоты
    altitude = THREE.MathUtils.clamp(altitude, 0, 220);
  }

  // движение вперёд по направлению самолёта
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(plane.quaternion).normalize();
  plane.position.addScaledVector(forward, speed * dt);

  // позиция по Y = земля + altitude
  plane.position.y = GROUND_Y + altitude;
}

// ---------------- CINEMATIC CHASE CAMERA (no mouse) ----------------
//
// Красивое расположение на экране:
// - камера выше и дальше
// - плавное сглаживание (lerp)
// - смотрит чуть выше центра самолёта
//
const camPos = new THREE.Vector3();
const desiredPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const tmp = new THREE.Vector3();

function updateCamera(dt) {
  // оффсет камеры: выше и сзади
  // (подбирал так, чтобы самолёт был красиво виден и не залезал в камеру)
  const backOffset = new THREE.Vector3(0, 6.5, -22).applyQuaternion(plane.quaternion);

  desiredPos.copy(plane.position).add(backOffset);

  // мягкое сглаживание
  camera.position.lerp(desiredPos, 1 - Math.pow(0.001, dt));

  // куда смотрим: немного вперёд и вверх (приятный кадр)
  lookAt.copy(plane.position).add(tmp.set(0, 3.0, 6.0).applyQuaternion(plane.quaternion));
  camera.lookAt(lookAt);
}

// ---------------- LOOP ----------------
let last = performance.now();

function animate() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  updatePhysics(dt);
  updateCamera(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

// ---------------- RESIZE ----------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});
