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
  id: number; x: number; z: number; scale: number; yaw: number; zone: RockZone;
}>;

export const selectedHomeRocks: readonly RockPlacement[] = [
  // West stream: bigger mossy stones near water, loosen spacing along banks.
  { id:0,x:-47.18,z:-3.5,scale:1.17,yaw:.38,zone:'stream' },
  { id:2,x:-43.73,z:-2.15,scale:1.12,yaw:1.86,zone:'stream' },
  { id:1,x:-47.20,z:-.80,scale:.98,yaw:2.43,zone:'stream' },
  { id:4,x:-43.76,z:.92,scale:1.10,yaw:.49,zone:'stream' },
  { id:3,x:-47.23,z:2.40,scale:1.14,yaw:1.57,zone:'stream' },
  { id:0,x:-43.78,z:4.38,scale:1.28,yaw:2.91,zone:'stream' },
  { id:10,x:-47.18,z:5.27,scale:.91,yaw:3.64,zone:'stream' },
  { id:9,x:-43.85,z:5.90,scale:.86,yaw:.78,zone:'stream' },
  // Clear bridge crossing from z=7.25 to 9.95.
  { id:12,x:-47.19,z:11.53,scale:1.02,yaw:.41,zone:'stream' },
  { id:11,x:-43.84,z:12.34,scale:1.02,yaw:1.78,zone:'stream' },
  { id:7,x:-47.22,z:14.68,scale:.79,yaw:2.39,zone:'stream' },
  { id:0,x:-43.74,z:16.67,scale:1.13,yaw:.95,zone:'stream' },
  { id:1,x:-47.22,z:18.39,scale:1.02,yaw:2.71,zone:'stream' },
  { id:8,x:-43.81,z:19.52,scale:.83,yaw:1.12,zone:'stream' },

  // Well outskirts: don't obstruct the circular rim or tree trunk.
  { id:2,x:-40.57,z:2.60,scale:1.10,yaw:.67,zone:'well' },
  { id:4,x:-37.38,z:3.02,scale:1.00,yaw:2.39,zone:'well' },
  { id:9,x:-40.60,z:5.83,scale:.80,yaw:1.32,zone:'well' },
  { id:6,x:-37.72,z:5.51,scale:1.23,yaw:2.11,zone:'well' },

  // Around the sides of the childhood home, never in front of the stairs.
  { id:3,x:-40.80,z:-3.58,scale:1.06,yaw:2.42,zone:'foundation' },
  { id:11,x:-39.71,z:-2.82,scale:.85,yaw:1.25,zone:'foundation' },
  { id:2,x:-25.48,z:-3.42,scale:.98,yaw:.65,zone:'foundation' },
  { id:15,x:-25.12,z:-5.34,scale:1.00,yaw:2.58,zone:'foundation' },

  // Garden: dusty flat stones and a few low mossy stones, beds stay empty.
  { id:6,x:-24.82,z:-2.87,scale:1.15,yaw:1.05,zone:'garden' },
  { id:15,x:-19.35,z:3.65,scale:1.12,yaw:.35,zone:'garden' },
  { id:14,x:-23.04,z:4.05,scale:.84,yaw:1.98,zone:'garden' },

  // Discreet walk-edge markers, not an artificial continuous stone border.
  { id:13,x:-36.34,z:11.95,scale:.81,yaw:1.39,zone:'path-edge' },
  { id:6,x:-25.72,z:12.79,scale:1.13,yaw:.60,zone:'path-edge' },
  { id:14,x:-21.76,z:12.18,scale:.82,yaw:2.88,zone:'path-edge' },
  { id:15,x:-18.53,z:12.74,scale:.96,yaw:1.91,zone:'path-edge' }
] as const;

export const rockFile = './models/environment/lembah_asri_rocks_original_16.glb?rocks=1';

let rockSource: Promise<THREE.Group> | undefined;
export function loadCuratedRockSource(): Promise<THREE.Group> {
  if (rockSource) return rockSource;
  rockSource = new GLTFLoader().loadAsync(rockFile)
    .then(({scene}) => {
      for (let index=0;index<16;index++) {
        const source = scene.getObjectByName('LA Rock '+String(index).padStart(2,'0'));
        if (!(source instanceof THREE.Mesh) || !source.geometry.getAttribute('uv')) {
          throw new Error('Missing original UV-painted rock variant '+index);
        }
      }
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
  const original = source.getObjectByName('LA Rock 00');
  if (!(original instanceof THREE.Mesh)) throw new Error('No rocks in source GLB');
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
    const rock=source.getObjectByName('LA Rock '+String(id).padStart(2,'0'));
    if (!(rock instanceof THREE.Mesh)) throw new Error('Rock variant '+id+' unavailable');
    const mesh=new THREE.InstancedMesh(rock.geometry,material,placements.length);
    mesh.name='UV original rock variant '+String(id).padStart(2,'0');
    const castsShadow=placements.some(p=>p.zone==='stream'||p.zone==='foundation') &&
      [0,1,2,3,4,10,12].includes(id);
    mesh.castShadow=castsShadow;
    mesh.receiveShadow=false;
    for(let i=0;i<placements.length;i++){
      const p=placements[i];
      instance.position.set(p.x,.022,p.z);
      instance.rotation.set(0,p.yaw,0);
      instance.scale.setScalar(p.scale);
      instance.updateMatrix();
      mesh.setMatrixAt(i,instance.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}

/** Adds only visual assets, without modifying collision or walkable terrain. */
export async function attachCuratedHomeRocks(root: THREE.Object3D): Promise<boolean> {
  const source=await loadCuratedRockSource();
  root.add(createCuratedRockGroup(source));
  return true;
}
