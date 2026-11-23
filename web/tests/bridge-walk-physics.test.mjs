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
