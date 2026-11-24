import { createHousePainterlyMaterial } from './housePainterlyMaterial.ts';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { SolidCollider } from './homeStage';

/**
 * The new, separately editable warung prefab.
 *
 * Coordinates are in world metres. The sculpted source GLB faces -Z; rotate
 * only its mount 180 degrees to face the village (toward +Z). Never flatten,
 * merge, repaint, or overwrite its 30 independent mesh components.
 *
 * The procedural clay blockout remains visible until the authored GLB loads.
 * This deliberately requires no texture files and does not affect the player,
 * home GLB, terrain renderer, or animation pipeline.
 */
export const WARUNG = {
  x: -9.5,
  z: -22.5,
  width: 5.34,
  depth: 5.91,
  height: 4.565,
  modelUrl: './models/environment/warung_lembah_asri.glb'
} as const;

export type WarungStage = {
  root: THREE.Group;
  solids: SolidCollider[];
  cameraBlockers: THREE.Object3D[];
  ready: Promise<boolean>;
};

const clay = new THREE.MeshStandardMaterial({
  color: '#b7ad9b',
  metalness: 0,
  roughness: 1,
  flatShading: true
});
const darkClay = new THREE.MeshStandardMaterial({
  color: '#817b72',
  metalness: 0,
  roughness: 1,
  flatShading: true
});

function box(
  parent: THREE.Object3D, name: string,
  size: [number, number, number], at: [number, number, number],
  material: THREE.Material = clay
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...at);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Neutral, untextured geometry rather than an empty or invisible building. */
function makeWarungFallback(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Warung - low-poly clay fallback';

  // Open front shop: side walls, rear wall and front top beam. Not a
  // solid cuboid that would hide the counter and merchandise.
  box(root, 'Back wall', [4.5, 2.8, 0.17], [0, 1.54, -2.15]);
  for (const x of [-2.18, 2.18]) {
    box(root, 'Side wall', [0.17, 2.8, 4.35], [x, 1.54, 0]);
    box(root, 'Front timber post', [0.17, 2.8, 0.17], [x, 1.48, 2.17], darkClay);
  }
  box(root, 'Front lintel', [4.55, 0.25, 0.25], [0, 2.84, 2.17], darkClay);
  box(root, 'Stone footing', [5.0, 0.22, 5.05], [0, 0.11, 0], darkClay);
  box(root, 'Front step', [3.75, 0.15, 0.65], [0, 0.08, 2.78]);
  box(root, 'Counter', [3.5, 0.92, 0.53], [0, 0.81, 1.93]);
  box(root, 'Counter top', [3.7, 0.14, 0.68], [0, 1.30, 1.93], darkClay);

  // Two roof planes meet at the ridge; each has its own editable mesh.
  const left = box(root, 'Gable roof left', [3.05, 0.16, 5.75], [-1.35, 3.46, 0], darkClay);
  const right = box(root, 'Gable roof right', [3.05, 0.16, 5.75], [1.35, 3.46, 0], darkClay);
  left.rotation.z = 0.48;
  right.rotation.z = -0.48;
  box(root, 'Roof ridge', [0.22, 0.22, 6.0], [0, 4.19, 0], darkClay);

  const canopy = box(root, 'Front corrugated awning base', [5.15, 0.11, 1.55], [0, 2.66, 2.54]);
  canopy.rotation.x = -0.15;
  for (let i = 0; i < 14; i++) {
    const x = -2.45 + i * 0.375;
    const rib = box(root, 'Awning corrugation', [0.065, 0.045, 1.5], [x, 2.72, 2.54], darkClay);
    rib.rotation.x = -0.15;
  }
  for (const x of [-2.02, 2.02]) {
    box(root, 'Awning support', [0.14, 2.4, 0.14], [x, 1.2, 2.72], darkClay);
  }

  // The shelving and jars are real 3D volumes, never painted decals.
  for (const y of [1.55, 2.05, 2.5]) {
    box(root, 'Merchandise shelf', [3.1, 0.10, 0.48], [0, y, -1.62], darkClay);
    for (let i = 0; i < 7; i++) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.29, 8), clay);
      jar.name = 'Shelf jar';
      jar.position.set(-1.28 + i * 0.42, y + 0.19, -1.6);
      root.add(jar);
    }
  }
  for (let i = 0; i < 5; i++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.42, 8), clay);
    jar.name = 'Counter jar';
    jar.position.set(-1.12 + i * 0.56, 1.57, 1.9);
    root.add(jar);
  }

  // Side window, shutters, rear door, loose market props.
  box(root, 'Side window ledge', [0.28, 0.10, 1.5], [2.24, 1.58, 0.3], darkClay);
  for (const z of [-0.58, 1.18]) {
    box(root, 'Side window shutter', [0.10, 0.9, 0.31], [2.29, 2.05, z], darkClay);
  }
  box(root, 'Rear timber door', [1.0, 1.92, 0.10], [0.5, 1.11, -2.27], darkClay);
  box(root, 'Front bench', [1.35, 0.14, 0.43], [1.03, 0.62, 3.06], darkClay);
  for (const x of [0.54, 1.52]) {
    box(root, 'Bench leg', [0.13, 0.57, 0.14], [x, 0.31, 3.06], darkClay);
  }
  for (let i = 0; i < 3; i++) {
    box(root, 'Stacked crate', [0.66, 0.56, 0.55], [-1.62, 0.47 + i * 0.56, 2.75], darkClay);
  }
  return root;
}

export function createWarungStage(loadAuthoredModel = true): WarungStage {
  const root = new THREE.Group();
  root.name = 'Warung Lembah Asri / Modular';
  root.position.set(WARUNG.x, 0, WARUNG.z);

  const fallback = makeWarungFallback();
  root.add(fallback);

  // Collider covers the solid interior; front steps and customer approach
  // remain walkable. Fixed Rapier cuboids are authored in WORLD coordinates.
  const solids: SolidCollider[] = [{
    label: 'Warung main walls',
    center: [WARUNG.x, 1.47, WARUNG.z - 0.45],
    half: [2.23, 1.47, 1.82]
  }, {
    label: 'Warung side awning support',
    center: [WARUNG.x + 2.03, 1.2, WARUNG.z + 2.7],
    half: [0.10, 1.2, 0.10]
  }, {
    label: 'Warung opposite awning support',
    center: [WARUNG.x - 2.03, 1.2, WARUNG.z + 2.7],
    half: [0.10, 1.2, 0.10]
  }];

  // Camera raycasts include invisible geometry; keep it separate from the
  // imported detail meshes to avoid jitter against many small jar triangles.
  const proxy = box(root, 'Warung camera obstruction proxy',
    [4.7, 3.7, 4.25], [0, 1.9, -0.2], clay);
  proxy.visible = false;
  const cameraBlockers: THREE.Object3D[] = [proxy];

  const ready = !loadAuthoredModel
    ? Promise.resolve(false)
    : new GLTFLoader().loadAsync(WARUNG.modelUrl).then(gltf => {
      const asset = gltf.scene;
      asset.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(asset);
      const size = bounds.getSize(new THREE.Vector3());
      if (!Number.isFinite(size.x) || !Number.isFinite(size.y)
        || !Number.isFinite(size.z) || size.x < 1 || size.z < 1) {
        throw new Error('Warung GLB has invalid dimensions');
      }
      const center = bounds.getCenter(new THREE.Vector3());
      const mount = new THREE.Group();
      mount.name = 'Warung authored GLB mount - 30 separate meshes';
      mount.rotation.y = Math.PI;
      // Source front is -Z; turn towards the village, preserving source scale.
      asset.position.set(-center.x, -bounds.min.y, -center.z);
      asset.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;
        const paint = (source: THREE.Material) => source instanceof THREE.MeshStandardMaterial
          ? createHousePainterlyMaterial(source) : source;
        child.material = Array.isArray(child.material) ? child.material.map(paint) : paint(child.material);
      });
      mount.add(asset);
      root.add(mount);
      fallback.visible = false;
      return true;
    }).catch(error => {
      console.info('[LembahAsri] Warung model not installed; using modular low-poly fallback.', error);
      return false;
    });

  return { root, solids, cameraBlockers, ready };
}
