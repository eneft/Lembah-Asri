import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {FENCE_GAP, fenceSide, createOpenFenceModule} from '../src/world/fenceSpacing.ts';
import {createUploadedFenceRun,FENCE_HEIGHT} from '../src/world/uploadedHomeFence.ts';

// Read the actual user-supplied single-mesh binary GLB, not a synthetic
// collection of cylinders that would hide the real fused-topology problem.
function readSource(){
  const b=readFileSync(new URL('../public/models/environment/home-fence-module.glb',import.meta.url));
  assert.equal(b.toString('ascii',0,4),'glTF');
  const jsonLength=b.readUInt32LE(12);
  const j=JSON.parse(b.toString('utf8',20,20+jsonLength));
  const start=28+jsonLength;
  const p=j.meshes[0].primitives[0];
  const read=(id,components)=>{
    const a=j.accessors[id],v=j.bufferViews[a.bufferView];
    const bytes=a.componentType===5126?4:a.componentType===5123?2:4;
    const base=start+(v.byteOffset??0)+(a.byteOffset??0);
    const values=[];
    for(let i=0;i<a.count;i++)for(let k=0;k<components;k++){
      const offset=base+i*(v.byteStride??components*bytes)+k*bytes;
      values.push(a.componentType===5126?b.readFloatLE(offset):a.componentType===5123?b.readUInt16LE(offset):b.readUInt32LE(offset));
    }
    return values;
  };
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(read(p.attributes.POSITION,3),3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(read(p.attributes.NORMAL,3),3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(read(p.attributes.TEXCOORD_0,2),2));
  g.setIndex(read(p.indices,1));
  g.computeBoundingBox();
  return g;
}

// Union of actual triangle intersections at a height between the rails.
function coverage(g,level){
  const a=g.attributes.position,index=g.index,b=g.boundingBox;
  const y=b.min.y+(b.max.y-b.min.y)*level, spans=[];
  for(let i=0;i<(index?.count??a.count);i+=3){
    const p=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(a,index?index.getX(i+k):i+k));
    const hits=[];
    for(let k=0;k<3;k++){
      const u=p[k],v=p[(k+1)%3];
      if((u.y<y&&v.y>=y)||(v.y<y&&u.y>=y))
        hits.push(u.x+(v.x-u.x)*(y-u.y)/(v.y-u.y));
    }
    if(hits.length>1)spans.push([Math.min(...hits),Math.max(...hits)]);
  }
  spans.sort((a,b)=>a[0]-b[0]);
  const merged=[];
  for(const s of spans){
    const last=merged.at(-1);
    if(last&&s[0]<=last[1]+.0001)last[1]=Math.max(last[1],s[1]);
    else merged.push(s);
  }
  const scale=FENCE_HEIGHT/(b.max.y-b.min.y);
  return {fraction:merged.reduce((sum,s)=>sum+s[1]-s[0],0)/(b.max.x-b.min.x),
    gaps:merged.slice(1).map((s,i)=>(s[0]-merged[i][1])*scale)};
}

test('open variants preserve original support envelope, UV atlas and side-specific spacing',()=>{
  const source=readSource(),original=source.attributes.position.array.slice();
  const middle=coverage(source,.45);
  assert.ok(middle.fraction>.90,'original fence should be genuinely dense');
  const variants={};
  for(const side of ['front','side','rear']){
    const g=createOpenFenceModule(source,side,FENCE_HEIGHT);variants[side]=g;
    const meta=g.userData;
    assert.equal(meta.fenceSide,side);
    assert.equal(meta.originalUV,true);
    for(const gap of meta.bayGaps){
      assert.ok(gap>=FENCE_GAP[side].min-1e-4&&gap<=FENCE_GAP[side].max+1e-4,side+' gap '+gap);
    }
    const size=g.boundingBox.getSize(new THREE.Vector3()),old=source.boundingBox.getSize(new THREE.Vector3());
    assert.ok(size.distanceTo(old)<.002,'support and rail envelope must not be stretched');
    for(const n of g.attributes.uv.array)assert.ok(Number.isFinite(n)&&n>=-.001&&n<=1.001);
    assert.ok(g.attributes.position.count>0&&g.attributes.position.count%3===0);
    const projected=coverage(g,.45);
    assert.ok(projected.fraction<middle.fraction-.1,side+' must have actual openings');
    assert.ok(projected.gaps.some(gap=>gap>.05),side+' must contain visible openings');
    assert.ok(coverage(g,.20).fraction>.9,'lower rail remains continuous');
    console.log(side, 'nominal gaps (m)',meta.bayGaps,'mid coverage',projected.fraction,'closed/open cut loops',meta.closedCuts,meta.openCuts);
  }
  assert.ok(coverage(variants.front,.45).fraction<coverage(variants.rear,.45).fraction);
  assert.deepEqual(source.attributes.position.array,original,'source geometry not modified');
});

test('orientation, fence footprint and continuous run metadata are retained',()=>{
  const source=readSource(),material=new THREE.MeshBasicMaterial();
  for(const [label,half,side] of [
    ['South front fence',[13,.77,.12],'front'],
    ['East side fence north',[.12,.77,9.5],'side'],
    ['North rear fence',[13.5,.77,.12],'rear']
  ]){
    assert.equal(fenceSide(label),side);
    const geometry=createOpenFenceModule(source,side,FENCE_HEIGHT);
    const run=createUploadedFenceRun(geometry,material,{label,center:[-20,.77,10],half});
    assert.equal(run.userData.runLength,Math.max(half[0],half[2])*2);
    assert.equal(run.userData.fenceSide,side);
    assert.equal(run.userData.moduleHeight,FENCE_HEIGHT);
    assert.ok(run.userData.moduleDepth>.40);
    assert.equal(run.position.x,-20);assert.equal(run.position.z,10);
    assert.equal(run.rotation.y,side==='side'?-Math.PI/2:0);
    assert.equal(run.getObjectByName('Continuous authored bamboo').children[0].material,material);
  }
});
