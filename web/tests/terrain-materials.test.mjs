import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import {
  createTerrainMaterial, terrainTileRepeat, makeTerrainEdgeMask
} from '../src/world/terrainMaterials.ts';
import { createHomeStage } from '../src/world/homeStage.ts';

test('preserves original repository terrain assets for grass and optional future paths', () => {
  const grass = readFileSync(fileURLToPath(
    new URL('../public/models/environment/grass_painterly_tile.webp', import.meta.url)
  ));
  const earth = readFileSync(fileURLToPath(
    new URL('../public/models/environment/earth_path.png', import.meta.url)
  ));
  assert.equal(grass.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(grass.subarray(8, 12).toString('ascii'), 'WEBP');
  assert.equal(earth.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.ok(grass.byteLength > 500 && earth.byteLength > 10_000);
});

test('tile repeats scale with world metres so large areas are not stretched', () => {
  const grass = terrainTileRepeat('grass', 160, 160);
  assert.ok(grass.x > 40 && grass.y > 40);
  const largeEarth = terrainTileRepeat('earth', 32, 29);
  assert.ok(largeEarth.x > 0.5 && largeEarth.x < 1);
  assert.ok(largeEarth.y > 0.5 && largeEarth.y < 1);
  const path = terrainTileRepeat('path', 22, 3.3);
  assert.ok(path.x < 1 && path.y < 0.1);
  const garden = terrainTileRepeat('soil', 2.35, 1.55);
  assert.ok(garden.x < 0.1 && garden.y < 0.1);
  assert.deepEqual(terrainTileRepeat('earth', 42, 42), terrainTileRepeat('path', 42, 42));
  assert.throws(() => terrainTileRepeat('earth', 0, 3));
  assert.throws(() => terrainTileRepeat('grass', 4, Number.NaN));
});

test('hand-painted terrain stays unlit and allows an irregular feathered transition', () => {
  const material = createTerrainMaterial('earth', 32, 29, true);
  assert.ok(material instanceof THREE.MeshBasicMaterial);
  assert.equal(material.toneMapped, false);
  assert.equal(material.transparent, true);
  assert.equal(material.depthWrite, false);
  assert.equal(material.polygonOffset, true);
  assert.equal(material.userData.terrainSurface, 'earth');
  assert.ok(material.alphaMap instanceof THREE.DataTexture);
  assert.equal(material.alphaMap.wrapS, THREE.ClampToEdgeWrapping);
  assert.equal(material.alphaMap.wrapT, THREE.ClampToEdgeWrapping);
  const mask = makeTerrainEdgeMask(64);
  const { data } = mask.image;
  const green = (x, y) => data[(y * 64 + x) * 4 + 1];
  assert.ok(green(0, 0) <= 20, 'corner must blend to original grass');
  assert.ok(green(32, 32) >= 245, 'the middle remains full painted earth');
  assert.ok(green(2, 32) < green(15, 32), 'edges fade smoothly');
});

test('courtyard soil, walkable paths, and raised village approach use textured layers', () => {
  const stage = createHomeStage(false);
  const samples = [
    ['Childhood courtyard - earth clearing', 'earth', 1],
    ['Worn central courtyard', 'soil', 2],
    ['Path from the house gate to the village', 'path', 3],
    ['House entrance footpath', 'path', 3],
    ['Empty abandoned soil plot', 'soil', 0]
  ];
  for (const [name, surface, renderOrder] of samples) {
    const mesh = stage.root.getObjectByName(name);
    assert.ok(mesh instanceof THREE.Mesh, name);
    assert.ok(mesh.material instanceof THREE.MeshBasicMaterial);
    assert.equal(mesh.material.userData.terrainSurface, surface);
    if (renderOrder > 0) {
      assert.ok(mesh.material.alphaMap, name + ' must blend at patch edges');
      assert.equal(mesh.renderOrder, renderOrder);
    }
  }
  const clearing = stage.root.getObjectByName('Childhood courtyard - earth clearing');
  const worn = stage.root.getObjectByName('Worn central courtyard');
  const path = stage.root.getObjectByName('Path from the house gate to the village');
  assert.ok(worn.position.y - clearing.position.y >= 0.02);
  assert.ok(path.position.y - worn.position.y >= 0.01);
});
