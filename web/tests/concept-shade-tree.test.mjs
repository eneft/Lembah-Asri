import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONCEPT_SHADE_TREE, createReferenceShadeTree } from '../src/world/referenceShadeTree.ts';
import { createHomeStage, HOME, ORIGINAL_COURTYARD_FRUIT_TREE } from '../src/world/homeStage.ts';
import { GARDEN, plantingPlaces } from '../src/world/gardenLayout.ts';
import { HOME_SCENIC_CAMERA } from '../src/world/homeScenicCamera.ts';
import { REFERENCE_LEAF_PASS } from '../src/world/conceptLeafPass.ts';

function inside(box,x,z,r=.29){
  return Math.abs(x-box.center[0])<box.half[0]+r&&
    Math.abs(z-box.center[2])<box.half[2]+r;
}

test('restored pre-PR#93 yard has only the modest fruit tree beside well', async()=>{
  const stage=createHomeStage(false);
  await stage.ready;
  const tree=stage.root.getObjectByName('Old fruit tree');
  assert.ok(tree instanceof THREE.Group);
  assert.equal(tree.position.x,-40);
  assert.equal(tree.position.z,8.3);
  assert.deepEqual(ORIGINAL_COURTYARD_FRUIT_TREE,{
    x:-40,z:8.3,height:3.65,yaw:.21,seed:210917
  });
  assert.equal(stage.root.getObjectByName('Pohon tua di depan rumah'),undefined);
  assert.equal(stage.root.getObjectByName('Concept mature shade tree near the garden'),undefined);
  assert.equal(stage.root.getObjectByName('Small 3D shade plants among natural buttress roots'),undefined);
  const trunk=tree.getObjectByName('UV hand-painted tree trunk and branches');
  const leaves=tree.getObjectByName('Layered individual UV-painted tree leaves');
  assert.ok(trunk instanceof THREE.Mesh);
  assert.ok(leaves instanceof THREE.Mesh);
  assert.ok(trunk.material.map && leaves.material.map, 'retain hand-painted atlas');
  const bounds=new THREE.Box3().setFromObject(tree).getSize(new THREE.Vector3());
  assert.ok(bounds.y>3.2 && bounds.y<4.2,'return to a modest 3.65 m fruit tree');
});

test('pre-PR#93 removes obsolete big tree colliders, preserves farming and all access',()=>{
  const stage=createHomeStage(false);
  assert.ok(!stage.solids.some(s=>/sentinel|shade trunk/i.test(s.label)),
    'do not leave invisible walls where the big tree used to be');
  for(const spot of [
    [HOME.spawn.x,HOME.spawn.z],[HOME.gate.x,HOME.gate.z],
    [ORIGINAL_COURTYARD_FRUIT_TREE.x,ORIGINAL_COURTYARD_FRUIT_TREE.z],
    [-33.9,8.6],[-45.5,8.6]
  ]){
    assert.ok(stage.solids.every(s=>!inside(s,spot[0],spot[1],.28)),
      'tree restoration cannot block walking at '+spot.join(','));
  }
  assert.equal(plantingPlaces.length,24);
  assert.ok(plantingPlaces.every(p=>stage.solids.every(s=>!inside(s,p.x,p.z,.5))));
  assert.ok(stage.root.getObjectByName('West wooden bridge walkway'));
  assert.ok(stage.root.getObjectByName('Fine soft creek bank grass'));
  assert.ok(stage.root.getObjectByName('Old village well stone rim'));
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
