import * as THREE from 'three';

/**
 * Lembah Asri Stage 1: one softened, warm green pigment for every painted
 * meadow. Only green-dominant pixels are harmonized: bare earth, dry paths,
 * stones, crop soil and all water keep their original authored albedo.
 *
 * All shader values are linear RGB after Three.js decodes the sRGB images.
 * The painterly brush texture, world UV, alpha feather and geometry stay.
 */
export const WARM_GRASS_STYLE=Object.freeze({
  version:'olive-jade-pigment-v2',
  shadow:'#78934f',
  meadow:'#98b66a',
  highlight:'#c0cd81',
  greenOnly:true,
  originalTexturesPreserved:true
});

export const WARM_GRASS_GLSL=[
  'vec3 lembahWarmGrass(vec3 grassPigment) {',
  '  // Brown/ochre paths are red-dominant and pass through untouched.',
  '  float greenMask=smoothstep(-.055,.10,grassPigment.g-grassPigment.r)',
  '    *smoothstep(.035,.15,grassPigment.g-grassPigment.b);',
  '  float value=dot(grassPigment,vec3(.26,.65,.09));',
  // Grade by painted luminance so shaded leaves stay jade and the lit
  // brush marks pick up the olive warmth of the meadow.
  '  float lit=smoothstep(.08,.52,value);',
  '  vec3 pigmentRatio=mix(vec3(.70,1.12,.66),vec3(1.06,1.07,.53),lit);',
  '  vec3 target=value*pigmentRatio/dot(pigmentRatio,vec3(.26,.65,.09));',
  '  vec3 softened=mix(grassPigment,target,.64);',
  '  return mix(grassPigment,softened,clamp(greenMask*.76,0.0,1.0));',
  '}'
].join('\n');

/** Avoid defining a global GLSL function twice in stacked material hooks. */
export function ensureWarmGrassGLSL(fragmentShader:string):string{
  return fragmentShader.includes('vec3 lembahWarmGrass(')
    ? fragmentShader : WARM_GRASS_GLSL+'\n'+fragmentShader;
}

/**
 * Installed AFTER GardenSurface.bind and BEFORE applyRiversidePaint.
 * The injected color grade is directly after the authored courtyard map,
 * so the farm soil overlay is subsequently applied WITHOUT green grading.
 */
export function applyGreenPigment(material:THREE.MeshBasicMaterial):void{
  if(material.userData.warmGrassStyle===WARM_GRASS_STYLE.version)return;
  const previous=material.onBeforeCompile;
  const originalKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.fragmentShader=ensureWarmGrassGLSL(
      shader.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\ndiffuseColor.rgb=lembahWarmGrass(diffuseColor.rgb);')
    );
  };
  material.customProgramCacheKey=()=>originalKey()+'|'+WARM_GRASS_STYLE.version+'|green-pigment';
  material.userData.warmGrassStyle=WARM_GRASS_STYLE.version;
  material.needsUpdate=true;
}

export { applyGreenPigment as applyWarmCourtyardGrass };
