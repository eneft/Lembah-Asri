import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import { createHomeStage } from '../src/world/homeStage.ts';
import { GARDEN, gardenUV, gardenProfile, gardenHeightAt, isWorkedGarden, plantingPlaces } from '../src/world/gardenLayout.ts';
import { GardenSurface, gardenArtURL } from '../src/world/gardenSurface.ts';
import { FarmPlots, availableActions, reachablePlot, cropStage, GROW_TIME } from '../src/world/farmPlots.ts';

test('vegetable bed axes stay straight and parallel to the neighboring bamboo fence',()=>{
  // The near east boundary runs north/south (constant X), so each ridge
  // must follow world Z; only tiny organic meanders are permitted.
  assert.equal(GARDEN.yaw,0,'bed rows must not be visibly skewed to the fence');
  assert.equal(plantingPlaces.length,24,'keep every saved farming plot ID');
  for(let row=0;row<4;row++){
    const plots=plantingPlaces.filter(p=>p.row===row);
    assert.equal(plots.length,6);
    const xs=plots.map(p=>p.x),zs=plots.map(p=>p.z);
    assert.ok(Math.max(...xs)-Math.min(...xs)<.16,
      'each row must stay straight along the fence direction');
    assert.ok(Math.max(...zs)-Math.min(...zs)>4.6,
      'preserve full bed length and cultivation slots');
    assert.ok(Math.max(...xs)<-17.5,
      'rows stay clear of the bamboo fence at x=-16.8');
  }
  // Moving the unified transform must also update the raised soil itself,
  // the UV pigment sampling and the collision used by farming actions.
  for(const p of plantingPlaces){
    const uv=gardenUV(p.x,p.z);
    assert.ok(Math.abs(uv.u-p.u)<1e-9);
    assert.ok(Math.abs(1-uv.t-p.v)<1e-9);
    assert.ok(Math.abs(gardenHeightAt(p.x,p.z)-p.height)<1e-6);
    assert.ok(isWorkedGarden(p.x,p.z));
  }
});

test('four relief ridges, painted pigment and walkable triangles register at all 24 planting places', async () => {
  await RAPIER.init();
  const stage = createHomeStage(false);
  const yard = stage.root.getObjectByName('Childhood courtyard - earth clearing');
  const pos = yard.geometry.getAttribute('position'), paint = yard.geometry.getAttribute('gardenPaint');
  let raised = 0, feather = 0;
  for (let i = 0; i < pos.count; i++) {
    const {u,t} = gardenUV(yard.position.x + pos.getX(i), yard.position.z - pos.getY(i));
    assert.ok(Math.abs(paint.getX(i) - u) < 1e-5 && Math.abs(paint.getY(i) - (1 - t)) < 1e-5);
    if (paint.getZ(i) === 0) assert.equal(pos.getZ(i), 0, 'yard meets original grade at its boundary');
    if (pos.getZ(i) > .15) raised++;
    if (paint.getZ(i) > .1 && paint.getZ(i) < .9) feather++;
  }
  assert.ok(raised > 150 && feather > 100);
  const file = readFileSync(new URL('../public/' + gardenArtURL.slice(2), import.meta.url));
  assert.equal(file.toString('ascii', 8, 12), 'WEBP');
  const world = new RAPIER.World({x:0,y:-9.81,z:0});
  try {
    const terrain = world.createCollider(RAPIER.ColliderDesc.trimesh(stage.gardenGround.vertices, stage.gardenGround.indices));
    assert.equal(plantingPlaces.length, 24);
    for (const p of plantingPlaces) {
      const ray = new RAPIER.Ray({x:p.x, y:2, z:p.z},{x:0,y:-1,z:0});
      const hit = terrain.castRay(ray, 3, false);
      assert.ok(hit > 0 && Math.abs(2 - hit - p.height) < .026, 'player stands on the rendered soil');
      assert.ok(p.height > .18 && isWorkedGarden(p.x,p.z));
    }
  } finally { world.free(); }
  for (const u of [.31, .49, .68]) assert.ok(gardenProfile(u,.5).height < .008, 'walkable furrows between the four crests');
  assert.equal(gardenHeightAt(-45.5,9),0);
  assert.equal(reachablePlot(-29.5,7.4,0), -1);
});

test('hoe, water and sow affect only the nearby place, persist, grow and harvest once',()=>{
  const bytes = new Map(), storage={getItem:k=>bytes.get(k) ?? null,setItem:(k,v)=>bytes.set(k,v)};
  const t=900_000, farm=new FarmPlots(storage);
  const p=plantingPlaces[9], next=plantingPlaces[10];
  assert.equal(reachablePlot(p.x,p.z,Math.PI/2),p.id);
  assert.deepEqual(availableActions(farm.plots[p.id],t),['hoe']);
  for(const action of ['sow','water','harvest']) assert.equal(farm.act(p.id,action,t),false);
  assert.ok(farm.act(p.id,'hoe',t) && farm.act(p.id,'water',t+10) && farm.act(p.id,'sow',t+20));
  assert.equal(farm.act(p.id,'water',t+30),false, 'duplicate watering cannot reset the growth clock');
  const reload=new FarmPlots(storage);
  assert.deepEqual(reload.plots,farm.plots);
  assert.equal(cropStage(reload.plots[p.id],t+20),'seed');
  assert.equal(cropStage(reload.plots[p.id],t+20+GROW_TIME/4),'sprout');
  assert.equal(cropStage(reload.plots[p.id],t+20+GROW_TIME),'ripe');
  assert.ok(reload.act(p.id,'harvest',t+20+GROW_TIME));
  assert.equal(reload.act(p.id,'harvest',t+21+GROW_TIME),false);
  assert.equal(new FarmPlots(storage).plots[p.id].harvests,1);
  assert.ok(reload.act(next.id,'hoe',t) && reload.act(next.id,'sow',t+1));
  assert.equal(cropStage(reload.plots[next.id],t+2*GROW_TIME),'seed', 'dry seeds wait for water');
  assert.ok(reload.act(next.id,'water',t+2*GROW_TIME));
  assert.equal(cropStage(reload.plots[next.id],t+3*GROW_TIME),'ripe');
  assert.deepEqual(availableActions(reload.plots[0],t),['hoe']);
});

test('soil work and crop instances stay confined to the worked spot',()=>{
  const farm=new FarmPlots(null), surface=new GardenSurface(), material=new THREE.MeshBasicMaterial();
  surface.bind(material);
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};
  material.onBeforeCompile(shader,{});
  const mask=shader.uniforms.uFarmSoil.value, at=(p,c)=>{
    const {width,height,data}=mask.image;
    return data[4*(Math.floor(p.v*height)*width+Math.floor(p.u*width))+c];
  };
  const p=plantingPlaces[1], neighbour=plantingPlaces[2], t=100_000;
  farm.act(p.id,'hoe',t);
  surface.paintSoil(farm.plots);
  assert.ok(at(p,0)>230 && at(p,1)===0 && at(neighbour,0)===0);
  farm.act(p.id,'water',t); farm.act(p.id,'sow',t);
  surface.paintSoil(farm.plots); surface.grow(farm.plots,t);
  assert.ok(at(p,1)>230 && at(neighbour,1)===0);
  assert.deepEqual(surface.crops.children.map(b=>b.count),[3,0]);
  surface.grow(farm.plots,t+GROW_TIME);
  assert.deepEqual(surface.crops.children.map(b=>b.count),[0,1]);
  surface.dispose();
});
