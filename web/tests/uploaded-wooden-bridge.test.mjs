import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { BRIDGE_DECK, BRIDGE_WALK, makeBridgeWalkCollider } from '../src/world/paintedBridge.ts';
import { USER_BRIDGE, fitUserBridgeBounds } from '../src/world/uploadedBridge.ts';

test('new crossing ships exact optimized user GLB with its 7,823 triangles and baked wood atlas',()=>{
  assert.equal(USER_BRIDGE.asset,'./models/environment/bridge_user_reference_wood_v1.glb');
  const file=readFileSync(new URL('../public/models/environment/bridge_user_reference_wood_v1.glb',import.meta.url));
  assert.equal(file.toString('ascii',0,4),'glTF');
  assert.equal(file.readUInt32LE(4),2);
  assert.equal(file.readUInt32LE(8),file.length,'asset not truncated in GitHub');
  assert.ok(file.length>120000&&file.length<180000,'retain source art but optimize 14 MB texture for browser');
  assert.equal(createHash('sha256').update(file).digest('hex'),USER_BRIDGE.sourceSHA256);
  const jsonLength=file.readUInt32LE(12);
  const json=JSON.parse(file.subarray(20,20+jsonLength).toString('utf8'));
  for(const extension of ['EXT_meshopt_compression','EXT_texture_webp','KHR_mesh_quantization'])
    assert.ok(json.extensionsRequired.includes(extension),'missing optimized GLB extension '+extension);
  const mesh=json.meshes[0].primitives[0];
  assert.equal(mesh.mode??4,4,'original wooden triangles are preserved');
  assert.equal(json.accessors[mesh.indices].count,23469,'7,823 authentic source faces');
  assert.equal(json.materials[0].emissiveTexture.index,0,'retain shaded hand-painted UV texture');
  assert.equal(json.images[0].mimeType,'image/webp');
});

test('imported bridge is aligned in X and sits exactly at Rapier deck Y without changing physics',()=>{
  const source=new THREE.Box3(new THREE.Vector3(-.938241,0,-.25022),
    new THREE.Vector3(.94913697,.56953603,.241455));
  const {scale,position}=fitUserBridgeBounds(source);
  const size=source.getSize(new THREE.Vector3()).multiply(scale);
  const center=source.getCenter(new THREE.Vector3()).multiply(scale).add(position);
  assert.ok(Math.abs(size.x-BRIDGE_DECK.length)<1e-6,'crossing spans its approved X width');
  assert.ok(Math.abs(size.z-BRIDGE_WALK.halfWidth*2)<1e-6,'rails track safe walking surface');
  assert.ok(Math.abs(center.x-BRIDGE_DECK.x)<1e-6);
  assert.ok(Math.abs(center.z-BRIDGE_DECK.z)<1e-6);
  assert.ok(Math.abs(USER_BRIDGE.sourceTopOfDeck*scale.y+position.y-BRIDGE_WALK.top)<1e-6);
  assert.ok(scale.y>2&&scale.y<2.3,'no exaggerated bridge height');
  const collider=makeBridgeWalkCollider();
  assert.equal(collider.indices.length,18,'existing raised walking physics remains protected');
});
