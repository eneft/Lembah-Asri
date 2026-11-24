import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRIDGE_DECK,BRIDGE_WALK,bridgeWalkHeightAt,makeBridgeWalkCollider
} from '../src/world/paintedBridge.ts';

// This pure-geometry test runs in Node. Actual Rapier contact is tested in
// production-browser QA (which loads the same WASM-backed physics as the game).
test('the walkway is a continuous, traversable raised deck with both approach ramps',()=>{
  const top=BRIDGE_WALK.top;
  assert.ok(top>.30&&top<.34);
  const x0=BRIDGE_WALK.startX-BRIDGE_WALK.ramp;
  const x1=BRIDGE_WALK.endX+BRIDGE_WALK.ramp;
  assert.equal(bridgeWalkHeightAt(x0,BRIDGE_DECK.z),0);
  assert.equal(bridgeWalkHeightAt(BRIDGE_WALK.startX,BRIDGE_DECK.z),top);
  assert.equal(bridgeWalkHeightAt(BRIDGE_DECK.x,BRIDGE_DECK.z),top);
  assert.equal(bridgeWalkHeightAt(BRIDGE_WALK.endX,BRIDGE_DECK.z),top);
  assert.equal(bridgeWalkHeightAt(x1,BRIDGE_DECK.z),0);
  for(let x=x0+.02;x<x1-.02;x+=.02){
    const a=bridgeWalkHeightAt(x-.01,BRIDGE_DECK.z);
    const b=bridgeWalkHeightAt(x+.01,BRIDGE_DECK.z);
    assert.ok(Math.abs(b-a)<.01,'slope cannot have a sharp vertical step');
  }
  assert.ok(top/BRIDGE_WALK.ramp<.32,'approach slope stays under 32 percent');
  assert.equal(bridgeWalkHeightAt(BRIDGE_DECK.x,BRIDGE_DECK.z+BRIDGE_WALK.halfWidth+.2),0);
});

test('the real static collision surface uses upward triangles welded to ramps',()=>{
  const {vertices,indices}=makeBridgeWalkCollider();
  assert.equal(vertices.length,24);
  assert.equal(indices.length,18);
  for(let i=0;i<indices.length;i+=3){
    const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
    const ab=[vertices[b]-vertices[a],vertices[b+1]-vertices[a+1],vertices[b+2]-vertices[a+2]];
    const ac=[vertices[c]-vertices[a],vertices[c+1]-vertices[a+1],vertices[c+2]-vertices[a+2]];
    const ny=ab[2]*ac[0]-ab[0]*ac[2];
    assert.ok(ny>0,'collider face must contact the character from above');
  }
  const first=0,last=vertices.length-6;
  assert.equal(vertices[first+1],0,'ramp starts on the world floor');
  assert.equal(vertices[last+1],0,'ramp finishes on the world floor');
  assert.ok(vertices[7]>.30&&vertices[13]>.30,'the deck is physically raised');
});

// Node resolves the compat package's CJS entry incorrectly under ESM.
// Load the same ES build that Vite uses, without changing production imports.
const RAPIER = await import(new URL('rapier.es.js',import.meta.resolve('@dimforge/rapier3d-compat')).href);
import { CREEK, creekCenterX } from '../src/world/creekCourse.ts';
import { CREEK_COLLISION, creekCollisionBanks, makeCreekCollisionVolumes, installCreekCollision } from '../src/world/creekCollision.ts';

test('solid creek follows both meandering banks and stops exactly at bridge deck edges',()=>{
  const volumes=makeCreekCollisionVolumes(),cfg=CREEK_COLLISION;
  assert.ok(cfg.start<CREEK.start&&cfg.end>CREEK.end);
  assert.equal(cfg.bridgeMin,BRIDGE_DECK.z-BRIDGE_WALK.halfWidth);
  assert.equal(cfg.bridgeMax,BRIDGE_DECK.z+BRIDGE_WALK.halfWidth);
  assert.ok(cfg.top>BRIDGE_WALK.top+5.2**2/(2*9.81)+.84);
  assert.ok(volumes.length>100&&volumes.length<150);
  let last=cfg.start;
  for(const v of volumes){
    assert.equal(v.length,24);
    const start=v[2],end=v[14];
    if(Math.abs(start-cfg.bridgeMax)<.0001)assert.ok(Math.abs(last-cfg.bridgeMin)<.0001);
    else assert.ok(Math.abs(start-last)<.0001,'no holes between adjacent river solids');
    assert.ok(end<=cfg.bridgeMin+.0001||start>=cfg.bridgeMax-.0001);
    for(const [z,offset] of [[start,0],[end,12]]){
      const [west,east]=creekCollisionBanks(z);
      assert.ok(Math.abs(v[offset]-west)<.0001);
      assert.ok(Math.abs(v[offset+6]-east)<.0001);
    }
    last=end;
  }
  assert.ok(Math.abs(last-cfg.end)<.0001);
});

test('Rapier stops walking, sprinting and jumping across the creek on either bank but allows the bridge',async()=>{
  await RAPIER.init();
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  world.timestep=1/60;
  try {
    const floor=world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(80,.25,80).setTranslation(0,-.25,0),floor);
    const bridge=makeBridgeWalkCollider();
    world.createCollider(RAPIER.ColliderDesc.trimesh(bridge.vertices,bridge.indices).setFriction(.92),floor);
    assert.equal(installCreekCollision(world,floor,RAPIER),makeCreekCollisionVolumes().length);
    const player=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().lockRotations().setCcdEnabled(true));
    world.createCollider(RAPIER.ColliderDesc.capsule(.56,.28).setFriction(.8),player);
    function run(x,z,vx,vz,jump=false,frames=210){
      player.setTranslation({x,y:.85,z},true);
      player.setLinvel({x:0,y:0,z:0},true);
      for(let i=0;i<12;i++)world.step();
      if(jump)player.setLinvel({x:vx,y:5.2,z:vz},true);
      for(let i=0;i<frames;i++){
        player.setLinvel({x:vx,y:player.linvel().y,z:vz},true);
        world.step();
      }
      return player.translation();
    }
    for(const z of [-50,-5.5,0,18,50]){
      const [west,east]=creekCollisionBanks(z);
      for(const [speed,jump] of [[2.8,false],[6,false],[6,true]]){
        const left=run(west-1.3,z,speed,0,jump);
        const right=run(east+1.3,z,-speed,0,jump);
        assert.ok(left.x<creekCenterX(z)-.8,'west bank blocked '+JSON.stringify({z,speed,jump,left}));
        assert.ok(right.x>creekCenterX(z)+.8,'east bank blocked '+JSON.stringify({z,speed,jump,right}));
      }
    }
    const z=BRIDGE_DECK.z;
    const east=run(BRIDGE_WALK.startX-1.5,z,3.2,0,false,190);
    assert.ok(east.x>BRIDGE_WALK.endX+.4,'bridge crossing west to east '+JSON.stringify(east));
    const west=run(BRIDGE_WALK.endX+1.5,z,-3.2,0,false,190);
    assert.ok(west.x<BRIDGE_WALK.startX-.4,'bridge crossing east to west '+JSON.stringify(west));
    // Sideways attempt from bridge centre must not enter the water.
    player.setTranslation({x:BRIDGE_DECK.x,y:BRIDGE_WALK.top+.85,z},true);
    player.setLinvel({x:0,y:0,z:0},true);
    for(let i=0;i<12;i++)world.step();
    for(let i=0;i<100;i++){
      player.setLinvel({x:0,y:player.linvel().y,z:5.5},true);world.step();
    }
    assert.ok(player.translation().z< CREEK_COLLISION.bridgeMax,'bridge side also blocks entry into water');
  } finally { world.free(); }
});
