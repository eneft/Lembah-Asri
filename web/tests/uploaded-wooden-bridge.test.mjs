import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { BRIDGE_DECK, BRIDGE_WALK, makeBridgeWalkCollider } from '../src/world/paintedBridge.ts';
import { USER_BRIDGE, fitUserBridgeBounds } from '../src/world/uploadedBridge.ts';

test('replacement bridge preserves 10,000 original faces and baked UV-painted wood texture',()=>{
  assert.equal(USER_BRIDGE.asset,'./models/environment/bridge_user_reference_wood_v2.glb');
  const file=readFileSync(new URL('../public/models/environment/bridge_user_reference_wood_v2.glb',import.meta.url));
  assert.equal(file.toString('ascii',0,4),'glTF');
  assert.equal(file.readUInt32LE(4),2);
  assert.equal(file.readUInt32LE(8),file.length,'asset not truncated in GitHub');
  assert.ok(file.length>200000&&file.length<240000,'retain source art while optimizing the 15.5 MB 4K source for mobile');
  assert.equal(createHash('sha256').update(file).digest('hex'),USER_BRIDGE.sourceSHA256);
  const jsonLength=file.readUInt32LE(12);
  const json=JSON.parse(file.subarray(20,20+jsonLength).toString('utf8'));
  for(const extension of ['EXT_meshopt_compression','EXT_texture_webp','KHR_mesh_quantization'])
    assert.ok(json.extensionsRequired.includes(extension),'missing optimized GLB extension '+extension);
  const mesh=json.meshes[0].primitives[0];
  assert.equal(mesh.mode??4,4,'original wooden triangles are preserved');
  assert.equal(json.accessors[mesh.indices].count,30000,'10,000 authentic source faces');
  assert.equal(json.materials[0].emissiveTexture.index,0,'retain shaded hand-painted UV texture');
  assert.equal(json.images[0].mimeType,'image/webp');
});

test('Z-oriented uploaded bridge is rotated 90 degrees and fitted to X walkway without changing Rapier',()=>{
  assert.equal(USER_BRIDGE.sourceFile,'base_basic_shaded(2).glb');
  assert.equal(USER_BRIDGE.originalTriangles,10000);
  assert.equal(USER_BRIDGE.rotationY,Math.PI/2);
  const source=new THREE.Box3(new THREE.Vector3(-.3752132058,0,-.947587192),
    new THREE.Vector3(.3750215173,.779260397,.947997153));
  const dims=source.getSize(new THREE.Vector3());
  assert.ok(dims.z>dims.x*2.4,'source bridge is actually long in Z, not X');
  const authored=new THREE.Mesh(new THREE.BoxGeometry(dims.x,dims.y,dims.z),
    new THREE.MeshBasicMaterial());
  authored.position.copy(source.getCenter(new THREE.Vector3()));
  const rotated=new THREE.Group();
  rotated.rotation.y=USER_BRIDGE.rotationY;
  rotated.add(authored);
  rotated.updateMatrixWorld(true);
  const fit=fitUserBridgeBounds(new THREE.Box3().setFromObject(rotated));
  const bridge=new THREE.Group();
  bridge.scale.copy(fit.scale);
  bridge.position.copy(fit.position);
  bridge.add(rotated);
  bridge.updateMatrixWorld(true);
  const finalBounds=new THREE.Box3().setFromObject(bridge);
  const size=finalBounds.getSize(new THREE.Vector3());
  const center=finalBounds.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(size.x-BRIDGE_DECK.length)<.001,'long Z source must span X across creek');
  assert.ok(Math.abs(size.z-BRIDGE_WALK.halfWidth*2)<.001,'width must fit old walkable surface');
  assert.ok(Math.abs(center.x-BRIDGE_DECK.x)<.001);
  assert.ok(Math.abs(center.z-BRIDGE_DECK.z)<.001);
  assert.ok(Math.abs(USER_BRIDGE.sourceTopOfDeck*fit.scale.y+fit.position.y-BRIDGE_WALK.top)<1e-8);
  assert.ok(fit.scale.y>1.3&&fit.scale.y<1.5,'appropriate vertical scale for new model');
  assert.ok(finalBounds.max.y>.75&&finalBounds.max.y<.95,'handrails stay proportional');
  const collider=makeBridgeWalkCollider();
  assert.equal(collider.indices.length,18,'old elevated deck + approach ramps unchanged');
});
