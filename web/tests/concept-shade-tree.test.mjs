import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONCEPT_SHADE_TREE, createReferenceShadeTree } from '../src/world/referenceShadeTree.ts';
import { createHomeStage, HOME } from '../src/world/homeStage.ts';
import { GARDEN, plantingPlaces } from '../src/world/gardenLayout.ts';
import { HOME_SCENIC_CAMERA } from '../src/world/homeScenicCamera.ts';
import { REFERENCE_LEAF_PASS } from '../src/world/conceptLeafPass.ts';

function inside(box,x,z,r=.29){
  return Math.abs(x-box.center[0])<box.half[0]+r&&
    Math.abs(z-box.center[2])<box.half[2]+r;
}

test('approved old tropical shade tree is real 3D near the RIGHT garden side',async()=>{
  const stage=createHomeStage(false);
  await stage.ready;
  const tree=stage.root.getObjectByName('Concept mature shade tree near the garden');
  assert.ok(tree instanceof THREE.Group);
  assert.equal(tree.position.x,CONCEPT_SHADE_TREE.x);
  assert.equal(tree.position.z,CONCEPT_SHADE_TREE.z);
  assert.ok(CONCEPT_SHADE_TREE.height>=7,'the concept tree must be noticeably larger');
  assert.equal(tree.userData.referenceGLBLoaded,false,'safe local 3D placeholder');
  const crown=tree.getObjectByName('Hand-painted old shade tree crown and branches');
  const roots=tree.getObjectByName('Exposed hand-painted buttress roots');
  assert.ok(crown instanceof THREE.Group);
  assert.ok(roots instanceof THREE.Mesh);
  const sprays=tree.getObjectByName('Reference broad hand-painted leaf sprays');
  assert.ok(sprays instanceof THREE.InstancedMesh,'curved leaf sprays must be genuine 3D instances');
  assert.equal(sprays.count,REFERENCE_LEAF_PASS.sprays);
  assert.equal(sprays.userData.isTrue3D,true);
  assert.equal(sprays.userData.leavesPerSpray,7);
  assert.equal(sprays.geometry.userData.leafSilhouette,
    'curved-oval-3d-with-painted-midrib');
  assert.ok(sprays.geometry.getAttribute('uv').count>300);
  assert.equal(sprays.material.map.colorSpace,THREE.SRGBColorSpace);
  assert.equal(sprays.material.toneMapped,false);
  assert.equal(sprays.material.side,THREE.DoubleSide);
  assert.equal(sprays.instanceColor.count,REFERENCE_LEAF_PASS.sprays);
  assert.ok(sprays.geometry.index===null,'real curved geometry, not a billboard quad');
  assert.equal(roots.geometry.userData.buttressRoots,8);
  assert.equal(roots.material.toneMapped,false);
  assert.equal(roots.material.map.colorSpace,THREE.SRGBColorSpace);
  assert.ok(roots.material.vertexColors);
  assert.ok(roots.geometry.getAttribute('uv').count>150);
  assert.ok(roots.geometry.getAttribute('position').count>150);
  assert.ok(roots.castShadow);
  assert.ok(crown.getObjectByName('UV hand-painted tree trunk and branches'));
  assert.ok(crown.getObjectByName('Layered individual UV-painted tree leaves'));
  const seedlings=tree.getObjectByName('Small 3D shade plants among natural buttress roots');
  assert.ok(seedlings instanceof THREE.InstancedMesh);
  assert.equal(seedlings.count,19);
  const bb=new THREE.Box3().setFromObject(tree);
  const dims=bb.getSize(new THREE.Vector3());
  assert.ok(dims.y>6.7&&dims.y<8.5,'tall but still playable');
  assert.ok(dims.x>5.0&&dims.z>5.0,'a wide lush shade crown, not a pole');
  assert.ok(dims.y>HOME.house.height,'concept tree canopy over roof height');
});

test('new tree is collision-aware yet keeps gate, garden, spawn and bridge clear',()=>{
  const stage=createHomeStage(false);
  const trunk=stage.solids.find(x=>x.label==='Mature garden canopy trunk');
  assert.ok(trunk,'trunk should be solid, not an invisible walk-through');
  assert.ok(trunk.half[0]>=.65&&trunk.half[0]<=.75);
  assert.equal(trunk.center[0],CONCEPT_SHADE_TREE.x);
  assert.equal(trunk.center[2],CONCEPT_SHADE_TREE.z);
  assert.ok(!inside(trunk,HOME.spawn.x,HOME.spawn.z));
  assert.ok(!inside(trunk,HOME.gate.x,HOME.gate.z));
  assert.ok(!inside(trunk,-20.5,8.3),'do not block route to the village');
  assert.ok(!inside(trunk,-45.5,8.6),'do not block river bridge');
  assert.ok(Math.abs(CONCEPT_SHADE_TREE.z-GARDEN.z)>GARDEN.depth/2+1.0);
  assert.ok(plantingPlaces.length===24);
  assert.ok(!plantingPlaces.some(p=>inside(trunk,p.x,p.z,0.5)));
  assert.ok(stage.root.getObjectByName('Old fruit tree'),'old fruit tree preserved');
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
  assert.ok(HOME_SCENIC_CAMERA.yaw<-.65&&HOME_SCENIC_CAMERA.yaw> -1.3);
  const stage=createHomeStage(false);
  assert.ok(stage.solids.every(s=>!inside(s,HOME_SCENIC_CAMERA.x,HOME_SCENIC_CAMERA.z,0.3)),
    'opt-in camera spawns player on clear riverbank, not inside the well or a tree');
  assert.deepEqual(HOME.spawn,{x:-29.5,y:1.2,z:7.4},
    'existing standard spawn stays unchanged');
});
