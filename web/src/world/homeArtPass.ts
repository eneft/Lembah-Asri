import * as THREE from 'three';
import { isHomeGroundDetailAllowed, makeStoneAlbedoAtlas } from './homeGroundDetails.ts';

/**
 * The approved art reference is not a flat image placed behind the player:
 * these are genuine textured/stylized 3D props in the existing world.
 *
 * One curved fan of 7 narrow leaves per plant (112 low-poly triangles).
 * One InstancedMesh for all low foliage and another for the two tall
 * tropical plants. Four stone variants reuse a single 256px rock atlas.
 * The original house GLB, step geometry, animations and Rapier stay intact.
 */
type LeafPoint = {
  x: number; z: number; scale: number; yaw: number; hue: number;
};

const shrubAnchors: ReadonlyArray<readonly [number, number, number]> = [
  [-41.35, -10.3, 0.91], [-40.45, -7.8, 0.86],
  [-40.55, -5.8, 0.77], [-39.20, -4.5, 0.82],
  [-38.16, -3.55, 0.81], [-36.92, -3.12, 0.64],
  [-27.00, -3.55, 0.70], [-25.80, -4.45, 0.79],
  [-25.75, -6.20, 0.83], [-26.15, -8.05, 0.92],
  [-39.70, -12.80, 0.86], [-36.50, -15.18, 0.72],
  [-29.30, -15.12, 0.70], [-24.78, -13.65, 0.66],
  [-41.00, 1.50, 0.65], [-41.55, 10.72, 0.71],
  [-38.90, 12.85, 0.60], [-25.70, 12.73, 0.65]
];

const tallPlants: ReadonlyArray<readonly [number, number, number]> = [
  [-41.75, -13.12, 2.05], [-25.33, -12.99, 1.67],
  [-41.35, -7.30, 1.46]
];

type StonePoint = {
  x: number; z: number;
  rx: number; ry: number; rz: number;
  sx: number; sy: number; sz: number;
  variant: number;
};

const stonePoints: readonly StonePoint[] = [
  // A few irregular stepping stones to one side of the porch approach.
  {x:-38.05,z:7.73,rx:0.01,ry:0.12,rz:-0.05,sx:0.46,sy:0.08,sz:0.30,variant:0},
  {x:-37.12,z:8.30,rx:0,ry:0.82,rz:0.03,sx:0.55,sy:0.075,sz:0.36,variant:1},
  {x:-36.18,z:7.94,rx:0.02,ry:1.27,rz:0,sx:0.37,sy:0.065,sz:0.29,variant:2},
  {x:-37.57,z:9.12,rx:0,ry:2.05,rz:0.02,sx:0.30,sy:0.07,sz:0.26,variant:3},
  // Small naturally varied stones among the planted edge; no wall of rocks.
  {x:-41.12,z:-4.71,rx:0.1,ry:0.33,rz:-0.06,sx:0.41,sy:0.23,sz:0.31,variant:2},
  {x:-39.30,z:-3.39,rx:0.04,ry:1.40,rz:0.11,sx:0.25,sy:0.12,sz:0.30,variant:0},
  {x:-38.12,z:-3.15,rx:0.02,ry:0.80,rz:0.08,sx:0.33,sy:0.15,sz:0.22,variant:1},
  {x:-25.10,z:-3.88,rx:0.09,ry:1.61,rz:-0.05,sx:0.32,sy:0.15,sz:0.28,variant:3},
  {x:-25.53,z:-7.37,rx:0.03,ry:0.33,rz:0.09,sx:0.35,sy:0.14,sz:0.29,variant:2},
  {x:-39.81,z:12.54,rx:0,ry:1.17,rz:0,sx:0.30,sy:0.13,sz:0.36,variant:1}
];

function randomGenerator(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

/** Only scattered undergrowth, not a cultivated garden or blocking jungle. */
export function scatterHomeUndergrowth(seed = 18628): LeafPoint[] {
  const random = randomGenerator(seed);
  const result: LeafPoint[] = [];
  for (let z = -15.0; z < 14; z += 1.36) {
    for (let x = -42.6; x < -17.8; x += 1.36) {
      const px = x + (random() - 0.5) * 1.06;
      const pz = z + (random() - 0.5) * 1.06;
      // Texture needs breathable gaps: denser beside walls and around fence,
      // sparse in the middle of the well-trodden courtyard.
      const edge = Math.min(
        px + 43.0, -17.35 - px, pz + 15.5, 14.2 - pz
      );
      const nearFrontFoundation =
        pz > -4.65 && pz < -2.0 &&
        (px < -36.8 || px > -27.4) ? 0.34 : 0;
      const density = 0.11 + 0.24 *
        THREE.MathUtils.clamp(1 - edge / 4.6, 0, 1) + nearFrontFoundation;
      if (random() > density) continue;
      if (!isHomeGroundDetailAllowed(px, pz)) continue;
      result.push({
        x: px, z: pz,
        scale: 0.34 + random() * 0.34,
        yaw: random() * Math.PI * 2,
        hue: random()
      });
    }
  }
  return result;
}

/** A plant made of volumetric curved leaves, not a flat cross-plane sprite. */
export function makeBroadLeafGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];

  // Curved tapering leaves with a raised midrib and softly bent tips.
  // The previous 4-triangle leaves looked like broad rigid paper shards.
  // 7 leaves x 4 length sections x 4 triangles = 112 triangles per tuft.
  const leaves = 7;
  const segments = 4;
  type LeafVertex = { p: [number, number, number]; uv: [number, number]; shade: number };

  function vertex(angle: number, leaf: number, t: number, side: -1 | 0 | 1): LeafVertex {
    const dx = Math.cos(angle), dz = Math.sin(angle);
    const sx = -dz, sz = dx;
    const length = 0.60 + (leaf % 3) * 0.045;
    const radius = length * t;
    // The blade rises from its stem, then arches downward at its tapered tip.
    const height = 0.07 + 0.53 * Math.sin(Math.PI * t * 0.87) + 0.065 * t
      + (leaf % 2) * 0.025;
    const width = (0.009 + 0.115 * Math.sin(Math.PI * t)) * side;
    const ridge = side === 0 ? 0.025 * Math.sin(Math.PI * t) : 0;
    return {
      p: [dx * radius + sx * width, height + ridge, dz * radius + sz * width],
      uv: [side === -1 ? 0.08 : side === 1 ? 0.92 : 0.5, 0.025 + t * 0.95],
      shade: 0.70 + t * 0.16 + (side === 0 ? 0.07 : 0)
    };
  }

  function tri(a: LeafVertex, b: LeafVertex, c: LeafVertex) {
    for (const v of [a,b,c]) {
      positions.push(...v.p);
      uvs.push(...v.uv);
      colors.push(v.shade * 0.89, v.shade, v.shade * 0.79);
    }
  }

  for (let leaf = 0; leaf < leaves; leaf++) {
    const angle = leaf * Math.PI * 2 / leaves + (leaf % 2) * 0.085;
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const a = vertex(angle, leaf, t0, -1);
      const b = vertex(angle, leaf, t0, 0);
      const c = vertex(angle, leaf, t0, 1);
      const d = vertex(angle, leaf, t1, -1);
      const e = vertex(angle, leaf, t1, 0);
      const f = vertex(angle, leaf, t1, 1);
      tri(a, d, b);
      tri(b, d, e);
      tri(b, e, c);
      tri(c, e, f);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** UV-painted leaf pigment texture shared by every genuine 3D leaf mesh.
 * Prebaked vein and pigment grain; runtime material stays unlit like the
 * original character/house atlas. Memory: 128 x 128 RGBA (~64 KiB).
 */
export function makePaintedLeafAlbedo(): THREE.DataTexture {
  const size = 128;
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const vein = Math.exp(-Math.abs(u - 0.5) * 31) * 17;
      const branch = Math.sin(v * 26 + u * 15) * Math.sin(v * 13 - u * 25) * 3.8;
      const pigment = Math.sin(u * 69 + Math.sin(v * 21) * 2.4) * 4
        + Math.cos(v * 48 + u * 11) * 3;
      const highlight = (v > 0.32 && v < 0.76 ? 5 : 0);
      const k = (y * size + x) * 4;
      rgba[k] = THREE.MathUtils.clamp(210 + pigment + branch + highlight + vein * 0.75, 0, 255);
      rgba[k + 1] = THREE.MathUtils.clamp(230 + pigment + highlight + vein, 0, 255);
      rgba[k + 2] = THREE.MathUtils.clamp(197 + pigment * 0.7 + vein * 0.60, 0, 255);
      rgba[k + 3] = 255;
    }
  }
  const map = new THREE.DataTexture(rgba, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

function createPlantInstances(
  name: string, points: LeafPoint[], geometry: THREE.BufferGeometry,
  albedo: THREE.DataTexture, castShadow: boolean
): THREE.InstancedMesh {
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff', map: albedo,
    vertexColors: true,
    toneMapped: false,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.InstancedMesh(geometry, material, points.length);
  const transform = new THREE.Object3D();
  const colors = ['#6d9555', '#7ba05f', '#618e59', '#8a9e5b', '#547f52'];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    transform.position.set(p.x, 0.065, p.z);
    transform.rotation.set(0, p.yaw, 0);
    const size = p.scale * (name.startsWith('Tall') ? 0.90 : 0.72);
    transform.scale.set(size, size * (0.92 + p.hue * 0.22), size);
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
    mesh.setColorAt(i, new THREE.Color(colors[Math.min(4, Math.floor(p.hue * 5))]));
  }
  mesh.name = name;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = false;
  return mesh;
}

function makeAtlasRockGeometry(variant: number): THREE.BufferGeometry {
  const geometry: THREE.BufferGeometry = variant === 0
    ? new THREE.IcosahedronGeometry(1, 0)
    : variant === 1
      ? new THREE.DodecahedronGeometry(1, 0)
      : variant === 2
        ? new THREE.IcosahedronGeometry(1, 1)
        : new THREE.CylinderGeometry(1, 0.92, 0.75, 7, 1);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(
      i, (variant % 2) * 0.5 + 0.035 + THREE.MathUtils.clamp(uv.getX(i), 0, 1) * 0.43,
      Math.floor(variant / 2) * 0.5 + 0.035 + THREE.MathUtils.clamp(uv.getY(i), 0, 1) * 0.43
    );
  }
  return geometry;
}

export function createHomeArtPass(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Lembah Asri hand-painted 3D environment art pass';
  const foliage = makeBroadLeafGeometry();
  const foliageAlbedo = makePaintedLeafAlbedo();
  const shrubs = shrubAnchors.map(([x, z, scale], i) => ({
    x, z, scale, yaw: i * 1.81, hue: (i * 0.387) % 1
  }));
  group.add(createPlantInstances('Natural shrubs around childhood home',
    shrubs, foliage, foliageAlbedo, true));

  const low = scatterHomeUndergrowth();
  group.add(createPlantInstances('Natural varied understory meadow',
    low, foliage, foliageAlbedo, false));

  const palms = tallPlants.map(([x, z, scale], i) => ({
    x, z, scale, yaw: i * 1.17, hue: (i * 0.31) % 1
  }));
  group.add(createPlantInstances('Tall tropical foliage behind home',
    palms, foliage, foliageAlbedo, true));

  const atlas = makeStoneAlbedoAtlas();
  const material = new THREE.MeshBasicMaterial({
    map: atlas, color: '#ffffff', toneMapped: false
  });
  const transform = new THREE.Object3D();
  for (let variant = 0; variant < 4; variant++) {
    const selected = stonePoints.filter(point => point.variant === variant);
    const mesh = new THREE.InstancedMesh(
      makeAtlasRockGeometry(variant), material, selected.length
    );
    mesh.name = 'Naturally shaped textured stepping stones ' + variant;
    selected.forEach((stone, i) => {
      transform.position.set(stone.x, 0.115 + stone.sy * 0.38, stone.z);
      transform.rotation.set(stone.rx, stone.ry, stone.rz);
      transform.scale.set(stone.sx, stone.sy, stone.sz);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}
