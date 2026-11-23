import * as THREE from 'three';
import { creekCourseGLSL } from './creekCourse.ts';

const meadow = { value: null as THREE.Texture | null };
const cobbles = { value: null as THREE.Texture | null };
const soil = { value: null as THREE.Texture | null };
const hasMeadow = { value: 0 };
const hasCobbles = { value: 0 };
const hasSoil = { value: 0 };
let loading: Promise<void> | undefined;

export function loadRiversidePaint(): Promise<void> {
  if (loading) return loading;
  const loader = new THREE.TextureLoader();
  async function load(file: string, target: typeof meadow, ready: typeof hasMeadow) {
    if (target.value) return;
    try {
      const image = await loader.loadAsync('./textures/terrain/' + file);
      image.colorSpace = THREE.SRGBColorSpace;
      image.wrapS = image.wrapT = THREE.MirroredRepeatWrapping;
      image.anisotropy = 4;
      image.needsUpdate = true;
      target.value = image;
      ready.value = 1;
    } catch (error) {
      console.warn('[LembahAsri] Keeping fallback for ' + file, error);
    }
  }
  loading = Promise.all([
    load('creek_meadow.webp', meadow, hasMeadow),
    load('creek_cobbles.webp', cobbles, hasCobbles),
    // Same actual authored hand-painted soil already used by the village.
    // Do not project giant riverbed cobbles onto a near-vertical riverbank.
    load('soil_handpainted.webp', soil, hasSoil)
  ]).then(() => {
    if (!hasMeadow.value || !hasCobbles.value || !hasSoil.value) loading = undefined;
  });
  return loading;
}

const grassPaint = `
  vec2 p=vRiversidePosition.xz;
  // Skip the bank samples outside the river valley, including the crop beds.
  if (uMeadowReady>.5 && abs(p.x+46.)<17.) {
    vec2 course=creekCourse(p.y);
    float inland=abs(p.x-course.x)-course.y;
    float reach=1.-smoothstep(5.8,11.4,inland+.95*sin(p.y*.31+p.x*.11));
    if (reach>.001) {
      vec2 bend=vec2(sin(p.y*.47+p.x*.33),sin(p.x*.35-p.y*.43));
      vec2 uv=mat2(.93,.37,-.37,.93)*p*.255+.095*bend;
      vec3 blades=texture2D(uBankMeadow,uv).rgb;
      vec3 broad=texture2D(uBankMeadow,mat2(.61,-.79,.79,.61)*uv*.57+.38).rgb;
      float light=.51+.26*sin(p.x*.67+p.y*.31)+.23*sin(p.y*.68-p.x*.49);
      vec3 lawn=mix(blades,broad,.20)*mix(vec3(.71,.81,.77),vec3(1.11,1.04,.91),light);
      // The path keeps the recent curved outline and warm earth pigment.
      float brush=light;
      float pigment=dot(blades,vec3(.23,.65,.12));
      // A worn walk winds from the courtyard to the bridge. Individual grass
      // strokes and irregular edges show through instead of a rectangular decal.
      float east=p.x-course.x;
      float trailZ=8.6+.72*sin(max(east-1.,0.)*.37)
        +1.35*smoothstep(4.,10.,east)+.16*sin(p.x*3.+p.y*1.7);
      float wear=(1.-smoothstep(.19,1.14,abs(p.y-trailZ)+pigment*.32))
                 *smoothstep(1.35,2.6,abs(east))*(1.-smoothstep(6.8,10.,abs(east)));
      // Narrow worn earth curls from bridge into the yard, with irregular,
      // feathered edges; soil is warm tan rather than a dark brown rectangle.
      float pathBrush=.77+.13*sin(p.x*3.1-p.y*2.7)+.10*sin(p.y*8.+p.x*1.6);
      vec3 earth=mix(vec3(.36,.245,.115),vec3(.73,.55,.315),clamp(.32+.93*pigment+.12*brush,0.,1.));
      lawn=mix(lawn,earth,clamp(wear*pathBrush,0.,.94));
      diffuseColor.rgb=mix(diffuseColor.rgb,lawn,reach*grassCover);
    }
  }`;

// The waterbed keeps its original rock atlas; it is horizontal, so no
// elongated vertical stones. Rock graphics must NOT be mapped onto the bank.
const stonePaint = `
  if (uCobblesReady>.5) {
    vec2 p=vRiversidePosition.xz;
    vec2 uv=mat2(.87,-.49,.49,.87)*p*.47+vec2(.072*sin(p.y*.64),.060*sin(p.x*.87));
    uv.y+=vRiversidePosition.y*.42;
    vec3 stone=texture2D(uBankCobbles,uv).rgb;
    float dry=smoothstep(-.23,.045,vRiversidePosition.y);
    vec3 wetStone=stone*mix(vec3(.49,.69,.64),vec3(.94,.88,.72),dry);
    diffuseColor.rgb=mix(diffuseColor.rgb,wetStone,stoneCover);
  }`;

/** The bank is an eroded EARTH slope, not a vertically stretched cobble bed.
 * Two independently warped world-space soil samples break up repetition.
 * Angular, embedded tiny fragments and delicate roots are procedural masks
 * only; no new geometry, colliders, stones or expensive texture assets.
 */
const naturalBankPaint = `
  vec2 bankXZ=vRiversidePosition.xz;
  float bankAcross=clamp(vRiversideAcross,0.,1.);
  float slowSilt=sin(bankXZ.y*.18+sin(bankXZ.x*.07))*
                 sin(bankXZ.y*.071-bankXZ.x*.12);
  vec2 bankWarp=vec2(
    .14*sin(bankXZ.y*.29+bankXZ.x*.13)+.06*sin(bankXZ.y*.97),
    .17*sin(bankXZ.y*.19-bankXZ.x*.16)+.04*sin(bankXZ.y*1.34));
  // The second UV is rotated and runs at an unrelated scale: there are
  // no 8-metre squares or strips of repeated oval boulders.
  vec2 soilUV=vec2(bankXZ.y*.245,vRiversidePosition.y*1.65+bankXZ.x*.10)+bankWarp;
  vec2 soilMacro=mat2(.77,-.64,.64,.77)*soilUV*.39+vec2(1.19,.43);
  vec3 bankEarth=vec3(.70,.575,.43);
  if (uBankSoilReady>.5) {
    vec3 fineSoil=texture2D(uBankSoil,soilUV).rgb;
    vec3 broadSoil=texture2D(uBankSoil,soilMacro).rgb;
    bankEarth=mix(fineSoil,broadSoil,.34);
  }
  // Warmer exposed soil, mottled with eroded silt. The damp foot is subtle
  // olive-grey, never a dark painted line or a solid grey stone wall.
  float silt=.55+.24*sin(bankXZ.y*.63+bankAcross*7.1)
              +.21*sin(bankXZ.y*1.41-bankAcross*13.3+bankWarp.x*3.0);
  bankEarth*=mix(vec3(.87,.91,.86),vec3(1.07,1.01,.90),
                 clamp(.5+.5*slowSilt,0.,1.));
  bankEarth=mix(bankEarth,bankEarth*vec3(.86,.91,.83),
                smoothstep(.62,.97,bankAcross)*.37);
  bankEarth*=.95+.09*clamp(silt,0.,1.);
  // Thin uneven moss and grass roots descend from the upper lip.
  float mossHeight=.32+.055*sin(bankXZ.y*.48)+.045*sin(bankXZ.y*1.19);
  float moss=1.-smoothstep(mossHeight-.10,mossHeight+.13,bankAcross);
  float mossDapple=.68+.17*sin(bankXZ.y*1.7+bankAcross*9.)*
                             sin(bankXZ.y*3.2-bankAcross*13.);
  bankEarth=mix(bankEarth,vec3(.37,.45,.28),moss*.26*mossDapple);
  // Sparse short bark-brown root threads: staggered rather than a repeating
  // full-length vertical stripe or a continuous dark contour line.
  float rootColumn=floor(bankXZ.y*1.37);
  float rootSeed=fract(sin(rootColumn*91.71+bankXZ.x*.53)*43758.5453);
  float rootLine=fract(bankXZ.y*1.37)-(.22+.48*rootSeed)
    -.045*sin(bankAcross*14.+rootSeed*6.283);
  float roots=(1.-smoothstep(.009,.040,abs(rootLine)))*
    step(.78,rootSeed)*smoothstep(.12,.24,bankAcross)*
    (1.-smoothstep(.45,.72,bankAcross));
  bankEarth=mix(bankEarth,vec3(.42,.37,.26),roots*.30);
  // A few *small angular* embedded mineral fragments near the wet base,
  // not giant round stones stretched along the whole vertical cliff.
  vec2 chipGrid=vec2(bankXZ.y*.55,bankAcross*3.1+.16*sin(bankXZ.y*.34));
  vec2 cell=floor(chipGrid);
  vec2 local=fract(chipGrid);
  float chipSeed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
  vec2 q=(local-vec2(.28+.40*fract(chipSeed*3.7),
                     .33+.32*fract(chipSeed*7.1)))*
                      vec2(1.12,1.48);
  float faceted=max(max(abs(q.x)*.92,abs(q.y)*1.07),
                    abs(q.x*.70-q.y*.51));
  faceted+=.015*sin(local.x*22.+chipSeed*11.)*sin(local.y*19.);
  float chips=(1.-smoothstep(.15,.23,faceted))*
    step(.81,chipSeed)*smoothstep(.51,.72,bankAcross);
  vec3 embeddedRock=mix(vec3(.44,.45,.38),vec3(.64,.59,.48),
                        fract(chipSeed*8.73));
  bankEarth=mix(bankEarth,embeddedRock,chips*.64);
  // Keep the already-approved grass lip and terrain seam visible; soil
  // takes over gently on the exposed bank and never colors the meadow top.
  float exposed=smoothstep(.17,.48,bankAcross);
  diffuseColor.rgb=mix(diffuseColor.rgb,bankEarth,exposed*.97);
`;

type Surface = 'meadow' | 'bank' | 'bed';

// Pigment is composed after the underlying world/courtyard/shore albedos and
// before vertex shading and alpha masks. All four surfaces meet in world space.
export function applyRiversidePaint(material: THREE.MeshBasicMaterial, surface: Surface): void {
  const compile = material.onBeforeCompile;
  const priorKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    const varying = 'varying vec3 vRiversidePosition;\n' +
      (surface === 'bank' ? 'varying float vRiversideAcross;\n' : '');
    shader.vertexShader = varying + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvRiversidePosition=(modelMatrix*vec4(transformed,1.)).xyz;' +
        (surface === 'bank' ? '\nvRiversideAcross=uv.x;' : ''));
    let declarations = varying;
    let paint = '';
    if (surface === 'bed') {
      // The actual flat underwater gravel bed is unchanged.
      shader.uniforms.uBankCobbles = cobbles;
      shader.uniforms.uCobblesReady = hasCobbles;
      declarations += 'uniform sampler2D uBankCobbles;\nuniform float uCobblesReady;\n';
      paint += 'float stoneCover=1.;' + stonePaint;
    }
    if (surface === 'bank') {
      shader.uniforms.uBankSoil = soil;
      shader.uniforms.uBankSoilReady = hasSoil;
      declarations += 'uniform sampler2D uBankSoil;\nuniform float uBankSoilReady;\n';
      paint += naturalBankPaint;
    }
    if (surface !== 'bed') {
      shader.uniforms.uBankMeadow = meadow;
      shader.uniforms.uMeadowReady = hasMeadow;
      declarations += creekCourseGLSL + '\nuniform sampler2D uBankMeadow;\nuniform float uMeadowReady;\n';
      // Grassy overhangs give way to a broken stone/soil face at the water.
      paint += surface === 'bank'
        ? 'float grassCover=smoothstep(-.13,.065,vRiversidePosition.y+.057*sin(vRiversidePosition.z*2.1)+.022*sin(vRiversidePosition.z*6.3));'
        : 'float grassCover=1.;';
      paint += grassPaint;
    }
    shader.fragmentShader = declarations + shader.fragmentShader.replace('#include <color_fragment>',
      '{' + paint + '}\n#include <color_fragment>');
  };
  material.customProgramCacheKey = () => priorKey + '|riverside-paint-natural-soil-v2-' + surface;
  material.needsUpdate = true;
}
