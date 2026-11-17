import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as THREE from 'three';
import { createHomeStage, HOME } from '../src/world/homeStage.ts';
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
  assert.ok(stage.root.getObjectByName('Empty abandoned soil plot'));
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
    0.022
  );
  assert.ok(stage.solids.every(solid => solid.half.every(v => v > 0)));
});
