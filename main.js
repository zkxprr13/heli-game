import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

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
    el.style.background = "rgba(0,0,0,0.65)";
    el.style.color = "#fff";
    el.style.fontFamily = "system-ui, sans-serif";
    el.style.fontSize = "12px";
    el.style.whiteSpace = "pre-wrap";
    el.style.zIndex = "9999";
    document.body.appendChild(el);
  }
  el.textContent = msg || "";
}

window.addEventListener("error", (e) => {
  showOverlay("❌ JS ошибка:\n" + (e?.message || e));
});

window.addEventListener("unhandledrejection", (e) => {
  showOverlay("❌ Promise ошибка:\n" + (e?.reason?.message || e?.reason || e));
});

window.addEventListener("load", init); // <-- ключевая строка (DOM точно готов)

function init() {
  const canvas = document.getElementById("game");
  const timerEl = document.getElementById("timer");

  if (!canvas) {
    showOverlay("❌ Не найден <canvas id='game'>.\nПроверь, что в ОПУБЛИКОВАННОМ index.html есть:\n<canvas id=\"game\"></canvas>");
    return;
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
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  sun.shadow.camera.left = -150;
  sun.shadow.camera.right = 150;
  sun.shadow.camera.top = 150;
  sun.shadow.camera.bottom = -150;
  scene.add(sun);

  // ---------- Ground (fallback green, then try grass) ----------
  const groundGeo = new THREE.PlaneGeometry(1200, 1200);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2f8f2f, roughness: 1.0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -5;
  ground.receiveShadow = true;
  scene.add(ground);

  const texLoader = new THREE.TextureLoader();
  texLoader.load(
    "./assets/textures/grass.jpg",
    (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(80, 80);
      groundMat.map = tex;
      groundMat.color.set(0xffffff);
      groundMat.needsUpdate = true;
    },
    undefined,
    () => {
      showOverlay("⚠️ Не загрузилась трава:\n./assets/textures/grass.jpg\n(оставил зелёный пол)");
    }
  );

  // ---------- GLTF ----------
  const gltfLoader = new GLTFLoader();
  const loadGLB = (url) =>
    new Promise((resolve, reject) => gltfLoader.load(url, (g) => resolve(g.scene), undefined, reject));

  function setupModelShadows(root) {
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  // ---------- Plane ----------
  const plane = new THREE.Group();
  plane.position.set(0, 5, 0);
  scene.add(plane);

  // Заглушка (чтобы всегда было что видно)
  function addPlaneFallback() {
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.7 })
    );
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    plane.add(body);
  }

  loadGLB("./assets/models/plane.glb")
    .then((m) => {
      setupModelShadows(m);
      m.scale.setScalar(1.0);
      m.rotation.y = Math.PI;
      plane.clear();
      plane.add(m);
    })
    .catch(() => {
      showOverlay("⚠️ Не загрузился самолёт:\n./assets/models/plane.glb\n(показал заглушку)");
      plane.clear();
      addPlaneFallback();
    });

  // ---------- World ----------
  const world = new THREE.Group();
  scene.add(world);

  const randBetween = (a, b) => a + Math.random() * (b - a);

  async function spawnMany(modelUrl, count, opts = {}) {
    const base = await loadGLB(modelUrl);
    setupModelShadows(base);

    const area = opts.area ?? 450;
    const y = opts.y ?? -5;
    const minScale = opts.minScale ?? 0.8;
    const maxScale = opts.maxScale ?? 1.4;
    const avoidCenterRadius = opts.avoidCenterRadius ?? 30;

    for (let i = 0; i < count; i++) {
      const inst = base.clone(true);

      let x = 0, z = 0;
      for (let t = 0; t < 30; t++) {
        x = randBetween(-area, area);
        z = randBetween(-area, area);
        if (Math.hypot(x, z) > avoidCenterRadius) break;
      }

      inst.position.set(x, y, z);
      inst.scale.setScalar(randBetween(minScale, maxScale));
      inst.rotation.y = randBetween(0, Math.PI * 2);
      world.add(inst);
    }
  }

  (async () => {
    try {
      await spawnMany("./assets/models/house.glb", 25, { area: 220, avoidCenterRadius: 40 });
      await spawnMany("./assets/models/tree.glb", 140, { area: 420, avoidCenterRadius: 25 });
      await spawnMany("./assets/models/mountain.glb", 20, { area: 520, minScale: 3, maxScale: 7, avoidCenterRadius: 180 });
    } catch {
      showOverlay(
        "⚠️ Окружение не загрузилось (house/tree/mountain).\n" +
        "Проверь, что эти файлы реально доступны по ссылкам:\n" +
        "/assets/models/house.glb\n/assets/models/tree.glb\n/assets/models/mountain.glb"
      );
    }
  })();

  // ---------- Controls / Camera / Timer ----------
  const keys = new Set();
  window.addEventListener("keydown", (e) => keys.add(e.code));
  window.addEventListener("keyup", (e) => keys.delete(e.code));

  const velocity = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function updateControls(dt) {
    const baseSpeed = 18;
    const boost = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 2.0 : 1.0;

    const yaw = (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0);
    const pitch = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
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

  function updateCamera(dt) {
    const desiredOffset = new THREE.Vector3(0, 8, -18).applyQuaternion(plane.quaternion);
    const desiredPos = tmp.copy(plane.position).add(desiredOffset);
    camera.position.lerp(desiredPos, 1 - Math.pow(0.001, dt));
    camera.lookAt(tmp.copy(plane.position).add(new THREE.Vector3(0, 3, 0)));
  }

  const startTime = performance.now();
  function updateTimer() {
    if (!timerEl) return;
    const sec = Math.floor((performance.now() - startTime) / 1000);
    timerEl.textContent = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  }

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

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
