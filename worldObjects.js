import * as THREE from "./vendor/three/build/three.module.js";
import { GLTFLoader } from "./vendor/three/examples/jsm/loaders/GLTFLoader.js";

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

function randBetween(a, b) {
  return a + Math.random() * (b - a);
}

// Твои фиксированные билборды (оставил как было)
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

export async function buildWorldObjects(scene, groundY, baseUrl, manager) {
  const gltfLoader = new GLTFLoader(manager);
  const loadModel = (url) =>
    new Promise((resolve, reject) => gltfLoader.load(url, (g) => resolve(g.scene), undefined, reject));

  // --- houses ---
  try {
    const houseBase = await loadModel(`${baseUrl}/assets/models/house.glb`);
    setupShadows(houseBase);
    fitModelToSize(houseBase, 12);
    placeOnGround(houseBase, groundY);

    const h1 = houseBase.clone(true);
    h1.position.set(-220, groundY, -140);
    h1.rotation.y = 0.6;
    scene.add(h1);

    const h2 = houseBase.clone(true);
    h2.position.set(200, groundY, 160);
    h2.rotation.y = -1.2;
    scene.add(h2);
  } catch {}

  // --- trees (как было: 18 рандомных) ---
  try {
    const treeBase = await loadModel(`${baseUrl}/assets/models/tree.glb`);
    setupShadows(treeBase);
    fitModelToSize(treeBase, 10);
    placeOnGround(treeBase, groundY);

    for (let i = 0; i < 18; i++) {
      const t = treeBase.clone(true);
      t.position.set(randBetween(-300, 300), groundY, randBetween(-300, 300));
      t.rotation.y = randBetween(0, Math.PI * 2);
      t.scale.multiplyScalar(randBetween(0.85, 1.25));
      scene.add(t);
    }
  } catch {}

  // --- billboards (фиксированные) ---
  try {
    const billboardBase = await loadModel(`${baseUrl}/assets/models/billboard.glb`);
    setupShadows(billboardBase);
    fitModelToSize(billboardBase, 40);
    placeOnGround(billboardBase, groundY);

    for (const p of FIXED_BILLBOARDS) {
      const b = billboardBase.clone(true);
      b.position.set(p.x, groundY, p.z);
      b.rotation.y = p.rotY ?? 0;
      b.scale.multiplyScalar(p.scale ?? 1);
      scene.add(b);
    }
  } catch {}
}
