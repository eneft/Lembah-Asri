import * as THREE from 'three';
import { CREEK, creekCenterX, creekWidth } from './creekCourse.ts';
import { getGardenExportBinding } from './gardenSurface.ts';

type Vertex = { x: number; z: number; values: number[] };
const step = .5;
const edge = (z: number, side: number) => creekCenterX(z) + side * (creekWidth(z) * .5 + .73);

// Clip in world XZ, interpolate all local vertex attributes, and preserve
// the exact terrain elevations and UVs. No custom shader required by editor.
function clip(poly: Vertex[], distance: (v: Vertex) => number): Vertex[] {
  const output: Vertex[] = [];
  for (let i=0;i<poly.length;i++) {
    const a=poly[i], b=poly[(i+1)%poly.length];
    const da=distance(a), db=distance(b);
    if (da>=0) output.push(a);
    if ((da>=0)!==(db>=0)) {
      const t=da/(da-db);
      output.push({x:THREE.MathUtils.lerp(a.x,b.x,t),z:THREE.MathUtils.lerp(a.z,b.z,t),
        values:a.values.map((v,j)=>THREE.MathUtils.lerp(v,b.values[j],t))});
    }
  }
  return output;
}

export function bakeCreekOpening(mesh: THREE.Mesh): THREE.BufferGeometry {
  const original=mesh.geometry;
  const attributes=Object.entries(original.attributes);
  const channels=attributes.map(([name,attr])=>({name,size:attr.itemSize,attr,values:[] as number[]}));
  const pos=original.getAttribute('position');
  const point=new THREE.Vector3();
  const vertices=Array.from({length:pos.count},(_,i)=>{
    point.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
    return {x:point.x,z:point.z,values:channels.flatMap(c=>Array.from({length:c.size},(_,k)=>c.attr.getComponent(i,k)))};
  });
  const index=original.getIndex();
  const count=index?.count??pos.count;
  const emit=(poly:Vertex[])=>{
    for(let i=1;i+1<poly.length;i++)for(const v of [poly[0],poly[i],poly[i+1]]){
      let offset=0;
      for(const c of channels){for(let j=0;j<c.size;j++)c.values.push(v.values[offset++]);}
    }
  };
  // Conservative limits covering all sampled banks, including the pools.
  let minBank=Infinity,maxBank=-Infinity;
  for(let z=CREEK.start;z<=CREEK.end;z+=step){
    minBank=Math.min(minBank,edge(z,-1)-step);
    maxBank=Math.max(maxBank,edge(z,1)+step);
  }
  for(let i=0;i+2<count;i+=3){
    const tri=[0,1,2].map(j=>vertices[index?index.getX(i+j):i+j]);
    const minX=Math.min(...tri.map(v=>v.x)),maxX=Math.max(...tri.map(v=>v.x));
    const minZ=Math.min(...tri.map(v=>v.z)),maxZ=Math.max(...tri.map(v=>v.z));
    if(maxX<minBank||minX>maxBank||maxZ<=CREEK.start||minZ>=CREEK.end){emit(tri);continue;}
    if(minZ<CREEK.start)emit(clip(tri,v=>CREEK.start-v.z));
    if(maxZ>CREEK.end)emit(clip(tri,v=>v.z-CREEK.end));
    const start=Math.max(CREEK.start,minZ), end=Math.min(CREEK.end,maxZ);
    for(let z=start;z<end;){
      const next=Math.min(end,z+step);
      const strip=clip(clip(tri,v=>v.z-z),v=>next-v.z);
      if(strip.length>=3){
        const west=edge(z,-1),east=edge(z,1);
        const westEnd=edge(next,-1),eastEnd=edge(next,1);
        emit(clip(strip,v=>THREE.MathUtils.lerp(west,westEnd,(v.z-z)/(next-z))-v.x));
        emit(clip(strip,v=>v.x-THREE.MathUtils.lerp(east,eastEnd,(v.z-z)/(next-z))));
      }
      z=next;
    }
  }
  const baked=new THREE.BufferGeometry();
  for(const c of channels)baked.setAttribute(c.name,new THREE.Float32BufferAttribute(c.values,c.size));
  baked.computeBoundingSphere();
  baked.userData={...original.userData,editorCreekOpening:true};
  return baked;
}

/** Recreate the visible garden pigment on the same sculpted terrain triangles.
 * The overlay is independent of runtime shader hooks and leaves grass intact. */
export function createEditorGarden(mesh: THREE.Mesh): THREE.Mesh | undefined {
  if(Array.isArray(mesh.material))return;
  const binding=getGardenExportBinding(mesh.material);
  const g=mesh.geometry;
  const paint=g.getAttribute('gardenPaint');
  if(!binding||!paint)return;
  const position=g.getAttribute('position'),normal=g.getAttribute('normal');
  const uv=new Float32Array(position.count*2), colors=new Float32Array(position.count*4);
  const {data,width,height}=binding.state.image;
  for(let i=0;i<position.count;i++){
    const u=paint.getX(i),v=paint.getY(i);
    uv.set([u,v],i*2);
    const x=THREE.MathUtils.clamp(Math.floor(u*width),0,width-1);
    const y=THREE.MathUtils.clamp(Math.floor(v*height),0,height-1);
    const p=(y*width+x)*4;
    const tilled=data[p]/255,wet=data[p+1]/255,groove=data[p+2]/255;
    const shade=normal?THREE.MathUtils.clamp(1-.4*normal.getX(i)+.23*normal.getY(i)+.56*(normal.getZ(i)-1),.77,1.14):1;
    colors.set([shade*(1-.22*tilled)*(1-.35*groove)*(1-.53*wet),
      shade*(1-.30*tilled)*(1-.35*groove)*(1-.50*wet),
      shade*(1-.36*tilled)*(1-.35*groove)*(1-.45*wet),
      THREE.MathUtils.clamp(paint.getZ(i),0,1)],i*4);
  }
  const index=g.getIndex(), indices:number[]=[];
  const count=index?.count??position.count;
  for(let i=0;i+2<count;i+=3){
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
    if(ids.some(id=>paint.getZ(id)>.001))indices.push(...ids);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',position.clone());
  if(normal)geometry.setAttribute('normal',normal.clone());
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,4));
  geometry.setIndex(indices);
  const material=new THREE.MeshBasicMaterial({map:binding.pigment.value,vertexColors:true,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1});
  const overlay=new THREE.Mesh(geometry,material);
  overlay.name='Bedengan kebun - editor baked soil';
  overlay.position.z=.008;
  overlay.renderOrder=Math.max(3,mesh.renderOrder+1);
  return overlay;
}
