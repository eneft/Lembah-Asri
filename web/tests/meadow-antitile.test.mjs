import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {MEADOW_ANTI_TILE,applyMeadowAntiTileShader} from '../src/world/meadowAntiTile.ts';
import {createPaintedTerrainPlane} from '../src/world/terrainMaterials.ts';
import {carveVisualCreek} from '../src/world/homeCreek.ts';
import {createSculptedCreekMeadow} from '../src/world/homeTerrain3D.ts';
import {createHomeStage} from '../src/world/homeStage.ts';

function shaderFor(material){
  const shader={
    vertexShader:'void main(){\n#include <begin_vertex>\n}',
    fragmentShader:'void main(){\n#include <clipping_planes_fragment>\n#include <map_fragment>\n}',
    uniforms:{}
  };
  material.onBeforeCompile(shader,{});
  return shader;
}

test('global village grass uses 2-sample warped UV, no repeated 3.5m aligned grid',()=>{
  assert.equal(MEADOW_ANTI_TILE.imageSamples,2);
  assert.equal(MEADOW_ANTI_TILE.worldTileMetres,3.5);
  const ground=createPaintedTerrainPlane('grass',160,160,0,0,0);
  assert.equal(ground.material.userData.worldUV,true);
  carveVisualCreek(ground);
  applyMeadowAntiTileShader(ground.material);
  assert.equal(ground.material.userData.meadowAntiTile,true);
  assert.equal(applyMeadowAntiTileShader(ground.material),ground.material);
  const shader=shaderFor(ground.material);
  assert.match(shader.vertexShader,/vMeadowWorldXZ/);
  assert.match(shader.vertexShader,/vCreekWorldXZ/);
  assert.match(shader.fragmentShader,/vMeadowWorldXZ/);
  assert.match(shader.fragmentShader,/waveMeadow/);
  assert.match(shader.fragmentShader,/uvFine/);
  assert.match(shader.fragmentShader,/uvWide/);
  assert.match(shader.fragmentShader,/grassBroad/);
  assert.match(shader.fragmentShader,/paintedMeadow=mix\(grassFine,grassBroad,\.41\)/);
  assert.match(shader.fragmentShader,/discard/);
  assert.equal((shader.fragmentShader.match(/texture2D\(/g)||[]).length,2);
  assert.match(ground.material.customProgramCacheKey(),/meadow-broken-tiling-v3/);
  assert.equal(ground.material.transparent,false);
  assert.equal(ground.material.depthWrite,true);
});

test('sculpted river meadow now shares UV sample coordinates with large village meadow',()=>{
  const ground=createPaintedTerrainPlane('grass',160,160,0,0,0);
  applyMeadowAntiTileShader(ground.material);
  const grassShader=shaderFor(ground.material);
  const shoulder=createSculptedCreekMeadow().children[0];
  const shoreShader=shaderFor(shoulder.material);
  for(const code of [
    'uvFine=vMapUv+waveMeadow',
    'uvFine.x*.52-uvFine.y*.27+1.23',
    'paintedGrass=mix(grassFine,grassBroad,.41)',
    'colorWash=sin(pMeadow.x*.044+pMeadow.y*.031)'
  ]){
    assert.ok(shoreShader.fragmentShader.includes(code),'missing shoulder '+code);
    const mainCode=code.replace('paintedGrass=mix','paintedMeadow=mix');
    assert.ok(grassShader.fragmentShader.includes(mainCode),'missing main '+mainCode);
  }
  assert.equal(shoulder.material.userData.riverbankPainterlyStyle,'grassy-shoulder');
  assert.ok(shoulder.geometry.getAttribute('uv1'));
  assert.ok(shoulder.material.alphaMap,'retain organic terrain fade');
  assert.equal(shoulder.material.userData.worldUV,true);
});

test('tiled-grass workaround does not introduce dark decals or rewrite PBR objects',()=>{
  const stage=createHomeStage(false);
  assert.equal(stage.root.getObjectByName('Feathered organic courtyard soil 0'),undefined);
  assert.ok(stage.root.getObjectByName('Meandering shallow creek and earthen banks'));
  assert.ok(stage.root.getObjectByName('Sculpted 3D banks blending into village terrain'));
  assert.ok(stage.root.getObjectByName('Bamboo UV PBR — North rear fence'));
  assert.ok(stage.root.getObjectByName('West wooden bridge walkway'));
  assert.ok(stage.root.getObjectByName('Painted foam breaking against mossy river boulders'));
  assert.ok(stage.solids.some(s=>s.label==='Childhood home walls'));
  const gameSource=readFileSync(new URL('../src/world/Game.ts',import.meta.url),'utf8');
  assert.match(gameSource,/applyMeadowAntiTileShader\(ground\.material, isolated\)/);
  const textureSource=readFileSync(new URL('../src/world/terrainMaterials.ts',import.meta.url),'utf8');
  assert.match(textureSource,/binding\.surface === 'grass' && binding\.worldUV/);
  assert.match(textureSource,/MirroredRepeatWrapping/);
  const unpainted=new THREE.MeshBasicMaterial({color:'#fff'});
  assert.throws(()=>applyMeadowAntiTileShader(unpainted));
});

test('home exterior matches courtyard brush scale, without changing geometry or legacy sampling',()=>{
  const home=createPaintedTerrainPlane('grass',88,94,-35,-1,0);
  const uv=Array.from(home.geometry.getAttribute('uv1').array);
  applyMeadowAntiTileShader(home.material,true);
  const shader=shaderFor(home.material);
  assert.deepEqual(home.material.userData.homeCourtyardUVMetres,[26.25,23.79]);
  assert.match(shader.fragmentShader,/vMapUv\*vec2\(\.133333,\.14709\)/);
  assert.match(shader.fragmentShader,/paintedMeadow\*vec3\(1\.10,1\.0,\.84\)/);
  assert.equal((shader.fragmentShader.match(/texture2D\(/g)||[]).length,2);
  assert.deepEqual(Array.from(home.geometry.getAttribute('uv1').array),uv);
  const legacy=createPaintedTerrainPlane('grass',160,160,0,0,0);
  applyMeadowAntiTileShader(legacy.material);
  assert.equal(legacy.material.userData.homeCourtyardUVMetres,undefined);
  assert.notEqual(home.material.customProgramCacheKey(),legacy.material.customProgramCacheKey());
});
