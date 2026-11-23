import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { BRIDGE_DECK, BRIDGE_WALK } from './paintedBridge.ts';

/** Original user-supplied wooden bridge, packaged with meshopt geometry and
 * WebP emissive atlas without reducing its authored 7,823 triangles.
 * Unlike the old 3D approximation, this is the user's actual GLB mesh.
 */
export const USER_BRIDGE = Object.freeze({
  asset: './models/environment/bridge_user_reference_wood_v1.glb',
  sourceTopOfDeck: .3175,
  verticalScale: 2.2,
  originalTriangles: 7823,
  sourceSHA256: '6448dde631fdee64a9f9fc19fdde1293f6acc8a9089fa9e62c7d701cd41b8ec2'
});

/** Size matches the existing physically traversable X crossing.
 * The authored deck height is aligned to BRIDGE_WALK.top, never just
 * visually raised over the existing Rapier collider.
 */
export function fitUserBridgeBounds(bounds:THREE.Box3){
  const size=bounds.getSize(new THREE.Vector3());
  if(size.x<.1||size.y<.1||size.z<.1||
    !Number.isFinite(size.x+size.y+size.z))
    throw new Error('Uploaded bridge GLB bounds are not valid');
  const center=bounds.getCenter(new THREE.Vector3());
  const sx=BRIDGE_DECK.length/size.x;
  const sz=BRIDGE_WALK.halfWidth*2/size.z;
  const sy=USER_BRIDGE.verticalScale;
  return {
    scale:new THREE.Vector3(sx,sy,sz),
    position:new THREE.Vector3(
      BRIDGE_DECK.x-center.x*sx,
      BRIDGE_WALK.top-USER_BRIDGE.sourceTopOfDeck*sy,
      BRIDGE_DECK.z-center.z*sz
    )
  };
}

/** Retain the fallback bridge until the genuine GLB has loaded in full.
 * Loading errors must never leave a hole over the river.
 */
export async function loadUserSuppliedWoodenBridge(root:THREE.Object3D):Promise<boolean>{
  const bridge=root.getObjectByName('West wooden bridge walkway');
  if(!(bridge instanceof THREE.Group))return false;
  try{
    const loader=new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf=await loader.loadAsync(USER_BRIDGE.asset);
    const model=gltf.scene;
    model.updateMatrixWorld(true);
    const fit=fitUserBridgeBounds(new THREE.Box3().setFromObject(model));
    model.scale.copy(fit.scale);
    model.position.copy(fit.position);
    model.name='Uploaded wooden bridge - original GLB';
    let meshes=0,triangles=0,baked=false;
    model.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      meshes++;
      triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;
      object.castShadow=true;
      object.receiveShadow=true;
      const mats=Array.isArray(object.material)?object.material:[object.material];
      for(const mat of mats){
        // The source uses emissive-textured hand-painted wood with baked
        // highlights/shadows. Do not reset its black diffuse base factor.
        if(mat instanceof THREE.MeshStandardMaterial){
          mat.metalness=0;
          mat.roughness=.94;
          baked ||= !!mat.emissiveMap;
        }
      }
    });
    if(meshes<1 || triangles<7000 || !baked)
      throw new Error('Uploaded GLB lost geometry or its baked wood texture');
    const bounds=new THREE.Box3().setFromObject(model);
    const dimensions=bounds.getSize(new THREE.Vector3());
    if(Math.abs(dimensions.x-BRIDGE_DECK.length)>.04 ||
       Math.abs(dimensions.z-BRIDGE_WALK.halfWidth*2)>.04)
      throw new Error('New bridge is not aligned with old crossing');
    // Replace every old visual piece atomically; preserve shared materials
    // for the safe fallback factory used by tests and older workflows.
    for(const child of [...bridge.children]){
      bridge.remove(child);
      if(child instanceof THREE.Mesh)child.geometry.dispose();
    }
    bridge.add(model);
    bridge.userData.bridgeUV='user-uploaded-original-baked-UV';
    bridge.userData.userBridgeLoaded=true;
    bridge.userData.bridgeAsset=USER_BRIDGE.asset;
    bridge.userData.sourceTriangles=triangles;
    bridge.userData.worldDimensions={x:dimensions.x,y:dimensions.y,z:dimensions.z};
    root.userData.userBridgeLoaded=true;
    return true;
  }catch(error){
    console.warn('[LembahAsri] Keep safe wooden bridge fallback',error);
    return false;
  }
}
