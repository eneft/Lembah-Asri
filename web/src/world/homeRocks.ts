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
export type RockType = 'mossy' | 'plain';
/** Only two of the original 16 UV models are used in-game. */
export const ROCK_MODELS = Object.freeze({
  mossy: 0,
  plain: 2
} as const);
export type RockPlacement = Readonly<{
  type: RockType;
  x: number; z: number;
  /** Desired horizontal world-space footprint in metres, not GLB scale. */
  size: number;
  yaw: number;
  zone: RockZone;
}>;
/**
 * Curated natural clusters, no tiny scattered pebbles or stone border.
 * Mossy rocks stay along the damp banks; dry plain rocks transition into
 * the well / foundation / path edges. Leave the 7.25–9.95 bridge empty.
 */
export const selectedHomeRocks: readonly RockPlacement[] = [
  // Upstream: isolated rounded boulder and a smaller partner.
  { type:'mossy',x:-47.31,z:-3.08,size:1.15,yaw:.38,zone:'stream' },
  { type:'mossy',x:-47.78,z:-2.21,size:.57,yaw:1.25,zone:'stream' },

  // Bend near the well: clustered, not evenly spaced stones.
  { type:'mossy',x:-43.70,z:.78,size:1.27,yaw:1.88,zone:'stream' },
  { type:'mossy',x:-43.25,z:1.67,size:.65,yaw:2.36,zone:'stream' },
  { type:'mossy',x:-47.31,z:4.42,size:1.06,yaw:1.52,zone:'stream' },
  { type:'mossy',x:-43.75,z:5.94,size:.72,yaw:2.80,zone:'stream' },

  // Bridge remains clear. Immediately downstream a second natural cluster.
  { type:'mossy',x:-47.35,z:11.86,size:1.10,yaw:.43,zone:'stream' },
  { type:'mossy',x:-47.79,z:12.69,size:.56,yaw:2.14,zone:'stream' },
  { type:'mossy',x:-43.83,z:14.91,size:1.24,yaw:2.88,zone:'stream' },
  { type:'mossy',x:-43.25,z:15.78,size:.65,yaw:.34,zone:'stream' },

  // Downstream: progressively fewer rocks, flow becomes open.
  { type:'mossy',x:-47.30,z:18.31,size:.84,yaw:1.90,zone:'stream' },
  { type:'mossy',x:-43.71,z:22.05,size:1.15,yaw:.98,zone:'stream' },

  // Plain rocks only on dry ground; never inside water or in front of stairs.
  { type:'plain',x:-40.63,z:2.51,size:.59,yaw:.67,zone:'well' },
  { type:'plain',x:-40.60,z:5.91,size:.49,yaw:1.34,zone:'well' },
  { type:'plain',x:-40.80,z:-3.58,size:.54,yaw:2.42,zone:'foundation' },
  { type:'plain',x:-25.48,z:-3.42,size:.66,yaw:.65,zone:'foundation' },
  { type:'plain',x:-22.38,z:4.17,size:.57,yaw:1.05,zone:'garden' },
  { type:'plain',x:-36.32,z:11.95,size:.50,yaw:1.38,zone:'path-edge' },
  { type:'plain',x:-21.75,z:12.18,size:.47,yaw:2.88,zone:'path-edge' }
] as const;
export const rockFile = './models/environment/lembah_asri_rocks_original_16.glb?rocks=4-two-kinds';
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
      // Source GLB still retains 16 originals, but only these two are rendered.
      for (const index of Object.values(ROCK_MODELS)) findCuratedRockVariant(scene, index);
      console.info('[LembahAsri] Loaded mossy and plain UV rocks');
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
  for (const [type, id] of Object.entries(ROCK_MODELS) as Array<[RockType, number]>) {
    const placements = selectedHomeRocks.filter(p=>p.type===type);
    if (!placements.length) continue;
    const rock = findCuratedRockVariant(source, id);
    const mesh=new THREE.InstancedMesh(rock.geometry,material,placements.length);
    mesh.name='UV '+type+' rock variant '+String(id).padStart(2,'0');
    const castsShadow=placements.some(p=>p.zone==='stream'||p.zone==='foundation');
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
  if (group.children.length !== 2) {
    throw new Error('Scene must render exactly two UV rock types');
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
