import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPaintedTerrainPlane, createTerrainMaterial } from '../src/world/terrainMaterials.ts';
import { createHomeStage } from '../src/world/homeStage.ts';
import { createInstancedGrass, isGrassAllowed, makeLowPolyGrassGeometry, scatterLowPolyGrass } from '../src/world/lowPolyGrass.ts';

test('terrain UV1 is world aligned on an intentionally plain four-vertex quad', () => {
  const left = createPaintedTerrainPlane('grass', 10, 10, 0, 0, 0);
  const right = createPaintedTerrainPlane('grass', 10, 10, 10, 0, 0);
  const uv = left.geometry.getAttribute('uv');
  const uv1 = left.geometry.getAttribute('uv1');
  const pos = left.geometry.getAttribute('position');
  assert.ok(uv && uv1 && pos);
  assert.equal(pos.count, 4, 'plain single-quad terrain instead of subdivided procedural ground');
  assert.equal(uv.count, uv1.count);
  assert.equal(left.material.userData.worldUV, true);
  assert.equal(left.userData.terrainUV, 'plain-world-uv1');
  assert.equal(left.material.vertexColors, false, 'painted color comes from albedo, not vertex tints');
  assert.ok(left.geometry.parameters.width === 10);
  assert.ok(uv1.getX(0) < 0, 'world-aligned UV can be negative');

  const first = Array.from({length: uv1.count}, (_, i) => i).find(i =>
    Math.abs(left.position.x + pos.getX(i) - 5) < 0.0001 &&
    Math.abs(left.position.z - pos.getY(i) - 5) < 0.0001
  );
  const posR = right.geometry.getAttribute('position');
  const uvR = right.geometry.getAttribute('uv1');
  const second = Array.from({length: uvR.count}, (_, i) => i).find(i =>
    Math.abs(right.position.x + posR.getX(i) - 5) < 0.0001 &&
    Math.abs(right.position.z - posR.getY(i) - 5) < 0.0001
  );
  assert.notEqual(first, undefined);
  assert.notEqual(second, undefined);
  assert.ok(Math.abs(uv1.getX(first) - uvR.getX(second)) < 1e-5, 'UVs align at adjacent edge');
  assert.ok(Math.abs(uv1.getY(first) - uvR.getY(second)) < 1e-5);
  assert.ok(Math.abs(uv1.getY(0) - uv1.getY(1)) < 1e-6, 'unwarped world UV on a plain surface');
});

test('UV0 remains local for feathered alpha mask while UV1 maps painted soil', () => {
  const mesh = createPaintedTerrainPlane('earth', 32, 29, -29, 0.4, 0.028, true);
  const uv0 = mesh.geometry.getAttribute('uv');
  const uv1 = mesh.geometry.getAttribute('uv1');
  const position = mesh.geometry.getAttribute('position');
  assert.equal(uv0.getX(0), 0);
  assert.equal(uv0.getY(0), 1);
  assert.ok(Math.abs(uv1.getX(0)) > 1.0);
  assert.ok(Math.abs(uv1.getY(0)) < 1.0, 'soil period is larger than one village path width');
  assert.equal(mesh.material.alphaMap.channel, 0);
  assert.equal(mesh.material.transparent, true);
  assert.equal(mesh.material.depthWrite, false);
  assert.equal(mesh.geometry.getAttribute('color'), undefined);
  assert.equal(position.count, 4, 'true plain terrain with one quad and four UV points');
  const legacy = createTerrainMaterial('soil', 2.35, 1.55);
  assert.equal(legacy.userData.worldUV, false, 'boxed garden bed uses the original UV tiling');
});

test('home clearing and village connection share plain world UV1 with protected masks', () => {
  const stage = createHomeStage(false);
  for (const name of [
    'Childhood courtyard - earth clearing',
    'Worn central courtyard',
    'Path from the house gate to the village',
    'House entrance footpath'
  ]) {
    const mesh = stage.root.getObjectByName(name);
    assert.ok(mesh instanceof THREE.Mesh);
    assert.ok(mesh.geometry.getAttribute('uv1'), name);
    if (name === 'Childhood courtyard - earth clearing') {
      assert.ok(mesh.geometry.getAttribute('gardenPaint'));
      assert.ok(mesh.geometry.getAttribute('position').count < 5000, 'only the garden needs a dense grid');
    } else {
      assert.equal(mesh.geometry.getAttribute('position').count, 4, name + ' stays a flat quad');
    }
    assert.ok(mesh.material.alphaMap, name);
    assert.equal(mesh.material.userData.worldUV, true);
  }
});

test('low-poly grass uses blade geometry, vertex gradients and two efficient InstancedMeshes', () => {
  const blade = makeLowPolyGrassGeometry();
  const triangleCount = blade.getAttribute('position').count / 3;
  assert.ok(triangleCount >= 8 && triangleCount <= 16, 'small low-poly tufts');
  assert.ok(blade.boundingSphere.radius < 0.4, 'short low-poly grass no longer resembles tall paper shards');
  assert.ok(blade.getAttribute('color'));
  const group = createInstancedGrass();
  assert.equal(group.name, 'Low poly instanced meadow grass');
  assert.ok(group.children.length <= 2);
  assert.ok(group.children.length >= 1);
  assert.ok(group.children.every(mesh => mesh instanceof THREE.InstancedMesh));
  assert.ok(group.children.every(mesh => !mesh.castShadow));
  assert.ok(group.children.every(mesh => mesh.material.toneMapped === false));
  assert.equal(group.children.reduce((sum, mesh) => sum + mesh.count, 0), scatterLowPolyGrass().length);
});

test('grass is deterministic, varied, and excludes walkable paths/house/garden/water', () => {
  const a = scatterLowPolyGrass();
  const b = scatterLowPolyGrass();
  assert.deepEqual(a, b);
  assert.ok(a.length > 200 && a.length < 1800, 'bounded grass density for mobile');
  assert.ok(a.some(point => point.kind === 0));
  assert.ok(a.some(point => point.kind === 1));
  assert.ok(a.every(point => isGrassAllowed(point.x, point.z)));
  assert.equal(isGrassAllowed(-32.5, -9.4), false, 'no grass in house');
  assert.equal(isGrassAllowed(-22, 0.5), false, 'garden crops stay clear of decorative grass');
  assert.equal(isGrassAllowed(-10, 9), false, 'dirt road stays visible');
  assert.equal(isGrassAllowed(0, -5), false, 'village plaza stays clear');
  assert.equal(isGrassAllowed(-45.5, 8.3), false, 'stream remains clear');
  assert.equal(isGrassAllowed(0, 17), false, 'village river remains clear');
  assert.equal(isGrassAllowed(-29.5, 7.4), false, 'player spawn remains clear');
  assert.ok(a.some(point => point.x < -22 && point.x > -44 && (point.z > 12 || point.z < -10)), 'grass grows on the yard perimeter');
  assert.ok(a.every(point => !(point.x > -42.2 && point.x < -16 && point.z > -10 && point.z < 13)), 'central dirt courtyard stays bare');
  assert.notDeepEqual(scatterLowPolyGrass(17).slice(0, 2), a.slice(0, 2));
});
