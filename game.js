import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildWorldObjects } from "./worldObjects.js"; // <-- проверь путь!

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
if (!canvas) throw new Error("No canvas#game");

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

// ---------------- GROUND ----------------
const GROUND_Y = -2;

const groundMat = new THREE.MeshStandardMaterial({ color: 0x3fa34d, roughness: 1.0 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = GROUND_Y;
ground.receiveShadow = true;
scene.add(ground);

// grass (optional)
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

// ---------------- GLTF ----------------
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

loadModel(PLANE_URL)
  .then((model) => {
    setupShadows(model);
    fitModelToSize(model, 7);
    model.position.set(0, 0, 0);
    placeOnGround(model, 0);

    // ✅ РАЗВОРОТ самолёта:
    model.rotation.y = 0;

    plane.clear();
    plane.add(model);

    plane.position.set(0, GROUND_Y, 0);
  })
  .catch(() => {
    addFallbackPlane();
    plane.position.set(0, GROUND_Y, 0);
  });

// ---------------- WORLD OBJECTS (moved) ----------------
buildWorldObjects(scene, GROUND_Y, BASE);

// ---------------- INVISIBLE BOUNDS (NEW) ----------------
// поле 700x700 => границы [-350..350]. Делаем небольшой отступ внутрь.
const WORLD_HALF = 700 / 2;
const BOUNDS_MARGIN = 6;
const MIN_X = -WORLD_HALF + BOUNDS_MARGIN;
const MAX_X =  WORLD_HALF - BOUNDS_MARGIN;
const MIN_Z = -WORLD_HALF + BOUNDS_MARGIN;
const MAX_Z =  WORLD_HALF - BOUNDS_MARGIN;

let bounceCooldown = 0;

// ---------------- ARCADE FLIGHT (W accel, S brake, no Q/E) ----------------
const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.code));
window.addEventListener("keyup", (e) => keys.delete(e.code));

let speed = 0;       // forward speed
let altitude = 0;    // height over ground
let vAlt = 0;        // vertical speed (altitude velocity)

const MAX_SPEED = 95;
const ACCEL = 34;
const BRAKE = 28;
const DRAG = 14;

const TAKEOFF_SPEED = 28;   // above -> start gaining lift
const STALL_SPEED = 18;     // below -> lose lift faster

const LIFT_POWER = 14;      // how fast we gain altitude when fast
const DESCENT_POWER = 10;   // how fast we lose altitude when slow
const V_DAMP = 3.5;         // smooth vertical

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

  // всегда держим внутри
  plane.position.x = THREE.MathUtils.clamp(plane.position.x, MIN_X, MAX_X);
  plane.position.z = THREE.MathUtils.clamp(plane.position.z, MIN_Z, MAX_Z);

  if (bounceCooldown > 0) return;

  // разворот на 180°
  plane.rotation.y += Math.PI;

  // чтобы не дребезжало об край + немного гасим скорость
  speed *= 0.65;
  bounceCooldown = 0.25;
}

function updateFlight(dt) {
  const w = keys.has("KeyW");
  const s = keys.has("KeyS");
  const boost = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const climb = keys.has("Space");

  // --- speed control ---
  if (w) speed += ACCEL * (boost ? 1.2 : 1.0) * dt;
  else speed -= DRAG * dt;

  if (s) speed -= BRAKE * dt;

  speed = THREE.MathUtils.clamp(speed, 0, MAX_SPEED);

  // --- steering ---
  const yawInput =
    (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) -
    (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);

  plane.rotation.y += yawInput * YAW_RATE * dt;

  // nice banking (roll), purely visual
  const targetBank = THREE.MathUtils.clamp(-yawInput * 0.45, -BANK_MAX, BANK_MAX);
  plane.rotation.z = THREE.MathUtils.lerp(
    plane.rotation.z,
    targetBank,
    1 - Math.pow(0.001, dt * BANK_SMOOTH)
  );

  // --- altitude behavior ---
  let targetV = 0;

  // Space = подъём
  if (climb) {
    targetV += 9.0;
  }

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

  // ✅ NEW: невидимые стенки
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

// ---------------- LOOP ----------------
let last = performance.now();
function animate() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  updateFlight(dt);
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
