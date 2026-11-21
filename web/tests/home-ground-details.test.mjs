import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  isHomeGroundDetailAllowed, scatterHomeGrass, scatterHomeStones,
  makeStoneAlbedoAtlas, makeOrganicGroundMask, createHomeGroundDetails
} from '../src/world/homeGroundDetails.ts';
import { createHomeStage } from '../src/world/homeStage.ts';

test('courtyard remains sparse, deterministic and mobile-bounded', () => {
  const grass = scatterHomeGrass();
  const stones = scatterHomeStones();
  assert.deepEqual(scatterHomeGrass(), grass);
  assert.deepEqual(scatterHomeStones(), stones);
  assert.ok(grass.length > 50 && grass.length < 850, 'bounded clumps, not a full meadow');
  assert.ok(stones.length >= 20 && stones.length <= 50, 'bounded decorative stones');
  assert.ok(grass.every(p => isHomeGroundDetailAllowed(p.x, p.z)));
  assert.ok(stones.every(p => isHomeGroundDetailAllowed(p.x, p.z)));
  assert.ok(new Set(stones.map(p => p.kind)).size === 4, 'all four stone shapes used');
  assert.ok(new Set(stones.map(p => p.sx.toFixed(2))).size >= 7, 'stone sizes vary');
  assert.ok(scatterHomeGrass(5)[0]?.x !== grass[0]?.x);
});

test('no decorations inside protected house, spawn, entrance, well, stream, shed and plots', () => {
  for (const [x,z] of [
    [-32.5,-9.4], [-29.5,7.4], [-32.5,2.3], [-39,4], [-45.5,8],
    [-22,-10.4], [-19,9], [-24.8,-0.5], [-21.8,1.8], [-18.8,-0.5]
  ]) {
    assert.equal(isHomeGroundDetailAllowed(x,z), false, [x,z].join(','));
  }
  assert.equal(isHomeGroundDetailAllowed(-41, -2), true);
  assert.equal(isHomeGroundDetailAllowed(-25, 13), true);
});

test('four separate tinted rock albedos are packed into 256px sRGB atlas', () => {
  const atlas = makeStoneAlbedoAtlas();
  assert.ok(atlas instanceof THREE.DataTexture);
  assert.equal(atlas.colorSpace, THREE.SRGBColorSpace);
  assert.equal(atlas.image.width, 256);
  assert.equal(atlas.image.height, 256);
  assert.equal(atlas.image.data.length, 256 * 256 * 4);
  const sample = (x,y) => {
    const off = (y * 256 + x) * 4;
    return Array.from(atlas.image.data.slice(off,off+3));
  };
  assert.notDeepEqual(sample(64,64), sample(192,64));
  assert.notDeepEqual(sample(64,64), sample(64,192));
  assert.notDeepEqual(sample(55,50), sample(65,50), 'painted details within the stone tile');
});

test('organic soil fades at all edges instead of having a rectangular boundary', () => {
  const mask = makeOrganicGroundMask(7);
  const size = mask.image.width;
  const green = (x,y) => mask.image.data[(y*size+x)*4+1];
  assert.ok(green(size/2|0,size/2|0) > 245);
  assert.ok(green(0,0) === 0);
  assert.ok(green(size-1,size-1) === 0);
  assert.ok(green(size/2|0,3) < green(size/2|0,size/2|0));
});

test('all stone variations are true 3D instanced UV atlas meshes', () => {
  const group = createHomeGroundDetails();
  assert.equal(group.name,'Childhood home organic ground details');
  const rocks = group.children.filter(child => child.name.startsWith('Textured natural stones'));
  const grasses = group.children.filter(child => child.name.includes('grass clumps'));
  const soils = group.children.filter(child => child.name.startsWith('Feathered organic courtyard soil'));
  assert.equal(rocks.length,4,'4 shape/texture combinations');
  assert.equal(grasses.length,2,'2 color families use just 2 instanced draws');
  assert.equal(soils.length,8);
  assert.ok(rocks.every(mesh => mesh instanceof THREE.InstancedMesh && mesh.material.map instanceof THREE.DataTexture));
  assert.ok(grasses.every(mesh => mesh instanceof THREE.InstancedMesh && !mesh.castShadow));
  assert.equal(rocks.reduce((n,mesh) => n + mesh.count,0),scatterHomeStones().length);
  assert.equal(grasses.reduce((n,mesh) => n + mesh.count,0),scatterHomeGrass().length);
  for (const [kind,mesh] of rocks.entries()) {
    const uv = mesh.geometry.getAttribute('uv');
    const lowU = (kind%2)*0.5 + 0.034, highU = (kind%2)*0.5 + 0.466;
    const lowV = Math.floor(kind/2)*0.5 + 0.034;
    const highV = Math.floor(kind/2)*0.5 + 0.466;
    for (let i=0;i<uv.count;i++) {
      assert.ok(uv.getX(i)>=lowU && uv.getX(i)<=highU);
      assert.ok(uv.getY(i)>=lowV && uv.getY(i)<=highV);
    }
    assert.ok(mesh.geometry.getAttribute('position').count > 8);
    assert.equal(mesh.castShadow,false);
  }
  for (const plane of soils) {
    assert.equal(plane.material.userData.worldUV, true);
    assert.equal(plane.geometry.getAttribute('position').count, 4);
    assert.ok(plane.material.transparent && !plane.material.depthWrite);
    assert.equal(plane.material.alphaMap.image.width,64);
  }
});

test('ground detail installation preserves existing house and well colliders', () => {
  const stage = createHomeStage(false);
  assert.ok(stage.root.getObjectByName('Childhood home organic ground details'));
  assert.ok(stage.root.getObjectByName('Old village well stone rim'));
  assert.ok(stage.root.getObjectByName('Empty abandoned soil plot'));
  assert.ok(stage.solids.find(s=>s.label==='Childhood home walls'));
  assert.ok(stage.solids.find(s=>s.label==='Old village well'));
  assert.ok(!stage.solids.some(s=>s.label.includes('ground detail')));
});
