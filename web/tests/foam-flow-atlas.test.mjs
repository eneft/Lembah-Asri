import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createHomeCreek,CREEK_FOAM_ART,CREEK_FOAM_FLOW,updateHomeCreekWater} from '../src/world/homeCreek.ts';

test('the exact source image is now a real transparent raster atlas, not a traced SVG',()=>{
  assert.equal(CREEK_FOAM_ART,'./textures/terrain/creek_foam_painterly_restored_v2.png');
  assert.equal(CREEK_FOAM_FLOW.columns,3);
  assert.equal(CREEK_FOAM_FLOW.rows,4);
  assert.equal(CREEK_FOAM_FLOW.intervalMetres,5.9);
  assert.ok(CREEK_FOAM_FLOW.longitudinalCoverage>.22&&CREEK_FOAM_FLOW.longitudinalCoverage<.25);
  assert.ok(CREEK_FOAM_FLOW.transverseCoverage>.24&&CREEK_FOAM_FLOW.transverseCoverage<.26);
  assert.ok(CREEK_FOAM_FLOW.opacityFraction>=.78&&CREEK_FOAM_FLOW.opacityFraction<=.82);
  const png=readFileSync(new URL('../public/textures/terrain/creek_foam_painterly_restored_v2.png',import.meta.url));
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(png.readUInt32BE(16),480,'twelve painterly decals in 3 columns');
  assert.equal(png.readUInt32BE(20),480,'twelve painterly decals in 4 rows');
  assert.ok(png.length>24000&&png.length<50000,'mobile-optimized alpha-safe original art');
  const alphaChunk=png.indexOf(Buffer.from('tRNS'));
  assert.ok(alphaChunk>0,'the original transparent brush edge must survive');
  const alphaSize=png.readUInt32BE(alphaChunk-4);
  const alphaBytes=png.subarray(alphaChunk+4,alphaChunk+4+alphaSize);
  assert.ok(Math.max(...alphaBytes)>=240,
    'white foam cores must be opaque; previous int16 overflow erased them');
  assert.ok(alphaBytes.filter(v=>v>190).length>=3,
    'several painterly alpha bands should remain fully visible');
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
  assert.ok(foam.material.opacity>=.69&&foam.material.opacity<=.71,'strong readable source strokes stay local to the current');
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
  assert.match(shader.fragmentShader,/step\(\.24,seed\)/);
  assert.doesNotMatch(shader.fragmentShader,/float feather=smoothstep/,'do not blur supplied illustration with a large feather mask');
  assert.match(shader.fragmentShader,/float paintedStroke=paintedFoam\.a\*inside\*sporadic\*\.80/);
  assert.match(shader.fragmentShader,/diffuseColor\.rgb\*=paintedFoam\.rgb/);
  assert.doesNotMatch(shader.fragmentShader,/local=vec2\(clamp\(advance/,
    'avoid rejected full-width diffuse white smears');
  assert.match(shader.fragmentShader,/#include <map_fragment>/,'retain original fallback map sample');
  updateHomeCreekWater(water,12.5);
  assert.equal(foam.userData.foamTimeUniform.value,12.5);
  assert.equal(water.userData.rippleUniform.value,12.5);
  assert.equal(group.getObjectByName('Painted foam breaking against mossy river boulders').count,7);
});