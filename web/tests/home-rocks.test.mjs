import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { selectedHomeRocks, rockFile, ROCK_MODELS, findCuratedRockVariant, createCuratedRockGroup, createCreekRockGroundSampler } from '../src/world/homeRocks.ts';
import { createHomeStage } from '../src/world/homeStage.ts';
import { CREEK, creekCenterX, creekWidth, createHomeCreek, createHomeCreekVegetation } from '../src/world/homeCreek.ts';

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
  assert.equal(selectedHomeRocks.length,27);
  const zones=new Set(selectedHomeRocks.map(p=>p.zone));
  assert.deepEqual([...zones].sort(),
    ['foundation','garden','path-edge','stream','well'].sort());
  const submerged=selectedHomeRocks.filter(p=>p.submerge!==undefined&&p.submerge<1);
  const underwater=selectedHomeRocks.filter(p=>p.submerge!==undefined&&p.submerge>=1);
  assert.ok(submerged.length>=6,'keep original mossy boulders partly inside water');
  assert.equal(underwater.length,4,'four small real GLB rocks should be wholly underwater');
  for(const p of [...submerged,...underwater]){
    assert.equal(p.type,'mossy');
    assert.ok(p.submerge>0);
    assert.ok(Math.abs(p.x-creekCenterX(p.z)) <
      creekWidth(p.z)*.5+p.size*.55,
      'rock footprint should actually intersect the creek water');
  }
  for(const p of underwater){
    assert.ok(p.submerge>=1.05 && p.submerge<=1.10);
    assert.ok(Math.abs(p.x-creekCenterX(p.z))<.36,'underwater rock is in the actual stream');
    assert.ok(p.size<=.65,'underwater stones stay modest in size');
  }
  const large=selectedHomeRocks.filter(p=>p.zone==='stream'&&p.size>=.95);
  assert.ok(large.length>=6&&large.length<=8,'6–8 mossy anchor boulders');
  assert.deepEqual(ROCK_MODELS,{mossy:0,plain:2});
  assert.deepEqual([...new Set(selectedHomeRocks.map(p=>p.type))].sort(),
    ['mossy','plain']);
  assert.ok(selectedHomeRocks.every(p=>p.size>=.45),'no decorative tiny pebbles');
  for(const p of selectedHomeRocks){
    assert.ok(Object.hasOwn(ROCK_MODELS,p.type));
    assert.equal(p.type==='mossy',p.zone==='stream',
      'mossy only on damp banks, ordinary stone only on dry ground');
    assert.ok(p.size>=.45&&p.size<=1.30,'metre-sized stones, no pebbles');
    assert.ok(p.yaw>=0&&p.yaw<2*Math.PI);
    if(p.zone==='stream'){
      if((p.submerge??0)>=1){
        assert.ok(Math.abs(p.x-creekCenterX(p.z))<.36,
          'real underwater bed stones may sit within the creek centre');
      }else if(p.midstream){
        assert.ok(Math.abs(p.x-creekCenterX(p.z))<.36,'current breakers stay in the channel');
      }else{
        assert.ok(Math.abs(p.x+45.5)>1.3,
          'original exposed rocks stay on bank margins, not mid-stream');
      }
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

test('home retains well and bridge but drops all old pebble and dodecahedron placeholders',()=>{
  const stage=createHomeStage(false);
  assert.ok(stage.root.getObjectByName('Old village well stone rim'));
  assert.ok(stage.root.getObjectByName('West wooden bridge walkway'));
  assert.equal(stage.root.getObjectByName('Stream bank stone'),undefined,
    'remove the former 52 dodecahedron stones'); 
  const details=stage.root.getObjectByName('Childhood home organic ground details');
  const plants=stage.root.getObjectByName('Childhood home enhanced vegetation');
  assert.ok(details);
  assert.ok(!details.children.some(c=>c.name.startsWith('Textured natural stones variant ')));
  assert.ok(!stage.root.getObjectByName('Naturally shaped textured stepping stones 0'));
  assert.ok(!stage.root.getObjectByName('Naturally shaped textured stepping stones 1'));
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
  const installed=createCuratedRockGroup(scene,createCreekRockGroundSampler(createHomeStage(false).root));
  assert.equal(installed.name,'Curated original UV textured rock placements');
  assert.ok(installed.children.every(child=>child instanceof THREE.InstancedMesh));
  assert.equal(installed.children.length,2,'exactly two rock InstancedMesh draws');
  const placed=installed.children.reduce((count,child)=>count+child.count,0);
  assert.equal(placed,selectedHomeRocks.length);
  assert.equal(placed,27);
  const variant=installed.getObjectByName('UV mossy rock variant 00');
  assert.ok(installed.getObjectByName('UV plain rock variant 02'));
  assert.ok(variant instanceof THREE.InstancedMesh);
  const first=selectedHomeRocks.find(p=>p.type==='mossy');
  const matrix=new THREE.Matrix4();
  variant.getMatrixAt(0,matrix);
  const position=new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.ok(Math.abs(position.x-first.x)<.001);
  assert.ok(Math.abs(position.z-first.z)<.001);
  assert.equal(variant.material.map,picture,'actual UV albedo map used for instanced rocks');
  assert.equal(variant.material.transparent,false);
  assert.equal(variant.material.toneMapped,false);
  // The authored GLB is only 0.3-0.5 m; the *target footprint* wins,
  // rather than old arbitrary source scale=1 which rendered tiny pebbles.
  const scale=new THREE.Vector3().setFromMatrixScale(matrix);
  assert.ok(Math.abs(scale.x-first.size/.3)<.01,'synthetic .3m rock is resized to real metres');
  const actualSize=.3*scale.x;
  assert.ok(Math.abs(actualSize-first.size)<.005);
  assert.ok(installed.userData.partiallySubmergedRocks>=6);
  assert.equal(installed.userData.fullySubmergedRocks,4);
  const underwaterIndex=selectedHomeRocks.filter(p=>p.type==='mossy')
    .findIndex(p=>p.submerge!==undefined&&p.submerge>=1);
  assert.ok(underwaterIndex>=0);
  variant.getMatrixAt(underwaterIndex,matrix);
  const fullyUnder=new THREE.Box3().setFromBufferAttribute(variant.geometry.getAttribute('position')).applyMatrix4(matrix);
  assert.ok(fullyUnder.max.y<CREEK.waterY,
    'uploaded rock mesh remains under clear water instead of poking out');
  const firstNatural=selectedHomeRocks.find(p=>p.zone==='stream'&&p.size>=1);
  assert.ok(firstNatural);
});


test('creek is truly winding water with softened banks, not a rectangle', () => {
  assert.ok(creekWidth(8.6)>2.5&&creekWidth(8.6)<3.0);
  assert.ok(creekWidth(-5.5)>creekWidth(8.6)+1.0);
  assert.notEqual(creekCenterX(-4),creekCenterX(4));
  assert.ok(CREEK.bridgeMin<8.6&&CREEK.bridgeMax>8.6);
  const creek=createHomeCreek();
  assert.equal(creek.children.length,6);
  const water=creek.getObjectByName('Shallow stream west of childhood home');
  const west=creek.getObjectByName('Soft west creek bank');
  const east=creek.getObjectByName('Soft east creek bank');
  assert.ok(water instanceof THREE.Mesh);
  assert.ok(west instanceof THREE.Mesh&&east instanceof THREE.Mesh);
  assert.ok(water.material.map instanceof THREE.DataTexture,'actual shallow-bed painted UV albedo');
  assert.ok(water.geometry.getAttribute('uv'),'water is UV unwrapped');
  assert.ok(water.geometry.getAttribute('color'),'painted depth gradient at the water edges');
  assert.ok(water.geometry.getAttribute('position').count>=300);
  const bed=creek.getObjectByName('Visible gravel bed below clear creek water');
  assert.ok(bed instanceof THREE.Mesh,'riverbed must be real 3D below water');
  assert.ok(water.material.transparent && water.material.opacity < .94,
    'clear water must reveal submerged riverbed');
  assert.ok(bed.material.map instanceof THREE.DataTexture);
  assert.ok(bed.geometry.boundingBox===null || bed.geometry.getAttribute('position').count>=300);
  const pos=water.geometry.getAttribute('position');
  const centerX=[];
  // New 3D water ribbon has six vertices per z-section (was four).
  for(let i=0;i<pos.count;i+=6)centerX.push((pos.getX(i)+pos.getX(i+5))*.5);
  assert.ok(Math.max(...centerX)-Math.min(...centerX)>.15,'water meanders instead of perfectly straight');
  const group=createHomeCreekVegetation();
  assert.equal(group.userData.clusters,17,
    'the scenic creek now has bank vegetation in both near and far reaches');
  assert.ok(group.userData.reedInstances>=40);
  assert.ok(group.userData.shrubInstances>=15);
  assert.ok(group.children.every(mesh=>mesh instanceof THREE.InstancedMesh));
  assert.ok(group.getObjectByName('Stream clustered bank grasses'));
  assert.ok(group.getObjectByName('Stream broadleaf foliage clusters'));
  const stage=createHomeStage(false);
  assert.ok(stage.root.getObjectByName(creek.name));
  assert.ok(stage.root.getObjectByName(group.name));
  assert.ok(stage.root.getObjectByName('West wooden bridge walkway'));
  assert.ok(!stage.solids.some(s=>s.label.toLowerCase().includes('creek')));
  assert.ok(!stage.solids.some(s=>s.label.toLowerCase().includes('bank')));
});


test('all actual river GLB rocks intersect the real creek bed or bank, not the water plane',()=>{
  const {raw,json}=getGlb();
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({map:new THREE.DataTexture(new Uint8Array([120,130,100,255]),1,1)});
  const start=28+raw.readUInt32LE(12);
  for(const id of [0,2]){
    const prim=json.meshes[id].primitives[0];
    const accessor=json.accessors[prim.attributes.POSITION],view=json.bufferViews[accessor.bufferView];
    const offset=start+(view.byteOffset??0)+(accessor.byteOffset??0);
    const coords=Float32Array.from({length:accessor.count*3},(_,i)=>raw.readFloatLE(offset+4*i));
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(coords,3));
    geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(accessor.count*2),2));
    geo.computeBoundingBox();
    const mesh=new THREE.Mesh(geo,material);mesh.name='LA_Rock_'+String(id).padStart(2,'0');root.add(mesh);
  }
  const terrain=createHomeStage(false).root;
  const sample=createCreekRockGroundSampler(terrain);
  const installed=createCuratedRockGroup(root,sample);
  const moss=installed.getObjectByName('UV mossy rock variant 00');
  const pos=moss.geometry.getAttribute('position'),box=moss.geometry.boundingBox;
  const mat=new THREE.Matrix4(),v=new THREE.Vector3();
  const placements=selectedHomeRocks.filter(p=>p.type==='mossy');
  for(let i=0;i<moss.count;i++){
    moss.getMatrixAt(i,mat);
    let deepest=-Infinity,top=-Infinity;
    const p=placements[i],scale=new THREE.Vector3().setFromMatrixScale(mat);
    assert.ok(Math.abs(scale.x-scale.z)<1e-6,'original footprint remains uniform');
    for(let k=0;k<pos.count;k++){
      v.fromBufferAttribute(pos,k).applyMatrix4(mat);
      top=Math.max(top,v.y);
      if(pos.getY(k)<=box.min.y+(box.max.y-box.min.y)*.12+1e-6){
        deepest=Math.max(deepest,sample(v.x,v.z)-v.y);
      }
    }
    assert.ok(deepest>=.035&&deepest<=.065,'rock '+i+' must embed into actual solid terrain: '+deepest);
    if(p.midstream)assert.ok(top>CREEK.waterY+.04&&top<CREEK.waterY+.29,'emerged breaker remains visible');
    if((p.submerge??0)>=1)assert.ok(top<CREEK.waterY-.015,'underwater rock stays submerged');
  }
});
