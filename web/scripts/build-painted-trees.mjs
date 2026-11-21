// Lembah Asri — reproducible zero-dependency alpha-cutout 3D tree GLBs.
// Uses only Node built-ins: no Blender, Python, external CDN, or build secrets.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

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
  const pigments=[[64,121,52],[52,109,60],[42,97,56],[70,118,61]];
  for(let v=0;v<4;v++) {
    const rnd=rand(31+v*427),offX=(v%2)*tile,offY=Math.floor(v/2)*tile;
    const tint=pigments[v];
    const n=v===3?10:15;
    for(let k=0;k<n;k++) {
      const dir=k*2.399963+v*.15+(rnd()-.5)*.55;
      const rootX=128+Math.cos(dir)*rnd()*29,rootY=127+Math.sin(dir)*rnd()*26;
      const length=58+rnd()*44,width=16+rnd()*12,curl=(rnd()-.5)*.35;
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
        const side=lateral>0?-14:8;
        const vein=Math.exp(-Math.abs(lateral)*.38)*18;
        const wash=.75+.28*(1-t)+.07*Math.sin(13*t+v);
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
function barkAtlas() { const n=256,pixels=new Uint8Array(n*n*4); for(let y=0;y<n;y++)for(let x=0;x<n;x++){
 const grain=Math.sin((x+9*Math.sin(y/20))/5.8)*7+Math.sin(x*.32+y*.008)*3;
 const d=1+.05*Math.sin(x/27+y/44)+.03*Math.sin(x*.09-y*.011);
 const moss=Math.max(0,Math.sin(x/11+y/36)-.55)*15;const i=(y*n+x)*4;
 pixels[i]=clamp((132+grain)*d-moss*.4);pixels[i+1]=clamp((95+grain*.7)*d+moss);pixels[i+2]=clamp((64+grain*.5)*d+moss*.45);pixels[i+3]=255;
 } return png(pixels,n,n); }
function v3(x,y,z){return [x,y,z];}
function sub(a,b){return a.map((v,i)=>v-b[i]);}function add(a,b){return a.map((v,i)=>v+b[i]);}function mul(a,s){return a.map(v=>v*s);}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot(a,b){return a.reduce((v,x,i)=>v+x*b[i],0);}function norm(a){return mul(a,1/Math.sqrt(dot(a,a)));}
function mesh(){return {p:[],uv:[],idx:[]};}
function cylinder(g,a,b,r0,r1,sides=9){const axis=norm(sub(b,a)),ref=Math.abs(axis[1])>.95?v3(1,0,0):v3(0,1,0),u=norm(cross(axis,ref)),v=cross(axis,u);const index=g.p.length/3;for(let j=0;j<=1;j++) for(let i=0;i<=sides;i++){const angle=i*TAU/sides,r=j?r1:r0,pos=add(j?b:a,add(mul(u,r*Math.cos(angle)),mul(v,r*Math.sin(angle))));g.p.push(...pos);g.uv.push(i/sides,j*.78);}for(let i=0;i<sides;i++){const k=index+i,l=index+sides+1+i;g.idx.push(k,l,k+1,k+1,l,l+1);} }
function trunk(seed){const rng=rand(seed),g=mesh(),p=[v3(0,0,0),v3(.07,.93,.02),v3(-.05,1.79,-.05),v3(.06,2.55,.05),v3(-.04,3.25,.02)];const r=[.33,.28,.20,.115,.04];for(let k=0;k<4;k++)cylinder(g,p[k],p[k+1],r[k],r[k+1],11);for(let k=0;k<7;k++){const a=k*TAU/7;cylinder(g,v3(.07*Math.cos(a),.38,.07*Math.sin(a)),v3(.48*Math.cos(a),.04,.48*Math.sin(a)),.14,.045,6);}for(let k=0;k<10;k++){const a=k*2.399963+(rng()-.5)*.35,y=1.63+(k%4)*.30,rad=1+rng()*.55;const s=v3(0,y,0),m=v3(rad*.64*Math.cos(a),y+.38,rad*.64*Math.sin(a)),e=v3(rad*Math.cos(a),y+.58,rad*Math.sin(a));cylinder(g,s,m,.103,.065,7);cylinder(g,m,e,.065,.024,6);}return g;}
function crown(seed,orchard){const rng=rand(seed),g=mesh();for (const [shell,n] of [[1,143],[.81,112],[.62,79]])for(let k=0;k<n;k++){
 const t=(k+.5)/n,sy=1-2*t,angle=k*2.399963+rng()*.4,sr=Math.sqrt(1-sy*sy);
 const sx=sr*Math.cos(angle),sz=sr*Math.sin(angle);
 const center=v3(sx*1.89*shell+(rng()-.5)*.23,3.10+sy*1.28*shell+(rng()-.5)*.18,sz*1.75*shell+(rng()-.5)*.23);
 if(center[1]<2.05&&shell===1)center[1]=2.07+rng()*.12;
 let normal=norm(v3(sx*.81,(sy+.18)*.94,sz*.81));
 for(let pair=0;pair<(shell===1&&k%4===0?2:1);pair++) {
  const c=add(center,v3((rng()-.5)*.2,(rng()-.5)*.18,(rng()-.5)*.2));
  let rand=norm(v3(rng()-.5,(rng()-.5)*.8,rng()-.5));const nrm=norm(add(mul(normal,.76),mul(rand,.24)));
  const ref=Math.abs(nrm[1])>.95?v3(1,0,0):v3(0,1,0);
  let right=norm(cross(ref,nrm)), up=norm(cross(nrm,right));const spin=(rng()-.5)*TAU;
  const r2=add(mul(right,Math.cos(spin)),mul(up,Math.sin(spin)));
  const u2=add(mul(right,-Math.sin(spin)),mul(up,Math.cos(spin)));
  const width=.68+rng()*.34, height=.69+rng()*.37;
  const type=rng()<(orchard?.08:.013)?3:Math.floor(rng()*3);
  const base=g.p.length/3;
  for(let y=0;y<=2;y++) for(let x=0;x<=2;x++) {
   const u=x/2,v=y/2;
   const pos=add(add(c,mul(r2,(u-.5)*width)),add(mul(u2,(v-.5)*height),mul(nrm,.045*(1-(u*2-1)**2)*Math.sin(Math.PI*v))));
   g.p.push(...pos);g.uv.push((type%2)*.5+.016+.468*u,Math.floor(type/2)*.5+.016+.468*v);
  }
  for(let y=0;y<2;y++)for(let x=0;x<2;x++) {const a=base+y*3+x,b=a+1,c=a+3,d=c+1;g.idx.push(a,c,b,b,c,d);}
 }
}return g;}
function f32(a){const b=Buffer.alloc(a.length*4);a.forEach((x,i)=>b.writeFloatLE(x,i*4));return b;}
function u16(a){const b=Buffer.alloc(a.length*2);a.forEach((x,i)=>b.writeUInt16LE(x,i*2));return b;}
function buildGLB(kind,leaf,bark){const orchard=kind==='orchard',meshes=[trunk(orchard?336:931),crown(orchard?336:931,orchard)],bin=[],views=[],accessors=[];let offset=0;
 function view(data,target) { const pad=(4-offset%4)%4;if(pad){bin.push(Buffer.alloc(pad));offset+=pad;}const i=views.length;views.push({buffer:0,byteOffset:offset,byteLength:data.length,...(target?{target}:{})});bin.push(data);offset+=data.length;return i; }
 function accessor(data,type,comp,count,kind,withMin=false){const bv=view(data,kind),i=accessors.length;const a={bufferView:bv,componentType:comp,count,type};if(withMin){const nums=[];for(let j=0;j<count;j++)nums.push([data.readFloatLE(j*12),data.readFloatLE(j*12+4),data.readFloatLE(j*12+8)]);a.min=[0,1,2].map(j=>Math.min(...nums.map(row=>row[j])));a.max=[0,1,2].map(j=>Math.max(...nums.map(row=>row[j])));}accessors.push(a);return i;}
 const gm=[];for(let k=0;k<2;k++){const m=meshes[k],pos=accessor(f32(m.p),'VEC3',5126,m.p.length/3,34962,true),uv=accessor(f32(m.uv),'VEC2',5126,m.uv.length/2,34962),idx=accessor(u16(m.idx),'SCALAR',5123,m.idx.length,34963);gm.push({name:k?'Layered Alpha-Cutout Crown':'Real 3D Branching Trunk',primitives:[{attributes:{POSITION:pos,TEXCOORD_0:uv},indices:idx,material:k}]});}
 const barkView=view(bark),leafView=view(leaf);
 const j={asset:{version:'2.0',generator:'Lembah Asri real-3D hand-painted alpha tree generator'},scene:0,scenes:[{nodes:[0,1]}],nodes:[{mesh:0,name:'UV Bark Trunk and Branches'},{mesh:1,name:'Layered Alpha-Texture Leaves'}],meshes:gm,accessors,bufferViews:views,buffers:[{byteLength:offset}],images:[{bufferView:barkView,mimeType:'image/png'},{bufferView:leafView,mimeType:'image/png'}],samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],textures:[{sampler:0,source:0},{sampler:0,source:1}],materials:[{name:'UV Painted Tree Bark',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:1},doubleSided:true},{name:'Hand Painted Alpha Leaves',pbrMetallicRoughness:{baseColorTexture:{index:1},metallicFactor:0,roughnessFactor:1},alphaMode:'MASK',alphaCutoff:.46,doubleSided:true}]};
 const json=Buffer.from(JSON.stringify(j),'utf8');const pad=(4-json.length%4)%4;const jb=Buffer.concat([json,Buffer.alloc(pad,32)]);const raw=Buffer.concat(bin);const tail=(4-raw.length%4)%4;const bb=Buffer.concat([raw,Buffer.alloc(tail)]);const header=Buffer.alloc(12);header.write('glTF',0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jb.length+8+bb.length,8);const jc=Buffer.alloc(8);jc.writeUInt32LE(jb.length,0);jc.writeUInt32LE(0x4e4f534a,4);const bc=Buffer.alloc(8);bc.writeUInt32LE(bb.length,0);bc.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,jc,jb,bc,bb]); }
const leaf=leafAtlas(),bark=barkAtlas();fs.mkdirSync(OUT,{recursive:true});for(const kind of ['shade','orchard']) {const asset=buildGLB(kind,leaf,bark);const file=path.join(OUT,`pohon_rimbun_${kind}.glb`);fs.writeFileSync(file,asset);console.log('Generated',file,asset.length,'bytes');}