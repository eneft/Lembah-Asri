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

test('uploaded user house is a true PBR binary glTF with original 3D mesh', () => {
  const filename = fileURLToPath(
    new URL('../public/models/environment/rumah_utama_user_pbr.glb', import.meta.url)
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
  const primitive=gltf.meshes[0].primitives[0];
  assert.equal(gltf.meshes.length,1);
  assert.equal(gltf.images.length,3);
  assert.equal(gltf.textures.length,3);
  assert.equal(gltf.accessors[primitive.indices].count,300000,
    'preserve all 100,000 original triangles');
  assert.equal(gltf.accessors[primitive.attributes.POSITION].count,155436);
  assert.ok(primitive.attributes.NORMAL !== undefined);
  assert.ok(primitive.attributes.TEXCOORD_0 !== undefined);
  assert.ok(gltf.materials[0].pbrMetallicRoughness.baseColorTexture);
  assert.ok(gltf.materials[0].pbrMetallicRoughness.metallicRoughnessTexture);
  assert.ok(gltf.materials[0].normalTexture);
  assert.ok(gltf.images.every(image=>image.mimeType==='image/jpeg'));
  assert.ok(bytes.length<9_000_000, 'optimized for mobile transfer without reducing geometry');
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
  assert.ok(stage.gardenGround.indices.length > 0, 'the courtyard itself supplies walkable earth');
  assert.equal(stage.garden.crops.children.reduce((n, batch) => n + batch.count, 0), 0);
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

test('uploaded PBR home fits existing height and plot with uniform scaling',()=>{
  const filename=fileURLToPath(
    new URL('../public/models/environment/rumah_utama_user_pbr.glb',import.meta.url)
  );
  const bytes=readFileSync(filename);
  const jsonLen=bytes.readUInt32LE(12);
  const gltf=JSON.parse(bytes.subarray(20,20+jsonLen).toString('utf8'));
  const primitive=gltf.meshes[0].primitives[0];
  const pos=gltf.accessors[primitive.attributes.POSITION];
  const source={
    x:pos.max[0]-pos.min[0],
    y:pos.max[1]-pos.min[1],
    z:pos.max[2]-pos.min[2]
  };
  const s=computeHouseScale(source);
  const size={width:s*source.x,height:s*source.y,depth:s*source.z};
  // The original model has a taller roof and narrower facade than the old
  // placeholder. Never nonuniformly stretch it just to fill the whole plot.
  assert.ok(size.width>=7.2 && size.width<=HOME.house.width+.001);
  assert.ok(size.depth>=8.5 && size.depth<=HOME.house.depth+.001);
  assert.ok(size.height>=5.7 && size.height<=HOME.house.height+.001);
  assert.ok(size.depth<HOME.house.depth-.1, 'allow a margin for entrance');
  assert.throws(()=>computeHouseScale({x:0,y:1,z:1}));
  console.log('Uploaded house fitted meters',JSON.stringify({size,uniformScale:s}));
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

test('uploaded fence GLB keeps uniform XYZ proportions and exact endpoints on all six runs', async () => {
  const { createUploadedFenceRun, FENCE_HEIGHT } = await import('../src/world/uploadedHomeFence.ts');
  const bytes = readFileSync(fileURLToPath(new URL('../public/models/environment/home-fence-module.glb', import.meta.url)));
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  assert.equal(gltf.accessors[0].count, 9467);
  assert.equal(gltf.accessors[3].count, 24696);
  assert.equal(gltf.materials[0].emissiveTexture.index, 0);
  const size = new THREE.Vector3().fromArray(gltf.accessors[0].max).sub(new THREE.Vector3().fromArray(gltf.accessors[0].min));
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  geometry.translate(0, size.y / 2, 0);
  const lengthForRun = run => 2*Math.max(run.half[0],run.half[2]);
  const stage = createHomeStage(false);
  const runs = stage.solids.filter(s => s.label.includes('fence'));
  assert.equal(runs.length, 6);
  for (const run of runs) {
    const group = createUploadedFenceRun(geometry, new THREE.MeshBasicMaterial(), run);
    const wood = group.getObjectByName('Continuous authored bamboo');
    const vines = group.getObjectByName('Climbing vines — painted 3D');
    const count = group.userData.moduleCount;
    const meshes = wood.children;
    assert.equal(meshes.length, count > 1 ? 2 : 1);
    assert.equal(meshes.reduce((n,m)=>n+m.count,0),count);
    if(count>1){
      assert.ok(meshes[1].geometry.boundingBox.min.x > geometry.boundingBox.min.x);
      assert.ok(group.userData.sharedPostPitch < size.x*group.userData.uniformScale);
    }
    assert.equal(vines.userData.clusters, lengthForRun(run)<4 ? 0 : Math.max(1,Math.floor(lengthForRun(run)/6)));
    assert.ok(vines.userData.leafCount >= vines.userData.clusters*31);
    assert.equal(vines.userData.branches,vines.userData.clusters*3);
    assert.equal(vines.userData.rootGrass,vines.userData.clusters*10);
    if(vines.userData.clusters){
      const leaves=vines.getObjectByName('Climbing vine leaves');
      assert.ok(leaves.geometry.getAttribute('uv') && leaves.material.map);
      assert.equal(leaves.material.toneMapped,false);
      assert.equal(vines.getObjectByName('Grass at climbing roots').count,vines.userData.rootGrass);
    }
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(wood);
    const actual = bounds.getSize(new THREE.Vector3());
    const alongX = run.half[0] > run.half[2];
    const length = 2 * (alongX ? run.half[0] : run.half[2]);
    const actualLength = alongX ? actual.x : actual.z;
    const actualDepth = alongX ? actual.z : actual.x;
    const scale = length / (size.x + (count-1)*size.x*.86);
    assert.ok(Math.abs(actualLength - length) < .001, 'exact gate-facing endpoints');
    assert.ok(Math.abs(actualDepth - size.z * scale) < .001, 'original unflattened depth');
    assert.ok(Math.abs(actual.y - size.y * scale) < .001, 'original height-to-width ratio');
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), xyz = new THREE.Vector3();
    for (const mesh of meshes) for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      matrix.decompose(position, rotation, xyz);
      assert.ok(Math.abs(xyz.x - scale) < .00001 && Math.abs(xyz.y - scale) < .00001 && Math.abs(xyz.z - scale) < .00001, 'no nonuniform stretching');
    }
    if (length >= 19) {
      assert.ok(Math.abs(actual.y - FENCE_HEIGHT) < .1);
      assert.ok(actualDepth > .4, 'long fences must retain full 3D thickness');
    }
    assert.ok(Math.abs(bounds.min.y) < .001);
    assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).x - run.center[0]) < .001);
    assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).z - run.center[2]) < .001);
  }
});
