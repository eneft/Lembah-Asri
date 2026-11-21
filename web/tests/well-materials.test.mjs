import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHomeStage } from '../src/world/homeStage.ts';

const stage = createHomeStage(false); // no asset downloads in unit tests
const mesh = name => {
  const object = stage.root.getObjectByName(name);
  assert.ok(object instanceof THREE.Mesh, name + ' must remain actual 3D geometry');
  return object;
};
const uvRange = object => {
  const attr = object.geometry.getAttribute('uv');
  const values = Array.from({length: attr.count}, (_, i) => attr.getY(i));
  return [Math.min(...values), Math.max(...values)];
};

test('well keeps wood, outer masonry, inner masonry and coping as separate meshes', () => {
  const stone = mesh('Old village well stone rim');
  const coping = mesh('Well coping stones');
  const inner = mesh('Inner well masonry');
  const post = mesh('Well timber post');
  const beam = mesh('Well crossbar');
  assert.equal(stone.material.userData.wellSurface, 'stone');
  assert.equal(coping.material.userData.wellSurface, 'coping');
  assert.equal(inner.material.userData.wellSurface, 'inner-stone');
  assert.equal(post.material.userData.wellSurface, 'timber');
  assert.equal(beam.material.userData.wellSurface, 'timber');
  assert.ok(stone.material !== coping.material);
  assert.ok(stone.material !== post.material);
  assert.equal(stone.material.toneMapped, false);
  assert.equal(post.material.toneMapped, false);
});

test('well stone UVs stay in stone half of atlas, wood UVs stay in wood half', () => {
  for (const name of ['Old village well stone rim', 'Well coping stones', 'Inner well masonry']) {
    const object = mesh(name);
    const [min, max] = uvRange(object);
    assert.ok(min > 0.50 && max <= 1, name + ' samples wood pixels');
    assert.ok(object.geometry.getAttribute('color'), name + ' has baked painterly tonal variation');
  }
  for (const name of ['Well timber post', 'Well crossbar']) {
    const [min, max] = uvRange(mesh(name));
    assert.ok(min >= 0.03 - 1e-5 && max <= 0.47 + 1e-5, name + ' samples stone pixels');
  }
});

test('well collision and location remain unchanged', () => {
  const collider = stage.solids.find(item => item.label === 'Old village well');
  assert.deepEqual(collider.center, [-39, 0.55, 4]);
  assert.deepEqual(collider.half, [0.84, 0.55, 0.84]);
});
