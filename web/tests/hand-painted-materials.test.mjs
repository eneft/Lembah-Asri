import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyHandPaintedMaterials } from '../src/world/handPaintedMaterials.ts';

const makeMesh = material => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

test('GLB trees and FBX player share the same unlit hand-painted material profile', () => {
  const treeMap = new THREE.Texture();
  treeMap.flipY = false;
  const characterAtlas = new THREE.Texture();
  characterAtlas.flipY = true;

  const tree = makeMesh(new THREE.MeshStandardMaterial({
    map: treeMap,
    transparent: true,
    opacity: 0.95,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
    vertexColors: true
  }));
  const player = makeMesh(new THREE.MeshPhongMaterial({
    transparent: true,
    opacity: 0.95,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
  }));
  applyHandPaintedMaterials(tree, 8);
  applyHandPaintedMaterials(player, 8, characterAtlas);

  for (const mesh of [tree, player]) {
    assert.ok(mesh.material instanceof THREE.MeshBasicMaterial);
    const mat = mesh.material;
    assert.equal(mat.color.getHex(), 0xffffff);
    assert.equal(mat.transparent, true);
    assert.equal(mat.opacity, 0.95);
    assert.equal(mat.alphaTest, 0.15);
    assert.equal(mat.side, THREE.DoubleSide);
    assert.equal(mat.toneMapped, false);
    assert.equal(mesh.castShadow, true);
    assert.equal(mesh.receiveShadow, false);
    assert.equal(mat.map?.colorSpace, THREE.SRGBColorSpace);
    assert.equal(mat.map?.anisotropy, 8);
  }
  assert.equal(tree.material.map, treeMap, 'tree uses imported diffuse');
  assert.equal(player.material.map, characterAtlas, 'player uses original shaded atlas');
  assert.equal(treeMap.flipY, false, 'do not change GLB atlas orientation');
  assert.equal(characterAtlas.flipY, true, 'do not undo FBX atlas correction');
});

test('keeps imported alpha mask, depth settings, and vertex colors', () => {
  const alphaMap = new THREE.Texture();
  const input = new THREE.MeshStandardMaterial({
    map: new THREE.Texture(),
    alphaMap,
    transparent: true,
    alphaTest: 0.4,
    depthWrite: false,
    depthTest: false,
    vertexColors: true
  });
  const mesh = makeMesh(input);
  applyHandPaintedMaterials(mesh, 4);
  assert.equal(mesh.material.alphaMap, alphaMap);
  assert.equal(mesh.material.alphaTest, 0.4);
  assert.equal(mesh.material.depthWrite, false);
  assert.equal(mesh.material.depthTest, false);
  assert.equal(mesh.material.vertexColors, true);
});

test('retains specialized GLB shaders when no atlas override is supplied', () => {
  const specialized = new THREE.ShaderMaterial();
  const mesh = makeMesh(specialized);
  applyHandPaintedMaterials(mesh, 8);
  assert.equal(mesh.material, specialized);
  assert.equal(mesh.castShadow, true);
  assert.equal(mesh.receiveShadow, false);
});

test('supports multi-material meshes and applies only the shared paint preset', () => {
  const sharedAtlas = new THREE.Texture();
  const mesh = makeMesh([
    new THREE.MeshPhongMaterial(),
    new THREE.MeshStandardMaterial()
  ]);
  applyHandPaintedMaterials(mesh, 4, sharedAtlas);
  assert.equal(mesh.material.length, 2);
  assert.ok(mesh.material.every(mat => mat instanceof THREE.MeshBasicMaterial));
  assert.ok(mesh.material.every(mat => mat.map === sharedAtlas));
});
