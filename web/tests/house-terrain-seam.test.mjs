import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  featherMergedHouseGround, createHouseGroundTransition
} from '../src/world/houseTerrainSeam.ts';
import { createHomeStage, HOME } from '../src/world/homeStage.ts';

test('mixed GLB ground/house mesh is never hidden, cut, or re-meshed', () => {
  // Matches the real approved GLB: one mesh carries both the building and dirt.
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(9.6, 5.85, 9.6),
    new THREE.MeshBasicMaterial({color: 0xffffff, toneMapped: false})
  );
  mesh.name = 'Merged approved house and ground';
  const geometry = mesh.geometry;
  const bounds = new THREE.Box3().setFromObject(mesh);
  const courtyard = new THREE.Texture();
  const group = new THREE.Group();
  group.add(mesh);
  assert.equal(featherMergedHouseGround(group, bounds, courtyard), 1);
  assert.equal(mesh.geometry, geometry, 'original house vertices/UVs remain unchanged');
  assert.equal(mesh.visible, true, 'do not hide the entire house to fix dirt');
  assert.ok(mesh.material instanceof THREE.MeshBasicMaterial);
  assert.equal(mesh.material.alphaHash, false, 'remove the stippled black/brown ground pixels');
  assert.equal(mesh.material.transparent, false);
  assert.equal(mesh.material.depthWrite, true);
  assert.equal(mesh.material.toneMapped, false);
  assert.equal(mesh.material.userData.houseGroundFeather, true);
  assert.equal(mesh.material.userData.groundBlendMode, 'opaque-color-match');
  assert.equal(mesh.material.customProgramCacheKey(), 'lembah-house-opaque-color-join-v2');
  const fakeShader = {
    uniforms: {},
    vertexShader: '#include <begin_vertex>',
    fragmentShader: '#include <map_fragment>\n#include <alphahash_fragment>'
  };
  mesh.material.onBeforeCompile(fakeShader, {});
  assert.ok(fakeShader.vertexShader.includes('modelMatrix * vec4(transformed'));
  assert.ok(fakeShader.fragmentShader.includes('diffuseColor.rgb = mix(diffuseColor.rgb, paintedSoil'));
  assert.ok(!fakeShader.fragmentShader.includes('diffuseColor.a *='));
  assert.ok(fakeShader.fragmentShader.includes('texture2D(uHouseCourtyardMap, courtyardUV)'));
  assert.ok(fakeShader.fragmentShader.includes('vHouseJoinWorld.y'));
  assert.ok(fakeShader.fragmentShader.includes('#include <alphahash_fragment>'));
  assert.equal(fakeShader.uniforms.uHouseJoinBounds.value.x, bounds.min.x);
  assert.equal(fakeShader.uniforms.uHouseJoinBottom.value, bounds.min.y);
  assert.equal(fakeShader.uniforms.uHouseCourtyardMap.value, courtyard);
  assert.equal(fakeShader.uniforms.uHouseCourtyardRect.value.x, -45);
  assert.equal(fakeShader.uniforms.uHouseCourtyardRect.value.y, 14.9);
});

test('transition under GLB has no rectangular opaque board or new collision body', () => {
  const soil = createHouseGroundTransition(-32.5, -9.4, 9.6, 9.6);
  assert.ok(soil instanceof THREE.Mesh);
  assert.equal(soil.name, 'Seamless house footing soil-to-terrain transition');
  assert.equal(soil.geometry.parameters.width, 14.2);
  assert.equal(soil.geometry.parameters.height, 14.2);
  assert.equal(soil.material.userData.terrainSurface, 'earth');
  assert.equal(soil.material.userData.worldUV, true);
  assert.equal(soil.position.y, 0.051);
  assert.equal(soil.material.transparent, true);
  assert.equal(soil.material.opacity, 0.44, 'transition must not create a dark halo');
  assert.equal(soil.material.depthWrite, false);
  const mask = soil.material.alphaMap;
  assert.equal(mask.image.width, 128);
  const px = (x,y)=>mask.image.data[(y*128+x)*4+1];
  assert.equal(px(0,0),0);
  assert.ok(px(64,64) > 240);
  assert.equal(soil.userData.contactTransition, 'ground-under-approved-glb');

  const stage = createHomeStage(false);
  assert.ok(stage.root.getObjectByName(soil.name));
  const colliders = stage.solids.map(s => s.label);
  assert.ok(colliders.includes('Childhood home walls'));
  assert.ok(colliders.includes('Old village well'));
  assert.ok(!colliders.includes(soil.name));
  assert.equal(stage.root.getObjectByName('Childhood courtyard - earth clearing').position.y,0.028);
  assert.deepEqual(HOME.spawn, {x:-29.5,y:1.2,z:7.4});
});

test('feather refuses invalid or tiny bounds and leaves other shader types intact', () => {
  const g = new THREE.Group();
  const physical = new THREE.Mesh(
    new THREE.BoxGeometry(3,3,3),
    new THREE.MeshStandardMaterial({color: 'white'})
  );
  g.add(physical);
  assert.equal(featherMergedHouseGround(g, new THREE.Box3(
    new THREE.Vector3(0,0,0), new THREE.Vector3(0.1,1,0.1)
  )),0);
  assert.equal(featherMergedHouseGround(g, new THREE.Box3(
    new THREE.Vector3(-4,0,-4), new THREE.Vector3(4,6,4)
  )),0);
  assert.equal(physical.material.type,'MeshStandardMaterial');
});
