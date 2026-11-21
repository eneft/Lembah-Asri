import * as THREE from 'three';
import { createPaintedTerrainPlane } from './terrainMaterials.ts';
import { makeOrganicGroundMask } from './homeGroundDetails.ts';

/**
 * Fine grounding for one combined GLB (building + stone foundation + soil).
 * Do NOT cut geometry, alphaHash, change UVs or sample a brighter courtyard
 * color onto the foundation. The original house stays fully opaque.
 */
export function featherMergedHouseGround(
  scene: THREE.Object3D, bounds: THREE.Box3
): number {
  const width = bounds.max.x - bounds.min.x;
  const depth = bounds.max.z - bounds.min.z;
  if (!Number.isFinite(width * depth) || width < 0.5 || depth < 0.5) return 0;
  const uvBounds = new THREE.Vector4(
    bounds.min.x, bounds.max.x, bounds.min.z, bounds.max.z
  );
  let adjusted = 0;
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const sources = Array.isArray(object.material) ? object.material : [object.material];
    const materials = sources.map(source => {
      if (!(source instanceof THREE.MeshBasicMaterial)) return source;
      const mat = source.clone();
      mat.alphaHash = false;
      mat.transparent = false;
      mat.depthWrite = true;
      mat.toneMapped = false;
      mat.userData = {
        ...source.userData,
        houseGroundFeather: true,
        groundBlendMode: 'contact-shadow-grounding'
      };
      const previous = source.onBeforeCompile;
      mat.onBeforeCompile = (shader, renderer) => {
        previous.call(source, shader, renderer);
        shader.uniforms.uHouseJoinBounds = { value: uvBounds };
        shader.uniforms.uHouseJoinBottom = { value: bounds.min.y };
        shader.vertexShader = 'varying vec3 vHouseJoinWorld;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n' +
            'vHouseJoinWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;'
          );
        const shadeCode = [
          '#include <map_fragment>',
          '// Darken only the last centimeters at the outer ground boundary.',
          'float xEdge = min(vHouseJoinWorld.x - uHouseJoinBounds.x,',
          '                  uHouseJoinBounds.y - vHouseJoinWorld.x);',
          'float zEdge = min(vHouseJoinWorld.z - uHouseJoinBounds.z,',
          '                  uHouseJoinBounds.w - vHouseJoinWorld.z);',
          'float edgeDistance = max(0.0, min(xEdge, zEdge));',
          'float edgeWeight = 1.0 - smoothstep(0.02, 0.38, edgeDistance);',
          'float lowSoil = 1.0 - smoothstep(',
          '  uHouseJoinBottom + 0.015, uHouseJoinBottom + 0.095,',
          '  vHouseJoinWorld.y);',
          'diffuseColor.rgb *= 1.0 - 0.07 * edgeWeight * lowSoil;'
        ].join('\n');
        shader.fragmentShader =
          'varying vec3 vHouseJoinWorld;\n' +
          'uniform vec4 uHouseJoinBounds;\n' +
          'uniform float uHouseJoinBottom;\n' +
          shader.fragmentShader.replace('#include <map_fragment>', shadeCode);
      };
      mat.customProgramCacheKey = () => 'lembah-house-subtle-grounding-v3';
      mat.needsUpdate = true;
      adjusted++;
      return mat;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
  });
  return adjusted;
}

/**
 * Underlay beneath the model: world-aligned painted dirt fading organically
 * to the existing courtyard texture, with no raised island or hard edge.
 * This is walkable visual detail and adds NO new physics collider.
 */
export function createHouseGroundTransition(
  centerX: number, centerZ: number, houseWidth: number, houseDepth: number
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const soil = createPaintedTerrainPlane(
    'earth', houseWidth + 2.2, houseDepth + 1.8,
    centerX, centerZ, 0.045, true
  );
  soil.name = 'Seamless house footing soil-to-terrain transition';
  soil.material.alphaMap = makeOrganicGroundMask(27, 128);
  soil.material.opacity = 0.18;
  soil.material.depthWrite = false;
  soil.material.polygonOffset = true;
  soil.material.polygonOffsetFactor = -1;
  soil.material.polygonOffsetUnits = -1;
  soil.material.needsUpdate = true;
  soil.renderOrder = 2;
  soil.receiveShadow = false;
  soil.userData.contactTransition = 'ground-under-approved-glb';
  return soil;
}

/** Ground AO without altering the textured house or changing collision.
 * Alpha goes smoothly to zero at every edge; no dark rectangular board.
 * This darkens the front contact strip, under the existing real sun shadows.
 */
export function createHouseContactShadow(
  x: number, z: number, width: number, depth: number
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = (px + 0.5) / size * 2 - 1;
      const v = (py + 0.5) / size * 2 - 1;
      const radius = Math.sqrt(u * u + v * v);
      const t = THREE.MathUtils.clamp((1 - radius) / 0.46, 0, 1);
      const a = Math.round(t * t * (3 - 2 * t) * 255);
      const index = (py * size + px) * 4;
      pixels[index] = 79;
      pixels[index + 1] = 70;
      pixels[index + 2] = 61;
      pixels[index + 3] = a;
    }
  }
  const map = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.minFilter = THREE.LinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.generateMipmaps = false;
  map.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    map, color: '#ffffff', transparent: true,
    opacity: 0.18, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.name = 'Soft foundation ambient contact';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.094, z);
  mesh.renderOrder = 5;
  mesh.castShadow = false;
  mesh.receiveShadow = false; // separate real sun receiver already exists
  mesh.userData.contactTransition = 'opaque-soft-contact-ao';
  return mesh;
}
