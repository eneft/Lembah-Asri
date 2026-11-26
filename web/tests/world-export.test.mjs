import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { serializeWorldScene } from '../src/world/worldExport.ts';

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

test('export rejects a missing texture source with the exact object and slot', () => {
  const scene = new THREE.Scene();
  const missing = new THREE.Texture();
  missing.name = 'textures/missing.webp';
  const material = new THREE.MeshBasicMaterial({map:missing});
  material.name = 'Roof pigment';
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(),material);
  mesh.name = 'Shed roof';
  scene.add(mesh);
  assert.throws(()=>serializeWorldScene(scene),
    /Texture not ready: textures\/missing\.webp \| mesh: Shed roof \| material: Roof pigment \| slot: map/);
  assert.equal(material.map,missing,'validation never strips the actual texture');
});

test('world export preserves real embedded albedo, normal and alpha image sources', () => {
  const scene = new THREE.Scene();
  const texture = (name, bytes) => {
    const t = new THREE.DataTexture(new Uint8Array(bytes),1,1);
    t.name = name;
    return t;
  };
  const map = texture('Authored albedo',[122,100,54,255]);
  const normalMap = texture('Authored normal',[128,128,255,255]);
  const alphaMap = texture('Authored alpha',[255,128,255,255]);
  const material = new THREE.MeshStandardMaterial({map,normalMap,alphaMap,transparent:true});
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(),material);
  scene.add(mesh);
  const json=JSON.parse(serializeWorldScene(scene));
  const result=new THREE.ObjectLoader().parse(json).children[0].material;
  assert.deepEqual(Array.from(result.map.image.data),Array.from(map.image.data));
  assert.deepEqual(Array.from(result.normalMap.image.data),Array.from(normalMap.image.data));
  assert.deepEqual(Array.from(result.alphaMap.image.data),Array.from(alphaMap.image.data));
  assert.equal(mesh.material,material);
});
