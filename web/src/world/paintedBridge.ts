import * as THREE from 'three';

/**
 * Hand-painted wooden crossing: a real UV-mapped 3D bridge, not a single
 * flat brown box. PBR is intentionally matte so the UV illustration remains
 * the visual authority. The old bridge footprint remains 5.1 x 2.4 metres.
 */
export const BRIDGE_TEXTURES = Object.freeze({
  albedo: './textures/bridge/bridge_wood_painted.webp',
  normal: './textures/bridge/bridge_wood_normal.png',
  roughness: './textures/bridge/bridge_wood_roughness.png'
});
export const BRIDGE_DECK = Object.freeze({
  x: -45.5, z: 8.6, length: 5.1, width: 2.4, boards: 12
});
export const paintedBridgeMaterial = new THREE.MeshStandardMaterial({
  name:'Lembah Asri painted wooden bridge UV/PBR',
  color:'#b48a5e',metalness:0,roughness:.92,
  normalScale:new THREE.Vector2(.15,.15),
  envMapIntensity:.18,
  side:THREE.FrontSide
});
paintedBridgeMaterial.userData={uvPainted:true,pbrMaps:BRIDGE_TEXTURES};

let pending:Promise<boolean>|undefined;
export function loadPaintedBridgeTextures():Promise<boolean>{
  if(pending)return pending;
  const loader=new THREE.TextureLoader();
  pending=Promise.all([
    loader.loadAsync(BRIDGE_TEXTURES.albedo),
    loader.loadAsync(BRIDGE_TEXTURES.normal),
    loader.loadAsync(BRIDGE_TEXTURES.roughness)
  ]).then(([albedo,normal,roughness])=>{
    for(const tex of [albedo,normal,roughness]){
      tex.wrapS=THREE.ClampToEdgeWrapping;
      tex.wrapT=THREE.ClampToEdgeWrapping;
      tex.anisotropy=4;
      tex.needsUpdate=true;
    }
    albedo.colorSpace=THREE.SRGBColorSpace;
    normal.colorSpace=roughness.colorSpace=THREE.NoColorSpace;
    paintedBridgeMaterial.map=albedo;
    paintedBridgeMaterial.normalMap=normal;
    paintedBridgeMaterial.roughnessMap=roughness;
    paintedBridgeMaterial.color.set('#ffffff');
    paintedBridgeMaterial.needsUpdate=true;
    return true;
  }).catch(error=>{
    pending=undefined;
    console.warn('[LembahAsri] Hand-painted bridge map unavailable, retaining warm-wood fallback',error);
    return false;
  });
  return pending;
}

function instancedBox(
  name:string,geometry:THREE.BoxGeometry,
  transforms:ReadonlyArray<{x:number;y:number;z:number;brightness?:number}>
):THREE.InstancedMesh{
  const mesh=new THREE.InstancedMesh(geometry,paintedBridgeMaterial,transforms.length);
  mesh.name=name;
  const object=new THREE.Object3D();
  for(let i=0;i<transforms.length;i++){
    const p=transforms[i];
    object.position.set(p.x,p.y,p.z);
    object.updateMatrix();
    mesh.setMatrixAt(i,object.matrix);
    const tint=p.brightness??1;
    mesh.setColorAt(i,new THREE.Color().setRGB(tint,tint,tint));
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.castShadow=true;
  mesh.receiveShadow=false;
  mesh.computeBoundingSphere();
  return mesh;
}

export function createPaintedWoodenBridge():THREE.Group{
  const root=new THREE.Group();
  root.name='West wooden bridge walkway';
  root.userData.bridgeUV='painterly-individual-planks';
  root.userData.collisionFootprint=[BRIDGE_DECK.length,BRIDGE_DECK.width];
  // Board grain follows bridge crossing X and samples the authored albedo
  // continuously over each box-face UV; avoid stretching one texture over
  // the whole 5.1 x 2.4 m crossing.
  const plankSpan=BRIDGE_DECK.width/BRIDGE_DECK.boards;
  const planks=Array.from({length:BRIDGE_DECK.boards},(_,i)=>({
    x:BRIDGE_DECK.x+(i%3-1)*.009,
    y:.258+(i%4===0?.006:0),
    z:BRIDGE_DECK.z-BRIDGE_DECK.width*.5+plankSpan*(i+.5),
    brightness:[1,.94,1.04,.98,.96,1.03][i%6]
  }));
  const boards=instancedBox('Individual UV-painted timber bridge planks',
    new THREE.BoxGeometry(BRIDGE_DECK.length-.055,.12,plankSpan-.018),planks);
  boards.userData.boardCount=BRIDGE_DECK.boards;
  root.add(boards);
  const runnerPos=[
    {x:BRIDGE_DECK.x,y:.13,z:BRIDGE_DECK.z-.96,brightness:.78},
    {x:BRIDGE_DECK.x,y:.13,z:BRIDGE_DECK.z+.96,brightness:.82}
  ];
  root.add(instancedBox('Bridge underside structural runners',
    new THREE.BoxGeometry(BRIDGE_DECK.length-.08,.23,.19),runnerPos));
  const posts=[];
  for(const z of [7.50,9.70]){
    for(const x of [-47.72,-43.28]){
      posts.push({x,y:.66,z,brightness:1.0});
    }
  }
  root.add(instancedBox('Four painted wooden bridge posts',
    new THREE.BoxGeometry(.18,.9,.18),posts));
  // Dark carved joinery is geometry, not a giant painted outline over the deck.
  const nailMat=new THREE.MeshBasicMaterial({color:'#79664d',toneMapped:false});
  const nailGeo=new THREE.CylinderGeometry(.012,.012,.004,5);
  const nailTransforms: {x:number;y:number;z:number}[]=[];
  for(const plank of planks){
    for(const x of [BRIDGE_DECK.x-2.35,BRIDGE_DECK.x+2.35]){
      nailTransforms.push({x,y:.325,z:plank.z});
    }
  }
  const nailMesh=new THREE.InstancedMesh(nailGeo,nailMat,nailTransforms.length);
  nailMesh.name='Bridge tiny dark joinery nails';
  const marker=new THREE.Object3D();
  for(let i=0;i<nailTransforms.length;i++){
    marker.position.set(nailTransforms[i].x,nailTransforms[i].y,nailTransforms[i].z);
    marker.updateMatrix();
    nailMesh.setMatrixAt(i,marker.matrix);
  }
  nailMesh.instanceMatrix.needsUpdate=true;
  nailMesh.castShadow=false;
  nailMesh.receiveShadow=false;
  nailMesh.computeBoundingSphere();
  root.add(nailMesh);
  return root;
}
