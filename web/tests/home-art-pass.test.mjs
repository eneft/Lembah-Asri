import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createHomeArtPass, scatterHomeUndergrowth, makeBroadLeafGeometry
} from '../src/world/homeArtPass.ts';
import { isHomeGroundDetailAllowed } from '../src/world/homeGroundDetails.ts';
import { createHomeStage } from '../src/world/homeStage.ts';

test('understory is deterministic, distributed and does not invade playable routes', () => {
  const one = scatterHomeUndergrowth();
  const two = scatterHomeUndergrowth();
  assert.deepEqual(one, two, 'reloading the scene should not shuffle plants');
  assert.ok(one.length > 15 && one.length < 200,
    'mobile-safe foreground with visible natural gaps');
  assert.ok(one.every(p => isHomeGroundDetailAllowed(p.x, p.z)));
  assert.ok(one.every(p => p.scale > 0.3 && p.scale < 0.7));
  assert.ok(one.every(p => p.hue >= 0 && p.hue <= 1));
  assert.notDeepEqual(scatterHomeUndergrowth(91),one);
});

test('curved broadleaf vegetation has real 3D depth and baked hand-painted colors', () => {
  const geometry = makeBroadLeafGeometry();
  assert.ok(geometry instanceof THREE.BufferGeometry);
  const positions = geometry.getAttribute('position');
  const colors = geometry.getAttribute('color');
  assert.ok(positions.count > 60 && positions.count < 120);
  assert.equal(positions.count, colors.count);
  assert.ok(geometry.boundingSphere.radius > 0.1);
  assert.ok(geometry.boundingSphere.radius < 1.1);
  const ys=Array.from({length:positions.count},(_,i)=>positions.getY(i));
  const xs=Array.from({length:positions.count},(_,i)=>positions.getX(i));
  const zs=Array.from({length:positions.count},(_,i)=>positions.getZ(i));
  assert.ok(Math.max(...ys)>0.4);
  assert.ok(Math.max(...xs)-Math.min(...xs)>0.9);
  assert.ok(Math.max(...zs)-Math.min(...zs)>0.9);
  assert.notEqual(colors.getY(0),colors.getY(3), 'painted root/middle tone differs');
});

test('production environment pass is actual instanced 3D foliage and UV-textured stones', () => {
  const group = createHomeArtPass();
  assert.equal(group.name,'Lembah Asri hand-painted 3D environment art pass');
  assert.equal(group.children.length,7,'3 foliage and 4 stone batches, not dozens of draw calls');
  assert.ok(group.children.every(o => o instanceof THREE.InstancedMesh));
  const shrubs=group.getObjectByName('Natural shrubs around childhood home');
  const understory=group.getObjectByName('Natural varied understory meadow');
  const palms=group.getObjectByName('Tall tropical foliage behind home');
  assert.ok(shrubs && understory && palms);
  assert.ok(shrubs.count>=12);
  assert.equal(understory.count,scatterHomeUndergrowth().length);
  assert.equal(palms.count,3);
  assert.ok(shrubs.castShadow && palms.castShadow);
  assert.ok(!understory.castShadow,'understory should not tax iPhone shadow passes');
  assert.equal(shrubs.material.toneMapped,false);
  assert.equal(shrubs.material.vertexColors,true);
  assert.equal(shrubs.material.side,THREE.DoubleSide);
  assert.ok(shrubs.instanceColor);
  const stones=group.children.filter(o=>o.name.startsWith('Naturally shaped textured stepping stones'));
  assert.equal(stones.length,4);
  assert.equal(stones.reduce((n,s)=>n+s.count,0),10);
  assert.ok(stones.every(s=>s.material.map instanceof THREE.DataTexture));
  assert.ok(stones.every(s=>!s.castShadow && !s.receiveShadow));
  for(let variant=0;variant<4;variant++){
    const geometry=stones[variant].geometry;
    const uv=geometry.getAttribute('uv');
    const minU=(variant%2)*.5+.034,maxU=(variant%2)*.5+.467;
    const minV=Math.floor(variant/2)*.5+.034,maxV=Math.floor(variant/2)*.5+.467;
    for(let i=0;i<uv.count;i++){
      assert.ok(uv.getX(i)>=minU && uv.getX(i)<=maxU);
      assert.ok(uv.getY(i)>=minV && uv.getY(i)<=maxV);
    }
  }
});

test('visual-only update retains house/well, stepping stones are not collision blockers', () => {
  const stage=createHomeStage(false);
  assert.ok(stage.root.getObjectByName('Lembah Asri hand-painted 3D environment art pass'));
  assert.ok(stage.root.getObjectByName('Old village well stone rim'));
  assert.ok(stage.root.getObjectByName('Worn central courtyard'));
  assert.ok(stage.solids.some(s=>s.label==='Childhood home walls'));
  assert.ok(stage.solids.some(s=>s.label==='Old village well'));
  assert.ok(stage.solids.every(s=>!s.label.includes('undergrowth')));
  assert.ok(stage.solids.every(s=>!s.label.includes('stepping')));
  assert.ok(!stage.root.getObjectByName('Farm crops'));
});
