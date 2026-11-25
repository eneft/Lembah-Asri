import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONCEPT_SHADE_TREE, createReferenceShadeTree } from '../src/world/referenceShadeTree.ts';
import { createHomeStage, HOME, ORIGINAL_COURTYARD_FRUIT_TREE } from '../src/world/homeStage.ts';
import { GARDEN, plantingPlaces } from '../src/world/gardenLayout.ts';
import { HOME_SCENIC_CAMERA } from '../src/world/homeScenicCamera.ts';
import { REFERENCE_LEAF_PASS } from '../src/world/conceptLeafPass.ts';

function inside(box,x,z,r=.29){
  return Math.abs(x-box.center[0])<box.half[0]+r&&
    Math.abs(z-box.center[2])<box.half[2]+r;
}

test('yard contains the mature shade tree and the modest fruit tree beside the well', async()=>{
  const stage=createHomeStage(false);
  await stage.ready;
  const shade=stage.root.getObjectByName('Pohon peneduh halaman');
  assert.ok(shade instanceof THREE.Group);
  assert.equal(shade.position.x,CONCEPT_SHADE_TREE.x);
  assert.equal(shade.position.z,CONCEPT_SHADE_TREE.z);
  assert.equal(shade.children.length,1);
  assert.ok(stage.solids.some(s=>s.label===shade.name && inside(s,shade.position.x,shade.position.z)));
  const tree=stage.root.getObjectByName('Old fruit tree');
  assert.ok(tree instanceof THREE.Group);
  assert.equal(tree.position.x,-40);
  assert.equal(tree.position.z,8.3);
  assert.deepEqual(ORIGINAL_COURTYARD_FRUIT_TREE,{
    x:-40,z:8.3,height:3.65,yaw:.21,seed:210917
  });
  assert.equal(stage.root.getObjectByName('Pohon tua di depan rumah'),undefined);
  assert.equal(stage.root.getObjectByName('Concept mature shade tree near the garden'),undefined);
  assert.equal(stage.root.getObjectByName('Small 3D shade plants among natural buttress roots'),undefined);
  const trunk=tree.getObjectByName('UV hand-painted tree trunk and branches');
  const leaves=tree.getObjectByName('Layered individual UV-painted tree leaves');
  assert.ok(trunk instanceof THREE.Mesh);
  assert.ok(leaves instanceof THREE.Mesh);
  assert.ok(trunk.material.map && leaves.material.map, 'retain hand-painted atlas');
  const bounds=new THREE.Box3().setFromObject(tree).getSize(new THREE.Vector3());
  assert.ok(bounds.y>3.2 && bounds.y<4.2,'return to a modest 3.65 m fruit tree');
});

test('pre-PR#93 removes obsolete big tree colliders, preserves farming and all access',()=>{
  const stage=createHomeStage(false);
  assert.ok(!stage.solids.some(s=>/sentinel|shade trunk/i.test(s.label)),
    'do not leave invisible walls where the big tree used to be');
  for(const spot of [
    [HOME.spawn.x,HOME.spawn.z],[HOME.gate.x,HOME.gate.z],
    [ORIGINAL_COURTYARD_FRUIT_TREE.x,ORIGINAL_COURTYARD_FRUIT_TREE.z],
    [-33.9,8.6],[-45.5,8.6]
  ]){
    assert.ok(stage.solids.every(s=>!inside(s,spot[0],spot[1],.28)),
      'tree restoration cannot block walking at '+spot.join(','));
  }
  assert.equal(plantingPlaces.length,24);
  assert.ok(plantingPlaces.every(p=>stage.solids.every(s=>!inside(s,p.x,p.z,.5))));
  assert.ok(stage.root.getObjectByName('West wooden bridge walkway'));
  assert.ok(stage.root.getObjectByName('Fine soft creek bank grass'));
  assert.ok(stage.root.getObjectByName('Old village well stone rim'));
});

test('original hand-painted shade GLB remains the asynchronously loaded source',()=>{
  const tree=createReferenceShadeTree();
  assert.equal(tree.children.length,4,'original 3D tree + softened roots + seedlings + 3D leaf sprays');
  assert.equal(tree.userData.referenceSource,'matching UV-painted 3D fallback');
  let meshCount=0;
  tree.traverse(node=>{if(node instanceof THREE.Mesh)meshCount++;});
  assert.equal(meshCount,5);
  const roots=tree.getObjectByName('Exposed hand-painted buttress roots');
  const attr=roots.geometry.getAttribute('uv');
  for(let i=0;i<attr.count;i++){
    assert.ok(attr.getX(i)>=0&&attr.getX(i)<=1);
    assert.ok(attr.getY(i)>=0&&attr.getY(i)<=1);
  }
});

test('opt-in riverside scene camera frames the real home yard without moving the default spawn',()=>{
  assert.equal(HOME_SCENIC_CAMERA.query,'konsep');
  assert.ok(HOME_SCENIC_CAMERA.x>-43.5&&HOME_SCENIC_CAMERA.x<-40.5);
  assert.ok(HOME_SCENIC_CAMERA.z>4.5&&HOME_SCENIC_CAMERA.z<7.2);
  assert.ok(HOME_SCENIC_CAMERA.distance>=8.5&&HOME_SCENIC_CAMERA.distance<=11);
  assert.ok(Math.abs(HOME_SCENIC_CAMERA.yaw + Math.PI/2)<.2);
  const stage=createHomeStage(false);
  assert.ok(stage.solids.every(s=>!inside(s,HOME_SCENIC_CAMERA.x,HOME_SCENIC_CAMERA.z,0.3)),
    'opt-in camera spawns player on clear riverbank, not inside the well or a tree');
  assert.deepEqual(HOME.spawn,{x:-29.5,y:1.2,z:7.4},
    'existing standard spawn stays unchanged');
});


test('courtyard climbers attach to the uploaded bark and reuse the untouched foliage atlas', async()=>{
  const {readFileSync}=await import('node:fs');
  const {addCourtyardClimbers}=await import('../src/world/treeAsset.ts');
  const data=readFileSync(new URL('../public/models/environment/pohon_pekarangan.glb',import.meta.url));
  const n=data.readUInt32LE(12), json=JSON.parse(data.subarray(20,20+n).toString());
  const bin=28+n;
  const root=new THREE.Group();
  const atlas=new THREE.Texture();
  const bark=new THREE.MeshBasicMaterial(); bark.name='Kulit kayu';
  const canopy=new THREE.MeshBasicMaterial({map:atlas}); canopy.name='Daun';
  for(const primitive of json.meshes[0].primitives){
    const g=new THREE.BufferGeometry();
    const a=json.accessors[primitive.attributes.POSITION],v=json.bufferViews[a.bufferView];
    const offset=bin+(v.byteOffset??0)+(a.byteOffset??0);
    const pos=new Float32Array(a.count*3);
    for(let i=0;i<a.count;i++)for(let j=0;j<3;j++)
      pos[i*3+j]=data.readFloatLE(offset+i*(v.byteStride??12)+4*j);
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const ix=json.accessors[primitive.indices],iv=json.bufferViews[ix.bufferView];
    const io=bin+(iv.byteOffset??0)+(ix.byteOffset??0);
    const ids=[];
    for(let i=0;i<ix.count;i++)ids.push(ix.componentType===5125?data.readUInt32LE(io+i*4):
      ix.componentType===5123?data.readUInt16LE(io+i*2):data.readUInt8(io+i));
    g.setIndex(ids);
    root.add(new THREE.Mesh(g,primitive.material===0?bark:canopy));
  }
  const original=root.children.slice();
  const count=addCourtyardClimbers(root);
  assert.ok(count>=35&&count<=100,'restrained climbing leaves on actual bark');
  const group=root.getObjectByName('Asri climbing plants');
  assert.ok(group);
  const leaves=group.getObjectByName('Small hand-painted climbing leaves');
  assert.equal(leaves.material.map,atlas);
  assert.equal(leaves.geometry.getAttribute('position').count,count*6);
  const stems=group.children.filter(m=>m.name==='Slender bark-hugging vine stem');
  assert.equal(stems.length,3);
  assert.ok(stems.filter(m=>m.userData.tip[1]>=4.6).length>=2,'two climbers reach the branch zone');
  assert.ok(stems.some(m=>m.userData.tip[1]>=4.6&&Math.hypot(m.userData.tip[0],m.userData.tip[2])>1.3),'one climber follows an outward lower branch');
  for(const stem of stems){
    const points=stem.geometry.parameters.path.curves;
    assert.ok(points.every(c=>c.v1.distanceTo(c.v2)<=.250001),'no unsupported long gap in the stem');
  }
  assert.deepEqual(root.children.slice(0,original.length),original);
  assert.equal(canopy.map,atlas);
  assert.equal(addCourtyardClimbers(root),0,'do not duplicate plants on reload');
});

test('original warm wood pigment stays intact and lichen keeps tonal variation',async()=>{
  const {naturalLichenPigment}=await import('../src/world/treeAsset.ts');
  assert.deepEqual(naturalLichenPigment(195,145,85),[195,145,85]);
  const a=naturalLichenPigment(151,159,91),b=naturalLichenPigment(176,182,112);
  assert.ok(a[1]>a[0]&&b[1]>b[0]);
  assert.ok(b[0]>a[0]&&b[1]>a[1]&&b[2]>a[2]);
  assert.ok(a[1]>=159*.95);
});


test('bark relief is non-color tangent data and leaves are outside the normal islands',async()=>{
  const {buildCourtyardBarkNormals,makeMatteCourtyardBark}=await import('../src/world/treeAsset.ts');
  const w=1254,rgba=new Uint8ClampedArray(w*w*4);
  for(let i=0;i<rgba.length;i+=4){rgba[i]=170;rgba[i+1]=110;rgba[i+2]=60;rgba[i+3]=255;}
  const at=(x,y)=>(y*w+x)*4;
  for(let y=90;y<110;y++)for(let x=101;x<110;x++)rgba[at(x,y)]=250;
  const n=buildCourtyardBarkNormals(rgba,w,w);
  assert.deepEqual([...n.slice(at(800,100),at(800,100)+4)],[128,128,255,255]);
  assert.ok(n[at(50,50)+2]>=128,'normal stays in upper hemisphere');
  assert.ok(n[at(100,100)]<128,'wood edge has real tangent relief');
  assert.ok(n.some((v,i)=>i%4===2&&v<245),'multiscale bark contains meaningful relief');
  assert.ok(n[at(100,100)+2]<255);
  const albedo=new THREE.Texture(),normal=new THREE.Texture();
  const source=new THREE.MeshBasicMaterial({map:albedo,vertexColors:true});
  source.name='Kulit kayu';
  const matte=makeMatteCourtyardBark(source,normal);
  assert.equal(matte.map,albedo);
  assert.equal(matte.normalMap,normal);
  assert.equal(matte.specular.getHex(),0);
  assert.equal(matte.vertexColors,true);
  assert.equal(matte.toneMapped,false);
  assert.deepEqual(matte.normalScale.toArray(),[.95,.95]);
  const shader={fragmentShader:'vec3 outgoingLight = reflectedLight.directDiffuse;'};
  matte.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/dot\(normal,asriBarkKey\)/);
  assert.equal(source.type,'MeshBasicMaterial');
});
