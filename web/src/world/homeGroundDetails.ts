import * as THREE from 'three';
import { createPaintedTerrainPlane } from './terrainMaterials.ts';
import { makeLowPolyGrassGeometry } from './lowPolyGrass.ts';

/**
 * Production courtyard dressing: real low-poly grass and irregular textured
 * rocks, without extra dark soil decals. No procedural terrain height,
 * no sprite/billboard substitutions, no extra Rapier colliders.
 *
 * Every placement is seeded, so builds/reloads preserve the same scene.
 * Texture/geometry are shared using InstancedMesh (2 grass + 4 stone draws).
 */
type GrassDetail = { x: number; z: number; yaw: number; scale: number; dry: boolean };
type StoneDetail = {
  x: number; z: number; yaw: number;
  sx: number; sy: number; sz: number; kind: number; tint: number
};

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Excludes the house, entry path, spawn, well, shed, abandoned plots and stream. */
export function isHomeGroundDetailAllowed(x: number, z: number): boolean {
  if (x < -43.15 || x > -17.35 || z < -15.45 || z > 14.3) return false;
  if (Math.abs(x + 32.5) < 6.05 && Math.abs(z + 9.4) < 6.20) return false;
  // Keep a small uncluttered apron immediately in front of the stone foundation.
  if (x > -38.7 && x < -26.5 && z > -5.45 && z < -2.55) return false;
  if (Math.abs(x + 32.5) < 2.55 && z > -4.85 && z < 10.7) return false;
  if (x > -22.4 && Math.abs(z - 9) < 2.7) return false;
  if (Math.hypot(x + 29.5, z - 7.4) < 2.2) return false;
  if (Math.hypot(x + 39, z - 4) < 1.85) return false;
  if (Math.abs(x + 22) < 2.65 && Math.abs(z + 10.4) < 2.50) return false;
  if (Math.hypot(x + 40, z - 8.3) < 0.68) return false;
  for (const plotX of [-24.8, -21.8, -18.8]) {
    for (const plotZ of [-0.5, 1.8]) {
      if (Math.abs(x - plotX) < 1.39 && Math.abs(z - plotZ) < 1.05) return false;
    }
  }
  return true;
}

function edgeWeight(x: number, z: number): number {
  const edge = Math.min(x + 43.15, -17.35 - x, z + 15.45, 14.3 - z);
  // The garden is mostly worn earth. Plants gather along the actual edge.
  return THREE.MathUtils.clamp(1 - edge / 4.5, 0.12, 1);
}

export function scatterHomeGrass(seed = 20261121): GrassDetail[] {
  const random = seeded(seed);
  const points: GrassDetail[] = [];
  for (let z = -15.0; z <= 13.9; z += 1.22) {
    for (let x = -42.85; x <= -17.7; x += 1.22) {
      const cx = x + (random() - 0.5) * 0.76;
      const cz = z + (random() - 0.5) * 0.76;
      const density = 0.08 + 0.50 * edgeWeight(cx, cz);
      if (random() > density) continue;
      const count = 2 + Math.floor(random() * 3);
      for (let k = 0; k < count; k++) {
        const px = cx + (random() - 0.5) * 0.44;
        const pz = cz + (random() - 0.5) * 0.44;
        if (!isHomeGroundDetailAllowed(px, pz)) continue;
        points.push({
          x: px, z: pz, yaw: random() * Math.PI * 2,
          scale: 0.52 + random() * 0.72,
          dry: random() < 0.24
        });
      }
    }
  }
  return points;
}

/** Small stones near the margins: non-blocking, never on the walking route. */
export function scatterHomeStones(seed = 15471): StoneDetail[] {
  const random = seeded(seed);
  const points: StoneDetail[] = [];
  const anchors: Array<[number, number, number]> = [
    [-40.9, -2.9, 6], [-41.5, 11.9, 5], [-39.8, -12.9, 5],
    [-27.1, -3.8, 6], [-25.0, 12.4, 6], [-19.2, 4.5, 5],
    [-18.4, -4.1, 5], [-38.6, 12.8, 5], [-28.1, 12.5, 4]
  ];
  let index = 0;
  for (const [cx, cz, count] of anchors) {
    let placed = 0;
    for (let attempt = 0; attempt < count * 5 && placed < count && index < 50; attempt++) {
      const x = cx + (random() - 0.5) * 2.9;
      const z = cz + (random() - 0.5) * 2.5;
      if (!isHomeGroundDetailAllowed(x, z)) continue;
      // Do not make uniformly sized rocks or perfectly separated pebbles.
      const size = 0.16 + random() * 0.24;
      points.push({
        x, z, yaw: random() * 6.283,
        sx: size * (0.85 + random() * 0.80),
        sy: size * (0.34 + random() * 0.25),
        sz: size * (0.75 + random() * 0.80),
        kind: index % 4, tint: 0.88 + random() * 0.12
      });
      index++;
      placed++;
    }
  }
  return points;
}

function hash(x: number, y: number, seed: number): number {
  let v = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed + 1, 2246822519);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
}

function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const u = x - ix, v = y - iy;
  const sx = u * u * (3 - 2 * u), sy = v * v * (3 - 2 * v);
  const left = THREE.MathUtils.lerp(hash(ix, iy, seed), hash(ix + 1, iy, seed), sx);
  const right = THREE.MathUtils.lerp(hash(ix, iy + 1, seed), hash(ix + 1, iy + 1, seed), sx);
  return THREE.MathUtils.lerp(left, right, sy);
}

/**
 * Four real hand-painted-style rock albedos in a single small 256px atlas:
 * moss grey, warm river rock, blue slate, light weathered pebble.
 * DataTexture avoids network/image decode work and keeps offline Windows builds.
 */
export function makeStoneAlbedoAtlas(): THREE.DataTexture {
  const size = 256, tile = size / 2;
  const pixels = new Uint8Array(size * size * 4);
  const pigments = [
    [135, 139, 126], [150, 133, 111],
    [114, 131, 135], [169, 161, 144]
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const type = Math.floor(x / tile) + Math.floor(y / tile) * 2;
      const px = x % tile, py = y % tile;
      const broad = noise(px / 30 + type * 4.3, py / 28, 11);
      const glaze = noise(px / 12, py / 14 + type * 3.9, 81);
      const fleck = noise(px / 3.2 + type, py / 3.2, 29);
      const vein = Math.sin(py * 0.086 + Math.sin(px * 0.052 + type) * 2.5) * 0.012;
      const washed = 0.78 + 0.33 * broad + 0.12 * (glaze - 0.5)
        + 0.095 * (fleck - 0.5) + vein;
      const warm = (glaze - 0.5) * 9;
      const offset = (y * size + x) * 4;
      const [r, g, b] = pigments[type];
      pixels[offset] = THREE.MathUtils.clamp(Math.round(r * washed + warm), 0, 255);
      pixels[offset + 1] = THREE.MathUtils.clamp(Math.round(g * washed + warm * 0.5), 0, 255);
      pixels[offset + 2] = THREE.MathUtils.clamp(Math.round(b * washed), 0, 255);
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function makeRockGeometry(kind: number): THREE.BufferGeometry {
  const geometry: THREE.BufferGeometry = kind === 1
    ? new THREE.IcosahedronGeometry(1, 0)
    : kind === 2 ? new THREE.TetrahedronGeometry(1, 1)
    : new THREE.DodecahedronGeometry(1, 0);
  const pos = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // Same coordinates always get same deformation: no torn polygon seams.
    const waviness = 0.90 + 0.105 * Math.sin(x * 4.5 + z * 2.3 + kind * 1.7)
      + 0.045 * Math.cos(z * 6.1 - y * 2.8 + kind);
    pos.setXYZ(i, x * waviness, y * waviness, z * waviness);
    // Preserve a pixel gutter around each quarter so mipmaps do not bleed.
    uv.setXY(i, (kind % 2) * 0.5 + 0.035 + THREE.MathUtils.clamp(uv.getX(i), 0, 1) * 0.43,
      Math.floor(kind / 2) * 0.5 + 0.035 + THREE.MathUtils.clamp(uv.getY(i), 0, 1) * 0.43);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function makeOrganicGroundMask(seed: number, size = 64): THREE.DataTexture {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size * 2 - 1;
      const v = (y + 0.5) / size * 2 - 1;
      const angle = Math.atan2(v, u);
      const radial = Math.hypot(u, v);
      const irregular = 0.08 * Math.sin(angle * 5 + seed * 0.7)
        + 0.07 * Math.sin(angle * 9 - seed * 1.3);
      const t = THREE.MathUtils.clamp((0.98 + irregular - radial) / 0.32, 0, 1);
      const value = Math.round(t * t * (3 - 2 * t) * 255);
      const idx = (y * size + x) * 4;
      // alphaMap reads GREEN, not alpha.
      pixels[idx] = pixels[idx + 1] = pixels[idx + 2] = value;
      pixels[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function createHomeGroundDetails(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Childhood home organic ground details';

  // Do not scatter tinted 4–6 m soil/olive overlays across the meadow.
  // Those eight alpha-masked planes looked like large dark stains, especially
  // beside the river and under the foliage, despite the original painted grass
  // texture being fine. Keep ONLY the genuine hand-painted base ground and
  // real low-poly vegetation. This applies to the WHOLE courtyard, not one spot.

  const grass = scatterHomeGrass();
  const blade = makeLowPolyGrassGeometry(); // shared geometry
  const dummy = new THREE.Object3D();
  for (const dry of [false, true]) {
    const points = grass.filter(point => point.dry === dry);
    if (!points.length) continue;
    const material = new THREE.MeshBasicMaterial({
      color: dry ? '#b1a271' : '#799a64',
      vertexColors: true, side: THREE.DoubleSide, toneMapped: false
    });
    const mesh = new THREE.InstancedMesh(blade, material, points.length);
    mesh.name = dry ? 'Courtyard dry grass clumps' : 'Courtyard green grass clumps';
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      dummy.position.set(p.x, 0.091, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  const stones = scatterHomeStones();
  const atlas = makeStoneAlbedoAtlas();
  const stoneMaterial = new THREE.MeshBasicMaterial({
    map: atlas, color: '#ffffff', toneMapped: false, side: THREE.FrontSide
  });
  for (let kind = 0; kind < 4; kind++) {
    const points = stones.filter(point => point.kind === kind);
    if (!points.length) continue;
    const mesh = new THREE.InstancedMesh(makeRockGeometry(kind), stoneMaterial, points.length);
    mesh.name = 'Textured natural stones variant ' + kind;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      dummy.position.set(p.x, 0.088 + p.sy * 0.53, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(p.sx, p.sy, p.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new THREE.Color().setRGB(p.tint, p.tint, p.tint));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false; // small rocks use painted shading, no extra mobile shadow passes
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}
