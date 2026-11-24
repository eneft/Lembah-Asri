import * as THREE from 'three';

/** Waterline segments from the actual transformed triangle mesh, not its bounding box. */
type Point={x:number;z:number};
type Segment=[Point,Point];
export function waterlineSegments(geometry:THREE.BufferGeometry,matrix:THREE.Matrix4,y:number):Segment[]{
  const position=geometry.getAttribute('position'),index=geometry.getIndex();
  const vertices=Array.from({length:position.count},(_,i)=>
    new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(matrix));
  const result:Segment[]=[];
  const count=index?index.count:position.count;
  for(let i=0;i+2<count;i+=3){
    const tri=[0,1,2].map(j=>vertices[index?index.getX(i+j):i+j]);
    const hits:Point[]=[];
    for(let k=0;k<3;k++){
      const a=tri[k],b=tri[(k+1)%3],da=a.y-y,db=b.y-y;
      if((da<0)===(db<0)||Math.abs(da-db)<1e-10)continue;
      const t=da/(da-db);
      hits.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
    }
    if(hits.length===2&&Math.hypot(hits[0].x-hits[1].x,hits[0].z-hits[1].z)>1e-7)
      result.push([hits[0],hits[1]]);
  }
  return result;
}
const cross=(ax:number,az:number,bx:number,bz:number)=>ax*bz-az*bx;

/** A single batched draw: broken, narrow contact rims and two fading downstream
 * strokes. No white discs, no foam on stones entirely above/below water. */
export function buildContactFoam(rocks:THREE.InstancedMesh,waterY:number):THREE.Mesh{
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const matrix=new THREE.Matrix4();
  let contacts=0;
  function strip(rows:{point:Point;nx:number;nz:number;width:number;alpha:number}[]){
    const start=positions.length/3;
    for(const row of rows){
      for(const edge of [-1,0,1]){
        positions.push(row.point.x+edge*row.nx*row.width,waterY+.006,row.point.z+edge*row.nz*row.width);
        colors.push(.94,.98,.91,edge===0?row.alpha:0);
      }
    }
    for(let i=1;i<rows.length;i++){
      const a=start+(i-1)*3,b=a+3;
      indices.push(a,b,a+1,a+1,b,b+1,a+1,b+1,a+2,a+2,b+1,b+2);
    }
  }
  for(let i=0;i<rocks.count;i++){
    rocks.getMatrixAt(i,matrix);
    const segments=waterlineSegments(rocks.geometry,matrix,waterY);
    if(segments.length<3)continue;
    const points=segments.flat();
    const cx=(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2;
    const cz=(Math.min(...points.map(p=>p.z))+Math.max(...points.map(p=>p.z)))/2;
    const radial:{point:Point;nx:number;nz:number;width:number;alpha:number}[]=[];
    for(let j=0;j<=64;j++){
      const theta=j*Math.PI*2/64,dx=Math.cos(theta),dz=Math.sin(theta);
      let distance=-1;
      for(const [a,b] of segments){
        const ex=b.x-a.x,ez=b.z-a.z,den=cross(dx,dz,ex,ez);
        if(Math.abs(den)<1e-9)continue;
        const ax=a.x-cx,az=a.z-cz;
        const t=cross(ax,az,ex,ez)/den,u=cross(ax,az,dx,dz)/den;
        if(t>=0&&u>=-1e-6&&u<=1+1e-6)distance=Math.max(distance,t);
      }
      if(distance<0)continue;
      // Stronger on the upstream face; irregular white paint breaks on both flanks.
      const upstream=1-THREE.MathUtils.smoothstep(dz,-.35,.85);
      const breakup=THREE.MathUtils.smoothstep(Math.sin(theta*5+i*.83)+.35*Math.sin(theta*11),-.72,.32);
      const width=.022+.016*upstream;
      radial.push({point:{x:cx+dx*(distance+width*.75),z:cz+dz*(distance+width*.75)},
        nx:dx,nz:dz,width,alpha:(.23+.71*upstream)*breakup});
    }
    if(radial.length<48)continue;
    contacts++;
    strip(radial);
    // Follow the +Z current on each side rather than paint through the rock.
    for(const side of [-1,1]){
      const flank=points.reduce((a,b)=>side*b.x>side*a.x?b:a);
      const span=Math.max(.18,Math.abs(flank.x-cx));
      const trail=[];
      for(let j=0;j<=14;j++){
        const t=j/14;
        trail.push({point:{x:flank.x+side*(.034+span*.23*Math.sin(t*Math.PI*.8)),z:flank.z+t*(span*1.5+.23)},
          nx:1,nz:0,width:.019*(1-.60*t),alpha:.63*(1-t)*(.78+.22*Math.sin(t*16+i))});
      }
      strip(trail);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  const material=new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true,
    transparent:true,opacity:.76,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='Painted foam breaking against mossy river boulders';
  mesh.renderOrder=6;
  mesh.userData.waterlineContacts=contacts;
  mesh.userData.contactFoamStyle='actual-glb-waterline-split-current-v1';
  return mesh;
}
