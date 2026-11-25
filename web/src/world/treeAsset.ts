import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyHandPaintedMaterials } from './handPaintedMaterials.ts';

export type TreeAssetKind = 'shade' | 'orchard' | 'courtyard';

const sourceCache = new Map<TreeAssetKind, Promise<THREE.Group>>();
const urls: Record<TreeAssetKind, string> = {
  // Bump query when changing the generated GLB's geometry/atlas. iOS Safari
  // may otherwise retain the previous model despite a fresh JS bundle.
  courtyard: './models/environment/pohon_pekarangan.glb?atlas=asri-6',
  shade: './models/environment/pohon_rimbun_shade.glb?canopy=3&bark=uv3',
  orchard: './models/environment/pohon_rimbun_orchard.glb?canopy=3&bark=uv3'
};

/**
 * The generated local GLBs each have only two REAL 3D meshes:
 * an opaque bark-UV branching trunk and a deeply layered canopy of
 * curved alpha-cutout cards with hand-painted green leaf/flower artwork.
 *
 * The leaf pixels are cut with alphaTest, NOT alphaHash: no stipple noise,
 * no full-mesh transparency sorting, and correct shadow/depth behavior.
 */

// Use the approved atlas, but give bark a private texture so the painted leaf
// pixels (including their alpha mask and mipmaps) remain byte-for-byte unchanged.
function isolateCourtyardBark(map: THREE.Texture): THREE.Texture | undefined {
  if (typeof document === 'undefined') return;
  const image = map.image;
  if (!image || image.width !== 1254 || image.height !== 1254) return;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(image, 0, 0);
  // These are the three bark islands of the uploaded 1254px Asri atlas.
  // Stretch only clean upper bark pigment; don't wrap the illustrated plants
  // and ground at the base of each source illustration around the trunk.
  const islands = [
    { src: [3, 3, 344, 510], dst: [0, 0, 350, 620] },
    { src: [356, 3, 234, 403], dst: [350, 0, 245, 495] },
    { src: [3, 3, 344, 510], dst: [0, 620, 230, 568] }
  ];
  for (const {src, dst} of islands) {
    const [x,y,w,h] = dst;
    ctx.clearRect(x,y,w,h);
    ctx.drawImage(image, src[0],src[1],src[2],src[3],x,y,w,h);
    const pixels = ctx.getImageData(x,y,w,h);
    const data = pixels.data;
    for (let i=0; i<data.length; i+=4) {
      const r=data[i], g=data[i+1], b=data[i+2];
      const l=.30*r+.59*g+.11*b;
      // Restrained aged wood pigments, not a flat tint. Retain the painted
      // highlights and fissures while reducing orange and moss contrast.
      const value = 119 + (l-119)*.79;
      // Detect pale green lichen BEFORE the aged-brown grading removes its hue.
      // Warm wood highlights have a much larger red/green difference.
      const smooth = (a: number, b: number, x: number) => {
        const t = Math.max(0, Math.min(1, (x-a)/(b-a)));
        return t*t*(3-2*t);
      };
      const moss = (1-smooth(18,45,r-g))*smooth(18,45,g-b)*smooth(85,135,g);
      const mossValue = 0.70 + l/550;
      const mix = (wood: number, green: number) => wood*(1-moss)+green*moss;
      data[i]   = mix(value*1.13 + (r-l)*.35, 93*mossValue);
      data[i+1] = mix(value*.98 + (g-l)*.35, 129*mossValue);
      data[i+2] = mix(value*.77 + (b-l)*.35, 57*mossValue);
    }
    ctx.putImageData(pixels,x,y);
  }
  // Texture.clone shares its Source; replace the Source itself, never mutate
  // map.image, otherwise the approved foliage would also change.
  const bark = map.clone();
  bark.source = new THREE.Source(canvas);
  bark.name = 'Asri isolated aged bark atlas';
  bark.needsUpdate = true;
  return bark;
}


// Trace actual bark triangles, not a guessed cylindrical trunk. All vertices
// are in the GLB scene's local frame and will inherit the existing tree scale.
export function addCourtyardClimbers(source: THREE.Group): number {
  if (source.getObjectByName('Asri climbing plants')) return 0;
  const bark: THREE.Mesh[] = [];
  let leafMap: THREE.Texture | undefined;
  source.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some(m => m.name === 'Kulit kayu')) bark.push(object);
    for (const m of materials) {
      if (m.name === 'Daun' && m instanceof THREE.MeshBasicMaterial && m.map) leafMap = m.map;
    }
  });
  if (!bark.length || !leafMap) return 0;
  source.updateWorldMatrix(true, true);
  const ray = new THREE.Raycaster();
  const inverse = source.matrixWorld.clone().invert();
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const group = new THREE.Group();
  group.name = 'Asri climbing plants';
  const stemMaterial = new THREE.MeshBasicMaterial({color: '#536b35', toneMapped: false});
  const leavesMaterial = new THREE.MeshBasicMaterial({
    map: leafMap, color: '#d1dda5', alphaTest: .48,
    side: THREE.DoubleSide, depthWrite: true, toneMapped: false
  });
  // Use the existing isolated green leaf illustration (atlas pixels 764..879,
  // 744..937); GLTFLoader's atlas has flipY=false.
  const u0=764/1254, u1=879/1254, v0=744/1254, v1=937/1254;
  let count = 0;
  for (let trail=0; trail<3; trail++) {
    const points: THREE.Vector3[] = [];
    const maxHeight = [2.45,1.80,2.08][trail];
    const steps = 30;
    for (let i=0;i<=steps;i++) {
      const t=i/steps, y=.14+(maxHeight-.14)*t;
      const angle=trail*2.094+.47+.24*Math.sin(t*5.6+trail)+.28*t;
      const radial=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
      const outside=radial.clone().multiplyScalar(4.5).add(new THREE.Vector3(0,y,0));
      const origin=source.localToWorld(outside.clone());
      const target=source.localToWorld(new THREE.Vector3(0,y,0));
      ray.set(origin,target.sub(origin).normalize());
      const hit=ray.intersectObjects(bark,false)[0];
      if (!hit) break;
      const surface=hit.point.clone().applyMatrix4(inverse);
      // A short outward offset avoids z-fighting and preserves contact.
      const p=surface.clone().addScaledVector(radial,.024);
      points.push(p);
      if (i%2!==0 && i>1) continue;
      const sign=(Math.floor(i/2)+trail)%2===0?1:-1;
      const tangent=new THREE.Vector3(-radial.z,0,radial.x);
      const up=new THREE.Vector3(0,1,0).multiplyScalar(.62)
        .addScaledVector(tangent,sign*.78).normalize();
      const across=new THREE.Vector3().crossVectors(up,radial).normalize();
      const length=(.23+.085*Math.sin(i*2.1+trail)**2)*(1-.29*t);
      const width=length*.62;
      const base=positions.length/3;
      // Bent leaf card: a raised midrib and six vertices, not a floating quad.
      for(let row=0;row<2;row++)for(let col=0;col<3;col++){
        const q=p.clone().addScaledVector(up,row*length)
          .addScaledVector(across,(col-1)*width*.5)
          .addScaledVector(radial,.032+(col===1?.034:0)+row*.028);
        positions.push(q.x,q.y,q.z);
        uvs.push(u0+(u1-u0)*col/2,row===0?v1:v0);
      }
      indices.push(base,base+3,base+1,base+1,base+3,base+4,
        base+1,base+4,base+2,base+2,base+4,base+5);
      count++;
    }
    if(points.length>1){
      // Straight short segments follow the sampled bark, rather than a
      // free spline which could overshoot the irregular buttress surface.
      const path=new THREE.CurvePath<THREE.Vector3>();
      for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(points[i-1],points[i]));
      const stem=new THREE.Mesh(new THREE.TubeGeometry(path,points.length*2,.012,5,false),stemMaterial);
      stem.name='Slender bark-hugging vine stem';
      group.add(stem);
    }
  }
  if(count){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const leaves=new THREE.Mesh(geo,leavesMaterial);
    leaves.name='Small hand-painted climbing leaves';
    group.add(leaves);
    group.userData.leafCount=count;
    source.add(group);
  }
  return count;
}

export function loadPaintedTreeSource(kind: TreeAssetKind): Promise<THREE.Group> {
  const existing = sourceCache.get(kind);
  if (existing) return existing;

  const promise = new GLTFLoader().loadAsync(urls[kind]).then(gltf => {
    const source = gltf.scene;
    source.name = 'Approved UV alpha-cutout 3D ' + kind + ' tree';
    if (kind === 'courtyard') {
      // The authored unlit atlas includes its own highlights and leaf mask.
      source.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          material.toneMapped = false;
          if (material instanceof THREE.MeshBasicMaterial && material.map) {
            if (material.name === 'Kulit kayu') {
              const bark = isolateCourtyardBark(material.map);
              if (bark) {
                material.map = bark;
                material.needsUpdate = true;
              }
            }
            material.map.anisotropy = 4;
          }
        }
      });
      addCourtyardClimbers(source);
      return source;
    }
    applyHandPaintedMaterials(source, 4);
    let leafFound = false;
    source.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const isLeaf = materials.some(material => material.name.includes('Hand Painted Alpha Leaves')
        || material.name.includes('Alpha') || object.name.toLowerCase().includes('alpha'));
      for (const material of materials) {
        if (!(material instanceof THREE.MeshBasicMaterial)) continue;
        material.toneMapped = false;
        material.alphaHash = false;
        material.depthWrite = true;
        if (isLeaf) {
          material.alphaTest = 0.46;
          material.transparent = false;
          material.alphaToCoverage = true; // MSAA softens the cut edge on iPhone
          material.side = THREE.DoubleSide;
          const painted = material.onBeforeCompile;
          material.onBeforeCompile = (shader, renderer) => {
            painted.call(material, shader, renderer);
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
              #include <map_fragment>
              #ifdef USE_MAP
                vec3 leafWash = texture2D(map, vMapUv, 1.7).rgb;
                diffuseColor.rgb = mix(diffuseColor.rgb, leafWash, .52) * vec3(.91,.88,.73);
              #endif
            `);
          };
          material.customProgramCacheKey = () => 'soft-olive-leaf-pigment-v1';
          leafFound = true;
        }
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.anisotropy = 4;
        }
        material.needsUpdate = true;
      }
      object.castShadow = true;
      object.receiveShadow = false;
    });
    if (!leafFound) throw new Error('3D tree GLB is missing textured alpha foliage');
    return source;
  }).catch(error => {
    sourceCache.delete(kind);
    throw error;
  });
  sourceCache.set(kind, promise);
  return promise;
}

export function instantiatePaintedTree(
  source: THREE.Group, height: number, x: number, z: number, yaw: number
): THREE.Group {
  const bounds = new THREE.Box3().setFromObject(source);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y < 0.1) throw new Error('Invalid UV painted tree');
  const root = source.clone(true);
  const scale = height / size.y;
  root.scale.setScalar(scale);
  root.rotation.y = yaw;
  root.position.set(x, -bounds.min.y * scale, z);
  root.userData.renderStyle = 'textured volumetric alpha-cutout GLB';
  return root;
}


// The only front-yard sentinel uses the authored GLB UV0 bark image, but the
// baked orange paint was too saturated on iPhone. Work on cloned materials:
// the village trees, foliage, and uploaded geometry/UVs must remain identical.
export function retoneCourtyardBark(tree: THREE.Object3D): number {
  let repainted=0;
  tree.traverse(object => {
    if(!(object instanceof THREE.Mesh))return;
    if(!/^(Pangkal_akar|Batang_dan_dahan|UV hand-painted tree trunk and branches)$/.test(object.name))return;
    if(!(object.material instanceof THREE.MeshBasicMaterial) || !object.material.map)return;
    const bark=object.material.clone();
    const previous=bark.onBeforeCompile;
    bark.onBeforeCompile=(shader,renderer)=>{
      previous.call(bark,shader,renderer);
      // The UVs still sample the ORIGINAL painterly image; this color-grade
      // occurs after the baked texel and mesh vertex color, not in the atlas.
      shader.vertexShader='varying float vCourtyardBarkLocalY;\n'+
        shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n vCourtyardBarkLocalY=position.y;');
      shader.fragmentShader='varying float vCourtyardBarkLocalY;\n'+
        shader.fragmentShader.replace('#include <color_fragment>',`
          #include <color_fragment>
          float barkPigment=dot(diffuseColor.rgb,vec3(.25,.62,.13));
          vec3 agedBrown=vec3(.44,.34,.28)*(.54+1.13*barkPigment);
          // Preserve the hand-painted fissures, but mute orange highlights.
          diffuseColor.rgb=mix(diffuseColor.rgb,agedBrown,.69);
          // Soft shaded, slightly mossy foot; no stripes or black decals.
          float rooted=1.0-smoothstep(.06,1.18,vCourtyardBarkLocalY);
          diffuseColor.rgb*=mix(vec3(1.0),vec3(.86,.93,.81),rooted*.33);
        `);
    };
    const oldKey=bark.customProgramCacheKey.bind(bark);
    bark.customProgramCacheKey=()=>oldKey()+'|courtyard-aged-bark-uv0-v1';
    bark.userData={...bark.userData,courtyardRetonedBark:true,
      sourceUV:'original GLB UV0',palette:'aged warm brown, restrained moss'};
    bark.needsUpdate=true;
    object.material=bark;
    repainted++;
  });
  return repainted;
}
