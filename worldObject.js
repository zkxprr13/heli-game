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

function randBetween(a, b) {
  return a + Math.random() * (b - a);
}

export async function buildWorld(scene, groundY) {

  // -------- GROUND --------
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

  // -------- HOUSES --------
  try {
    const houseBase = await loadModel(`${BASE}/assets/models/house.glb`);
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

  // -------- TREES --------
  try {
    const treeBase = await loadModel(`${BASE}/assets/models/tree.glb`);
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
}
