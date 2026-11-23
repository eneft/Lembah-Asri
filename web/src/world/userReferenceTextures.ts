import * as THREE from 'three';
import { BARK_ATLAS_SIZE, BARK_UV_ISLANDS } from '../../scripts/tree-bark-uv.mjs';

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

/**
 * The GLB's UV0 coordinates already address THREE separate hand-unwrapped
 * islands. The previous quarter-atlas offset sampled only a sliver of bark,
 * causing the orange blurry trunk visible in iPhone screenshots.
 *
 * Bake the user's painted upper-left bark quadrant into those SAME islands,
 * never remap or stretch the geometry. Reuse source photo pigment but darken
 * the sunlit orange to aged timber brown, retaining natural irregular strokes.
 * A CanvasTexture is constructed only in-browser after the photo loads.
 */
export function bakeBarkIslandsFromUserPainting(atlas:THREE.Texture):THREE.Texture{
  if(typeof document==='undefined')throw new Error('Bark paint baking requires a browser canvas');
  const source=atlas.image as CanvasImageSource & {width:number;height:number};
  if(!source||!source.width||!source.height)throw new Error('User bark photo not loaded');
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=BARK_ATLAS_SIZE;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('Canvas 2D unavailable for painted tree atlas');
  ctx.fillStyle='#6e5745';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const halfW=source.width/2,halfH=source.height/2;
  const entries=Object.entries(BARK_UV_ISLANDS) as Array<
    [keyof typeof BARK_UV_ISLANDS, {x0:number;x1:number;y0:number;y1:number}]>;
  for(const [name,region] of entries){
    const x=region.x0,y=region.y0,w=region.x1-region.x0+1,h=region.y1-region.y0+1;
    // Little offset variations prevent boughs and twigs from repeating one
    // vertical patch; the trunk still receives a continuous single island.
    const sx=name==='trunk'?2:name==='bough'?halfW*.1:halfW*.24;
    const sw=name==='trunk'?halfW-4:name==='bough'?halfW*.86:halfW*.7;
    ctx.drawImage(source,sx,1,sw,halfH-3,x,y,w,h);
    ctx.globalCompositeOperation='multiply';
    ctx.fillStyle=name==='trunk'?'#bbbaaf':'#b6b8ac';
    ctx.fillRect(x,y,w,h);
    ctx.globalCompositeOperation='source-over';
  }
  const texture=new THREE.CanvasTexture(canvas);
  // Original glTF leaf and bark maps use flipY=false; keep the baked islands
  // aligned with those authored UVs, not vertically mirrored by TextureLoader.
  texture.flipY=false;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.generateMipmaps=true;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.anisotropy=4;
  texture.userData.kind='user-photo-baked-to-original-1024px-bark-uv-islands';
  texture.needsUpdate=true;
  return texture;
}

/** Extract pigment from the source leaf painting, not an entire cluster.
 * White layout-paper pixels are replaced by garden-greens, while a faint
 * raised midrib is retained through the existing 3D leaf UVs.
 */
export function bakeSingleLeafPigment(sourceMap:THREE.Texture):THREE.Texture{
  if(typeof document==='undefined')throw new Error('Leaf pigment baking requires canvas');
  const source=sourceMap.image as CanvasImageSource & {width:number;height:number};
  if(!source||!source.width||!source.height)throw new Error('User leaf photo not loaded');
  const size=256,canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('Canvas 2D unavailable');
  // The first 50% of the uploaded crop is entirely foliage, not white paper.
  ctx.drawImage(source,source.width*.2,0,source.width*.62,source.height*.52,0,0,size,size);
  const img=ctx.getImageData(0,0,size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,u=x/(size-1),v=y/(size-1);
    let r=img.data[i],g=img.data[i+1],b=img.data[i+2];
    if(r>194&&g>201&&b>187){r=110;g=145;b=75;}
    // Natural green wash and softly illuminated one-sided painterly strokes.
    const sunlight=Math.exp(-(Math.pow((u-.27)/.29,2)+Math.pow((v-.43)/.24,2)))*17;
    const vein=Math.exp(-Math.abs(u-.5)*27)*(10+5*Math.sin(v*4));
    const leftSide=u<.5?3:-6;
    img.data[i]=Math.max(0,Math.min(255,r*.81+15+sunlight+vein*.65+leftSide));
    img.data[i+1]=Math.max(0,Math.min(255,g*.86+11+sunlight+vein));
    img.data[i+2]=Math.max(0,Math.min(255,b*.83+6+sunlight*.30+vein*.4));
    img.data[i+3]=255;
  }
  ctx.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(canvas);
  t.flipY=false;
  t.colorSpace=THREE.SRGBColorSpace;
  t.minFilter=THREE.LinearMipmapLinearFilter;
  t.magFilter=THREE.LinearFilter;
  t.generateMipmaps=true;
  t.anisotropy=4;
  t.userData.kind='single-leaf-pigment-no-white-paper';
  t.needsUpdate=true;
  return t;
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
      atlas,leaf:bakeSingleLeafPigment(leaf),
      bark:bakeBarkIslandsFromUserPainting(atlas),
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
  sprays.userData.source='user-uploaded foliage recolored as single leaf UV, 23 November 2026';
  // Keep the imported 3D branches and alpha-cutout leaves, but mute the
  // busy inner canopy. The larger curved leaf sprays provide the silhouette.
  crown.traverse(obj=>{
    if(!(obj instanceof THREE.Mesh)||!/leaf|leav|alpha|canopy|crown/i.test(obj.name))return;
    const mats=Array.isArray(obj.material)?obj.material:[obj.material];
    const corrected=mats.map(material=>{
      if(!(material instanceof THREE.MeshBasicMaterial))return material;
      const next=material.clone();
      next.color.set('#9cb59c');
      next.needsUpdate=true;
      return next;
    });
    obj.material=Array.isArray(obj.material)?corrected:corrected[0];
  });
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
