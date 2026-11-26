import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const AUTHORED_FENCE_URL='./models/environment/pagar_bambu_asri.glb?v=1';
export const AUTHORED_FENCE_REVISION='authored-tripo-fence-v1';
export const AUTHORED_FENCE_HEIGHT=1.45;
export const AUTHORED_FENCE_SHA256='b0bc695991aa9889876c72d57dc9e1cf2dac88da596d0a7666565e55e3ffd09a';
type Run={label:string;center:[number,number,number];half:[number,number,number]};

/** Keep each authored mesh, embedded texture, UV, normal and material intact.
 * Only place whole modules. Never cut, flatten, stretch or recolor them. */
export function createAuthoredFenceRun(source:THREE.Group,run:Run){
  source.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source);
  const bamboo=source.getObjectByName('01_Bambu');
  if(!bamboo)throw Error('Missing original bamboo mesh');
  const woodBounds=new THREE.Box3().setFromObject(bamboo);
  const woodSize=woodBounds.getSize(new THREE.Vector3());
  const center=woodBounds.getCenter(new THREE.Vector3());
  const scale=AUTHORED_FENCE_HEIGHT/woodSize.y;
  if(!Number.isFinite(scale)||scale<=0||woodSize.x<=0)throw Error('Invalid authored fence bounds');
  const alongX=run.half[0]>run.half[2],length=2*(alongX?run.half[0]:run.half[2]);
  if(!Number.isFinite(length)||length<.6)throw Error('Invalid fence run');
  const moduleWidth=woodSize.x*scale;
  // Full-module repetition with a small shared-end spacing adjustment.
  // For short runs only, shrink the WHOLE module uniformly, never an axis.
  const count=Math.max(1,Math.ceil(length/moduleWidth));
  const unitScale=Math.min(scale,length/(count*woodSize.x));
  const actualWidth=woodSize.x*unitScale;
  const pitch=count>1?(length-actualWidth)/(count-1):0;
  const group=new THREE.Group();
  group.name=run.label+' — authored bamboo GLB';
  group.position.set(run.center[0],0,run.center[2]);
  if(!alongX)group.rotation.y=-Math.PI/2;
  const wood=new THREE.Group();
  wood.name='Original bamboo fence modules';
  // Instance each of the four actual mesh/material pairs. No regenerated
  // geometry; the source local matrix (including node translation) is used.
  const inverse=source.matrixWorld.clone().invert();
  source.traverse(obj=>{
    if(!(obj instanceof THREE.Mesh))return;
    const local=inverse.clone().multiply(obj.matrixWorld);
    const mesh=new THREE.InstancedMesh(obj.geometry,obj.material,count);
    mesh.name=obj.name;
    mesh.castShadow=true;mesh.receiveShadow=true;
    const dummy=new THREE.Object3D();
    for(let i=0;i<count;i++){
      const x=count===1?0:-length/2+actualWidth/2+i*pitch;
      dummy.position.set(x-center.x*unitScale,-bounds.min.y*unitScale,-center.z*unitScale);
      dummy.scale.setScalar(unitScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix.clone().multiply(local));
    }
    mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();
    wood.add(mesh);
  });
  group.add(wood);
  group.userData={spacingRevision:AUTHORED_FENCE_REVISION,textureRevision:AUTHORED_FENCE_REVISION,
    sourceFile:'pagar_bambu_asri.glb',moduleCount:count,runLength:length,
    uniformScale:unitScale,moduleHeight:woodSize.y*unitScale,moduleDepth:woodSize.z*unitScale,
    originalMaterials:true,originalGeometry:true,sourceSHA256:AUTHORED_FENCE_SHA256};
  return group;
}

export async function loadAuthoredBambooFence(root:THREE.Group,runs:Run[]):Promise<boolean>{
  const {scene}=await new GLTFLoader().loadAsync(AUTHORED_FENCE_URL);
  const names=['01_Bambu','02_Ikatan_bambu','03_Sulur_dan_daun','04_Rumput_batu_bunga'];
  for(const name of names){
    const o=scene.getObjectByName(name);
    if(!(o instanceof THREE.Mesh)||!o.geometry.getAttribute('uv')||
      !(o.material instanceof THREE.MeshStandardMaterial)||!o.material.map)
      throw Error('Missing original mesh/UV/material: '+name);
  }
  const old=root.children.filter(o=>o.userData.bambooFence===true);
  if(!runs.length||old.length!==runs.length)throw Error('Original fence layout mismatch');
  const replacement=new THREE.Group();
  replacement.name='Home fence — uploaded GLB';
  replacement.userData={spacingRevision:AUTHORED_FENCE_REVISION,textureRevision:AUTHORED_FENCE_REVISION,
    sourceFile:'pagar_bambu_asri.glb',originalGeometry:true,originalMaterials:true};
  for(const run of runs)replacement.add(createAuthoredFenceRun(scene,run));
  root.add(replacement);
  for(const o of old)root.remove(o);
  return true;
}
