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
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

// ---------------- LIGHT ----------------
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));

const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(50, 100, 50);
sun.castShadow = true;
scene.add(sun);

// ---------------- GROUND (меньше) ----------------
const GROUND_Y = -2;

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600),
  new THREE.MeshStandardMaterial({ color: 0x3fa34d })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = GROUND_Y;
ground.receiveShadow = true;
scene.add(ground);

// ---------------- MODEL LOADER ----------------
const loader = new GLTFLoader();

function loadModel(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, (g) => resolve(g.scene), undefined, reject);
  });
}

// ---------------- PLANE ----------------
const plane = new THREE.Group();
plane.position.set(0, 8, 0);
scene.add(plane);

function addFallbackPlane() {
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0xffaa00 })
  );
  body.rotation.x = Math.PI / 2;
  plane.add(body);
}

loadModel(`${BASE}/assets/models/plane.glb`)
  .then((model) => {
    model.scale.setScalar(2);
    model.rotation.y = Math.PI;
    plane.add(model);
  })
  .catch(() => {
    addFallbackPlane();
  });

// ---------------- МИНИМАЛЬНОЕ ОКРУЖЕНИЕ ----------------
async function addLightWorld() {
  try {
    const tree = await loadModel(`${BASE}/assets/models/tree.glb`);
    tree.scale.setScalar(4);

    for (let i = 0; i < 15; i++) {
      const t = tree.clone(true);
      t.position.set(
        (Math.random() - 0.5) * 400,
        GROUND_Y,
        (Math.random() - 0.5) * 400
      );
      scene.add(t);
    }

    const house = await loadModel(`${BASE}/assets/models/house.glb`);
    house.scale.setScalar(3);

    for (let i = 0; i < 6; i++) {
      const h = house.clone(true);
      h.position.set(
        (Math.random() - 0.5) * 300,
        GROUND_Y,
        (Math.random() - 0.5) * 300
      );
      scene.add(h);
    }
  } catch {}
}

addLightWorld();

// ---------------- CONTROLS ----------------
const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.code));
window.addEventListener("keyup", (e) => keys.delete(e.code));

let speed = 0;

function updatePlane(dt) {
  const accel = 20;
  const maxSpeed = 60;

  if (keys.has("KeyW")) speed += accel * dt;
  if (keys.has("KeyS")) speed -= accel * dt;

  speed = THREE.MathUtils.clamp(speed, 0, maxSpeed);

  if (keys.has("ShiftLeft")) speed *= 1.01;

  if (keys.has("KeyA")) plane.rotation.y += 1.5 * dt;
  if (keys.has("KeyD")) plane.rotation.y -= 1.5 * dt;

  if (keys.has("KeyQ")) plane.position.y += 15 * dt;
  if (keys.has("KeyE")) plane.position.y -= 15 * dt;

  const forward = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(plane.quaternion)
    .normalize();

  plane.position.addScaledVector(forward, speed * dt);

  plane.position.y = THREE.MathUtils.clamp(plane.position.y, GROUND_Y + 2, 150);
}

// ---------------- CAMERA (жёстко сзади) ----------------
function updateCamera() {
  const offset = new THREE.Vector3(0, 6, -18)
    .applyQuaternion(plane.quaternion);

  camera.position.copy(plane.position).add(offset);
  camera.lookAt(plane.position);
}

// ---------------- LOOP ----------------
let last = performance.now();

function animate() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  updatePlane(dt);
  updateCamera();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

// ---------------- RESIZE ----------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
