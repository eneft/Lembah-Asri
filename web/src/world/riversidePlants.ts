import * as THREE from 'three';

/** Bent, ridged leaf strips retain their silhouette when the camera circles. */
export function makeSedgeGeometry(tall: boolean): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const count = tall ? 11 : 6;
  const rows = tall ? 4 : 3;
  const lanes = tall ? [-1, 0, 1] : [-1, 1];
  const root = new THREE.Color(tall ? '#526328' : '#627934');
  const sun = new THREE.Color(tall ? '#d1cb61' : '#c7c963');
  const shade = new THREE.Color();
  for (let leaf = 0; leaf < count; leaf++) {
    const angle = leaf * 2.39996 + .42 * Math.sin(leaf * 2.2);
    const dx = Math.cos(angle), dz = Math.sin(angle);
    const vigor = .5 + .5 * Math.sin(leaf * 2.71 + .33);
    const height = (tall ? .74 : .27) * (.63 + .44 * vigor);
    const reach = (tall ? .43 : .18) * (.47 + .88 * (1 - vigor));
    const width = (tall ? .050 : .024) * (.79 + .35 * vigor);
    const base = positions.length / 3;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      const span = width * (1 - t) * (.54 + 1.12 * Math.sin(t * 2.55));
      const bend = reach * (.17 + .24 * t + t * t);
      for (const lane of lanes) {
        const ridge = lane === 0 ? span * .31 : 0;
        positions.push(dx * (bend + ridge) - dz * span * lane,
          height * (1.55 * t - .63 * t * t), dz * (bend + ridge) + dx * span * lane);
        shade.copy(root).lerp(sun, .06 + .73 * t + .15 * vigor)
          .multiplyScalar(lane < 0 ? .78 : lane === 0 ? 1.05 : .93);
        colors.push(shade.r, shade.g, shade.b);
      }
    }
    for (let row = 0; row < rows; row++) for (let lane = 0; lane < lanes.length - 1; lane++) {
      const a = base + row * lanes.length + lane;
      const next = a + lanes.length;
      indices.push(a, next, a + 1);
      if (row < rows - 1) indices.push(a + 1, next, next + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Four small, open wildflowers with warm centres, clustered on one stem patch. */
export function makeBankFlowerGeometry(): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [];
  const petal = new THREE.Color('#f3edcf'), centre = new THREE.Color('#d6a441');
  const green = new THREE.Color('#76883d');
  type Point = [number, number, number];
  function triangle(a: Point, b: Point, c: Point, color: THREE.Color) {
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  }
  for (let stem = 0; stem < 4; stem++) {
    const x = Math.cos(stem * 2.48) * .11, z = Math.sin(stem * 2.48) * .12;
    const h = .12 + .029 * stem;
    triangle([x * .7 - .008, 0, z * .8], [x * .7 + .008, 0, z * .8], [x, h, z], green);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * .4 + stem, dx = Math.cos(a), dz = Math.sin(a);
      const side: Point = [x + dx * .026 - dz * .012, h + .011, z + dz * .026 + dx * .012];
      const far: Point = [x + dx * .043, h + .015, z + dz * .043];
      const other: Point = [x + dx * .026 + dz * .012, h + .009, z + dz * .026 - dx * .012];
      triangle([x, h, z], side, far, petal);
      triangle([x, h, z], far, other, petal);
      triangle([x, h + .009, z], [x + dx * .012, h + .007, z + dz * .012],
        [x + Math.cos(a+1.26)*.012, h+.007, z + Math.sin(a+1.26)*.012], centre);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}
