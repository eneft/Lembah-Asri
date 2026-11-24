import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { serializeWorldScene, serializeWorldProject } from '../src/world/worldExport.ts';

test('native world JSON round-trips editable sculpted geometry, UVs, textures and transforms', () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b5d8df');
  scene.fog = new THREE.Fog('#cfdeca',38,115);
  const geometry = new THREE.PlaneGeometry(2,2);
  geometry.attributes.position.setZ(0,3.75);
  geometry.setAttribute('uv1',new THREE.BufferAttribute(new Float32Array([0,0,1,0,1,1,0,1]),2));
  const map = new THREE.DataTexture(new Uint8Array([40,80,20,255]),1,1);
  const mat = new THREE.MeshBasicMaterial({map});
  const terrain = new THREE.Mesh(geometry,mat);
  terrain.name='Sculpted ground';
  terrain.position.set(3,2,1);
  scene.add(terrain);
  const instance = new THREE.InstancedMesh(geometry,mat,2);
  instance.name='Grass instances';
  instance.setMatrixAt(0,new THREE.Matrix4().makeTranslation(1,0,0));
  instance.setMatrixAt(1,new THREE.Matrix4().makeTranslation(2,0,0));
  scene.add(instance);
  const sun=new THREE.DirectionalLight(0xffffff,1.5);
  sun.name='Sun';
  sun.target.name='Sun target';
  scene.add(sun,sun.target);
  const hidden = new THREE.Mesh(geometry,mat);
  hidden.name='Hidden fallback';hidden.visible=false;scene.add(hidden);
  const player=new THREE.Group();player.name='Runtime player';scene.add(player);
  const json=JSON.parse(serializeWorldScene(scene,new Set([player])));
  assert.equal(json.object.type,'Scene');
  assert.equal(json.metadata.type,'Object');
  assert.equal(json.geometries.length,1,'shared geometry should stay shared');
  const loaded=new THREE.ObjectLoader().parse(json);
  const ground=loaded.getObjectByName('Sculpted ground');
  assert.equal(ground.geometry.getAttribute('position').getZ(0),3.75);
  assert.ok(ground.geometry.getAttribute('uv1'));
  assert.deepEqual(ground.position.toArray(),[3,2,1]);
  assert.equal(ground.material.map.image.data[1],80);
  assert.equal(loaded.getObjectByName('Grass instances').count,2);
  assert.equal(loaded.getObjectByName('Sun').target,loaded.getObjectByName('Sun target'));
  assert.equal(loaded.getObjectByName('Hidden fallback'),undefined);
  assert.equal(loaded.getObjectByName('Runtime player'),undefined);
  assert.equal(terrain.geometry,geometry,'export must not mutate live scene');
  assert.equal(scene.children.length,6);
});


test('world editor project includes App metadata, scene, camera and orbit center', async () => {
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#b5d8df');
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(3,3,3),new THREE.MeshBasicMaterial());
  mesh.name='Home';mesh.position.set(-30,0,0);scene.add(mesh);
  const project=JSON.parse(serializeWorldProject(scene));
  assert.equal(project.metadata.type,'App');
  assert.equal(project.scene.object.type,'Scene');
  assert.deepEqual(project.history,{undos:[],redos:[]});
  const loader=new THREE.ObjectLoader();
  const camera=await loader.parseAsync(project.camera);
  const loaded=await loader.parseAsync(project.scene);
  loaded.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const point=loaded.getObjectByName('Home').getWorldPosition(new THREE.Vector3()).project(camera);
  assert.ok(Math.abs(point.x)<1 && Math.abs(point.y)<1 && Math.abs(point.z)<1);
  assert.deepEqual(project.controls.center,[-30,0,0]);
});

test('editor geometry physically opens creek and preserves adjacent terrain', async () => {
  const {bakeCreekOpening}=await import('../src/world/editorTerrainBake.ts');
  const {creekCenterX}=await import('../src/world/creekCourse.ts');
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  ground.rotation.x=-Math.PI/2;ground.updateMatrixWorld(true);
  const cut=new THREE.Mesh(bakeCreekOpening(ground),ground.material);
  cut.rotation.copy(ground.rotation);cut.updateMatrixWorld(true);
  const hits=(x,z)=>new THREE.Raycaster(new THREE.Vector3(x,5,z),new THREE.Vector3(0,-1,0)).intersectObject(cut).length;
  for(const z of [-70,-25,-5.5,0,8.6,18,60]){
    const x=creekCenterX(z);
    assert.equal(hits(x,z),0,'creek center must be open at '+z);
    assert.ok(hits(x+5,z)>0,'land must remain at '+z);
  }
  assert.ok(cut.geometry.getAttribute('uv'));
  assert.equal(ground.geometry.getAttribute('position').count,4);
});

test('garden pigment and raised bed geometry survive native scene import', async () => {
  const {GardenSurface}=await import('../src/world/gardenSurface.ts');
  const {GARDEN,sculptGardenGround}=await import('../src/world/gardenLayout.ts');
  const scene=new THREE.Scene(), garden=new GardenSurface();
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(32,29),new THREE.MeshBasicMaterial());
  ground.rotation.x=-Math.PI/2;ground.position.set(-29,.028,.4);
  sculptGardenGround(ground);garden.bind(ground.material);scene.add(ground);
  const restored=new THREE.ObjectLoader().parse(JSON.parse(serializeWorldScene(scene)));
  const soil=restored.getObjectByName('Bedengan kebun - editor baked soil');
  assert.ok(soil?.material.map?.image.data);
  assert.equal(soil.geometry.getAttribute('color').itemSize,4);
  assert.ok(soil.geometry.index.count>100);
  const positions=soil.geometry.getAttribute('position');
  assert.ok(Array.from({length:positions.count},(_,i)=>positions.getZ(i)).some(h=>h>.2));
  assert.equal(ground.children.length,0,'runtime scene stays unchanged');
  garden.dispose();
});
