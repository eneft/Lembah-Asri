import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
  createHomeCreek, CREEK, CREEK_PAINTED_TEXTURES,
  createRockWaterWakes, makePaintedRockWake,
  updateHomeCreekWater
} from '../src/world/homeCreek.ts';
import {
  BRIDGE_TEXTURES, BRIDGE_DECK, createPaintedWoodenBridge,
  paintedBridgeMaterial
} from '../src/world/paintedBridge.ts';
import {createHomeStage} from '../src/world/homeStage.ts';
import {terrainTileRepeat} from '../src/world/terrainMaterials.ts';

function readAsset(path){
  return readFileSync(new URL('../public/'+path,import.meta.url));
}

test('real authored village meadow, stream, banks and bridge maps ship with valid image bytes',()=>{
  for(const name of [
    'textures/terrain/village_grass_painted.webp',
    'textures/terrain/creek_water_painterly_illustrated.webp',
    'textures/terrain/creek_bank_painted.webp',
    'textures/bridge/bridge_wood_painted.webp'
  ]){
    const bytes=readAsset(name);
    assert.equal(bytes.subarray(0,4).toString(),'RIFF',name);
    assert.equal(bytes.subarray(8,12).toString(),'WEBP',name);
    assert.ok(bytes.byteLength>=4000 && bytes.byteLength<100000,name);
  }
  for(const name of [
    'textures/bridge/bridge_wood_normal.png',
    'textures/bridge/bridge_wood_roughness.png'
  ]){
    const data=readAsset(name);
    assert.equal(data.subarray(1,4).toString(),'PNG',name);
    assert.equal(data.readUInt32BE(16),256,name);
    assert.equal(data.readUInt32BE(20),256,name);
  }
  assert.match(CREEK_PAINTED_TEXTURES.water,/creek_water_painterly_illustrated\.webp/);
  assert.match(CREEK_PAINTED_TEXTURES.bank,/creek_bank_painted\.webp/);
  assert.match(BRIDGE_TEXTURES.albedo,/bridge_wood_painted\.webp/);
  const grassSource=readFileSync(new URL('../src/world/terrainMaterials.ts',import.meta.url),'utf8');
  assert.match(grassSource,/loadAsync\('\.\/textures\/terrain\/village_grass_painted\.webp'\)/);
  assert.ok(terrainTileRepeat('grass',160,160).x>40);
});

test('creek uses physical banks with repeated real world UVs, no giant stretched texture',()=>{
  const scene=createHomeCreek();
  const west=scene.getObjectByName('Soft west creek bank');
  const east=scene.getObjectByName('Soft east creek bank');
  const water=scene.getObjectByName('Shallow stream west of childhood home');
  const bed=scene.getObjectByName('Visible gravel bed below clear creek water');
  const foam=scene.getObjectByName('Illustrated river foam and flow trails');
  const wakes=scene.getObjectByName('Painted foam breaking against mossy river boulders');
  assert.equal(scene.children.length,6);
  assert.ok(west && east && water && bed && foam && wakes);
  assert.equal(water.material.transparent,true);
  assert.ok(water.material.opacity>.87 && water.material.opacity<.92);
  assert.equal(water.userData.sourcePaintedUV,true);
  assert.equal(west.userData.sourcePaintedUV,true);
  for(const object of [water,west,east,bed]){
    const uv=object.geometry.getAttribute('uv');
    const coords=Array.from({length:uv.count},(_,i)=>uv.getY(i));
    assert.ok(Math.max(...coords)>10,'UV scales in metres over entire river');
    assert.ok(Math.min(...coords)<.05);
  }
  const foamUV=foam.geometry.getAttribute('uv');
  assert.ok(Math.max(...Array.from({length:foamUV.count},(_,i)=>foamUV.getY(i)))<=1.00001);
  assert.equal(wakes.count,6);
  assert.equal(wakes.material.depthWrite,false);
  assert.ok(CREEK.waterY<CREEK.bankWidth);
  assert.ok(CREEK.bedY<CREEK.waterY);
  const wet=west.geometry.getAttribute('position');
  let max=Number.NEGATIVE_INFINITY,min=Number.POSITIVE_INFINITY;
  for(let i=0;i<wet.count;i++){const y=wet.getY(i);max=Math.max(max,y);min=Math.min(min,y);}
  assert.ok(max>0 && min<-.60);
});

test('localized hand-painted foam has alpha and animated water flow preserves fallback',()=>{
  const tex=makePaintedRockWake();
  assert.equal(tex.image.width,128);
  assert.equal(tex.image.height,192);
  const a=tex.image.data;
  let transparent=0,painted=0;
  for(let k=3;k<a.length;k+=4){
    if(a[k]===0)transparent++;
    if(a[k]>40)painted++;
  }
  assert.ok(transparent>a.length/4*.2);
  assert.ok(painted>a.length/4*.03);
  const water=createHomeCreek().getObjectByName('Shallow stream west of childhood home');
  const t=water.userData.rippleUniform;
  updateHomeCreekWater(water,5);
  assert.equal(t.value,5);
});

test('actual bridge geometry uses 12 separate UV boards, beams and support posts',()=>{
  const bridge=createPaintedWoodenBridge();
  assert.equal(bridge.name,'West wooden bridge walkway');
  assert.equal(bridge.userData.bridgeUV,'painterly-individual-planks');
  assert.deepEqual(bridge.userData.collisionFootprint,[5.1,2.4]);
  assert.equal(BRIDGE_DECK.boards,12);
  assert.ok(bridge.children.every(o=>o instanceof THREE.InstancedMesh));
  assert.equal(bridge.children.length,4);
  const planks=bridge.getObjectByName('Individual UV-painted timber bridge planks');
  const runners=bridge.getObjectByName('Bridge underside structural runners');
  const posts=bridge.getObjectByName('Four painted wooden bridge posts');
  const nails=bridge.getObjectByName('Bridge tiny dark joinery nails');
  assert.ok(planks&&runners&&posts&&nails);
  assert.equal(planks.count,12);
  assert.equal(runners.count,2);
  assert.equal(posts.count,4);
  assert.equal(nails.count,24);
  assert.equal(planks.material,paintedBridgeMaterial);
  assert.equal(paintedBridgeMaterial.type,'MeshStandardMaterial');
  assert.equal(paintedBridgeMaterial.metalness,0);
  assert.ok(paintedBridgeMaterial.roughness>=.85);
  for(const mesh of [planks,runners,posts]){
    assert.ok(mesh.geometry.getAttribute('uv'));
    assert.equal(mesh.castShadow,true);
  }
  bridge.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(bridge);
  const size=bounds.getSize(new THREE.Vector3());
  assert.ok(size.x>=5 && size.x<=5.4);
  assert.ok(size.z>=2.2 && size.z<=2.6);
  assert.ok(size.y>=.7 && size.y<=1.25);
});

test('full house scene preserves fences, gate and walkability while changing bridge visuals',()=>{
  const stage=createHomeStage(false);
  const bridge=stage.root.getObjectByName('West wooden bridge walkway');
  assert.ok(bridge);
  assert.equal(bridge.userData.bridgeUV,'painterly-individual-planks');
  assert.equal(stage.root.getObjectByName('Bridge timber rail post'),undefined);
  assert.ok(stage.root.getObjectByName('Old village well stone rim'));
  assert.ok(stage.root.getObjectByName('Bamboo UV PBR — North rear fence'));
  assert.ok(stage.root.getObjectByName('Bamboo UV PBR — South front fence'));
  assert.ok(stage.solids.some(s=>s.label==='Childhood home walls'));
  assert.ok(!stage.solids.some(s=>s.label.startsWith('Bridge')));
  assert.ok(stage.root.getObjectByName('Painted foam breaking against mossy river boulders'));
});


test('generated turquoise water concept is shipped as an optimized real painted WebP map',()=>{
  const bytes=readAsset('textures/terrain/creek_water_painterly_illustrated.webp');
  assert.equal(bytes.subarray(0,4).toString(),'RIFF');
  assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  assert.ok(bytes.length>20000 && bytes.length<80000,
    'user-approved hand-painted texture is optimized for iPhone');
  const river=createHomeCreek();
  const water=river.getObjectByName('Shallow stream west of childhood home');
  assert.equal(water.userData.waterAlbedo,'user-approved-painterly-turquoise-water');
  const uv=water.geometry.getAttribute('uv');
  assert.ok(uv.getY(0)===0,'flow starts at upstream UV origin');
  assert.ok(uv.getY(uv.count-1)>10 && uv.getY(uv.count-1)<12,
    'paint strokes repeat at approximately 14.5m in +Z rather than stretch 160m');
  const foam=river.getObjectByName('Illustrated river foam and flow trails');
  const wakes=river.getObjectByName('Painted foam breaking against mossy river boulders');
  assert.ok(foam.material.opacity<.65,'avoid double-bright foam over painted white highlights');
  assert.ok(wakes.material.opacity<.8);
});
