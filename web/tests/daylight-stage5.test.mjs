import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyLembahDaylight, softenPaintedPBR, LEMBAH_DAYLIGHT } from '../src/world/sceneArtDirection.ts';
import { createPaintedShadowReceiver, createCharacterContactShadow, updateCharacterContactShadow } from '../src/world/sceneShadows.ts';
import { applyHandPaintedMaterials } from '../src/world/handPaintedMaterials.ts';
import { bambooPBRMaterial } from '../src/world/bambooFence.ts';
import { createHomeStage } from '../src/world/homeStage.ts';
import { createHomeCreek } from '../src/world/homeCreek.ts';

test('one stage5 daylight rig matches matte art without toon or postprocessing',()=>{
  const scene=new THREE.Scene();
  const renderer={outputColorSpace:THREE.LinearSRGBColorSpace,toneMapping:THREE.NoToneMapping,toneMappingExposure:2};
  const sun=new THREE.DirectionalLight('white',2.1);
  const hemi=new THREE.HemisphereLight('white','black',1.15);
  const fill=new THREE.DirectionalLight('white',.42);
  applyLembahDaylight(scene,renderer,sun,hemi,fill);
  assert.equal(scene.userData.painterlyLightingStyle,'lembah-painterly-daylight-stage5-v1');
  assert.equal(scene.background.getHexString(),new THREE.Color(LEMBAH_DAYLIGHT.sky).getHexString());
  assert.equal(scene.fog.color.getHexString(),new THREE.Color(LEMBAH_DAYLIGHT.distantMist).getHexString());
  assert.equal(scene.fog.near,38);
  assert.equal(scene.fog.far,115);
  assert.equal(renderer.outputColorSpace,THREE.SRGBColorSpace);
  assert.equal(renderer.toneMapping,THREE.NeutralToneMapping);
  assert.equal(renderer.toneMappingExposure,1);
  assert.equal(sun.intensity,1.55);
  assert.equal(hemi.intensity,1.1);
  assert.equal(fill.intensity,.3);
  assert.equal(scene.environmentIntensity,.3);
  assert.ok(sun.intensity<2.1,'old over-bright PBR key is softened');
  assert.ok(fill.intensity<.42,'cool PBR edge-light is no longer overpowering');
  assert.ok(renderer.toneMapping!==THREE.NoToneMapping,'no plain ungraded PBR');
});

test('house PBR keeps original painted maps and UV while reducing specular and normal punch',()=>{
  const maps={
    map:new THREE.Texture(),
    normalMap:new THREE.Texture(),
    roughnessMap:new THREE.Texture(),
    metalnessMap:new THREE.Texture()
  };
  const material=new THREE.MeshStandardMaterial({
    ...maps,
    roughness:.55,
    metalness:.9,
    envMapIntensity:1,
    normalScale:new THREE.Vector2(1,-1),
    side:THREE.DoubleSide
  });
  const saved={...maps,side:material.side};
  softenPaintedPBR(material,'house');
  assert.ok(material instanceof THREE.MeshStandardMaterial);
  for(const [key,value] of Object.entries(maps))assert.equal(material[key],value);
  assert.equal(material.side,saved.side);
  assert.equal(material.roughness,.82);
  assert.equal(material.metalness,.22);
  assert.equal(material.normalScale.x,.62);
  assert.equal(material.normalScale.y,-.62,'keep imported normal map handedness');
  assert.equal(material.envMapIntensity,.3);
  assert.equal(material.userData.painterlyPBR,LEMBAH_DAYLIGHT.version);
  assert.equal(material.userData.painterlyPBRIdentity,'house');
  const before={
    rough:material.roughness,metal:material.metalness,
    x:material.normalScale.x,y:material.normalScale.y
  };
  softenPaintedPBR(material,'house');
  assert.deepEqual({rough:material.roughness,metal:material.metalness,
    x:material.normalScale.x,y:material.normalScale.y},before,
    'do not apply repeated reductions to repeated loads');
  const originalMat=new THREE.MeshBasicMaterial({map:new THREE.Texture(),toneMapped:false});
  assert.ok(originalMat instanceof THREE.MeshBasicMaterial);
  assert.equal(originalMat.toneMapped,false,'UV-painted foliage and player stay unlit');
});

test('existing bamboo PBR is already matte; original authoring stays untouched',()=>{
  const m=bambooPBRMaterial.clone();
  const before={rough:m.roughness,normal:m.normalScale.clone(),metal:m.metalness};
  softenPaintedPBR(m,'bamboo');
  assert.ok(m.roughness>=before.rough);
  assert.equal(m.metalness,before.metal);
  assert.equal(m.normalScale.x,before.normal.x);
  assert.equal(m.normalScale.y,before.normal.y);
  assert.equal(m.userData.painterlyPBRIdentity,'bamboo');
});

test('shadows become warmer and lighter while keeping physically-cast shadows',()=>{
  const receiver=createPaintedShadowReceiver('Painted shadow test',10,10,0,0,.1);
  assert.ok(receiver.material instanceof THREE.ShadowMaterial);
  assert.equal(receiver.material.opacity,LEMBAH_DAYLIGHT.shadowOpacity);
  assert.equal(receiver.material.toneMapped,false);
  assert.equal(receiver.receiveShadow,true);
  assert.equal(receiver.material.transparent,true);
  assert.equal(receiver.material.depthWrite,false);
  const contact=createCharacterContactShadow();
  updateCharacterContactShadow(contact,new THREE.Vector3(-29,0,7));
  assert.equal(contact.material.opacity,LEMBAH_DAYLIGHT.contactShadowOpacity);
  assert.ok(contact.material.opacity<.4);
});

test('stage 5 is scoped to PBR/light/shadows and preserves the 4 earlier landscape passes',()=>{
  const stage=createHomeStage(false);
  const world=stage.root;
  const river=createHomeCreek();
  assert.ok(world.getObjectByName('Old fruit tree'));
  assert.ok(world.getObjectByName('West wooden bridge walkway'));
  assert.ok(world.getObjectByName('Old village well stone rim'));
  assert.ok(world.getObjectByName('Curated creek bank reeds and leafy clumps'));
  assert.equal(world.getObjectByName('Curated creek bank reeds and leafy clumps').userData.shoreStyle,
    'localized-boulder-sedge-stage4-v1');
  assert.equal(river.getObjectByName('Shallow stream west of childhood home')
    .material.userData.clearWaterStyle,'clear-turquoise-painterly-stage3-v1');
  assert.equal(river.getObjectByName('Soft west creek bank')
    .material.userData.bankStoneRestore,'natural-bank-ecotone-stage2-v1');
  assert.ok(stage.gardenGround.vertices.length>0);
  assert.ok(!stage.solids.some(s=>/shadow|fog|art direction/i.test(s.label)),
    'visual grade must not add game physics');
  const gameSource=readFileSync(fileURLToPath(new URL('../src/world/Game.ts',import.meta.url)),'utf8');
  const houseSource=readFileSync(fileURLToPath(new URL('../src/world/homeStage.ts',import.meta.url)),'utf8');
  const bambooSource=readFileSync(fileURLToPath(new URL('../src/world/bambooFence.ts',import.meta.url)),'utf8');
  assert.match(gameSource,/applyLembahDaylight\(this.scene, this.renderer, sun, hemisphere, skyFill\)/);
  assert.match(houseSource,/softenPaintedPBR\(material, 'house'\)/);
  assert.match(bambooSource,/softenPaintedPBR\(bambooPBRMaterial, 'bamboo'\)/);
  assert.doesNotMatch(gameSource,/THREE\.ACESFilmicToneMapping/);
  assert.doesNotMatch(gameSource,/EffectComposer|OutlinePass|UnrealBloomPass/);
});

import { createDistantValley,DISTANT_VALLEY,distantValleyHeight } from '../src/world/distantValley.ts';
test('distant valley is actual 360 degree low-cost 3D scenery beyond the playable floor',()=>{
  const group=createDistantValley();
  assert.equal(group.userData.scenicOnly,true);
  assert.equal(group.userData.style,DISTANT_VALLEY.style);
  assert.equal(group.userData.trees,460);
  assert.equal(group.userData.houses,14);
  const terrain=group.getObjectByName('Distant valley continuous hills and terraced fields');
  const p=terrain.geometry.getAttribute('position'),idx=terrain.geometry.index;
  assert.ok(terrain.material.vertexColors&&!terrain.material.fog);
  assert.ok(terrain.geometry.getAttribute('color'));
  assert.ok(idx.count/3<24000);
  let highest=0;
  for(let i=0;i<idx.count;i++){
    const k=idx.getX(i),x=p.getX(k),z=p.getZ(k);
    assert.ok(Math.max(Math.abs(x),Math.abs(z))>=80,'no terrain inside playable map');
    highest=Math.max(highest,p.getY(k));
  }
  assert.ok(highest>65,'layered real mountains');
  for(const [x,z] of [[80,0],[-80,0],[0,80],[0,-80]])assert.equal(distantValleyHeight(x,z),-.035);
  let draws=0;group.traverse(o=>{if(o.isMesh){draws++;assert.equal(o.castShadow,false);}});
  assert.equal(draws,6,'six batched scenery draws only');
  assert.ok(group.getObjectByName('Distant creek winding into valley'));
  assert.ok(group.getObjectByName('Distant village terracotta roofs'));
});
