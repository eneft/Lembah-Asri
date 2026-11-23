import * as THREE from 'three';
import { addUnwrappedBarkTube } from '../../scripts/tree-bark-uv.mjs';
import { createPaintedStoryTree, makePaintedBarkAtlas } from './paintedTrees.ts';
import { instantiatePaintedTree } from './treeAsset.ts';
import { createConceptLeafSprays } from './conceptLeafPass.ts';
import { makeBroadLeafGeometry, makePaintedLeafAlbedo } from './homeArtPass.ts';

/**
 * The broad, mature tropical shade tree at the RIGHT of the user's home
 * reference concept: asymmetric green leaf masses, aged branching bark
 * and exposed roots. Actual 3D geometry with authored UV-painted textures,
 * not a 2D image plane or a glossy procedural/PBR sphere.
 *
 * Sited in the front-right lawn, past the vegetable rows. Both gate and
 * garden machinery remain accessible; never move the old orchard tree.
 */
export const CONCEPT_SHADE_TREE = Object.freeze({
  x: -21.8,
  z: 10.8,
  height: 7.25,
  yaw: 1.08,
  seed: 110923,
  rootSpread: 1.40,
  buttressCount: 8,
  colliderHalfWidth: 0.69
});

type RootBarkData={
  p:number[]; uv:number[]; colors:number[]; idx:number[];
};

/** Low-poly, individually curved 3D roots share the existing hand-painted
 * 1024px bark atlas. No extra downloaded image, no decal, no invented material.
 */
function makeButtressRoots(): THREE.BufferGeometry {
  const g:RootBarkData={p:[],uv:[],colors:[],idx:[]};
  for(let k=0;k<CONCEPT_SHADE_TREE.buttressCount;k++){
    const angle=2*Math.PI*k/CONCEPT_SHADE_TREE.buttressCount+.13*Math.sin(k*3.1);
    const c=Math.cos(angle),sn=Math.sin(angle);
    const fan=0.86+0.14*Math.sin(2.3*k+1.1);
    const length=CONCEPT_SHADE_TREE.rootSpread*fan;
    const swing=0.13*Math.sin(k*2.7);
    const positions=[
      [0.22*c,0.39,0.22*sn],
      [0.42*c,0.22,0.42*sn],
      [0.72*c-swing*sn,0.075,0.72*sn+swing*c],
      [length*c-swing*sn,-0.018,length*sn+swing*c]
    ];
    addUnwrappedBarkTube(g,positions,[0.34,0.23,0.13,0.023],11,'bough',k%4);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(g.p,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(g.uv,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(g.colors,3));
  geometry.setIndex(g.idx);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.buttressRoots=CONCEPT_SHADE_TREE.buttressCount;
  geometry.userData.uvLayout='shared-approved-hand-painted-bark';
  return geometry;
}


/** Tiny 3D leafy undergrowth around the buttress tips. Roots look embedded
 * in garden soil instead of a sharp star shape on empty grass. These small
 * ornamental tufts do not receive Rapier collisions or affect farming plots.
 */
function makeRootUndergrowth():THREE.InstancedMesh {
  const count=19,mesh=new THREE.InstancedMesh(
    makeBroadLeafGeometry(),
    new THREE.MeshBasicMaterial({
      map:makePaintedLeafAlbedo(),vertexColors:true,side:THREE.DoubleSide,
      toneMapped:false,depthWrite:true
    }),count
  );
  mesh.name='Small 3D shade plants among natural buttress roots';
  const obj=new THREE.Object3D();
  const colors=['#6f9060','#789661','#819b63','#678957'];
  for(let i=0;i<count;i++){
    const angle=i*2.39996323+.16,rad=.81+(i%5)*.23;
    obj.position.set(Math.cos(angle)*rad,0.035,Math.sin(angle)*rad);
    obj.rotation.set(0,i*1.71,0);
    const scale=.19+(i%4)*.037;
    obj.scale.setScalar(scale);
    obj.updateMatrix();
    mesh.setMatrixAt(i,obj.matrix);
    mesh.setColorAt(i,new THREE.Color(colors[i%colors.length]));
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.frustumCulled=false;
  mesh.castShadow=false;
  mesh.receiveShadow=false;
  mesh.userData.undergrowthCount=count;
  return mesh;
}

/** Source is the existing full-volume, local UV-painted shade tree GLB.
 * The procedural two-mesh tree serves only as the safe loading fallback.
 */
export function createReferenceShadeTree(source?:THREE.Group):THREE.Group {
  const root=new THREE.Group();
  root.name='Concept mature shade tree near the garden';
  root.position.set(CONCEPT_SHADE_TREE.x,0,CONCEPT_SHADE_TREE.z);

  const canopy=source
    ? instantiatePaintedTree(source,CONCEPT_SHADE_TREE.height,0,0,CONCEPT_SHADE_TREE.yaw)
    : createPaintedStoryTree({
        kind:'shade',height:CONCEPT_SHADE_TREE.height,seed:CONCEPT_SHADE_TREE.seed
      });
  if(!source){
    canopy.rotation.y=CONCEPT_SHADE_TREE.yaw;
  }
  canopy.name='Hand-painted old shade tree crown and branches';
  root.add(canopy);

  const buttresses=new THREE.Mesh(makeButtressRoots(),new THREE.MeshBasicMaterial({
    color:'#ffffff',
    map:makePaintedBarkAtlas(),
    vertexColors:true,
    toneMapped:false,
    side:THREE.DoubleSide
  }));
  buttresses.name='Exposed hand-painted buttress roots';
  buttresses.castShadow=true;
  buttresses.receiveShadow=false;
  root.add(buttresses);
  root.add(makeRootUndergrowth());
  // Work visual continuation: clustered broad 3D leaves keep the approved
  // original GLB's authored geometry/UV/shadows and clarify its foliage.
  root.add(createConceptLeafSprays(canopy));

  root.userData.referenceTree='mature tropical shade tree from approved concept';
  root.userData.referenceGLBLoaded=!!source;
  root.userData.referenceSource=source
    ? 'local UV alpha-cutout shade GLB' : 'matching UV-painted 3D fallback';
  root.userData.buttressCount=CONCEPT_SHADE_TREE.buttressCount;
  return root;
}
