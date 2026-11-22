import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  RIVERBANK_PAINT,applyRiverbankPainterlyShader,setRiverbankMeadowTexture
} from '../src/world/riverbankMaterial.ts';
import {createHomeCreek,CREEK} from '../src/world/homeCreek.ts';
import {createSculptedCreekMeadow} from '../src/world/homeTerrain3D.ts';
import {createHomeStage} from '../src/world/homeStage.ts';

function compiled(mat) {
  const shader={
    vertexShader:'void main(){\n#include <begin_vertex>\n}',
    fragmentShader:'void main(){\n#include <map_fragment>\n}',
    uniforms:{}
  };
  mat.onBeforeCompile(shader,{});
  return shader;
}

test('both riverbanks use real two-scale UV samples and non-square macro tint',()=>{
  assert.ok(RIVERBANK_PAINT.macroMetres > RIVERBANK_PAINT.detailMetres*3.5);
  assert.equal(RIVERBANK_PAINT.imageSamples,2);
  const river=createHomeCreek();
  for(const name of ['Soft west creek bank','Soft east creek bank']){
    const mesh=river.getObjectByName(name);
    assert.ok(mesh instanceof THREE.Mesh);
    const mat=mesh.material;
    assert.equal(mat.userData.riverbankPainterlyStyle,'earth-bank');
    assert.equal(mat.userData.riverbankTwoScaleUV,true);
    assert.equal(mat.userData.macroVariationMetres,29.3);
    const shader=compiled(mat);
    assert.match(shader.vertexShader,/vRiverBankWorld/);
    assert.match(shader.vertexShader,/vRiverBankAcross=uv.x/);
    assert.match(shader.fragmentShader,/texture2D\(map,bankDetailUV\)/);
    assert.match(shader.fragmentShader,/texture2D\(map,bankMacroUV\)/);
    assert.match(shader.fragmentShader,/zBank\/7\.7/);
    assert.match(shader.fragmentShader,/zBank\/29\.3/);
    assert.match(shader.fragmentShader,/bankGrass/);
    assert.match(shader.fragmentShader,/bankDamp/);
    assert.equal((shader.fragmentShader.match(/texture2D\(/g)||[]).length,4);
    assert.match(shader.fragmentShader,/uRiverMeadowLoaded/);
    assert.match(shader.fragmentShader,/bankPigment=mix\(bankPigment,meadowPigment,lipMatch\)/);
    assert.match(mat.customProgramCacheKey(),/riverbank-painterly-meadow-weld-v3/);
    assert.equal(mat.map,null,'material has fallback before asynchronous painted texture load');
    assert.equal(mesh.geometry.getAttribute('uv').count,mesh.geometry.getAttribute('position').count);
  }
  const water=river.getObjectByName('Shallow stream west of childhood home');
  assert.equal(water.material.userData.riverbankPainterlyStyle,undefined,
    'water shader and foam must remain untouched');
  assert.equal(CREEK.bedY,-.65);
});

test('grassy river shoulders retain UV1, alpha fade and shared meadow albedo',()=>{
  const sculpt=createSculptedCreekMeadow();
  assert.equal(sculpt.children.length,2);
  for(const mesh of sculpt.children){
    const mat=mesh.material;
    assert.equal(mat.userData.riverbankPainterlyStyle,'grassy-shoulder');
    assert.equal(mat.userData.worldUV,true);
    assert.equal(mat.userData.riverbankTwoScaleUV,true);
    const shader=compiled(mat);
    assert.match(shader.fragmentShader,/vec2 uvFine=vMapUv\+waveMeadow/);
    assert.match(shader.fragmentShader,/grassFine/);
    assert.match(shader.fragmentShader,/grassBroad/);
    assert.match(shader.fragmentShader,/uvFine\.x\*\.52/);
    assert.match(shader.fragmentShader,/paintedGrass=mix\(grassFine,grassBroad,\.41\)/);
    assert.match(shader.fragmentShader,/vRiverGrassAcross/);
    assert.equal((shader.fragmentShader.match(/texture2D\(/g)||[]).length,2);
    const uv0=mesh.geometry.getAttribute('uv');
    const uv1=mesh.geometry.getAttribute('uv1');
    assert.ok(uv0&&uv1);
    assert.equal(mat.alphaMap.channel,0,'fade still uses local UV0, not macro UV1');
    assert.equal(mat.transparent,true);
    assert.equal(mat.depthWrite,false);
    assert.equal(mat.map,null);
    assert.ok(mesh.geometry.index.count/3>3000);
    assert.equal(mesh.userData.protectedPhysics,true);
  }
});

test('shaders are composable, idempotent and do not create dark decal geometry',()=>{
  const mat=new THREE.MeshBasicMaterial({color:'#ac936f'});
  const applied=applyRiverbankPainterlyShader(mat,'earth-bank');
  const key=mat.customProgramCacheKey();
  assert.equal(applyRiverbankPainterlyShader(mat,'earth-bank'),applied);
  assert.equal(key,mat.customProgramCacheKey());
  assert.throws(()=>applyRiverbankPainterlyShader(mat,'grassy-shoulder'));
  const shader=compiled(mat);
  assert.match(shader.fragmentShader,/bankPigment/);
  const stage=createHomeStage(false);
  assert.ok(stage.root.getObjectByName('Sculpted 3D banks blending into village terrain'));
  assert.equal(stage.root.getObjectByName('Feathered organic courtyard soil 0'),undefined);
  assert.ok(stage.root.getObjectByName('Bamboo UV PBR — North rear fence'));
  assert.ok(stage.root.getObjectByName('West wooden bridge walkway'));
  assert.ok(stage.root.getObjectByName('Painted foam breaking against mossy river boulders'));
  assert.ok(!stage.solids.some(s=>/riverbank|bank contour|water/i.test(s.label)));
});


test('soil-to-grass boundary changes organically without past dark moss stains',()=>{
  const river=createHomeCreek();
  for(const name of ['Soft west creek bank','Soft east creek bank']){
    const mesh=river.getObjectByName(name);
    const shader=compiled(mesh.material);
    assert.match(shader.fragmentShader,/mossWave/);
    assert.match(shader.fragmentShader,/greenLip=vec3\(\.46,\.52,\.31\)/);
    assert.match(shader.fragmentShader,/bankGrass\*\.58/);
    assert.match(shader.fragmentShader,/bankDamp\*\.28/);
    assert.doesNotMatch(shader.fragmentShader,/greenLip=vec3\(\.26,\.37,\.16\)/,
      'old nearly black moss lip must not return');
  }
});

test('bank lip shares world UV meadow albedo after load and keeps fallback beforehand',()=>{
  const bank=createHomeCreek().getObjectByName('Soft west creek bank').material;
  const shader=compiled(bank);
  assert.equal(shader.uniforms.uRiverMeadowLoaded.value,0);
  const meadow=new THREE.Texture();
  meadow.wrapS=meadow.wrapT=THREE.MirroredRepeatWrapping;
  assert.equal(setRiverbankMeadowTexture(bank,meadow),true);
  assert.equal(shader.uniforms.uRiverMeadow.value,meadow);
  assert.equal(shader.uniforms.uRiverMeadowLoaded.value,1);
  assert.match(shader.fragmentShader,/pMeadow\/3\.5\+waveMeadow/);
  assert.match(shader.fragmentShader,/lipMatch=1\.0-smoothstep\(\.035,\.34,crossBank\)/);
  assert.match(shader.fragmentShader,/uvFine\.x\*\.52-uvFine\.y\*\.27\+1\.23/);
  assert.match(shader.fragmentShader,/colorWash=sin\(pMeadow\.x\*\.044\+pMeadow\.y\*\.031\)/);
  assert.equal(setRiverbankMeadowTexture(new THREE.MeshBasicMaterial(),meadow),false);
});
