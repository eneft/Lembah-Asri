import * as THREE from 'three';

/**
 * Riverbank Painterly V4: visible grass-to-wet-soil ecotone.
 * The previous image repeated every 8 metres with visible hard square edges.
 * This is TWO independently scaled samples of the existing approved albedo,
 * macro colour variations, and a continuous soil/grass/wet cross-section.
 *
 * No extra decal geometry, dark stains or physical collision edits.
 */
export const RIVERBANK_PAINT=Object.freeze({
  detailMetres:7.7,macroMetres:29.3,
  grassyEdgeWidth:.84,wetEdgeStart:.55,imageSamples:2,
  shaderVersion:'riverbank-visible-ecotone-v4'
});

type RiverMaterialStyle='earth-bank'|'grassy-shoulder';

/** Share the painted meadow atlas with the adjacent terrain at the bank lip. */
type MeadowUniforms = {
  texture: { value: THREE.Texture | null };
  loaded: { value: number };
};

export function setRiverbankMeadowTexture(material: THREE.MeshBasicMaterial, texture: THREE.Texture): boolean {
  const uniforms = material.userData.riverbankMeadowUniforms as MeadowUniforms | undefined;
  if (!uniforms) return false;
  uniforms.texture.value = texture;
  uniforms.loaded.value = 1;
  return true;
}

const BANK_FRAGMENT=[
  'float zBank=vRiverBankWorld.y;',
  'float crossBank=clamp(vRiverBankAcross,0.0,1.0);',
  'float slowBank=sin(zBank*.135+vRiverBankWorld.x*.23)*sin(zBank*.047-vRiverBankWorld.x*.19);',
  'float bankWarp=.025*sin(zBank*.21+vRiverBankWorld.x*.10)+.012*sin(zBank*.46-vRiverBankWorld.x*.08);',
  'vec3 bankPigment=vec3(.94,.93,.87);',
  '#ifdef USE_MAP',
  'vec2 bankDetailUV=vec2(clamp(crossBank+bankWarp,.015,.985),',
  '  zBank/7.7+.09*sin(zBank*.09+vRiverBankWorld.x*.10));',
  'vec2 bankMacroUV=vec2(clamp(crossBank*.82+.09-bankWarp*.65,.015,.985),',
  '  zBank/29.3+.37+.09*sin(zBank*.045+vRiverBankWorld.x*.16));',
  'vec3 bankDetail=texture2D(map,bankDetailUV).rgb;',
  'vec3 bankMacro=texture2D(map,bankMacroUV).rgb;',
  'bankPigment=mix(bankDetail,bankMacro,.31+.06*sin(zBank*.068+vRiverBankWorld.x*.15));',
  '#endif',
  '// Continuous grass lip, exposed middle soil, slightly damp foot.',
  // Moss from grassy shoulder spreads unevenly down the earthen slope.
  // No single dark line, no square decals and no repeated stamp pattern.
  'float mossWave=.085*sin(zBank*.24+sin(zBank*.091)*1.3)',
  ' +.045*sin(zBank*.55-vRiverBankWorld.x*.24);',
  'float bankGrass=1.0-smoothstep(.07,.63,crossBank+mossWave);',
  'vec3 greenLip=vec3(.46,.52,.31);',
  'bankPigment=mix(bankPigment,greenLip,bankGrass*.58);',
  'float bankDamp=smoothstep(.64,.97,crossBank);',
  'bankPigment*=mix(vec3(1.0),vec3(.88,.91,.87),bankDamp*.28);',
  'bankPigment*=1.0+.024*slowBank;',
  '// This bank rises above the water for about half its cross section.',
  '// The old .34-wide lip weld coloured only the hidden crest: the visible',
  '// part remained a uniformly brown stripe. Extend the real meadow over',
  '// the exposed upper slope, irregularly feathering into damp bank soil.',
  'float edgeFlow=.085*sin(zBank*.43+.5*sin(zBank*.14))',
  '  +.047*sin(zBank*1.34-vRiverBankWorld.x*.21);',
  'float meadowCover=1.0-smoothstep(.42,.84,crossBank+edgeFlow);',
  'if(uRiverMeadowLoaded>.5 && meadowCover>.001){',
  '  vec2 pMeadow=vRiverBankWorld;',
  '  vec2 waveMeadow=vec2(',
  '    .20*sin(pMeadow.y*.079+pMeadow.x*.033)+.11*sin(pMeadow.y*.183-pMeadow.x*.062),',
  '    .17*sin(pMeadow.x*.094-pMeadow.y*.027)+.10*sin(pMeadow.x*.145+pMeadow.y*.075));',
  '  vec2 uvFine=pMeadow/3.5+waveMeadow;',
  '  vec2 uvWide=vec2(uvFine.x*.52-uvFine.y*.27+1.23,',
  '    uvFine.x*.27+uvFine.y*.52+.79);',
  '  vec3 meadowFine=texture2D(uRiverMeadow,uvFine).rgb;',
  '  vec3 meadowWide=texture2D(uRiverMeadow,uvWide).rgb;',
  '  vec3 meadowPigment=mix(meadowFine,meadowWide,.41);',
  '  float colorWash=sin(pMeadow.x*.044+pMeadow.y*.031)',
  '    *sin(pMeadow.y*.063-pMeadow.x*.022);',
  '  meadowPigment*=1.0+.022*colorWash;',
  '  bankPigment=mix(bankPigment,meadowPigment,meadowCover);',
  '}',
  'diffuseColor.rgb*=bankPigment;'
].join('\n');

const SHOULDER_FRAGMENT=[
  'vec3 paintedGrass=vec3(1.0);',
  'float grassWorld=vRiverGrassWorld.y;',
  '#ifdef USE_MAP',
  // Use EXACTLY the same sampling and gentle color wash as the main meadow.
  // This prevents a hard texture band at the new 3D shoulder-to-ground seam.
  'vec2 pMeadow=vRiverGrassWorld;',
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
  'paintedGrass=mix(grassFine,grassBroad,.41);',
  'float colorWash=sin(pMeadow.x*.044+pMeadow.y*.031)',
  ' *sin(pMeadow.y*.063-pMeadow.x*.022);',
  'paintedGrass*=1.0+.022*colorWash;',
  '#endif',
  // Only a faint organic green lip; never revive the deleted dark stains.
  'float innerBank=1.0-smoothstep(.02,.44,vRiverGrassAcross);',
  'paintedGrass=mix(paintedGrass,paintedGrass*vec3(.99,1.0,.98),innerBank*.10);',
  'diffuseColor.rgb*=paintedGrass;'
].join('\n');

/** Apply a composable shader extension to MeshBasicMaterial. */
export function applyRiverbankPainterlyShader(
  material:THREE.MeshBasicMaterial,
  style:RiverMaterialStyle
):THREE.MeshBasicMaterial{
  if(material.userData.riverbankPainterlyStyle===style)return material;
  if(material.userData.riverbankPainterlyStyle){
    throw new Error('Cannot apply two riverbank painterly styles to one material');
  }
  const previous=material.onBeforeCompile;
  const isBank=style==='earth-bank';
  const world=isBank?'vRiverBankWorld':'vRiverGrassWorld';
  const across=isBank?'vRiverBankAcross':'vRiverGrassAcross';
  const meadowUniforms: MeadowUniforms = {
    texture: { value: null }, loaded: { value: 0 }
  };
  if (isBank) material.userData.riverbankMeadowUniforms = meadowUniforms;
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.vertexShader='varying vec2 '+world+';\nvarying float '+across+';\n'+
      shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n'+
        world+'=(modelMatrix*vec4(transformed,1.0)).xz;\n'+
        across+'=uv.x;');
    if (isBank) {
      shader.uniforms.uRiverMeadow = meadowUniforms.texture;
      shader.uniforms.uRiverMeadowLoaded = meadowUniforms.loaded;
    }
    shader.fragmentShader=(isBank
      ? 'uniform sampler2D uRiverMeadow;\nuniform float uRiverMeadowLoaded;\n'
      : '')+'varying vec2 '+world+';\nvarying float '+across+';\n'+
      shader.fragmentShader.replace('#include <map_fragment>',
        isBank?BANK_FRAGMENT:SHOULDER_FRAGMENT);
  };
  const oldKey=material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey=()=>
    oldKey()+'|'+RIVERBANK_PAINT.shaderVersion+'|'+style;
  material.userData.riverbankPainterlyStyle=style;
  material.userData.riverbankTwoScaleUV=true;
  material.userData.macroVariationMetres=RIVERBANK_PAINT.macroMetres;
  material.needsUpdate=true;
  return material;
}
