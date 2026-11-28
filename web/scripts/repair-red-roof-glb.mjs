// Repair the optimized Red Roof Cottage container, never its vertex/UV/image bytes.
// Only remap accessors when their original reference is invalid or incompatible,
// and only when a unique assignment can be verified from the packed data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const file=new URL('../public/models/environment/rumah_utama_red_roof.glb',import.meta.url);
const bytes=fs.readFileSync(file);
assert.equal(bytes.toString('ascii',0,4),'glTF');
assert.equal(bytes.readUInt32LE(4),2);
assert.equal(bytes.readUInt32LE(8),bytes.length);
const n=bytes.readUInt32LE(12);
assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
const doc=JSON.parse(bytes.subarray(20,20+n).toString('utf8'));
const binStart=28+n;
assert.equal(bytes.readUInt32LE(binStart-4),0x004e4942);
const bin=bytes.subarray(binStart);
assert.equal(bytes.readUInt32LE(binStart-8),bin.length);
assert.equal(doc.buffers.length,1);
assert.ok(doc.buffers[0].byteLength<=bin.length);
const views=doc.bufferViews;
const sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const roles=new Map();
for(const mesh of doc.meshes)for(const p of mesh.primitives){
  for(const [role,i] of Object.entries(p.attributes))roles.set(i,role);
  if(p.indices!==undefined)roles.set(p.indices,'INDICES');
}
const imageViews=new Set(doc.images.map(im=>im.bufferView));
for(const i of imageViews)assert.ok(views[i],'missing image bufferView '+i);
for(const v of views){
  assert.equal(v.buffer,0);
  assert.ok((v.byteOffset??0)>=0 && (v.byteOffset??0)+v.byteLength<=bin.length);
}
console.log('Red Roof original layout',JSON.stringify({accessors:doc.accessors,bufferViews:views,roles:[...roles],images:doc.images}));
function read(c,o){
  switch(c){case 5120:return bin.readInt8(o);case 5121:return bin.readUInt8(o);case 5122:return bin.readInt16LE(o);case 5123:return bin.readUInt16LE(o);case 5125:return bin.readUInt32LE(o);case 5126:return bin.readFloatLE(o);default:throw Error('Unsupported component '+c);}
}
const positionCount=doc.accessors[[...roles].find(([,r])=>r==='POSITION')?.[0]]?.count;
function compatible(a,i,role){
  const v=views[i],w=widths[a.type],s=sizes[a.componentType];
  if(!v||imageViews.has(i)||!w||!s||a.sparse||!a.count)return false;
  const stride=v.byteStride??w*s,offset=a.byteOffset??0;
  if(stride<w*s||offset+(a.count-1)*stride+w*s>v.byteLength)return false;
  if(!v.byteStride && offset===0 && v.byteLength-a.count*w*s>3)return false;
  if(role==='INDICES' && (a.type!=='SCALAR'||a.componentType===5126||v.target===34962))return false;
  if(role!=='INDICES' && v.target===34963)return false;
  const lo=Array(w).fill(Infinity),hi=Array(w).fill(-Infinity);
  let unit=0;
  for(let j=0;j<a.count;j++){
    let length2=0;
    for(let k=0;k<w;k++){
      const x=read(a.componentType,(v.byteOffset??0)+offset+j*stride+k*s);
      if(!Number.isFinite(x))return false;
      if(role==='INDICES' && (x<0||x>=positionCount))return false;
      lo[k]=Math.min(lo[k],x);hi[k]=Math.max(hi[k],x);length2+=x*x;
    }
    if(role==='NORMAL' && Math.abs(length2-1)<.04)unit++;
  }
  if(role==='NORMAL' && unit<a.count*.95)return false;
  const close=(x,y)=>Math.abs(x-y)<=Math.max(1e-5,Math.abs(y)*1e-5);
  if(a.min && !a.min.every((x,k)=>close(lo[k],x)))return false;
  if(a.max && !a.max.every((x,k)=>close(hi[k],x)))return false;
  return true;
}
const changes=[];
for(const [i,a] of doc.accessors.entries()){
  const role=roles.get(i);
  assert.ok(role,'unexpected unclassified accessor '+i);
  if(compatible(a,a.bufferView,role))continue;
  const candidates=views.map((_,j)=>j).filter(j=>compatible(a,j,role));
  // Do not silently guess when two packed streams have compatible dimensions.
  assert.equal(candidates.length,1,'Cannot uniquely repair accessor '+i+' '+role+' candidates '+JSON.stringify(candidates));
  changes.push({accessor:i,role,from:a.bufferView,to:candidates[0]});
  a.bufferView=candidates[0];
}
for(const [i,a] of doc.accessors.entries())assert.ok(compatible(a,a.bufferView,roles.get(i)),'Invalid repaired accessor '+i);
assert.equal(new Set(doc.accessors.map(a=>a.bufferView)).size,doc.accessors.length,'Unexpected shared packed streams');
if(changes.length){
  let json=Buffer.from(JSON.stringify(doc));
  json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const header=Buffer.alloc(20);
  header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);
  header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const chunk=Buffer.alloc(8);chunk.writeUInt32LE(bin.length,0);chunk.writeUInt32LE(0x004e4942,4);
  const out=Buffer.concat([header,json,chunk,bin]);
  assert.ok(out.subarray(28+json.length).equals(bin),'Binary payload changed');
  fs.writeFileSync(file,out);
}
console.log('Red Roof GLB repaired and validated',JSON.stringify({changes,unchangedBinarySHA256:createHash('sha256').update(bin).digest('hex')}));
