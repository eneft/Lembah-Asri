import * as THREE from 'three';
import { applyPaintedPigment } from './paintedPigment.ts';
import { fenceSide } from './fenceSpacing.ts';

export const INTACT_FENCE_REVISION='intact-canes-v3';
export const INTACT_FENCE_ATLAS='./textures/fence/bamboo_albedo.webp';
export const FENCE_TOP=1.45;
const POST_DIAMETER=.28;
const PICKET_DIAMETER=.115;
const RAIL_DIAMETER=.135;
const DEPTH=.40;
const SIDE_GAP={front:.24,side:.225,rear:.21} as const;
type Run={label:string;center:[number,number,number];half:[number,number,number]};
type Item={x:number;y:number;z:number;length:number;radius:number;angle:number;spin:number;shade:string};
const palette=['#d0c7a4','#d2caae','#c2c3a1','#ddd0b1','#c8bd9d'];
type UVKind='cane'|'rail'|'tie'|'end';
// Select clean single-cane patches inside the existing illustrated atlas,
// not the entire baked surface of several fused stalks. Avoid white seams.
function atlasUV(kind:UVKind,u:number,v:number):[number,number] {
  const r=kind==='cane'?[.065,.525,.145,.970]:kind==='rail'?[.555,.525,.635,.970]:
    kind==='tie'?[.18,.10,.31,.22]:[.69,.14,.83,.27];
  return [r[0]+u*(r[2]-r[0]),r[1]+v*(r[3]-r[1])];
}

/** Full tube exterior, rolled rim, interior wall and recessed diaphragm.
 * Axis is +Y, radius one, height one. No clipping of a fused GLB. */
export function makeIntactCane(kind:'cane'|'rail',sides=12):THREE.BufferGeometry {
  const p:number[]=[],uv:number[]=[],idx:number[]=[];
  const rings=[
    {y:0,r:.94},{y:.035,r:1},{y:.285,r:.96},{y:.30,r:1.045},
    {y:.315,r:.97},{y:.665,r:.93},{y:.68,r:1.02},{y:.695,r:.94},
    {y:.96,r:.91},{y:1,r:.92}
  ];
  const add=(x:number,y:number,z:number,t:UVKind,u:number,v:number)=>{
    p.push(x,y,z);uv.push(...atlasUV(t,u,v));return p.length/3-1;
  };
  for(const ring of rings)for(let k=0;k<=sides;k++){
    const a=k/sides*Math.PI*2;
    add(Math.cos(a)*ring.r,ring.y,Math.sin(a)*ring.r,kind,k/sides,ring.y);
  }
  for(let j=0;j<rings.length-1;j++)for(let k=0;k<sides;k++){
    const a=j*(sides+1)+k,b=a+sides+1;
    idx.push(a,b,a+1,a+1,b,b+1);
  }
  // Discrete end UVs; smooth exterior never inherits cut-face UV fragments.
  function end(top:boolean){
    const h=top?1:0,r=top?.92:.94,inner=r*.76,well=top?.92:.075;
    const first=p.length/3;
    for(const [yy,rr] of [[h,r],[h,inner],[well,inner]]){
      for(let k=0;k<=sides;k++){
        const a=k/sides*Math.PI*2;
        add(Math.cos(a)*rr,yy,Math.sin(a)*rr,'end',.5+.45*Math.cos(a)*rr,.5+.45*Math.sin(a)*rr);
      }
    }
    for(let j=0;j<2;j++)for(let k=0;k<sides;k++){
      const a=first+j*(sides+1)+k,b=a+sides+1;
      if(top)idx.push(a,b,a+1,a+1,b,b+1);else idx.push(a,a+1,b,a+1,b+1,b);
    }
    const center=add(0,well,0,'end',.5,.5);
    const start=first+2*(sides+1);
    for(let k=0;k<sides;k++)if(top)idx.push(center,start+k+1,start+k);else idx.push(center,start+k,start+k+1);
  }
  end(true);end(false);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  g.userData={part:kind,completeCane:true,independentUV:true};
  return g;
}
const cane=makeIntactCane('cane'),rail=makeIntactCane('rail');
const strap=new THREE.BoxGeometry(1,1,1);
const suv=strap.attributes.uv;
for(let i=0;i<suv.count;i++)suv.setXY(i,...atlasUV('tie',suv.getX(i),suv.getY(i)));
strap.computeBoundingSphere();
strap.userData.part='woven binding';

export function makeIntactFenceMaterial(map:THREE.Texture):THREE.MeshBasicMaterial{
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  const material=applyPaintedPigment(new THREE.MeshBasicMaterial({
    map,color:'#ffffff',toneMapped:false,side:THREE.DoubleSide
  }));
  const old=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
    old.call(material,shader,renderer);
    shader.vertexShader='varying vec3 vIntactFence;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvIntactFence=(instanceMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader='varying vec3 vIntactFence;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      float damp=(1.-smoothstep(.02,.38,vIntactFence.y))*
        smoothstep(.28,.80,.5+.28*sin(vIntactFence.x*5.2+vIntactFence.z*9.)+.22*sin(vIntactFence.x*13.2));
      diffuseColor.rgb*=mix(vec3(1.),vec3(.57,.72,.40),damp*.68);
    `);
  };
  material.customProgramCacheKey=()=>INTACT_FENCE_REVISION;
  material.name='Matte hand-painted bamboo — independent cane UV';
  return material;
}

function batch(name:string,geo:THREE.BufferGeometry,mat:THREE.Material,items:Item[],isStrap=false){
  const mesh=new THREE.InstancedMesh(geo,mat,items.length),dummy=new THREE.Object3D();
  mesh.name=name;
  items.forEach((i,k)=>{
    dummy.position.set(i.x,i.y,i.z);
    dummy.rotation.set(0,0,i.angle);
    if(!isStrap)dummy.rotateY(i.spin);
    dummy.scale.set(isStrap?.045:i.radius,i.length,isStrap?.026:i.radius);
    dummy.updateMatrix();mesh.setMatrixAt(k,dummy.matrix);
    mesh.setColorAt(k,new THREE.Color(i.shade));
  });
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.computeBoundingBox();mesh.computeBoundingSphere();
  return mesh;
}

export function createIntactFenceRun(run:Run,material:THREE.Material){
  const alongX=run.half[0]>run.half[2],length=2*(alongX?run.half[0]:run.half[2]);
  if(!Number.isFinite(length)||length<.6)throw Error('Invalid fence length');
  const side=fenceSide(run.label),bays=Math.max(1,Math.round(length/1.72));
  // Keep full-size posts within the original run, including the gate ends.
  const edge=-length/2+POST_DIAMETER/2,pitch=(length-POST_DIAMETER)/bays;
  const posts:Item[]=[],pickets:Item[]=[],rails:Item[]=[],bindings:Item[]=[];
  const gaps:number[]=[],anchors:number[]=[];
  let seed=run.label.split('').reduce((a,c)=>Math.imul(a,31)+c.charCodeAt(0),18)>>>0;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const shade=()=>palette[Math.floor(rand()*palette.length)];
  const item=(x:number,y:number,z:number,length:number,radius:number,angle=0):Item=>
    ({x,y,z,length,radius,angle,spin:rand()*6.28,shade:shade()});
  const railY=[.29,1.00];
  for(let j=0;j<=bays;j++){
    const x=edge+j*pitch;
    anchors.push(x);
    posts.push(item(x,0,0,FENCE_TOP,POST_DIAMETER/2));
    for(const y of railY){
      // Thin crossed straps on both faces, physically seated on the post.
      for(const z of [-.15,.15])for(const sign of [-1,1])
        bindings.push({...item(x,y,z,.31,.02,sign*.72),shade:'#a58c61'});
    }
  }
  for(let j=0;j<bays;j++){
    const x0=edge+j*pitch,x1=x0+pitch;
    const lo=x0+POST_DIAMETER/2,hi=x1-POST_DIAMETER/2,available=hi-lo;
    const n=Math.max(0,Math.min(Math.floor(available/PICKET_DIAMETER),Math.round((available-SIDE_GAP[side])/(PICKET_DIAMETER+SIDE_GAP[side]))));
    const gap=(available-n*PICKET_DIAMETER)/(n+1);
    gaps.push(gap);
    for(let k=0;k<n;k++){
      const x=lo+gap+PICKET_DIAMETER/2+k*(gap+PICKET_DIAMETER);
      pickets.push(item(x,.055,-.045,1.20+rand()*.07,PICKET_DIAMETER/2));
    }
    // Two continuous rails enter the thick post instead of leaving a gap.
    // Segments end inside the one shared post; no double middle supports.
    for(const y of railY)rails.push(item(x0,y,.052,pitch,RAIL_DIAMETER/2,-Math.PI/2));
  }
  const group=new THREE.Group();
  group.name=run.label+' — intact bamboo';
  group.position.set(run.center[0],0,run.center[2]);
  if(!alongX)group.rotation.y=-Math.PI/2;
  group.add(batch('Complete hollow bamboo posts',cane,material,posts),
    batch('Complete separated bamboo pickets',cane,material,pickets),
    batch('Continuous bamboo rails',rail,material,rails),
    batch('Woven bamboo bindings',strap,material,bindings,true));
  group.userData={spacingRevision:INTACT_FENCE_REVISION,fenceSide:side,
    runLength:length,moduleHeight:FENCE_TOP,moduleDepth:DEPTH,bayGaps:gaps,anchors,
    supportPosts:posts.length,pickets:pickets.length,railSections:rails.length,
    independentUV:true,originalGLBUnchanged:true};
  return group;
}
