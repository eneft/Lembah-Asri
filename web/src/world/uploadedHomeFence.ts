import { prepareSharedFence, createSharedFenceRun, SHARED_FENCE_REVISION } from './authoredFenceLayout.ts';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyPaintedPigment } from './paintedPigment.ts';
import { makePaintedLeafAlbedo } from './homeArtPass.ts';
import { makeLowPolyGrassGeometry } from './lowPolyGrass.ts';
import * as THREE from 'three';

export const UPLOADED_FENCE_URL = './models/environment/pagar_bambu_asri.glb';
// Preserve the authored XYZ proportions and the minimum 40 cm long-run depth.
// Lower prominence through the weathered pigment, not by shrinking the mesh.
export const FENCE_HEIGHT = 1.45;

type FenceRun = { label: string; center: [number, number, number]; half: [number, number, number] };

/**
 * Clip the left duplicated end post from the repeating module. Preserve
 * authored normals and UVs by interpolating at the cut, not remapping the atlas.
 */
export function trimFenceLeft(geometry: THREE.BufferGeometry, cutX: number) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = flat.getAttribute('position'), n = flat.getAttribute('normal'), uv = flat.getAttribute('uv');
  type Vertex = { p: THREE.Vector3; n: THREE.Vector3; uv: THREE.Vector2 };
  const read = (i: number): Vertex => ({
    p: new THREE.Vector3().fromBufferAttribute(p, i),
    n: new THREE.Vector3().fromBufferAttribute(n, i),
    uv: new THREE.Vector2(uv.getX(i), uv.getY(i))
  });
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [];
  const emit = (v: Vertex) => {
    positions.push(v.p.x,v.p.y,v.p.z); normals.push(v.n.x,v.n.y,v.n.z); uvs.push(v.uv.x,v.uv.y);
  };
  for (let i=0;i<p.count;i+=3) {
    const tri=[read(i),read(i+1),read(i+2)], clipped: Vertex[]=[];
    for(let j=0;j<3;j++){
      const a=tri[j], b=tri[(j+1)%3], ain=a.p.x>=cutX, bin=b.p.x>=cutX;
      if(ain)clipped.push(a);
      if(ain!==bin){
        const t=(cutX-a.p.x)/(b.p.x-a.p.x);
        clipped.push({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),uv:a.uv.clone().lerp(b.uv,t)});
      }
    }
    for(let j=1;j+1<clipped.length;j++){emit(clipped[0]);emit(clipped[j]);emit(clipped[j+1]);}
  }
  if(flat!==geometry)flat.dispose();
  const result=new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  result.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  result.computeBoundingBox();result.computeBoundingSphere();
  return result;
}

// Folded UV-painted leaves, not flat upright green silhouettes.
const vineLeafGeometry=new THREE.BufferGeometry();
vineLeafGeometry.setAttribute('position',new THREE.Float32BufferAttribute([
  0,0,0, -.052,.045,.008, -.059,.093,.016, -.029,.136,.008, 0,.163,-.008,
  .029,.136,.008, .059,.093,.016, .052,.045,.008, 0,.078,.031
],3));
vineLeafGeometry.setAttribute('uv',new THREE.Float32BufferAttribute([
  .5,0,.06,.28,0,.58,.25,.84,.5,1,.75,.84,1,.58,.94,.28,.5,.48
],2));
vineLeafGeometry.setIndex([0,1,8,1,2,8,2,3,8,3,4,8,4,5,8,5,6,8,6,7,8,7,0,8]);
vineLeafGeometry.computeVertexNormals();
const vineLeafMaterial=applyPaintedPigment(new THREE.MeshBasicMaterial({
  color:0xffffff,map:makePaintedLeafAlbedo(),side:THREE.DoubleSide,toneMapped:false
}));
const vineStemMaterial=applyPaintedPigment(new THREE.MeshBasicMaterial({color:'#777143',toneMapped:false}));
const vergeGeometry=makeLowPolyGrassGeometry();
const vergeMaterial=new THREE.MeshBasicMaterial({color:'#9cac60',vertexColors:true,side:THREE.DoubleSide,toneMapped:false});

/** Sparse climbing foliage follows the post and rails on both sides of the actual fence. */
export function createFenceVines(length:number,height:number,depth:number,seed:number,anchors:number[]=[],outward=1){
  const group=new THREE.Group();
  group.name='Climbing vines — painted 3D';
  const clusters=length<4?0:Math.max(1,Math.floor(length/6));
  const leaves:{position:THREE.Vector3;angle:number;size:number;color:THREE.Color;side:number;tilt:number;yaw?:number}[]=[];
  const verge:{x:number;z:number;scale:number;yaw:number}[]=[];
  let branches=0,state=seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const palette=['#849345','#98a752','#657d3c','#b1b66b','#7b9046'];
  const append=(pts:THREE.Vector3[],side:number,count:number,radius:number)=>{
    const curve=new THREE.CatmullRomCurve3(pts);
    const stem=new THREE.Mesh(new THREE.TubeGeometry(curve,12,radius,5,false),vineStemMaterial);
    stem.name='Climbing stem';group.add(stem);
    for(let j=0;j<count;j++){
      const t=.10+.88*j/Math.max(1,count-1);
      const position=curve.getPoint(t);
      position.z+=side*(.012+random()*.027);
      const tangent=curve.getTangent(t);
      const axis=Math.atan2(-tangent.x,tangent.y);
      const sign=j%2===0?1:-1;
      leaves.push({position,angle:axis+sign*(.65+random()*1.05),size:.76+random()*.80,
        color:new THREE.Color(palette[Math.floor(random()*palette.length)]),side,tilt:(random()-.5)*.75});
    }
  };
  for(let i=0;i<clusters;i++){
    const target=-length/2+(i+.5)*length/clusters+(random()-.5)*Math.min(.7,length/clusters*.2);
    const x=anchors.length?anchors.reduce((a,b)=>Math.abs(a-target)<Math.abs(b-target)?a:b):target;
    const side=i%3===2?-outward:outward;
    // Main stem hugs the thick post; side shoots bend back to rail surfaces.
    const z=side*(depth*.5+.012);
    const rise=height*(.79+random()*.12);
    const points=Array.from({length:7},(_,j)=>{
      const t=j/6;
      return new THREE.Vector3(x+Math.sin(t*8+i)*.08,.04+rise*t,z+side*Math.sin(t*7)*.025);
    });
    append(points,side,10,.009);
    for(let b=0;b<3;b++){
      const dir=b%2===0?1:-1;
      const y=height*[.23,.62,.77][b],reach=.34+random()*.38;
      const endX=THREE.MathUtils.clamp(x+dir*reach,-length/2+.12,length/2-.12);
      append([
        new THREE.Vector3(x,y,z),
        new THREE.Vector3(x+dir*.17,y+.05,z),
        new THREE.Vector3((x+endX)*.5,y+.025,z),
        new THREE.Vector3(endX,y+(b===2?-.13:.07),z)
      ],side,7+Math.floor(random()*4),.006);
      branches++;
    }
  }
  // Grass and spreading herbs grow in broken drifts on either face of the fence.
  for (const side of [-1, 1]) {
    for (let x = -length / 2 + .6; x < length / 2 - .55; x += .65 + random() * 1.5) {
      const spread = .16 + random() * .26;
      const tufts = 3 + Math.floor(random() * 6);
      for (let k = 0; k < tufts; k++) {
        verge.push({
          x: x + (random() - .5) * spread * 2,
          z: side * (depth / 2 + .03 + random() * spread),
          scale: .62 + random() * .90, yaw: random() * Math.PI * 2
        });
      }
      if (random() < .54) {
        const z = side * (depth / 2 + .12 + random() * .22);
        const phase = random() * Math.PI * 2;
        for (let k = 0; k < 7; k++) {
          const yaw = phase + k * 2.4;
          leaves.push({
            position: new THREE.Vector3(x + Math.sin(yaw) * .05, .065, z + Math.cos(yaw) * .05),
            angle: (random() - .5) * .5, size: 1.12 + random() * .96,
            color: new THREE.Color(palette[Math.floor(random() * palette.length)]),
            side, tilt: .48 + random() * .75, yaw
          });
        }
      }
    }
  }
  const marker=new THREE.Object3D();
  if(leaves.length){
    const mesh=new THREE.InstancedMesh(vineLeafGeometry,vineLeafMaterial,leaves.length);
    mesh.name='Climbing vine leaves';
    leaves.forEach((leaf,i)=>{
      marker.position.copy(leaf.position);
      marker.rotation.set(leaf.tilt,leaf.yaw ?? (leaf.side===1?0:Math.PI),leaf.angle*leaf.side,'YXZ');
      marker.scale.setScalar(leaf.size);marker.updateMatrix();
      mesh.setMatrixAt(i,marker.matrix);mesh.setColorAt(i,leaf.color);
    });
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);
  }
  if(verge.length){
    const mesh=new THREE.InstancedMesh(vergeGeometry,vergeMaterial,verge.length);
    mesh.name='Grass at climbing roots';
    verge.forEach((v,i)=>{
      marker.position.set(v.x,.075,v.z);marker.rotation.set(0,v.yaw,0);
      marker.scale.setScalar(v.scale);marker.updateMatrix();mesh.setMatrixAt(i,marker.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);
  }
  group.userData.clusters=clusters;group.userData.leafCount=leaves.length;
  group.userData.branches=branches;group.userData.rootGrass=verge.length;
  return group;
}

/** Fit a complete first module and left-trimmed repeats on a shared post pitch. */
export function createUploadedFenceRun(geometry: THREE.BufferGeometry, material: THREE.Material, run: FenceRun, repeated?:THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (![size.x,size.y,size.z].every(v=>Number.isFinite(v)&&v>.001))throw new Error('Invalid fence module bounds');
  const alongX=run.half[0]>run.half[2];
  const length=2*(alongX?run.half[0]:run.half[2]);
  // The authored end posts occupy the outer 10% of the mesh. Overlap the
  // post spacing by 14% so clipped rails reach the previous full post.
  const overlap=size.x*.14,pitch=size.x-overlap,cutX=bounds.min.x+size.x*.10;
  // Keep bamboo diameters, rail heights and spacing identical across the yard.
  // Anchor the last full end post, trimming only the surplus at the start.
  const scale = FENCE_HEIGHT / size.y;
  const count = 1 + Math.max(0, Math.ceil((length / scale - size.x) / pitch));
  const excess = Math.max(0, size.x + (count - 1) * pitch - length / scale);
  const start = -length / 2 - excess * scale;
  const firstGeometry = excess > 1e-6 ? trimFenceLeft(geometry, bounds.min.x + excess) : geometry;
  const runGroup=new THREE.Group();
  const wood=new THREE.Group();wood.name='Continuous authored bamboo';
  const make=(g:THREE.BufferGeometry,first:number,amount:number)=>{
    const mesh=new THREE.InstancedMesh(g,material,amount),marker=new THREE.Object3D();
    mesh.name=first===0?'Initial bamboo module':'Single-post repeating bamboo modules';
    for(let j=0;j<amount;j++){
      const i=first+j;
      marker.scale.setScalar(scale);
      marker.position.set(start+(i*pitch-bounds.min.x)*scale,-bounds.min.y*scale,-center.z*scale);
      marker.updateMatrix();mesh.setMatrixAt(j,marker.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
    mesh.castShadow=true;mesh.receiveShadow=true;wood.add(mesh);
  };
  make(firstGeometry,0,1);
  if(count>1)make(repeated??trimFenceLeft(geometry,cutX),1,count-1);
  runGroup.name=run.label+' — uploaded fence modules';
  runGroup.userData={sourceFile:'base_basic_shaded (1).glb',moduleCount:count,runLength:length,
    uniformScale:scale,moduleHeight:size.y*scale,moduleDepth:size.z*scale,sharedPostPitch:pitch*scale,
    trimmedLeft:cutX,overlap:overlap*scale,
    ...(geometry.userData.fenceSide ? {fenceSide:geometry.userData.fenceSide, bayGaps:geometry.userData.bayGaps, spacingRevision:geometry.userData.spacingRevision} : {})};
  const seed=run.label.split('').reduce((a,c)=>Math.imul(a,31)+c.charCodeAt(0),13);
  const anchors=Array.from({length:count},(_,i)=>start+(i*pitch+center.x-bounds.min.x)*scale)
    .filter(x => x >= -length/2);
  const outward=run.label.startsWith('South')||run.label.startsWith('West')?1:-1;
  runGroup.add(wood,createFenceVines(length,size.y*scale,size.z*scale,seed,anchors,outward));
  runGroup.position.set(run.center[0],0,run.center[2]);
  if(!alongX)runGroup.rotation.y=-Math.PI/2;
  return runGroup;
}

/** Repeat the complete authored scene along each existing fence collider. */
export async function loadUploadedHomeFence(root: THREE.Group, runs: FenceRun[]): Promise<boolean> {
  try {
    const old = root.children.filter(child => child.userData.bambooFence === true);
    if (!runs.length || old.length !== runs.length) throw new Error('Original fence layout mismatch');
    const { scene } = await new GLTFLoader().loadAsync(UPLOADED_FENCE_URL);
    const prepared=prepareSharedFence(scene);
    const replacement=new THREE.Group();
    replacement.name='Home fence — uploaded GLB';
    replacement.userData={sourceFile:UPLOADED_FENCE_URL,spacingRevision:SHARED_FENCE_REVISION,textureRevision:'original-authored-glb'};
    for(const run of runs)replacement.add(createSharedFenceRun(prepared,run));
    root.add(replacement);
    for(const child of old)root.remove(child);
    return true;
  } catch(error) {
    console.warn('[LembahAsri] Keeping existing bamboo fence fallback',error);
    return false;
  }
}
