import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOME_LANDSCAPE, homeLandscapeHeight, homeBoundaryTrees, createHomeLandscapeGround, createHomeBoundaryGrove } from '../src/world/homeLandscape.ts';
import * as THREE from 'three';
import { creekCenterX } from '../src/world/creekCourse.ts';
import { HOME_AREA, resolveSceneArea, inHomeArea, constrainHomePosition } from '../src/world/sceneAreas.ts';

test('home is the default for normal, chapter and scenic views', () => {
  for (const search of ['', '?view=konsep', '?view=sungai', '?chapter=1', '?scene=unknown']) {
    assert.equal(resolveSceneArea(search), 'home');
  }
  assert.equal(resolveSceneArea('?scene=legacy'), 'legacy');
});
test('all approved home arrival points and both creek banks remain inside', () => {
  for (const [x,z] of [[-29.5,7.4],[-32.5,14.6],[-41.3,6.65],[-42.4,10.95],[-50,8.5],[-16.5,9]]) {
    assert.equal(inHomeArea(x,z), true);
    assert.deepEqual(constrainHomePosition(x,z), {x,z});
  }
  assert.equal(inHomeArea(0,0), false);
  assert.equal(inHomeArea(-13,-12), true); // near gate boundary, no village assets
});
test('player capsule cannot leave local floor on any edge', () => {
  const { minX,maxX,minZ,maxZ,playerRadius:r }=HOME_AREA;
  assert.deepEqual(constrainHomePosition(-100,-100), {x:minX+r,z:minZ+r});
  assert.deepEqual(constrainHomePosition(100,100), {x:maxX-r,z:maxZ-r});
});
test('village stages and water are created only in legacy branch', () => {
  const src=readFileSync(new URL('../src/world/Game.ts',import.meta.url),'utf8');
  const local=src.slice(src.indexOf('private addEnvironment()'),src.indexOf('private addBuilding('));
  const start=local.indexOf('if (!isolated) {');
  const end=local.indexOf("const horizon = loadWorldTexture");
  assert.ok(start>=0 && end>start);
  for(const marker of ['createWarungStage()', 'villageStream(this.villageWater)', "'Pasar Desa'", "'Puskesmas'", "'Balai Desa walls'"]){
    assert.ok(local.indexOf(marker)>start && local.indexOf(marker)<end, marker);
  }
  assert.ok(src.includes("this.area === 'home' ? constrainHomePosition"));
  assert.ok(!src.includes('HOME_ORBIT_LIMIT'));
});

test('local landscape has flat playable ground, raised natural edges and open creek',()=>{
  for (const x of [-58,-45.5,-32.5,-22,-12]) for(const z of [-26,-8.45,0,9,24])
    assert.equal(homeLandscapeHeight(x,z),0);
  assert.ok(homeLandscapeHeight(-67,-20)>0);
  assert.equal(homeLandscapeHeight(creekCenterX(-42),-42),0);
  assert.equal(homeLandscapeHeight(-8,9),0);
  const ground=createHomeLandscapeGround();
  assert.equal(ground.geometry.parameters.width,HOME_LANDSCAPE.width);
  assert.ok(ground.geometry.getAttribute('uv1').count>1000);
  assert.equal(HOME_LANDSCAPE.creekEnd-HOME_LANDSCAPE.creekStart,HOME_LANDSCAPE.depth);
});
test('boundary trees are outside gameplay and leave creek and exit unobstructed',()=>{
  const points=homeBoundaryTrees();
  assert.ok(points.length>=16);
  for(const p of points){
    assert.equal(inHomeArea(p.x,p.z),false);
    assert.ok(!(p.x>HOME_AREA.maxX && Math.abs(p.z-9)<6));
    assert.ok(Math.abs(p.x-creekCenterX(p.z))>5);
  }
  const source=new THREE.Group();
  source.add(new THREE.Mesh(new THREE.BoxGeometry(2,5,2),new THREE.MeshBasicMaterial()));
  const grove=createHomeBoundaryGrove(source);
  assert.equal(grove.children[0].count,points.length);
  assert.equal(grove.children[0].geometry,source.children[0].geometry);
  assert.equal(grove.children[0].material,source.children[0].material);
  assert.equal(grove.children[0].castShadow,false);
});
