import * as THREE from 'three';
import { createPaintedTerrainPlane } from './terrainMaterials.ts';
import { makeOrganicGroundMask } from './homeGroundDetails.ts';

/**
 * The approved house GLB contains the building, steps, and soil skirt in one
 * textured mesh. The previous alphaHash shader made pinhole-like black/brown
 * dots around the foundation as it discarded ground fragments.
 *
 * Keep every triangle fully opaque and depth-writing. Only tint the last few
 * centimeters of the outer soil skirt toward the exact same hand-painted
 * courtyard image seen underneath, sampling that image at world UVs. This
 * avoids stipple, depth-sort artefacts, and any edit to the approved GLB.
 */
export function featherMergedHouseGround(
  scene: THREE.Object3D, bounds: THREE.Box3,
  courtyardAlbedo?: THREE.Texture
): number {
  const width = bounds.max.x - bounds.min.x;
  const depth = bounds.max.z - bounds.min.z;
  if (!Number.isFinite(width * depth) || width < 0.5 || depth < 0.5) return 0;

  // The visible painted courtyard is a 32 x 29 m rectangle whose
  // lower-left world X and upper world Z are -45 and 14.9 respectively.
  // Reuse its color image, not its alpha edge mask or a made-up flat color.
  const worldUVRect = new THREE.Vector4(-45, 14.9, 1 / 32, 1 / 29);
  const fallback = new THREE.DataTexture(
    new Uint8Array([188, 168, 129, 255]), 1, 1, THREE.RGBAFormat
  );
  fallback.colorSpace = THREE.SRGBColorSpace;
  fallback.needsUpdate = true;
  const paintTexture = courtyardAlbedo ?? fallback;
  const boundsUniform = new THREE.Vector4(
    bounds.min.x, bounds.max.x, bounds.min.z, bounds.max.z
  );

  let adjusted = 0;
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const mapped = materials.map(source => {
      if (!(source instanceof THREE.MeshBasicMaterial)) return source;
      const material = source.clone();
      material.alphaHash = false;
      material.transparent = false;
      material.depthWrite = true;
      material.toneMapped = false;
      material.userData = { ...source.userData, houseGroundFeather: true, groundBlendMode: 'opaque-color-match' };
      const originalHook = source.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        originalHook.call(source, shader, renderer);
        shader.uniforms.uHouseJoinBounds = { value: boundsUniform };
        shader.uniforms.uHouseJoinBottom = { value: bounds.min.y };
        shader.uniforms.uHouseCourtyardMap = { value: paintTexture };
        shader.uniforms.uHouseCourtyardRect = { value: worldUVRect };
        shader.vertexShader = 'varying vec3 vHouseJoinWorld;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n' +
            'vHouseJoinWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;'
          );
        const paintGround = [
          '#include <map_fragment>',
          '// Match the existing painted courtyard at the original soil edge.',
          'float xEdge = min(vHouseJoinWorld.x - uHouseJoinBounds.x,',
          '                  uHouseJoinBounds.y - vHouseJoinWorld.x);',
          'float zEdge = min(vHouseJoinWorld.z - uHouseJoinBounds.z,',
          '                  uHouseJoinBounds.w - vHouseJoinWorld.z);',
          'float edgeDistance = max(0.0, min(xEdge, zEdge));',
          'float contour = 0.045 * sin(vHouseJoinWorld.x * 2.7 + vHouseJoinWorld.z * 1.5);',
          'float boundaryBlend = 1.0 - smoothstep(0.03, 1.22, edgeDistance + contour);',
          '// The house, wood, steps and stone foundation remain unchanged.',
          'float lowSoilOnly = 1.0 - smoothstep(',
          '  uHouseJoinBottom + 0.07, uHouseJoinBottom + 0.25,',
          '  vHouseJoinWorld.y);',
          'vec2 courtyardUV = clamp(vec2(',
          '  (vHouseJoinWorld.x - uHouseCourtyardRect.x) * uHouseCourtyardRect.z,',
          '  (uHouseCourtyardRect.y - vHouseJoinWorld.z) * uHouseCourtyardRect.w',
          '), vec2(0.001), vec2(0.999));',
          'vec3 paintedSoil = texture2D(uHouseCourtyardMap, courtyardUV).rgb;',
          'diffuseColor.rgb = mix(diffuseColor.rgb, paintedSoil,',
          '  boundaryBlend * lowSoilOnly);'
        ].join('\n');
        shader.fragmentShader =
          'varying vec3 vHouseJoinWorld;\n' +
          'uniform vec4 uHouseJoinBounds;\n' +
          'uniform float uHouseJoinBottom;\n' +
          'uniform sampler2D uHouseCourtyardMap;\n' +
          'uniform vec4 uHouseCourtyardRect;\n' +
          shader.fragmentShader.replace('#include <map_fragment>', paintGround);
      };
      material.customProgramCacheKey = () => 'lembah-house-opaque-color-join-v2';
      material.needsUpdate = true;
      adjusted++;
      return material;
    });
    object.material = Array.isArray(object.material) ? mapped : mapped[0];
  });
  if (!adjusted) fallback.dispose();
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
