import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { BRIDGE_DECK, BRIDGE_WALK } from './paintedBridge.ts';

/** Original user-supplied wooden bridge, packaged with meshopt geometry and
 * WebP emissive atlas without reducing its authored 10,000 triangles.
 * Unlike the old 3D approximation, this is the user's actual GLB mesh.
 */
export const USER_BRIDGE = Object.freeze({
  asset: './models/environment/bridge_user_reference_wood_v2.glb',
  sourceFile: 'base_basic_shaded(2).glb',
  sourceTopOfDeck: .42,
  verticalScale: 1.4,
  rotationY: Math.PI/2,
  originalTriangles: 10000,
  sourceSHA256: '03ccfdb7b3661e9b9545362c1cd8a824faa9a14a5ec89f5e13de0693c5769531'
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
    // V2 GLB runs along local Z. Rotate the child, then scale the parent
    // in world axes so the long bridge spans X without distortion.
    const oriented=new THREE.Group();
    oriented.name='User GLB Z-to-X orientation';
    oriented.rotation.y=USER_BRIDGE.rotationY;
    oriented.add(gltf.scene);
    const model=new THREE.Group();
    model.name='Uploaded wooden bridge - original GLB';
    model.add(oriented);
    model.updateMatrixWorld(true);
    const fit=fitUserBridgeBounds(new THREE.Box3().setFromObject(model));
    model.scale.copy(fit.scale);
    model.position.copy(fit.position);
    model.updateMatrixWorld(true);
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
    if(meshes<1 || triangles!==USER_BRIDGE.originalTriangles || !baked)
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
    bridge.userData.sourceFile=USER_BRIDGE.sourceFile;
    bridge.userData.modelRotationY=USER_BRIDGE.rotationY;
    bridge.userData.sourceTriangles=triangles;
    bridge.userData.worldDimensions={x:dimensions.x,y:dimensions.y,z:dimensions.z};
    root.userData.userBridgeLoaded=true;
    return true;
  }catch(error){
    console.warn('[LembahAsri] Keep safe wooden bridge fallback',error);
    return false;
  }
}
