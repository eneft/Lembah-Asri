import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  configureSunShadows, focusSunShadows, createPaintedShadowReceiver,
  createCharacterContactShadow, updateCharacterContactShadow
} from '../src/world/sceneShadows.ts';

test('sun keeps the home and actor inside a bounded mobile shadow map', () => {
  const sun = new THREE.DirectionalLight('white', 2);
  configureSunShadows(sun, true);
  assert.equal(sun.castShadow, true);
  assert.equal(sun.shadow.mapSize.x, 1024);
  assert.equal(sun.shadow.camera.left, -25);
  assert.equal(sun.shadow.camera.right, 25);
  assert.equal(sun.shadow.camera.far, 115);
  focusSunShadows(sun, -29.5, 7.4);
  assert.ok(Math.abs(sun.target.position.x + 29.5) < 0.05);
  assert.ok(Math.abs(sun.target.position.z - 7.4) < 0.05);
  assert.ok(Math.abs(sun.position.x - sun.target.position.x + 18) < 1e-7);
  assert.ok(Math.abs(sun.position.z - sun.target.position.z + 12) < 1e-7);
  const old = sun.position.clone();
  focusSunShadows(sun, 5.5, -18);
  assert.ok(sun.position.distanceTo(old) > 30, 'shadow frustum follows the actor across the village');
  const prev = sun.position.clone();
  focusSunShadows(sun, NaN, 0);
  assert.deepEqual(sun.position, prev, 'invalid physics frame never corrupts shadow light');
  configureSunShadows(sun, false);
  assert.equal(sun.shadow.mapSize.x, 2048);
  assert.equal(sun.shadow.camera.right, 31);
});

test('transparent shadow receivers preserve textured terrain color and depth', () => {
  const world = createPaintedShadowReceiver('World painted-terrain real shadows', 160,160,0,0,0.103);
  assert.ok(world.material instanceof THREE.ShadowMaterial);
  assert.equal(world.receiveShadow,true);
  assert.equal(world.castShadow,false);
  assert.equal(world.material.transparent,true);
  assert.equal(world.material.depthWrite,false);
  assert.equal(world.material.opacity,0.43);
  assert.equal(world.material.toneMapped,false);
  assert.equal(world.rotation.x,-Math.PI/2);
  assert.equal(world.renderOrder,6);
  assert.equal(world.userData.paintedShadowReceiver,true);
  const plaza = createPaintedShadowReceiver('Village plaza real shadows',24,18,0,-5,0.151);
  assert.equal(plaza.geometry.parameters.width,24);
  assert.equal(plaza.position.y,0.151);
  assert.throws(()=>createPaintedShadowReceiver('bad',-1,10,0,0,0));
});

test('contact shadow is a tiny feathered alpha texture below the moving character', () => {
  const shadow = createCharacterContactShadow();
  assert.equal(shadow.visible,false, 'do not draw a stray shadow before FBX loads');
  assert.equal(shadow.castShadow,false);
  assert.equal(shadow.receiveShadow,false);
  assert.equal(shadow.material.transparent,true);
  assert.equal(shadow.material.depthWrite,false);
  assert.ok(shadow.material.map instanceof THREE.DataTexture);
  assert.equal(shadow.material.map.image.width,64);
  assert.equal(shadow.renderOrder,7);
  const bytes = shadow.material.map.image.data;
  const alpha = (x,y)=>bytes[(y*64+x)*4+3];
  assert.ok(alpha(32,32)>alpha(0,0));
  const ground = new THREE.Vector3(-29.5,0,7.4);
  updateCharacterContactShadow(shadow, ground);
  assert.equal(shadow.visible,true);
  assert.equal(shadow.position.x,ground.x);
  assert.equal(shadow.position.z,ground.z);
  assert.equal(shadow.material.opacity,0.35);
  updateCharacterContactShadow(shadow, new THREE.Vector3(-28.5,2,6));
  assert.ok(shadow.material.opacity<0.35, 'jump softens rather than removes contact shadow');
  assert.ok(shadow.scale.x>1, 'jump expands shadow softly');
});

test('Game installs real shadow reception for soil and plaza, and follows player', () => {
  const source=readFileSync(fileURLToPath(new URL('../src/world/Game.ts', import.meta.url)),'utf8');
  assert.match(source,/configureSunShadows\(sun, mobile\)/);
  assert.match(source,/focusSunShadows\(sun, HOME\.spawn\.x, HOME\.spawn\.z, this\.sunOffset\)/);
  assert.match(source,/this\.scene\.add\(sun, sun\.target\)/);
  assert.match(source,/World painted-terrain real shadows/);
  assert.match(source,/Village plaza real shadows/);
  assert.match(source,/this\.scene\.add\(this\.characterContactShadow\)/);
  assert.match(source,/focusSunShadows\(this\.sunLight, target\.x, target\.z, this\.sunOffset\)/);
  assert.match(source,/updateCharacterContactShadow\(this\.characterContactShadow, target\)/);
});
