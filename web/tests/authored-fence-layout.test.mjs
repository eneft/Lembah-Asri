import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {prepareSharedFence,createSharedFenceRun,fenceIslands} from '../src/world/authoredFenceLayout.ts';
import {createHomeStage} from '../src/world/homeStage.ts';

function original(){
  const b=readFileSync(new URL('../public/models/environment/pagar_bambu_asri.glb',import.meta.url));
  const n=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+n)),base=28+n;
  const read=(id,components)=>{
    const a=j.accessors[id],v=j.bufferViews[a.bufferView],bytes=a.componentType===5126?4:a.componentType===5123?2:4;
    const out=[];
    for(let i=0;i<a.count;i++)for(let k=0;k<components;k++){
      const offset=base+(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??components*bytes)+k*bytes;
      out.push(a.componentType===5126?b.readFloatLE(offset):a.componentType===5123?b.readUInt16LE(offset):b.readUInt32LE(offset));
    }
    return out;
  };
  const root=new THREE.Group();
  for(const nd of j.nodes.filter(n=>n.mesh!==undefined)){
    const p=j.meshes[nd.mesh].primitives[0],g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(read(p.attributes.POSITION,3),3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(read(p.attributes.NORMAL,3),3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(read(p.attributes.TEXCOORD_0,2),2));
    g.setIndex(read(p.indices,1));
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial());
    m.name=nd.name;m.position.fromArray(nd.translation??[0,0,0]);root.add(m);
  }
  return root;
}
test('actual uploaded GLB: repeat removes one complete structural post, never edits UV or triangle corners',()=>{
  const src=original(),p=prepareSharedFence(src),wood=p.batches.find(m=>m.name==='01_Bambu');
  assert.equal(p.batches.length,4);
  assert.ok(p.pitch>.83&&p.pitch<.86);
  assert.equal(wood.removed,1);
  assert.equal(fenceIslands(wood.full).length,14);
  assert.equal(fenceIslands(wood.repeat).length,13);
  for(const part of p.batches){
    const origin=src.getObjectByName(part.name);
    assert.equal(part.material,origin.material);
    assert.deepEqual(part.full.attributes.uv.array,origin.geometry.attributes.uv.array);
    assert.deepEqual(part.repeat.attributes.uv.array,origin.geometry.attributes.uv.array);
    const a=part.full.index.array,originalTriangles=new Set();
    for(let i=0;i<a.length;i+=3)originalTriangles.add(a.slice(i,i+3).join(','));
    const b=part.repeat.index.array;
    for(let i=0;i<b.length;i+=3)assert.ok(originalTriangles.has(b.slice(i,i+3).join(',')));
  }
});
test('every courtyard run has one shared post per joint, matching heights and center-to-center pitch',()=>{
  const p=prepareSharedFence(original());
  for(const mode of [false,true]){
    const stage=createHomeStage(false,mode,true);
    for(const run of stage.solids.filter(s=>s.label.includes('fence'))){
      const group=createSharedFenceRun(p,run),meta=group.userData;
      assert.equal(meta.postCount,meta.moduleCount*2+1);
      assert.equal(meta.moduleHeight,1.45);
      assert.equal(meta.commonHeightScale,p.scale);
      assert.equal(meta.runLength,2*Math.max(run.half[0],run.half[2]));
      const full=group.getObjectByName('01_Bambu'),repeat=group.getObjectByName('01_Bambu — shared post repeat');
      const a=new THREE.Matrix4(),b=new THREE.Matrix4();
      full.getMatrixAt(0,a);
      assert.equal(full.count,1);
      if(repeat){
        assert.equal(repeat.count,meta.moduleCount-1);
        for(let i=0;i<repeat.count;i++){
          repeat.getMatrixAt(i,b);
          assert.ok(Math.abs(b.elements[12]-a.elements[12]-(i+1)*meta.sharedPitch)<1e-5);
          assert.equal(a.elements[13],b.elements[13]);
          assert.equal(a.elements[14],b.elements[14]);
          assert.equal(a.elements[5],b.elements[5]);
        }
      }
    }
  }
});
