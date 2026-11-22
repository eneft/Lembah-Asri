import * as THREE from 'three';

/**
 * Riverbank Painterly V2.
 * The previous image repeated every 8 metres with visible hard square edges.
 * This is TWO independently scaled samples of the existing approved albedo,
 * macro colour variations, and a continuous soil/grass/wet cross-section.
 *
 * No extra decal geometry, dark stains or physical collision edits.
 */
export const RIVERBANK_PAINT=Object.freeze({
  detailMetres:7.7,macroMetres:29.3,
  grassyEdgeWidth:.34,wetEdgeStart:.55,imageSamples:2,
  shaderVersion:'riverbank-painterly-macro-v2'
});

type RiverMaterialStyle='earth-bank'|'grassy-shoulder';

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
  'float bankGrass=1.0-smoothstep(.045,.34,crossBank+.035*slowBank);',
  'vec3 greenLip=vec3(.26,.37,.16);',
  'bankPigment=mix(bankPigment,greenLip,bankGrass*.80);',
  'float bankDamp=smoothstep(.55,.96,crossBank);',
  'bankPigment*=mix(vec3(1.0),vec3(.81,.86,.84),bankDamp*.37);',
  'bankPigment*=1.0+.038*slowBank;',
  'diffuseColor.rgb*=bankPigment;'
].join('\n');

const SHOULDER_FRAGMENT=[
  'vec3 paintedGrass=vec3(1.0);',
  'float grassWorld=vRiverGrassWorld.y;',
  'float grassSlow=sin(grassWorld*.13+vRiverGrassWorld.x*.20)*sin(grassWorld*.051-vRiverGrassWorld.x*.18);',
  '#ifdef USE_MAP',
  '// UV1 stays globally aligned, the macro sample quietly breaks rigid tiles.',
  'vec2 uvMeadow=vMapUv;',
  'vec2 uvBroad=vec2(uvMeadow.x*.267+.23,uvMeadow.y*.267+.41);',
  'vec3 detailMeadow=texture2D(map,uvMeadow).rgb;',
  'vec3 broadMeadow=texture2D(map,uvBroad).rgb;',
  'paintedGrass=mix(detailMeadow,broadMeadow,.24);',
  '#endif',
  'float innerBank=1.0-smoothstep(.08,.51,vRiverGrassAcross);',
  'paintedGrass=mix(paintedGrass,paintedGrass*vec3(.96,.98,.91),innerBank*.16);',
  'paintedGrass*=1.0+.031*grassSlow;',
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
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.vertexShader='varying vec2 '+world+';\nvarying float '+across+';\n'+
      shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n'+
        world+'=(modelMatrix*vec4(transformed,1.0)).xz;\n'+
        across+'=uv.x;');
    shader.fragmentShader='varying vec2 '+world+';\nvarying float '+across+';\n'+
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
