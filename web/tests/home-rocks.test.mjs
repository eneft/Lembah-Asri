import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { selectedHomeRocks, rockFile, findCuratedRockVariant, createCuratedRockGroup } from '../src/world/homeRocks.ts';
import { createHomeStage } from '../src/world/homeStage.ts';

function getGlb() {
  const raw=readFileSync(fileURLToPath(new URL(
    '../public/models/environment/lembah_asri_rocks_original_16.glb',import.meta.url
  )));
  assert.equal(raw.subarray(0,4).toString(),'glTF');
  assert.equal(raw.readUInt32LE(4),2);
  assert.equal(raw.readUInt32LE(8),raw.length);
  const jsonLength=raw.readUInt32LE(12);
  const json=JSON.parse(raw.subarray(20,20+jsonLength).toString('utf8'));
  return {raw,json};
}

test('all 16 rock meshes preserve uploaded original UV texture, not untextured geometry',()=>{
  const {raw,json}=getGlb();
  assert.ok(raw.length<1_500_000,'portable compressed original asset');
  assert.equal(json.meshes.length,16);
  assert.equal(json.nodes.length,16);
  assert.equal(json.materials.length,1,'shared baseColor material for all original variations');
  assert.equal(json.images.length,1);
  assert.ok(json.images[0].name.includes('original'));
  assert.deepEqual(json.materials[0].pbrMetallicRoughness.baseColorFactor,[1,1,1,1],
    'fix uploaded all-black baseColorFactor');
  assert.equal(json.materials[0].pbrMetallicRoughness.baseColorTexture.index,0);
  const bufferStart=20+raw.readUInt32LE(12)+8;
  const imageView=json.bufferViews[json.images[0].bufferView];
  const png=raw.subarray(bufferStart+imageView.byteOffset,
    bufferStart+imageView.byteOffset+imageView.byteLength);
  assert.equal(png.readUInt32BE(16),768);
  assert.equal(png.readUInt32BE(20),768);
  let triangles=0;
  for(let id=0;id<16;id++){
    const mesh=json.meshes[id];
    assert.equal(mesh.name,'LA Rock '+String(id).padStart(2,'0'));
    assert.equal(mesh.extras.originalIndex,id);
    assert.ok(mesh.extras.dimensions.every(x=>x>0));
    const prim=mesh.primitives[0];
    assert.equal(prim.material,0);
    assert.ok(prim.attributes.POSITION!==undefined);
    assert.ok(prim.attributes.NORMAL!==undefined);
    assert.ok(prim.attributes.TEXCOORD_0!==undefined,'original UV remains on every rock');
    assert.ok(Math.abs(json.accessors[prim.attributes.POSITION].min[1])<.001,
      'geometry is recentered and grounded, not floating above terrain');
    triangles+=json.accessors[prim.indices].count/3;
  }
  assert.equal(triangles,12731);
});

test('rock placement is curated by environment, not randomly thrown into player paths',()=>{
  assert.match(rockFile,/lembah_asri_rocks_original_16\.glb/);
  assert.equal(selectedHomeRocks.length,29);
  const zones=new Set(selectedHomeRocks.map(p=>p.zone));
  assert.deepEqual([...zones].sort(),
    ['foundation','garden','path-edge','stream','well'].sort());
  for(const p of selectedHomeRocks){
    assert.ok(p.id>=0&&p.id<16);
    assert.ok(p.scale>=.75&&p.scale<=1.30);
    assert.ok(p.yaw>=0&&p.yaw<2*Math.PI);
    if(p.zone==='stream'){
      assert.ok(Math.abs(p.x+45.5)>1.3, 'not in the middle of shallow water');
      assert.ok(p.z<7.15 || p.z>10.05,'bridge remains walkable');
    } else {
      assert.ok(Math.hypot(p.x+39,p.z-4)>1.2,'well rim not blocked');
      assert.ok(Math.hypot(p.x+29.5,p.z-7.4)>2,'player spawn remains clear');
      assert.ok(!(p.x>-33.9&&p.x<-30.8&&p.z>-5.2&&p.z<3),
        'front stairs and door stay clear');
    }
    if(p.zone==='foundation') assert.ok(p.x < -38.6 || p.x > -26.5,
      'decorations stay off the house footing');
  }
});

test('loading fallback retains original well, river bridge and bank stones',()=>{
  const stage=createHomeStage(false);
  assert.ok(stage.root.getObjectByName('Old village well stone rim'));
  assert.ok(stage.root.getObjectByName('West wooden bridge walkway'));
  assert.ok(stage.root.getObjectByName('Stream bank stone'));
  assert.ok(stage.solids.some(s=>s.label==='Childhood home walls'));
  assert.ok(!stage.solids.some(s=>s.label.toLowerCase().includes('rock')),
    'small scenic stones never add unplanned collisions');
});

test('GLTFLoader-sanitized mesh names resolve to all 16 actual 3D rock assets', () => {
  const {json}=getGlb();
  const scene = new THREE.Group();
  const picture = new THREE.DataTexture(
    new Uint8Array([148, 136, 117, 255]), 1, 1, THREE.RGBAFormat
  );
  picture.colorSpace = THREE.SRGBColorSpace;
  picture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({map: picture});
  for(let i=0;i<16;i++) {
    const authored=json.nodes[i].name;
    const loaderName=THREE.PropertyBinding.sanitizeNodeName(authored);
    assert.equal(loaderName,'LA_Rock_'+String(i).padStart(2,'0'));
    assert.notEqual(loaderName,authored,'reproduces original production bug');
    const rock=new THREE.Mesh(new THREE.BoxGeometry(.3,.3,.3),material);
    rock.name=loaderName;
    rock.userData.originalIndex=i;
    scene.add(rock);
    assert.equal(findCuratedRockVariant(scene,i),rock);
  }
  // Check the same adapter used after GLTFLoader finishes, not only name parsing.
  const installed=createCuratedRockGroup(scene);
  assert.equal(installed.name,'Curated original UV textured rock placements');
  assert.ok(installed.children.every(child=>child instanceof THREE.InstancedMesh));
  assert.ok(installed.children.length>=12);
  const placed=installed.children.reduce((count,child)=>count+child.count,0);
  assert.equal(placed,selectedHomeRocks.length);
  assert.equal(placed,29);
  const variant=installed.getObjectByName('UV original rock variant 00');
  assert.ok(variant instanceof THREE.InstancedMesh);
  const first=selectedHomeRocks.find(p=>p.id===0);
  const matrix=new THREE.Matrix4();
  variant.getMatrixAt(0,matrix);
  const position=new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.ok(Math.abs(position.x-first.x)<.001);
  assert.ok(Math.abs(position.z-first.z)<.001);
  assert.equal(variant.material.map,picture,'actual UV albedo map used for instanced rocks');
  assert.equal(variant.material.transparent,false);
  assert.equal(variant.material.toneMapped,false);
});
