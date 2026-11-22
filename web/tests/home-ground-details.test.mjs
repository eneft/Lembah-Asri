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
    [-22,-10.4], [-19,9], [-24.8,-0.5], [-21.8,1.8], [-18.8,-0.5], [-22,0.5], [-18,3.7]
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
  assert.equal(soils.length,0,'no dark irregular soil stain overlays anywhere');
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
  // The eight 4–6-metre tinted soil decals were the dark blobs in screenshot.
  // Their shared generator must not put ANY of them into the returned group.
  assert.equal(group.children.filter(c=>c.name.startsWith('Feathered organic courtyard soil')).length,0);
});

test('ground detail installation preserves existing house and well colliders', () => {
  const stage = createHomeStage(false);
  assert.ok(stage.root.getObjectByName('Childhood home organic ground details'));
  assert.ok(stage.root.getObjectByName('Old village well stone rim'));
  const beds = [];
  stage.root.traverse(obj => { if (obj.name === 'Bare hand-painted garden soil bed') beds.push(obj); });
  assert.equal(beds.length, 4, 'four bare low soil ridges remain');
  assert.ok(beds.every(bed => bed.material.map instanceof THREE.Texture));
  assert.equal(stage.root.getObjectByName('Sawi and kangkung leaves'), undefined);
  assert.equal(stage.root.getObjectByName('Ripe red garden tomatoes'), undefined);
  assert.equal(stage.root.getObjectByName('Bamboo trellis top rail'), undefined);
  assert.ok(stage.solids.find(s=>s.label==='Childhood home walls'));
  assert.ok(stage.solids.find(s=>s.label==='Old village well'));
  assert.ok(!stage.solids.some(s=>s.label.includes('ground detail')));
});


test('full home stage contains no irregular olive/brown soil stain planes anywhere',()=>{
  const stage=createHomeStage(false);
  const names=[];
  stage.root.traverse(obj=>names.push(obj.name));
  assert.equal(names.filter(n=>/^Feathered organic courtyard soil/.test(n)).length,0);
  // Keep the original approved grass, paths, trees, well and two UV rock
  // placements. Only dark decorative soil stains were removed.
  assert.ok(stage.root.getObjectByName('Childhood courtyard - earth clearing'));
  assert.ok(stage.root.getObjectByName('Worn central courtyard'));
  assert.ok(stage.root.getObjectByName('Courtyard green grass clumps'));
  assert.ok(stage.root.getObjectByName('Courtyard dry grass clumps'));
  assert.ok(stage.root.getObjectByName('Meandering shallow creek and earthen banks'));
  assert.ok(stage.root.getObjectByName('Old village well stone rim'));
  assert.equal(stage.root.getObjectByName('Feathered organic courtyard soil 0'),undefined);
  assert.equal(stage.root.getObjectByName('Feathered organic courtyard soil 7'),undefined);
  assert.ok(stage.solids.some(c=>c.label==='Childhood home walls'));
});
