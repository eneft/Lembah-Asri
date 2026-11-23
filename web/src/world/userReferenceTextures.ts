import * as THREE from 'three';

/**
 * User-supplied 23 November hand-painted material sheet and leaf painting.
 * Four 2x2 quadrants, from the original 1254px reference:
 *   bark   | mossy stone
 *   clay   | timber grain
 * The photos are ALBEDO only, never a billboard or a replacement 3D model.
 * We use the real painted leaf surface after white presentation paper removal.
 */
export const USER_REFERENCE_ASSETS=Object.freeze({
  materials:'./textures/concept/lembah_material_atlas.webp',
  leaf:'./textures/concept/lembah_leaf_pigment.webp'
});
export type PaintedAtlasTile='bark'|'rock'|'terracotta'|'wood';
export type UserReferenceTextures={
  atlas:THREE.Texture;
  bark:THREE.Texture;
  rock:THREE.Texture;
  terracotta:THREE.Texture;
  wood:THREE.Texture;
  leaf:THREE.Texture;
};
const TILE_OFFSETS:Record<PaintedAtlasTile,readonly [number,number]>={
  bark:[0,.5],rock:[.5,.5],terracotta:[0,0],wood:[.5,0]
};
export function makeUserAtlasTile(atlas:THREE.Texture,tile:PaintedAtlasTile):THREE.Texture{
  const map=atlas.clone();
  const [x,y]=TILE_OFFSETS[tile];
  map.offset.set(x,y);
  map.repeat.set(.5,.5);
  map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;
  map.colorSpace=THREE.SRGBColorSpace;
  map.magFilter=THREE.LinearFilter;
  map.minFilter=THREE.LinearMipmapLinearFilter;
  map.generateMipmaps=true;
  map.anisotropy=4;
  map.needsUpdate=true;
  map.name='User painted '+tile+' quadrants';
  return map;
}
let pending:Promise<UserReferenceTextures>|undefined;
export function loadUserReferenceTextureSet():Promise<UserReferenceTextures>{
  if(pending)return pending;
  const loader=new THREE.TextureLoader();
  pending=Promise.all([
    loader.loadAsync(USER_REFERENCE_ASSETS.materials),
    loader.loadAsync(USER_REFERENCE_ASSETS.leaf)
  ]).then(([atlas,leaf])=>{
    for(const texture of [atlas,leaf]){
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
      texture.magFilter=THREE.LinearFilter;
      texture.minFilter=THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps=true;
      texture.anisotropy=4;
      texture.needsUpdate=true;
    }
    return {
      atlas,leaf,
      bark:makeUserAtlasTile(atlas,'bark'),
      rock:makeUserAtlasTile(atlas,'rock'),
      terracotta:makeUserAtlasTile(atlas,'terracotta'),
      wood:makeUserAtlasTile(atlas,'wood')
    };
  }).catch(error=>{
    pending=undefined;
    throw error;
  });
  return pending;
}

/** Update just the right-hand mature tree. Cloned materials MUST NOT tint
 * the shared source GLB used for other trees and the orchard.
 */
export function applyUserReferenceTreeTextures(
  tree:THREE.Group, textures:UserReferenceTextures
):boolean{
  const crown=tree.getObjectByName('Hand-painted old shade tree crown and branches');
  const roots=tree.getObjectByName('Exposed hand-painted buttress roots');
  const sprays=tree.getObjectByName('Reference broad hand-painted leaf sprays');
  if(!(crown instanceof THREE.Group)||!(roots instanceof THREE.Mesh)
     ||!(sprays instanceof THREE.InstancedMesh))return false;
  // Preserve bark UV islands, roots, original canopy alpha and source geometry.
  const changeBark=(mesh:THREE.Mesh)=>{
    if(!(mesh.material instanceof THREE.MeshBasicMaterial))return;
    const next=mesh.material.clone();
    next.map=textures.bark;
    next.color.set('#ffffff');
    next.needsUpdate=true;
    mesh.material=next;
  };
  changeBark(roots);
  let trunkCount=0;
  crown.traverse(obj=>{
    if(!(obj instanceof THREE.Mesh))return;
    // Both the imported shade GLB and geometry fallback use named trunk meshes.
    if(/bark|trunk|branches/i.test(obj.name)){
      changeBark(obj);
      trunkCount++;
    }
  });
  if(!(sprays.material instanceof THREE.MeshBasicMaterial))return false;
  const leaves=sprays.material.clone();
  leaves.map=textures.leaf;
  // The painting already contains real green pigment and a yellow midrib.
  // Do not multiply it again by the old dark-green procedural vertex palette.
  leaves.vertexColors=false;
  leaves.color.set('#ffffff');
  leaves.side=THREE.DoubleSide;
  leaves.toneMapped=false;
  leaves.needsUpdate=true;
  sprays.material=leaves;
  const naturalTints=['#f7f9f0','#eef4ed','#f6f4eb','#eaf1e7'];
  for(let i=0;i<sprays.count;i++)
    sprays.setColorAt(i,new THREE.Color(naturalTints[i%naturalTints.length]));
  if(sprays.instanceColor)sprays.instanceColor.needsUpdate=true;
  sprays.userData.source='user-uploaded painterly foliage, 23 November 2026';
  tree.userData.userReferenceAtlasLoaded=true;
  tree.userData.userReferenceBarkMeshes=trunkCount;
  tree.userData.leafPaintingOnCurved3DGeometry=true;
  return trunkCount>0;
}

/** Dry-stone variant only: submerged mossy GLB rocks keep their approved
 * material and water shading. No changes to rock geometry or positions.
 */
export function applyUserReferenceDryRock(
  root:THREE.Object3D,textures:UserReferenceTextures
):boolean{
  const mesh=root.getObjectByName('UV plain rock variant 02');
  if(!(mesh instanceof THREE.InstancedMesh)
     ||!(mesh.material instanceof THREE.MeshBasicMaterial))return false;
  const next=mesh.material.clone();
  next.map=textures.rock;
  next.color.set('#ffffff');
  next.needsUpdate=true;
  mesh.material=next;
  mesh.userData.userReferencePaintedStone=true;
  return true;
}
