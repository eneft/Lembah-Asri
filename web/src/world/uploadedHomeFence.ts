import { applyPaintedPigment } from './paintedPigment.ts';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const UPLOADED_FENCE_URL = './models/environment/home-fence-module.glb?v=1';
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

// Real, softly folded leaves with a ridge and painted color variation.
const vineLeafGeometry = new THREE.BufferGeometry();
vineLeafGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
  0,0,0, -.055,.065,.012, -.042,.135,.008, 0,.19,0,
  .042,.135,.008, .055,.065,.012, 0,.087,.028
],3));
vineLeafGeometry.setIndex([0,1,6,1,2,6,2,3,6,3,4,6,4,5,6,5,0,6]);
vineLeafGeometry.computeVertexNormals();
const vineLeafMaterial=applyPaintedPigment(new THREE.MeshLambertMaterial({
  color:0xffffff, side:THREE.DoubleSide
}));
const vineStemMaterial=applyPaintedPigment(new THREE.MeshLambertMaterial({color:'#59633a'}));

/** Sparse, deterministic climbing plants anchored on the fence surface. */
export function createFenceVines(length:number, height:number, depth:number, seed:number){
  const group=new THREE.Group();
  group.name='Climbing vines — painted 3D';
  const clusters=length<4?0:Math.max(1,Math.floor(length/6));
  const leaves:{position:THREE.Vector3;angle:number;size:number;color:THREE.Color;side:number}[]=[];
  let state=seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const palette=['#657839','#748b46','#496434','#87944c','#5b753f'];
  for(let i=0;i<clusters;i++){
    const x=-length/2+(i+.5)*length/clusters+(random()-.5)*Math.min(1.25,length/clusters*.3);
    const side=seed%2===0?1:-1;
    const z=side*(depth*.5+.012);
    const rise=height*(.50+random()*.37);
    const drift=(random()-.5)*.75;
    const pts=Array.from({length:7},(_,j)=>{
      const t=j/6;
      return new THREE.Vector3(x+drift*t+Math.sin(t*7+i)*.115, .035+rise*t,z+side*Math.sin(t*5)*.018);
    });
    const curve=new THREE.CatmullRomCurve3(pts);
    const stem=new THREE.Mesh(new THREE.TubeGeometry(curve,18,.012,5,false),vineStemMaterial);
    stem.name='Climbing stem';group.add(stem);
    const leafCount=12+Math.floor(random()*5);
    for(let j=0;j<leafCount;j++){
      const t=.12+.85*j/(leafCount-1);
      const position=curve.getPoint(t);
      position.z+=side*.025;
      const sign=j%2===0?1:-1;
      leaves.push({position,angle:sign*(.48+random()*.94),size:.64+random()*.55,
        color:new THREE.Color(palette[Math.floor(random()*palette.length)]),side});
    }
  }
  if(leaves.length){
    const mesh=new THREE.InstancedMesh(vineLeafGeometry,vineLeafMaterial,leaves.length);
    mesh.name='Climbing vine leaves';const marker=new THREE.Object3D();
    leaves.forEach((leaf,i)=>{
      marker.position.copy(leaf.position);
      marker.rotation.set(.22*leaf.side,leaf.side===1?0:Math.PI,leaf.angle);
      marker.scale.setScalar(leaf.size);marker.updateMatrix();
      mesh.setMatrixAt(i,marker.matrix);mesh.setColorAt(i,leaf.color);
    });
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.receiveShadow=true;group.add(mesh);
  }
  group.userData.clusters=clusters;group.userData.leafCount=leaves.length;
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
  const idealCount=(length*size.y/FENCE_HEIGHT-overlap)/pitch;
  const candidates=[Math.max(1,Math.floor(idealCount)),Math.max(1,Math.ceil(idealCount))];
  const fit=(count:number)=>length/(size.x+(count-1)*pitch);
  const heightError=(count:number)=>Math.abs(size.y*fit(count)-FENCE_HEIGHT);
  const eligible=candidates.filter(count=>length<19||size.z*fit(count)>.4);
  const count=(eligible.length?eligible:candidates).reduce((a,b)=>heightError(a)<=heightError(b)?a:b);
  const scale=fit(count);
  const runGroup=new THREE.Group();
  const wood=new THREE.Group();wood.name='Continuous authored bamboo';
  const make=(g:THREE.BufferGeometry,first:number,amount:number)=>{
    const mesh=new THREE.InstancedMesh(g,material,amount),marker=new THREE.Object3D();
    mesh.name=first===0?'Full initial bamboo module':'Single-post repeating bamboo modules';
    for(let j=0;j<amount;j++){
      const i=first+j;
      marker.scale.setScalar(scale);
      marker.position.set(-length/2+(i*pitch-bounds.min.x)*scale,-bounds.min.y*scale,-center.z*scale);
      marker.updateMatrix();mesh.setMatrixAt(j,marker.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
    mesh.castShadow=true;mesh.receiveShadow=true;wood.add(mesh);
  };
  make(geometry,0,1);
  if(count>1)make(repeated??trimFenceLeft(geometry,cutX),1,count-1);
  runGroup.name=run.label+' — uploaded fence modules';
  runGroup.userData={sourceFile:'base_basic_shaded (1).glb',moduleCount:count,runLength:length,
    uniformScale:scale,moduleHeight:size.y*scale,moduleDepth:size.z*scale,sharedPostPitch:pitch*scale,
    trimmedLeft:cutX,overlap:overlap*scale};
  const seed=run.label.split('').reduce((a,c)=>Math.imul(a,31)+c.charCodeAt(0),13);
  runGroup.add(wood,createFenceVines(length,size.y*scale,size.z*scale,seed));
  runGroup.position.set(run.center[0],0,run.center[2]);
  if(!alongX)runGroup.rotation.y=-Math.PI/2;
  return runGroup;
}

export async function loadUploadedHomeFence(root: THREE.Group, runs: FenceRun[]): Promise<boolean> {
  try {
    const { scene } = await new GLTFLoader().loadAsync(UPLOADED_FENCE_URL);
    scene.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    scene.traverse(obj => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
    if (meshes.length !== 1) throw new Error('Expected one authored fence mesh');
    const source = meshes[0];
    const original = source.material;
    if (!(original instanceof THREE.MeshStandardMaterial) || !original.emissiveMap) throw new Error('Missing authored shaded texture');
    const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
    // The GLB uses a baked emissive atlas. Use that same UV atlas as a matte
    // non-PBR surface, avoiding double lighting or darkening the original art.
    const map = original.emissiveMap;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    const material = applyPaintedPigment(new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, toneMapped: false }));
    const painted = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      painted.call(material, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        float bambooValue = dot(diffuseColor.rgb, vec3(.25,.60,.15));
        vec3 weathered = vec3(.073,.067,.044) + bambooValue * vec3(.51,.48,.36);
        diffuseColor.rgb = mix(diffuseColor.rgb, weathered, .78);
      `);
    };
    material.customProgramCacheKey = () => 'weathered-bamboo-pigment-v1';
    const replacement = new THREE.Group();
    replacement.name = 'Home fence — uploaded GLB';
    geometry.computeBoundingBox();
    const sourceBounds=geometry.boundingBox!;
    const repeated=trimFenceLeft(geometry,sourceBounds.min.x+(sourceBounds.max.x-sourceBounds.min.x)*.10);
    for (const run of runs) replacement.add(createUploadedFenceRun(geometry, material, run, repeated));
    if (replacement.children.length !== 6) throw new Error('Unexpected home fence layout');
    // Replace only the existing fence visuals; retain every original collider.
    const old = root.children.filter(child => child.userData.bambooFence === true);
    if (old.length !== runs.length) throw new Error('Original fence layout mismatch');
    root.add(replacement);
    for (const child of old) root.remove(child);
    return true;
  } catch (error) {
    console.warn('[LembahAsri] Keeping existing bamboo fence fallback', error);
    return false;
  }
}
