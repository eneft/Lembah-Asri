import * as THREE from 'three';
import { creekCourseGLSL } from './creekCourse.ts';

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
      // Match the reference: layered spring greens with warm sunlit tips,
      // not the old grey-olive wash. Preserve the actual painted brushwork.
      vec3 painted=mix(blades,broad,.27);
      float brush=.54*sin(p.x*.46+p.y*.22)+.32*sin(p.y*.71-p.x*.37)
        +.14*sin(p.x*1.61+p.y*.91);
      float pigment=dot(painted,vec3(.23,.65,.12));
      vec3 grassShade=vec3(.29,.45,.16);
      vec3 grassSun=vec3(.67,.73,.31);
      vec3 tonalWash=mix(grassShade,grassSun,clamp(.53+.21*brush+.24*pigment,0.,1.));
      vec3 lawn=mix(painted*vec3(.94,1.12,.82),tonalWash,.46);
      lawn*=.93+.13*brush+.12*pigment;
      // Tiny broken pigment marks keep the foreground close to the painterly
      // reference while the original meadow WebP remains the actual albedo.
      // Offset each cell to avoid a regular stamped square texture.
      vec2 cellUV=p*3.4+vec2(.27*sin(p.y*.89),.23*sin(p.x*.73));
      vec2 cell=floor(cellUV);
      float stipple=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
      vec2 dab=fract(cellUV)-vec2(.23+.49*stipple,.51);
      float stroke=1.-smoothstep(.075,.24,length(vec2(dab.x*.73,dab.y*1.4)));
      vec3 accent=mix(vec3(.34,.49,.18),vec3(.78,.80,.36),stipple);
      lawn=mix(lawn,accent,stroke*(.07+.07*stipple));
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

const stonePaint = `
  if (uCobblesReady>.5) {
    vec2 p=vRiversidePosition.xz;
    vec2 uv=mat2(.87,-.49,.49,.87)*p*.47+vec2(.072*sin(p.y*.64),.060*sin(p.x*.87));
    // Project a little of the slope onto its albedo so stones keep their width.
    uv.y+=vRiversidePosition.y*.42;
    vec3 stone=texture2D(uBankCobbles,uv).rgb;
    float dry=smoothstep(-.23,.045,vRiversidePosition.y);
    vec3 wetStone=stone*mix(vec3(.49,.69,.64),vec3(.94,.88,.72),dry);
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
      paint += surface === 'bed' ? 'float stoneCover=1.;' : 'float stoneCover=.91;';
      paint += stonePaint;
    }
    if (surface !== 'bed') {
      shader.uniforms.uBankMeadow = meadow;
      shader.uniforms.uMeadowReady = hasMeadow;
      declarations += creekCourseGLSL + '\nuniform sampler2D uBankMeadow;\nuniform float uMeadowReady;\n';
      // Grassy overhangs give way to a broken stone/soil face at the water.
      paint += surface === 'bank'
        ? 'float grassCover=smoothstep(-.22,.044,vRiversidePosition.y+.041*sin(vRiversidePosition.z*2.1)+.019*sin(vRiversidePosition.z*6.3));'
        : 'float grassCover=1.;';
      paint += grassPaint;
    }
    shader.fragmentShader = declarations + shader.fragmentShader.replace('#include <color_fragment>',
      '{' + paint + '}\n#include <color_fragment>');
  };
  material.customProgramCacheKey = () => priorKey + '|riverside-paint-' + surface;
  material.needsUpdate = true;
}
