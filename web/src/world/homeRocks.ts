import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Curated original rocks supplied for Lembah Asri (base_basic_shaded.glb).
 *
 * The compact GLB stores 16 independent mesh varieties. Original UVs and
 * shaded albedo are preserved; their old all-black baseColorFactor + emissive
 * texture was rebaked to an ordinary sRGB baseColor map.
 *
 * Manual geological placement is deliberately nonuniform:
 * mossy rocks at wet banks, muted boulders at the foundation, flat pebble
 * families at yard edges, NEVER on the player's entrance route or stairs.
 */
export type RockZone = 'stream' | 'well' | 'foundation' | 'garden' | 'path-edge';
export type RockPlacement = Readonly<{
  id: number; x: number; z: number;
  /** Desired horizontal world-space footprint in meters, NOT raw GLB scale. */
  size: number;
  yaw: number;
  zone: RockZone;
}>;

/**
 * Hand-authored creek-side composition.
 *
 * Keep big stones in 2-3 asymmetric clusters; never repeat a single stone
 * evenly along every metre of river. Small rocks are satellites of those
 * clusters, not a solid border. Other stones only accent path edges, well
 * and house sides. This is visual-only; don't introduce blocking collisions.
 */
export const selectedHomeRocks: readonly RockPlacement[] = [
  // Upstream: a single mossy boulder with one little satellite.
  { id:0,x:-47.33,z:-2.90,size:1.18,yaw:.38,zone:'stream' },
  { id:6,x:-47.89,z:-3.42,size:.17,yaw:1.22,zone:'stream' },

  // Near bank cluster facing the well.
  { id:2,x:-43.66,z:.84,size:1.28,yaw:1.86,zone:'stream' },
  { id:9,x:-43.23,z:1.52,size:.47,yaw:2.28,zone:'stream' },

  // Mid stream: one earthy boulder to the left, one smaller to the right.
  { id:3,x:-47.31,z:4.43,size:1.04,yaw:1.57,zone:'stream' },
  { id:12,x:-47.73,z:5.03,size:.43,yaw:.24,zone:'stream' },
  { id:4,x:-43.71,z:5.96,size:.75,yaw:2.85,zone:'stream' },

  // Both sides of the existing bridge (7.25–9.95) intentionally stay empty.
  { id:1,x:-47.39,z:11.99,size:1.14,yaw:.43,zone:'stream' },
  { id:10,x:-47.88,z:12.55,size:.46,yaw:2.19,zone:'stream' },

  // Largest creek-bank composition: one anchor boulder + short pebble train.
  { id:7,x:-43.77,z:13.87,size:.78,yaw:1.14,zone:'stream' },
  { id:0,x:-43.81,z:15.12,size:1.30,yaw:2.91,zone:'stream' },
  { id:11,x:-43.43,z:15.75,size:.51,yaw:.36,zone:'stream' },

  // Downstream: only a few asymmetrical, partly mossy stones.
  { id:4,x:-47.31,z:18.08,size:.99,yaw:1.86,zone:'stream' },
  { id:2,x:-43.64,z:21.00,size:1.21,yaw:.95,zone:'stream' },
  { id:8,x:-43.22,z:21.72,size:.58,yaw:2.25,zone:'stream' },
  { id:10,x:-47.27,z:23.26,size:.60,yaw:1.19,zone:'stream' },

  // Three subtle accent rocks near the well, outside the rim and tree.
  { id:1,x:-40.68,z:2.51,size:.60,yaw:.67,zone:'well' },
  { id:15,x:-37.38,z:5.51,size:.26,yaw:2.39,zone:'well' },
  { id:9,x:-40.63,z:5.89,size:.42,yaw:1.32,zone:'well' },

  // House foundation: keep stone steps and porch front unobstructed.
  { id:3,x:-40.80,z:-3.58,size:.52,yaw:2.42,zone:'foundation' },
  { id:2,x:-25.48,z:-3.42,size:.55,yaw:.65,zone:'foundation' },
  { id:15,x:-25.12,z:-5.34,size:.24,yaw:2.58,zone:'foundation' },

  // Garden has discreet small stones; bed plots remain clear.
  { id:9,x:-24.82,z:-2.87,size:.40,yaw:1.05,zone:'garden' },
  { id:15,x:-19.35,z:3.65,size:.21,yaw:.35,zone:'garden' },

  // Along paths: low stones, not waist-high obstacles.
  { id:13,x:-36.34,z:11.95,size:.43,yaw:1.39,zone:'path-edge' },
  { id:6,x:-25.72,z:12.79,size:.15,yaw:.60,zone:'path-edge' },
  { id:14,x:-21.76,z:12.18,size:.44,yaw:2.88,zone:'path-edge' },
  { id:15,x:-18.53,z:12.74,size:.23,yaw:1.91,zone:'path-edge' }
] as const;

export const rockFile = './models/environment/lembah_asri_rocks_original_16.glb?rocks=3-layout';
/**
 * GLTFLoader sanitizes glTF node names: "LA Rock 00" becomes "LA_Rock_00".
 * Resolve both source and loaded naming, with originalIndex metadata as an
 * additional fallback. Never silently render zero rocks.
 */
export function findCuratedRockVariant(source: THREE.Object3D, id: number): THREE.Mesh {
  if (!Number.isInteger(id) || id < 0 || id > 15) {
    throw new Error('Invalid original rock index: ' + id);
  }
  const suffix = String(id).padStart(2, '0');
  const candidates = [
    'LA_Rock_' + suffix,
    'LA Rock ' + suffix,
    THREE.PropertyBinding.sanitizeNodeName('LA Rock ' + suffix)
  ];
  for (const name of candidates) {
    const mesh = source.getObjectByName(name);
    if (mesh instanceof THREE.Mesh && mesh.geometry.getAttribute('uv')) return mesh;
  }
  let found: THREE.Mesh | undefined;
  source.traverse(object => {
    if (found || !(object instanceof THREE.Mesh)) return;
    const match = /^LA[_ ]Rock[_ ](\d{2})(?:_\d+)?$/.exec(object.name);
    if ((object.userData.originalIndex === id || (match && Number(match[1]) === id))
        && object.geometry.getAttribute('uv')) found = object;
  });
  if (!found) throw new Error('Original UV rock variant ' + suffix + ' missing after GLTFLoader name sanitization');
  return found;
}

let rockSource: Promise<THREE.Group> | undefined;
export function loadCuratedRockSource(): Promise<THREE.Group> {
  if (rockSource) return rockSource;
  rockSource = new GLTFLoader().loadAsync(rockFile)
    .then(({scene}) => {
      for (let index=0;index<16;index++) findCuratedRockVariant(scene, index);
      console.info('[LembahAsri] Loaded all 16 original UV-textured rock variants');
      return scene;
    }).catch(error => {
      rockSource = undefined;
      throw error;
    });
  return rockSource;
}

export function createCuratedRockGroup(source: THREE.Group): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Curated original UV textured rock placements';
  const instance = new THREE.Object3D();
  const original = findCuratedRockVariant(source, 0);
  const sourceMaterial = Array.isArray(original.material) ? original.material[0] : original.material;
  const originalMap = (sourceMaterial as THREE.MeshStandardMaterial).map;
  if (!originalMap) throw new Error('Rock texture from original shaded file is missing');
  originalMap.colorSpace = THREE.SRGBColorSpace;
  originalMap.anisotropy = 4;
  originalMap.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff', map: originalMap, toneMapped: false,
    transparent: false, depthWrite: true, side: THREE.DoubleSide
  });
  for(let id=0;id<16;id++) {
    const placements = selectedHomeRocks.filter(p=>p.id===id);
    if (!placements.length) continue;
    const rock = findCuratedRockVariant(source, id);
    const mesh=new THREE.InstancedMesh(rock.geometry,material,placements.length);
    mesh.name='UV original rock variant '+String(id).padStart(2,'0');
    const castsShadow=placements.some(p=>p.zone==='stream'||p.zone==='foundation') &&
      [0,1,2,3,4,10,12].includes(id);
    mesh.castShadow=castsShadow;
    mesh.receiveShadow=false;
    // Source pack rocks have very different native sizes (some 8 cm,
    // others 110 cm). Scale by desired WORLD footprint, never source scale.
    // This makes a 1.2 m river boulder truly read as a big boulder in-game.
    rock.geometry.computeBoundingBox();
    const dimensions = new THREE.Vector3();
    rock.geometry.boundingBox!.getSize(dimensions);
    const nativeFootprint = Math.max(dimensions.x, dimensions.z);
    if (nativeFootprint < 0.02 || !Number.isFinite(nativeFootprint)) {
      throw new Error('Invalid original rock geometry dimensions '+id);
    }
    for(let i=0;i<placements.length;i++){
      const p=placements[i];
      const scale = p.size / nativeFootprint;
      instance.position.set(p.x, p.zone==='stream' ? -.027 : .022, p.z);
      instance.rotation.set(0,p.yaw,0);
      instance.scale.setScalar(scale);
      instance.updateMatrix();
      mesh.setMatrixAt(i,instance.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  if (group.children.length < 12) {
    throw new Error('Original rock pack produced too few instanced meshes');
  }
  const total = group.children.reduce((count, mesh) => count +
    (mesh instanceof THREE.InstancedMesh ? mesh.count : 0), 0);
  if (total !== selectedHomeRocks.length) {
    throw new Error('Original rock pack placement count mismatch: ' + total);
  }
  return group;
}

/** Adds only visual assets, without modifying collision or walkable terrain. */
export async function attachCuratedHomeRocks(root: THREE.Object3D): Promise<boolean> {
  const source=await loadCuratedRockSource();
  root.add(createCuratedRockGroup(source));
  return true;
}
