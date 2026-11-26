import * as THREE from 'three';
import { HOME_AREA, inHomeArea } from './sceneAreas';
import { creekCenterX, creekWidth } from './creekCourse';
import { createPaintedTerrainPlane } from './terrainMaterials';

export const HOME_LANDSCAPE = Object.freeze({
  x: -35, z: -1, width: 88, depth: 94,
  fogNear: 32, fogFar: 60, sky: '#b5d8df',
  creekStart: -48, creekEnd: 46
});

const smooth = THREE.MathUtils.smoothstep;
export function homeLandscapeHeight(x: number, z: number): number {
  const {minX,maxX,minZ,maxZ}=HOME_AREA;
  const dx=Math.max(minX-x,x-maxX,0), dz=Math.max(minZ-z,z-maxZ,0);
  const outside=Math.hypot(dx,dz);
  // The actual playable yard and its physics remain exactly flat here.
  if(outside===0) return 0;
  const riverClearance=smooth(Math.abs(x-creekCenterX(z))-creekWidth(z)/2,4.1,9);
  const gateClearance=1-(1-smooth(Math.abs(z-9),2.1,6.0))*
    (1-smooth(x,-5,5));
  const hill=smooth(outside,1.5,15)*
    (2.5+1.1*Math.sin(x*.16+z*.11)+.75*Math.cos(z*.24-x*.08));
  return Math.max(0,hill)*riverClearance*(x>maxX?gateClearance:1);
}

export function createHomeLandscapeGround() {
  const {x,z,width,depth}=HOME_LANDSCAPE;
  const ground=createPaintedTerrainPlane('grass',width,depth,x,z,0);
  // The common material and its world-space UV1 remain in use. The local
  // surface is not a new painted billboard or a scaled-down island.
  const geometry=new THREE.PlaneGeometry(width,depth,88,94);
  const pos=geometry.attributes.position;
  const uv1=new Float32Array(pos.count*2);
  for(let i=0;i<pos.count;i++){
    const wx=x+pos.getX(i), wz=z-pos.getY(i);
    pos.setZ(i,homeLandscapeHeight(wx,wz));
    uv1[i*2]=wx/3.5; uv1[i*2+1]=-wz/3.5;
  }
  geometry.setAttribute('uv1',new THREE.BufferAttribute(uv1,2));
  geometry.computeVertexNormals();
  ground.geometry.dispose(); ground.geometry=geometry;
  ground.userData.localLandscape=true;
  return ground;
}

export type BoundaryTree={x:number;z:number;height:number;yaw:number;seed:number};
export function homeBoundaryTrees(): BoundaryTree[] {
  // Intentionally composed asymmetric clumps. Keep the gate corridor,
  // creek banks and all playable positions free of new trunks.
  const positions=[
    [-63,-22,5.8],[-65,-10,6.3],[-64,0,5.2],[-64,16,5.7],[-61,29,6.1],
    [-56,-32,6.4],[-47,-35,5.5],[-37,-32,6.5],[-28,-33,5.7],[-18,-32,6.4],
    [-7,-28,5.4],[-5,-17,6.0],[-5,-6,5.3],[-5,1,4.6],[-5,17,5.1],
    [-7,27,6.2],[-19,30,5.8],[-30,31,6.2],[-41,34,5.6],[-53,34,6.1],
    [-71,-16,7.1],[-70,23,6.9],[-27,-41,7.4],[-13,38,7.0],[-38,41,6.8]
  ];
  return positions.map(([x,z,height],i)=>({x,z,height,yaw:(i*2.39996)%(Math.PI*2),seed:1800+i}))
    .filter(p=>!inHomeArea(p.x,p.z) && Math.abs(p.x-creekCenterX(p.z))>creekWidth(p.z)/2+5 &&
      !(p.x>HOME_AREA.maxX && Math.abs(p.z-9)<6));
}

/** Batch the actual existing hand-painted shade GLB, preserving its materials
 * and UV atlas. No new high-poly distant village or individual draw per tree. */
export function createHomeBoundaryGrove(source:THREE.Group): THREE.Group {
  const group=new THREE.Group();
  group.name='Home scene - layered local grove';
  source.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source);
  const height=bounds.max.y-bounds.min.y;
  if(!Number.isFinite(height)||height<.1) throw new Error('Invalid shade tree source');
  const placements=homeBoundaryTrees();
  source.traverse(part=>{
    if(!(part instanceof THREE.Mesh)||!part.visible) return;
    const mesh=new THREE.InstancedMesh(part.geometry,part.material,placements.length);
    mesh.name='Local grove - '+part.name;
    mesh.castShadow=false;mesh.receiveShadow=false;
    const inverse=source.matrixWorld.clone().invert();
    const local=inverse.multiply(part.matrixWorld);
    for(let i=0;i<placements.length;i++){
      const p=placements[i], scale=p.height/height;
      const transform=new THREE.Matrix4().compose(
        new THREE.Vector3(p.x,homeLandscapeHeight(p.x,p.z)-bounds.min.y*scale,p.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw),
        new THREE.Vector3(scale,scale,scale));
      mesh.setMatrixAt(i,transform.multiply(local));
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
    group.add(mesh);
  });
  return group;
}
