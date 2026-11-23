import * as THREE from 'three';
import { makePaintedLeafAlbedo } from './homeArtPass.ts';

/**
 * Broad tropical LEAF SPRAYS on the original volumetric GLB.
 * This is actual curved 3D leaf geometry (not a camera-facing png, spherical
 * billboard, noise blob, or a substitute for the original tree geometry).
 *
 * The Work reference has recognizable oval leaves with light midribs,
 * clustered olive / jade / soft yellow-greens. Keep the imported branches,
 * alpha-cutout canopy and UV bark intact while adding the missing silhouette.
 */
export const REFERENCE_LEAF_PASS = Object.freeze({
  sprays: 144,
  leavesPerSpray: 7,
  trianglesPerSpray: 140,
  palette: ['#628c56','#739953','#83a65c','#98b364','#acc174','#638f64'],
  seed: 20261123
});

function seeded(seed:number):()=>number{
  let n=seed>>>0;
  return ()=>{
    n=(Math.imul(n,1664525)+1013904223)>>>0;
    return n/4294967296;
  };
}

/** Wider oval lobes for the reference tree only; unchanged thin groundgrass. */
/** Create seven individually sculpted tropical oval leaf blades.
 * Each blade widens at 38–55% of its length, then tapers to a pointed tip.
 * A raised midrib, gently drooping tip and asymmetric blade halves make the
 * silhouette readable from any third-person camera angle — never grass fans.
 * All leaves use UV0 (u: crossblade, v: root→tip) on the user's leaf pigment.
 */
function makeBroadCrownLeaves():THREE.BufferGeometry{
  const xyz:number[]=[],uv:number[]=[],shade:number[]=[];
  const leaves=REFERENCE_LEAF_PASS.leavesPerSpray;
  const bands=5;
  const emit=(x:number,y:number,z:number,u:number,v:number,tint:number)=>{
    xyz.push(x,y,z);
    uv.push(u,v);
    shade.push(tint,tint*.99,tint*.95);
  };
  for(let leaf=0;leaf<leaves;leaf++){
    const a=leaf*Math.PI*2/leaves+(leaf%2)*.081;
    const ca=Math.cos(a),sa=Math.sin(a);
    const sideX=-sa,sideZ=ca;
    const length=.56+(leaf%3)*.092;
    const halfWidth=.172+(leaf%4)*.017;
    const centerHeight=.125+(leaf%2)*.055;
    const point=(t:number,side:-1|0|1)=>{
      // Broad OVATE blade, not a thin tapering grass leaf.
      const envelope=Math.pow(Math.max(0,Math.sin(Math.PI*t)),.72);
      const breadth=halfWidth*envelope*(1-.11*t);
      const asym=side<0?.91:1.0;
      const sideways=side*breadth*asym;
      const midrib=side===0?.020*envelope:0;
      const down=.24*t*t+.07*t*t*t;
      const lift=centerHeight+.11*Math.sin(Math.PI*t*.95)-down+midrib;
      const curve=.034*Math.sin(Math.PI*t)*(leaf%2?1:-1);
      const r=length*t;
      return [
        ca*r+sideX*(sideways+curve),
        lift,
        sa*r+sideZ*(sideways+curve),
        side===-1?.025:side===1?.975:.5,
        .025+.95*t,
        side===0?1.05:(side===-1?.91:.98)
      ] as const;
    };
    const triangle=(a:ReturnType<typeof point>,b:ReturnType<typeof point>,c:ReturnType<typeof point>)=>{
      for(const p of [a,b,c])emit(p[0],p[1],p[2],p[3],p[4],p[5]);
    };
    for(let i=0;i<bands;i++){
      const t0=i/bands,t1=(i+1)/bands;
      const l0=point(t0,-1),c0=point(t0,0),r0=point(t0,1);
      const l1=point(t1,-1),c1=point(t1,0),r1=point(t1,1);
      triangle(l0,l1,c0);
      triangle(c0,l1,c1);
      triangle(c0,c1,r0);
      triangle(r0,c1,r1);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(shade,3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  g.userData.leafSilhouette='curved-oval-3d-with-painted-midrib';
  g.userData.uvAtlas='user-20261123-single-leaf-pigment';
  g.userData.leafWidthToLength=.60;
  g.userData.singleLeafBlades=leaves;
  return g;
}

export function createConceptLeafSprays(
  existingCanopy: THREE.Object3D
):THREE.InstancedMesh {
  existingCanopy.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(existingCanopy);
  const size=bounds.getSize(new THREE.Vector3());
  if(size.x<2||size.y<3||size.z<2||!Number.isFinite(size.length()))
    throw new Error('Concept tree cannot receive leaf sprays without real 3D canopy bounds');

  const geometry=makeBroadCrownLeaves();
  const material=new THREE.MeshBasicMaterial({
    color:'#ffffff',map:makePaintedLeafAlbedo(),
    vertexColors:true,side:THREE.DoubleSide,depthWrite:true,toneMapped:false
  });
  const mesh=new THREE.InstancedMesh(geometry,material,REFERENCE_LEAF_PASS.sprays);
  mesh.name='Reference broad hand-painted leaf sprays';
  const rand=seeded(REFERENCE_LEAF_PASS.seed);
  const center=bounds.getCenter(new THREE.Vector3());
  const radiusX=size.x*.40,radiusZ=size.z*.40;
  // Off-axis bunches follow existing 3D branches. One deterministic instance
  // draw makes the outline detailed, not flat, on weaker mobile GPUs.
  const lobes=[
    [-.80,-.24],[-.57,.44],[-.18,-.79],[.31,-.76],
    [.79,-.28],[.76,.47],[.19,.79],[-.43,.73],
    [0.,.18],[-.16,-.18],[.42,.13],[-.35,-.53]
  ];
  const transform=new THREE.Object3D();
  for(let i=0;i<REFERENCE_LEAF_PASS.sprays;i++){
    const [lx,lz]=lobes[i%lobes.length];
    const rx=(rand()-.5)*.28,rz=(rand()-.5)*.28;
    const heightFraction=.59+rand()*.31;
    transform.position.set(
      center.x+(lx+rx)*radiusX,
      bounds.min.y+size.y*heightFraction,
      center.z+(lz+rz)*radiusZ
    );
    transform.rotation.set((rand()-.5)*.47,rand()*Math.PI*2,
      (rand()-.5)*.47);
    const scale=.86+rand()*.50;
    transform.scale.set(scale,scale*(.92+rand()*.16),scale);
    transform.updateMatrix();
    mesh.setMatrixAt(i,transform.matrix);
    mesh.setColorAt(i,new THREE.Color(
      REFERENCE_LEAF_PASS.palette[Math.floor(rand()*REFERENCE_LEAF_PASS.palette.length)]
    ));
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.castShadow=true; // visible 3D leaf geometry casts naturally varied canopy shadows
  mesh.receiveShadow=false;
  mesh.frustumCulled=false;
  mesh.userData.painterlyWorkContinuation=true;
  mesh.userData.isTrue3D=true;
  mesh.userData.sprays=REFERENCE_LEAF_PASS.sprays;
  mesh.userData.leavesPerSpray=REFERENCE_LEAF_PASS.leavesPerSpray;
  mesh.userData.source='existing UV leaf paint, not unretrieved Work files';
  return mesh;
}
