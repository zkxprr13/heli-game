import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

console.log("Three.js game started");

window.addEventListener("load", init);

function init() {
  const canvas = document.getElementById("game");
  const timerEl = document.getElementById("timer");

  // ---------- Scene ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  // ---------- Camera ----------
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1200
  );
  camera.position.set(0, 15, -30);

  // ---------- Renderer ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  // ---------- Light ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));

  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(50, 100, 50);
  sun.castShadow = true;
  scene.add(sun);

  // ---------- Ground ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshStandardMaterial({ color: 0x3fa34d })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- TEST cube (всегда должен быть) ----------
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(3, 3, 3),
    new THREE.MeshStandardMaterial({ color: 0xff00ff })
  );
  cube.position.set(5, 2, 0);
  cube.castShadow = true;
  scene.add(cube);

  // ---------- Plane ----------
  const plane = new THREE.Group();
  plane.position.set(0, 8, 0);
  scene.add(plane);

  // fallback самолёт
  const fallback = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd166 })
  );
  fallback.rotation.x = Math.PI / 2;
  plane.add(fallback);

  // пробуем загрузить реальную модель
  const loader = new GLTFLoader();
  loader.load(
    "./assets/models/plane.glb",
    (gltf) => {
      plane.clear();
      plane.add(gltf.scene);
    },
    undefined,
    () => console.warn("Plane model not loaded")
  );

  // ---------- Timer ----------
  const start = performance.now();
  function updateTimer() {
    if (!timerEl) return;
    const sec = Math.floor((performance.now() - start) / 1000);
    timerEl.textContent =
      String(Math.floor(sec / 60)).padStart(2, "0") +
      ":" +
      String(sec % 60).padStart(2, "0");
  }

  // ---------- Controls ----------
  const keys = new Set();
  window.addEventListener("keydown", e => keys.add(e.code));
  window.addEventListener("keyup", e => keys.delete(e.code));

  function updateControls(dt) {
    const speed = 20;

    if (keys.has("KeyA")) plane.rotation.y += dt;
    if (keys.has("KeyD")) plane.rotation.y -= dt;
    if (keys.has("KeyW")) plane.position.z += speed * dt;
    if (keys.has("KeyS")) plane.position.z -= speed * dt;
    if (keys.has("KeyQ")) plane.position.y += speed * dt;
    if (keys.has("KeyE")) plane.position.y -= speed * dt;
  }

  // ---------- Loop ----------
  let last = performance.now();

  function animate() {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;

    updateControls(dt);
    updateTimer();

    camera.position.lerp(
      new THREE.Vector3(plane.position.x, plane.position.y + 6, plane.position.z - 18),
      0.05
    );
    camera.lookAt(plane.position);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
