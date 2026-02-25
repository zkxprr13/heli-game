import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const canvas = document.getElementById("game");
const timerEl = document.getElementById("timer");

// --- Scene / Camera / Renderer ---
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b1020, 30, 180);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// --- Light ---
scene.add(new THREE.AmbientLight(0xffffff, 0.7));

const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(10, 20, 10);
scene.add(dir);

// --- Ground (простая "территория") ---
const groundGeo = new THREE.PlaneGeometry(400, 400, 1, 1);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x12224a,
  roughness: 1,
  metalness: 0,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -5;
scene.add(ground);

// Сетка для ориентира (можно убрать)
const grid = new THREE.GridHelper(400, 40, 0x27407a, 0x1a2e5a);
grid.position.y = -4.99;
scene.add(grid);

// --- "Самолёт" (простой треугольник) ---
const plane = new THREE.Group();

// корпус
const body = new THREE.Mesh(
  new THREE.ConeGeometry(0.6, 2.2, 8),
  new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.7 })
);
body.rotation.x = Math.PI / 2; // "нос" вперёд по Z
plane.add(body);

// "крылья"
const wing = new THREE.Mesh(
  new THREE.BoxGeometry(2.2, 0.12, 0.6),
  new THREE.MeshStandardMaterial({ color: 0x8ecae6, roughness: 0.8 })
);
wing.position.set(0, 0, 0.2);
plane.add(wing);

plane.position.set(0, 0, 0);
scene.add(plane);

// --- Декор: много 3D фигур ---
const deco = new THREE.Group();
scene.add(deco);

function randBetween(a, b) {
  return a + Math.random() * (b - a);
}

const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
for (let i = 0; i < 80; i++) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(Math.random(), 0.6, 0.55),
    roughness: 0.9,
  });
  const cube = new THREE.Mesh(boxGeo, mat);
  cube.position.set(randBetween(-150, 150), randBetween(-3, 10), randBetween(-150, 150));
  cube.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  deco.add(cube);
}

// --- Управление ---
const keys = new Set();

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  // чтобы не скроллило страницу на WASD/стрелках
  if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
});

const velocity = new THREE.Vector3(0, 0, 0);
const forward = new THREE.Vector3(0, 0, 1);
const tmp = new THREE.Vector3();

function updateControls(dt) {
  const baseSpeed = 10; // units/sec
  const boost = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 2.2 : 1.0;

  // направление "вперёд" самолёта
  forward.set(0, 0, 1).applyQuaternion(plane.quaternion).normalize();

  // повороты (A/D или стрелки)
  const yaw = (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) - (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);
  const pitch = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);

  // вверх/вниз (Q/E)
  const upDown = (keys.has("KeyE") ? 1 : 0) - (keys.has("KeyQ") ? 1 : 0);

  // плавные повороты
  plane.rotation.y += yaw * dt * 1.6;
  plane.rotation.x += pitch * dt * 1.2;

  // ограничим наклон по X, чтобы не переворачиваться
  plane.rotation.x = THREE.MathUtils.clamp(plane.rotation.x, -1.1, 1.1);

  // движение: всегда немного летим вперёд + можем менять высоту
  const speed = baseSpeed * boost;

  velocity.copy(forward).multiplyScalar(speed);
  velocity.y += upDown * speed * 0.7;

  // применяем
  plane.position.addScaledVector(velocity, dt);

  // не даём улететь под землю
  plane.position.y = Math.max(plane.position.y, -3);
}

// --- Камера: третье лицо за самолётом ---
function updateCamera(dt) {
  // камера позади и чуть сверху
  const desiredOffset = new THREE.Vector3(0, 4.5, -10);
  desiredOffset.applyQuaternion(plane.quaternion);

  const desiredPos = tmp.copy(plane.position).add(desiredOffset);
  camera.position.lerp(desiredPos, 1 - Math.pow(0.001, dt)); // плавность

  const lookAt = tmp.copy(plane.position).add(new THREE.Vector3(0, 1.5, 0));
  camera.lookAt(lookAt);
}

// --- Таймер ---
const startTime = performance.now();
function updateTimer() {
  const ms = performance.now() - startTime;
  const totalSec = Math.floor(ms / 1000);

  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");

  timerEl.textContent = `${mm}:${ss}`;
}

// --- Loop ---
let last = performance.now();
function animate() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  updateControls(dt);
  updateCamera(dt);
  updateTimer();

  // лёгкая анимация кубиков (чтобы было живее)
  deco.children.forEach((m, i) => {
    m.rotation.y += dt * 0.15 * (i % 3 ? 1 : -1);
  });

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// --- Resize ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});