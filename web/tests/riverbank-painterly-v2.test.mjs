import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  RIVERBANK_PAINT,applyRiverbankPainterlyShader,setRiverbankMeadowTexture
} from '../src/world/riverbankMaterial.ts';
import {createHomeCreek,CREEK} from '../src/world/homeCreek.ts';
import {createSculptedCreekMeadow} from '../src/world/homeTerrain3D.ts';
import {createHomeStage} from '../src/world/homeStage.ts';
import {applyCreekCourtyardAlbedo} from '../src/world/shoreCourtyard.ts';

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
    assert.match(shader.fragmentShader,/bankPigment=mix\(bankPigment,meadowPigment,meadowCover\)/);
    assert.match(mat.customProgramCacheKey(),/riverbank-visible-ecotone-v4/);
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
  assert.match(shader.fragmentShader,/meadowCover=1\.0-smoothstep\(\.42,\.84,crossBank\+edgeFlow\)/);
  assert.match(shader.fragmentShader,/uvFine\.x\*\.52-uvFine\.y\*\.27\+1\.23/);
  assert.match(shader.fragmentShader,/colorWash=sin\(pMeadow\.x\*\.044\+pMeadow\.y\*\.031\)/);
  assert.equal(setRiverbankMeadowTexture(new THREE.MeshBasicMaterial(),meadow),false);
});

test('most of the visible above-water riverbank uses meadow rather than a brown stripe',()=>{
  const banks=createHomeCreek();
  const sampleCover=(cross,z,x=0)=>{
    const wave=.085*Math.sin(z*.43+.5*Math.sin(z*.14))
      +.047*Math.sin(z*1.34-x*.21);
    const v=Math.max(0,Math.min(1,(cross+wave-.42)/(.84-.42)));
    return 1-v*v*(3-2*v);
  };
  // Existing river geometry has its waterline around the third/fourth
  // cross-section ring (UV 0.5). Previously the seam blend ended at 0.34.
  for(const name of ['Soft west creek bank','Soft east creek bank']){
    const mesh=banks.getObjectByName(name);
    const uv=mesh.geometry.getAttribute('uv');
    const pos=mesh.geometry.getAttribute('position');
    let visible=0,mostlyMeadow=0;
    for(let i=0;i<pos.count;i++){
      const y=pos.getY(i),cross=uv.getX(i);
      if(y>-.18){
        visible++;
        if(sampleCover(cross,pos.getZ(i),pos.getX(i))>.67)mostlyMeadow++;
      }
    }
    assert.ok(visible>500);
    assert.ok(mostlyMeadow/visible>.75,
      'above-water bank should mostly look like adjoining meadow, not a repeated brown ribbon');
    const shader=compiled(mesh.material);
    assert.match(shader.fragmentShader,/edgeFlow=/);
    assert.match(shader.fragmentShader,/meadowCover/);
  }
});

test('house clearing paint and its alpha feather are shared by shore materials at real UV0',()=>{
  const stage=createHomeStage(false), paint=new THREE.Texture(), alpha=new THREE.Texture();
  const source=new THREE.Mesh(
    new THREE.PlaneGeometry(32,29),
    new THREE.MeshBasicMaterial({map:paint,alphaMap:alpha,transparent:true})
  );
  source.position.set(-29,.028,.4);
  assert.equal(applyCreekCourtyardAlbedo(stage.root,source),4);
  assert.equal(applyCreekCourtyardAlbedo(stage.root,source),0,'same material cannot be rebound twice');
  for(const name of [
    'West bank sculpted meadow terrain','East bank sculpted meadow terrain',
    'Soft west creek bank','Soft east creek bank'
  ]){
    const mesh=stage.root.getObjectByName(name);
    const shader=compiled(mesh.material);
    assert.equal(shader.uniforms.uCreekHomePaint.value,paint);
    assert.equal(shader.uniforms.uCreekHomeMask.value,alpha);
    assert.deepEqual(shader.uniforms.uCreekHomeRect.value.toArray(),[-29,.4,32,29]);
    assert.match(shader.fragmentShader,/texture2D\(uCreekHomeMask,homeUv\)\.g/);
    assert.match(shader.fragmentShader,/texture2D\(uCreekHomePaint,homeUv\)\.rgb/);
    assert.match(shader.fragmentShader,/uCreekHomeRect/);
    assert.match(mesh.material.customProgramCacheKey(),/shore-shared-courtyard-v5/);
  }
  assert.ok(Math.abs(((-43.4+29)/32+.5)-.05)<1e-8,'the near river shoulder overlaps the home clearing');
  assert.ok((-49+29)/32+.5<0,'far bank does not receive the home painting');
});

test('PR92-inspired riverbank gets broken warm stone near water, not a flat oval wall',()=>{
  const restored=createHomeCreek();
  for(const side of ['Soft west creek bank','Soft east creek bank']){
    const bank=restored.getObjectByName(side);
    assert.equal(bank.material.userData.bankStoneRestore,
      'pr92-inspired-broken-stone-foot-v1');
    const shader={
      vertexShader:'void main(){\n#include <begin_vertex>\n}',
      fragmentShader:'void main(){\n#include <map_fragment>\n#include <color_fragment>\n}',
      uniforms:{}
    };
    bank.material.onBeforeCompile(shader,{});
    assert.match(shader.fragmentShader,/float wetFoot=1.0-smoothstep\(-.20,.09,vRiversidePosition.y\)/);
    assert.match(shader.fragmentShader,/float stoneClusters=smoothstep\(\.20,\.79,stoneScatter\)/);
    assert.match(shader.fragmentShader,/float stoneCover=\.08\+\.70\*wetFoot\*stoneClusters/);
    assert.match(shader.fragmentShader,/texture2D\(uBankCobbles,uvB\)/);
    assert.match(shader.fragmentShader,/grassCover/);
    assert.match(shader.fragmentShader,/bankPigment/);
    assert.doesNotMatch(shader.fragmentShader,/float stoneCover=\.91/);
    assert.match(bank.material.customProgramCacheKey(),/pr92-broken-stone-foot-v1/);
  }
  const bed=restored.getObjectByName('Visible gravel bed below clear creek water');
  assert.equal(bed.material.userData.bankStoneRestore,undefined);
  const bedShader={
    vertexShader:'void main(){\n#include <begin_vertex>\n}',
    fragmentShader:'void main(){\n#include <map_fragment>\n#include <color_fragment>\n}',
    uniforms:{}
  };
  bed.material.onBeforeCompile(bedShader,{});
  assert.match(bedShader.fragmentShader,/float stoneCover=1.0;/);
  const water=restored.getObjectByName('Shallow stream west of childhood home');
  const foam=restored.getObjectByName('Illustrated river foam and flow trails');
  assert.equal(water.material.userData.bankStoneRestore,undefined);
  assert.equal(foam.material.userData.bankStoneRestore,undefined);
  assert.ok(restored.children.length>=5);
});

test('rock cover fades continuously across foot and keeps a mostly grassy upper bank',()=>{
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const cover=(height,pigment)=> .08+.70*(1-smooth(-.20,.09,height))*smooth(.20,.79,pigment);
  for(const pigment of [.24,.48,.72,.93]){
    const foot=cover(-.25,pigment),mid=cover(-.08,pigment),lip=cover(.14,pigment);
    assert.ok(foot>=mid && mid>=lip,'stones should be densest by wet foot');
    assert.ok(foot<=.781 && lip<=.081,'never turn the whole bank into a cobble wall');
  }
});
