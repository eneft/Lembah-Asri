import * as THREE from 'three';

/**
 * Painterly cel shading + BLACK silhouettes from geometry depth.
 * One scene pass + one screen quad (no second render of all FBX, GLB and
 * InstancedMesh objects). UV paintings, river shaders and the foliage atlas
 * are preserved. Depth outlines read physical geometry, not brush strokes.
 */
export const TOON_SETTINGS=Object.freeze({
  ink:[0,0,0] as const,
  strength:.96,
  pixelWidthMobile:1.05,
  pixelWidthDesktop:1.3,
  thresholdNear:.055,
  thresholdFar:.16,
  toonColorStrength:.14,
  taps:5,
  version:'lembah-toon-black-v1'
});
let ramp:THREE.DataTexture|undefined;
/** Exact four nearest-filtered lighting bands for plain village objects. */
export function getVillageToonRamp():THREE.DataTexture {
  if(ramp)return ramp;
  const bytes=new Uint8Array([
    146,146,146,255, 188,188,188,255,
    224,224,224,255, 255,255,255,255
  ]);
  ramp=new THREE.DataTexture(bytes,4,1,THREE.RGBAFormat);
  ramp.colorSpace=THREE.NoColorSpace;
  ramp.magFilter=THREE.NearestFilter;
  ramp.minFilter=THREE.NearestFilter;
  ramp.generateMipmaps=false;
  ramp.needsUpdate=true;
  return ramp;
}
export function createVillageToonMaterial(color:string):THREE.MeshToonMaterial{
  const material=new THREE.MeshToonMaterial({
    name:'Village four-band toon lighting',
    color:new THREE.Color(color),
    gradientMap:getVillageToonRamp(),
    fog:true
  });
  material.userData.style='toon-4-band';
  return material;
}

export const TOON_VERTEX_SHADER=[
  'varying vec2 vToonUv;',
  'void main(){',
  ' vToonUv=uv;',
  ' gl_Position=vec4(position.xy,0.0,1.0);',
  '}'
].join('\n');

export const TOON_FRAGMENT_SHADER=[
  'uniform sampler2D uSceneColor;',
  'uniform sampler2D uSceneDepth;',
  'uniform vec2 uPixel;',
  'uniform float uNear;',
  'uniform float uFar;',
  'uniform float uStrokePixels;',
  'varying vec2 vToonUv;',
  'float viewDistance(float d){',
  ' return (2.0*uNear*uFar)/(uFar+uNear-(2.0*d-1.0)*(uFar-uNear));',
  '}',
  'float contour(float center,float around){',
  ' if(center>.99998)return 0.0;',
  ' float a=viewDistance(center);',
  ' float b=viewDistance(around);',
  ' float contrast=abs(a-b)/max(min(a,b),0.55);',
  ' return smoothstep(.055,.16,contrast);',
  '}',
  'void main(){',
  ' vec3 paint=texture2D(uSceneColor,vToonUv).rgb;',
  ' float d=texture2D(uSceneDepth,vToonUv).r;',
  ' vec2 p=uPixel*uStrokePixels;',
  ' float edge=0.0;',
  ' edge=max(edge,contour(d,texture2D(uSceneDepth,vToonUv+vec2(p.x,0.0)).r));',
  ' edge=max(edge,contour(d,texture2D(uSceneDepth,vToonUv-vec2(p.x,0.0)).r));',
  ' edge=max(edge,contour(d,texture2D(uSceneDepth,vToonUv+vec2(0.0,p.y)).r));',
  ' edge=max(edge,contour(d,texture2D(uSceneDepth,vToonUv-vec2(0.0,p.y)).r));',
  // Paint UV shading remains: color stepping is only 14% of the final image.
  ' float lum=dot(paint,vec3(.2126,.7152,.0722));',
  ' float band=floor(lum*5.0+.45)/5.0;',
  ' float ratio=clamp(band/max(lum,.05),.75,1.17);',
  ' vec3 stylized=mix(paint,paint*ratio,.14);',
  ' stylized=mix(stylized,vec3(0.0),edge*.96);',
  ' gl_FragColor=vec4(stylized,1.0);',
  ' #include <colorspace_fragment>',
  '}'
].join('\n');

/**
 * WebGL2 + depth texture are already required by the existing renderer.
 * Transparent water never writes depth, preventing false foam outlines.
 * Unsupported GPUs fall back to the original color rendering on failure.
 */
export class ToonOutlineRenderer{
  private target:THREE.WebGLRenderTarget;
  private material:THREE.ShaderMaterial;
  private quad:THREE.Mesh;
  private screen:THREE.Scene;
  private camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  private size=new THREE.Vector2(1,1);
  private enabled=true;
  private renderer:THREE.WebGLRenderer;
  constructor(renderer:THREE.WebGLRenderer,mobile:boolean){
    this.renderer=renderer;
    const target=new THREE.WebGLRenderTarget(1,1,{
      format:THREE.RGBAFormat,type:THREE.UnsignedByteType,
      depthBuffer:true,stencilBuffer:false,
      magFilter:THREE.LinearFilter,minFilter:THREE.LinearFilter
    });
    target.texture.colorSpace=THREE.SRGBColorSpace;
    target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    target.depthTexture.format=THREE.DepthFormat;
    target.depthTexture.minFilter=THREE.NearestFilter;
    target.depthTexture.magFilter=THREE.NearestFilter;
    target.depthTexture.generateMipmaps=false;
    target.samples=0;
    this.target=target;
    this.material=new THREE.ShaderMaterial({
      name:'Lembah Asri black ink toon compositor',
      uniforms:{
        uSceneColor:{value:target.texture},
        uSceneDepth:{value:target.depthTexture},
        uPixel:{value:new THREE.Vector2(1,1)},
        uNear:{value:.1},uFar:{value:500},
        uStrokePixels:{value:mobile?
          TOON_SETTINGS.pixelWidthMobile:TOON_SETTINGS.pixelWidthDesktop}
      },
      vertexShader:TOON_VERTEX_SHADER,
      fragmentShader:TOON_FRAGMENT_SHADER,
      depthTest:false,depthWrite:false,toneMapped:false
    });
    this.screen=new THREE.Scene();
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);
    this.quad.frustumCulled=false;
    this.screen.add(this.quad);
    this.resize();
  }
  resize():void{
    this.renderer.getDrawingBufferSize(this.size);
    const w=Math.max(1,Math.floor(this.size.x));
    const h=Math.max(1,Math.floor(this.size.y));
    if(this.target.width===w&&this.target.height===h)return;
    this.target.setSize(w,h);
    this.material.uniforms.uPixel.value.set(1/w,1/h);
  }
  render(scene:THREE.Scene,camera:THREE.PerspectiveCamera):void{
    if(!this.enabled){this.renderer.render(scene,camera);return;}
    const previous=this.renderer.getRenderTarget();
    this.material.uniforms.uNear.value=camera.near;
    this.material.uniforms.uFar.value=camera.far;
    try{
      this.renderer.setRenderTarget(this.target);
      this.renderer.clear(true,true,true);
      this.renderer.render(scene,camera);
      this.renderer.setRenderTarget(previous);
      this.renderer.render(this.screen,this.camera);
    }catch(error){
      console.warn('[LembahAsri] Toon unsupported on this GPU; use standard render',error);
      this.enabled=false;
      this.renderer.setRenderTarget(previous);
      this.renderer.render(scene,camera);
    }
  }
  dispose():void{
    this.target.dispose();this.material.dispose();this.quad.geometry.dispose();
  }
}
