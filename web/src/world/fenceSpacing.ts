import * as THREE from 'three';

export type FenceSide = 'front' | 'side' | 'rear';
export const FENCE_GAP = Object.freeze({
  front: {min:.12,max:.15,target:.135},
  side: {min:.09,max:.12,target:.105},
  rear: {min:.06,max:.09,target:.075}
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
  const rails:Span[]=[{lo:y(.13),hi:y(.27)},{lo:y(.592),hi:y(.754)}];
  const openY:Span[]=[
    {lo:bounds.min.y,hi:rails[0].lo},
    {lo:rails[0].hi,hi:rails[1].lo},
    {lo:rails[1].hi,hi:bounds.max.y}
  ];
  const caneWidth=.13/scale;
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
  const emitPiece=(polygons:Vertex[][],dx=0)=>{
    for(const p of polygons)for(let j=1;j+1<p.length;j++){
      const a=p[0],b=p[j],c=p[j+1];
      if(b.p.clone().sub(a.p).cross(c.p.clone().sub(a.p)).lengthSq()<1e-16)continue;
      emit(a,dx);emit(b,dx);emit(c,dx);
    }
  };
  // Continuous authored rails, untouched thick supports and lashings.
  for(const r of rails)emitPiece(piece({lo:bounds.min.x,hi:bounds.max.x},r));
  for(const s of supports)for(const band of openY)emitPiece(piece(s,band));
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
      emitPiece(samplePieces[sample],center-sourceCenters[sample]);
      centers.push(center*scale);
    });
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={fenceSide:side,nominalCaneWidth:.13,bayGaps:gaps,caneCenters:centers,
    originalUV:true,sourceMesh:'home-fence-module.glb'};
  return geometry;
}
