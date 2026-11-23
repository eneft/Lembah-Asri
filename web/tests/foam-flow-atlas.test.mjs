import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createHomeCreek,CREEK_FOAM_ART,CREEK_FOAM_FLOW,updateHomeCreekWater} from '../src/world/homeCreek.ts';

test('the exact source image is now a real transparent raster atlas, not a traced SVG',()=>{
  assert.equal(CREEK_FOAM_ART,'./textures/terrain/creek_foam_original_painterly_atlas.png');
  assert.equal(CREEK_FOAM_FLOW.columns,3);
  assert.equal(CREEK_FOAM_FLOW.rows,4);
  assert.equal(CREEK_FOAM_FLOW.intervalMetres,7.9);
  assert.ok(CREEK_FOAM_FLOW.longitudinalCoverage<.17);
  assert.ok(CREEK_FOAM_FLOW.transverseCoverage<.23);
  assert.ok(CREEK_FOAM_FLOW.opacityFraction>=.60&&CREEK_FOAM_FLOW.opacityFraction<=.65);
  const png=readFileSync(new URL('../public/textures/terrain/creek_foam_original_painterly_atlas.png',import.meta.url));
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(png.readUInt32BE(16),384,'twelve source-decals packed in 3 columns');
  assert.equal(png.readUInt32BE(20),384,'twelve source-decals packed in 4 rows');
  assert.ok(png.length>4000&&png.length<20000,'mobile texture without source art loss');
  assert.ok(png.includes(Buffer.from('tRNS')),'the original semi-transparent paint must survive');
});

test('new foam flows downstream while retaining stable old-water fallback',()=>{
  const group=createHomeCreek();
  assert.equal(group.children.length,6,'river, shores and mossy wake structure preserved');
  const foam=group.getObjectByName('Illustrated river foam and flow trails');
  const water=group.getObjectByName('Shallow stream west of childhood home');
  assert.ok(foam instanceof THREE.Mesh);
  assert.ok(water instanceof THREE.Mesh);
  assert.ok(foam.material.map instanceof THREE.DataTexture,'retain procedural fallback until PNG loads');
  assert.equal(foam.userData.foamAtlasReady.value,0);
  assert.ok(foam.material.opacity>=.58&&foam.material.opacity<=.60,'clear creek remains visible under the sharp foam strokes');
  assert.equal(foam.userData.flowDirection,'positive-Z');
  const shader={
    vertexShader:'#include <begin_vertex>',
    fragmentShader:'#include <map_fragment>',
    uniforms:{}
  };
  foam.material.onBeforeCompile(shader,{});
  assert.equal(shader.uniforms.uFoamSeconds,foam.userData.foamTimeUniform);
  assert.equal(shader.uniforms.uFoamAtlasReady,foam.userData.foamAtlasReady);
  assert.match(shader.vertexShader,/vFoamWorldXZ/);
  assert.match(shader.fragmentShader,/downstream=vFoamWorldXZ.y\+79.5-uFoamSeconds\*\.11/);
  assert.match(shader.fragmentShader,/texture2D\(map,atlasUV\)/);
  assert.match(shader.fragmentShader,/step\(\.31,seed\)/);
  assert.doesNotMatch(shader.fragmentShader,/float feather=smoothstep/,'do not blur supplied illustration with a large feather mask');
  assert.match(shader.fragmentShader,/float paintedStroke=paintedFoam\.a\*inside\*sporadic\*\.62/);
  assert.match(shader.fragmentShader,/diffuseColor\.rgb\*=paintedFoam\.rgb/);
  assert.doesNotMatch(shader.fragmentShader,/local=vec2\(clamp\(advance/,
    'avoid rejected full-width diffuse white smears');
  assert.match(shader.fragmentShader,/#include <map_fragment>/,'retain original fallback map sample');
  updateHomeCreekWater(water,12.5);
  assert.equal(foam.userData.foamTimeUniform.value,12.5);
  assert.equal(water.userData.rippleUniform.value,12.5);
  assert.equal(group.getObjectByName('Painted foam breaking against mossy river boulders').count,7);
});