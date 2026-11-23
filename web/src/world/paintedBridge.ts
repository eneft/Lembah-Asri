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
  x: -45.5, z: 8.6, length: 5.1, width: 2.4, boards: 16
});
/** Height shared by the visual deck and the Rapier walking surface. */
export const BRIDGE_WALK = Object.freeze({
  top: .323,
  ramp: 1.15,
  halfWidth: 1.04,
  startX: BRIDGE_DECK.x-BRIDGE_DECK.length*.5,
  endX: BRIDGE_DECK.x+BRIDGE_DECK.length*.5
});

/** Continuous ramp at either end; no invisible vertical step obstructs walk. */
export function bridgeWalkHeightAt(x:number,z:number):number {
  if(Math.abs(z-BRIDGE_DECK.z)>BRIDGE_WALK.halfWidth)return 0;
  const {startX,endX,ramp,top}=BRIDGE_WALK;
  if(x<=startX-ramp || x>=endX+ramp)return 0;
  if(x<startX)return top*(x-(startX-ramp))/ramp;
  if(x>endX)return top*(endX+ramp-x)/ramp;
  return top;
}

/** Upward-facing thin static trimesh for the real elevated timber crossing.
 * Rapier ground remains authoritative; never offset just the character mesh.
 */
export function makeBridgeWalkCollider():{vertices:Float32Array;indices:Uint32Array}{
  const {startX,endX,ramp,halfWidth}=BRIDGE_WALK;
  const xs=[startX-ramp,startX,endX,endX+ramp];
  const vertices:number[]=[];
  for(const x of xs){
    const height=bridgeWalkHeightAt(x,BRIDGE_DECK.z);
    for(const z of [BRIDGE_DECK.z-halfWidth,BRIDGE_DECK.z+halfWidth])
      vertices.push(x,height,z);
  }
  const indices:number[]=[];
  for(let i=0;i<xs.length-1;i++){
    const a=i*2,b=(i+1)*2;
    // Z then X winding yields +Y surface normal.
    indices.push(a,a+1,b,a+1,b+1,b);
  }
  return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
}

/** Matte painted timber: long vertical strokes in the plank's Z direction.
 * No basket-weave/waffle tiling from the old multi-face wooden atlas. */
export function makePainterlyPlankAlbedo():THREE.DataTexture{
  const width=256,height=512,pixels=new Uint8Array(width*height*4);
  const fract=(n:number)=>n-Math.floor(n);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/(width-1),v=y/(height-1);
    const warped=u+.010*Math.sin(v*11.2+u*4.1)+.004*Math.sin(v*23.6-u*7.3);
    const grain=6.1*Math.sin(warped*69.0)+3.2*Math.sin(warped*147.0+.8)
      +2.1*Math.sin(warped*30.0-v*2.8);
    const brush=7*Math.sin(v*5.7+u*4.2)+3*Math.sin(v*17.0+u*2.0);
    const speck=(fract(Math.sin(x*17.31+y*21.83)*43758.5453)-.5)*5;
    const knot=Math.exp(-Math.pow((u-.37)/.10,2)-Math.pow((v-.64)/.085,2));
    const ring=4.5*Math.sin((warped-.37)*70+knot*10)*knot;
    const edge=Math.pow(Math.max(0,1-Math.min(u,1-u)*23),2);
    const light=grain+brush+speck+ring-edge*10;
    const k=(y*width+x)*4;
    pixels[k]=THREE.MathUtils.clamp(188+light,0,255);
    pixels[k+1]=THREE.MathUtils.clamp(139+light*.88,0,255);
    pixels[k+2]=THREE.MathUtils.clamp(91+light*.70,0,255);
    pixels[k+3]=255;
  }
  const texture=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.anisotropy=4;
  texture.needsUpdate=true;
  return texture;
}

export const paintedBridgePlankMaterial=new THREE.MeshStandardMaterial({
  name:'Lembah Asri painterly planks - long soft grain, no crosshatch',
  color:'#ffffff',map:makePainterlyPlankAlbedo(),metalness:0,roughness:.94,
  envMapIntensity:.18,side:THREE.FrontSide
});
paintedBridgePlankMaterial.userData={uvPainted:true,grainDirection:'Z',antiWaffle:true};

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
  transforms:ReadonlyArray<{x:number;y:number;z:number;brightness?:number}>,
  material:THREE.MeshStandardMaterial=paintedBridgeMaterial
):THREE.InstancedMesh{
  const mesh=new THREE.InstancedMesh(geometry,material,transforms.length);
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
  root.userData.walkAxis='X';
  root.userData.boardGrainAxis='Z';
  root.userData.collisionFootprint=[BRIDGE_DECK.length,BRIDGE_DECK.width];
  // Walking goes across X; each individual plank runs across width Z.
  // The old five-metre longitudinal strips were oriented incorrectly.
  const plankSpan=BRIDGE_DECK.length/BRIDGE_DECK.boards;
  const planks=Array.from({length:BRIDGE_DECK.boards},(_,i)=>({
    x:BRIDGE_DECK.x-BRIDGE_DECK.length*.5+plankSpan*(i+.5),
    y:BRIDGE_WALK.top-.045+(i%4===0?.001:0),
    z:BRIDGE_DECK.z+(i%3-1)*.008,
    brightness:[1,.94,1.04,.98,.96,1.03][i%6]
  }));
  const boards=instancedBox('Individual UV-painted timber bridge planks',
    new THREE.BoxGeometry(plankSpan-.013,.09,BRIDGE_DECK.width-.065),planks,
    paintedBridgePlankMaterial);
  boards.userData.boardCount=BRIDGE_DECK.boards;
  root.add(boards);
  const runnerPos=[
    {x:BRIDGE_DECK.x,y:.13,z:BRIDGE_DECK.z-.83,brightness:.78},
    {x:BRIDGE_DECK.x,y:.13,z:BRIDGE_DECK.z+.83,brightness:.82}
  ];
  root.add(instancedBox('Bridge underside structural runners',
    new THREE.BoxGeometry(BRIDGE_DECK.length-.08,.23,.19),runnerPos));
  const posts=[];
  const postInsetX=BRIDGE_DECK.length*.5-.13;
  const postInsetZ=BRIDGE_DECK.width*.5-.10;
  for(const z of [BRIDGE_DECK.z-postInsetZ,BRIDGE_DECK.z+postInsetZ]){
    for(const x of [BRIDGE_DECK.x-postInsetX,BRIDGE_DECK.x+postInsetX]){
      posts.push({x,y:.68,z,brightness:1.0});
    }
  }
  root.add(instancedBox('Four painted wooden bridge posts',
    new THREE.BoxGeometry(.24,.99,.24),posts));
  // Two subtle rails frame the crossing but leave the stream visible.
  root.add(instancedBox('Two painted side handrails',
    new THREE.BoxGeometry(BRIDGE_DECK.length-.33,.115,.105),[
      {x:BRIDGE_DECK.x,y:.85,z:BRIDGE_DECK.z-postInsetZ,brightness:.94},
      {x:BRIDGE_DECK.x,y:.85,z:BRIDGE_DECK.z+postInsetZ,brightness:.97}
    ]));
  // Dark carved joinery is geometry, not a giant painted outline over the deck.
  const nailMat=new THREE.MeshBasicMaterial({color:'#79664d',toneMapped:false});
  const nailGeo=new THREE.CylinderGeometry(.012,.012,.004,5);
  const nailTransforms: {x:number;y:number;z:number}[]=[];
  for(const plank of planks){
    for(const z of [BRIDGE_DECK.z-.82,BRIDGE_DECK.z+.82]){
      nailTransforms.push({x:plank.x,y:plank.y+.062,z});
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
