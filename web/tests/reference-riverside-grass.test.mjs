import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTerrainMaterial} from '../src/world/terrainMaterials.ts';
import {applyMeadowAntiTileShader} from '../src/world/meadowAntiTile.ts';
import {applyRiversidePaint} from '../src/world/riversidePaint.ts';
import {createFineCreekBankGrass} from '../src/world/homeTerrain3D.ts';

// Strict visual-reference guardrails: keep the source painted UV textures,
// warm green/earth palette and bank grass geometry. No world physics edits.
test('restored meadow retains the prior approved painted grass atlas without added colour grading',()=>{
  const ground=createTerrainMaterial('grass',160,160,false,true);
  applyMeadowAntiTileShader(ground);
  applyRiversidePaint(ground,'meadow');
  const shader={
    vertexShader:'#include <begin_vertex>',
    fragmentShader:'#include <map_fragment>\n#include <color_fragment>',
    uniforms:{}
  };
  ground.onBeforeCompile(shader,{});
  assert.match(shader.fragmentShader,/paintedMeadow\*=1\.0\+\.022\*colorWash/);
  assert.doesNotMatch(shader.fragmentShader,/paintedMeadow\*=vec3\(\.94,1\.085,\.83\)/);
  assert.match(shader.fragmentShader,/vec3 lawn=mix\(blades,broad,\.20\)/);
  assert.doesNotMatch(shader.fragmentShader,/vec3 grassShade=vec3/);
  assert.match(shader.fragmentShader,/trailZ=8\.6/);
  assert.match(shader.fragmentShader,/uBankMeadow/);
  assert.ok(shader.uniforms.uBankMeadow);
  assert.equal(ground.userData.terrainSurface,'grass');
  assert.equal(ground.userData.worldUV,true);
});
test('previous soft creek grass density and collision-free instancing are restored',()=>{
  const grass=createFineCreekBankGrass();
  assert.ok(grass instanceof THREE.InstancedMesh);
  assert.ok(grass.count>260&&grass.count<600);
  assert.equal(grass.geometry.index.count/3<=36,true);
  assert.equal(grass.userData.visualOnly,true);
  const matrix=new THREE.Matrix4(),pos=new THREE.Vector3();
  for(let i=0;i<grass.count;i++){
    grass.getMatrixAt(i,matrix);
    pos.setFromMatrixPosition(matrix);
    assert.ok(pos.z<6.2||pos.z>11.2,'prior bridge approach grass clearance is preserved');
  }
});
