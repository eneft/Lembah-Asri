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
  }`;

/**
 * Bring back the warm, painted PR#92 stone language at the WATER FOOT,
 * without restoring its flat 91%-stone skin across the grassy bank.
 * A broken, world-space mask leaves soil visible between clusters and keeps
 * the grass lip continuous. No geometry, depth, collision or decal changes.
 */
export const BANK_STONE_RESTORE = Object.freeze({
  style: 'pr92-inspired-broken-stone-foot-v1',
  minCover: 0.08,
  maxCover: 0.78,
  waterFootHeight: -0.20,
  upperFadeHeight: 0.09
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
    vec3 stone=mix(pebbleA,pebbleB,.28);
    float dry=smoothstep(-.23,.045,vRiversidePosition.y);
    // Earthy moss-grey rather than the old saturated teal/dark wet stripe.
    vec3 wetStone=stone*mix(vec3(.74,.76,.70),vec3(1.02,.96,.85),dry);
    float stoneScatter=.50+.28*sin(p.y*.48+p.x*.71)
                           +.22*sin(p.y*1.23-p.x*.44);
    float stoneClusters=smoothstep(.20,.79,stoneScatter);
    float wetFoot=1.0-smoothstep(-.20,.09,vRiversidePosition.y);
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
        ? '1.0' : '.08+.70*wetFoot*stoneClusters');
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
  material.customProgramCacheKey = () => priorKey + '|riverside-paint-' + surface + '|pr92-broken-stone-foot-v1';
  if (surface === 'bank') material.userData.bankStoneRestore = BANK_STONE_RESTORE.style;
  if (surface !== 'bed') material.userData.warmGrassStyle = WARM_GRASS_STYLE.version;
  material.needsUpdate = true;
}
