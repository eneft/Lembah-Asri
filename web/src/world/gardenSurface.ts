import * as THREE from 'three';
import { GARDEN, gardenProfile, plantingPlaces } from './gardenLayout.ts';
import { cropStage, type PlotState } from './farmPlots.ts';

const SOIL_STATE_SIZE = 128;
export const gardenArtURL = './textures/terrain/home_garden_rows.webp';

function fallbackGarden(): THREE.DataTexture {
  const size = 72, bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = gardenProfile((x + .5) / size, 1 - (y + .5) / size);
    const soil = 1 - THREE.MathUtils.smoothstep(p.margin, -.14, .12);
    const grass = THREE.MathUtils.smoothstep(p.margin, .46, 1.3);
    const grain = 3 * Math.sin(x * 1.9 + y * 2.37);
    const k = (y * size + x) * 4;
    bytes[k] = 184 - 62 * soil - 49 * grass + grain;
    bytes[k+1] = 146 - 62 * soil + 4 * grass + grain;
    bytes[k+2] = 97 - 45 * soil - 29 * grass + grain;
    bytes[k+3] = 255;
  }
  const tex = new THREE.DataTexture(bytes, size, size);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function leafySawi(): THREE.BufferGeometry {
  const vertices: number[] = [], colors: number[] = [], indices: number[] = [];
  const ribs = new THREE.Color('#a5b95c'), blades = new THREE.Color('#6a944b'), tips = new THREE.Color('#8caa52');
  for (let leaf = 0; leaf < 8; leaf++) {
    const angle = leaf * 2.4, outer = leaf < 5;
    const reach = outer ? .28 : .15, lift = outer ? .17 : .28;
    const dx = Math.cos(angle), dz = Math.sin(angle);
    const start = vertices.length / 3;
    for (let band = 0; band <= 4; band++) {
      const t = band / 4, width = .084 * Math.sin(Math.PI * t) ** .7 + .003;
      for (const side of [-1, 0, 1]) {
        vertices.push(dx * reach * t - dz * width * side,
          lift * Math.sin(t * 2.03) + (side === 0 ? .016 * Math.sin(t * Math.PI) : 0),
          dz * reach * t + dx * width * side);
        const c = side === 0 ? ribs : band > 2 ? tips : blades;
        colors.push(c.r, c.g, c.b);
      }
      if (band < 4) for (let j = 0; j < 2; j++) {
        const a = start + band * 3 + j;
        indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export class GardenSurface {
  readonly crops = new THREE.Group();
  private readonly pigment = { value: fallbackGarden() as THREE.Texture };
  private readonly pixels = new Uint8Array(SOIL_STATE_SIZE ** 2 * 4);
  private readonly state = new THREE.DataTexture(this.pixels, SOIL_STATE_SIZE, SOIL_STATE_SIZE);
  private readonly focus = new THREE.Vector2(-5, -5);
  private readonly leaves = new THREE.InstancedMesh(leafySawi(),
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }), plantingPlaces.length);
  private readonly seeds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshBasicMaterial({ color: '#d1ac76', toneMapped: false }), plantingPlaces.length * 3);
  private alive = true;

  constructor() {
    this.crops.name = 'Sawi planted by the player';
    this.state.magFilter = this.state.minFilter = THREE.LinearFilter;
    this.state.needsUpdate = true;
    this.leaves.count = this.seeds.count = 0;
    this.leaves.frustumCulled = this.seeds.frustumCulled = false;
    this.leaves.castShadow = true;
    this.crops.add(this.seeds, this.leaves);
  }

  async loadArt() {
    try {
      const tex = await new THREE.TextureLoader().loadAsync(gardenArtURL);
      if (!this.alive) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      this.pigment.value.dispose();
      this.pigment.value = tex;
    } catch (err) { console.warn('[LembahAsri] Garden is using its soil fallback', err); }
  }

  /** Extend the existing painted courtyard material, including its creek cutout and outer alpha. */
  bind(material: THREE.MeshBasicMaterial) {
    const previous = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      shader.uniforms.uGardenPigment = this.pigment;
      shader.uniforms.uFarmSoil = { value: this.state };
      shader.uniforms.uFarmFocus = { value: this.focus };
      shader.vertexShader = 'attribute vec3 gardenPaint;\nvarying vec4 vPlotPaint;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\n' +
        'vPlotPaint = vec4(gardenPaint, clamp(1.0 + dot(normal - vec3(0.,0.,1.), vec3(-.40,.23,.56)), .77, 1.14));');
      shader.fragmentShader = 'uniform sampler2D uGardenPigment;\nuniform sampler2D uFarmSoil;\n' +
        'uniform vec2 uFarmFocus;\nvarying vec4 vPlotPaint;\n' + shader.fragmentShader.replace(
          '#include <map_fragment>', [
            '#include <map_fragment>',
            'if (vPlotPaint.z > 0.0) {',
            '  vec3 earth = texture2D(uGardenPigment, vPlotPaint.xy).rgb * vPlotPaint.w;',
            '  vec3 state = texture2D(uFarmSoil, vPlotPaint.xy).rgb;',
            '  earth *= mix(vec3(1.), vec3(.78,.70,.64), state.r);',
            '  earth *= 1.0 - .35 * state.b;',
            '  earth *= mix(vec3(1.), vec3(.47,.50,.55), state.g);',
            '  vec2 offset = (vPlotPaint.xy - uFarmFocus) * vec2(' + GARDEN.width + ',' + GARDEN.depth + ');',
            '  float ring = 1. - smoothstep(.012,.042,abs(length(offset) - .43));',
            '  ring *= smoothstep(.12,.46,abs(offset.x * offset.y) / .097);',
            '  earth = mix(earth, vec3(.83,.68,.37), ring * .60);',
            '  diffuseColor.rgb = mix(diffuseColor.rgb, earth, clamp(vPlotPaint.z,0.,1.));',
            '}'
          ].join('\n'));
    };
    material.customProgramCacheKey = () => previousKey + '|home-garden-field-v1';
    material.needsUpdate = true;
  }

  select(id: number) {
    const p = plantingPlaces[id];
    if (p) this.focus.set(p.u, p.v);
    else this.focus.set(-5, -5);
  }

  paintSoil(plots: PlotState[]) {
    const n = SOIL_STATE_SIZE;
    this.pixels.fill(0);
    for (const p of plantingPlaces) {
      const plot = plots[p.id];
      if (!plot.tilled) continue;
      const rx = .58 / GARDEN.width, ry = .47 / GARDEN.depth;
      for (let y = Math.floor((p.v - ry) * n); y <= Math.ceil((p.v + ry) * n); y++) {
        for (let x = Math.floor((p.u - rx) * n); x <= Math.ceil((p.u + rx) * n); x++) {
          const dx = ((x + .5)/n - p.u) / rx, dy = ((y + .5)/n - p.v) / ry;
          const fray = .055 * Math.sin(dx * 13 + dy * 8 + p.id);
          const mask = 1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dy) + fray, .64, 1);
          const groove = THREE.MathUtils.smoothstep(Math.cos(dy * 15 + dx * 1.4 + .7 * dx * dx), .05, .90);
          const k = (y * n + x) * 4;
          this.pixels[k] = Math.max(this.pixels[k], 255 * mask);
          if (plot.wateredAt) this.pixels[k+1] = Math.max(this.pixels[k+1], 255 * mask);
          this.pixels[k+2] = Math.max(this.pixels[k+2], 255 * groove * mask);
        }
      }
    }
    this.state.needsUpdate = true;
  }

  grow(plots: PlotState[], now: number) {
    const dummy = new THREE.Object3D();
    let leaves = 0, seeds = 0;
    for (const p of plantingPlaces) {
      const stage = cropStage(plots[p.id], now);
      if (stage === 'bare') continue;
      dummy.rotation.set(0, p.id * 2.4, 0);
      if (stage === 'seed') {
        for (let i = 0; i < 3; i++) {
          const angle = i * 2.1 + p.id;
          dummy.position.set(p.x + .054 * Math.cos(angle), .048 + p.height, p.z + .054 * Math.sin(angle));
          dummy.scale.set(.026, .015, .039);
          dummy.updateMatrix();
          this.seeds.setMatrixAt(seeds++, dummy.matrix);
        }
      } else {
        dummy.position.set(p.x, .033 + p.height, p.z);
        dummy.scale.setScalar(stage === 'ripe' ? 1.05 : .47);
        dummy.updateMatrix();
        this.leaves.setMatrixAt(leaves++, dummy.matrix);
      }
    }
    this.leaves.count = leaves;
    this.seeds.count = seeds;
    this.leaves.instanceMatrix.needsUpdate = this.seeds.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.alive = false;
    this.pigment.value.dispose();
    this.state.dispose();
    for (const m of [this.leaves, this.seeds]) { m.geometry.dispose(); m.material.dispose(); m.dispose(); }
  }
}
