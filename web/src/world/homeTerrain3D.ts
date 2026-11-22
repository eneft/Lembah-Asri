import * as THREE from 'three';
import { CREEK, creekCenterX, creekWidth, creekBankLipHeight } from './homeCreek.ts';
import { createTerrainMaterial } from './terrainMaterials.ts';
import { applyRiverbankPainterlyShader } from './riverbankMaterial.ts';

/**
 * Sculpted grass-land transition that integrates the genuinely sunken creek
 * with the continuous village meadow. This is REAL THREE-DIMENSIONAL terrain
 * geometry with a different elevation along and across the bank, not a tinted
 * plane/decoration.
 *
 * The existing ground is kept for collision compatibility and the exterior
 * blends back into it using an alpha mask. The ONLY excavated cut is in the
 * original flat visual ground, performed by carveVisualCreek().
 *
 * UV0: local bank cross-section for feathered alpha at the outer meadow edge.
 * UV1: actual world X/Z at the same 3.5 m tile scale as meadow albedo.
 *
 * Two meshes / ~8k triangles total for the 160 m creek: mobile-friendly.
 */
export const TERRAIN_CONTOUR = Object.freeze({
  // EXACTLY the creek ribbon's subdivision grid: shared lip vertices align.
  longitudinalSegments: 284,
  outerDistance: 3.85,
  innerDistance: .79,
  grassTileMetres: 3.5,
  lipHeightMax: .16
} as const);

/** The UV0 alpha map blends ONLY the outer border, not the riverbank lip. */
let fade: THREE.DataTexture | undefined;
export function makeRiverMeadowFade(): THREE.DataTexture {
  if (fade) return fade;
  const size=64;
  const pixels=new Uint8Array(size*4*4);
  for(let y=0;y<4;y++){
    for(let x=0;x<size;x++){
      const u=(x+.5)/size;
      const edge=THREE.MathUtils.smoothstep(u,.62,1.0);
      const alpha=Math.round((1-edge)*255);
      const i=(y*size+x)*4;
      pixels[i]=alpha;
      pixels[i+1]=alpha; // MeshBasicMaterial alphaMap reads green
      pixels[i+2]=alpha;
      pixels[i+3]=255;
    }
  }
  fade=new THREE.DataTexture(pixels,size,4,THREE.RGBAFormat);
  fade.wrapS=THREE.ClampToEdgeWrapping;
  fade.wrapT=THREE.ClampToEdgeWrapping;
  fade.minFilter=THREE.LinearFilter;
  fade.magFilter=THREE.LinearFilter;
  fade.generateMipmaps=false;
  fade.needsUpdate=true;
  return fade;
}

/**
 * Unlike scattered colored ground overlays, the banking is one contiguous
 * terrain surface per shore. We draw a low soil-covered grassy shoulder
 * alongside the actual bank, falling smoothly to the original terrain.
 */
const distances=[.79,.94,1.16,1.45,1.93,2.55,3.12,3.85] as const;

/** Height above y=0 at any cross-section, measured from the water edge. */
export function creekMeadowHeight(z:number, offset:number):number{
  if(offset<.70||offset>TERRAIN_CONTOUR.outerDistance+.001)return 0;
  const lip=creekBankLipHeight(z);
  const d=Math.max(.79,offset);
  const crest=.35+.65*Math.exp(-Math.pow((d-1.17)/.73,2));
  const outerFade=1-THREE.MathUtils.smoothstep(d,2.32,3.85);
  const undulation=(.014*Math.sin(z*1.43+d*2.1)+.009*Math.sin(z*3.03-d*1.7))
    * THREE.MathUtils.smoothstep(d,.79,1.05)*outerFade;
  if(d<=.79)return lip;
  // Interpolate from lip to a shallow crest, then down to 0 at the meadow.
  const h=d<1.17
    ?THREE.MathUtils.lerp(lip,Math.min(TERRAIN_CONTOUR.lipHeightMax,lip+.038),
      THREE.MathUtils.smoothstep(d,.79,1.17))
    :Math.min(TERRAIN_CONTOUR.lipHeightMax,lip+.038)*crest*outerFade;
  return Math.max(0,h+undulation);
}

function makeContour(side:-1|1):THREE.Mesh {
  const positions:number[]=[];
  const uv0:number[]=[];
  const uv1:number[]=[];
  const index:number[]=[];
  const segments=TERRAIN_CONTOUR.longitudinalSegments;
  const cols=distances.length;
  for(let i=0;i<=segments;i++){
    const z=CREEK.start+(CREEK.end-CREEK.start)*i/segments;
    const half=creekWidth(z)*.5;
    const center=creekCenterX(z);
    for(let j=0;j<cols;j++){
      const d=distances[j];
      // Preserve exact contact at x=center +/- (half+.79): bank geometry
      // has the same lip x and y. Away from the lip, introduce real 3D
      // asymmetry in the bank contour without zigzagging the river itself.
      const irregular = j===0?0:
        .030*Math.sin(z*.93+j*.75)*Math.sin(z*1.63-j*.17)
        + .017*Math.sin(z*2.33+j);
      const x=center+side*(half+d+irregular);
      const y=creekMeadowHeight(z,d);
      positions.push(x,y,z);
      uv0.push(j/(cols-1),i/segments);
      // Same world UV1 as all other actual village meadow surfaces.
      uv1.push(x/TERRAIN_CONTOUR.grassTileMetres,z/TERRAIN_CONTOUR.grassTileMetres);
    }
  }
  for(let i=0;i<segments;i++){
    for(let j=0;j<cols-1;j++){
      const a=i*cols+j, b=a+cols;
      // Double-sided grass avoids winding mismatch between opposing shores.
      index.push(a,b,a+1,a+1,b,b+1);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv0,2));
  geometry.setAttribute('uv1',new THREE.Float32BufferAttribute(uv1,2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material=createTerrainMaterial('grass',160,160,false,true);
  material.alphaMap=makeRiverMeadowFade();
  material.transparent=true;
  material.depthWrite=false;
  material.side=THREE.DoubleSide;
  material.polygonOffset=true;
  material.polygonOffsetFactor=-1;
  material.polygonOffsetUnits=-1;
  // Two-scale meadow UV breaks the obvious 3.5 m square repetitions right
  // next to the river while leaving the full world grass untouched.
  applyRiverbankPainterlyShader(material,'grassy-shoulder');
  if(material.map){
    material.map.wrapS=THREE.MirroredRepeatWrapping;
    material.map.wrapT=THREE.MirroredRepeatWrapping;
    material.map.needsUpdate=true;
  }
  material.needsUpdate=true;
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name=side===-1?'West bank sculpted meadow terrain':'East bank sculpted meadow terrain';
  mesh.renderOrder=2;
  mesh.castShadow=false;
  mesh.receiveShadow=false; // shadows already received by the shared world receiver
  mesh.userData.terrainKind='sculpted-grass-to-creek';
  mesh.userData.visualOnly=true;
  mesh.userData.protectedPhysics=true;
  mesh.userData.uv='two-channel world-aligned 3.5m';
  return mesh;
}

export function createSculptedCreekMeadow():THREE.Group {
  const group=new THREE.Group();
  group.name='Sculpted 3D banks blending into village terrain';
  group.add(makeContour(-1),makeContour(1));
  group.userData.visualOnly=true;
  group.userData.villageTerrainUnchanged=true;
  group.userData.bridgePassagePreserved=true;
  return group;
}
