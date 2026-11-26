import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const BAMBOO_TEXTURE_REVISION='original-bamboo-pigment-v4';
export const ORIGINAL_BAMBOO_GLB='./models/environment/home-fence-module.glb?v=1';
export type BambooSurface='cane'|'rail'|'tie'|'rim'|'inside'|'well';
const TILE=256, WIDTH=TILE*3, HEIGHT=TILE*2;
const cells:Record<BambooSurface,[number,number]>={cane:[0,0],rail:[1,0],tie:[2,0],rim:[0,1],inside:[1,1],well:[2,1]};
export function bambooSurfaceUV(kind:BambooSurface,u:number,v:number):[number,number]{
  const [x,y]=cells[kind],pad=4;
  return [(x*TILE+pad+u*(TILE-2*pad))/WIDTH,
    1-(y*TILE+pad+(1-v)*(TILE-2*pad))/HEIGHT];
}
type RGB=[number,number,number];
const clamp=(v:number,min=0,max=255)=>Math.max(min,Math.min(max,v));
const mix=(a:RGB,b:RGB,t:number):RGB=>a.map((v,i)=>v+(b[i]-v)*t) as RGB;
const hash=(a:number,b:number)=>{const h=Math.sin(a*127.1+b*311.7)*43758.5453;return h-Math.floor(h);};
const smooth=(v:number)=>{v=clamp(v,0,1);return v*v*(3-2*v);};
function sampleOriginal(image:ImageData,x:number,y:number):RGB{
  const ix=Math.max(0,Math.min(image.width-1,Math.round(x*image.width)));
  const iy=Math.max(0,Math.min(image.height-1,Math.round(y*image.height)));
  const p=(iy*image.width+ix)*4;
  return [image.data[p],image.data[p+1],image.data[p+2]];
}
// Coordinates measured from the original embedded shaded JPEG (not from
// the simplified illustrated quadrant atlas). These interior patches run
// along intact longitudinal bamboo fibres, away from black UV padding.
const patches=[
  {x0:474/1248,x1:514/1248,y0:1007/1248,y1:1021/1248},
  {x0:533/1248,x1:574/1248,y0:1008/1248,y1:1020/1248},
  {x0:478/1248,x1:523/1248,y0:174/1248,y1:186/1248}
] as const;
function originalFiber(image:ImageData,u:number,v:number):RGB{
  // Mirror edges so the cylindrical UV seam has the same pigment on both
  // sides. Blend three real scanned patches; black atlas padding is excluded.
  const uu=1-Math.abs(2*u-1);
  const colors=patches.map(p=>sampleOriginal(image,
    p.x0+(p.x1-p.x0)*v,p.y0+(p.y1-p.y0)*uu));
  const valid=colors.filter(c=>c[0]>95&&c[1]>65&&c[2]<c[0]*.86);
  if(!valid.length)return [172,139,78];
  return valid.reduce((sum,c)=>[sum[0]+c[0]/valid.length,sum[1]+c[1]/valid.length,sum[2]+c[2]/valid.length],[0,0,0] as RGB);
}
export function buildBambooAtlasPixels(source:ImageData):Uint8Array{
  const data=new Uint8Array(WIDTH*HEIGHT*4);
  for(const [kind,[cx,cy]] of Object.entries(cells) as [BambooSurface,[number,number]][]){
    for(let py=0;py<TILE;py++)for(let px=0;px<TILE;px++){
      const u=clamp((px-4)/(TILE-8),0,1),v=1-clamp((py-4)/(TILE-8),0,1);
      const fiber=originalFiber(source,u,v);
      // Normalize the old baked highlights while retaining original grain.
      const raw=(fiber[0]*.25+fiber[1]*.60+fiber[2]*.15);
      const grain=clamp((raw-150)*.36,-24,24);
      const broad=Math.sin(u*Math.PI*2)*3+Math.cos(u*Math.PI*6)*2;
      const narrow=(hash(Math.round((1-Math.abs(2*u-1))*118),7)-.5)*8;
      let color:RGB;
      if(kind==='cane'||kind==='rail'){
        const nodeDistance=Math.min(Math.abs(v-.30),Math.abs(v-.68));
        const ring=1-smooth(nodeDistance/.017);
        const shade=1-smooth(Math.abs(nodeDistance-.022)/.014);
        const pigment=fiber.map((c,i)=>clamp(c*(174/Math.max(raw,90)),0,255)) as RGB;
        const base=mix(mix([154,127,72],[198,166,105],.52+.18*Math.cos(v*5.7)),pigment,.31);
        color=mix(base,[113,93,53],shade*.20);
        color=mix(color,[210,183,121],ring*.49);
        const damp=(1-smooth(v/.32))*(.23+.19*Math.cos(u*Math.PI*4+v*17));
        color=mix(color,[115,126,68],Math.max(0,damp));
        color=color.map(c=>c+grain+broad+narrow) as RGB;
      }else if(kind==='tie'){
        color=mix([121,88,43],[177,145,85],.52+.17*Math.cos(u*Math.PI*12));
        color=color.map(c=>c+grain*.5+narrow*.8) as RGB;
      }else if(kind==='rim'){
        const r=Math.hypot(u-.5,v-.5);
        const angle=Math.atan2(v-.5,u-.5);
        const inner=mix([99,78,43],[151,121,70],smooth((r-.26)/.12));
        const lip=mix([187,152,88],[218,189,126],.55+.18*Math.cos(angle*13));
        color=mix(inner,lip,smooth((r-.36)/.075));
        color=color.map(c=>c+grain*.28) as RGB;
      }else if(kind==='inside'){
        color=mix([92,72,40],[157,124,71],smooth(v));
        color=color.map(c=>c+grain*.3+narrow*.4) as RGB;
      }else{
        const r=Math.min(1,Math.hypot(u-.5,v-.5)*2);
        color=mix([108,83,44],[139,111,64],r);
        color=color.map(c=>c+grain*.23) as RGB;
      }
      const at=((cy*TILE+py)*WIDTH+cx*TILE+px)*4;
      data[at]=Math.round(clamp(color[0]));data[at+1]=Math.round(clamp(color[1]));data[at+2]=Math.round(clamp(color[2]));data[at+3]=255;
    }
  }
  return data;
}

export async function loadOriginalBambooSurfaceAtlas():Promise<THREE.DataTexture>{
  const {scene}=await new GLTFLoader().loadAsync(ORIGINAL_BAMBOO_GLB);
  let original:THREE.Texture|undefined;
  scene.traverse(o=>{
    if(o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.emissiveMap)
      original=o.material.emissiveMap;
  });
  if(!original?.image)throw Error('Original bamboo GLB embedded texture unavailable');
  const source=original.image as CanvasImageSource & {width:number;height:number};
  const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Unable to read original bamboo atlas');
  ctx.drawImage(source,0,0);
  const sourceData=ctx.getImageData(0,0,canvas.width,canvas.height);
  const texture=new THREE.DataTexture(buildBambooAtlasPixels(sourceData),WIDTH,HEIGHT,THREE.RGBAFormat);
  // DataTexture rows are top-first in our source array, UVs are bottom-first.
  texture.flipY=true;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
  texture.name=BAMBOO_TEXTURE_REVISION;
  texture.userData={source:'home-fence-module.glb embedded emissive JPEG',revision:BAMBOO_TEXTURE_REVISION};
  canvas.width=canvas.height=0;
  return texture;
}
