import * as THREE from 'three';

export type FenceSide = 'front' | 'side' | 'rear';
export const FENCE_GAP = Object.freeze({
  front: {min:.22,max:.27,target:.24},
  side: {min:.20,max:.25,target:.225},
  rear: {min:.19,max:.23,target:.21}
});
export function fenceSide(label:string):FenceSide {
  return label.startsWith('South')?'front':label.startsWith('North')?'rear':'side';
}
type Span = {lo:number;hi:number};
type Vertex = {p:THREE.Vector3;n:THREE.Vector3;uv:THREE.Vector2};

export function distributeFenceCanes(lo:number,hi:number,width:number,target:number) {
  const available=hi-lo;
  const count=Math.max(0,Math.round((available-target)/(width+target)));
  if(!count)return {centers:[] as number[],gap:available};
  const gap=(available-count*width)/(count+1);
  if(gap<=0)throw new Error('Invalid cane spacing');
  return {centers:Array.from({length:count},(_,i)=>lo+gap+width/2+i*(gap+width)),gap};
}

// This GLB is a fused single mesh, not an assembly of editable cane nodes.
// Keep its actual UV-painted supports and rails in place. Partition its
// triangular surfaces; transplant two representative original cane strips
// into evenly spaced open bays, without scaling their X diameter or UVs.
export function createOpenFenceModule(source:THREE.BufferGeometry,side:FenceSide,height=1.45) {
  source.computeBoundingBox();
  const bounds=source.boundingBox!, size=bounds.getSize(new THREE.Vector3());
  if(![size.x,size.y,size.z].every(v=>Number.isFinite(v)&&v>0))throw new Error('Invalid fence source');
  const scale=height/size.y;
  const x=(t:number)=>bounds.min.x+size.x*t;
  const y=(t:number)=>bounds.min.y+size.y*t;
  // Measured against the supplied GLB: end and middle support columns,
  // two horizontal rail/tie bands, and two original slender cane samples.
  const supports:Span[]=[{lo:x(0),hi:x(.105)},{lo:x(.424),hi:x(.544)},{lo:x(.895),hi:x(1)}];
  const rails:Span[]=[{lo:y(.145),hi:y(.245)},{lo:y(.610),hi:y(.714)}];
  const openY:Span[]=[
    {lo:bounds.min.y,hi:rails[0].lo},
    {lo:rails[0].hi,hi:rails[1].lo},
    {lo:rails[1].hi,hi:bounds.max.y}
  ];
  // Mobile oblique camera needs more sky-through openings than the first
  // revision. Keep three original cane strips per bay, not a bamboo wall.
  const nominalWidth=side==='front'?.10:side==='side'?.12:.14;
  const caneWidth=nominalWidth/scale;
  const sourceCenters=[x(.580),x(.810)];
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[];
  const pos=source.getAttribute('position'),nor=source.getAttribute('normal'),uv=source.getAttribute('uv');
  const index=source.getIndex();
  if(!pos||!nor||!uv)throw new Error('Original fence requires position, normal and UV');
  const vertex=(i:number):Vertex=>({p:new THREE.Vector3().fromBufferAttribute(pos,i),
    n:new THREE.Vector3().fromBufferAttribute(nor,i),uv:new THREE.Vector2(uv.getX(i),uv.getY(i))});
  const triangles:Vertex[][]=[];
  for(let i=0;i<(index?.count??pos.count);i+=3){
    triangles.push([0,1,2].map(j=>vertex(index?index.getX(i+j):i+j)));
  }
  const clip=(poly:Vertex[],axis:'x'|'y',cut:number,keepAbove:boolean)=>{
    const result:Vertex[]=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      const ain=keepAbove?a.p[axis]>=cut:a.p[axis]<=cut;
      const bin=keepAbove?b.p[axis]>=cut:b.p[axis]<=cut;
      if(ain)result.push(a);
      if(ain!==bin){
        const t=(cut-a.p[axis])/(b.p[axis]-a.p[axis]);
        result.push({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),uv:a.uv.clone().lerp(b.uv,t)});
      }
    }
    return result;
  };
  const emit=(v:Vertex,dx:number)=>{
    positions.push(v.p.x+dx,v.p.y,v.p.z);normals.push(v.n.x,v.n.y,v.n.z);uvs.push(v.uv.x,v.uv.y);
  };
  const piece=(xs:Span,ys:Span)=>{
    const polygons:Vertex[][]=[];
    for(const tri of triangles){
      if(tri.every(v=>v.p.x<xs.lo)||tri.every(v=>v.p.x>xs.hi)||
        tri.every(v=>v.p.y<ys.lo)||tri.every(v=>v.p.y>ys.hi))continue;
      let p=clip(tri,'x',xs.lo,true);p=clip(p,'x',xs.hi,false);
      p=clip(p,'y',ys.lo,true);p=clip(p,'y',ys.hi,false);
      if(p.length>=3)polygons.push(p);
    }
    return polygons;
  };
  // Seal closed intersections on the newly cut planes using the edge's
  // actual atlas UVs. Original source surface normals/UVs remain untouched.
  // The source is not a watertight CAD mesh; only closed loops are capped.
  let closedCuts=0,openCuts=0;
  const capCut=(polygons:Vertex[][],axis:'x'|'y',at:number,sign:number,dx:number)=>{
    const eps=1e-5;
    const key=(v:Vertex)=>v.p.toArray().map(n=>Math.round(n/eps)).join(',');
    const verts=new Map<string,Vertex>();
    const edges=new Map<string,[string,string]>();
    for(const p of polygons)for(let i=0;i<p.length;i++){
      const a=p[i],b=p[(i+1)%p.length];
      if(Math.abs(a.p[axis]-at)>eps||Math.abs(b.p[axis]-at)>eps)continue;
      const ak=key(a),bk=key(b);
      if(ak===bk)continue;
      const ek=ak<bk?ak+'|'+bk:bk+'|'+ak;
      if(edges.has(ek))edges.delete(ek);
      else{edges.set(ek,[ak,bk]);verts.set(ak,a);verts.set(bk,b);}
    }
    const adjacent=new Map<string,string[]>();
    for(const [a,b] of edges.values()){
      adjacent.set(a,[...(adjacent.get(a)??[]),b]);
      adjacent.set(b,[...(adjacent.get(b)??[]),a]);
    }
    const visited=new Set<string>();
    for(const first of adjacent.keys()){
      if(visited.has(first))continue;
      const component:string[]=[],todo=[first];
      while(todo.length){
        const k=todo.pop()!;
        if(visited.has(k))continue;
        visited.add(k);component.push(k);
        for(const a of adjacent.get(k)??[])if(!visited.has(a))todo.push(a);
      }
      if(component.length<3||component.some(k=>adjacent.get(k)!.length!==2)){openCuts++;continue;}
      const loop=[first];
      let prev=first,next=adjacent.get(first)![0];
      while(next!==first&&loop.length<component.length){
        loop.push(next);
        const n=adjacent.get(next)!.find(k=>k!==prev)!;
        prev=next;next=n;
      }
      if(next!==first||loop.length!==component.length){openCuts++;continue;}
      const v=loop.map(k=>verts.get(k)!);
      const contour=v.map(a=>axis==='x'?new THREE.Vector2(a.p.y,a.p.z):new THREE.Vector2(a.p.x,a.p.z));
      const normal=new THREE.Vector3();normal[axis]=sign;
      const faces=THREE.ShapeUtils.triangulateShape(contour,[]);
      if(!faces.length){openCuts++;continue;}
      closedCuts++;
      for(const face of faces){
        const a=v[face[0]],b=v[face[1]],c=v[face[2]];
        if(b.p.clone().sub(a.p).cross(c.p.clone().sub(a.p)).dot(normal)<0){
          emit({...a,n:normal},dx);emit({...c,n:normal},dx);emit({...b,n:normal},dx);
        }else{emit({...a,n:normal},dx);emit({...b,n:normal},dx);emit({...c,n:normal},dx);}
      }
    }
  };
  const emitPiece=(polygons:Vertex[][],dx=0)=>{
    for(const p of polygons)for(let j=1;j+1<p.length;j++){
      const a=p[0],b=p[j],c=p[j+1];
      if(b.p.clone().sub(a.p).cross(c.p.clone().sub(a.p)).lengthSq()<1e-16)continue;
      emit(a,dx);emit(b,dx);emit(c,dx);
    }
  };
  // Continuous authored rails, untouched thick supports and lashings.
  for(const r of rails){
    const p=piece({lo:bounds.min.x,hi:bounds.max.x},r);
    emitPiece(p);capCut(p,'y',r.lo,-1,0);capCut(p,'y',r.hi,1,0);
  }
  for(const s of supports)for(const band of openY){
    const p=piece(s,band);
    emitPiece(p);
    if(s.lo>bounds.min.x+1e-5)capCut(p,'x',s.lo,-1,0);
    if(s.hi<bounds.max.x-1e-5)capCut(p,'x',s.hi,1,0);
  }
  // The rail bands cover the cross joints; only the spaces between rails
  // receive the new, separate vertical cane placements.
  const samplePieces=sourceCenters.map(center=>openY.flatMap(band=>
    piece({lo:center-caneWidth/2,hi:center+caneWidth/2},band)));
  const gaps:number[]=[],centers:number[]=[];
  for(let bay=0;bay<supports.length-1;bay++){
    const lo=supports[bay].hi,hi=supports[bay+1].lo;
    const layout=distributeFenceCanes(lo,hi,caneWidth,FENCE_GAP[side].target/scale);
    gaps.push(layout.gap*scale);
    layout.centers.forEach((center,i)=>{
      const sample=(i+bay)%sourceCenters.length;
      const dx=center-sourceCenters[sample],p=samplePieces[sample];
      emitPiece(p,dx);
      capCut(p,'x',sourceCenters[sample]-caneWidth/2,-1,dx);
      capCut(p,'x',sourceCenters[sample]+caneWidth/2,1,dx);
      centers.push(center*scale);
    });
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={fenceSide:side,nominalCaneWidth:nominalWidth,bayGaps:gaps,caneCenters:centers,
    closedCuts,openCuts,spacingRevision:'visible-gap-v2',originalUV:true,sourceMesh:'home-fence-module.glb'};
  return geometry;
}
