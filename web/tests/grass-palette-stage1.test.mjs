import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  WARM_GRASS_STYLE, WARM_GRASS_GLSL,
  ensureWarmGrassGLSL, applyWarmCourtyardGrass
} from '../src/world/grassPalette.ts';
import {applyMeadowAntiTileShader} from '../src/world/meadowAntiTile.ts';
import {applyRiversidePaint} from '../src/world/riversidePaint.ts';
import {createTerrainMaterial} from '../src/world/terrainMaterials.ts';
import {createHomeStage} from '../src/world/homeStage.ts';

function compiled(material) {
  const shader={
    vertexShader:'#include <begin_vertex>',
    fragmentShader:'#include <map_fragment>\n#include <color_fragment>',
    uniforms:{}
  };
  material.onBeforeCompile(shader,{});
  return shader;
}

test('one shader softly harmonizes authored grass while preserving other albedos',()=>{
  assert.equal(WARM_GRASS_STYLE.greenOnly,true);
  assert.equal(WARM_GRASS_STYLE.originalTexturesPreserved,true);
  assert.match(WARM_GRASS_GLSL,/float greenMask=smoothstep/);
  assert.match(WARM_GRASS_GLSL,/return mix\(grassPigment,softened/);
  const grass=createTerrainMaterial('grass',160,160,false,true);
  applyMeadowAntiTileShader(grass);
  applyRiversidePaint(grass,'meadow');
  const result=compiled(grass);
  assert.match(result.fragmentShader,/paintedMeadow=lembahWarmGrass\(paintedMeadow\)/);
  assert.match(result.fragmentShader,/lawn=lembahWarmGrass\(lawn\)/);
  assert.equal((result.fragmentShader.match(/vec3 lembahWarmGrass\(/g)||[]).length,1);
  assert.equal(grass.userData.warmGrassStyle,WARM_GRASS_STYLE.version);
  assert.equal(grass.toneMapped,false);
  assert.equal(grass.userData.tileRepeat.x,160/3.5);
  const earth=createTerrainMaterial('earth',160,160,false,true);
  assert.equal(earth.userData.warmGrassStyle,undefined);
  assert.doesNotMatch(compiled(earth).fragmentShader,/lembahWarmGrass/);
});

test('slope and wet bank lip share grass palette; water, gravel and physics untouched',()=>{
  const stage=createHomeStage(false);
  for(const name of ['Soft west creek bank','Soft east creek bank',
    'West bank sculpted meadow terrain','East bank sculpted meadow terrain']){
    const mesh=stage.root.getObjectByName(name);
    assert.ok(mesh instanceof THREE.Mesh,name);
    assert.equal(mesh.material.userData.warmGrassStyle,WARM_GRASS_STYLE.version);
    const shader=compiled(mesh.material);
    assert.equal((shader.fragmentShader.match(/vec3 lembahWarmGrass\(/g)||[]).length,1);
  }
  for(const name of ['Shallow stream west of childhood home',
    'Visible gravel bed below clear creek water',
    'Illustrated river foam and flow trails']){
    const mesh=stage.root.getObjectByName(name);
    assert.ok(mesh instanceof THREE.Mesh,name);
    assert.equal(mesh.material.userData.warmGrassStyle,undefined);
  }
  assert.equal(stage.root.getObjectByName('Pohon tua di depan rumah'),undefined);
  assert.ok(stage.root.getObjectByName('Old fruit tree'));
  assert.ok(stage.gardenGround.vertices.length>0);
  assert.equal(stage.solids.some(s=>/riverbank|bank contour/i.test(s.label)),false);
});

test('courtyard uses one grade before soil paint; combined shaders never declare twice',()=>{
  const mat=new THREE.MeshBasicMaterial();
  applyWarmCourtyardGrass(mat);
  applyRiversidePaint(mat,'meadow');
  const shader=compiled(mat);
  assert.match(shader.fragmentShader,/diffuseColor.rgb=lembahWarmGrass\(diffuseColor.rgb\)/);
  assert.match(shader.fragmentShader,/lawn=lembahWarmGrass\(lawn\)/);
  assert.equal((shader.fragmentShader.match(/vec3 lembahWarmGrass\(/g)||[]).length,1);
  assert.equal(mat.userData.warmGrassStyle,WARM_GRASS_STYLE.version);
  const cacheKey=mat.customProgramCacheKey();
  applyWarmCourtyardGrass(mat);
  assert.equal(mat.customProgramCacheKey(),cacheKey);
  assert.equal(ensureWarmGrassGLSL(shader.fragmentShader),shader.fragmentShader);
});
