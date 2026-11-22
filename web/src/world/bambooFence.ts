import * as THREE from 'three';

/**
 * Lembah Asri bamboo fence — true low-poly 3D with four UV islands sampled
 * from the user-approved hand-painted bamboo fence illustration.
 *
 * Atlas 512x512: upper-left vertical cane, upper-right horizontal cane,
 * lower-left rattan bindings, lower-right hollow cut ends.
 * Matching 512x512 albedo / tangent-space normal / grayscale roughness maps.
 * NON-metal PBR: warm, matte, subtle stalk relief, no plastic shine.
 */
export const BAMBOO_PBR_MAPS = Object.freeze({
  albedo: './textures/fence/bamboo_albedo.webp',
  normal: './textures/fence/bamboo_normal.png',
  roughness: './textures/fence/bamboo_roughness.png'
});
export type BambooFenceAxis = 'x' | 'z';
export type BambooIsland = 'vertical' | 'horizontal' | 'rattan' | 'endcap';
const ISLAND: Record<BambooIsland, number> = {
  vertical:0, horizontal:1, rattan:2, endcap:3
};
const atlasInset = 8 / 512;
const atlasLength = (256 - 16) / 512;

export function mapBambooUV<T extends THREE.BufferGeometry>(geometry:T, island:BambooIsland):T {
  const uv = geometry.getAttribute('uv');
  if (!uv) throw new Error('Bamboo geometry requires a real UV attribute');
  const tile = ISLAND[island];
  const u0 = (tile % 2)*.5 + atlasInset;
  const v0 = (tile < 2 ? .5 : 0) + atlasInset;
  for (let i=0;i<uv.count;i++) {
    const u=THREE.MathUtils.clamp(uv.getX(i),0,1);
    const v=THREE.MathUtils.clamp(uv.getY(i),0,1);
    uv.setXY(i,u0+u*atlasLength,v0+v*atlasLength);
  }
  uv.needsUpdate=true;
  return geometry;
}

export const bambooPBRMaterial = new THREE.MeshStandardMaterial({
  name:'Bamboo fence — painted UV + PBR',
  color:'#dfb365', metalness:0, roughness:.91,
  normalScale:new THREE.Vector2(.24,.24),
  envMapIntensity:.25,
  side:THREE.FrontSide
});
bambooPBRMaterial.userData = {
  source:'Lembah Asri approved illustrated bamboo fence reference',
  uvAtlas:'bamboo-painterly-4-islands',
  maps:BAMBOO_PBR_MAPS
};

let loading:Promise<boolean>|undefined;
export function loadBambooFencePBR():Promise<boolean> {
  if(loading)return loading;
  const loader=new THREE.TextureLoader();
  loading=Promise.all([
    loader.loadAsync(BAMBOO_PBR_MAPS.albedo),
    loader.loadAsync(BAMBOO_PBR_MAPS.normal),
    loader.loadAsync(BAMBOO_PBR_MAPS.roughness)
  ]).then(([map,normal,roughness])=>{
    for(const texture of [map,normal,roughness]){
      texture.wrapS=THREE.ClampToEdgeWrapping;
      texture.wrapT=THREE.ClampToEdgeWrapping;
      texture.anisotropy=4;
      texture.generateMipmaps=true;
      texture.needsUpdate=true;
    }
    map.colorSpace=THREE.SRGBColorSpace;
    normal.colorSpace=THREE.NoColorSpace;
    roughness.colorSpace=THREE.NoColorSpace;
    bambooPBRMaterial.map=map;
    bambooPBRMaterial.normalMap=normal;
    bambooPBRMaterial.roughnessMap=roughness;
    bambooPBRMaterial.color.set('#ffffff');
    bambooPBRMaterial.needsUpdate=true;
    return true;
  }).catch(error=>{
    loading=undefined;
    console.warn('[LembahAsri] Bamboo PBR textures unavailable; using matte bamboo fallback',error);
    return false;
  });
  return loading;
}

/** Shared real cylinder, ring, cap and rattan geometry; instances per fence. */
const parts = {
  posts:mapBambooUV(new THREE.CylinderGeometry(.084,.092,1,10,5,true),'vertical'),
  pickets:mapBambooUV(new THREE.CylinderGeometry(.052,.056,1,8,5,true),'vertical'),
  rails:mapBambooUV(new THREE.CylinderGeometry(.067,.069,1,10,5,true),'horizontal'),
  nodes:mapBambooUV(new THREE.TorusGeometry(.080,.013,4,10),'horizontal'),
  cap:mapBambooUV(new THREE.CircleGeometry(.079,12),'endcap'),
  tie:mapBambooUV(new THREE.BoxGeometry(.26,.034,.027),'rattan')
};
// Open-ended canes capped by UV-illustrated cut surfaces, with nodes in 3D.
parts.nodes.rotateX(-Math.PI/2);
parts.cap.rotateX(-Math.PI/2);

type PartName=keyof typeof parts;
type PartItem={position:[number,number,number];rotation?:[number,number,number];scale?:[number,number,number]};
export type BambooFenceStats={
  supportPosts:number;pickets:number;railSections:number;
  joints:number;length:number;axis:BambooFenceAxis;
};

function instances(key:PartName,items:PartItem[],label:string):THREE.InstancedMesh {
  const mesh=new THREE.InstancedMesh(parts[key],bambooPBRMaterial,items.length);
  const marker=new THREE.Object3D();
  mesh.name=label;
  for(let i=0;i<items.length;i++){
    const item=items[i];
    marker.position.set(...item.position);
    marker.rotation.set(...(item.rotation??[0,0,0]));
    marker.scale.set(...(item.scale??[1,1,1]));
    marker.updateMatrix();
    mesh.setMatrixAt(i,marker.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;
  mesh.castShadow=key==='posts'||key==='rails';
  mesh.receiveShadow=true;
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * Build the approved two-horizontal-rail and vertical-bamboo-picket shape.
 * X-oriented local geometry is rotated at group level for north/south walls.
 * World fence colliders and village-gate gap are kept in homeStage unchanged.
 */
export function createUVBambooFence(
  label:string,x:number,z:number,length:number,axis:BambooFenceAxis
):THREE.Group {
  if (!Number.isFinite(length)||length<.6||!Number.isFinite(x+z)) {
    throw new Error('Invalid bamboo fence location/length');
  }
  const segments=Math.max(1,Math.ceil(length/1.85));
  const step=length/segments;
  const posts:PartItem[]=[],pickets:PartItem[]=[],rails:PartItem[]=[];
  const nodes:PartItem[]=[],caps:PartItem[]=[],ties:PartItem[]=[];
  const railY=[.63,1.13];
  for(let j=0;j<=segments;j++){
    const px=-length/2+j*step;
    const height=1.45+(j%3)*.035;
    posts.push({position:[px,height/2,0],scale:[1,height,1]});
    caps.push({position:[px,height+.004,0],scale:[1.065,1.065,1.065]});
    for(const nodeY of [.38,.92]){
      nodes.push({position:[px,nodeY,0],scale:[1.12,1.12,1.12]});
    }
    for(const h of railY){
      // Visible rattan X bindings around the two rail/post intersections.
      ties.push({position:[px-.018,h,.112],rotation:[0,0,.65]});
      ties.push({position:[px+.018,h,.118],rotation:[0,0,-.65]});
    }
  }
  for(let j=0;j<segments;j++){
    const x0=-length/2+j*step;
    const x1=x0+step;
    for(const h of railY){
      rails.push({position:[(x0+x1)/2,h,-.008],
        rotation:[0,0,Math.PI/2],scale:[1,step+.095,1]});
      nodes.push({position:[x0+step*.56,h,-.008],
        rotation:[0,0,Math.PI/2],scale:[.85,.85,.85]});
    }
    for(let k=1;k<=3;k++){
      const px=x0+(k/4)*step;
      const height=1.14+((j+k)%3)*.045;
      pickets.push({position:[px,.19+height/2,-.014],scale:[1,height,1]});
      caps.push({position:[px,.19+height+.005,-.014],scale:[.66,.66,.66]});
      nodes.push({position:[px,.58,-.014],scale:[.68,.68,.68]});
    }
  }

  const group=new THREE.Group();
  group.name='Bamboo UV PBR — '+label;
  group.position.set(x,0,z);
  if(axis==='z')group.rotation.y=-Math.PI/2;
  group.add(
    instances('posts',posts,label+' bamboo support posts'),
    instances('pickets',pickets,label+' bamboo vertical pickets'),
    instances('rails',rails,label+' bamboo horizontal rails'),
    instances('nodes',nodes,label+' raised bamboo nodes'),
    instances('cap',caps,label+' bamboo cut ends'),
    instances('tie',ties,label+' woven rattan cross ties')
  );
  group.userData.bambooFence=true;
  group.userData.pbr='metalness:0|albedo+normal+roughness';
  group.userData.uv='four-illustration-islands';
  group.userData.stats={
    supportPosts:posts.length,pickets:pickets.length,
    railSections:rails.length,joints:ties.length/2,length,axis
  } satisfies BambooFenceStats;
  return group;
}
