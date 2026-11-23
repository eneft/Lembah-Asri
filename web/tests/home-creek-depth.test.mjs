import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  CREEK, CREEK_WATER_UV, creekCenterX, creekOuterMeander, creekWidth, createHomeCreek, createHomeCreekVegetation,
  carveVisualCreek, updateHomeCreekWater, makeCreekAlbedo, makeCreekBedAlbedo,
  makeCreekFoamAlbedo
} from '../src/world/homeCreek.ts';
import { createHomeStage } from '../src/world/homeStage.ts';

function heights(mesh) {
  const values=mesh.geometry.getAttribute('position');
  return Array.from({length:values.count},(_,i)=>values.getY(i));
}

test('water is really recessed below Y=0 with bank walls and gravel floor',()=>{
  const creek=createHomeCreek();
  assert.equal(creek.children.length,6);
  const surface=creek.getObjectByName('Shallow stream west of childhood home');
  const bed=creek.getObjectByName('Visible gravel bed below clear creek water');
  const west=creek.getObjectByName('Soft west creek bank');
  const east=creek.getObjectByName('Soft east creek bank');
  assert.ok(surface instanceof THREE.Mesh);
  assert.ok(bed instanceof THREE.Mesh);
  assert.ok(west instanceof THREE.Mesh);
  assert.ok(east instanceof THREE.Mesh);
  const yWater=heights(surface);
  const yBed=heights(bed);
  const yBank=heights(west);
  assert.ok(yWater.every(y=>Math.abs(y-CREEK.waterY)<.001));
  assert.ok(yBed.every(y=>y<CREEK.waterY-.32));
  assert.ok(Math.min(...yBank)<-.60,'bank slope falls below 60 cm');
  assert.ok(Math.max(...yBank)>0,'dry bank lip is raised above terrain');
  assert.equal(CREEK.bedY,-.65);
  assert.equal(CREEK.waterY,-.20);
  assert.ok(creekCenterX(1)!==creekCenterX(9));
  assert.ok(creekWidth(1)>2.5);
  assert.ok(surface.geometry.getAttribute('uv').count>500);
  assert.ok(bed.geometry.getAttribute('uv').count>350);
});

test('clear water shows painted silt and local illustrated foam without alphaHash',()=>{
  const creek=createHomeCreek();
  const surface=creek.getObjectByName('Shallow stream west of childhood home');
  const bed=creek.getObjectByName('Visible gravel bed below clear creek water');
  assert.equal(surface.material.transparent,true);
  assert.ok(surface.material.opacity>.87&&surface.material.opacity<.92);
  assert.equal(surface.material.depthWrite,false);
  assert.notEqual(surface.material.alphaHash,true);
  assert.equal(surface.material.map,makeCreekAlbedo());
  assert.equal(bed.material.map,makeCreekBedAlbedo());
  assert.notEqual(bed.material.map,surface.material.map);
  assert.equal(bed.material.depthWrite,true);
  assert.equal(surface.userData.rippleType,'mobile-two-frequency');
  const map=bed.material.map.image.data;
  assert.ok(map.some((v,i)=>i%4!==3&&v>135),'painted sand wash remains visible');
  assert.equal(CREEK.flowSign,1);
  assert.equal(CREEK.sourceZ,CREEK.start);
  assert.equal(CREEK.mouthZ,CREEK.end);
  assert.ok(CREEK.start<=-79&&CREEK.end>=79,
    'upstream enters map from north, downstream exits at world edge');
  assert.ok(creekWidth(CREEK.start+1)<creekWidth(CREEK.end-1),
    'narrow upstream and wider downstream make the flow direction readable');
  const foam=creek.getObjectByName('Illustrated river foam and flow trails');
  assert.ok(foam instanceof THREE.Mesh);
  assert.equal(foam.material.map,makeCreekFoamAlbedo());
  assert.equal(foam.material.transparent,true);
  assert.equal(foam.material.depthWrite,false);
  assert.ok(foam.position.y>=0);
  const foamPixels=foam.material.map.image.data;
  let visible=0,transparent=0;
  for(let i=3;i<foamPixels.length;i+=4) {
    if(foamPixels[i]>=75)visible++;
    if(foamPixels[i]===0)transparent++;
  }
  assert.ok(visible>100,'foam illustration has actual textured white strokes');
  assert.ok(transparent>foamPixels.length/4*.8,
    'localized foam, not white water all over');
  const ripple=surface.userData.rippleUniform;
  assert.equal(ripple.value,0);
  updateHomeCreekWater(surface,7.3);
  assert.equal(ripple.value,7.3);
  const shader={
    vertexShader:'#include <begin_vertex>',
    fragmentShader:'#include <map_fragment>',
    uniforms:{}
  };
  surface.material.onBeforeCompile(shader,{});
  assert.equal(shader.uniforms.uCreekTime,ripple);
  assert.match(shader.fragmentShader,/sin\(vCreekFlowXZ.y\*10.8/);
  assert.match(shader.fragmentShader,/highlight/);
  assert.match(shader.vertexShader,/vCreekFlowXZ/);
});

test('painted ground and shadow receiver both discard matching creek footprint',()=>{
  for(const material of [
    new THREE.MeshBasicMaterial({color:'#88bb77'}),
    new THREE.ShadowMaterial({opacity:.4,transparent:true})
  ]){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(10,10),material);
    const out=carveVisualCreek(mesh);
    assert.equal(out,mesh);
    assert.equal(mesh.userData.creekVisualCutout,true);
    assert.equal(material.userData.creekVisualCutout,true);
    assert.equal(carveVisualCreek(mesh),mesh,'idempotent mask');
    const shader={
      vertexShader:'#include <begin_vertex>',
      fragmentShader:'#include <clipping_planes_fragment>',
      uniforms:{}
    };
    material.onBeforeCompile(shader,{});
    assert.match(shader.vertexShader,/modelMatrix/);
    assert.match(shader.fragmentShader,/discard/);
    assert.match(shader.fragmentShader,/creekHalf|halfC/);
    assert.match(material.customProgramCacheKey(),/creek/);
  }
});

test('game home keeps walkable bridge while displaying a deep cut into courtyard',()=>{
  const home=createHomeStage(false);
  const creek=home.root.getObjectByName('Meandering shallow creek and earthen banks');
  const bed=home.root.getObjectByName('Visible gravel bed below clear creek water');
  const painted=home.root.getObjectByName('Childhood courtyard - earth clearing');
  assert.ok(creek);
  assert.ok(bed);
  assert.equal(painted.userData.creekVisualCutout,true);
  assert.ok(home.root.getObjectByName('West wooden bridge walkway'));
  assert.ok(home.root.getObjectByName('Old village well stone rim'));
  assert.ok(!home.solids.some(c=>/creek|bank|water/i.test(c.label)),
    'visual upgrade preserves physics and movement rules');
});


test('foam follows downstream direction without modifying character movement',()=>{
  const creek=createHomeCreek();
  assert.match(creek.userData.flowDirection,/negative-Z-to-downstream-positive-Z/);
  const river=creek.getObjectByName('Shallow stream west of childhood home');
  const floor=creek.getObjectByName('Visible gravel bed below clear creek water');
  const foam=creek.getObjectByName('Illustrated river foam and flow trails');
  assert.ok(river.geometry.getAttribute('uv').count>1000);
  assert.ok(foam.geometry.getAttribute('uv').count>1000);
  assert.equal(foam.renderOrder>river.renderOrder,true,'foam renders above flowing surface');
  assert.ok(Math.max(...[creekWidth(-50),creekWidth(0),creekWidth(50)])>3);
  assert.equal(floor.userData.depthProfile,'3D-bank-to-bed-0.65m');
  assert.ok(!creek.children.some(child=>child.name.includes('kerikil')));
});


test('countryside river meanders while the house fence, bridge and creek hole remain aligned',()=>{
  // Both survey points at the bridge and the fenced east bank are fixed.
  for(const z of [-12,-4,0,8.6,14,23,27]){
    assert.ok(Math.abs(creekOuterMeander(z))<1e-10,
      'garden creek must not move the approved bridge/fence');
    const oldCenter=-45.5+.12*Math.sin(z*.37+.2)+.09*Math.sin(z*.82-.7);
    const oldHalf=.5*(2.64+.010*(z+4.5)+.13*Math.sin(z*.29+.8)+.07*Math.cos(z*.69-.3));
    assert.ok(Math.abs(creekCenterX(z)+creekWidth(z)*.5-oldCenter-oldHalf)<1e-9);
    if(Math.abs(z-8.6)<2) assert.ok(Math.abs(creekCenterX(z)-oldCenter)<1e-9);
  }
  assert.ok(creekWidth(-5.5)>4.2);
  assert.ok(creekWidth(18)>4.2);
  assert.ok(Math.abs(creekOuterMeander(-35))>.25,
    'river must actually bend in its scenic background');
  assert.ok(Math.abs(creekOuterMeander(54))>.25,
    'downstream river is not a 160m ruler-straight canal');
  // Outer meander added to BOTH the geometry and the ground cutout shader.
  const grass=new THREE.Mesh(new THREE.PlaneGeometry(10,10),
    new THREE.MeshBasicMaterial());
  carveVisualCreek(grass);
  const shader={vertexShader:'#include <begin_vertex>',
    fragmentShader:'#include <clipping_planes_fragment>',uniforms:{}};
  grass.material.onBeforeCompile(shader,{});
  assert.match(shader.fragmentShader,/farBend=envelope\*/);
  assert.match(shader.fragmentShader,/smoothstep\(-28\.0,-12\.0,zC\)/);
  assert.match(shader.fragmentShader,/smoothstep\(27\.0,43\.0,zC\)/);
  assert.match(shader.fragmentShader,/xC=-45\.5.*\+farBend/);
});

test('planted river edges reach into the distant countryside without blocking the bridge',()=>{
  const greenery=createHomeCreekVegetation();
  assert.equal(greenery.name,'Curated creek bank reeds and leafy clumps');
  assert.ok(greenery.userData.clusters>=16);
  const grass=greenery.getObjectByName('Stream clustered bank grasses');
  const leaves=greenery.getObjectByName('Stream broadleaf foliage clusters');
  assert.ok(grass instanceof THREE.InstancedMesh);
  assert.ok(leaves instanceof THREE.InstancedMesh);
  assert.ok(grass.count>70);
  assert.ok(leaves.count>20);
  const world=new THREE.Matrix4(),pos=new THREE.Vector3();
  let farPlants=0,giantLeaves=0;
  for(let i=0;i<leaves.count;i++){
    leaves.getMatrixAt(i,world);
    pos.setFromMatrixPosition(world);
    if(pos.z<-25)farPlants++;
    const sc=new THREE.Vector3().setFromMatrixScale(world);
    if(sc.x>.90)giantLeaves++;
  }
  assert.ok(farPlants>=3,'new vegetation follows the upstream channel');
  assert.equal(giantLeaves,0,'no giant spiky leaf umbrellas on riverbank');
});


test('authored turquoise handpainted water scrolls downstream without changing collisions',()=>{
  const creek=createHomeCreek();
  const surface=creek.getObjectByName('Shallow stream west of childhood home');
  assert.equal(CREEK_WATER_UV.longitudinalTileMetres,14.5);
  assert.equal(CREEK_WATER_UV.flowUvUnitsPerSecond,.018);
  assert.equal(surface.userData.waterAlbedo,CREEK_WATER_UV.albedoSource);
  const texture=new THREE.Texture();
  texture.wrapT=THREE.RepeatWrapping;
  texture.wrapS=THREE.ClampToEdgeWrapping;
  surface.material.map=texture;
  updateHomeCreekWater(surface,10);
  assert.ok(Math.abs(texture.offset.y+.18)<.00001,'paint strokes move with downstream current');
  updateHomeCreekWater(surface,20);
  assert.ok(Math.abs(texture.offset.y+.36)<.00001);
  const foam=creek.getObjectByName('Illustrated river foam and flow trails');
  assert.ok(foam.material.opacity>=.69&&foam.material.opacity<=.72,
    'small masked raster foam retains white painted cores without filling whole river');
  assert.equal(surface.material.depthWrite,false);
  assert.equal(surface.material.transparent,true);
});
