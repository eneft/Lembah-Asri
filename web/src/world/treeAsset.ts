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
      data[i]   = value*1.13 + (r-l)*.35;
      data[i+1] = value*.98 + (g-l)*.35;
      data[i+2] = value*.77 + (b-l)*.35;
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
