// Lembah Asri — reproducible zero-dependency alpha-cutout 3D tree GLBs.
// Uses only Node built-ins: no Blender, Python, external CDN, or build secrets.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { BARK_ATLAS_SIZE, paintBarkUVAtlas, addUnwrappedBarkTube } from './tree-bark-uv.mjs';

const OUT = process.env.TREE_ASSET_OUTPUT_DIR ?? new URL('../public/models/environment/', import.meta.url).pathname;
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 255) => Math.max(a, Math.min(b, v));
function rand(seed) { let s = seed >>> 0; return () => ((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296); }
function crc32(buffer) { let c=0xffffffff; for (const byte of buffer) { c^=byte; for(let i=0;i<8;i++) c=(c>>>1) ^ ((c&1)?0xedb88320:0); } return (c^0xffffffff)>>>0; }
function chunk(name,data) { const b=Buffer.alloc(12+data.length);b.writeUInt32BE(data.length,0);b.write(name,4,'ascii');data.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,8+data.length)),8+data.length);return b; }
function png(rgba,w,h) { const scan=Buffer.alloc(h*(w*4+1)); for(let y=0;y<h;y++) Buffer.from(rgba.buffer,rgba.byteOffset+y*w*4,w*4).copy(scan,y*(w*4+1)+1); const hbuf=Buffer.alloc(13); hbuf.writeUInt32BE(w,0);hbuf.writeUInt32BE(h,4);hbuf[8]=8;hbuf[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hbuf),chunk('IDAT',zlib.deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))]); }
function paint(buf,size,x,y,r,g,b,a=255) { if(x<0||x>=size||y<0||y>=size||a<=0)return;const i=(y*size+x)*4;const aa=a/255;const bg=1-aa;buf[i]=r*aa+buf[i]*bg;buf[i+1]=g*aa+buf[i+1]*bg;buf[i+2]=b*aa+buf[i+2]*bg;buf[i+3]=Math.min(255,a+buf[i+3]*bg); }
function leafAtlas() {
  const size=512,tile=256,pixels=new Uint8Array(size*size*4);
  // Brighter storybook pigments with enough contrast to keep the leaf groups readable.
  // Softer natural greens: readable in sun without neon/chartreuse highlights.
  const pigments=[[122,174,82],[101,157,79],[71,127,72],[141,184,99]];
  for(let v=0;v<4;v++) {
    const rnd=rand(31+v*427),offX=(v%2)*tile,offY=Math.floor(v/2)*tile;
    const tint=pigments[v];
    const n=v===3?10:12;
    for(let k=0;k<n;k++) {
      const dir=k*2.399963+v*.15+(rnd()-.5)*.55;
      const rootX=128+Math.cos(dir)*rnd()*29,rootY=127+Math.sin(dir)*rnd()*26;
      const length=64+rnd()*48,width=19+rnd()*14,curl=(rnd()-.5)*.28;
      const ddx=Math.cos(dir),ddy=Math.sin(dir),sx=-ddy,sy=ddx;
      // Rasterize a pointed hand-painted leaf with a raised midrib, darker edge,
      // asymmetric shaded side and fine painted veins into an ALPHA atlas.
      for(let y=Math.max(0,Math.floor(rootY-length-35));y<Math.min(tile,Math.ceil(rootY+length+35));y++)for(let x=Math.max(0,Math.floor(rootX-length-35));x<Math.min(tile,Math.ceil(rootX+length+35));x++) {
        const xx=x-rootX, yy=y-rootY;
        const t=(xx*ddx+yy*ddy)/length;
        if(t<=0||t>=1) continue;
        const lateral=xx*sx+yy*sy - curl*length*t*t;
        const w=width*Math.pow(Math.max(0,Math.sin(Math.PI*t)),.78)*(1-.20*t);
        const edge=w-Math.abs(lateral);
        if(edge < -.7) continue;
        const grain=Math.sin((x+v*53)*.22+y*.13)*3+Math.cos(y*.25-x*.08)*2;
        const side=lateral>0?-10:9;
        const vein=Math.exp(-Math.abs(lateral)*.38)*18;
        const wash=.85+.13*(1-t)+.035*Math.sin(13*t+v);
        const alpha=clamp(Math.round(clamp(edge+.7,0,1)*255));
        paint(pixels,size,x+offX,y+offY,clamp(tint[0]*wash+side+grain+vein),clamp(tint[1]*wash+side+grain+vein),clamp(tint[2]*wash+side+grain*.5+vein*.55),alpha);
      }
    }
    if(v===3)for(const [cx,cy] of [[108,91],[162,139],[89,153],[145,185]]) {
      for(let k=0;k<5;k++) {
        const aa=k*TAU/5,px=cx+12*Math.cos(aa),py=cy+12*Math.sin(aa);
        for(let y=Math.floor(py-8);y<=py+8;y++)for(let x=Math.floor(px-8);x<=px+8;x++) {
          const d=Math.hypot((x-px)/7.8,(y-py)/7.8);
          if(d<1.05)paint(pixels,size,x+offX,y+offY,255,239,194,clamp((1.05-d)*230));
        }
      }
      for(let y=cy-5;y<=cy+5;y++)for(let x=cx-5;x<=cx+5;x++)if(Math.hypot(x-cx,y-cy)<5)paint(pixels,size,x+offX,y+offY,226,181,70,255);
    }
  }
  return png(pixels,size,size);
}
// Authored UV atlas: separate main-trunk / bough / twig pigment islands.
function barkAtlas() {
 return png(paintBarkUVAtlas(),BARK_ATLAS_SIZE,BARK_ATLAS_SIZE);
}
function v3(x,y,z){return [x,y,z];}
function sub(a,b){return a.map((v,i)=>v-b[i]);}function add(a,b){return a.map((v,i)=>v+b[i]);}function mul(a,s){return a.map(v=>v*s);}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot(a,b){return a.reduce((v,x,i)=>v+x*b[i],0);}function norm(a){return mul(a,1/Math.sqrt(dot(a,a)));}
function mesh(){return {p:[],uv:[],idx:[],colors:[]};}
/**
 * Preserve the approved silhouette but unwrap the entire main trunk in ONE
 * continuous island. Branch chains also have contiguous V coordinates.
 * No cylindrical UV reset, no repeated striped texture.
 */
function trunk(seed){
 const rng=rand(seed),g=mesh();
 const spine=[v3(0,0,0),v3(.06,.93,.01),v3(-.06,1.80,-.04),
   v3(.045,2.55,.07),v3(-.035,3.32,.02)];
 const widths=[.35,.28,.20,.12,.042];
 addUnwrappedBarkTube(g,spine,widths,11,'trunk');
 for(let k=0;k<7;k++){
  const a=k*TAU/7;
  addUnwrappedBarkTube(g,[
    v3(.065*Math.cos(a),.36,.065*Math.sin(a)),
    v3(.47*Math.cos(a),.035,.47*Math.sin(a))
  ],[.14,.043],6,'twig',k);
 }
 const boughs=6;
 for(let k=0;k<boughs;k++){
  const a=k*TAU/boughs+(rng()-.5)*.32;
  const y=1.85+(k%3)*.30,reach=1.17+rng()*.52;
  const start=v3(.055*Math.cos(a),y,.055*Math.sin(a));
  const elbow=v3(reach*.63*Math.cos(a),y+.38,reach*.63*Math.sin(a));
  const tip=v3(reach*Math.cos(a),y+.59,reach*Math.sin(a));
  addUnwrappedBarkTube(g,[start,elbow,tip],[.135,.076,.030],8,'bough',k);
  const side=a+(k%2?-.68:.68);
  const twig=v3(elbow[0]+(.46+rng()*.25)*Math.cos(side),
    elbow[1]+.24+rng()*.16,
    elbow[2]+(.46+rng()*.25)*Math.sin(side));
  addUnwrappedBarkTube(g,[elbow,twig],[.051,.018],6,'twig',k+1);
 }
 return g;
}

/**
 * Nine overlapping, deliberately asymmetric foliage lobes. Distribution is
 * volumetric (outer and inner shells); it is NOT a sphere painted with leaves.
 * Each lobe has different height/size/count and individual cards swivel in 3D.
 */
function canopyLobes(orchard){
 const y=orchard?-.10:0;
 const lobes = [
  {p:v3( .02,3.31+y, .02),r:v3(.97,.68,.91),n:54}, // core
  {p:v3(-1.12,3.15+y, .09),r:v3(.81,.62,.79),n:46},
  {p:v3( 1.08,3.18+y,-.18),r:v3(.86,.66,.80),n:45},
  {p:v3(-.24,3.21+y, 1.06),r:v3(.79,.66,.72),n:41},
  {p:v3( .27,3.29+y,-1.06),r:v3(.76,.65,.78),n:39},
  {p:v3(-.41,3.99+y, .21),r:v3(.70,.56,.66),n:38},
  {p:v3( .56,3.89+y,-.17),r:v3(.68,.58,.67),n:35},
  {p:v3(-1.01,2.56+y, .27),r:v3(.59,.44,.59),n:29},
  {p:v3( .97,2.61+y, .28),r:v3(.61,.44,.56),n:28}
 ];
 // Orchard by the house remains compact and does not obscure the terrace.
 // Height still comes from instance scaling, never squashing individual UVs.
 return orchard ? lobes.map(l => ({ ...l,
   p:v3(l.p[0]*.89,l.p[1],l.p[2]*.90),
   r:v3(l.r[0]*.94,l.r[1],l.r[2]*.94)
 })) : lobes;
}
function crown(seed,orchard){
 const rng=rand(seed),g=mesh(),lobes=canopyLobes(orchard);
 let cards=0;
 for(let cluster=0;cluster<lobes.length;cluster++){
  const lobe=lobes[cluster];
  for(let k=0;k<lobe.n;k++){
   const az=rng()*TAU,vertical=rng()*2-1;
   const radial=Math.sqrt(1-vertical*vertical);
   const shell=(k%7===0?.38:.66)+rng()*.28;
   const outward=v3(radial*Math.cos(az),vertical,radial*Math.sin(az));
   const center=add(lobe.p,mul(v3(
    outward[0]*lobe.r[0],outward[1]*lobe.r[1],outward[2]*lobe.r[2]),shell));
   const nrm=norm(v3(
    outward[0]+lobe.p[0]*.12,
    outward[1]*.95+.12,
    outward[2]+lobe.p[2]*.12));
   const ref=Math.abs(nrm[1])>.94?v3(1,0,0):v3(0,1,0);
   const right=norm(cross(ref,nrm)),up=norm(cross(nrm,right));
   const spin=(rng()-.5)*TAU;
   const r2=add(mul(right,Math.cos(spin)),mul(up,Math.sin(spin)));
   const u2=add(mul(right,-Math.sin(spin)),mul(up,Math.cos(spin)));
   // Larger painted leaf groups, fewer tiny noisy repeated marks.
   const width=.76+rng()*.24,height=.80+rng()*.24;
   const light=center[1]>3.55;
   const rnd=rng();
   const family=orchard&&rnd<.045?3:
      light?(rnd<.55?0:rnd<.88?1:2):(rnd<.25?0:rnd<.69?1:2);
   const base=g.p.length/3;
   for(let row=0;row<=2;row++)for(let column=0;column<=2;column++){
    const u=column/2,v=row/2;
    const bend=.052*Math.sin(Math.PI*v)*(1-(u*2-1)**2);
    const pos=add(center,add(
      mul(r2,(u-.5)*width),
      add(mul(u2,(v-.5)*height),mul(nrm,bend))
    ));
    g.p.push(...pos);
    // Keep a gutter to prevent neighbouring atlas families bleeding in mipmaps.
    g.uv.push((family%2)*.5+.018+.464*u,
      Math.floor(family/2)*.5+.018+.464*v);
   }
   for(let row=0;row<2;row++)for(let col=0;col<2;col++){
    const a=base+row*3+col,b=a+1,c=a+3,d=c+1;
    g.idx.push(a,c,b,b,c,d);
   }
   cards++;
  }
 }
 g.lobeCount=lobes.length;
 g.cardCount=cards;
 g.canopyStyle='asymmetric-overlapping-lobes-v2';
 return g;
}
function f32(a){const b=Buffer.alloc(a.length*4);a.forEach((x,i)=>b.writeFloatLE(x,i*4));return b;}
function u16(a){const b=Buffer.alloc(a.length*2);a.forEach((x,i)=>b.writeUInt16LE(x,i*2));return b;}
function buildGLB(kind,leaf,bark){const orchard=kind==='orchard',meshes=[trunk(orchard?336:931),crown(orchard?336:931,orchard)],bin=[],views=[],accessors=[];let offset=0;
 function view(data,target) { const pad=(4-offset%4)%4;if(pad){bin.push(Buffer.alloc(pad));offset+=pad;}const i=views.length;views.push({buffer:0,byteOffset:offset,byteLength:data.length,...(target?{target}:{})});bin.push(data);offset+=data.length;return i; }
 function accessor(data,type,comp,count,kind,withMin=false){const bv=view(data,kind),i=accessors.length;const a={bufferView:bv,componentType:comp,count,type};if(withMin){const nums=[];for(let j=0;j<count;j++)nums.push([data.readFloatLE(j*12),data.readFloatLE(j*12+4),data.readFloatLE(j*12+8)]);a.min=[0,1,2].map(j=>Math.min(...nums.map(row=>row[j])));a.max=[0,1,2].map(j=>Math.max(...nums.map(row=>row[j])));}accessors.push(a);return i;}
 const gm=[];for(let k=0;k<2;k++){const m=meshes[k],pos=accessor(f32(m.p),'VEC3',5126,m.p.length/3,34962,true),uv=accessor(f32(m.uv),'VEC2',5126,m.uv.length/2,34962),idx=accessor(u16(m.idx),'SCALAR',5123,m.idx.length,34963);const attributes={POSITION:pos,TEXCOORD_0:uv};if(k===0)attributes.COLOR_0=accessor(f32(m.colors),'VEC3',5126,m.colors.length/3,34962);gm.push({name:k?'Layered Alpha-Cutout Crown':'Real 3D Branching Trunk',primitives:[{attributes,indices:idx,material:k}]});}
 gm[0].extras={barkUV:'unique-uv-islands-v3',baseVertexAO:true,barkAtlasSize:BARK_ATLAS_SIZE,islands:meshes[0].barkIslands};
 gm[1].extras={canopyLobes:meshes[1].lobeCount,leafCards:meshes[1].cardCount,canopyStyle:meshes[1].canopyStyle};
 const barkView=view(bark),leafView=view(leaf);
 const j={asset:{version:'2.0',generator:'Lembah Asri real-3D hand-painted alpha tree generator'},scene:0,scenes:[{nodes:[0,1]}],nodes:[{mesh:0,name:'UV Bark Trunk and Branches'},{mesh:1,name:'Layered Alpha-Texture Leaves'}],meshes:gm,accessors,bufferViews:views,buffers:[{byteLength:offset}],images:[{bufferView:barkView,mimeType:'image/png'},{bufferView:leafView,mimeType:'image/png'}],samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071},{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],textures:[{sampler:0,source:0},{sampler:1,source:1}],materials:[{name:'UV Painted Tree Bark',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:1},doubleSided:true},{name:'Hand Painted Alpha Leaves',pbrMetallicRoughness:{baseColorTexture:{index:1},metallicFactor:0,roughnessFactor:1},alphaMode:'MASK',alphaCutoff:.46,doubleSided:true}]};
 const json=Buffer.from(JSON.stringify(j),'utf8');const pad=(4-json.length%4)%4;const jb=Buffer.concat([json,Buffer.alloc(pad,32)]);const raw=Buffer.concat(bin);const tail=(4-raw.length%4)%4;const bb=Buffer.concat([raw,Buffer.alloc(tail)]);const header=Buffer.alloc(12);header.write('glTF',0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jb.length+8+bb.length,8);const jc=Buffer.alloc(8);jc.writeUInt32LE(jb.length,0);jc.writeUInt32LE(0x4e4f534a,4);const bc=Buffer.alloc(8);bc.writeUInt32LE(bb.length,0);bc.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,jc,jb,bc,bb]); }
const leaf=leafAtlas(),bark=barkAtlas();fs.mkdirSync(OUT,{recursive:true});for(const kind of ['shade','orchard']) {const asset=buildGLB(kind,leaf,bark);const file=path.join(OUT,`pohon_rimbun_${kind}.glb`);fs.writeFileSync(file,asset);console.log('Generated',file,asset.length,'bytes');}