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
  texture.repeat.set(repeat.x, repeat.y);
  texture.needsUpdate = true;
  binding.material.map = texture;
  binding.material.color.set(STYLES[binding.surface].tint);
  binding.material.needsUpdate = true;
}

export function createTerrainMaterial(
  surface: TerrainSurface, width: number, depth: number, feathered = false
): THREE.MeshBasicMaterial {
  const style = STYLES[surface];
  const material = new THREE.MeshBasicMaterial({
    color: style.fallback,
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
  const binding: Binding = { material, surface, width, depth };
  bindings.push(binding);
  material.userData.terrainSurface = surface;
  material.userData.tileRepeat = terrainTileRepeat(surface, width, depth);
  const original = loaded.get(style.source);
  if (original) applyLoadedTexture(binding, original);
  return material;
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
