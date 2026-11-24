import type RAPIER from '@dimforge/rapier3d-compat';
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
  // Match the visible grassy bank crest, not the submerged foot of the slope.
  bankMargin: .50,
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

export function installCreekCollision(world:RAPIER.World,body:RAPIER.RigidBody,api:typeof RAPIER):number {
  let count=0;
  for(const vertices of makeCreekCollisionVolumes()){
    const collider=api.ColliderDesc.convexHull(vertices);
    if(!collider)throw new Error('Invalid solid creek collision volume');
    // Low friction lets the player slide naturally along the shore.
    world.createCollider(collider.setFriction(.04).setRestitution(0),body);
    count++;
  }
  return count;
}

/** Independent, swept horizontal safety guard for the actual fixed-step
 * player controller. Rapier remains the primary collision system; this only
 * corrects a forbidden result if a contact solver or fast movement leaks.
 * The player centre must stay one capsule radius outside the river or within
 * the real bridge's walkable width, including while airborne. */
export const CREEK_PLAYER_RADIUS=.28;
export function creekPlayerForbidden(x:number,z:number):boolean {
  if(z<CREEK_COLLISION.start||z>CREEK_COLLISION.end)return false;
  if(z>=CREEK_COLLISION.bridgeMin+CREEK_PLAYER_RADIUS &&
     z<=CREEK_COLLISION.bridgeMax-CREEK_PLAYER_RADIUS)return false;
  const [west,east]=creekCollisionBanks(z);
  return x>west-CREEK_PLAYER_RADIUS && x<east+CREEK_PLAYER_RADIUS;
}
type XZ={x:number;z:number};
export function guardCreekPlayerMovement(from:XZ,to:XZ):XZ&{blocked:boolean}{
  // Recover a legacy/teleported player in the forbidden channel to the
  // closest dry bank, never leave them walking on the old flat ground.
  if(creekPlayerForbidden(from.x,from.z)){
    const [west,east]=creekCollisionBanks(from.z);
    const a=west-CREEK_PLAYER_RADIUS-.025,b=east+CREEK_PLAYER_RADIUS+.025;
    const x=Math.abs(from.x-a)<Math.abs(from.x-b)?a:b;
    return {x,z:from.z,blocked:true};
  }
  function sweep(a:XZ,b:XZ):{point:XZ;blocked:boolean}{
    const dx=b.x-a.x,dz=b.z-a.z;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
    let last=0;
    for(let i=1;i<=steps;i++){
      const s=i/steps;
      if(creekPlayerForbidden(a.x+dx*s,a.z+dz*s)){
        let lo=last,hi=s;
        for(let j=0;j<12;j++){
          const m=(lo+hi)*.5;
          if(creekPlayerForbidden(a.x+dx*m,a.z+dz*m))hi=m;else lo=m;
        }
        const safe=Math.max(0,lo-.0001);
        return {point:{x:a.x+dx*safe,z:a.z+dz*safe},blocked:true};
      }
      last=s;
    }
    return {point:b,blocked:false};
  }
  const hit=sweep(from,to);
  if(!hit.blocked)return {...to,blocked:false};
  // Preserve the tangential component where possible (walk along the bank,
  // or move along the deck) rather than glue the character to the boundary.
  const p=hit.point;
  const alongZ=sweep(p,{x:p.x,z:to.z}).point;
  const alongX=sweep(p,{x:to.x,z:p.z}).point;
  const slide=Math.hypot(alongZ.x-p.x,alongZ.z-p.z)>=Math.hypot(alongX.x-p.x,alongX.z-p.z)?alongZ:alongX;
  return {...slide,blocked:true};
}
