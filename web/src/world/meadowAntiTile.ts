import * as THREE from 'three';

/**
 * Large-scale meadow anti-tiling, mobile-first.
 *
 * Earlier the same small painted grass tile repeated every 3.5m across a
 * 160x160m flat world, making highly visible grid bands in the horizon.
 * This changes only the main GRASS shader:
 *   - de-phase/distort world-UV gently (no square-aligned seams);
 *   - blend with one differently oriented/larger sample;
 *   - subtle low-frequency wash with NO dark decals.
 *
 * No image generation, extra plane meshes, additional texture downloads,
 * collision mutations or painting over the image source.
 */
export const MEADOW_ANTI_TILE=Object.freeze({
  worldTileMetres:3.5,
  macroScale:.53,
  imageSamples:2,
  tonalAmplitude:.022,
  version:'meadow-broken-tiling-v3'
});

const FRAGMENT=[
  '#ifdef USE_MAP',
  'vec2 pMeadow=vMeadowWorldXZ;',
  // Smooth warping at 12–27m wavelength means a painted tile never repeats
  // along a straight pixel-perfect grid line across the entire world.
  'vec2 waveMeadow=vec2(',
  ' .20*sin(pMeadow.y*.079+pMeadow.x*.033)',
  ' +.11*sin(pMeadow.y*.183-pMeadow.x*.062),',
  ' .17*sin(pMeadow.x*.094-pMeadow.y*.027)',
  ' +.10*sin(pMeadow.x*.145+pMeadow.y*.075));',
  'vec2 uvFine=vMapUv+waveMeadow;',
  'vec2 uvWide=vec2(',
  ' uvFine.x*.52-uvFine.y*.27+1.23,',
  ' uvFine.x*.27+uvFine.y*.52+.79);',
  'vec3 grassFine=texture2D(map,uvFine).rgb;',
  'vec3 grassBroad=texture2D(map,uvWide).rgb;',
  // Constant two-tap blend is stable and cannot form a hard cell boundary.
  'vec3 paintedMeadow=mix(grassFine,grassBroad,.41);',
  'float colorWash=sin(pMeadow.x*.044+pMeadow.y*.031)',
  ' *sin(pMeadow.y*.063-pMeadow.x*.022);',
  // No splattered dark macro patches — max 2.2 percent variation.
  'paintedMeadow*=1.0+.022*colorWash;',
  'diffuseColor.rgb*=paintedMeadow;',
  '#endif'
].join('\n');

export function applyMeadowAntiTileShader(
  material:THREE.MeshBasicMaterial
):THREE.MeshBasicMaterial{
  if(material.userData.meadowAntiTile)return material;
  if(material.userData.terrainSurface!=='grass' ||
     material.userData.worldUV!==true){
    throw new Error('Anti-tile shader is only for the world-aligned painted meadow');
  }
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.vertexShader='varying vec2 vMeadowWorldXZ;\n'+
      shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n'+
        'vMeadowWorldXZ=(modelMatrix*vec4(transformed,1.0)).xz;');
    shader.fragmentShader='varying vec2 vMeadowWorldXZ;\n'+
      shader.fragmentShader.replace('#include <map_fragment>',FRAGMENT);
  };
  const oldKey=material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey=()=>oldKey()+'|'+MEADOW_ANTI_TILE.version;
  material.userData.meadowAntiTile=true;
  material.userData.meadowImageSamples=MEADOW_ANTI_TILE.imageSamples;
  material.needsUpdate=true;
  return material;
}
