import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  CREEK, creekCenterX, creekWidth, createHomeCreek,
  carveVisualCreek, updateHomeCreekWater, makeCreekAlbedo, makeCreekBedAlbedo
} from '../src/world/homeCreek.ts';
import { createHomeStage } from '../src/world/homeStage.ts';

function heights(mesh) {
  const values=mesh.geometry.getAttribute('position');
  return Array.from({length:values.count},(_,i)=>values.getY(i));
}

test('water is really recessed below Y=0 with bank walls and gravel floor',()=>{
  const creek=createHomeCreek();
  assert.equal(creek.children.length,4);
  const surface=creek.getObjectByName('Shallow stream west of childhood home');
  const bed=creek.getObjectByName('Visible gravel bed below clear creek water');
  const west=creek.getObjectByName('Soft west creek bank');
  const east=creek.getObjectByName('Soft east creek bank');
  assert.ok(surface instanceof THREE.Mesh);
  assert.ok(bed instanceof THREE.Mesh);
  assert.ok(west instanceof THREE.Mesh);
  assert.ok(east instanceof THREE.Mesh);
  const yWater=heights(surface);
  const yBed=heights(bed);
  const yBank=heights(west);
  assert.ok(yWater.every(y=>Math.abs(y-CREEK.waterY)<.001));
  assert.ok(yBed.every(y=>y<CREEK.waterY-.32));
  assert.ok(Math.min(...yBank)<-.60,'bank slope falls below 60 cm');
  assert.ok(Math.max(...yBank)>0,'dry bank lip is raised above terrain');
  assert.equal(CREEK.bedY,-.65);
  assert.equal(CREEK.waterY,-.20);
  assert.ok(creekCenterX(1)!==creekCenterX(9));
  assert.ok(creekWidth(1)>2.5);
  assert.ok(surface.geometry.getAttribute('uv').count>500);
  assert.ok(bed.geometry.getAttribute('uv').count>350);
});

test('clear water shows submerged pebbles and no alphaHash stippling',()=>{
  const creek=createHomeCreek();
  const surface=creek.getObjectByName('Shallow stream west of childhood home');
  const bed=creek.getObjectByName('Visible gravel bed below clear creek water');
  assert.equal(surface.material.transparent,true);
  assert.ok(surface.material.opacity>.62&&surface.material.opacity<.85);
  assert.equal(surface.material.depthWrite,false);
  assert.notEqual(surface.material.alphaHash,true);
  assert.equal(surface.material.map,makeCreekAlbedo());
  assert.equal(bed.material.map,makeCreekBedAlbedo());
  assert.notEqual(bed.material.map,surface.material.map);
  assert.equal(bed.material.depthWrite,true);
  assert.equal(surface.userData.rippleType,'mobile-two-frequency');
  const map=bed.material.map.image.data;
  assert.ok(map.some((v,i)=>i%4!==3&&v>150));
  const ripple=surface.userData.rippleUniform;
  assert.equal(ripple.value,0);
  updateHomeCreekWater(surface,7.3);
  assert.equal(ripple.value,7.3);
  const shader={
    vertexShader:'#include <begin_vertex>',
    fragmentShader:'#include <map_fragment>',
    uniforms:{}
  };
  surface.material.onBeforeCompile(shader,{});
  assert.equal(shader.uniforms.uCreekTime,ripple);
  assert.match(shader.fragmentShader,/sin\(vCreekFlowXZ.y\*10.8/);
  assert.match(shader.fragmentShader,/highlight/);
  assert.match(shader.vertexShader,/vCreekFlowXZ/);
});

test('painted ground and shadow receiver both discard matching creek footprint',()=>{
  for(const material of [
    new THREE.MeshBasicMaterial({color:'#88bb77'}),
    new THREE.ShadowMaterial({opacity:.4,transparent:true})
  ]){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(10,10),material);
    const out=carveVisualCreek(mesh);
    assert.equal(out,mesh);
    assert.equal(mesh.userData.creekVisualCutout,true);
    assert.equal(material.userData.creekVisualCutout,true);
    assert.equal(carveVisualCreek(mesh),mesh,'idempotent mask');
    const shader={
      vertexShader:'#include <begin_vertex>',
      fragmentShader:'#include <clipping_planes_fragment>',
      uniforms:{}
    };
    material.onBeforeCompile(shader,{});
    assert.match(shader.vertexShader,/modelMatrix/);
    assert.match(shader.fragmentShader,/discard/);
    assert.match(shader.fragmentShader,/creekHalf|halfC/);
    assert.match(material.customProgramCacheKey(),/creek/);
  }
});

test('game home keeps walkable bridge while displaying a deep cut into courtyard',()=>{
  const home=createHomeStage(false);
  const creek=home.root.getObjectByName('Meandering shallow creek and earthen banks');
  const bed=home.root.getObjectByName('Visible gravel bed below clear creek water');
  const painted=home.root.getObjectByName('Childhood courtyard - earth clearing');
  assert.ok(creek);
  assert.ok(bed);
  assert.equal(painted.userData.creekVisualCutout,true);
  assert.ok(home.root.getObjectByName('West wooden bridge walkway'));
  assert.ok(home.root.getObjectByName('Old village well stone rim'));
  assert.ok(!home.solids.some(c=>/creek|bank|water/i.test(c.label)),
    'visual upgrade preserves physics and movement rules');
});
