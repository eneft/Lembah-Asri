import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
  TOON_SETTINGS,TOON_VERTEX_SHADER,TOON_FRAGMENT_SHADER,
  getVillageToonRamp,createVillageToonMaterial,ToonOutlineRenderer
} from '../src/world/toonRenderer.ts';
import {createHomeStage} from '../src/world/homeStage.ts';
import {createPaintedTerrainPlane} from '../src/world/terrainMaterials.ts';
import {createHomeCreek} from '../src/world/homeCreek.ts';

test('toon material has four quantized lighting bands and no texture replacement',()=>{
  const tex=getVillageToonRamp();
  assert.equal(getVillageToonRamp(),tex,'shared 4 tone ramp');
  assert.equal(tex.image.width,4);
  assert.equal(tex.image.height,1);
  assert.equal(tex.image.data.length,16);
  assert.equal(tex.minFilter,THREE.NearestFilter);
  assert.equal(tex.magFilter,THREE.NearestFilter);
  assert.equal(tex.colorSpace,THREE.NoColorSpace);
  assert.ok(!tex.generateMipmaps);
  for(const r of [146,188,224,255]){
    assert.ok(tex.image.data.includes(r));
  }
  const mat=createVillageToonMaterial('#a98465');
  assert.equal(mat.type,'MeshToonMaterial');
  assert.equal(mat.gradientMap,tex);
  assert.equal(mat.userData.style,'toon-4-band');
  assert.equal(mat.color.getHexString(),'a98465');
  assert.equal(mat.map,null,'user-authored UV textures are not touched');
  assert.equal(mat.transparent,false);
});

test('postprocess draws BLACK depth-based silhouette rather than overpainted texture edges',()=>{
  assert.deepEqual(TOON_SETTINGS.ink,[0,0,0]);
  assert.equal(TOON_SETTINGS.taps,5);
  assert.ok(TOON_SETTINGS.pixelWidthMobile <= 1.15);
  assert.ok(TOON_SETTINGS.colorStepping < .2,'retain handpainted picture details');
  assert.match(TOON_VERTEX_SHADER,/gl_Position=vec4\(position\.xy/);
  assert.match(TOON_FRAGMENT_SHADER,/uniform sampler2D uSceneColor/);
  assert.match(TOON_FRAGMENT_SHADER,/uniform sampler2D uSceneDepth/);
  assert.match(TOON_FRAGMENT_SHADER,/viewDistance/);
  assert.match(TOON_FRAGMENT_SHADER,/smoothstep\(\.055,\.16/);
  assert.match(TOON_FRAGMENT_SHADER,/center>\.99998/);
  assert.match(TOON_FRAGMENT_SHADER,/stylized,mix|mix\(stylized,vec3\(0\.0\),edge\*\.96\)/);
  assert.match(TOON_FRAGMENT_SHADER,/#include <colorspace_fragment>/);
  assert.equal(
    (TOON_FRAGMENT_SHADER.match(/texture2D\(uSceneDepth/g)||[]).length,5,
    'one center + four neighbors, mobile GPU friendly'
  );
  assert.ok(!TOON_FRAGMENT_SHADER.includes('texture2D(uNormal'),
    'no extra normal render pass');
  assert.equal(typeof ToonOutlineRenderer,'function');
});

test('game uses toon in actual main render loop, resizes and disposes framebuffer',()=>{
  const game=readFileSync(new URL('../src/world/Game.ts',import.meta.url),'utf8');
  assert.match(game,/new ToonOutlineRenderer\(this\.renderer,mobile\)/);
  assert.match(game,/this\.toonRenderer\.render\(this\.scene,this\.camera\)/);
  assert.match(game,/this\.toonRenderer\?\.resize\(\)/);
  assert.match(game,/this\.toonRenderer\?\.dispose\(\)/);
  assert.match(game,/return createVillageToonMaterial\(color\)/);
  assert.match(game,/this\.renderer\.setPixelRatio\(Math\.min\(window\.devicePixelRatio/);
  const toonSource=readFileSync(new URL('../src/world/toonRenderer.ts',import.meta.url),'utf8');
  assert.match(toonSource,/new THREE\.DepthTexture/);
  assert.match(toonSource,/depthBuffer:true/);
  assert.match(toonSource,/this\.renderer\.getDrawingBufferSize/);
  assert.match(toonSource,/this\.renderer\.setRenderTarget\(this\.target\)/);
  assert.match(toonSource,/Toon unsupported on this GPU/);
});

test('all handpainted scene assets still keep their original materials and physics',()=>{
  const scene=createHomeStage(false);
  const creek=createHomeCreek();
  const water=creek.getObjectByName('Shallow stream west of childhood home');
  const bank=creek.getObjectByName('Soft west creek bank');
  assert.equal(water.material.type,'MeshBasicMaterial');
  assert.equal(bank.material.type,'MeshBasicMaterial');
  assert.equal(water.material.transparent,true);
  assert.ok(scene.root.getObjectByName('Bamboo UV PBR — North rear fence'));
  assert.ok(scene.root.getObjectByName('West wooden bridge walkway'));
  assert.ok(scene.root.getObjectByName('Sculpted 3D banks blending into village terrain'));
  const terrain=createPaintedTerrainPlane('grass',160,160,0,0,0);
  assert.equal(terrain.material.type,'MeshBasicMaterial');
  assert.equal(terrain.material.userData.terrainSurface,'grass');
  assert.equal(scene.root.getObjectByName('Feathered organic courtyard soil 0'),undefined);
  assert.ok(scene.solids.some(s=>s.label==='Childhood home walls'));
  assert.equal(scene.solids.filter(s=>/bamboo fence|fence/i.test(s.label)).length,6);
});
