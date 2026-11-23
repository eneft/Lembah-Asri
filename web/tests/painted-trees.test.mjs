import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createPaintedStoryTree, makePaintedBarkAtlas, makePaintedLeafAtlas
} from '../src/world/paintedTrees.ts';
import { createHomeStage } from '../src/world/homeStage.ts';

test('both painted tree atlases are actual detailed sRGB UV textures', () => {
  const bark=makePaintedBarkAtlas(),leaves=makePaintedLeafAtlas();
  assert.ok(bark instanceof THREE.DataTexture);
  assert.ok(leaves instanceof THREE.DataTexture);
  assert.equal(bark.image.width,1024);
  assert.equal(bark.wrapS,THREE.ClampToEdgeWrapping);
  assert.equal(bark.wrapT,THREE.ClampToEdgeWrapping);
  assert.equal(leaves.image.height,256);
  assert.equal(bark.colorSpace,THREE.SRGBColorSpace);
  assert.equal(leaves.colorSpace,THREE.SRGBColorSpace);
  assert.equal(makePaintedLeafAtlas(),leaves,'reuse leaf texture across trees');
  assert.equal(makePaintedBarkAtlas(),bark,'reuse bark texture across trees');
  const pixel=(t,x,y)=>{
    const start=(y*t.image.width+x)*4;
    return Array.from(t.image.data.slice(start,start+3));
  };
  assert.notDeepEqual(pixel(bark,45,55),pixel(bark,61,55),'visible bark grain');
  assert.notDeepEqual(pixel(bark,45,55),pixel(bark,45,93),'paint varies along trunk');
  assert.notDeepEqual(pixel(leaves,64,64),pixel(leaves,193,64),'different painted green families');
  assert.notDeepEqual(pixel(leaves,64,64),pixel(leaves,64,193),'shadowed leaf pigment');
  assert.notDeepEqual(pixel(leaves,64,64),pixel(leaves,82,64),'vein and pigment within leaf UV');
});

test('tree is actual densely layered 3D leaf geometry and textured branching bark', () => {
  for(const kind of ['orchard','shade']){
    const tree=createPaintedStoryTree({kind,height:4.4,seed:542});
    assert.equal(tree.children.length,2,'only two draw calls per tree');
    assert.equal(tree.userData.treeRenderStyle,'real-3d-uv-painted-not-solid-color');
    const trunk=tree.getObjectByName('UV hand-painted tree trunk and branches');
    const leaves=tree.getObjectByName('Layered individual UV-painted tree leaves');
    assert.ok(trunk instanceof THREE.Mesh);
    assert.ok(leaves instanceof THREE.Mesh);
    assert.equal(trunk.material.map,makePaintedBarkAtlas());
    assert.equal(trunk.material.vertexColors,true,'trunk vertex AO retained');
    const uvBark=trunk.geometry.getAttribute('uv');
    const vertexPigment=trunk.geometry.getAttribute('color');
    assert.equal(uvBark.count,vertexPigment.count);
    let upperV=-Infinity,least=Infinity,highest=-Infinity;
    for(let i=0;i<uvBark.count;i++){
      upperV=Math.max(upperV,uvBark.getY(i));
      least=Math.min(least,vertexPigment.getX(i));
      highest=Math.max(highest,vertexPigment.getX(i));
    }
    assert.ok(upperV<1 && upperV>.9,'continuous trunk UV lies within painted atlas');
    assert.equal(trunk.geometry.userData.uvLayout,'separate-unwrapped-painterly-islands');
    assert.ok(least<.9,'soft roots');
    assert.ok(highest>.98,'upper trunk stays bright');
    assert.equal(leaves.material.map,makePaintedLeafAtlas());
    assert.equal(leaves.material.vertexColors,true);
    assert.equal(leaves.material.side,THREE.DoubleSide);
    assert.ok(trunk.castShadow && leaves.castShadow);
    assert.equal(leaves.material.toneMapped,false);
    assert.ok(trunk.geometry.getAttribute('uv'));
    assert.ok(leaves.geometry.getAttribute('uv'));
    assert.ok(trunk.geometry.getAttribute('normal'));
    assert.ok(leaves.geometry.getAttribute('normal'));
    assert.ok(leaves.geometry.userData.texturedLeafCrown);
    assert.equal(leaves.geometry.userData.layeredClusters, 9);
    assert.ok(leaves.geometry.userData.layeredCenters>=250);
    assert.ok(leaves.geometry.userData.leafCount>=250);
    assert.ok(leaves.geometry.getAttribute('position').count>9000);
    const bb=new THREE.Box3().setFromObject(tree);
    assert.ok(bb.getSize(new THREE.Vector3()).x>2,'full volume crown, not flat picture');
    assert.ok(bb.getSize(new THREE.Vector3()).z>2);
    const uv=leaves.geometry.getAttribute('uv');
    for(let i=0;i<uv.count;i++){
      const u=uv.getX(i),v=uv.getY(i);
      assert.ok(u>=0 && u<=1 && v>=0 && v<=1);
      const tileX=Math.floor(u*2),tileY=Math.floor(v*2);
      assert.ok(u > tileX*.5+.01 && u < (tileX+1)*.5-.01,'no atlas bleeding X');
      assert.ok(v > tileY*.5+.01 && v < (tileY+1)*.5-.01,'no atlas bleeding Y');
    }
  }
});

test('original hand-painted orchard is restored without affecting current house',()=>{
  const stage=createHomeStage(false);
  const tree=stage.root.getObjectByName('Old fruit tree');
  assert.ok(tree instanceof THREE.Group);
  assert.ok(tree.getObjectByName('UV hand-painted tree trunk and branches'));
  assert.ok(tree.getObjectByName('Layered individual UV-painted tree leaves'));
  assert.equal(stage.root.getObjectByName('Pohon tua di depan rumah'),undefined);
  assert.equal(stage.root.getObjectByName('Concept mature shade tree near the garden'),undefined);
  assert.ok(stage.root.getObjectByName('Old village well stone rim'));
  assert.ok(stage.solids.find(s=>s.label==='Childhood home walls'));
  assert.ok(stage.solids.find(s=>s.label==='Old village well'));
  assert.ok(!stage.solids.some(s=>/shade trunk|sentinel/i.test(s.label)));
});

test('village uses locally built UV-painted trees, never a remote CDN dependency', () => {
  const source=readFileSync(fileURLToPath(new URL('../src/world/Game.ts',import.meta.url)),'utf8');
  assert.match(source,/createPaintedStoryTree/);
  assert.match(source,/kind: 'shade'/);
  assert.doesNotMatch(source,/d2ol7oe51mr4n9\.cloudfront\.net/);
  assert.doesNotMatch(source,/new GLTFLoader\(\)/);
});
