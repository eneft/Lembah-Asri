import * as THREE from 'three';

/**
 * Subtle painted dirt albedo for the village. The former earth_path.png has a
 * distinctive repeating stone/swirl motif (visible as "floor tiles" on phone).
 * This albedo instead uses periodic, multi-scale noise with tiny pigment
 * grains; it contains no paving, outlines, stones, or directional geometry.
 *
 * The period is approximately the whole home yard, not one small ground tile.
 * Generation is deterministic and performed once, off the animation loop.
 */
function hash2d(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function periodicNoise(u: number, v: number, frequency: number, seed: number): number {
  const x = u * frequency;
  const y = v * frequency;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const tx = fx * fx * (3 - 2 * fx);
  const ty = fy * fy * (3 - 2 * fy);
  const ix0 = ((ix % frequency) + frequency) % frequency;
  const iy0 = ((iy % frequency) + frequency) % frequency;
  const ix1 = (ix0 + 1) % frequency;
  const iy1 = (iy0 + 1) % frequency;
  const a = hash2d(ix0, iy0, seed);
  const b = hash2d(ix1, iy0, seed);
  const c = hash2d(ix0, iy1, seed);
  const d = hash2d(ix1, iy1, seed);
  return (a + (b - a) * tx) * (1 - ty) +
    (c + (d - c) * tx) * ty;
}

/** The sample is continuous at the repeat boundary in both UV directions. */
export function sampleEarthPigment(u: number, v: number): [number, number, number] {
  const macro = periodicNoise(u, v, 5, 11) - 0.5;
  const mid = periodicNoise(u, v, 17, 71) - 0.5;
  const fine = periodicNoise(u, v, 53, 227) - 0.5;
  const grains = periodicNoise(u, v, 151, 997) - 0.5;
  // Light warm-brown pigment, low contrast. Avoid high-contrast contour loops.
  const shading = macro * 19 + mid * 13 + fine * 8 + grains * 5;
  const ochre = mid * 3.5 + fine * 1.8;
  return [
    THREE.MathUtils.clamp(177 + shading + ochre, 0, 255),
    THREE.MathUtils.clamp(152 + shading * 0.91, 0, 255),
    THREE.MathUtils.clamp(116 + shading * 0.81 - ochre * 0.55, 0, 255)
  ];
}

export function createNaturalEarthAlbedo(size = 1024): THREE.DataTexture {
  if (!Number.isInteger(size) || size < 16 || size > 2048) {
    throw new Error('Earth texture size out of bounds');
  }
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const color = sampleEarthPigment(u, v);
      const i = (y * size + x) * 4;
      pixels[i] = Math.round(color[0]);
      pixels[i + 1] = Math.round(color[1]);
      pixels[i + 2] = Math.round(color[2]);
      pixels[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.name = 'Lembah Asri organic hand-painted dirt (no tile motif)';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
