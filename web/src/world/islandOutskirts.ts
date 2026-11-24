import * as THREE from 'three';

const fullTurn = Math.PI * 2;
const segments = 192;
function elevation(radius: number, theta: number) {
  const edge = 80 / Math.max(Math.abs(Math.sin(theta)), Math.abs(Math.cos(theta)));
  const rise = THREE.MathUtils.smoothstep(radius, edge, edge + 65);
  return .14 + rise * (3.8 + 2.3 * Math.sin(5 * theta + radius * .043)
    + 1.4 * Math.cos(9 * theta - radius * .033));
}

export function createOutskirts(meadow: THREE.Texture, foliage: THREE.Texture) {
  meadow.wrapS = meadow.wrapT = THREE.RepeatWrapping;
  meadow.colorSpace = foliage.colorSpace = THREE.SRGBColorSpace;
  meadow.anisotropy = foliage.anisotropy = 4;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const groundColors: number[] = [];
  const steps = 22;
  for (let i = 0; i <= segments; i++) {
    const theta = fullTurn * (i % segments) / segments;
    const dx = Math.sin(theta), dz = -Math.cos(theta);
    const inner = 63 / Math.max(Math.abs(dx), Math.abs(dz));
    for (let j = 0; j <= steps; j++) {
      const radius = inner + (235 - inner) * j / steps;
      const x = radius * dx, z = radius * dz;
      positions.push(x, elevation(radius, theta), z);
      uvs.push(x / 15, z / 15);
      groundColors.push(1, 1, 1, THREE.MathUtils.smoothstep(Math.max(Math.abs(x), Math.abs(z)), 63, 75));
      if (j && i) {
        const d = i * (steps + 1) + j, b = d - steps - 1;
        indices.push(b - 1, d - 1, d, b - 1, d, b);
      }
    }
  }
  function geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    return g;
  }
  const land = new THREE.Mesh(geometry(), new THREE.MeshBasicMaterial({
    map: meadow, color: 0xe2e6c2, vertexColors: true, transparent: true, fog: true, toneMapped: false, side: THREE.DoubleSide
  }));
  land.geometry.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 4));
  land.material.forceSinglePass = true;
  land.renderOrder = -90;
  // Match the playable meadow's distance fog at its perimeter, then keep
  // enough local pigment to distinguish the foothills behind it.
  land.material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying float scenicDistance;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nscenicDistance = max(abs(position.x), abs(position.z));');
    shader.fragmentShader = 'varying float scenicDistance;\n' + shader.fragmentShader.replace(
      '#include <fog_fragment>', `vec3 meadowColor = gl_FragColor.rgb;
        #include <fog_fragment>
        gl_FragColor.rgb = mix(gl_FragColor.rgb, meadowColor, .69 * smoothstep(70., 130., scenicDistance));`);
  };
  land.name = 'Rolling meadow outside playable ground';

  positions.length = uvs.length = indices.length = 0;
  // Two staggered belts create parallax. Coastal openings preserve the sea view.
  let seed = 223;
  const random = () => ((seed = Math.imul(1664525, seed) + 1013904223 | 0) >>> 0) / 4294967296;
  for (let belt = 0; belt < 2; belt++) {
    const count = belt ? 112 : 70;
    for (let i = 0; i < count; i++) {
      const theta = fullTurn * (i + random() * .8) / count;
      const dx = Math.sin(theta), dz = -Math.cos(theta);
      if (dz < -.75 && random() < .72) continue;
      const radius = (belt ? 150 : 118) + random() * 16;
      const tall = random() < (belt ? .75 : .38);
      const cell = tall ? (dz < -.6 ? 1 : 0) : (random() < .5 ? 2 : 3);
      const height = (tall ? 9 : 5.5) * (.7 + random() * .65);
      const half = height * 700 / 640 / 2;
      const y = elevation(radius, theta) - .3;
      const cx = radius * dx, cz = radius * dz;
      const a = positions.length / 3;
      const left = cell % 2 / 2, top = 1 - Math.floor(cell / 2) / 2;
      positions.push(cx + dz*half,y,cz - dx*half, cx - dz*half,y,cz + dx*half,
        cx - dz*half,y+height,cz + dx*half, cx + dz*half,y+height,cz - dx*half);
      uvs.push(left,top-.5, left+.5,top-.5, left+.5,top, left,top);
      indices.push(a,a+1,a+2,a,a+2,a+3);
    }
  }
  const groves = new THREE.Mesh(geometry(), new THREE.MeshBasicMaterial({
    map: foliage, alphaTest: .35, side: THREE.DoubleSide, fog: false, toneMapped: false
  }));
  groves.name = 'Middle-distance orchard, forest and coastal palms';
  return [land, groves];
}
