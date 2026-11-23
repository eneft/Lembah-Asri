import test from 'node:test';
import assert from 'node:assert/strict';
import * as RAPIER from '@dimforge/rapier3d-compat';
import {BRIDGE_DECK,BRIDGE_WALK,bridgeWalkHeightAt,makeBridgeWalkCollider}
  from '../src/world/paintedBridge.ts';

test('Rapier character physically walks across the raised bridge without sinking',async()=>{
  await RAPIER.init();
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  const ground=world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(80,.25,80).setTranslation(0,-.25,0),
    ground
  );
  const {vertices,indices}=makeBridgeWalkCollider();
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(vertices,indices).setFriction(.92),ground
  );
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(BRIDGE_WALK.endX+BRIDGE_WALK.ramp+.15,.84,BRIDGE_DECK.z)
    .lockRotations());
  world.createCollider(RAPIER.ColliderDesc.capsule(.56,.28).setFriction(.8),body);
  world.timestep=1/60;
  for(let i=0;i<24;i++)world.step();
  let onDeck=0,underDeck=0,landedExit=false;
  for(let i=0;i<570;i++){
    const velocity=body.linvel();
    body.setLinvel({x:-1.6,y:velocity.y,z:0},true);
    world.step();
    const p=body.translation();
    if(p.x>BRIDGE_WALK.startX+.2&&p.x<BRIDGE_WALK.endX-.2){
      onDeck++;
      if(p.y<.84+BRIDGE_WALK.top-.055)underDeck++;
    }
    if(p.x<BRIDGE_WALK.startX-BRIDGE_WALK.ramp-.02){landedExit=true;break;}
  }
  assert.ok(onDeck>30,'character crosses the elevated wooden deck');
  assert.equal(underDeck,0,'capsule does not sink under its deck');
  assert.equal(landedExit,true,'character can walk off the far ramp safely');
  assert.ok(Math.abs(body.translation().y-.84)<.13,
    'character ends on the ordinary ground height');
  world.free();
});
