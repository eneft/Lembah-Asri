import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  CREEK,CLEAR_WATER_STAGE3,CREEK_FOAM_FLOW,ROCK_WAKES,
  createHomeCreek,updateHomeCreekWater
} from '../src/world/homeCreek.ts';
import {creekCenterX} from '../src/world/creekCourse.ts';
import {selectedHomeRocks} from '../src/world/homeRocks.ts';

function compiled(mat) {
  const shader={
    vertexShader:'#include <begin_vertex>',
    fragmentShader:'#include <map_fragment>\n#include <color_fragment>',
    uniforms:{}
  };
  mat.onBeforeCompile(shader,{});
  return shader;
}

test('Stage 3 water retains authored texture while revealing real submerged rocks',()=>{
  const root=createHomeCreek();
  const water=root.getObjectByName('Shallow stream west of childhood home');
  const bed=root.getObjectByName('Visible gravel bed below clear creek water');
  assert.ok(water instanceof THREE.Mesh && bed instanceof THREE.Mesh);
  const material=water.material;
  assert.equal(CLEAR_WATER_STAGE3.style,'clear-turquoise-painterly-stage3-v1');
  assert.equal(material.userData.clearWaterStyle,CLEAR_WATER_STAGE3.style);
  assert.equal(material.opacity,CLEAR_WATER_STAGE3.surfaceOpacity);
  assert.ok(material.opacity>=.77 && material.opacity<=.81);
  assert.equal(material.transparent,true);
  assert.equal(material.depthWrite,false);
  assert.ok(material.map?.isDataTexture);
  assert.notEqual(material.map,bed.material.map);
  assert.equal(bed.material.depthWrite,true);
  assert.equal(CREEK.bedY,-.65);
  assert.equal(CREEK.waterY,-.20);
  const shader=compiled(material);
  assert.match(shader.fragmentShader,/vec3 pool=mix\(vec3\(\.055,\.24,\.25\)/);
  assert.match(shader.fragmentShader,/vec3 margin=mix\(vec3\(\.12,\.33,\.295\)/);
  assert.match(shader.fragmentShader,/float highlight=smoothstep\(\.89,\.992/);
  assert.match(shader.fragmentShader,/diffuseColor\.a\*=mix\(\.92,\.46,shoal\)/);
  assert.match(shader.fragmentShader,/texture2D\(map,currentUV\)/);
  assert.match(material.customProgramCacheKey(),/clear-turquoise-water-stage3-v1/);
  assert.ok(material.opacity*CLEAR_WATER_STAGE3.centreAlpha<=.74,
    'centre water must be translucent enough to see the bed');
  assert.ok(material.opacity*CLEAR_WATER_STAGE3.shallowAlpha<.4,
    'river margins must blend into stones and shoreline');
  updateHomeCreekWater(water,3.4);
  assert.equal(water.userData.rippleUniform.value,3.4);
});

test('true submerged mossy GLBs are centred under stream, not on the bridge',()=>{
  const underwater=selectedHomeRocks.filter(p=>(p.submerge??0)>=1);
  const bankRocks=selectedHomeRocks.filter(p=>p.submerge!==undefined&&p.submerge<1);
  assert.equal(underwater.length,CLEAR_WATER_STAGE3.underwaterStones);
  assert.equal(bankRocks.length,11,'seven bank anchors and four midstream current breakers');
  assert.equal(bankRocks.filter(p=>p.midstream).length,4);
  for(const p of underwater){
    assert.equal(p.type,'mossy');
    assert.ok(p.size<=.65);
    assert.ok(Math.abs(p.x-creekCenterX(p.z))<.36);
    assert.ok(p.z<CREEK.bridgeMin-.1||p.z>CREEK.bridgeMax+.1);
    assert.ok(p.submerge>1, '3D rock top stays beneath water level');
  }
  assert.equal(ROCK_WAKES.length,bankRocks.length,
    'do not paint foam halos around stones entirely under water');
});

test('illustrated foam remains in sparse bank-side paths; waterbed and banks stay unchanged',()=>{
  const river=createHomeCreek();
  const foam=river.getObjectByName('Illustrated river foam and flow trails');
  const banks=[
    river.getObjectByName('Soft west creek bank'),
    river.getObjectByName('Soft east creek bank')
  ];
  const bed=river.getObjectByName('Visible gravel bed below clear creek water');
  assert.ok(foam instanceof THREE.Mesh);
  assert.ok(CREEK_FOAM_FLOW.opacityFraction>=.69&&CREEK_FOAM_FLOW.opacityFraction<=.71);
  const fs=compiled(foam.material);
  assert.match(fs.fragmentShader,/step\(\.62,seed\)/);
  assert.match(fs.fragmentShader,/float ink=paintedFoam\.a\*inside\*sporadic\*\.70/);
  assert.match(fs.fragmentShader,/targetAcross=lane==0/);
  assert.ok(foam.material.opacity<.75&&foam.material.opacity>.65);
  assert.ok(foam.material.map instanceof THREE.DataTexture);
  for(const bank of banks){
    assert.equal(bank.material.userData.bankStoneRestore,'natural-bank-ecotone-stage2-v1');
    assert.equal(bank.material.userData.clearWaterStyle,undefined);
  }
  assert.equal(bed.material.userData.clearWaterStyle,undefined);
  assert.equal(foam.material.userData.clearWaterStyle,undefined);
});

import { buildContactFoam, waterlineSegments } from '../src/world/rockContactFoam.ts';
test('contact foam uses actual rotated mesh waterline and excludes dry or submerged stones',()=>{
  const g=new THREE.BoxGeometry(.8,.6,.4);
  const rocks=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial(),3);
  const transform=new THREE.Object3D();
  for(let i=0;i<3;i++){
    transform.position.set(i*3,CREEK.waterY+(i===1?1:i===2?-1:0),0);
    transform.rotation.y=.7;
    transform.updateMatrix();rocks.setMatrixAt(i,transform.matrix);
  }
  const matrix=new THREE.Matrix4();rocks.getMatrixAt(0,matrix);
  assert.ok(waterlineSegments(g,matrix,CREEK.waterY).length>=4);
  rocks.getMatrixAt(1,matrix);assert.equal(waterlineSegments(g,matrix,CREEK.waterY).length,0);
  rocks.getMatrixAt(2,matrix);assert.equal(waterlineSegments(g,matrix,CREEK.waterY).length,0);
  const foam=buildContactFoam(rocks,CREEK.waterY);
  assert.equal(foam.userData.waterlineContacts,1);
  const p=foam.geometry.getAttribute('position');
  assert.ok(p.count>100);
  for(let i=0;i<p.count;i++){
    assert.ok(Math.abs(p.getY(i)-CREEK.waterY-.006)<1e-6);
    assert.ok(Math.abs(p.getX(i))<1,'no foam at the dry or underwater instances');
  }
  assert.equal(foam.material.depthWrite,false);
});
