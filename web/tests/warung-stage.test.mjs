import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWarungStage, WARUNG } from '../src/world/warungStage.ts';
import { isGrassAllowed } from '../src/world/lowPolyGrass.ts';
import { HOME } from '../src/world/homeStage.ts';
import { keepCameraOutsideGeometry } from '../src/world/cameraOcclusion.ts';

test('warung is a visible modular 3D prefab without textures or hidden URL dependencies', async () => {
  const stage = createWarungStage(false);
  assert.equal(await stage.ready, false);
  assert.ok(stage.root instanceof THREE.Group);
  assert.equal(stage.root.name, 'Warung Lembah Asri / Modular');
  assert.equal(stage.root.position.x, WARUNG.x);
  assert.equal(stage.root.position.z, WARUNG.z);

  const fallback = stage.root.getObjectByName('Warung - low-poly clay fallback');
  assert.ok(fallback);
  assert.ok(fallback.visible);
  assert.ok(stage.root.getObjectByName('Gable roof left'));
  assert.ok(stage.root.getObjectByName('Front corrugated awning base'));
  assert.ok(stage.root.getObjectByName('Side window shutter'));
  assert.ok(stage.root.getObjectByName('Counter jar'));
  assert.ok(stage.root.getObjectByName('Stacked crate'));
  let meshCount = 0;
  fallback.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    meshCount++;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    assert.ok(materials.every(mat => !mat.map), 'untextured clay stage must not install any image maps');
  });
  assert.ok(meshCount > 30, 'the fallback should preserve separate game geometry');
});

test('market, balai desa, home spawn and warung do not overlap', () => {
  const stage = createWarungStage(false);
  assert.equal(stage.solids.length, 3);
  assert.ok(stage.solids.every(collider => collider.half.every(value => value > 0)));
  const market = {x:-1, z:-20, halfX:3.5, halfZ:3};
  const hall = {x:-13, z:-12, halfX:5, halfZ:3.5};
  const site = {x: WARUNG.x, z: WARUNG.z, halfX: WARUNG.width / 2, halfZ: WARUNG.depth / 2};
  for (const other of [market, hall]) {
    const overlapX = Math.abs(site.x-other.x) < site.halfX+other.halfX;
    const overlapZ = Math.abs(site.z-other.z) < site.halfZ+other.halfZ;
    assert.ok(!(overlapX && overlapZ), 'warung should not intersect neighboring buildings');
  }
  assert.ok(Math.hypot(site.x-HOME.spawn.x, site.z-HOME.spawn.z) > 12);
  assert.equal(isGrassAllowed(WARUNG.x, WARUNG.z), false);
});

test('approach remains traversable and the warung blocks the camera', () => {
  const stage = createWarungStage(false);
  // Approaching +Z front step must be outside the interior collision box.
  const approach = {x: WARUNG.x, z: WARUNG.z + 3.12};
  for (const solid of stage.solids) {
    assert.ok(
      !(Math.abs(approach.x-solid.center[0]) < solid.half[0]+0.28
      && Math.abs(approach.z-solid.center[2]) < solid.half[2]+0.28),
      'front walk-up must stay open'
    );
  }
  const focus = new THREE.Vector3(WARUNG.x, 1.55, WARUNG.z+5.5);
  const desired = new THREE.Vector3(WARUNG.x, 2.7, WARUNG.z-8.5);
  const result = keepCameraOutsideGeometry(focus, desired, stage.cameraBlockers);
  assert.ok(result.distanceTo(desired) > 1, 'camera must not pass through the warung');
});
