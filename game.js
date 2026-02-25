import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const timerEl = document.getElementById("timer");

// Бейдж старта
document.body.insertAdjacentHTML(
  "beforeend",
  "<div id='boot-badge' style='position:fixed;left:12px;top:12px;z-index:99999;background:rgba(0,0,0,0.65);color:#fff;padding:8px 10px;border-radius:10px;font:12px system-ui'>game.js loaded ✅</div>"
);

// Overlay для ошибок
function overlay(msg) {
  let el = document.getElementById("overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "overlay";
    el.style.position = "fixed";
    el.style.left = "12px";
    el.style.bottom = "12px";
    el.style.maxWidth = "720px";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "10px";
    el.style.background = "rgba(0,0,0,0.75)";
    el.style.color = "#fff";
    el.style.font = "12px system-ui";
    el.style.whiteSpace = "pre-wrap";
    el.style.zIndex = "99999";
    document.body.appendChild(el);
  }
  el.textContent = msg;
}

window.addEventListener("error", (e) => overlay("❌ JS error:\n" + (e?.message || e)));
window.addEventListener("unhandledrejection", (e) =>
  overlay("❌ Promise error:\n" + (e?.reason?.message || e?.reason || e))
);

// Таймер всегда
const start = performance.now();
setInterval(() => {
  if (!timerEl) return;
  const sec = Math.floor((performance.now() - start) / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  timerEl.textContent = `${mm}:${ss}`;
}, 250);

// ---- Three.js scene ----
try {
  const canvas = document.getElementById("game");
  if (!canvas) {
    overlay("❌ Нет canvas#game в index.html");
    throw new Error("canvas#game missing");
  }

  canvas.style.width = "100vw";
  canvas.style.height = "100vh";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
  camera.position.set(0, 15, -30);
  camera.lookAt(0, 5, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 1.0));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(60, 120, 40);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshStandardMaterial({ color: 0x3fa34d })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(3, 3, 3),
    new THREE.MeshStandardMaterial({ color: 0xff00ff })
  );
  cube.position.set(5, 1.5, 0);
  scene.add(cube);

  const plane = new THREE.Group();
  plane.position.set(0, 8, 0);
  scene.add(plane);

  const fallback = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd166 })
  );
  fallback.rotation.x = Math.PI / 2;
  plane.add(fallback);

  const loader = new GLTFLoader();
  loader.load(
    "./assets/models/plane.glb",
    (gltf) => {
      plane.clear();
      plane.add(gltf.scene);
    },
    undefined,
    (err) => console.warn("plane.glb not loaded", err)
  );

  const keys = new Set();
  window.addEventListener("keydown", (e) => keys.add(e.code));
  window.addEventListener("keyup", (e) => keys.delete(e.code));

  let last = performance.now();
  function tick() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    const speed = 20;
    if (keys.has("KeyA")) plane.rotation.y += dt;
    if (keys.has("KeyD")) plane.rotation.y -= dt;
    if (keys.has("KeyW")) plane.position.z += speed * dt;
    if (keys.has("KeyS")) plane.position.z -= speed * dt;
    if (keys.has("KeyQ")) plane.position.y += speed * dt;
    if (keys.has("KeyE")) plane.position.y -= speed * dt;

    camera.position.lerp(new THREE.Vector3(plane.position.x, plane.position.y + 6, plane.position.z - 18), 0.06);
    camera.lookAt(plane.position);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  });

  document.getElementById("boot-badge").textContent = "Three.js running ✅";
} catch (e) {
  overlay("❌ Three.js init failed:\n" + (e?.message || e));
  console.error(e);
}
