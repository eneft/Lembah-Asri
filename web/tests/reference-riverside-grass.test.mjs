import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTerrainMaterial} from '../src/world/terrainMaterials.ts';
import {applyMeadowAntiTileShader} from '../src/world/meadowAntiTile.ts';
import {applyRiversidePaint} from '../src/world/riversidePaint.ts';
import {createFineCreekBankGrass} from '../src/world/homeTerrain3D.ts';

// Strict visual-reference guardrails: keep the source painted UV textures,
// warm green/earth palette and bank grass geometry. No world physics edits.
test('reference meadow retains hand-painted atlas with consistent golden-green shoreline',()=>{
  const ground=createTerrainMaterial('grass',160,160,false,true);
  applyMeadowAntiTileShader(ground);
  applyRiversidePaint(ground,'meadow');
  const shader={
    vertexShader:'#include <begin_vertex>',
    fragmentShader:'#include <map_fragment>\n#include <color_fragment>',
    uniforms:{}
  };
  ground.onBeforeCompile(shader,{});
  assert.match(shader.fragmentShader,/paintedMeadow\*=vec3\(\.94,1\.085,\.83\)/);
  assert.match(shader.fragmentShader,/vec3 grassShade=vec3\(\.29,\.45,\.16\)/);
  assert.match(shader.fragmentShader,/vec3 grassSun=vec3\(\.67,\.73,\.31\)/);
  assert.match(shader.fragmentShader,/trailZ=8\.6/);
  assert.match(shader.fragmentShader,/uBankMeadow/);
  assert.ok(shader.uniforms.uBankMeadow);
  assert.equal(ground.userData.terrainSurface,'grass');
  assert.equal(ground.userData.worldUV,true);
});
test('riverbank grass is low, dense and uses a single UV-compatible instanced draw',()=>{
  const grass=createFineCreekBankGrass();
  assert.ok(grass instanceof THREE.InstancedMesh);
  assert.ok(grass.count>550&&grass.count<1100);
  assert.equal(grass.geometry.index.count/3<=36,true);
  assert.equal(grass.userData.visualOnly,true);
  const matrix=new THREE.Matrix4(),pos=new THREE.Vector3();
  for(let i=0;i<grass.count;i++){
    grass.getMatrixAt(i,matrix);
    pos.setFromMatrixPosition(matrix);
    assert.ok(pos.z<=5.95||pos.z>=11.30,'bridge area stays vegetation-free');
  }
});
