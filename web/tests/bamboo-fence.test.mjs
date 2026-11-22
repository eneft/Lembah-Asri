import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import {
  BAMBOO_PBR_MAPS, bambooPBRMaterial,
  createUVBambooFence, mapBambooUV
} from '../src/world/bambooFence.ts';
import { createHomeStage, HOME } from '../src/world/homeStage.ts';

const filename = (name)=>fileURLToPath(new URL(
  '../public/textures/fence/'+name,import.meta.url
));

test('reference-derived bamboo texture atlas is shipped as three actual PBR image files',()=>{
  const albedo=readFileSync(filename('bamboo_albedo.webp'));
  assert.equal(albedo.subarray(0,4).toString(),'RIFF');
  assert.equal(albedo.subarray(8,12).toString(),'WEBP');
  assert.ok(albedo.byteLength>5000,'not a solid color');
  assert.ok(albedo.byteLength<100_000,'hand-painted PBR albedo optimized for mobile');
  for(const name of ['bamboo_normal.png','bamboo_roughness.png']){
    const bytes=readFileSync(filename(name));
    assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.equal(bytes.readUInt32BE(16),512);
    assert.equal(bytes.readUInt32BE(20),512);
    assert.ok(bytes.byteLength>3000);
    assert.ok(bytes.byteLength<110_000);
  }
  assert.match(BAMBOO_PBR_MAPS.albedo,/bamboo_albedo\.webp/);
  assert.match(BAMBOO_PBR_MAPS.normal,/bamboo_normal\.png/);
  assert.match(BAMBOO_PBR_MAPS.roughness,/bamboo_roughness\.png/);
  assert.equal(bambooPBRMaterial.type,'MeshStandardMaterial');
  assert.equal(bambooPBRMaterial.metalness,0);
  assert.ok(bambooPBRMaterial.roughness>=.85);
  assert.ok(bambooPBRMaterial.normalScale.x>0 && bambooPBRMaterial.normalScale.x<.35);
});

test('every bamboo geometry is real 3D with UV island in its dedicated atlas tile',()=>{
  for(const [tile,originU,originV] of [
    ['vertical',0,.5],['horizontal',.5,.5],['rattan',0,0],['endcap',.5,0]
  ]){
    const geo=mapBambooUV(new THREE.CylinderGeometry(.08,.08,.8,8,3),tile);
    const uv=geo.getAttribute('uv');
    const pos=geo.getAttribute('position');
    assert.equal(uv.count,pos.count);
    assert.ok(pos.count>30);
    for(let i=0;i<uv.count;i++){
      assert.ok(uv.getX(i)>originU+.005 && uv.getX(i)<originU+.5-.005);
      assert.ok(uv.getY(i)>originV+.005 && uv.getY(i)<originV+.5-.005);
    }
    geo.dispose();
  }
});

test('bamboo fence is cylindrical posts and round rails rather than untextured box props',()=>{
  for(const direction of ['x','z']){
    const fence=createUVBambooFence('Test bamboo fence',12,-4,6,direction);
    assert.equal(fence.userData.bambooFence,true);
    assert.match(fence.userData.pbr,/albedo\+normal\+roughness/);
    assert.equal(fence.children.length,6,'six instanced geometry batches regardless of fence length');
    assert.ok(fence.children.every(child=>child instanceof THREE.InstancedMesh));
    assert.ok(fence.children.every(child=>child.material===bambooPBRMaterial));
    assert.ok(fence.children.every(child=>child.geometry.getAttribute('uv')));
    const {supportPosts,pickets,railSections,joints,length,axis}=fence.userData.stats;
    assert.equal(length,6);
    assert.equal(axis,direction);
    assert.ok(supportPosts>=4);
    assert.ok(pickets>=9);
    assert.ok(railSections>=6);
    assert.ok(joints>=8);
    const post=fence.getObjectByName('Test bamboo fence bamboo support posts');
    const rail=fence.getObjectByName('Test bamboo fence bamboo horizontal rails');
    const nodes=fence.getObjectByName('Test bamboo fence raised bamboo nodes');
    const caps=fence.getObjectByName('Test bamboo fence bamboo cut ends');
    const ties=fence.getObjectByName('Test bamboo fence woven rattan cross ties');
    assert.ok(post&&rail&&nodes&&caps&&ties);
    assert.ok(post.geometry.type==='CylinderGeometry');
    assert.ok(rail.geometry.type==='CylinderGeometry');
    assert.ok(nodes.geometry.type==='TorusGeometry');
    assert.ok(caps.geometry.type==='CircleGeometry');
    assert.ok(ties.geometry.type==='BoxGeometry');
    assert.ok(rail.geometry.getAttribute('normal'));
    assert.ok(rail.castShadow && post.castShadow);
    assert.equal(fence.position.x,12);
    assert.equal(fence.position.z,-4);
    assert.equal(fence.rotation.y,direction==='z'?-Math.PI/2:0);
    const m=new THREE.Matrix4();
    rail.getMatrixAt(0,m);
    const scale=new THREE.Vector3().setFromMatrixScale(m);
    assert.ok(scale.y>1.4,'rails have genuine world-space length');
    fence.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(fence);
    assert.ok(Math.max(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)>5.5);
    assert.ok(bounds.max.y>1.40);
  }
});

test('home replaces every old brown timber fence, preserving positions and open gate',async()=>{
  const stage=createHomeStage(false);
  await stage.ready;
  const names=[
    'North rear fence','South front fence','East side fence north',
    'East side fence south','West side fence north','West side fence south'
  ];
  for(const label of names){
    const visual=stage.root.getObjectByName('Bamboo UV PBR — '+label);
    assert.ok(visual,label+' has new PBR bamboo mesh');
    assert.equal(visual.children.length,6);
    const physical=stage.solids.find(s=>s.label===label);
    assert.ok(physical,label+' keeps the old collision footprint');
    assert.equal(visual.position.x,physical.center[0]);
    assert.equal(visual.position.z,physical.center[2]);
    assert.equal(stage.root.getObjectByName(label+' timber rails'),undefined);
    assert.equal(stage.root.getObjectByName(label+' fence post'),undefined);
  }
  assert.equal(stage.solids.filter(s=>names.includes(s.label)).length,6);
  const gateX=HOME.gate.x,gateZ=HOME.gate.z;
  for(const s of stage.solids.filter(s=>names.includes(s.label))){
    const [hx,,hz]=s.half;
    assert.ok(!(Math.abs(s.center[0]-gateX)<hx+.4 &&
      Math.abs(s.center[2]-gateZ)<hz+.4),'village gate stays open');
  }
  assert.ok(stage.root.getObjectByName('West wooden bridge walkway'));
  assert.ok(stage.root.getObjectByName('Old village well stone rim'));
});
