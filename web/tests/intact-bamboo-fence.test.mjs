import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {makeIntactCane,createIntactFenceRun,makeIntactFenceMaterial,INTACT_FENCE_REVISION,INTACT_FENCE_ATLAS} from '../src/world/intactBambooFence.ts';
import {createHomeStage} from '../src/world/homeStage.ts';

test('every cane has continuous real hollow geometry with closed walls and valid UVs',()=>{
  for(const kind of ['cane','rail']){
    const g=makeIntactCane(kind),p=g.attributes.position,uv=g.attributes.uv,n=g.attributes.normal;
    const keys=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1e5)).join(','));
    const edges=new Map(),idx=g.index.array;
    for(let i=0;i<idx.length;i+=3){
      for(let j=0;j<3;j++){
        const a=keys[idx[i+j]],b=keys[idx[i+(j+1)%3]];
        assert.notEqual(a,b);
        const k=[a,b].sort().join('|');edges.set(k,(edges.get(k)??0)+1);
      }
    }
    assert.ok([...edges.values()].every(count=>count===2),'all spatial edges have exactly two incident triangles');
    for(let i=0;i<p.count;i++){
      assert.ok([uv.getX(i),uv.getY(i)].every(x=>Number.isFinite(x)&&x>0&&x<1));
      assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n,i).length()-1)<.001);
    }
    assert.ok(keys.some(k=>k==='0,92000,0'),'visible recessed top diaphragm');
    assert.equal(g.userData.completeCane,true);
    assert.equal(g.userData.independentUV,true);
  }
});

test('every actual home fence run uses separated unbroken canes, continuous rails and unchanged footprint',()=>{
  const mat=makeIntactFenceMaterial(new THREE.Texture());
  assert.equal(mat.type,'MeshBasicMaterial');assert.equal(mat.toneMapped,false);
  const stage=createHomeStage(false,false,true);
  for(const run of stage.solids.filter(s=>s.label.includes('fence'))){
    const group=createIntactFenceRun(run,mat);
    assert.equal(group.userData.spacingRevision,INTACT_FENCE_REVISION);
    assert.equal(group.userData.runLength,2*Math.max(run.half[0],run.half[2]));
    assert.equal(group.userData.moduleHeight,1.45);
    assert.deepEqual(group.position.toArray(),[run.center[0],0,run.center[2]]);
    assert.ok(group.userData.bayGaps.every(gap=>gap>.15&&gap<.34),run.label);
    const posts=group.getObjectByName('Complete hollow bamboo posts');
    const pickets=group.getObjectByName('Complete separated bamboo pickets');
    const rails=group.getObjectByName('Continuous bamboo rails');
    assert.ok(posts.geometry.userData.completeCane&&pickets.geometry.userData.completeCane&&rails.geometry.userData.completeCane);
    assert.equal(rails.count,2*(posts.count-1));
    assert.ok(group.getObjectByName('Continuous rattan wraps').count>0);
    const m=new THREE.Matrix4(),v=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
    for(let i=0;i<pickets.count;i++){
      pickets.getMatrixAt(i,m);m.decompose(v,q,s);
      assert.ok(s.y>=1.2-1e-5&&s.y<=1.27+1e-5);
      assert.ok(Math.abs(s.x-s.z)<1e-5,'cane remains circular, not flattened');
    }
  }
  const loader=readFileSync(new URL('../src/world/uploadedHomeFence.ts',import.meta.url),'utf8');
  const body=loader.slice(loader.indexOf('export async function loadUploadedHomeFence'));
  assert.match(body,/createIntactFenceRun/);
  assert.ok(!body.includes('createOpenFenceModule'));
  assert.ok(!body.includes('trimFenceLeft'));
  assert.ok(readFileSync(new URL('../public/'+INTACT_FENCE_ATLAS.slice(2),import.meta.url)).length>1000);
});
