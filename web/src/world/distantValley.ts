import * as THREE from 'three';

// Let nearby trees carry the sharpest foliage detail in both panorama layers.
function softenDistantPaint(material: THREE.MeshBasicMaterial) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 distant = texture2D(map, vMapUv, 1.35);
        distant.rgb = mix(distant.rgb, vec3(.39,.48,.32), .10);
        diffuseColor *= distant;
      #endif
    `);
  };
}

// Continuous cylindrical mapping preserves the painted horizon aspect ratio.
export function createDistantValley(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  const segments = 128;
  const positions: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const theta = (i % segments) * 2 * Math.PI / segments;
    const x = Math.sin(theta), z = -Math.cos(theta);
    const radius = 230;
    const height = 2 * Math.PI * radius * 178 / 6000;
    // Let the rolling meadow occlude the base of the illustration.
    const base = -2;
    const rows = [
      [radius, base - 1, 0, 0],
      [radius, base, 0, 1],
      [radius, base + height * .1, .1, 1],
      [radius, base + height * .5, .5, 1],
      [radius, base + height, 1, 1],
      [radius, base + height + 20, 1, .65],
      [radius, base + height + 65, 1, 0]
    ];
    rows.forEach(([radius, height, v, opacity], j) => {
      positions.push(x * radius, height, z * radius);
      uvs.push(u, v);
      colors.push(1, 1, 1, opacity);
      if (i && j) {
        const d = i * rows.length + j, b = d - rows.length;
        indices.push(b - 1, d - 1, d, b - 1, d, b);
      }
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({
    map: texture, vertexColors: true, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, fog: false, toneMapped: false
  });
  softenDistantPaint(material);
  material.forceSinglePass = true;
  const panorama = new THREE.Mesh(geometry, material);
  panorama.name = 'Island horizon - north sea, east village, south forest, west mountain';
  panorama.renderOrder = -100;
  return panorama;
}

// Independent north-facing panorama: the world convention is north = -Z.
// Preserve the 2048:682 illustration aspect ratio along a 90 degree arc.
export function createNorthHomePanorama(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  const segments = 96, radius = 229, span = Math.PI / 2;
  const height = radius * span * 682 / 2048, base = -2;
  const positions: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [];
  const smooth = (t: number) => {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  };
  const rows = [[0, 0], [.05, 1], [.85, 1], [1, 0]];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments, theta = (u - .5) * span;
    const edge = smooth(u / .15) * smooth((1 - u) / .15);
    for (let j = 0; j < rows.length; j++) {
      const [v, opacity] = rows[j];
      positions.push(Math.sin(theta) * radius, base + v * height, -Math.cos(theta) * radius);
      uvs.push(u, v);
      colors.push(1, 1, 1, edge * opacity);
      if (i && j) {
        const d = i * rows.length + j, b = d - rows.length;
        indices.push(b - 1, d - 1, d, b - 1, d, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({
    map: texture, vertexColors: true, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, fog: false, toneMapped: false
  });
  softenDistantPaint(material);
  material.forceSinglePass = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Childhood home north - painted rice fields and volcano';
  mesh.renderOrder = -99;
  return mesh;
}
