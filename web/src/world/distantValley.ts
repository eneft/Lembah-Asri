import * as THREE from 'three';
import { CREEK, creekCenterX } from './creekCourse.ts';

/** World-space scenic geometry, outside the 160 m existing playable floor.
 * A continuous square-to-valley terrain, not a camera-facing backdrop.
 * Painterly baked color and atmospheric perspective preserve Stage 5 daylight. */
export const DISTANT_VALLEY=Object.freeze({
  inner:80,outer:265,step:5,style:'layered-painterly-javanese-valley-v1',
  treeCount:460,houseCount:14
});
const clamp=THREE.MathUtils.clamp,smooth=THREE.MathUtils.smoothstep;
const radius=(x:number,z:number)=>Math.max(Math.abs(x),Math.abs(z));
const wave=(x:number,z:number)=>
  .46*Math.sin(x*.039+z*.025)+.26*Math.cos(x*.067-z*.037)+
  .18*Math.sin(z*.096+x*.028)+.10*Math.cos(x*.13+z*.08);
function riverX(z:number):number {
  const sign=z<0?-1:1;
  const edge=sign<0?CREEK.start:CREEK.end;
  const d=Math.max(0,Math.abs(z)-80);
  return creekCenterX(edge)+sign*(9*Math.sin(d*.052)+d*.16);
}
export function distantValleyHeight(x:number,z:number):number{
  const r=radius(x,z);
  if(r<=80)return -.035;
  const d=r-80;
  const hills=smooth(d,0,34)*(9+16*(.5+.5*wave(x,z)));
  const mountains=smooth(d,45,170)*
    (30+94*Math.pow(clamp(.50+.60*wave(x*.65,z*.65),0,1),1.5));
  const channel=(1-smooth(Math.abs(x-riverX(z)),4,25))*
    smooth(Math.abs(z),80,90)*(1-smooth(Math.abs(z),160,190));
  return -.035+(hills+mountains)*(1-.90*channel);
}
const fieldGreen=new THREE.Color('#a5b66d'),forestGreen=new THREE.Color('#698e61');
const haze=new THREE.Color('#b5d8df'),blueRidge=new THREE.Color('#789eab');
const boundary=new THREE.Color('#cfdeca');
export function distantValleyColor(x:number,z:number,y:number):THREE.Color{
  const d=radius(x,z)-80;
  const variation=.5+.5*wave(x*2,z*2);
  const fieldPattern=.5+.5*Math.sin(x*.21+z*.13+1.6*Math.sin(z*.06));
  const patch=smooth(fieldPattern,.26,.76)*(1-smooth(d,40,95));
  const color=forestGreen.clone().lerp(fieldGreen,clamp(variation*.46+patch*.50,0,1));
  // Painted directional slope shading and subtle terraced green fields.
  const slope=clamp((distantValleyHeight(x+2,z)-distantValleyHeight(x-2,z))*.012,-.065,.065);
  color.multiplyScalar(1+slope+.035*Math.sin(y*.8+z*.07)*patch);
  color.lerp(blueRidge,smooth(d,42,142)*.78);
  color.lerp(haze,smooth(d,100,185)*.70);
  color.lerp(boundary,(1-smooth(d,0,14))*.70);
  return color;
}
function terrainMesh():THREE.Mesh {
  const {inner,outer,step}=DISTANT_VALLEY,n=outer*2/step;
  const p:number[]=[],c:number[]=[],indices:number[]=[];
  for(let iz=0;iz<=n;iz++)for(let ix=0;ix<=n;ix++){
    const x=-outer+ix*step,z=-outer+iz*step,y=distantValleyHeight(x,z);
    p.push(x,y,z);
    const col=distantValleyColor(x,z,y);
    c.push(col.r,col.g,col.b);
  }
  for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){
    const x=-outer+ix*step,z=-outer+iz*step;
    if(x>=-inner&&x+step<=inner&&z>=-inner&&z+step<=inner)continue;
    const a=iz*(n+1)+ix,b=a+n+1;
    indices.push(a,b,a+1,a+1,b,b+1);
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  geom.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
  geom.setIndex(indices);geom.computeVertexNormals();geom.computeBoundingSphere();
  const mesh=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({
    vertexColors:true,toneMapped:false,fog:false
  }));
  mesh.name='Distant valley continuous hills and terraced fields';
  return mesh;
}
function riverExtension():THREE.Mesh {
  const p:number[]=[],c:number[]=[],idx:number[]=[];
  for(const sign of [-1,1]){
    const base=p.length/3;
    for(let i=0;i<=42;i++){
      const d=i*2,z=sign*(80+d),x=riverX(z),width=sign<0?2.5:3.8;
      for(const side of [-1,1]){
        const px=x+side*width*.5;
        p.push(px,distantValleyHeight(px,z)+.12,z);
        const col=new THREE.Color('#649ea4').lerp(haze,smooth(d,20,84)*.65);
        c.push(col.r,col.g,col.b);
      }
      if(i){const a=base+(i-1)*2,b=a+2;idx.push(a,b,a+1,a+1,b,b+1);}
    }
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  geom.setAttribute('color',new THREE.Float32BufferAttribute(c,3));geom.setIndex(idx);
  const mesh=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({
    vertexColors:true,side:THREE.DoubleSide,toneMapped:false,fog:false
  }));
  mesh.name='Distant creek winding into valley';
  return mesh;
}
let seed=0;
function rand():number {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function scenicMaterial():THREE.MeshBasicMaterial{
  return new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false,fog:false});
}
function scenicColor(hex:string,x:number,z:number):THREE.Color{
  const d=radius(x,z)-80;
  return new THREE.Color(hex).lerp(blueRidge,smooth(d,25,100)*.55)
    .lerp(haze,smooth(d,90,150)*.65);
}
function forest():THREE.Group {
  const root=new THREE.Group(),obj=new THREE.Object3D();
  const trees=DISTANT_VALLEY.treeCount;
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.38,.55,1,5),scenicMaterial(),trees);
  const crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),scenicMaterial(),trees*2);
  trunk.name='Distant forest trunks';crowns.name='Distant layered forest canopy';
  let count=0;
  // Seeded, organic groves rather than a uniform dotted grid.
  for(let i=0;i<trees*15&&count<trees;i++){
    const x=(rand()*2-1)*190,z=(rand()*2-1)*190,r=radius(x,z);
    if(r<86||r>185||wave(x*1.6,z*1.6)<-.16||
       (Math.abs(z)>80&&Math.abs(x-riverX(z))<7))continue;
    const h=3+rand()*4.4,y=distantValleyHeight(x,z),spread=h*(.31+rand()*.10);
    obj.position.set(x,y+h*.25,z);obj.scale.set(h*.25,h*.52,h*.25);
    obj.rotation.set(0,rand()*Math.PI*2,0);obj.updateMatrix();
    trunk.setMatrixAt(count,obj.matrix);trunk.setColorAt(count,scenicColor('#82715b',x,z));
    for(let k=0;k<2;k++){
      obj.position.set(x+(k-.5)*spread*.65,y+h*(.68+k*.18),z+(k-.5)*spread*.38);
      obj.scale.set(spread*(1-k*.20),h*(.31-k*.035),spread*(.95-k*.14));
      obj.updateMatrix();crowns.setMatrixAt(count*2+k,obj.matrix);
      crowns.setColorAt(count*2+k,scenicColor(k?'#92ad69':'#66885a',x,z));
    }
    count++;
  }
  trunk.count=count;crowns.count=count*2;
  trunk.instanceMatrix.needsUpdate=crowns.instanceMatrix.needsUpdate=true;
  trunk.computeBoundingSphere();crowns.computeBoundingSphere();
  root.add(trunk,crowns);root.userData.trees=count;
  return root;
}
function hamlets():THREE.Group {
  const group=new THREE.Group(),obj=new THREE.Object3D();
  const count=DISTANT_VALLEY.houseCount;
  const walls=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),scenicMaterial(),count);
  // Extruded triangular gable, real 3D roofs rather than billboard silhouettes.
  const shape=new THREE.Shape();shape.moveTo(-.5,0);shape.lineTo(0,.48);shape.lineTo(.5,0);shape.closePath();
  const roofGeometry=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false});roofGeometry.translate(0,0,-.5);
  const roofs=new THREE.InstancedMesh(roofGeometry,scenicMaterial(),count);
  const clusters=[[-111,-98],[32,-115],[110,-30],[-124,43],[34,118],[113,101],[-104,121]];
  for(let i=0;i<count;i++){
    const [cx,cz]=clusters[Math.floor(i/2)],x=cx+(i%2)*9,z=cz+(i%2)*5;
    const y=distantValleyHeight(x,z),w=4+rand()*1.3,h=2.5+rand()*.5,l=4.6+rand()*1.4;
    const yaw=.2+rand()*.7;
    obj.position.set(x,y+h*.5,z);obj.scale.set(w,h,l);obj.rotation.set(0,yaw,0);obj.updateMatrix();
    walls.setMatrixAt(i,obj.matrix);walls.setColorAt(i,scenicColor('#e4d4ac',x,z));
    obj.position.set(x,y+h,z);obj.scale.set(w*1.13,2.8,l*1.15);obj.updateMatrix();
    roofs.setMatrixAt(i,obj.matrix);roofs.setColorAt(i,scenicColor('#aa684c',x,z));
  }
  walls.name='Distant village cream walls';roofs.name='Distant village terracotta roofs';
  walls.instanceMatrix.needsUpdate=roofs.instanceMatrix.needsUpdate=true;
  walls.computeBoundingSphere();roofs.computeBoundingSphere();
  group.add(walls,roofs);
  return group;
}

export function createDistantValley():THREE.Group{
  seed=20261124;
  const root=new THREE.Group();
  root.name='Distant Lembah Asri landscape 360';
  const woods=forest();
  root.add(terrainMesh(),riverExtension(),woods,hamlets());
  root.userData={style:DISTANT_VALLEY.style,scenicOnly:true,trees:woods.userData.trees,houses:DISTANT_VALLEY.houseCount};
  // No shadows, physics, camera blockers, or per-frame work for distant props.
  return root;
}
