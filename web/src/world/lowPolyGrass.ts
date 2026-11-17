import * as THREE from 'three';

/**
 * Small tapered, gently bent blades (4 blades, 12 triangles per tuft).
 * Kept as real low-poly geometry, not photo billboards, sprites or particles.
 * One InstancedMesh per grass tint makes the 3D meadow cheap to render.
 */
export function makeLowPolyGrassGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  for (let blade = 0; blade < 4; blade++) {
    const angle = blade * Math.PI / 2 + Math.PI / 8;
    const ux = Math.cos(angle);
    const uz = Math.sin(angle);
    const rightX = -uz;
    const rightZ = ux;
    // The previous 30–40 cm wide triangular tufts looked like paper shards.
    // Thin and shorten the blades; group them into natural grass clusters.
    const height = 0.16 + (blade % 3) * 0.037;
    const width = 0.044 + (blade % 2) * 0.012;
    const bend = 0.055 + (blade % 2) * 0.022;
    const rootX = ux * 0.02;
    const rootZ = uz * 0.02;
    const left = [rootX - rightX * width, 0.0, rootZ - rightZ * width];
    const right = [rootX + rightX * width, 0.0, rootZ + rightZ * width];
    const midLeft = [rootX + ux * bend * 0.5 - rightX * width * 0.48, height * 0.54, rootZ + uz * bend * 0.5 - rightZ * width * 0.48];
    const midRight = [rootX + ux * bend * 0.5 + rightX * width * 0.48, height * 0.54, rootZ + uz * bend * 0.5 + rightZ * width * 0.48];
    const tip = [rootX + ux * bend * 1.8, height, rootZ + uz * bend * 1.8];
    const triangles = [
      [left, right, midLeft],
      [right, midRight, midLeft],
      [midLeft, midRight, tip]
    ];
    for (const triangle of triangles) {
      for (const point of triangle) {
        positions.push(...point);
        const brightness = point[1] / height;
        colors.push(
          0.63 + brightness * 0.24,
          0.70 + brightness * 0.19,
          0.48 + brightness * 0.15
        );
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Protect roads, the garden's cultivated plots, the stream, main buildings,
 * and the player's spawn from decorative tufts. Existing Rapier collision
 * remains unchanged; grass blades are non-colliding detail. */
export function isGrassAllowed(x: number, z: number): boolean {
  if (x < -70 || x > 65 || z < -51 || z > 48) return false;
  // Primary village/plaza and long central street
  if (x > -12.7 && x < 12.7 && z > -15 && z < 5) return false;
  if (Math.abs(x) < 3.9 && z > -15 && z < 27) return false;
  // Main home-to-village dirt route
  if (x >= -20 && x <= 3 && Math.abs(z - 9) < 2.55) return false;
  // Protagonist's home footprint and expanded front entry
  if (Math.abs(x + 32.5) < 6 && Math.abs(z + 9.4) < 6.2) return false;
  if (Math.abs(x + 32.5) < 3.0 && z > -4.8 && z < 10.4) return false;
  // The central childhood earth courtyard is worn/bare, not a meadow. Keep
  // growth mainly at the edges near the fence and on the grass beyond.
  if (x > -42.2 && x < -16 && z > -10 && z < 13) return false;
  // Abandoned beds stay bare: no invented garden plants
  if (x >= -27.5 && x <= -17.2 && z >= -2.4 && z <= 3.0) return false;
  // Storehouse, well and immediate player arrival area
  if (Math.abs(x + 22) < 2.7 && Math.abs(z + 10.4) < 2.4) return false;
  if (Math.hypot(x + 39, z - 4) < 1.6) return false;
  if (Math.hypot(x + 29.5, z - 7.4) < 1.7) return false;
  // Western stream and the village river
  if (Math.abs(x + 45.5) < 1.8 && z > -5 && z < 27) return false;
  if (Math.abs(z - 17) < 2.2 && x > -24 && x < 25) return false;
  // Distinct village buildings, including the new modular warung.
  for (const [cx, cz, hx, hz] of [
    [-13, -12, 6, 4], [-1, -20, 4.5, 4], [17, -18, 4.5, 4],
    [-9.5, -22.5, 3.1, 3.55],
    [7, -7, 4.5, 4]
  ]) {
    if (Math.abs(x - cx) < hx && Math.abs(z - cz) < hz) return false;
  }
  return true;
}

type GrassPoint = { x: number; z: number; angle: number; scale: number; kind: 0 | 1 };

/** Seeded patches avoid an evenly spaced 'confetti of triangles' look. */
export function scatterLowPolyGrass(seed = 73137): GrassPoint[] {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const result: GrassPoint[] = [];
  // Several close tufts form one tiny clump; clumps have grassy gaps.
  for (let z = -49; z <= 47; z += 3.3) {
    for (let x = -68; x <= 63; x += 3.3) {
      const cx = x + (random() - 0.5) * 2.3;
      const cz = z + (random() - 0.5) * 2.3;
      const nearHome = cx > -44 && cx < -15 && cz > -16 && cz < 17;
      const patchNoise = Math.sin(cx * 0.23 + cz * 0.08) *
        Math.cos(cz * 0.27 - cx * 0.12);
      const density = nearHome ? 0.34 : 0.43;
      if (random() > density + patchNoise * 0.18) continue;
      // Local clusters rather than isolated vertical triangles.
      const tuftCount = 2 + Math.floor(random() * 3);
      for (let k = 0; k < tuftCount; k++) {
        const jx = cx + (random() - 0.5) * 0.74;
        const jz = cz + (random() - 0.5) * 0.74;
        if (!isGrassAllowed(jx, jz)) continue;
        const dry = random() < (nearHome ? 0.17 : 0.12);
        result.push({
          x: jx, z: jz,
          angle: random() * Math.PI * 2,
          scale: 0.75 + random() * 0.63,
          kind: dry ? 1 : 0
        });
      }
    }
  }
  return result;
}

export function createInstancedGrass(seed = 73137): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Low poly instanced meadow grass';
  const points = scatterLowPolyGrass(seed);
  const geometry = makeLowPolyGrassGeometry();
  const dummy = new THREE.Object3D();
  for (const kind of [0, 1] as const) {
    const selected = points.filter(point => point.kind === kind);
    if (!selected.length) continue;
    const material = new THREE.MeshBasicMaterial({
      color: kind === 0 ? '#6c965b' : '#aa9f6d',
      vertexColors: true,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const mesh = new THREE.InstancedMesh(geometry, material, selected.length);
    mesh.name = kind === 0 ? 'Green grass tufts' : 'Dry verge grass tufts';
    for (let i = 0; i < selected.length; i++) {
      const point = selected[i];
      dummy.position.set(point.x, 0.075, point.z);
      dummy.rotation.set(0, point.angle, 0);
      dummy.scale.setScalar(point.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false; // avoid entire-wide-area bounding-volume pop
    group.add(mesh);
  }
  return group;
}
