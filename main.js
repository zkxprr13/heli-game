console.log("main.js started");
document.body.insertAdjacentHTML(
  "beforeend",
  "<div id='startup-overlay' style='position:fixed;left:12px;top:12px;z-index:99999;background:#000a;color:#fff;padding:6px 8px;border-radius:8px;font:12px system-ui'>main.js started</div>"
);

function showOverlay(msg) {
  let el = document.getElementById("overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "overlay";
    el.style.position = "fixed";
    el.style.left = "12px";
    el.style.bottom = "12px";
    el.style.maxWidth = "560px";
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

window.addEventListener("load", init);

async function init() {
  let THREE;
  let GLTFLoader;

  try {
    THREE = await import("./vendor/three/three.module.js");
    ({ GLTFLoader } = await import("./vendor/three/GLTFLoader.js"));
  } catch (error) {
    showOverlay(
      "❌ Не удалось загрузить локальные модули Three.js:\n" +
        "- ./vendor/three/three.module.js\n" +
        "- ./vendor/three/GLTFLoader.js\n" +
        "Проверь, что файлы закоммичены в репозиторий."
    );
    console.error("Failed to load local Three.js modules", error);

    const canvas = document.getElementById("game");
    if (canvas instanceof HTMLCanvasElement) {
      const ctx = canvas.getContext("2d");
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (ctx) {
        ctx.fillStyle = "#0b1020";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#f87171";
        ctx.font = "18px system-ui";
        ctx.fillText("Three.js vendor-файлы не найдены", 24, 48);
      }
    }
    return;
  }

  const canvas = document.getElementById("game");
  const timerEl = document.getElementById("timer");

  if (!canvas) {
    showOverlay(
      "❌ Не найден <canvas id='game'>.\n" +
        "Проверь, что в ОПУБЛИКОВАННОМ index.html есть:\n" +
        "<canvas id=\"game\"></canvas>"
    );
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

  // Стартовая камера — чтобы точно что-то увидеть
  camera.position.set(0, 20, -30);
  camera.lookAt(0, 5, 0);

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
  const GROUND_Y = -5;

  const groundGeo = new THREE.PlaneGeometry(1200, 1200);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2f8f2f, roughness: 1.0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y;
  ground.receiveShadow = true;
  scene.add(ground);

  // Тестовый куб — если его видно, значит рендер/камера работают (можешь потом удалить)
  const testCube = new THREE.Mesh(
    new THREE.BoxGeometry(3, 3, 3),
    new THREE.MeshStandardMaterial({ color: 0xff00ff })
  );
  testCube.position.set(0, GROUND_Y + 2, 0);
  testCube.castShadow = true;
  scene.add(testCube);

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
      // убираем сообщение, если было
      showOverlay("");
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

  // Авто-масштаб модели под “понятный” размер
  function fitModelToSize(model, targetSize = 3) {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = targetSize / maxDim;
    model.scale.multiplyScalar(scale);
    return scale;
  }

  // Ставим модель на землю по нижней границе (minY)
  function placeModelOnGround(model, groundY = GROUND_Y) {
    const box = new THREE.Box3().setFromObject(model);
    const minY = box.min.y;
    model.position.y += groundY - minY;
  }

  // ---------- Plane ----------
  const plane = new THREE.Group();
  plane.position.set(0, 10, 0); // повыше, чтобы точно было видно
  scene.add(plane);

  function addPlaneFallback() {
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.7 })
    );
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    plane.add(body);

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.12, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x8ecae6, roughness: 0.8 })
    );
    wing.position.set(0, 0, 0.2);
    wing.castShadow = true;
    plane.add(wing);
  }

  loadGLB("./assets/models/plane.glb")
    .then((m) => {
      setupModelShadows(m);

      // делаем самолёт “адекватного” размера
      fitModelToSize(m, 4);

      // иногда надо развернуть
      m.rotation.y = Math.PI;

      plane.clear();
      plane.add(m);
    })
    .catch((e) => {
      showOverlay("⚠️ Не загрузился самолёт:\n./assets/models/plane.glb\n(показал заглушку)");
      console.warn("Plane load error:", e);
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
    const minScale = opts.minScale ?? 0.8;
    const maxScale = opts.maxScale ?? 1.4;
    const avoidCenterRadius = opts.avoidCenterRadius ?? 30;
    const targetSize = opts.targetSize ?? 6;

    for (let i = 0; i < count; i++) {
      const inst = base.clone(true);

      // авто-размер и посадка на землю
      fitModelToSize(inst, targetSize);
      placeModelOnGround(inst, GROUND_Y);

      // позиция
      let x = 0,
        z = 0;
      for (let t = 0; t < 30; t++) {
        x = randBetween(-area, area);
        z = randBetween(-area, area);
        if (Math.hypot(x, z) > avoidCenterRadius) break;
      }

      inst.position.x += x;
      inst.position.z += z;

      // случайный масштаб (чуть)
      inst.scale.multiplyScalar(randBetween(minScale, maxScale));

      // поворот
      inst.rotation.y = randBetween(0, Math.PI * 2);

      world.add(inst);
    }
  }

  (async () => {
    try {
      await spawnMany("./assets/models/house.glb", 25, {
        area: 220,
        avoidCenterRadius: 40,
        targetSize: 8, // домики чуть крупнее
        minScale: 0.9,
        maxScale: 1.2,
      });

      await spawnMany("./assets/models/tree.glb", 140, {
        area: 420,
        avoidCenterRadius: 25,
        targetSize: 10, // деревья выше
        minScale: 0.7,
        maxScale: 1.4,
      });

      await spawnMany("./assets/models/mountain.glb", 20, {
        area: 520,
        avoidCenterRadius: 180,
        targetSize: 70, // горы очень крупные
        minScale: 0.8,
        maxScale: 1.2,
      });
    } catch (e) {
      showOverlay(
        "⚠️ Окружение не загрузилось.\nПроверь файлы:\n" +
          "- ./assets/models/house.glb\n" +
          "- ./assets/models/tree.glb\n" +
          "- ./assets/models/mountain.glb"
      );
      console.warn("World load error:", e);

      // кубики-заглушки
      const boxGeo = new THREE.BoxGeometry(2, 2, 2);
      for (let i = 0; i < 40; i++) {
        const cube = new THREE.Mesh(
          boxGeo,
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.6, 0.55),
            roughness: 0.9,
          })
        );
        cube.position.set(randBetween(-200, 200), randBetween(GROUND_Y + 1, 12), randBetween(-200, 200));
        cube.castShadow = true;
        cube.receiveShadow = true;
        world.add(cube);
      }
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
    plane.position.y = THREE.MathUtils.clamp(plane.position.y, GROUND_Y + 2, 220);
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
