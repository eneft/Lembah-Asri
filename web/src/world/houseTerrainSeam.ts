import * as THREE from 'three';
import { createPaintedTerrainPlane } from './terrainMaterials.ts';
import { makeOrganicGroundMask } from './homeGroundDetails.ts';

/**
 * The approved rumah_utama.glb is ONE combined mesh, including its brown
 * soil skirt, steps, plants, stones, roof and walls. Never hide or cut that
 * mesh: doing so would erase the whole authored house.
 *
 * Fade ONLY near-ground fragments at its outer footprint, using hashed alpha
 * cutout (opaque render queue, depth-writing preserved). High parts of the
 * house stay perfectly opaque. The feather reveals a continuous painted
 * world-UV soil-to-courtyard transition below the original asset.
 *
 * This is an in-place material adjustment, not a modified source GLB.
 */
export function featherMergedHouseGround(
  scene: THREE.Object3D,
  bounds: THREE.Box3
): number {
  const width = bounds.max.x - bounds.min.x;
  const depth = bounds.max.z - bounds.min.z;
  if (!Number.isFinite(width * depth) || width < 0.5 || depth < 0.5) return 0;

  const boundsUniform = new THREE.Vector4(
    bounds.min.x, bounds.max.x, bounds.min.z, bounds.max.z
  );
  let adjusted = 0;
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const mapped = materials.map(source => {
      // Applies to the hand-painted MeshBasicMaterial. MeshStandardMaterial,
      // multi-pass materials and special shader assets remain untouched.
      if (!(source instanceof THREE.MeshBasicMaterial)) return source;
      const material = source.clone();
      // alphaHash dither-discard works in the opaque queue and preserves
      // depth, unlike transparent=true which would break the merged roof.
      material.alphaHash = true;
      material.depthWrite = true;
      material.transparent = false;
      material.toneMapped = false;
      material.userData = {...source.userData, houseGroundFeather: true};
      const originalHook = source.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        originalHook.call(source, shader, renderer);
        shader.uniforms.uHouseJoinBounds = {value: boundsUniform};
        shader.uniforms.uHouseJoinBottom = {value: bounds.min.y};
        shader.vertexShader = 'varying vec3 vHouseJoinWorld;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n' +
            'vHouseJoinWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;'
          );
        shader.fragmentShader =
          'varying vec3 vHouseJoinWorld;\n' +
          'uniform vec4 uHouseJoinBounds;\n' +
          'uniform float uHouseJoinBottom;\n' +
          shader.fragmentShader.replace(
            '#include <alphahash_fragment>',
            [
              '// Natural, shallow feather along the original ground skirt.',
              'float xEdge = min(vHouseJoinWorld.x - uHouseJoinBounds.x,',
              '                  uHouseJoinBounds.y - vHouseJoinWorld.x);',
              'float zEdge = min(vHouseJoinWorld.z - uHouseJoinBounds.z,',
              '                  uHouseJoinBounds.w - vHouseJoinWorld.z);',
              'float border = min(xEdge, zEdge);',
              'float contour = 0.065 * sin(vHouseJoinWorld.x * 2.73 + vHouseJoinWorld.z * 1.49)',
              '  + 0.032 * sin(vHouseJoinWorld.x * 7.13 - vHouseJoinWorld.z * 3.31);',
              'float seamWeight = smoothstep(0.01, 1.52, border + contour);',
              '// Preserve foliage, masonry, the steps and the rest of the house.',
              'float groundWeight = 1.0 - smoothstep(',
              '  uHouseJoinBottom + 0.17, uHouseJoinBottom + 0.62,',
              '  vHouseJoinWorld.y);',
              'diffuseColor.a *= mix(1.0, seamWeight, groundWeight);',
              '#include <alphahash_fragment>'
            ].join('\n')
          );
      };
      material.customProgramCacheKey = () => 'lembah-house-ground-feather-v1';
      material.needsUpdate = true;
      adjusted++;
      return material;
    });
    object.material = Array.isArray(object.material) ? mapped : mapped[0];
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
    'earth', houseWidth + 4.6, houseDepth + 4.6,
    centerX, centerZ, 0.051, true
  );
  soil.name = 'Seamless house footing soil-to-terrain transition';
  soil.material.alphaMap = makeOrganicGroundMask(27, 128);
  soil.material.opacity = 0.44;
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
