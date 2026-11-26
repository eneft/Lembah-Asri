import * as THREE from 'three';

export const SHARED_FENCE_REVISION='authored-shared-posts-v1';
const HEIGHT=1.45;
type Run={label:string;center:[number,number,number];half:[number,number,number]};
type Island={indices:number[];min:THREE.Vector3;max:THREE.Vector3;center:THREE.Vector3};
type Part={mesh:THREE.Mesh;geometry:THREE.BufferGeometry;islands:Island[]};

// Weld only for connectivity analysis. The original buffer attributes,
// normals, UV seams and triangles are NEVER welded or changed.
export function fenceIslands(g:THREE.BufferGeometry):Island[]{
  const p=g.getAttribute('position'),idx=g.index;
  const parent=Array.from({length:p.count},(_,i)=>i),keys=new Map<string,number>();
  const root=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const join=(a:number,b:number)=>{parent[root(a)]=root(b);};
  for(let i=0;i<p.count;i++){
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
    const prev=keys.get(key);if(prev!==undefined)join(prev,i);else keys.set(key,i);
  }
  const at=(i:number)=>idx?idx.getX(i):i;
  const n=idx?.count??p.count;
  for(let i=0;i<n;i+=3){join(at(i),at(i+1));join(at(i),at(i+2));}
  const found=new Map<number,Island>(),v=new THREE.Vector3();
  for(let i=0;i<n;i+=3){
    const id=root(at(i));
    let island=found.get(id);
    if(!island){island={indices:[],min:new THREE.Vector3(Infinity,Infinity,Infinity),max:new THREE.Vector3(-Infinity,-Infinity,-Infinity),center:new THREE.Vector3()};found.set(id,island);}
    for(let k=0;k<3;k++){const j=at(i+k);island.indices.push(j);v.fromBufferAttribute(p,j);island.min.min(v);island.max.max(v);}
  }
  for(const a of found.values())a.center.copy(a.min).add(a.max).multiplyScalar(.5);
  return [...found.values()];
}

// Subset complete disconnected authored parts, keeping all attribute data.
export function keepFenceIslands(g:THREE.BufferGeometry,parts:Island[]){
  const result=g.clone();
  result.setIndex(parts.flatMap(a=>a.indices));
  result.computeBoundingBox();result.computeBoundingSphere();
  return result;
}

export function prepareSharedFence(source:THREE.Group){
  source.updateMatrixWorld(true);
  const parts:Part[]=[];
  source.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    const g=o.geometry.clone().applyMatrix4(o.matrixWorld);
    parts.push({mesh:o,geometry:g,islands:fenceIslands(g)});
  });
  const bamboo=parts.find(p=>p.mesh.name==='01_Bambu');
  if(!bamboo)throw Error('Missing original bamboo');
  const posts=bamboo.islands.filter(p=>p.max.y-p.min.y>.35&&p.max.x-p.min.x>.065&&p.max.x-p.min.x<.13).sort((a,b)=>a.center.x-b.center.x);
  if(posts.length!==3)throw Error('Expected three independent original posts, got '+posts.length);
  const left=posts[0],right=posts[2];
  // Align the slightly skewed authored panel along its actual end-post
  // axis rather than the bounding box. Same rigid rotation for all meshes.
  const yaw=Math.atan2(right.center.z-left.center.z,right.center.x-left.center.x);
  const align=new THREE.Matrix4().makeRotationY(yaw);
  const lc=left.center.clone().applyMatrix4(align),rc=right.center.clone().applyMatrix4(align);
  const pitch=rc.x-lc.x;
  const mid=lc.clone().add(rc).multiplyScalar(.5);
  const firstRadius=(left.max.x-left.min.x)/2,lastRadius=(right.max.x-right.min.x)/2;
  const cap=firstRadius+lastRadius;
  const scale=HEIGHT/Math.max(...posts.map(p=>p.max.y-p.min.y));
  const batches=parts.map(part=>{
    // Remove ONLY the entire left support from repeating modules.
    // Bindings at that same support and its local foliage are likewise
    // omitted by complete connected component. Never slice a cane or UV.
    const nearLeft=(p:Island)=>p.center.x<left.max.x+.012;
    const repeatParts=part.islands.filter(p=>part===bamboo?p!==left:!nearLeft(p));
    const full=part.geometry.clone().applyMatrix4(align);
    const repeat=keepFenceIslands(part.geometry,repeatParts).applyMatrix4(align);
    return {name:part.mesh.name,material:part.mesh.material,full,repeat,removed:part.islands.length-repeatParts.length};
  });
  return {batches,pitch,cap,scale,mid,firstRadius,lastRadius};
}
export function createSharedFenceRun(source:ReturnType<typeof prepareSharedFence>,run:Run){
  const alongX=run.half[0]>run.half[2],length=2*Math.max(run.half[0],run.half[2]);
  const {pitch,cap,scale,mid,firstRadius}=source;
  const count=Math.max(1,Math.round((length/scale-cap)/pitch));
  // All panels and all runs retain one common height and depth. Fit only
  // the horizontal span, as the previous production placement already did.
  const sx=length/(count*pitch+cap);
  const start=-length/2+firstRadius*sx;
  const group=new THREE.Group();group.name=run.label;
  group.position.set(run.center[0],0,run.center[2]);
  group.rotation.y=alongX?(run.label.startsWith('North')?Math.PI:0):(run.label.startsWith('West')?-Math.PI/2:Math.PI/2);
  const make=(name:string,g:THREE.BufferGeometry,mat:THREE.Material|THREE.Material[],first:number,n:number)=>{
    const batch=new THREE.InstancedMesh(g,mat,n);batch.name=name;
    batch.castShadow=batch.receiveShadow=true;
    const transform=new THREE.Matrix4();
    for(let j=0;j<n;j++){
      const i=first+j;
      transform.makeScale(sx,scale,scale);
      transform.setPosition(start+(i+.5)*pitch*sx-mid.x*sx,0,-mid.z*scale);
      batch.setMatrixAt(j,transform);
    }
    batch.instanceMatrix.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();group.add(batch);
  };
  for(const p of source.batches){
    make(p.name,p.full,p.material,0,1);
    if(count>1)make(p.name+' — shared post repeat',p.repeat,p.material,1,count-1);
  }
  group.userData={spacingRevision:SHARED_FENCE_REVISION,sourceFile:'pagar_bambu_asri.glb',moduleCount:count,runLength:length,sharedPitch:pitch*sx,
    moduleHeight:HEIGHT,postCount:2*count+1,commonHeightScale:scale,horizontalScale:sx,originalUV:true};
  return group;
}
