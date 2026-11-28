import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { makeHouseCollisionMesh, HouseStairPhysics } from '../src/world/houseCollision.ts';
import { computeHouseScale, HOME } from '../src/world/homeStage.ts';
const RAPIER=await import(new URL('rapier.es.js',import.meta.resolve('@dimforge/rapier3d-compat')).href);
await RAPIER.init();
const dt=1/60;
const feet=p=>p.y-.84;
function setup(root){
  const mesh=makeHouseCollisionMesh(root);
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  world.timestep=dt;
  const fixed=world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(80,.25,80).setTranslation(0,-.25,0),fixed);
  const stairs=new HouseStairPhysics(world,fixed,mesh,RAPIER);
  const player=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().lockRotations().setCcdEnabled(true));
  world.createCollider(RAPIER.ColliderDesc.capsule(.56,.28).setFriction(.8),player);
  const place=(x,z,y=.85)=>{
    player.setTranslation({x,y,z},true);
    player.setLinvel({x:0,y:0,z:0},true);
    for(let i=0;i<12;i++)world.step();
  };
  const tick=(vx,vz)=>{
    player.setLinvel({x:vx,y:player.linvel().y,z:vz},true);
    const assisted=stairs.assist(player,dt);
    world.step();
    if(assisted)player.setLinvel({x:vx,y:player.linvel().y,z:vz},true);
    return player.translation();
  };
  return {mesh,world,stairs,player,place,tick,close(){stairs.dispose();world.free();}};
}
function box(root,x,y,z,w,h,d){
  const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d));
  o.position.set(x,y,z);root.add(o);return o;
}
test('dynamic capsule walks up and down real stairs, but cannot walk through a wall',()=>{
  const root=new THREE.Group();
  // Three 18 cm risers, 35 cm treads, then a raised porch.
  for(let i=0;i<3;i++)box(root,0,.09*(i+1),1-.35*i,1.6,.18*(i+1),.35);
  box(root,0,.27,-.75,1.6,.54,2.8);
  box(root,0,1.8,-2.25,1.6,2.52,.2);
  const s=setup(root);
  try{
    s.place(0,2);
    let p;
    for(let i=0;i<160;i++)p=s.tick(0,-2.3);
    assert.ok(feet(p)>.42&&feet(p)<.68,'capsule must reach the real porch '+JSON.stringify(p));
    assert.ok(p.z>-2.17,'closed wall must block the capsule '+JSON.stringify(p));
    for(let i=0;i<170;i++)p=s.tick(0,2.3);
    assert.ok(p.z>1.55&&feet(p)<.09,'walk back down to ground '+JSON.stringify(p));
  }finally{s.close();}
});

function actualHouse(){
  const b=readFileSync(new URL('../public/models/environment/rumah_utama_red_roof.glb',import.meta.url));
  const n=b.readUInt32LE(12),doc=JSON.parse(b.subarray(20,20+n).toString('utf8'));
  const base=28+n;
  function array(index,components){
    const a=doc.accessors[index],v=doc.bufferViews[a.bufferView];
    assert.ok(a.componentType===5126||a.componentType===5125||a.componentType===5123);
    const size=a.componentType===5123?2:4,off=base+(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??size*components;
    const out=a.componentType===5126?new Float32Array(a.count*components):new Uint32Array(a.count*components);
    for(let i=0;i<a.count;i++)for(let j=0;j<components;j++){
      const p=off+i*stride+j*size;
      out[i*components+j]=a.componentType===5126?b.readFloatLE(p):a.componentType===5125?b.readUInt32LE(p):b.readUInt16LE(p);
    }
    return out;
  }
  function node(i){
    const d=doc.nodes[i],o=new THREE.Group();
    if(d.matrix){o.matrix.fromArray(d.matrix);o.matrixAutoUpdate=false;}
    else{if(d.translation)o.position.fromArray(d.translation);if(d.rotation)o.quaternion.fromArray(d.rotation);if(d.scale)o.scale.fromArray(d.scale);}
    if(d.mesh!==undefined)for(const p of doc.meshes[d.mesh].primitives){
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.BufferAttribute(array(p.attributes.POSITION,3),3));
      if(p.indices!==undefined)geo.setIndex(new THREE.BufferAttribute(array(p.indices,1),1));
      o.add(new THREE.Mesh(geo));
    }
    for(const c of d.children??[])o.add(node(c));
    return o;
  }
  const root=new THREE.Group();
  for(const i of doc.scenes[doc.scene??0].nodes)root.add(node(i));
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const scale=computeHouseScale(size);
  root.scale.setScalar(scale);
  root.position.set(HOME.house.x-center.x*scale,-bounds.min.y*scale,HOME.house.z-center.z*scale);
  return root;
}
test('actual Red Roof GLB has a reachable raised exterior tread or landing, not an enclosing box',()=>{
  const s=setup(actualHouse());
  try{
    const b=s.mesh.bounds;
    assert.ok(s.mesh.indices.length/3>10000);
    assert.ok(b.max.y>3&&b.min.y>-.01);
    const candidates=[];
    // Scan from outside each facade. Prioritize the declared +Z front.
    // No hard-coded staircase position or height; use the actual packed mesh.
    for(const [axis,sign] of [['z',1],['z',-1],['x',1],['x',-1]]){
      const cross=axis==='z'?'x':'z';
      const start=(sign>0?b.max[axis]:b.min[axis])+sign*.80;
      for(let q=b.min[cross]+.32;q<b.max[cross]-.30;q+=.30){
        let peak=0,samples=0;
        for(let dist=.2;dist<3.3;dist+=.12){
          const at=start-sign*dist;
          const x=axis==='z'?q:at,z=axis==='z'?at:q;
          const t=s.stairs.collider.castRay(new RAPIER.Ray({x,y:1.35,z},{x:0,y:-1,z:0}),1.35,false);
          if(t>=0){
            const h=1.35-t;
            if(h>.15&&h<1.25){peak=Math.max(peak,h);samples++;}
          }
        }
        if(samples>=2)candidates.push({axis,sign,start,q,peak,samples});
      }
    }
    candidates.sort((a,b)=>(b.samples-a.samples)||((b.axis==='z'&&b.sign===1?1:0)-(a.axis==='z'&&a.sign===1?1:0)));
    let found=null,best=0;
    for(const c of candidates.slice(0,55)){
      const x=c.axis==='z'?c.q:c.start,z=c.axis==='z'?c.start:c.q;
      s.place(x,z);
      const vx=c.axis==='x'?-c.sign*2.5:0,vz=c.axis==='z'?-c.sign*2.5:0;
      for(let i=0;i<150;i++){
        const p=s.tick(vx,vz),h=feet(p);
        best=Math.max(best,h);
        if(h>.22&&h<1.25&&Math.abs(s.player.linvel().y)<.35){
          const support=s.stairs.groundHeight(p.x,p.z,h);
          if(support!==undefined&&Math.abs(h-support)<.10){
            // The capsule can stop on actual raised geometry, rather than
            // merely bouncing off an obstacle or jumping into the roof.
            let settled=p;
            for(let j=0;j<16;j++)settled=s.tick(0,0);
            if(feet(settled)>.20&&Math.abs(s.player.linvel().y)<.22){
              found={...c,feet:feet(settled),position:settled};break;
            }
          }
        }
      }
      if(found)break;
    }
    console.log('Red Roof walkable collision',JSON.stringify({triangles:s.mesh.indices.length/3,bounds:{min:b.min.toArray(),max:b.max.toArray()},candidates:candidates.length,best,found}));
    assert.ok(found,'no reachable raised exterior surface in actual house mesh; best height '+best);
  }finally{s.close();}
});
