import * as THREE from "./vendor/three/three.module.js";
import { GLTFLoader } from "./vendor/three/GLTFLoader.js";

function ensureBadge() {
  document.body.insertAdjacentHTML(
    "beforeend",
    "<div id='startup-badge' style='position:fixed;left:12px;top:12px;z-index:10000;background:#102018cc;color:#d1fae5;padding:6px 10px;border-radius:8px;font:12px system-ui'>main.js started ✅</div>"
  );
}

function getOverlay() {
  let el = document.getElementById("overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "overlay";
    el.style.position = "fixed";
    el.style.left = "12px";
    el.style.bottom = "12px";
    el.style.maxWidth = "640px";
    el.style.maxHeight = "40vh";
    el.style.overflow = "auto";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "10px";
    el.style.background = "rgba(0,0,0,0.72)";
    el.style.color = "#fff";
    el.style.fontFamily = "system-ui, sans-serif";
    el.style.fontSize = "12px";
    el.style.whiteSpace = "pre-wrap";
    el.style.zIndex = "9999";
    document.body.appendChild(el);
  }
  return el;
}

function showOverlay(msg, mode = "append") {
  const el = getOverlay();
  if (!msg) {
    el.textContent = "";
    return;
  }
  if (mode === "replace" || !el.textContent) {
    el.textContent = msg;
  } else if (!el.textContent.includes(msg)) {
    el.textContent += `\n${msg}`;
  }
}

window.addEventListener("error", (e) => {
  showOverlay(`❌ JS error: ${e?.message || e}`);
});
window.addEventListener("unhandledrejection", (e) => {
  showOverlay(`❌ Promise error: ${e?.reason?.message || e?.reason || e}`);
});

window.addEventListener("load", init);

function setupModelShadows(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
}

function fitModelToSize(model, targetSize) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / maxDim;
  model.scale.multiplyScalar(scale);
  return scale;
}

function placeModelOnGround(model, groundY) {
  const box = new THREE.Box3().setFromObject(model);
  model.position.y += groundY - box.min.y;
}

function init() {
  ensureBadge();

  const canvas = document.getElementById("game");
  const timerEl = document.getElementById("timer");

  if (!canvas) {
    showOverlay("❌ Canvas not found: expected <canvas id=\"game\"></canvas>", "replace");
    return;
  }

  if (!THREE.Scene || !GLTFLoader) {
    showOverlay("❌ Local Three.js vendor files are invalid. Check vendor/three/*.js", "replace");
    return;
  }

  try {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 80, 450);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
    camera.position.set(0, 20, -30);
    camera.lookAt(0, 5, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x2b4b2b, 0.9);
    scene.add(hemiLight);

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

    const GROUND_Y = -5;
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2f8f2f, roughness: 1.0 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = GROUND_Y;
    ground.receiveShadow = true;
    scene.add(ground);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "./assets/textures/grass.jpg",
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(80, 80);
        groundMat.map = texture;
        groundMat.color.set(0xffffff);
        groundMat.needsUpdate = true;
      },
      undefined,
      () => {
        showOverlay("⚠️ grass.jpg not loaded, fallback green ground is used.");
      }
    );

    const testCube = new THREE.Mesh(
      new THREE.BoxGeometry(3, 3, 3),
      new THREE.MeshStandardMaterial({ color: 0xff00ff })
    );
    testCube.position.set(3, GROUND_Y + 2, 0);
    testCube.castShadow = true;
    testCube.receiveShadow = true;
    scene.add(testCube);

    const plane = new THREE.Group();
    plane.position.set(0, 12, 0);
    scene.add(plane);

    const world = new THREE.Group();
    scene.add(world);

    const loader = new GLTFLoader();
    const loadGLB = (url) =>
      new Promise((resolve, reject) => loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject));

    function addPlaneFallback() {
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.6, 2.2, 8),
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

      plane.clear();
      plane.add(body);
      plane.add(wing);
    }

    function addWorldFallback() {
      const boxGeo = new THREE.BoxGeometry(2, 2, 2);
      for (let i = 0; i < 40; i += 1) {
        const cube = new THREE.Mesh(
          boxGeo,
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.6, 0.55),
            roughness: 0.9,
          })
        );
        cube.position.set((Math.random() - 0.5) * 420, GROUND_Y + 1 + Math.random() * 12, (Math.random() - 0.5) * 420);
        cube.castShadow = true;
        cube.receiveShadow = true;
        world.add(cube);
      }
    }

    loadGLB("./assets/models/plane.glb")
      .then((model) => {
        setupModelShadows(model);
        fitModelToSize(model, 4);
        placeModelOnGround(model, 0);
        model.rotation.y = Math.PI;
        plane.clear();
        plane.add(model);
        plane.position.y = 10;
      })
      .catch(() => {
        showOverlay("⚠️ plane.glb not loaded, fallback airplane is used.");
        addPlaneFallback();
      });

    const randBetween = (min, max) => min + Math.random() * (max - min);
    async function spawnMany(url, count, opts) {
      const base = await loadGLB(url);
      setupModelShadows(base);

      for (let i = 0; i < count; i += 1) {
        const item = base.clone(true);
        fitModelToSize(item, opts.targetSize);
        placeModelOnGround(item, GROUND_Y);
        item.position.x += randBetween(-opts.area, opts.area);
        item.position.z += randBetween(-opts.area, opts.area);
        item.rotation.y = randBetween(0, Math.PI * 2);
        item.scale.multiplyScalar(randBetween(opts.minScale, opts.maxScale));
        placeModelOnGround(item, GROUND_Y);
        world.add(item);
      }
    }

    (async () => {
      try {
        await spawnMany("./assets/models/house.glb", 25, { targetSize: 8, area: 220, minScale: 0.9, maxScale: 1.2 });
        await spawnMany("./assets/models/tree.glb", 140, { targetSize: 10, area: 420, minScale: 0.7, maxScale: 1.4 });
        await spawnMany("./assets/models/mountain.glb", 20, { targetSize: 70, area: 520, minScale: 0.8, maxScale: 1.2 });
      } catch {
        showOverlay("⚠️ Some world models failed to load, fallback cubes are used.");
        addWorldFallback();
      }
    })();

    const keys = new Set();
    window.addEventListener("keydown", (e) => keys.add(e.code));
    window.addEventListener("keyup", (e) => keys.delete(e.code));

    const velocity = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const tmp = new THREE.Vector3();

    function updateControls(dt) {
      const baseSpeed = 18;
      const boost = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 2 : 1;
      const yaw = (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0);
      const pitch = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
      const upDown = (keys.has("KeyE") ? 1 : 0) - (keys.has("KeyQ") ? 1 : 0);

      plane.rotation.y += yaw * dt * 1.3;
      plane.rotation.x += pitch * dt * 0.9;
      plane.rotation.x = THREE.MathUtils.clamp(plane.rotation.x, -1.0, 1.0);

      forward.set(0, 0, 1).applyQuaternion(plane.quaternion).normalize();
      velocity.copy(forward).multiplyScalar(baseSpeed * boost);
      velocity.y += upDown * baseSpeed * boost * 0.7;

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
  } catch (error) {
    showOverlay(`❌ init failed: ${error?.message || error}`, "replace");
    // eslint-disable-next-line no-console
    console.error(error);
  }
}
