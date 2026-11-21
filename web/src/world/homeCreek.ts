import * as THREE from 'three';
import { makeLowPolyGrassGeometry } from './lowPolyGrass.ts';
import { makeBroadLeafGeometry, makePaintedLeafAlbedo } from './homeArtPass.ts';

/**
 * Physically recessed VISUAL creek with painted gravel riverbed.
 * Rapier collision stays unchanged for backward compatibility.
 * One cheap fragment ripple, no transmission/refraction or alphaHash.
 */
export const CREEK=Object.freeze({
  start:-4.5,end:24.5,bridgeMin:7.25,bridgeMax:9.95,
  waterY:-.20,bedY:-.65,bankWidth:.79
});
export function creekCenterX(z:number):number{
  return -45.5+.12*Math.sin(z*.37+.2)+.09*Math.sin(z*.82-.7);
}
export function creekWidth(z:number):number{
  return 2.7+.12*Math.sin(z*.29+.8)+.08*Math.cos(z*.69-.3);
}

/** Remove waterway pixels from flat visual ground AND shadow receiver.
 * Otherwise a real sub-zero river is hidden by the original 160m grass plane.
 */
export function carveVisualCreek<T extends THREE.Mesh>(mesh:T):T{
  const material=mesh.material;
  if(Array.isArray(material))throw new Error('Creek mask needs a single material');
  if(material.userData.creekVisualCutout)return mesh;
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    const fragmentCut=[
      'float zC=vCreekWorldXZ.y;',
      'if(zC>=-4.5&&zC<=24.5){',
      ' float xC=-45.5+.12*sin(zC*.37+.2)+.09*sin(zC*.82-.7);',
      ' float halfC=.5*(2.7+.12*sin(zC*.29+.8)+.08*cos(zC*.69-.3));',
      ' if(abs(vCreekWorldXZ.x-xC)<halfC+.73)discard;',
      '}'
    ].join('\n');
    shader.vertexShader='varying vec2 vCreekWorldXZ;\n'+
      shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n'+
        'vCreekWorldXZ=(modelMatrix*vec4(transformed,1.0)).xz;');
    shader.fragmentShader='varying vec2 vCreekWorldXZ;\n'+
      shader.fragmentShader.replace('#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\n'+fragmentCut);
  };
  const prevKey=material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey=()=>prevKey()+'|lembah-sunken-creek-mask-v1';
  material.userData.creekVisualCutout=true;
  material.needsUpdate=true;
  mesh.userData.creekVisualCutout=true;
  return mesh;
}

function hash(x:number,y:number,seed:number):number{
  const h=Math.sin(x*127.1+y*311.7+seed*18.9)*43758.5453;
  return h-Math.floor(h);
}
function paintedCreekTexture(bed:boolean):THREE.DataTexture{
  const w=128,h=512,rgba=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=x/(w-1),v=y/(h-1),edge=Math.pow(Math.abs(2*u-1),2.8);
    const wash=9*Math.sin(v*47+u*17)*Math.sin(v*19-u*6)
      +6*Math.cos(v*11+u*8);
    const grain=(hash(Math.floor(x/7),Math.floor(y/13),19)-.5)*8;
    const k=(y*w+x)*4;
    rgba[k]=THREE.MathUtils.clamp(Math.round((bed?132:118)+wash*.45+grain-edge*(bed?8:6)),0,255);
    rgba[k+1]=THREE.MathUtils.clamp(Math.round((bed?123:172)+wash*.45+grain-edge*(bed?12:9)),0,255);
    rgba[k+2]=THREE.MathUtils.clamp(Math.round((bed?98:176)+wash*.5+grain-edge*(bed?7:11)),0,255);
    rgba[k+3]=255;
  }
  // Submerged painted pebbles, stamped once over a small atlas.
  if(bed)for(let row=0;row<28;row++)for(let column=0;column<7;column++){
    const cx=(column+.2+.65*hash(column,row,34))/7*w;
    const cy=(row+.25+.5*hash(column,row,51))/28*h;
    const radius=2.5+hash(column,row,72)*4.4;
    const shade=.35+hash(column,row,93)*.6;
    for(let y=Math.max(0,Math.floor(cy-radius));y<=Math.min(h-1,Math.ceil(cy+radius));y++){
      for(let x=Math.max(0,Math.floor(cx-radius));x<=Math.min(w-1,Math.ceil(cx+radius));x++){
        const dx=(x-cx)/radius,dy=(y-cy)/(radius*.72),q=dx*dx+dy*dy;
        if(q>=1)continue;
        const p=(1-q)*shade,k=(y*w+x)*4;
        rgba[k]=THREE.MathUtils.clamp(rgba[k]+p*32,0,255);
        rgba[k+1]=THREE.MathUtils.clamp(rgba[k+1]+p*31,0,255);
        rgba[k+2]=THREE.MathUtils.clamp(rgba[k+2]+p*27,0,255);
      }
    }
  }
  const texture=new THREE.DataTexture(rgba,w,h,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=THREE.ClampToEdgeWrapping;
  texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;
  texture.anisotropy=4;
  texture.needsUpdate=true;
  return texture;
}
let waterTexture:THREE.DataTexture|undefined;
let bedTexture:THREE.DataTexture|undefined;
export function makeCreekAlbedo():THREE.DataTexture{
  return waterTexture??=paintedCreekTexture(false);
}
export function makeCreekBedAlbedo():THREE.DataTexture{
  return bedTexture??=paintedCreekTexture(true);
}

function creekRibbon(side:-1|0|1|2):THREE.Mesh{
  const positions:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];
  const segments=96,levels=side===0?6:side===2?4:5;
  for(let i=0;i<=segments;i++){
    const t=i/segments,z=CREEK.start+(CREEK.end-CREEK.start)*t;
    const center=creekCenterX(z),half=creekWidth(z)/2;
    for(let j=0;j<levels;j++){
      const u=j/(levels-1);
      let x=0,y=0;
      let color:[number,number,number]=[1,1,1];
      if(side===0){
        x=center+(2*u-1)*(half+.12);
        y=CREEK.waterY;
        const depth=1-Math.pow(Math.abs(2*u-1),1.45);
        color=[1-depth*.17,1-depth*.11,1-depth*.08];
      }else if(side===2){
        x=center+(2*u-1)*(half-.30);
        y=CREEK.bedY+.012*Math.cos(z*.72+u*9);
      }else{
        const rings=[
          {dist:.79,y:.026,color:[.81,.89,.69]},
          {dist:.67,y:.040,color:[.79,.85,.66]},
          {dist:.42,y:-.075,color:[.89,.76,.59]},
          {dist:.12,y:-.415,color:[.67,.60,.48]},
          {dist:-.30,y:CREEK.bedY,color:[.70,.67,.58]}
        ];
        const ring=rings[j];
        x=center+side*(half+ring.dist);
        y=ring.y;
        color=ring.color as [number,number,number];
      }
      positions.push(x,y,z);uvs.push(u,t);colors.push(...color);
    }
  }
  for(let i=0;i<segments;i++)for(let j=0;j<levels-1;j++){
    const a=i*levels+j,b=a+levels;
    indices.push(a,b,a+1,a+1,b,b+1);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();geo.computeBoundingSphere();
  const water=side===0,bed=side===2;
  const material=new THREE.MeshBasicMaterial({
    color:water?'#def7f1':bed?'#ffffff':'#a58e72',
    map:water?makeCreekAlbedo():bed?makeCreekBedAlbedo():null,
    vertexColors:true,toneMapped:false,side:THREE.DoubleSide,
    transparent:water,opacity:water?.74:1,depthWrite:!water
  });
  const mesh=new THREE.Mesh(geo,material);
  mesh.name=water?'Shallow stream west of childhood home':bed?
    'Visible gravel bed below clear creek water':side===-1?
    'Soft west creek bank':'Soft east creek bank';
  mesh.renderOrder=water?4:0;
  mesh.castShadow=false;mesh.receiveShadow=false;
  mesh.userData.depthProfile='3D-bank-to-bed-0.65m';
  if(water){
    const uniform={value:0};
    const previous=material.onBeforeCompile;
    material.onBeforeCompile=(shader,renderer)=>{
      previous.call(material,shader,renderer);
      shader.uniforms.uCreekTime=uniform;
      shader.vertexShader='varying vec2 vCreekFlowXZ;\n'+
        shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n'+
          'vCreekFlowXZ=(modelMatrix*vec4(transformed,1.0)).xz;');
      shader.fragmentShader='varying vec2 vCreekFlowXZ;\n'+
        'uniform float uCreekTime;\n'+
        shader.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\n'+
          'float flow=sin(vCreekFlowXZ.y*10.8-uCreekTime*2.4+sin(vCreekFlowXZ.x*6.5)*.7);\n'+
          'float ripple=sin(vCreekFlowXZ.y*17.1-uCreekTime*3.1+vCreekFlowXZ.x*8.3);\n'+
          'float highlight=smoothstep(.75,.99,flow*.66+ripple*.34);\n'+
          'diffuseColor.rgb+=vec3(.062,.084,.070)*highlight;');
    };
    material.customProgramCacheKey=()=>'lembah-mobile-ripple-v1';
    mesh.userData.rippleUniform=uniform;
    mesh.userData.rippleType='mobile-two-frequency';
  }
  return mesh;
}
export function createHomeCreek():THREE.Group{
  const root=new THREE.Group();
  root.name='Meandering shallow creek and earthen banks';
  root.add(creekRibbon(-1),creekRibbon(1),creekRibbon(2),creekRibbon(0));
  return root;
}
export function updateHomeCreekWater(water:THREE.Object3D|undefined,seconds:number):void{
  if(!water)return;
  const uniform=water.userData.rippleUniform as {value:number}|undefined;
  if(uniform)uniform.value=seconds;
}

type BankClump={x:number;z:number;scale:number;yaw:number;tint:number};
/**
 * Bank greenery is grouped around boulders, with quiet breaks between.
 * Grass is volumetric low-poly geometry, leafy shrubs use authored leaf UV.
 * Only two InstancedMesh draws, no new colliders or sprites.
 */
export function createHomeCreekVegetation(): THREE.Group {
  const root=new THREE.Group();
  root.name='Curated creek bank reeds and leafy clumps';
  const bankGroups: ReadonlyArray<readonly [number,-1|1,number]>=[
    [-3.0,-1,1.0],[.9,1,1.08],[4.3,-1,1.05],
    [6.1,1,.72],[11.9,-1,.98],[14.8,1,1.15],
    [18.2,-1,.9],[21.0,1,1.2],[23.1,-1,.78]
  ];
  let state=161123;
  const rng=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const reeds: BankClump[]=[];
  const shrubs: BankClump[]=[];
  for(const [z,side,intensity] of bankGroups) {
    // Create localized asymmetrical vegetation clumps, not a uniform border.
    const count=Math.round(7*intensity);
    for(let i=0;i<count;i++){
      const zz=z+(rng()-.5)*1.60;
      const edge=creekCenterX(zz)+side*creekWidth(zz)/2;
      const x=edge+side*(.70+.65*rng());
      const scale=(2.25+rng()*2.25)*intensity; // reed height ~0.4–0.9 m
      reeds.push({x,z:zz,scale,yaw:rng()*Math.PI*2,tint:rng()});
    }
    const leafCount=Math.round(2.3*intensity);
    for(let i=0;i<leafCount;i++){
      const zz=z+(rng()-.5)*1.25;
      const x=creekCenterX(zz)+side*(creekWidth(zz)/2+.83+.44*rng());
      shrubs.push({
        x,z:zz,scale:.63+rng()*.63,
        yaw:rng()*Math.PI*2,tint:rng()
      });
    }
  }
  const instance=new THREE.Object3D();
  const reedMesh=new THREE.InstancedMesh(makeLowPolyGrassGeometry(),
    new THREE.MeshBasicMaterial({
      color:'#a4b784',vertexColors:true,
      side:THREE.DoubleSide,toneMapped:false
    }),reeds.length);
  reedMesh.name='Stream clustered bank grasses';
  for(let i=0;i<reeds.length;i++){
    const p=reeds[i];
    instance.position.set(p.x,.052,p.z);
    instance.rotation.set(0,p.yaw,0);
    instance.scale.setScalar(p.scale);
    instance.updateMatrix();
    reedMesh.setMatrixAt(i,instance.matrix);
    reedMesh.setColorAt(i,new THREE.Color(p.tint>.65?'#82a96b':'#a9bd80'));
  }
  reedMesh.instanceMatrix.needsUpdate=true;
  if(reedMesh.instanceColor)reedMesh.instanceColor.needsUpdate=true;
  reedMesh.frustumCulled=false;reedMesh.castShadow=false;
  root.add(reedMesh);

  const leafMesh=new THREE.InstancedMesh(makeBroadLeafGeometry(),
    new THREE.MeshBasicMaterial({
      color:'#ffffff',map:makePaintedLeafAlbedo(),
      vertexColors:true,side:THREE.DoubleSide,toneMapped:false
    }),shrubs.length);
  leafMesh.name='Stream broadleaf foliage clusters';
  for(let i=0;i<shrubs.length;i++){
    const p=shrubs[i];
    instance.position.set(p.x,.045,p.z);
    instance.rotation.set(0,p.yaw,0);
    instance.scale.setScalar(p.scale);
    instance.updateMatrix();
    leafMesh.setMatrixAt(i,instance.matrix);
    leafMesh.setColorAt(i,new THREE.Color(p.tint>.65?'#6c9658':'#7fa261'));
  }
  leafMesh.instanceMatrix.needsUpdate=true;
  if(leafMesh.instanceColor)leafMesh.instanceColor.needsUpdate=true;
  leafMesh.frustumCulled=false;leafMesh.castShadow=false;
  root.add(leafMesh);
  root.userData.clusters=bankGroups.length;
  root.userData.reedInstances=reeds.length;
  root.userData.shrubInstances=shrubs.length;
  return root;
}
