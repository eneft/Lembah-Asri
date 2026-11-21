import * as THREE from 'three';
import { makeLowPolyGrassGeometry } from './lowPolyGrass.ts';
import { makeBroadLeafGeometry, makePaintedLeafAlbedo } from './homeArtPass.ts';

/**
 * Lembah Asri's hand-composed creek. Ground stays flat and walkable.
 * The water follows a softly meandering ribbon, with natural earthen banks.
 * A fixed bridge corridor is protected (z 7.25 .. 9.95).
 */
export const CREEK = Object.freeze({
  start: -4.5,
  end: 24.5,
  bridgeMin: 7.25,
  bridgeMax: 9.95
});

export function creekCenterX(z: number): number {
  // Small natural offset only; existing bridge retains its original position.
  return -45.5 + .12 * Math.sin(z * .37 + .2) + .09 * Math.sin(z * .82 - .7);
}

export function creekWidth(z: number): number {
  return 2.7 + .12 * Math.sin(z * .29 + .8)
    + .08 * Math.cos(z * .69 - .3);
}

function hash(x: number, y: number, seed: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + seed * 18.9) * 43758.5453;
  return h - Math.floor(h);
}

/** Painted watercolor/pebble albedo, NOT a flat cyan rectangle. */
export function makeCreekAlbedo(): THREE.DataTexture {
  const w=128,h=512,rgba=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const u=x/(w-1),v=y/(h-1),edge=Math.pow(Math.abs(2*u-1),3);
      const wash=8*Math.sin(v*47+u*17)*Math.sin(v*19-u*6)
        +6*Math.cos(v*11+u*8);
      const k=(y*w+x)*4;
      rgba[k]=THREE.MathUtils.clamp(Math.round(111+wash*.42-edge*5.2),0,255);
      rgba[k+1]=THREE.MathUtils.clamp(Math.round(166+wash*.47-edge*8),0,255);
      rgba[k+2]=THREE.MathUtils.clamp(Math.round(171+wash*.50-edge*10),0,255);
      rgba[k+3]=255;
    }
  }
  // Paint submerged pebbles by stamping only their small pixel footprints:
  // <25k pixel operations instead of checking all stones at every pixel.
  for(let row=0;row<22;row++){
    for(let column=0;column<6;column++){
      const j=hash(column,row,34);
      const cx=(column+.2+.65*j)/6*w;
      const cy=(row+.25+.5*hash(column,row,51))/22*h;
      const radius=3.5+hash(column,row,72)*4.4;
      const shade=.35+hash(column,row,93)*.45;
      const rx=Math.ceil(radius),ry=Math.ceil(radius*.67);
      for(let y=Math.max(0,Math.floor(cy-ry));y<=Math.min(h-1,Math.ceil(cy+ry));y++){
        for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(w-1,Math.ceil(cx+rx));x++){
          const dx=(x-cx)/radius,dy=(y-cy)/(radius*.67),q=dx*dx+dy*dy;
          if(q>=1)continue;
          const p=(1-q)*shade,k=(y*w+x)*4;
          rgba[k]=THREE.MathUtils.clamp(rgba[k]+p*37,0,255);
          rgba[k+1]=THREE.MathUtils.clamp(rgba[k+1]-p*19,0,255);
          rgba[k+2]=THREE.MathUtils.clamp(rgba[k+2]-p*23,0,255);
        }
      }
    }
  }
  const tex=new THREE.DataTexture(rgba,w,h,THREE.RGBAFormat);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=THREE.ClampToEdgeWrapping;
  tex.wrapT=THREE.ClampToEdgeWrapping;
  tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.magFilter=THREE.LinearFilter;
  tex.generateMipmaps=true;
  tex.anisotropy=4;
  tex.needsUpdate=true;
  return tex;
}

function makeRibbon(bank: -1 | 0 | 1): THREE.Mesh {
  const positions:number[]=[];
  const uvs:number[]=[];
  const colors:number[]=[];
  const indices:number[]=[];
  const segments=78;
  const levels=bank===0?4:3;
  for(let i=0;i<=segments;i++){
    const t=i/segments,z=CREEK.start+(CREEK.end-CREEK.start)*t;
    const center=creekCenterX(z),half=creekWidth(z)/2;
    const left=bank===-1;
    for(let n=0;n<levels;n++){
      let x:number,y:number,u:number;
      if (bank===0) {
        u=n/(levels-1);
        x=center+(u-.5)*2*half;
        y=.035;
      } else {
        u=n/(levels-1);
        const side=left?-1:1;
        const edge=center+side*half;
        const narrow=.30+.11*Math.sin(z*.57+(left?1.2:0));
        // Inner rim + planted shallow bank, no raised wall or cliff.
        x=edge+side*(u*narrow-.035);
        y=.038+.01*u;
      }
      positions.push(x,y,z);
      uvs.push(u,t);
      const tint=bank===0?[1,1,1]:n===0?[.72,.77,.64]:n===1?[.80,.74,.57]:[.69,.77,.58];
      colors.push(...tint);
    }
  }
  for(let i=0;i<segments;i++){
    for(let n=0;n<levels-1;n++){
      const a=i*levels+n,b=a+levels;
      indices.push(a,b,a+1,a+1,b,b+1);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const water=bank===0;
  const material=new THREE.MeshBasicMaterial({
    color:water?'#ffffff':'#a3ad84',
    map:water?makeCreekAlbedo():null,
    vertexColors:true, toneMapped:false, side:THREE.DoubleSide,
    transparent:false,depthWrite:true
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name=water?'Shallow stream west of childhood home':bank===-1?
    'Soft west creek bank':'Soft east creek bank';
  mesh.castShadow=false;
  mesh.receiveShadow=false;
  return mesh;
}

export function createHomeCreek(): THREE.Group {
  const group=new THREE.Group();
  group.name='Meandering shallow creek and earthen banks';
  group.add(makeRibbon(-1),makeRibbon(1),makeRibbon(0));
  return group;
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
      const x=edge+side*(.20+.62*rng());
      const scale=(2.25+rng()*2.25)*intensity; // reed height ~0.4–0.9 m
      reeds.push({x,z:zz,scale,yaw:rng()*Math.PI*2,tint:rng()});
    }
    const leafCount=Math.round(2.3*intensity);
    for(let i=0;i<leafCount;i++){
      const zz=z+(rng()-.5)*1.25;
      const x=creekCenterX(zz)+side*(creekWidth(zz)/2+.48+.45*rng());
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
