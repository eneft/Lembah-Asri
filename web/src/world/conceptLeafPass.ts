import * as THREE from 'three';
import { makeBroadLeafGeometry, makePaintedLeafAlbedo } from './homeArtPass.ts';

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
  trianglesPerSpray: 168,
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
function makeBroadCrownLeaves():THREE.BufferGeometry{
  // Use true curved UV leaf blades; no flat back-to-back cards.
  const g=makeBroadLeafGeometry().clone();
  const pos=g.getAttribute('position') as THREE.BufferAttribute;
  const oneLeafVertices=4*4*3; // four sections × four triangles × three vertices
  for(let i=0;i<pos.count;i++){
    const leaf=Math.floor(i/oneLeafVertices);
    const angle=leaf*Math.PI*2/REFERENCE_LEAF_PASS.leavesPerSpray+(leaf%2)*.085;
    const ca=Math.cos(angle),sa=Math.sin(angle);
    const x=pos.getX(i),z=pos.getZ(i);
    const outward=x*ca+z*sa;
    const side=(-x*sa+z*ca)*1.83;
    pos.setXYZ(i,ca*outward-sa*side,pos.getY(i),sa*outward+ca*side);
  }
  pos.needsUpdate=true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
  g.userData.leafSilhouette='curved-oval-3d-with-painted-midrib';
  g.userData.uvAtlas='approved-128px-leaf-pigment';
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
