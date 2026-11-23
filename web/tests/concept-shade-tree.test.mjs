import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONCEPT_SHADE_TREE, createReferenceShadeTree } from '../src/world/referenceShadeTree.ts';
import { createHomeStage, HOME, FRONT_YARD_SENTINEL } from '../src/world/homeStage.ts';
import { GARDEN, plantingPlaces } from '../src/world/gardenLayout.ts';
import { HOME_SCENIC_CAMERA } from '../src/world/homeScenicCamera.ts';
import { REFERENCE_LEAF_PASS } from '../src/world/conceptLeafPass.ts';

function inside(box,x,z,r=.29){
  return Math.abs(x-box.center[0])<box.half[0]+r&&
    Math.abs(z-box.center[2])<box.half[2]+r;
}

test('one biggest courtyard sentinel remains and both neighbouring yard trees are gone', async()=>{
  const stage=createHomeStage(false);
  await stage.ready;
  const tree=stage.root.getObjectByName('Pohon tua di depan rumah');
  assert.ok(tree instanceof THREE.Group);
  assert.equal(tree.position.x,FRONT_YARD_SENTINEL.x);
  assert.equal(tree.position.z,FRONT_YARD_SENTINEL.z);
  assert.equal(FRONT_YARD_SENTINEL.height,7.5);
  assert.equal(stage.root.getObjectByName('Old fruit tree'),undefined,
    'small orchard tree next to well removed even during loading');
  assert.equal(stage.root.getObjectByName('Concept mature shade tree near the garden'),undefined,
    'visually smaller second courtyard shade removed, not just hidden');
  const smallPlants=stage.root.getObjectByName('Small 3D shade plants among natural buttress roots');
  assert.ok(smallPlants instanceof THREE.InstancedMesh);
  assert.equal(smallPlants.count,19,'retain living groundcover by the big roots');
  const bark=tree.getObjectByName('UV hand-painted tree trunk and branches');
  assert.ok(bark instanceof THREE.Mesh);
  assert.equal(bark.material.userData.courtyardRetonedBark,true);
  const size=new THREE.Box3().setFromObject(tree).getSize(new THREE.Vector3());
  assert.ok(size.y>6.7&&size.y<8.5);
  assert.ok(size.x>3.5&&size.z>3.5);
});

test('new sentinel collider stays away from farm, spawn, well and river crossing',()=>{
  const stage=createHomeStage(false);
  const trunk=stage.solids.find(x=>x.label==='Front courtyard sentinel trunk');
  assert.ok(trunk);
  assert.equal(trunk.center[0],FRONT_YARD_SENTINEL.x);
  assert.equal(trunk.center[2],FRONT_YARD_SENTINEL.z);
  assert.ok(!inside(trunk,HOME.spawn.x,HOME.spawn.z));
  assert.ok(!inside(trunk,HOME.gate.x,HOME.gate.z));
  assert.ok(!inside(trunk,HOME.well.x,HOME.well.z));
  assert.ok(!inside(trunk,-45.5,8.6));
  assert.ok(plantingPlaces.every(p=>!inside(trunk,p.x,p.z,.5)));
  assert.equal(plantingPlaces.length,24);
  assert.ok(stage.root.getObjectByName('West wooden bridge walkway'));
  assert.ok(stage.root.getObjectByName('Fine soft creek bank grass'));
});

test('original hand-painted shade GLB remains the asynchronously loaded source',()=>{
  const tree=createReferenceShadeTree();
  assert.equal(tree.children.length,4,'original 3D tree + softened roots + seedlings + 3D leaf sprays');
  assert.equal(tree.userData.referenceSource,'matching UV-painted 3D fallback');
  let meshCount=0;
  tree.traverse(node=>{if(node instanceof THREE.Mesh)meshCount++;});
  assert.equal(meshCount,5);
  const roots=tree.getObjectByName('Exposed hand-painted buttress roots');
  const attr=roots.geometry.getAttribute('uv');
  for(let i=0;i<attr.count;i++){
    assert.ok(attr.getX(i)>=0&&attr.getX(i)<=1);
    assert.ok(attr.getY(i)>=0&&attr.getY(i)<=1);
  }
});

test('opt-in riverside scene camera frames the real home yard without moving the default spawn',()=>{
  assert.equal(HOME_SCENIC_CAMERA.query,'konsep');
  assert.ok(HOME_SCENIC_CAMERA.x>-43.5&&HOME_SCENIC_CAMERA.x<-40.5);
  assert.ok(HOME_SCENIC_CAMERA.z>4.5&&HOME_SCENIC_CAMERA.z<7.2);
  assert.ok(HOME_SCENIC_CAMERA.distance>=8.5&&HOME_SCENIC_CAMERA.distance<=11);
  assert.ok(Math.abs(HOME_SCENIC_CAMERA.yaw + Math.PI/2)<.2);
  const stage=createHomeStage(false);
  assert.ok(stage.solids.every(s=>!inside(s,HOME_SCENIC_CAMERA.x,HOME_SCENIC_CAMERA.z,0.3)),
    'opt-in camera spawns player on clear riverbank, not inside the well or a tree');
  assert.deepEqual(HOME.spawn,{x:-29.5,y:1.2,z:7.4},
    'existing standard spawn stays unchanged');
});
