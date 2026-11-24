import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHomeCreekVegetation, createHomeCreek, CLEAR_WATER_STAGE3, ROCK_WAKES } from '../src/world/homeCreek.ts';
import { selectedHomeRocks, createCuratedRockGroup } from '../src/world/homeRocks.ts';
import { creekCenterX, creekWidth, CREEK } from '../src/world/creekCourse.ts';
import { createHomeStage } from '../src/world/homeStage.ts';

function positions(mesh) {
  const matrix=new THREE.Matrix4(), xyz=new THREE.Vector3();
  return Array.from({length:mesh.count},(_,i)=>{
    mesh.getMatrixAt(i,matrix);
    xyz.setFromMatrixPosition(matrix);
    return {x:xyz.x,y:xyz.y,z:xyz.z,
      scale:new THREE.Vector3().setFromMatrixScale(matrix).x};
  });
}

test('Stage 4 groups low sedges along scattered banks, with tall plants only by exposed boulders',()=>{
  const group=createHomeCreekVegetation();
  const grass=group.getObjectByName('Stream clustered bank grasses');
  const leaves=group.getObjectByName('Stream broadleaf foliage clusters');
  const flowers=group.getObjectByName('White wildflowers along the grassy creek');
  assert.equal(group.name,'Curated creek bank reeds and leafy clumps');
  assert.equal(group.userData.shoreStyle,'localized-boulder-sedge-stage4-v1');
  assert.equal(group.userData.clusters,17,'keep planted far-bank reaches');
  assert.equal(group.children.length,3,'no extra draw calls for tall/low foliage or flowers');
  assert.ok(group.children.every(o=>o instanceof THREE.InstancedMesh));
  assert.ok(grass.count>70 && leaves.count>20);
  assert.equal(grass.count,group.userData.reedInstances);
  assert.equal(leaves.count,group.userData.shrubInstances);
  assert.equal(flowers.count,group.userData.flowerInstances);
  assert.equal(group.userData.tallAccentInstances,7);
  assert.ok(group.userData.lowGrassInstances>=75);
  assert.ok(group.userData.lowGrassInstances>group.userData.tallAccentInstances*10,
    'low plants must dominate as in the user reference');
  assert.equal(flowers.count,14,'only around seven emerged boulder clusters');
  const dryOpen=group.userData.clusters*3-flowers.count;
  assert.ok(dryOpen>30,'do not repeat flowers uniformly on both banks');

  const boulders=selectedHomeRocks.filter(p=>
    p.zone==='stream' && p.submerge!==undefined && p.submerge<1
  );
  assert.equal(boulders.length,7);
  assert.equal(ROCK_WAKES.length,boulders.length,'do not alter Stage 3 rock wake composition');
  assert.equal(CLEAR_WATER_STAGE3.style,'clear-turquoise-painterly-stage3-v1');
  for(const mesh of [grass,leaves,flowers]){
    assert.ok(mesh.count>0);
    assert.equal(mesh.castShadow,false);
    assert.ok(!mesh.geometry.getAttribute('uv') || mesh.geometry.getAttribute('position'));
    for(const pos of positions(mesh)){
      const setback=Math.abs(pos.x-creekCenterX(pos.z))-creekWidth(pos.z)*.5;
      assert.ok(setback>.55 && setback<1.88,
        'vegetation stays on the grassy shoulder, never on water or 3D bank: '+JSON.stringify(pos));
      assert.ok(pos.z<CREEK.bridgeMin-.22||pos.z>CREEK.bridgeMax+.22,
        'bridge remains free of bank shrubs, flowers and sedges');
    }
  }
  for(const pos of positions(flowers)){
    assert.ok(boulders.some(b=>
      Math.abs(b.z-pos.z)<2.2 &&
      (b.x<creekCenterX(b.z))===(pos.x<creekCenterX(pos.z))),
      'wildflowers must hug existing real emerged mossy rocks');
  }
  assert.ok(positions(leaves).filter(p=>p.z<-25).length>=3);
});

test('existing UV mossy river stones keep size, source textures and low-key grey/moss palette',()=>{
  const source=new THREE.Group();
  const tex=new THREE.DataTexture(new Uint8Array([153,144,127,255]),1,1,THREE.RGBAFormat);
  tex.colorSpace=THREE.SRGBColorSpace;
  for(const id of [0,2]){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.30,.30,.30),new THREE.MeshStandardMaterial({map:tex}));
    mesh.name='LA_Rock_'+String(id).padStart(2,'0');
    mesh.userData.originalIndex=id;
    source.add(mesh);
  }
  const rocks=createCuratedRockGroup(source);
  assert.equal(rocks.children.length,2,'reuse exactly the same two UV models');
  const count=rocks.children.reduce((sum,child)=>sum+child.count,0);
  assert.equal(count,selectedHomeRocks.length,'do not add/remove scenic stone placements');
  const moss=rocks.getObjectByName('UV mossy rock variant 00');
  const dry=rocks.getObjectByName('UV plain rock variant 02');
  assert.equal(moss.material.map,tex,'retain original sRGB albedo');
  assert.equal(dry.material.map,tex);
  assert.equal(moss.material.userData.shoreStoneStyle,'warm-grey-soft-moss-stage4-v1');
  assert.equal(dry.material.userData.shoreStoneStyle,undefined);
  assert.match(moss.material.customProgramCacheKey(),/stage4/);
  const shader={vertexShader:'#include <begin_vertex>',
    fragmentShader:'#include <color_fragment>',uniforms:{}};
  moss.material.onBeforeCompile(shader,{});
  assert.match(shader.fragmentShader,/vec3 rock=mix\(vec3\(\.18,\.175,\.165\)/);
  assert.match(shader.fragmentShader,/rock\*=mix\(vec3\(\.79,\.86,\.80\)/);
  assert.match(shader.fragmentShader,/vec3 green=mix\(vec3\(\.15,\.23,\.10\)/);
  assert.match(shader.fragmentShader,/moss\*\.72/);
  assert.equal(rocks.userData.partiallySubmergedRocks,7);
  assert.equal(rocks.userData.fullySubmergedRocks,4);
});

test('new accents change only visible scene composition, not house, bridge or physics',()=>{
  const stage=createHomeStage(false);
  const planting=stage.root.getObjectByName('Curated creek bank reeds and leafy clumps');
  assert.ok(planting instanceof THREE.Group);
  assert.equal(planting.userData.shoreStyle,'localized-boulder-sedge-stage4-v1');
  const river=createHomeCreek();
  const water=river.getObjectByName('Shallow stream west of childhood home');
  assert.equal(water.material.userData.clearWaterStyle,CLEAR_WATER_STAGE3.style);
  assert.ok(stage.root.getObjectByName('West wooden bridge walkway'));
  assert.ok(stage.root.getObjectByName('Old fruit tree'));
  assert.ok(stage.root.getObjectByName('Old village well stone rim'));
  assert.ok(stage.solids.some(s=>s.label==='Childhood home walls'));
  assert.ok(!stage.solids.some(s=>/creek|bank|reeds|rock/i.test(s.label)),
    'decorative shoreline plants/rocks never introduce blocking colliders');
  assert.ok(stage.gardenGround.vertices.length>0,'farming ground preserved');
});
