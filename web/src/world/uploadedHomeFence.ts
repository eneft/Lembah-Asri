import { applyPaintedPigment } from './paintedPigment.ts';
import { makePaintedLeafAlbedo } from './homeArtPass.ts';
import { makeLowPolyGrassGeometry } from './lowPolyGrass.ts';
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
  const anchors=Array.from({length:count},(_,i)=>-length/2+(i*pitch+center.x-bounds.min.x)*scale);
  const outward=run.label.startsWith('South')||run.label.startsWith('West')?1:-1;
  runGroup.add(wood,createFenceVines(length,size.y*scale,size.z*scale,seed,anchors,outward));
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
      shader.vertexShader = 'varying vec3 vFencePoint;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvFencePoint = (instanceMatrix * vec4(position, 1.)).xyz;'
      );
      shader.fragmentShader = 'varying vec3 vFencePoint;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        vec3 p = vFencePoint;
        float value = dot(diffuseColor.rgb, vec3(.25,.60,.15));
        float cane = sin(p.x*17. + .36*sin(p.x*31.) + p.y*.24);
        float streak = .5 + .5*sin(p.x*51. + sin(p.y*2. + p.x*13.));
        float wear = .5 + .25*sin(p.x*3.7 + p.y*4.1) + .25*sin(p.x*6.3 - p.y*2.8);
        vec3 honey = vec3(1.05,.51,.115);
        vec3 olive = vec3(.62,.48,.105);
        vec3 glaze = mix(honey, olive, smoothstep(-.75,.92,cane)*.78);
        // The shaded atlas includes bright longitudinal bands. Roll them off in linear light.
        float shoulder = max(value - .12, 0.);
        float dryValue = min(value, .12) + shoulder / (1. + 3.8 * shoulder);
        float relief = mix(.69, .94, smoothstep(.06,.44,value));
        vec3 pigment = mix(diffuseColor.rgb / max(value, .001), glaze, .95);
        vec3 bamboo = pigment * dryValue * relief * (.92 + .08*streak);
        float flecks = .5 + .25*sin(p.x*35. + sin(p.y*13.)*2.) + .25*sin(p.y*39. - p.x*23.);
        float moss = smoothstep(.38,.77, wear*.76 + flecks*.24)
          * (1.-smoothstep(.08,.36 + wear*.56,p.y));
        diffuseColor.rgb = mix(bamboo, (.014 + dryValue)*vec3(.27,.36,.055), moss*.84);
      `);
    };
    material.customProgramCacheKey = () => 'dry-matte-bamboo-v5';
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
