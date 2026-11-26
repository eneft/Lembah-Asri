import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AUTHORED_FENCE_SHA256,createAuthoredFenceRun} from '../src/world/authoredBambooFence.ts';
import * as THREE from 'three';
import {createHomeStage} from '../src/world/homeStage.ts';

test('original uploaded GLB is byte-identical, with four meshes and four original textures',()=>{
  const b=readFileSync(new URL('../public/models/environment/pagar_bambu_asri.glb',import.meta.url));
  assert.equal(createHash('sha256').update(b).digest('hex'),AUTHORED_FENCE_SHA256);
  assert.equal(b.toString('ascii',0,4),'glTF');
  assert.equal(b.readUInt32LE(4),2);
  assert.equal(b.readUInt32LE(8),b.length);
  const j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
  assert.equal(j.meshes.length,4);
  assert.equal(j.images.length,4);
  assert.equal(j.materials.length,4);
  const names=['01_Bambu','02_Ikatan_bambu','03_Sulur_dan_daun','04_Rumput_batu_bunga'];
  for(const name of names)assert.ok(j.nodes.some(n=>n.name===name));
  let tris=0;
  for(const m of j.meshes)for(const p of m.primitives){
    assert.ok(p.attributes.TEXCOORD_0!==undefined&&p.attributes.NORMAL!==undefined);
    assert.ok(j.materials[p.material].pbrMetallicRoughness.baseColorTexture);
    tris+=j.accessors[p.indices].count/3;
  }
  assert.equal(tris,17250);
});

test('whole module placement preserves mesh/material references and uniform proportions for each existing fence run',()=>{
  const src=new THREE.Group();
  for(const name of ['01_Bambu','02_Ikatan_bambu','03_Sulur_dan_daun','04_Rumput_batu_bunga']){
    const m=new THREE.Mesh(new THREE.BoxGeometry(.9375,.380554,.17),new THREE.MeshStandardMaterial());
    m.name=name;m.position.y=.190277;src.add(m);
  }
  const stage=createHomeStage(false,false,true);
  for(const run of stage.solids.filter(s=>s.label.includes('fence'))){
    const group=createAuthoredFenceRun(src,run),meta=group.userData;
    assert.equal(meta.runLength,2*Math.max(run.half[0],run.half[2]));
    assert.deepEqual(group.position.toArray(),[run.center[0],0,run.center[2]]);
    assert.equal(group.rotation.y,run.half[0]>run.half[2]?0:-Math.PI/2);
    const meshes=group.getObjectByName('Original bamboo fence modules').children;
    assert.equal(meshes.length,4);
    for(const mesh of meshes){
      assert.equal(mesh.geometry,src.getObjectByName(mesh.name).geometry);
      assert.equal(mesh.material,src.getObjectByName(mesh.name).material);
      const m=new THREE.Matrix4(),s=new THREE.Vector3();
      for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,m);
        m.decompose(new THREE.Vector3(),new THREE.Quaternion(),s);
        assert.ok(Math.abs(s.x-s.y)<1e-5&&Math.abs(s.y-s.z)<1e-5);
      }
    }
  }
});
