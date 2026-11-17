import * as THREE from 'three';

/**
 * Terrain albedo is painted into the source images; the game must not add a
 * second lighting pass on the colors. The same idea as the tree/player unlit
 * material, with UV repeat measured in metres instead of stretching one tile
 * over the entire map.
 *
 * Both sources already exist in the Lembah Asri repository:
 * - grass_painterly_tile.webp (hand-painted grass)
 * - earth_path.png (balai village earth-path palette)
 */
export type TerrainSurface = 'grass' | 'earth' | 'path' | 'soil' | 'plaza';

type SurfaceStyle = {
  source: 'grass' | 'earth';
  tileMetres: number;
  fallback: string;
  tint: string;
};
const STYLES: Record<TerrainSurface, SurfaceStyle> = {
  grass: { source: 'grass', tileMetres: 3.5, fallback: '#91a96e', tint: '#ffffff' },
  earth: { source: 'earth', tileMetres: 2.8, fallback: '#ac9575', tint: '#ffffff' },
  path: { source: 'earth', tileMetres: 2.4, fallback: '#b99b70', tint: '#e8d6ba' },
  soil: { source: 'earth', tileMetres: 1.8, fallback: '#86674b', tint: '#b99879' },
  plaza: { source: 'earth', tileMetres: 3.0, fallback: '#c8b991', tint: '#ebdcba' }
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
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
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
    vertexColors: worldUV,
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
 * UV0 stays in 0..1 for the feathered patch mask. UV1 is a continuous,
 * world-aligned painted albedo unwrap, gently warped by smooth multi-scale
 * noise to prevent straight repeating tile seams.
 *
 * Macro color values are baked into vertex colors, breaking large-scale
 * repetition without an extra texture fetch or a per-frame shader uniform.
 */
export function createPaintedTerrainPlane(
  surface: TerrainSurface,
  width: number, depth: number,
  worldX: number, worldZ: number, elevation: number,
  feathered = false
): THREE.Mesh {
  const subdivisionsX = Math.max(2, Math.min(72, Math.ceil(width / 1.9)));
  const subdivisionsZ = Math.max(2, Math.min(72, Math.ceil(depth / 1.9)));
  const geometry = new THREE.PlaneGeometry(width, depth, subdivisionsX, subdivisionsZ);
  const pos = geometry.getAttribute('position');
  const uv1 = new Float32Array(pos.count * 2);
  const colors = new Float32Array(pos.count * 3);
  const tile = STYLES[surface].tileMetres;
  for (let i = 0; i < pos.count; i++) {
    const x = worldX + pos.getX(i);
    // Plane is rotated -90 deg around X, so local +Y becomes world -Z.
    const z = worldZ - pos.getY(i);
    const warpU = 0.10 * Math.sin(x * 0.19 + z * 0.13) +
      0.045 * Math.sin(z * 0.41 - x * 0.22);
    const warpV = 0.09 * Math.sin(z * 0.21 - x * 0.16) +
      0.035 * Math.sin(x * 0.45 + z * 0.18);
    uv1[i * 2] = x / tile + warpU;
    uv1[i * 2 + 1] = z / tile + warpV;
    const macro = 0.945 +
      0.038 * Math.sin(x * 0.105 + z * 0.07) * Math.cos(z * 0.12 - x * 0.035) +
      0.018 * Math.sin(x * 0.29 - z * 0.21);
    colors[i * 3] = macro;
    colors[i * 3 + 1] = macro * 0.997;
    colors[i * 3 + 2] = macro * 0.977;
  }
  geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = createTerrainMaterial(surface, width, depth, feathered, true);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(worldX, elevation, worldZ);
  mesh.receiveShadow = true;
  mesh.userData.terrainUV = 'world-warped-uv1';
  return mesh;
}

/**
 * Called exactly once from the Three.js Game constructor, after scene meshes
 * are created. Failure preserves visible fallback colors and never blocks play.
 */
export function loadPaintedTerrainTextures(maxAnisotropy = 8): Promise<void> {
  if (loading) return loading;
  const loader = new THREE.TextureLoader();
  const sources = [
    ['grass', './models/environment/grass_painterly_tile.webp'],
    ['earth', './models/environment/earth_path.png']
  ] as const;
  loading = Promise.all(sources.map(async ([key, url]) => {
    try {
      const texture = await loader.loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = maxAnisotropy;
      texture.needsUpdate = true;
      loaded.set(key, texture);
      for (const binding of bindings) {
        if (STYLES[binding.surface].source === key) applyLoadedTexture(binding, texture);
      }
    } catch (error) {
      console.warn('[LembahAsri] Terrain texture fallback:', key, error);
    }
  })).then(() => {});
  return loading;
}
