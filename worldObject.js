import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const BASE = "/heli-game";

const loader = new GLTFLoader();

function loadModel(url) {
  return new Promise((resolve, reject) =>
    loader.load(url, (g) => resolve(g.scene), undefined, reject)
  );
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

/* ---------------- ФИКСИРОВАННЫЕ ОБЪЕКТЫ ---------------- */

const FIXED_TREES = [
  { x: -260, z: -220, rotY: 0.2, scale: 1.05 },
  { x: -180, z: -40, rotY: 1.7, scale: 0.95 },
  { x: -40, z: 210, rotY: 3.1, scale: 1.15 },
  { x: 120, z: 90, rotY: 2.2, scale: 1.0 },
  { x: 260, z: -160, rotY: 0.9, scale: 1.1 },
];

const FIXED_BILLBOARDS = [
  { x: -320, z: 320, rotY: 0.3, scale: 1 },
  { x: -210, z: 290, rotY: -0.2, scale: 1 },
  { x: -90, z: 250, rotY: 0.7, scale: 1 },
  { x: 60, z: 320, rotY: -0.2, scale: 1 },
  { x: 250, z: 290, rotY: 0.4, scale: 1 },

  { x: -60, z: 170, rotY: 0.2, scale: 1 },
  { x: 50, z: 140, rotY: -0.6, scale: 1 },
  { x: 150, z: 210, rotY: 0.9, scale: 1 },

  { x: 120, z: 30, rotY: 0.4, scale: 1.3 },
  { x: -20, z: 20, rotY: -0.2, scale: 1 },
  { x: -140, z: 70, rotY: 0.7, scale: 1 },
  { x: -220, z: 120, rotY: -0.5, scale: 1 },

  { x: -70, z: -40, rotY: 0.1, scale: 1 },
  { x: 40, z: -90, rotY: -0.4, scale: 1 },
  { x: 150, z: -40, rotY: 0.5, scale: 1 },
  { x: -180, z: -120, rotY: 0.9, scale: 1 },

  { x: -320, z: -220, rotY: 0.2, scale: 1 },
  { x: -240, z: -280, rotY: -0.1, scale: 1 },
  { x: -120, z: -300, rotY: 0.6, scale: 1 },
  { x: 10, z: -320, rotY: -0.3, scale: 1 },
  { x: 140, z: -290, rotY: 0.2, scale: 1 },
  { x: 260, z: -260, rotY: -0.4, scale: 1 },
];

const FIXED_HOUSES = [
  { x: -260, z: 20, rotY: 0.55 },
  { x: 170, z: 210, rotY: -1.1 },
];

/* ---------------- ОСНОВНАЯ ФУНКЦИЯ ---------------- */

export async function buildWorld(scene, groundY) {
  /* --- ЗЕМЛЯ --- */
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x3fa34d,
    roughness: 1,
  });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = groundY;
  ground.receiveShadow = true;
  scene.add(ground);

  new THREE.TextureLoader().load(`${BASE}/assets/textures/grass.jpg`, (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(45, 45);
    groundMat.map = tex;
    groundMat.color.set(0xffffff);
    groundMat.needsUpdate = true;
  });

  /* --- ДОМА --- */
  try {
    const houseBase = await loadModel(`${BASE}/assets/models/house.glb`);
    setupShadows(houseBase);
    fitModelToSize(houseBase, 12);
    placeOnGround(houseBase, groundY);

    for (const p of FIXED_HOUSES) {
      const h = houseBase.clone(true);
      h.position.set(p.x, groundY, p.z);
      h.rotation.y = p.rotY;
      scene.add(h);
    }
  } catch {}

  /* --- ДЕРЕВЬЯ --- */
  try {
    const treeBase = await loadModel(`${BASE}/assets/models/tree.glb`);
    setupShadows(treeBase);
    fitModelToSize(treeBase, 10);
    placeOnGround(treeBase, groundY);

    for (const p of FIXED_TREES) {
      const t = treeBase.clone(true);
      t.position.set(p.x, groundY, p.z);
      t.rotation.y = p.rotY;
      t.scale.multiplyScalar(p.scale);
      scene.add(t);
    }
  } catch {}

  /* --- БИЛБОРДЫ --- */
  try {
    const billboardBase = await loadModel(`${BASE}/assets/models/billboard.glb`);
    setupShadows(billboardBase);
    fitModelToSize(billboardBase, 40);
    placeOnGround(billboardBase, groundY);

    for (const p of FIXED_BILLBOARDS) {
      const b = billboardBase.clone(true);
      b.position.set(p.x, groundY, p.z);
      b.rotation.y = p.rotY;
      b.scale.multiplyScalar(p.scale);
      scene.add(b);
    }
  } catch {}
}
