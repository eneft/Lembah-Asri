import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { PLAYER_BODY_GROUND_Y } from './characterAnimation.ts';

export type HouseCollisionMesh={
  vertices:Float32Array;
  indices:Uint32Array;
  bounds:THREE.Box3;
};

/** A static, welded physics-only mesh in actual world metres.
 * Keep every nondegenerate surface (steps, floor, walls, closed door, posts).
 * No mutation of visual geometry, normals, UVs, materials, or asset bytes.
 */
export function makeHouseCollisionMesh(root:THREE.Object3D):HouseCollisionMesh{
  root.updateWorldMatrix(true,true);
  const vertices:number[]=[],indices:number[]=[];
  const weld=new Map<string,number>();
  const bounds=new THREE.Box3();
  const v=new THREE.Vector3();
  root.traverse(o=>{
    if(!(o instanceof THREE.Mesh)||!o.visible)return;
    const p=o.geometry.getAttribute('position');
    if(!p)throw new Error('Missing house collision position');
    const remap:number[]=[];
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
      if(!Number.isFinite(v.x+v.y+v.z))throw new Error('Invalid house collision vertex');
      const key=[v.x,v.y,v.z].map(n=>Math.round(n*1000)).join(',');
      let j=weld.get(key);
      if(j===undefined){j=vertices.length/3;weld.set(key,j);vertices.push(v.x,v.y,v.z);bounds.expandByPoint(v);}
      remap.push(j);
    }
    const index=o.geometry.index;
    const count=index?.count??p.count;
    if(count%3)throw new Error('Non-triangular house geometry');
    for(let i=0;i<count;i+=3){
      const a=remap[index?index.getX(i):i],b=remap[index?index.getX(i+1):i+1],c=remap[index?index.getX(i+2):i+2];
      if(a===undefined||b===undefined||c===undefined)throw new Error('Invalid house triangle index');
      if(a===b||b===c||c===a)continue;
      const abx=vertices[b*3]-vertices[a*3],aby=vertices[b*3+1]-vertices[a*3+1],abz=vertices[b*3+2]-vertices[a*3+2];
      const acx=vertices[c*3]-vertices[a*3],acy=vertices[c*3+1]-vertices[a*3+1],acz=vertices[c*3+2]-vertices[a*3+2];
      if((aby*acz-abz*acy)**2+(abz*acx-abx*acz)**2+(abx*acy-aby*acx)**2<1e-12)continue;
      indices.push(a,b,c);
    }
  });
  if(!indices.length||bounds.isEmpty())throw new Error('Empty house collision mesh');
  return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices),bounds};
}

export const HOUSE_STEP_HEIGHT=.42;
export const HOUSE_STEP_WIDTH=.10;

/** Rapier remains authoritative. Its character controller is used only as a
 * swept capsule query for small upward steps near the imported house.
 * Ordinary locomotion, gravity, jumping, creek and garden physics are unchanged.
 */
export class HouseStairPhysics{
  readonly collider:RAPIER.Collider;
  private readonly controller:RAPIER.KinematicCharacterController;
  private readonly bounds:THREE.Box3;
  constructor(private readonly world:RAPIER.World,body:RAPIER.RigidBody,mesh:HouseCollisionMesh,private readonly api:typeof RAPIER){
    this.bounds=mesh.bounds.clone().expandByScalar(.65);
    this.collider=world.createCollider(api.ColliderDesc.trimesh(mesh.vertices,mesh.indices,api.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(.8).setRestitution(0),body);
    this.controller=world.createCharacterController(.012);
    this.controller.enableAutostep(HOUSE_STEP_HEIGHT,HOUSE_STEP_WIDTH,false);
    this.controller.setMaxSlopeClimbAngle(Math.PI/3);
  }
  near(x:number,z:number){return x>=this.bounds.min.x&&x<=this.bounds.max.x&&z>=this.bounds.min.z&&z<=this.bounds.max.z;}
  groundHeight(x:number,z:number,feet:number):number|undefined{
    if(!this.near(x,z))return undefined;
    // From just above the player's feet, not from above the roof.
    const origin=feet+.14;
    const t=this.collider.castRay(new this.api.Ray({x,y:origin,z},{x:0,y:-1,z:0}),.32,false);
    return t>=0?origin-t:undefined;
  }
  assist(player:RAPIER.RigidBody,dt:number):boolean{
    const p=player.translation(),v=player.linvel();
    if(!this.near(p.x,p.z)||Math.abs(v.y)>.65||Math.hypot(v.x,v.z)<.05)return false;
    const shape=player.collider(0);
    const dx=v.x*dt,dz=v.z*dt;
    // A small downward component makes the controller recognize ground contact.
    this.controller.computeColliderMovement(shape,{x:dx,y:-.035,z:dz});
    const m=this.controller.computedMovement();
    if(!Number.isFinite(m.x+m.y+m.z)||m.y<=.012||m.y>HOUSE_STEP_HEIGHT+.025||m.x*dx+m.z*dz<=0)return false;
    // Autostep's swept capsule has already checked both the tread and headroom.
    // Apply only this bounded, upward correction, then let the dynamic solver
    // settle on the physical stair. Never turn a jump into an autostep.
    player.setTranslation({x:p.x+m.x,y:p.y+m.y,z:p.z+m.z},true);
    player.setLinvel({x:0,y:0,z:0},true);
    return true;
  }
  dispose(){this.world.removeCharacterController(this.controller);}
}
