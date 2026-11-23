import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createReferenceShadeTree } from '../src/world/referenceShadeTree.ts';
import {
  makeUserAtlasTile, applyUserReferenceTreeTextures,
  USER_REFERENCE_ASSETS
} from '../src/world/userReferenceTextures.ts';

test('authentic uploaded WebP paint sheets are bundled without paper-backed leaves',()=>{
  for(const file of [USER_REFERENCE_ASSETS.materials,USER_REFERENCE_ASSETS.leaf]){
    const path=new URL('../public/'+file.slice(2),import.meta.url);
    const bytes=fs.readFileSync(path);
    assert.ok(bytes.length>1000,'texture asset must not be a placeholder');
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
  }
});

test('UV quadrants select bark and stone without stretching over all four tiles',()=>{
  const atlas=new THREE.Texture();
  const bark=makeUserAtlasTile(atlas,'bark');
  const rock=makeUserAtlasTile(atlas,'rock');
  const clay=makeUserAtlasTile(atlas,'terracotta');
  const wood=makeUserAtlasTile(atlas,'wood');
  for(const t of [bark,rock,clay,wood]){
    assert.equal(t.repeat.x,.5);
    assert.equal(t.repeat.y,.5);
    assert.equal(t.colorSpace,THREE.SRGBColorSpace);
  }
  assert.deepEqual([bark.offset.x,bark.offset.y],[0,.5]);
  assert.deepEqual([rock.offset.x,rock.offset.y],[.5,.5]);
  assert.deepEqual([clay.offset.x,clay.offset.y],[0,0]);
  assert.deepEqual([wood.offset.x,wood.offset.y],[.5,0]);
});

test('approved true-3D shade tree accepts user painterly bark and leaf pigment without changing shape',()=>{
  const tree=createReferenceShadeTree();
  const before=new THREE.Box3().setFromObject(tree).getSize(new THREE.Vector3());
  const roots=tree.getObjectByName('Exposed hand-painted buttress roots');
  const sprays=tree.getObjectByName('Reference broad hand-painted leaf sprays');
  const bark=new THREE.Texture(),leaf=new THREE.Texture();
  bark.colorSpace=leaf.colorSpace=THREE.SRGBColorSpace;
  const textures={bark,leaf,rock:new THREE.Texture()};
  assert.equal(applyUserReferenceTreeTextures(tree,textures),true);
  assert.equal(roots.material.map,bark);
  assert.equal(sprays.material.map,leaf);
  assert.equal(sprays.count,144);
  assert.equal(sprays.userData.isTrue3D,true);
  assert.equal(sprays.material.vertexColors,false);
  assert.equal(tree.userData.userReferenceBarkMeshes,1);
  assert.equal(tree.userData.userReferenceAtlasLoaded,true);
  assert.equal(tree.children.length,4);
  const after=new THREE.Box3().setFromObject(tree).getSize(new THREE.Vector3());
  assert.ok(before.distanceTo(after)<1e-5,'texture pass must not move or resize the tree');
  assert.equal(tree.getObjectByName('Exposed hand-painted buttress roots').geometry.userData.buttressRoots,8);
});
