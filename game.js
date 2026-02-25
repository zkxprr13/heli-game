import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildWorld } from "./worldObjects.js";

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

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  2500
);

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
scene.add(sun);

// ---------- WORLD ----------
const GROUND_Y = -2;
buildWorld(scene, GROUND_Y);

// ---------- INVISIBLE WALLS ----------
const LIMIT = 350;
const WALL_MARGIN = 8;
const MIN_X = -LIMIT + WALL_MARGIN;
const MAX_X = LIMIT - WALL_MARGIN;
const MIN_Z = -LIMIT + WALL_MARGIN;
const MAX_Z = LIMIT - WALL_MARGIN;

let bounceCooldown = 0;

// ---------------- GLTF ----------------
const loader = new GLTFLoader();
function loadModel(url) {
  return new Promise((resolve, reject) =>
    loader.load(url, (g) => resolve(g.scene), undefined, reject)
  );
}

// ---------------- PLANE ----------------
const plane = new THREE.Group();
scene.add(plane);

loadModel(`${BASE}/assets/models/plane.glb`)
  .then((model) => {
    model.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });

    plane.clear();
    plane.add(model);
    plane.position.set(0, GROUND_Y, 0);
  });

// ---------------- FLIGHT ----------------
const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.code));
window.addEventListener("keyup", (e) => keys.delete(e.code));

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

  if (
    plane.position.x < MIN_X ||
    plane.position.x > MAX_X ||
    plane.position.z < MIN_Z ||
    plane.position.z > MAX_Z
  ) {
    if (bounceCooldown > 0) return;

    plane.position.x = THREE.MathUtils.clamp(plane.position.x, MIN_X, MAX_X);
    plane.position.z = THREE.MathUtils.clamp(plane.position.z, MIN_Z, MAX_Z);

    plane.rotation.y += Math.PI;
    speed *= 0.65;
    bounceCooldown = 0.25;
  }
}

function updateFlight(dt) {
  const w = keys.has("KeyW");
  const s = keys.has("KeyS");
  const boost = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const climb = keys.has("Space");

  if (w) speed += ACCEL * (boost ? 1.2 : 1) * dt;
  else speed -= DRAG * dt;

  if (s) speed -= BRAKE * dt;
  speed = THREE.MathUtils.clamp(speed, 0, MAX_SPEED);

  const yawInput =
    (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) -
    (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);

  plane.rotation.y += yawInput * YAW_RATE * dt;

  const targetBank = THREE.MathUtils.clamp(-yawInput * 0.45, -BANK_MAX, BANK_MAX);
  plane.rotation.z = THREE.MathUtils.lerp(
    plane.rotation.z,
    targetBank,
    1 - Math.pow(0.001, dt * BANK_SMOOTH)
  );

  let targetV = climb ? 9 : 0;

  if (speed < TAKEOFF_SPEED) {
    const t = (TAKEOFF_SPEED - speed) / TAKEOFF_SPEED;
    targetV += -THREE.MathUtils.lerp(0.8, DESCENT_POWER, THREE.MathUtils.clamp(t, 0, 1));
  }

  if (speed < STALL_SPEED) targetV *= 1.15;

  vAlt = THREE.MathUtils.lerp(vAlt, targetV, 1 - Math.pow(0.001, dt * V_DAMP));
  altitude += vAlt * dt;

  altitude = THREE.MathUtils.clamp(altitude, 0, 220);

  const forward = tmpV.set(0, 0, 1).applyQuaternion(plane.quaternion).normalize();
  plane.position.addScaledVector(forward, speed * dt);

  handleWorldBounds(dt);

  plane.position.y = GROUND_Y + altitude;
}

// ---------------- CAMERA ----------------
const desiredPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();

function updateCamera(dt) {
  const k = speed / MAX_SPEED;
  const dist = THREE.MathUtils.lerp(22, 30, k);
  const height = THREE.MathUtils.lerp(6.5, 9, k);

  const backOffset = new THREE.Vector3(0, height, -dist).applyQuaternion(plane.quaternion);
  desiredPos.copy(plane.position).add(backOffset);

  camera.position.lerp(desiredPos, 1 - Math.pow(0.001, dt));
  lookAt.copy(plane.position);
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
