import RAPIER from '@dimforge/rapier3d-compat';
import { CREEK, creekCenterX, creekWidth } from './creekCourse.ts';
import { BRIDGE_DECK, BRIDGE_WALK } from './paintedBridge.ts';

/**
 * Bridge-only crossing. Solid static volumes (not sensors or render meshes)
 * fill the water channel, including its widened pools and distant bends.
 * Their upper edge is well above the maximum 5.2 m/s player jump.
 * Use the real collision deck width, not the older decorative bridge bounds.
 */
export const CREEK_COLLISION = Object.freeze({
  start: CREEK.start-2,
  end: CREEK.end+2,
  bridgeMin: BRIDGE_DECK.z-BRIDGE_WALK.halfWidth,
  bridgeMax: BRIDGE_DECK.z+BRIDGE_WALK.halfWidth,
  bankMargin: .25,
  bottom: -1.2,
  top: 3.5,
  maxSegmentLength: 1.25
});

export function creekCollisionBanks(z:number):[number,number] {
  const sample=Math.max(CREEK.start,Math.min(CREEK.end,z));
  const centre=creekCenterX(sample);
  const half=creekWidth(sample)*.5+CREEK_COLLISION.bankMargin;
  return [centre-half,centre+half];
}

/** Adjacent convex prisms share their end cross-sections exactly, without
 * the gaps of a row of rotated boxes. Each bank interpolates the same
 * procedural creek course used by the rendered terrain. */
export function makeCreekCollisionVolumes():Float32Array[] {
  const cfg=CREEK_COLLISION;
  const volumes:Float32Array[]=[];
  for(const [start,end] of [[cfg.start,cfg.bridgeMin],[cfg.bridgeMax,cfg.end]]){
    const steps=Math.ceil((end-start)/cfg.maxSegmentLength);
    for(let i=0;i<steps;i++){
      const a=start+(end-start)*i/steps;
      const b=i===steps-1?end:start+(end-start)*(i+1)/steps;
      const vertices:number[]=[];
      for(const z of [a,b]){
        for(const x of creekCollisionBanks(z)){
          vertices.push(x,cfg.bottom,z,x,cfg.top,z);
        }
      }
      volumes.push(new Float32Array(vertices));
    }
  }
  return volumes;
}

export function installCreekCollision(world:RAPIER.World,body:RAPIER.RigidBody):number {
  let count=0;
  for(const vertices of makeCreekCollisionVolumes()){
    const collider=RAPIER.ColliderDesc.convexHull(vertices);
    if(!collider)throw new Error('Invalid solid creek collision volume');
    // Low friction lets the player slide naturally along the shore.
    world.createCollider(collider.setFriction(.04).setRestitution(0),body);
    count++;
  }
  return count;
}
