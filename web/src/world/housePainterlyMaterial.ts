import { applyPaintedPigment } from './paintedPigment.ts';
import * as THREE from 'three';

/** Non-PBR diffuse shader: authored UV color, soft light, real shadow reception. */
export function createHousePainterlyMaterial(source: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    map: source.map, color: source.color.clone(), side: source.side,
    transparent: source.transparent, opacity: source.opacity,
    alphaMap: source.alphaMap, alphaTest: source.alphaTest,
    vertexColors: source.vertexColors, depthTest: source.depthTest,
    depthWrite: source.depthWrite, toneMapped: false
  });
  material.userData.housePainterlyShader = 'house-diffuse-painterly-v1';
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      'outgoingLight = mix(diffuseColor.rgb, outgoingLight, 0.38);\n#include <opaque_fragment>'
    );
  };
  material.customProgramCacheKey = () => 'house-diffuse-painterly-v1';
  return applyPaintedPigment(material);
}
