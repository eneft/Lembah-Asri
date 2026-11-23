import * as THREE from 'three';

// Coordinates of the four brown ridges in the unique overhead garden painting.
// top/bottom are measured from the top of the image, in the same northward view.
const rows = [
  { center: .214, top: .173, bottom: .806, radius: .074, height: .22 },
  { center: .398, top: .135, bottom: .839, radius: .074, height: .26 },
  { center: .585, top: .165, bottom: .821, radius: .073, height: .235 },
  { center: .774, top: .191, bottom: .851, radius: .078, height: .25 }
];
// Keep the four ridges parallel to the adjacent East bamboo fence (world Z).
// All garden UVs, planting slots, soil elevations and Rapier collision read
// this single transform, so the visible beds and gameplay stay aligned.
export const GARDEN = { x: -22.05, z: -.58, width: 9.1, depth: 9.8, yaw: 0 } as const;
const cos = Math.cos(GARDEN.yaw), sin = Math.sin(GARDEN.yaw);
const smooth = THREE.MathUtils.smoothstep;

function centerline(row: number, t: number) {
  return rows[row].center + .004 * Math.sin(t * 13 + row * 1.6) + .003 * Math.cos(t * 24 + row * 2);
}

export function gardenUV(x: number, z: number) {
  const dx = x - GARDEN.x, dz = z - GARDEN.z;
  return { u: .5 + (cos * dx - sin * dz) / GARDEN.width, t: .5 + (sin * dx + cos * dz) / GARDEN.depth };
}

export function gardenProfile(u: number, t: number) {
  let height = 0, margin = Infinity;
  for (const [i, row] of rows.entries()) {
    const cap = .065;
    const end = Math.max(row.top + cap - t, t - row.bottom + cap, 0) / cap;
    const radius = row.radius * (1 + .034 * Math.sin(t * 27 + i * 1.6));
    const distance = Math.hypot((u - centerline(i, t)) / radius, end);
    margin = Math.min(margin, (distance - 1) * radius * GARDEN.width);
    const crown = (1 - smooth(distance, .08, 1.12)) * (1 + .055 * Math.sin(t * 34 + i));
    height = Math.max(height, row.height * crown);
  }
  const edge = Math.min(u * GARDEN.width, (1 - u) * GARDEN.width, t * GARDEN.depth, (1 - t) * GARDEN.depth);
  const fray = .15 * Math.sin(t * 25 + u * 31) + .13 * Math.sin(t * 48 - u * 29);
  const coverage = smooth(edge, .035, .88 + fray) * (1 - smooth(margin, .52, 1.8 + fray));
  return { height, margin, coverage };
}

export function gardenHeightAt(x: number, z: number): number {
  if (Math.abs(x - GARDEN.x) > 6 || Math.abs(z - GARDEN.z) > 6.2) return 0;
  const uv = gardenUV(x, z);
  return gardenProfile(uv.u, uv.t).height;
}

/** Exclude planted props and scattered grass from both the ridges and the paths between them. */
export function isWorkedGarden(x: number, z: number): boolean {
  const { u, t } = gardenUV(x, z);
  return u > .105 && u < .887 && t > .10 && t < .90;
}

const placesPerRow = 6;
export const plantingPlaces = rows.flatMap((row, r) => Array.from({ length: placesPerRow }, (_, place) => {
  const t = THREE.MathUtils.lerp(row.top + .074, row.bottom - .074, place / (placesPerRow - 1));
  const u = centerline(r, t);
  const dx = (u - .5) * GARDEN.width, dz = (t - .5) * GARDEN.depth;
  return { id: r * placesPerRow + place, row: r, place, u, v: 1 - t,
    x: GARDEN.x + cos * dx + sin * dz, z: GARDEN.z - sin * dx + cos * dz,
    height: gardenProfile(u, t).height };
}));

/** Extra subdivisions are restricted to the garden. The perimeter and the two UV sets
 * still meet the original courtyard exactly. Also used by the world shadow receiver. */
export function sculptGardenGround<M extends THREE.Material>(mesh: THREE.Mesh<THREE.PlaneGeometry, M>) {
  const original = mesh.geometry;
  const { width, height: depth } = original.parameters;
  const { x: cx, z: cz } = mesh.position;
  const axis = (center: number, half: number, low: number, high: number, segments: number) => [
    low, ...Array.from({ length: segments + 1 }, (_, i) => center - half + 2 * half * i / segments), high
  ];
  const xs = axis(GARDEN.x, 6, cx - width / 2, cx + width / 2, 60);
  const zs = axis(GARDEN.z, 6.2, cz - depth / 2, cz + depth / 2, 62);
  const g = new THREE.PlaneGeometry(width, depth, xs.length - 1, zs.length - 1);
  const pos = g.getAttribute('position'), uv = g.getAttribute('uv');
  const paint = new Float32Array(pos.count * 3);
  const sourceUV = original.getAttribute('uv1');
  const uv1 = sourceUV && new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2);
  let i = 0;
  for (const z of zs) {
    for (const x of xs) {
      const a = .5 + (x - cx) / width, b = .5 - (z - cz) / depth;
      const { u, t } = gardenUV(x, z);
      const field = gardenProfile(u, t);
      pos.setXYZ(i, x - cx, cz - z, field.height);
      uv.setXY(i, a, b);
      if (uv1) uv1.setXY(i,
        THREE.MathUtils.lerp(sourceUV.getX(0), sourceUV.getX(1), a),
        THREE.MathUtils.lerp(sourceUV.getY(2), sourceUV.getY(0), b));
      paint.set([u, 1 - t, field.coverage], i * 3);
      i++;
    }
  }
  if (uv1) g.setAttribute('uv1', uv1);
  g.setAttribute('gardenPaint', new THREE.BufferAttribute(paint, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  mesh.geometry = g;
  original.dispose();
  return mesh;
}

export type GardenGround = { vertices: Float32Array; indices: Uint32Array };

/** Use the rendered triangles as the walkable mound. Flat lanes already have the world floor. */
export function gardenCollision(mesh: THREE.Mesh<THREE.PlaneGeometry>): GardenGround {
  const pos = mesh.geometry.getAttribute('position'), index = mesh.geometry.getIndex()!;
  const vertices: number[] = [], indices: number[] = [];
  const used = new Map<number, number>();
  for (let i = 0; i < index.count; i += 3) {
    const face = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    if (face.every(v => pos.getZ(v) <= .0001)) continue;
    for (const v of face) {
      let dst = used.get(v);
      if (dst === undefined) {
        dst = vertices.length / 3;
        used.set(v, dst);
        vertices.push(mesh.position.x + pos.getX(v), pos.getZ(v), mesh.position.z - pos.getY(v));
      }
      indices.push(dst);
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}
