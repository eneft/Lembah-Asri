import * as THREE from 'three';
import { createNaturalEarthAlbedo } from './naturalEarth.ts';

/**
 * Terrain albedo is painted into the source images; the game must not add a
 * second lighting pass on the colors. The same idea as the tree/player unlit
 * material, with UV repeat measured in metres instead of stretching one tile
 * over the entire map.
 *
 * Meadow grass continues to use grass_painterly_tile.webp.
 * Earth uses the exported hand-painted soil image inspired by the approved
 * childhood-home terrain concept. This is a separate albedo map on a flat
 * world-UV plane, NOT the full environment illustration projected on terrain.
 * The old earth_path.png remains in repo but is not used as ground.
 */
export type TerrainSurface = 'grass' | 'earth' | 'path' | 'soil' | 'plaza';

type SurfaceStyle = {
  source: 'grass' | 'earth';
  tileMetres: number;
  fallback: string;
  tint: string;
};
const STYLES: Record<TerrainSurface, SurfaceStyle> = {
  grass: { source: 'grass', tileMetres: 3.5, fallback: '#9db66a', tint: '#ffffff' },
  // At 20 metres per tile the painted marks stay legible on mobile without
  // obvious 2-metre paving repeats or sharp pixelation close to the camera.
  // All earth surfaces share one world UV scale so roads and yards line up.
  earth: { source: 'earth', tileMetres: 20, fallback: '#b19872', tint: '#ffffff' },
  path: { source: 'earth', tileMetres: 20, fallback: '#b49a74', tint: '#f1ebdc' },
  soil: { source: 'earth', tileMetres: 20, fallback: '#86674b', tint: '#a58b73' },
  plaza: { source: 'earth', tileMetres: 20, fallback: '#c8b991', tint: '#eee2c4' }
};

type Binding = {
  material: THREE.MeshBasicMaterial;
  surface: TerrainSurface;
  width: number;
  depth: number;
  worldUV: boolean;
};

const bindings: Binding[] = [];
const loaded = new Map<'grass' | 'earth', THREE.Texture>();
let loading: Promise<void> | undefined;

export function terrainTileRepeat(
  surface: TerrainSurface, width: number, depth: number
): { x: number; y: number } {
  if (!(width > 0 && depth > 0) || !Number.isFinite(width + depth)) {
    throw new Error('Invalid terrain size');
  }
  const metres = STYLES[surface].tileMetres;
  return { x: width / metres, y: depth / metres };
}

/**
 * Alpha fade at the perimeter of dirt patches: keeps grassy transitions soft
 * and irregular rather than leaving hard rectangular cut-out borders.
 *
 * The green channel is populated because three.js MeshBasicMaterial.alphaMap
 * explicitly reads G, not A.
 */
export function makeTerrainEdgeMask(size = 64): THREE.DataTexture {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const edge = Math.min(u, 1 - u, v, 1 - v);
      const irregular = Math.sin(u * 26 + v * 13) * 0.012 +
        Math.sin(u * 51 - v * 37) * 0.009;
      const t = THREE.MathUtils.clamp((edge - 0.01 - irregular) / 0.09, 0, 1);
      const smooth = t * t * (3 - 2 * t);
      const value = Math.round(smooth * 255);
      const index = (y * size + x) * 4;
      pixels[index] = value;
      pixels[index + 1] = value;
      pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function applyLoadedTexture(binding: Binding, source: THREE.Texture): void {
  // Clone the *sampler*, sharing the authored source image while allowing a
  // different UV repeat for grass, courtyard, paths and small garden plots.
  const texture = source.clone();
  const repeat = terrainTileRepeat(binding.surface, binding.width, binding.depth);
  // The whole grass world AND the sculpted grassy bank shoulders must use
  // identical texture addressing. Previously the world used Repeat but the
  // bank used MirroredRepeat, producing a seam even with matching UV.
  // The illustrated grass is non-seamless, so mirror its boundaries to remove
  // square tile edges without altering earth, road or plaza samplers.
  const worldPaintedGrass = binding.surface === 'grass' && binding.worldUV;
  texture.wrapS = worldPaintedGrass ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  texture.wrapT = worldPaintedGrass ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  // Dedicated UV1 is in metres and warped in world space; UV0 is reserved
  // for the edge mask. Independent sets prevent the mask from tiling.
  texture.channel = binding.worldUV ? 1 : 0;
  texture.repeat.set(binding.worldUV ? 1 : repeat.x, binding.worldUV ? 1 : repeat.y);
  texture.needsUpdate = true;
  binding.material.map = texture;
  binding.material.color.set(STYLES[binding.surface].tint);
  binding.material.needsUpdate = true;
}

export function createTerrainMaterial(
  surface: TerrainSurface, width: number, depth: number, feathered = false,
  worldUV = false
): THREE.MeshBasicMaterial {
  const style = STYLES[surface];
  const material = new THREE.MeshBasicMaterial({
    color: style.fallback,
    // The baked texture already contains painted shadows, highlights and
    // pigment detail. Do not bake procedural vertex tints on top of the art.
    vertexColors: false,
    toneMapped: false,
    // The patch itself sits above ground, never writes depth when feathered.
    transparent: feathered,
    depthWrite: !feathered,
    alphaMap: feathered ? makeTerrainEdgeMask() : null,
    polygonOffset: feathered,
    polygonOffsetFactor: feathered ? -1 : 0,
    polygonOffsetUnits: feathered ? -1 : 0,
    side: THREE.FrontSide
  });
  const binding: Binding = { material, surface, width, depth, worldUV };
  bindings.push(binding);
  material.userData.terrainSurface = surface;
  material.userData.worldUV = worldUV;
  material.userData.tileRepeat = terrainTileRepeat(surface, width, depth);
  const original = loaded.get(style.source);
  if (original) applyLoadedTexture(binding, original);
  return material;
}

/**
 * True PLAIN ground mesh: one quad, no displaced vertices, no procedural
 * world noise. UV0 stays [0..1] for the blended perimeter/alpha mask; UV1
 * encodes the world X/Z in metres for the hand-painted albedo.
 *
 * All adjacent ground planes share exactly the same world UV coordinates.
 * The soil picture is a genuine texture on this mesh, not a scene decal or
 * a full 2D painting used in place of playable 3D geometry.
 */
export function createPaintedTerrainPlane(
  surface: TerrainSurface,
  width: number, depth: number,
  worldX: number, worldZ: number, elevation: number,
  feathered = false
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const geometry = new THREE.PlaneGeometry(width, depth);
  const pos = geometry.getAttribute('position');
  const uv1 = new Float32Array(pos.count * 2);
  const tile = STYLES[surface].tileMetres;
  for (let i = 0; i < pos.count; i++) {
    const x = worldX + pos.getX(i);
    // Plane rotates -90 degrees around X, so local +Y is world -Z.
    const z = worldZ - pos.getY(i);
    uv1[i * 2] = x / tile;
    uv1[i * 2 + 1] = z / tile;
  }
  geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  const material = createTerrainMaterial(surface, width, depth, feathered, true);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(worldX, elevation, worldZ);
  mesh.receiveShadow = true;
  mesh.userData.terrainUV = 'plain-world-uv1';
  return mesh;
}

/**
 * Called once from the Game constructor. The painted albedo is an actual
 * authored WebP texture in public/textures/terrain. If it fails to load,
 * the previous lightweight procedural DataTexture is the safety fallback.
 */
export function loadPaintedTerrainTextures(maxAnisotropy = 8): Promise<void> {
  if (loading) return loading;
  const loader = new THREE.TextureLoader();
  loading = Promise.all([
    loader.loadAsync('./textures/terrain/soil_handpainted.webp')
      .then(texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = maxAnisotropy;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
        loaded.set('earth', texture);
        for (const binding of bindings) {
          if (STYLES[binding.surface].source === 'earth') applyLoadedTexture(binding, texture);
        }
      })
      .catch(error => {
        console.warn('[LembahAsri] Painted earth texture unavailable; procedural fallback', error);
        const earth = createNaturalEarthAlbedo();
        earth.anisotropy = maxAnisotropy;
        loaded.set('earth', earth);
        for (const binding of bindings) {
          if (STYLES[binding.surface].source === 'earth') applyLoadedTexture(binding, earth);
        }
      }),
    // Village meadow color-grade painted from the accepted Lembah Asri palette.
    // Baked brush strokes replace neon short-period grass noise without
    // placing dark decal patches on top of the walkable ground.
    loader.loadAsync('./textures/terrain/village_grass_painted.webp')
      .then(texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = maxAnisotropy;
        texture.needsUpdate = true;
        loaded.set('grass', texture);
        for (const binding of bindings) {
          if (STYLES[binding.surface].source === 'grass') applyLoadedTexture(binding, texture);
        }
      })
      .catch(error => {
        console.warn('[LembahAsri] Grass texture fallback:', error);
      })
  ]).then(() => {});
  return loading;
}
