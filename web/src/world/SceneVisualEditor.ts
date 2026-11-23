import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export type EditorTool = 'translate' | 'rotate' | 'scale';
type Vector3Tuple = [number, number, number];
type TransformRecord = {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
};
type LayoutFile = {
  format: 'lembah-asri-scene-layout';
  version: 1;
  transforms: Record<string, TransformRecord>;
};
export type SceneEditorItem = { id: string; label: string; locked: boolean; group: string };
export type SceneEditorSnapshot = {
  active: boolean;
  items: SceneEditorItem[];
  selectedId: string | null;
  selected?: TransformRecord;
  mode: EditorTool;
  message: string;
};

const STORAGE_KEY = 'lembah-asri-scene-layout-v1';
const LAYOUT_FORMAT = 'lembah-asri-scene-layout';
const LOCKED = /terrain|meadow|grass|vegetation|stream|creek|river|water|bank|garden|farm|crop|soil|earth clearing|courtyard|path|shadow|collision|bridge|fence|pagar|house|rumah|warung|balai|pendopo|pasar|puskesmas/i;
const validNumber = (n: unknown, limit = 10000): n is number =>
  typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit;
function validVector(value: unknown, limit = 10000): value is Vector3Tuple {
  return Array.isArray(value) && value.length === 3 && value.every(x => validNumber(x, limit));
}
function validTransform(value: unknown): value is TransformRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<TransformRecord>;
  return validVector(v.position) && validVector(v.rotation, 100)
    && validVector(v.scale, 100) && v.scale.every(x => x >= 0.02);
}
function parseLayout(text: string): LayoutFile {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('Format layout tidak valid');
  const file = parsed as Partial<LayoutFile>;
  if (file.format !== LAYOUT_FORMAT || file.version !== 1
      || !file.transforms || typeof file.transforms !== 'object'
      || Array.isArray(file.transforms) || Object.keys(file.transforms).length > 2000) {
    throw new Error('Bukan file layout Lembah Asri versi 1');
  }
  for (const value of Object.values(file.transforms)) {
    if (!validTransform(value)) throw new Error('Transform pada layout tidak valid');
  }
  return file as LayoutFile;
}
function capture(object: THREE.Object3D): TransformRecord {
  return {
    position: [object.position.x, object.position.y, object.position.z],
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    scale: [object.scale.x, object.scale.y, object.scale.z]
  };
}
function apply(object: THREE.Object3D, transform: TransformRecord) {
  object.position.set(...transform.position);
  object.rotation.set(...transform.rotation);
  object.scale.set(...transform.scale);
  object.updateMatrixWorld(true);
}
function hasVisibleMesh(object: THREE.Object3D) {
  let found = false;
  object.traverse(node => {
    if (node.visible && (node instanceof THREE.Mesh || node instanceof THREE.InstancedMesh)) found = true;
  });
  return found;
}

export class SceneVisualEditor {
  active = false;
  private orbit: OrbitControls;
  private transform: TransformControls;
  private helper: THREE.Object3D;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private entries = new Map<string, { object: THREE.Object3D; info: SceneEditorItem }>();
  private defaults = new Map<string, { uuid: string; transform: TransformRecord }>();
  private overrides: Record<string, TransformRecord> = {};
  private published: Record<string, TransformRecord> = {};
  private selectedId: string | null = null;
  private mode: EditorTool = 'translate';
  private message = 'Pilih objek di scene atau daftar kiri.';
  private lastScan = 0;
  private lastEntrySignature = '';

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLCanvasElement,
    private player: THREE.Object3D | undefined,
    private changed: (snapshot: SceneEditorSnapshot) => void
  ) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) this.overrides = parseLayout(raw).transforms;
    } catch (error) {
      console.warn('[LembahAsri] Layout lokal diabaikan', error);
    }
    this.orbit = new OrbitControls(camera, canvas);
    this.orbit.enabled = false;
    this.orbit.enableDamping = true;
    this.orbit.maxDistance = 95;
    this.orbit.minDistance = 1.2;
    this.orbit.target.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(10));
    this.transform = new TransformControls(camera, canvas);
    this.helper = this.transform.getHelper();
    this.helper.visible = false;
    scene.add(this.helper);
    this.transform.addEventListener('dragging-changed', event => {
      this.orbit.enabled = this.active && !event.value;
    });
    this.transform.addEventListener('mouseUp', () => {
      this.recordSelected();
      this.persist();
      this.changed(this.snapshot());
    });
    canvas.addEventListener('pointerdown', this.onPick);
    void this.loadPublishedLayout();
  }

  private allObjects() {
    const result: Array<{ object: THREE.Object3D; group: string }> = [];
    const visit = (object: THREE.Object3D, group: string, depth = 0) => {
      if (!object.visible || object === this.player || object === this.helper
          || object instanceof THREE.Light || object instanceof THREE.Camera
          || !hasVisibleMesh(object)) return;
      // The homestead and warung are scene collections, not single editable meshes.
      if (depth === 0 && object instanceof THREE.Group
          && /Rumah Masa Kecil \/ Playable|Warung Lembah Asri \/ Modular/.test(object.name)) {
        for (const child of object.children) visit(child, object.name, depth + 1);
        return;
      }
      // Let every curated rock be selected and repositioned independently.
      if (/Curated original UV textured rock placements/.test(object.name)) {
        for (const child of object.children) visit(child, group, depth + 1);
        return;
      }
      result.push({ object, group });
    };
    for (const object of this.scene.children) visit(object, 'Dunia Lembah Asri');
    return result;
  }

  refresh() {
    const next = new Map<string, { object: THREE.Object3D; info: SceneEditorItem }>();
    const siblings = new Map<string, number>();
    for (const { object, group } of this.allObjects()) {
      const label = object.name.trim() || (object instanceof THREE.Mesh
        ? object.geometry.type : object.type);
      const keyBase = group + '/' + label;
      const ordinal = (siblings.get(keyBase) || 0) + 1;
      siblings.set(keyBase, ordinal);
      const id = keyBase + '#' + ordinal;
      const locked = LOCKED.test(label) || object instanceof THREE.InstancedMesh;
      const info = { id, label, locked, group };
      next.set(id, { object, info });
      const existing = this.defaults.get(id);
      if (!existing || existing.uuid !== object.uuid) {
        this.defaults.set(id, { uuid: object.uuid, transform: capture(object) });
        const saved = this.overrides[id] || this.published[id];
        if (!locked && saved) apply(object, saved);
      }
    }
    this.entries = next;
    const selected = this.selectedId ? next.get(this.selectedId) : undefined;
    if (!selected || selected.info.locked) {
      this.selectedId = null;
      this.transform.detach();
    } else if (this.transform.object !== selected.object) {
      this.transform.attach(selected.object);
    }
    const signature = [...next].map(([id, e]) => id + ':' + e.object.uuid).join('|');
    if (signature !== this.lastEntrySignature) {
      this.lastEntrySignature = signature;
      this.changed(this.snapshot());
    }
  }

  snapshot(): SceneEditorSnapshot {
    const entry = this.selectedId ? this.entries.get(this.selectedId) : undefined;
    return {
      active: this.active,
      items: [...this.entries.values()].map(e => e.info),
      selectedId: this.selectedId,
      selected: entry ? capture(entry.object) : undefined,
      mode: this.mode,
      message: this.message
    };
  }

  setActive(active: boolean) {
    this.active = active;
    this.orbit.enabled = active;
    this.helper.visible = active && Boolean(this.selectedId);
    if (active) {
      this.refresh();
    } else {
      this.transform.detach();
    }
    this.changed(this.snapshot());
  }

  tick(now: number) {
    if (this.active) this.orbit.update();
    if (now - this.lastScan > 1800) {
      this.lastScan = now;
      this.refresh();
    }
  }

  setMode(mode: EditorTool) {
    this.mode = mode;
    this.transform.setMode(mode);
    this.changed(this.snapshot());
  }

  select(id: string | null) {
    const item = id ? this.entries.get(id) : undefined;
    if (!item) {
      this.selectedId = null;
      this.transform.detach();
      this.helper.visible = false;
      this.message = 'Pilih objek di scene atau daftar kiri.';
    } else if (item.info.locked) {
      this.selectedId = null;
      this.transform.detach();
      this.helper.visible = false;
      this.message = 'Objek sistem/berkolisi dikunci agar gameplay tetap aman: ' + item.info.label;
    } else {
      this.selectedId = id;
      this.transform.attach(item.object);
      this.helper.visible = this.active;
      this.message = 'Objek dipilih: ' + item.info.label;
    }
    this.changed(this.snapshot());
  }

  focusSelected() {
    const item = this.selectedId ? this.entries.get(this.selectedId) : undefined;
    if (!item) return;
    const bounds = new THREE.Box3().setFromObject(item.object);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3()).length();
    const distance = THREE.MathUtils.clamp(size * 1.4, 3.5, 42);
    this.camera.position.copy(center).add(new THREE.Vector3(distance * 0.75, distance * 0.55, distance));
    this.orbit.target.copy(center);
    this.orbit.update();
  }

  setComponent(kind: keyof TransformRecord, axis: number, value: number) {
    const item = this.selectedId ? this.entries.get(this.selectedId) : undefined;
    if (!item || item.info.locked || !validNumber(value, 10000)) return;
    const current = capture(item.object);
    const values: Vector3Tuple = [...current[kind]] as Vector3Tuple;
    if (kind === 'scale' && (value < 0.02 || value > 100)) return;
    if (kind === 'rotation' && Math.abs(value) > 100) return;
    values[axis] = value;
    apply(item.object, { ...current, [kind]: values });
    this.recordSelected();
    this.persist();
    this.changed(this.snapshot());
  }

  resetSelected() {
    if (!this.selectedId) return;
    const entry = this.entries.get(this.selectedId);
    const initial = this.defaults.get(this.selectedId);
    if (!entry || !initial || entry.info.locked) return;
    apply(entry.object, this.published[this.selectedId] || initial.transform);
    delete this.overrides[this.selectedId];
    this.persist();
    this.changed(this.snapshot());
  }

  clearLayout() {
    this.overrides = {};
    for (const [id, entry] of this.entries) {
      const initial = this.defaults.get(id);
      if (initial && !entry.info.locked) apply(entry.object, this.published[id] || initial.transform);
    }
    this.persist();
    this.changed(this.snapshot());
  }

  exportLayout() {
    return JSON.stringify({ format: LAYOUT_FORMAT, version: 1,
      transforms: { ...this.published, ...this.overrides } }, null, 2);
  }

  importLayout(source: string) {
    const file = parseLayout(source);
    this.clearLayout();
    this.overrides = { ...file.transforms };
    for (const [id, entry] of this.entries) {
      if (!entry.info.locked && this.overrides[id]) apply(entry.object, this.overrides[id]);
    }
    this.persist();
    this.changed(this.snapshot());
  }

  private async loadPublishedLayout() {
    try {
      const url = import.meta.env.BASE_URL + 'scene-layout.json';
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) return;
      this.published = parseLayout(await response.text()).transforms;
      // Local author edits take priority. Reapply the published scene layout
      // to objects already constructed; late GLB models use refresh().
      for (const [id, entry] of this.entries) {
        if (entry.info.locked || this.overrides[id] || !this.published[id]) continue;
        apply(entry.object, this.published[id]);
      }
      this.changed(this.snapshot());
    } catch (error) {
      console.warn('[LembahAsri] Published scene layout unavailable', error);
    }
  }

  private recordSelected() {
    const entry = this.selectedId ? this.entries.get(this.selectedId) : undefined;
    if (entry && !entry.info.locked && this.selectedId) this.overrides[this.selectedId] = capture(entry.object);
  }

  private persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, this.exportLayout());
    } catch (error) {
      console.warn('[LembahAsri] Layout tidak dapat disimpan secara lokal', error);
    }
  }

  private onPick = (event: PointerEvent) => {
    if (!this.active || event.button !== 0 || this.transform.dragging || this.transform.axis) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const selectable = [...this.entries.values()].map(entry => entry.object);
    const intersections = this.raycaster.intersectObjects(selectable, true);
    const object = intersections[0]?.object;
    if (!object) { this.select(null); return; }
    let node: THREE.Object3D | null = object;
    let id: string | null = null;
    while (node && !id) {
      for (const [candidateId, entry] of this.entries) {
        if (entry.object === node) { id = candidateId; break; }
      }
      node = node.parent;
    }
    if (id) this.select(id);
  };

  dispose() {
    this.canvas.removeEventListener('pointerdown', this.onPick);
    this.scene.remove(this.helper);
    this.transform.detach();
    this.transform.dispose();
    this.orbit.dispose();
  }
}
