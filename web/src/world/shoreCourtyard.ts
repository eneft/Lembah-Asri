import * as THREE from 'three';
import { ensureWarmGrassGLSL } from './grassPalette.ts';

/**
 * Match the real childhood-courtyard albedo and its irregular alpha feather
 * wherever the 3D river shoulder overlaps the 32x29m courtyard plane.
 * The rest of the stream still uses its original meadow/wet-bank materials.
 * This is a material-only patch: no geometry, collision or farming changes.
 */
const shoreline = [
  { name:'West bank sculpted meadow terrain', pigment:'paintedGrass', world:'vRiverGrassWorld', mask:'1.0' },
  { name:'East bank sculpted meadow terrain', pigment:'paintedGrass', world:'vRiverGrassWorld', mask:'1.0' },
  { name:'Soft west creek bank', pigment:'bankPigment', world:'vRiverBankWorld', mask:'meadowCover' },
  { name:'Soft east creek bank', pigment:'bankPigment', world:'vRiverBankWorld', mask:'meadowCover' }
] as const;

/** Each prepared material inherits the source UV0 exactly. The extra
 * transparent sample is evaluated only for shore fragments in the clearing. */
export function applyCreekCourtyardAlbedo(root:THREE.Object3D, painted:THREE.Mesh):number {
  if(!(painted.material instanceof THREE.MeshBasicMaterial))return 0;
  const image=painted.material.map, alpha=painted.material.alphaMap;
  if(!image || !alpha)return 0;
  if(!(painted.geometry instanceof THREE.PlaneGeometry))return 0;
  const bounds=new THREE.Vector4(
    painted.position.x,painted.position.z,
    painted.geometry.parameters.width,painted.geometry.parameters.height
  );
  let matched=0;
  for(const part of shoreline){
    const mesh=root.getObjectByName(part.name);
    if(!(mesh instanceof THREE.Mesh) || !(mesh.material instanceof THREE.MeshBasicMaterial))continue;
    const material=mesh.material;
    if(material.userData.creekCourtyardAlbedo===true)continue;
    const previous=material.onBeforeCompile;
    const oldKey=material.customProgramCacheKey.bind(material);
    const end='diffuseColor.rgb*='+part.pigment+';';
    const injection=[
      'vec2 homeUv=vec2(',
      ' .5+('+part.world+'.x-uCreekHomeRect.x)/uCreekHomeRect.z,',
      ' .5-('+part.world+'.y-uCreekHomeRect.y)/uCreekHomeRect.w);',
      'if(homeUv.x>0.0 && homeUv.x<1.0 && homeUv.y>0.0 && homeUv.y<1.0){',
      ' float homeMix=texture2D(uCreekHomeMask,homeUv).g * '+part.mask+';',
      ' if(homeMix>.001){',
      '  '+part.pigment+'=mix('+part.pigment+',lembahWarmGrass(texture2D(uCreekHomePaint,homeUv).rgb),homeMix);',
      ' }',
      '}'
    ].join('\n');
    material.onBeforeCompile=(shader,renderer)=>{
      previous.call(material,shader,renderer);
      shader.uniforms.uCreekHomePaint={value:image};
      shader.uniforms.uCreekHomeMask={value:alpha};
      shader.uniforms.uCreekHomeRect={value:bounds};
      shader.fragmentShader=ensureWarmGrassGLSL(
        'uniform sampler2D uCreekHomePaint;\n'+
        'uniform sampler2D uCreekHomeMask;\n'+
        'uniform vec4 uCreekHomeRect;\n'+
        shader.fragmentShader.replace(end,injection+'\n'+end));
    };
    material.customProgramCacheKey=()=>oldKey()+'|shore-shared-courtyard-v5|'+part.pigment;
    material.userData.creekCourtyardAlbedo=true;
    material.needsUpdate=true;
    matched++;
  }
  return matched;
}
