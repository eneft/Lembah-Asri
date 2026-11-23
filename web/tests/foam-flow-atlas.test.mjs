import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createHomeCreek,CREEK_FOAM_ART,CREEK_FOAM_FLOW,updateHomeCreekWater} from '../src/world/homeCreek.ts';

test('the generated foam image is shipped as a transparent painterly atlas',()=>{
  assert.equal(CREEK_FOAM_ART,'./textures/terrain/creek_foam_painterly_flow.svg');
  assert.equal(CREEK_FOAM_FLOW.columns,3);
  assert.equal(CREEK_FOAM_FLOW.rows,4);
  const svg=readFileSync(new URL('../public/textures/terrain/creek_foam_painterly_flow.svg',import.meta.url),'utf8');
  assert.match(svg,/<svg[^>]+viewBox="0 0 240 320"/);
  assert.match(svg,/fill-opacity=".35"/);
  assert.match(svg,/fill-opacity=".70"/);
  assert.ok(svg.length>3000&&svg.length<15000,'mobile-friendly traced illustration');
  assert.equal((svg.match(/<path /g)||[]).length,2);
});

test('new foam flows downstream while retaining stable old-water fallback',()=>{
  const group=createHomeCreek();
  assert.equal(group.children.length,6,'river, shores and mossy wake structure preserved');
  const foam=group.getObjectByName('Illustrated river foam and flow trails');
  const water=group.getObjectByName('Shallow stream west of childhood home');
  assert.ok(foam instanceof THREE.Mesh);
  assert.ok(water instanceof THREE.Mesh);
  assert.ok(foam.material.map instanceof THREE.DataTexture,'before SVG load the old foam remains');
  assert.equal(foam.userData.foamAtlasReady.value,0);
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
  assert.match(shader.fragmentShader,/step\(\.52,seed\)/);
  assert.match(shader.fragmentShader,/#include <map_fragment>/,'retain original fallback map sample');
  updateHomeCreekWater(water,12.5);
  assert.equal(foam.userData.foamTimeUniform.value,12.5);
  assert.equal(water.userData.rippleUniform.value,12.5);
  assert.equal(group.getObjectByName('Painted foam breaking against mossy river boulders').count,7);
});