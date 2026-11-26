import * as THREE from 'three';
import { gardenHeightAt } from './gardenLayout.ts';
import { LEMBAH_DAYLIGHT } from './sceneArtDirection.ts';

/**
 * The terrain and character use MeshBasicMaterial to keep the authored
 * hand-painted albedo intact. BasicMaterial is deliberately unlit: even when
 * a directional light casts a shadow, a BasicMaterial surface cannot RECEIVE it.
 * A separate transparent ShadowMaterial plane is the lightweight, correct
 * way to display real moving shadows without re-lighting the painted art.
 */
export function createPaintedShadowReceiver(
  name: string, width: number, depth: number, x: number, z: number, height: number
): THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial> {
  if (![width, depth, x, z, height].every(Number.isFinite) ||
      width <= 0 || depth <= 0) {
    throw new Error('Invalid shadow receiver footprint');
  }
  const material = new THREE.ShadowMaterial({
    color: 0x615746,
    opacity: LEMBAH_DAYLIGHT.shadowOpacity,
    transparent: true,
    depthWrite: false
  });
  material.toneMapped = false;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.name = name;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, height, z);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.renderOrder = 6;
  mesh.userData.paintedShadowReceiver = true;
  return mesh;
}

/** 
 * Keep the daylight direction fixed, while tracking its orthographic shadow
 * frustum near the playable character. Previously the sun targeted world 0,0
 * so the childhood home at X=-32 was at the edge of the 70 m shadow map.
 *
 * Target must be a child of the scene, configured in Game.ts.
 */
export function configureSunShadows(sun: THREE.DirectionalLight, mobile: boolean): void {
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  const half = mobile ? 25 : 31;
  sun.shadow.camera.left = -half;
  sun.shadow.camera.right = half;
  sun.shadow.camera.top = half;
  sun.shadow.camera.bottom = -half;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 115;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00030;
  sun.shadow.normalBias = 0.020;
  sun.shadow.radius = mobile ? 2 : 3;
}

/** Follow the character and keep the shadow-map texel grid reasonably stable. */
export const villageSunOffset = new THREE.Vector3(-18, 30, -12);
export const chapterSunOffset = new THREE.Vector3(22, 28, 15);

export function focusSunShadows(sun: THREE.DirectionalLight, x: number, z: number, offset = villageSunOffset): void {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return;
  const width = sun.shadow.camera.right - sun.shadow.camera.left;
  const snap = width / Math.max(1, sun.shadow.mapSize.x);
  const fx = Math.round(x / snap) * snap;
  const fz = Math.round(z / snap) * snap;
  sun.target.position.set(fx, 0, fz);
  sun.position.copy(sun.target.position).add(offset);
}

/**
 * A subtle painted contact/ambient-occlusion patch improves the character's
 * footing at idle and during jumps. Real building/player shadows come from
 * the ShadowMaterial receivers above. This is not a substitute for them.
 */
export function createCharacterContactShadow(): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = ((x + 0.5) / size - 0.5) * 2;
      const ny = ((y + 0.5) / size - 0.5) * 2;
      const r2 = nx * nx + ny * ny;
      const alpha = Math.round(Math.max(0, Math.exp(-r2 * 3.7) - 0.024) * 205);
      const i = (y * size + x) * 4;
      pixels[i] = 74; pixels[i + 1] = 63; pixels[i + 2] = 49; pixels[i + 3] = alpha;
    }
  }
  const map = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.minFilter = THREE.LinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.generateMipmaps = false;
  map.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    map, color: '#ffffff', transparent: true,
    depthWrite: false, opacity: LEMBAH_DAYLIGHT.contactShadowOpacity, toneMapped: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.77), material);
  mesh.name = 'Character soft painted contact shadow';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.11;
  // The actor FBX loads asynchronously; never show a stray shadow at (0, 0).
  mesh.visible = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 7;
  return mesh;
}

export function updateCharacterContactShadow(
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>,
  worldPosition: THREE.Vector3
): void {
  // Ground stays fixed and the silhouette softens as the character jumps.
  const ground = gardenHeightAt(worldPosition.x, worldPosition.z);
  shadow.position.y = .11 + ground;
  const air = Math.max(0, worldPosition.y - ground);
  shadow.position.x = worldPosition.x;
  shadow.position.z = worldPosition.z;
  shadow.visible = true;
  const factor = 1 + Math.min(air, 4) * 0.17;
  shadow.scale.set(factor, factor, 1);
  shadow.material.opacity = LEMBAH_DAYLIGHT.contactShadowOpacity / (1 + air * 0.8);
}
