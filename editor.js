// editor.js
import * as THREE from "./vendor/three/build/three.module.js";
import { TransformControls } from "./vendor/three/examples/jsm/controls/TransformControls.js";
import { OrbitControls } from "./vendor/three/examples/jsm/controls/OrbitControls.js";

export class MapEditor {
  constructor({ scene, camera, renderer, domElement, selectableRoots = [] }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.domElement = domElement;

    this.enabled = false;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Камера-редактор (чтобы удобно летать камерой при редактировании)
    this.orbit = new OrbitControls(camera, domElement);
    this.orbit.enabled = false;
    this.orbit.enableDamping = true;

    // Гизмо перемещения/вращения/масштаба
    this.transform = new TransformControls(camera, domElement);
    this.transform.enabled = false;
    this.transform.visible = false;
    scene.add(this.transform);

    // Когда тащим гизмо — выключаем Orbit
    this.transform.addEventListener("dragging-changed", (e) => {
      this.orbit.enabled = this.enabled && !e.value;
    });

    // какие объекты можно выбирать
    this.selectableRoots = selectableRoots; // массив Group/Objects

    this.selected = null;

    this._onPointerDown = this.onPointerDown.bind(this);
    this._onKeyDown = this.onKeyDown.bind(this);

    window.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("keydown", this._onKeyDown);
  }

  setEnabled(on) {
    this.enabled = on;
    this.orbit.enabled = on;
    this.transform.enabled = on;
    this.transform.visible = on;

    if (!on) {
      this.transform.detach();
      this.selected = null;
    }
  }

  // Чтобы добавить в “выбираемые” объекты после загрузки
  addSelectableRoot(obj) {
    this.selectableRoots.push(obj);
  }

  // Выбор кликом
  onPointerDown(e) {
    if (!this.enabled) return;

    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Собираем все меши из selectableRoots
    const meshes = [];
    for (const root of this.selectableRoots) {
      root.traverse((n) => {
        if (n.isMesh) meshes.push(n);
      });
    }

    const hits = this.raycaster.intersectObjects(meshes, true);
    if (!hits.length) return;

    // Поднимаемся к верхнему “root” объекта, который ты хочешь двигать
    // (обычно ты будешь добавлять в selectableRoots именно группами — дом/дерево/билборд)
    const hitObj = hits[0].object;
    const root = this.findRootSelectable(hitObj) ?? hitObj;

    this.select(root);
  }

  findRootSelectable(obj) {
    // ищем ближайшего предка, который входит в selectableRoots
    let cur = obj;
    while (cur) {
      if (this.selectableRoots.includes(cur)) return cur;
      cur = cur.parent;
    }
    return null;
  }

  select(obj) {
    this.selected = obj;
    this.transform.attach(obj);
  }

  // Горячие клавиши
  onKeyDown(e) {
    if (!this.enabled) return;

    if (e.code === "KeyG") this.transform.setMode("translate"); // Move
    if (e.code === "KeyR") this.transform.setMode("rotate");    // Rotate
    if (e.code === "KeyS") this.transform.setMode("scale");     // Scale

    // Удалить объект
    if (e.code === "Delete" && this.selected) {
      this.selected.removeFromParent();
      this.transform.detach();
      this.selected = null;
    }

    // Сохранить / загрузить
    if (e.code === "F5") this.saveToLocalStorage();
    if (e.code === "F9") this.loadFromLocalStorage();
  }

  // Сохраняем только transform и тип объекта (имя)
  // Лучше всего, чтобы у объектов было obj.userData.type = "billboard"/"house"/"tree"
  serialize() {
    const items = [];
    for (const root of this.selectableRoots) {
      if (!root.parent) continue; // уже удалён
      items.push({
        type: root.userData?.type ?? root.name ?? "object",
        name: root.name ?? "",
        position: { x: root.position.x, y: root.position.y, z: root.position.z },
        rotation: { x: root.rotation.x, y: root.rotation.y, z: root.rotation.z },
        scale: { x: root.scale.x, y: root.scale.y, z: root.scale.z },
      });
    }
    return { version: 1, items };
  }

  saveToLocalStorage(key = "heli_map_v1") {
    const data = this.serialize();
    localStorage.setItem(key, JSON.stringify(data));
    console.log("[MapEditor] saved:", key, data);
  }

  // ВАЖНО: загрузка меняет трансформы существующих объектов по порядку.
  // Более круто — пересоздавать по type, но это следующий шаг.
  loadFromLocalStorage(key = "heli_map_v1") {
    const raw = localStorage.getItem(key);
    if (!raw) return console.warn("[MapEditor] no saved map:", key);

    const data = JSON.parse(raw);
    const items = data.items ?? [];
    for (let i = 0; i < Math.min(items.length, this.selectableRoots.length); i++) {
      const r = this.selectableRoots[i];
      const it = items[i];

      r.position.set(it.position.x, it.position.y, it.position.z);
      r.rotation.set(it.rotation.x, it.rotation.y, it.rotation.z);
      r.scale.set(it.scale.x, it.scale.y, it.scale.z);
    }
    console.log("[MapEditor] loaded:", key);
  }

  update() {
    if (this.enabled) this.orbit.update();
  }
}
