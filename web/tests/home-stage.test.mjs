import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as THREE from 'three';
import { createHomeStage, computeHouseScale, HOME } from '../src/world/homeStage.ts';
import { keepCameraOutsideGeometry } from '../src/world/cameraOcclusion.ts';

function insideSolid(x, z, solid, radius = 0.30) {
  const [cx, , cz] = solid.center;
  const [hx, , hz] = solid.half;
  return Math.abs(cx - x) < hx + radius && Math.abs(cz - z) < hz + radius;
}

test('approved original house GLB is a valid binary glTF 2.0 with actual meshes', () => {
  const filename = fileURLToPath(
    new URL('../public/models/environment/rumah_utama.glb', import.meta.url)
  );
  const bytes = readFileSync(filename);
  assert.ok(bytes.length > 500_000, 'expected real house model, not a placeholder');
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLen = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString('utf8'));
  assert.ok(gltf.meshes?.length > 0);
  assert.ok(gltf.accessors?.length > 0);
  assert.ok(gltf.nodes?.length > 0);
  const positions = gltf.meshes.flatMap(mesh => mesh.primitives || [])
    .map(primitive => gltf.accessors[primitive.attributes?.POSITION])
    .filter(Boolean);
  assert.ok(positions.length > 0);
  console.log('Home GLB metadata', JSON.stringify({
    meshes: gltf.meshes.length,
    nodes: gltf.nodes.length,
    materials: gltf.materials?.length ?? 0,
    images: gltf.images?.length ?? 0,
    positionBounds: positions.slice(0, 5).map(a => ({ min: a.min, max: a.max }))
  }));
});

test('the childhood home is an open, navigable area with the village gate unobstructed', async () => {
  const stage = createHomeStage(false);
  assert.equal(await stage.ready, false, 'test skips network model load');
  assert.ok(stage.root instanceof THREE.Group);
  assert.equal(stage.root.name, 'Rumah Masa Kecil / Playable House Garden');
  assert.ok(stage.root.getObjectByName('Bare hand-painted garden soil bed'));
  assert.equal(stage.root.getObjectByName('Sawi and kangkung leaves'), undefined);
  assert.equal(stage.root.getObjectByName('Bamboo trellis top rail'), undefined);
  assert.ok(stage.root.getObjectByName('Old village well stone rim'));
  assert.ok(stage.root.getObjectByName('West wooden bridge walkway'));
  assert.ok(stage.root.getObjectByName('Path from the house gate to the village'));
  assert.ok(stage.root.getObjectByName('Aged plaster walls'));
  assert.ok(!stage.root.getObjectByName('Chicken'));
  assert.ok(!stage.root.getObjectByName('Farm crops'));
  assert.equal(HOME.spawn.y, 1.2);
  // Player clearance is 0.28 m; no new collider should block the spawn or gate.
  for (const point of [
    [HOME.spawn.x, HOME.spawn.z],
    [HOME.gate.x - 0.9, HOME.gate.z],
    [HOME.gate.x + 0.9, HOME.gate.z],
    [HOME.villageRoad.x, HOME.villageRoad.z],
    [-25, 7.4], [-20.5, 8.3]
  ]) {
    assert.equal(
      stage.solids.some(collider => insideSolid(point[0], point[1], collider)),
      false,
      'walkable route blocked at ' + point.join(',')
    );
  }
});

test('house geometry blocks player collision and the orbiting camera', () => {
  const stage = createHomeStage(false);
  assert.ok(stage.solids.some(solid => solid.label === 'Childhood home walls'));
  assert.ok(stage.solids.some(solid => insideSolid(HOME.house.x, HOME.house.z, solid)));
  const focus = new THREE.Vector3(HOME.house.x, 1.4, HOME.house.z + 11);
  const wanted = new THREE.Vector3(HOME.house.x, 3.5, HOME.house.z - 14);
  const safe = keepCameraOutsideGeometry(focus, wanted, stage.cameraBlockers);
  assert.ok(safe.distanceTo(wanted) > 2, 'camera must stop at house proxy');
  assert.ok(safe.z > HOME.house.z + 2, 'camera should be outside front wall');
});

test('scene is genuine 3D meshes and respects cleared-earth yard layout', () => {
  const stage = createHomeStage(false);
  let count = 0;
  let hasShadedMesh = false;
  stage.root.traverse(object => {
    if (object instanceof THREE.Mesh) {
      count++;
      if (object.castShadow) hasShadedMesh = true;
    }
  });
  assert.ok(count >= 70, 'expected modular game geometry');
  assert.ok(hasShadedMesh);
  assert.equal(
    stage.root.getObjectByName('Childhood courtyard - earth clearing')?.position.y,
    0.028
  );
  assert.ok(stage.solids.every(solid => solid.half.every(v => v > 0)));
});

test('Option B enlarges the original approved GLB significantly without stretching it', () => {
  const filename = fileURLToPath(
    new URL('../public/models/environment/rumah_utama.glb', import.meta.url)
  );
  const bytes = readFileSync(filename);
  const jsonLen = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString('utf8'));
  const primitive = gltf.meshes[0].primitives[0];
  const position = gltf.accessors[primitive.attributes.POSITION];
  const source = {
    x: position.max[0] - position.min[0],
    y: position.max[1] - position.min[1],
    z: position.max[2] - position.min[2]
  };
  const previousScale = Math.min(7.5 / source.x, 5.5 / source.z, 5.2 / source.y);
  const actualScale = computeHouseScale(source);
  const ratio = actualScale / previousScale;
  const finalSize = {
    width: actualScale * source.x,
    height: actualScale * source.y,
    depth: actualScale * source.z
  };
  assert.ok(ratio >= 1.65, 'Option B must be unmistakably larger than the original');
  assert.ok(finalSize.width >= 9.0 && finalSize.width <= HOME.house.width + 0.001);
  assert.ok(finalSize.depth >= 9.0 && finalSize.depth <= HOME.house.depth + 0.001);
  assert.ok(finalSize.height >= 5.5 && finalSize.height <= HOME.house.height + 0.001);
  assert.throws(() => computeHouseScale({x: 0, y: 1, z: 1}));
  console.log('Large house footprint', JSON.stringify({finalSize,ratio:Number(ratio.toFixed(3))}));
});

test('enlarged house, porch, roof, colliders and fences maintain clearance', () => {
  const stage = createHomeStage(false);
  const houseCollider = stage.solids.find(c => c.label === 'Childhood home walls');
  const shedCollider = stage.solids.find(c => c.label === 'Storage shed walls');
  const northFence = stage.solids.find(c => c.label === 'North rear fence');
  const cameraProxy = stage.root.getObjectByName('House camera collision proxy');
  const fallback = stage.root.getObjectByName('Rumah Masa Kecil - fallback geometry');

  assert.ok(houseCollider && shedCollider && northFence && cameraProxy && fallback);
  assert.ok(houseCollider.half[0] > 4.8 && houseCollider.half[2] > 4.8);
  assert.ok(houseCollider.half[1] > 2.9);
  const eastWall = houseCollider.center[0] + houseCollider.half[0];
  const westShed = shedCollider.center[0] - shedCollider.half[0];
  assert.ok(westShed - eastWall >= 2, 'preserve a walkable gap by the shed');
  const northWall = houseCollider.center[2] - houseCollider.half[2];
  assert.ok(northWall - northFence.center[2] >= 1.8, 'no collision with rear fence');
  const frontWall = houseCollider.center[2] + houseCollider.half[2];
  assert.ok(HOME.spawn.z - frontWall >= 8, 'keep an open approach to the entrance');

  const proxySize = new THREE.Box3().setFromObject(cameraProxy).getSize(new THREE.Vector3());
  assert.ok(proxySize.x > HOME.house.width && proxySize.z > HOME.house.depth);
  assert.ok(proxySize.y > HOME.house.height);

  const fallbackSize = new THREE.Box3().setFromObject(fallback).getSize(new THREE.Vector3());
  assert.ok(fallbackSize.x > 9.4 && fallbackSize.y > 5.5, 'fallback must also be visibly enlarged');
  const approach = stage.root.getObjectByName('House entrance footpath');
  assert.equal(approach.position.x, HOME.house.x);
  assert.ok(approach.geometry.parameters.width >= 3.8, 'large house needs broad approach');
});
