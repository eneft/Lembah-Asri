import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  TERRAIN_CONTOUR, createSculptedCreekMeadow,
  creekMeadowHeight, makeRiverMeadowFade, createFineCreekBankGrass
} from '../src/world/homeTerrain3D.ts';
import {
  CREEK, createHomeCreek, creekWidth, creekCenterX, creekBankLipHeight
} from '../src/world/homeCreek.ts';
import { createHomeStage, HOME } from '../src/world/homeStage.ts';

test('actual 3D sculpted creek shoulders are meshes, not dark ground decals or flat planes',()=>{
  const group=createSculptedCreekMeadow();
  assert.equal(group.name,'Sculpted 3D banks blending into village terrain');
  assert.equal(group.children.length,2,'one terrain ribbon per bank');
  let triangleCount=0;
  for(const mesh of group.children){
    assert.ok(mesh instanceof THREE.Mesh);
    assert.ok(mesh.geometry instanceof THREE.BufferGeometry);
    assert.notEqual(mesh.geometry.type,'PlaneGeometry','not a flat unmodified quad');
    const position=mesh.geometry.getAttribute('position');
    const uv0=mesh.geometry.getAttribute('uv');
    const uv1=mesh.geometry.getAttribute('uv1');
    assert.ok(position.count>2000);
    assert.equal(uv0.count,position.count);
    assert.equal(uv1.count,position.count);
    const y=[];
    for(let i=0;i<position.count;i++) y.push(position.getY(i));
    assert.ok(Math.max(...y)>.07,'shoulders have true relief');
    assert.ok(Math.max(...y)<.20,'low relief preserves approximate gameplay floor');
    assert.ok(Math.min(...y)>=0,'green shoulder is a real surface above flat world ground');
    assert.equal(mesh.material.type,'MeshBasicMaterial');
    assert.equal(mesh.material.userData.terrainSurface,'grass');
    assert.equal(mesh.material.userData.worldUV,true);
    assert.equal(mesh.material.alphaMap,makeRiverMeadowFade());
    assert.equal(mesh.material.transparent,true);
    assert.equal(mesh.material.depthWrite,false);
    assert.equal(mesh.material.toneMapped,false,'preserve handpainted albedo');
    assert.equal(mesh.userData.visualOnly,true);
    assert.equal(mesh.userData.protectedPhysics,true);
    triangleCount+=mesh.geometry.index.count/3;
  }
  assert.ok(triangleCount>=7000&&triangleCount<=8500,'mobile-friendly sculpted grid');
  assert.equal(group.userData.villageTerrainUnchanged,true);
});

test('inner green terrain edge is mathematically welded to the cut riverbank lip',()=>{
  const shoulders=createSculptedCreekMeadow();
  const creek=createHomeCreek();
  const bankNames=['Soft west creek bank','Soft east creek bank'];
  for(let side=0;side<2;side++){
    const shoulder=shoulders.children[side];
    const bank=creek.getObjectByName(bankNames[side]);
    assert.ok(bank instanceof THREE.Mesh);
    const shoulderPos=shoulder.geometry.getAttribute('position');
    const bankPos=bank.geometry.getAttribute('position');
    const shoulderCols=8,bankCols=7;
    for(const ringIndex of [0,1,7,19,50,90,125,180,235,TERRAIN_CONTOUR.longitudinalSegments]){
      const a=ringIndex*shoulderCols,b=ringIndex*bankCols;
      for(const getter of ['getX','getY','getZ']){
        assert.ok(Math.abs(shoulderPos[getter](a)-bankPos[getter](b))<1e-5,
          'mesh bank seam mismatch: '+bankNames[side]+' '+getter+' @'+ringIndex);
      }
    }
    const startZ=shoulderPos.getZ(0);
    const endZ=shoulderPos.getZ(shoulderPos.count-1);
    assert.ok(Math.abs(startZ-CREEK.start)<.0001);
    assert.ok(Math.abs(endZ-CREEK.end)<.0001);
  }
});

test('world-UV1 grass matches 3.5m meadow tiling while alpha mask blends outer edge only',()=>{
  const mesh=createSculptedCreekMeadow().children[1];
  const pos=mesh.geometry.getAttribute('position');
  const uv1=mesh.geometry.getAttribute('uv1');
  const uv0=mesh.geometry.getAttribute('uv');
  for(const i of [0,1,12,56,111,1120,pos.count-1]){
    assert.ok(Math.abs(uv1.getX(i)-pos.getX(i)/3.5)<.00001);
    assert.ok(Math.abs(uv1.getY(i)-pos.getZ(i)/3.5)<.00001);
  }
  assert.equal(uv0.getX(0),0);
  assert.equal(uv0.getX(7),1);
  const img=makeRiverMeadowFade().image;
  const green=x=>img.data[(1*img.width+x)*4+1];
  assert.equal(img.width,64);
  assert.equal(img.height,4);
  assert.equal(green(0),255,'opaque at the exact riverbank seam');
  assert.ok(green(45)<green(20),'fades naturally into existing grass');
  assert.ok(green(63)<15,'fully disappears at outer meadow edge');
  assert.equal(mesh.material.alphaMap.channel,0);
  assert.equal(mesh.material.map,null,'loadPaintedTerrainTextures supplies the same world meadow albedo');
});

test('bank contour goes flat by outer world grass edge and stays low at the bridge',()=>{
  assert.equal(TERRAIN_CONTOUR.longitudinalSegments,284);
  assert.equal(TERRAIN_CONTOUR.innerDistance,.79);
  for(const z of [-50,-20,0,6,8.6,11,18,48,70]){
    const rim=creekMeadowHeight(z,.79);
    assert.ok(Math.abs(rim-creekBankLipHeight(z))<1e-9);
    assert.ok(rim>=.026&&rim<=.119);
    assert.ok(creekMeadowHeight(z,1.17)>=rim);
    assert.ok(creekMeadowHeight(z,1.17)<=.16);
    assert.ok(creekMeadowHeight(z,2.4)>=0);
    assert.ok(creekMeadowHeight(z,2.4)<.14);
    assert.ok(creekMeadowHeight(z,3.85)<.00001,'no outer hard cliff or floating island');
    assert.ok(creekWidth(z)>1.85,'the upstream narrows naturally before widening downstream');
    assert.ok(creekCenterX(z)<-44);
  }
  assert.ok(creekBankLipHeight(8.6)<creekBankLipHeight(4)+.03);
  assert.ok(creekBankLipHeight(8.6)<.055,'near bridge ramp remains gentle');
});

test('actual home stage integrates sculpted banks with no extra collision or change to bridge/gate',async()=>{
  const stage=createHomeStage(false);
  await stage.ready;
  const sculpt=stage.root.getObjectByName('Sculpted 3D banks blending into village terrain');
  assert.ok(sculpt);
  assert.equal(sculpt.children.length,2);
  const bridge=stage.root.getObjectByName('West wooden bridge walkway');
  assert.ok(bridge);
  assert.equal(bridge.userData.bridgeUV,'painterly-individual-planks');
  assert.ok(stage.root.getObjectByName('Bamboo UV PBR — North rear fence'));
  assert.ok(stage.root.getObjectByName('Bamboo UV PBR — South front fence'));
  assert.ok(stage.root.getObjectByName('Old village well stone rim'));
  assert.equal(stage.solids.filter(s=>/sculpt|meadow|river bank|creek/i.test(s.label)).length,0);
  assert.equal(stage.solids.filter(s=>/fence/i.test(s.label)).length,6);
  assert.ok(stage.solids.some(s=>s.label==='Childhood home walls'));
  assert.equal(HOME.spawn.x,-29.5);
  assert.equal(HOME.gate.z,9);
  assert.equal(stage.root.getObjectByName('Feathered organic courtyard soil 0'),undefined,
    'do not bring back previously rejected dark ground overlays');
});

test('fine creek grass is short, on raised terrain, away from bridge approaches',()=>{
  const grass=createFineCreekBankGrass();
  assert.ok(grass instanceof THREE.InstancedMesh);
  assert.equal(grass.name,'Fine soft creek bank grass');
  assert.ok(grass.count>260&&grass.count<600,'mobile-friendly 3D fine tufts');
  assert.equal(grass.geometry.getAttribute('position').count,36);
  assert.equal(grass.userData.visualOnly,true);
  const m=new THREE.Matrix4(),point=new THREE.Vector3(),scale=new THREE.Vector3();
  for(let i=0;i<grass.count;i++){
    grass.getMatrixAt(i,m);
    point.setFromMatrixPosition(m);
    scale.setFromMatrixScale(m);
    assert.ok(point.z<6.2 || point.z>11.2,'bridge deck and approaches not obstructed');
    assert.ok(point.y>=0&&point.y<.20,'small blades sit at sculpted surface');
    assert.ok(scale.x>=.42 && scale.x<=.78,'fine blades do not become oversized');
    const dist=Math.abs(point.x-creekCenterX(point.z))-creekWidth(point.z)*.5;
    assert.ok(dist>.76&&dist<2.2,'bank grass follows the real creek geometry');
  }
  const home=createHomeStage(false);
  assert.ok(home.root.getObjectByName('Fine soft creek bank grass'));
  assert.ok(!home.solids.some(s=>s.label.includes('grass')));
});
