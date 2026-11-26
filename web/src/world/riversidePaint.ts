import * as THREE from 'three';
import { creekCourseGLSL } from './creekCourse.ts';
import { ensureWarmGrassGLSL, WARM_GRASS_STYLE } from './grassPalette.ts';

const meadow = { value: null as THREE.Texture | null };
const cobbles = { value: null as THREE.Texture | null };
const hasMeadow = { value: 0 };
const hasCobbles = { value: 0 };
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
    load('creek_cobbles.webp', cobbles, hasCobbles)
  ]).then(() => {
    if (!hasMeadow.value || !hasCobbles.value) loading = undefined;
  });
  return loading;
}

const grassPaint = `
  vec2 p=vRiversidePosition.xz;
  // Lay the same short grass strokes into the meadow and courtyard painting.
  // Fade fine marks into the horizon and mask out brown paths and worked soil.
  if (uMeadowReady > .5) {
    float green = smoothstep(-.012,.045,diffuseColor.g-diffuseColor.r)
                * smoothstep(.04,.15,diffuseColor.g-diffuseColor.b);
    float nearField = 1.-smoothstep(16.,55.,distance(cameraPosition.xz,p));
    vec2 strokeUV = mat2(.94,.34,-.34,.94)*p*.62 + .12*sin(p.yx*.93);
    vec3 marks = texture2D(uBankMeadow,strokeUV).rgb;
    float brush = clamp(dot(marks,vec3(.23,.65,.12))-.24,-.19,.36);
    diffuseColor.rgb *= 1. + green*nearField*brush*.66;
  }
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
      lawn=lembahWarmGrass(lawn);
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
  }
  // Foot traffic around the working well exposes the same ochre earth as the path.
  vec2 wellOffset = (p-vec2(-39.,4.))/vec2(1.95,1.65);
  float wellRadius = length(wellOffset) + .06*sin(p.x*6.3)*sin(p.y*5.7);
  float wellWear = 1.-smoothstep(.45,1.20,wellRadius);
  float earthGrain = .5+.25*sin(p.x*13.+p.y*5.)+.25*sin(p.y*21.-p.x*7.);
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(.28,.18,.08),vec3(.48,.34,.17),earthGrain),wellWear*.65);
`;

/**
 * Stage 2: stagger the wet stone foot into the exposed bank soil, with a
 * protected green buffer at the top of the slope. No round-stone wallpaper
 * above water and no dark straight ribbon. Water, foam and riverbed untouched.
 */
export const BANK_STONE_RESTORE = Object.freeze({
  style: 'natural-bank-ecotone-stage2-v1',
  minCover: 0.0,
  maxCover: 0.535,
  waterFootHeight: -0.25,
  upperFadeHeight: -0.015
});

const stonePaint = `
  if (uCobblesReady>.5) {
    vec2 p=vRiversidePosition.xz;
    vec2 meander=vec2(.047*sin(p.y*.61+p.x*.27),
                       .036*sin(p.y*.41-p.x*.29));
    vec2 uv=mat2(.87,-.49,.49,.87)*p*.39+meander;
    uv.y+=vRiversidePosition.y*.23;
    vec3 pebbleA=texture2D(uBankCobbles,uv).rgb;
    // Break the repeating oval/cobble pattern without changing source atlas.
    vec2 uvB=vec2(uv.y*.64-uv.x*.36,uv.x*.32+uv.y*.64)+vec2(.13,.37);
    vec3 pebbleB=texture2D(uBankCobbles,uvB).rgb;
    vec3 stone=mix(pebbleA,pebbleB,.35);
    float dry=smoothstep(-.24,-.025,vRiversidePosition.y);
    // Warm grey/moss stone, gently damp near the water; avoid a teal stripe.
    vec3 wetStone=stone*mix(vec3(.84,.85,.77),vec3(1.02,.97,.87),dry);
    float stoneScatter=.52+.23*sin(p.y*.46+p.x*.83)
                           +.18*sin(p.y*1.13-p.x*.31);
    float stoneClusters=smoothstep(.36,.76,stoneScatter);
    // World-space wobble breaks both edges without moving the creek mesh.
    float waterFootHeight=vRiversidePosition.y+.025*sin(p.y*.83+p.x*.41);
    float wetFoot=1.0-smoothstep(-.25,-.055,waterFootHeight);
    float upperGrassGuard=smoothstep(-.18,-.015,vRiversidePosition.y+
      .035*sin(p.y*1.11+p.x*.12));
    float stoneCover=STONE_COVER_EXPRESSION;
    diffuseColor.rgb=mix(diffuseColor.rgb,wetStone,stoneCover);
  }`;

type Surface = 'meadow' | 'bank' | 'bed';

// Pigment is composed after the underlying world/courtyard/shore albedos and
// before vertex shading and alpha masks. All four surfaces meet in world space.
export function applyRiversidePaint(material: THREE.MeshBasicMaterial, surface: Surface): void {
  const compile = material.onBeforeCompile;
  const priorKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    const varying = 'varying vec3 vRiversidePosition;\n';
    shader.vertexShader = varying + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvRiversidePosition=(modelMatrix*vec4(transformed,1.)).xyz;');
    let declarations = varying;
    let paint = '';
    if (surface !== 'meadow') {
      shader.uniforms.uBankCobbles = cobbles;
      shader.uniforms.uCobblesReady = hasCobbles;
      declarations += 'uniform sampler2D uBankCobbles;\nuniform float uCobblesReady;\n';
      // The riverbed retains full cobbles; only the sloped banks are remixed.
      paint += stonePaint.replace('STONE_COVER_EXPRESSION', surface === 'bed'
        ? '1.0' : '(.015+.52*wetFoot*stoneClusters)*(1.0-.82*upperGrassGuard)');
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
    shader.fragmentShader = ensureWarmGrassGLSL(declarations + shader.fragmentShader.replace('#include <color_fragment>',
      '{' + paint + '}\n#include <color_fragment>'));
  };
  material.customProgramCacheKey = () => priorKey + '|riverside-paint-' + surface + '|natural-bank-ecotone-stage2-v1';
  if (surface === 'bank') material.userData.bankStoneRestore = BANK_STONE_RESTORE.style;
  if (surface !== 'bed') material.userData.warmGrassStyle = WARM_GRASS_STYLE.version;
  material.needsUpdate = true;
}
