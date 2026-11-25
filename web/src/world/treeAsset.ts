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

// Keep the authored UV islands at their exact original positions. Never crop,
// stretch, repaint or globally grade the wood. Only gently tint lichen pixels.
export function naturalLichenPigment(r: number,g: number,b: number): [number,number,number] {
  const smooth=(a:number,z:number,x:number)=>{
    const t=Math.max(0,Math.min(1,(x-a)/(z-a)));
    return t*t*(3-2*t);
  };
  const mask=(1-smooth(15,38,r-g))*smooth(12,35,g-b)*smooth(85,125,g);
  // A small multiplicative shift preserves the artist's pigment variation,
  // grain, light/shadow and anti-aliased edges instead of painting flat green.
  return [r*(1-.15*mask),g*(1-.045*mask),b*(1-.10*mask)];
}
function isolateCourtyardBark(map: THREE.Texture): THREE.Texture | undefined {
  if(typeof document==='undefined')return;
  const image=map.image;
  if(!image || image.width!==1254 || image.height!==1254)return;
  const canvas=document.createElement('canvas');
  canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)return;
  ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  const data=pixels.data;
  // Exact original bark rectangles. No resampling, including root artwork.
  for(const [x,y,w,h] of [[0,0,350,620],[350,0,245,495],[0,620,230,568]]){
    for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++){
      const i=(row*canvas.width+col)*4;
      if(data[i+3]===0)continue;
      const [r,g,b]=naturalLichenPigment(data[i],data[i+1],data[i+2]);
      data[i]=r;data[i+1]=g;data[i+2]=b;
    }
  }
  ctx.putImageData(pixels,0,0);
  const bark=map.clone();
  bark.source=new THREE.Source(canvas);
  bark.name='Asri original bark pigment with subtle lichen';
  bark.needsUpdate=true;
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
  const stemMaterial = new THREE.MeshBasicMaterial({color: '#555b34', toneMapped: false});
  const leavesMaterial = new THREE.MeshBasicMaterial({
    map: leafMap, color: '#e7e8c5', alphaTest: .48,
    side: THREE.DoubleSide, depthWrite: true, toneMapped: false
  });
  // Use the existing isolated green leaf illustration (atlas pixels 764..879,
  // 744..937); GLTFLoader's atlas has flipY=false.
  const u0=764/1254, u1=879/1254, v0=744/1254, v1=937/1254;
  let count = 0;
  for (let trail=0; trail<3; trail++) {
    const points: THREE.Vector3[] = [];
    const maxHeight = [1.28,.78,1.02][trail];
    const steps = 28;
    for (let i=0;i<=steps;i++) {
      const t=i/steps, y=.14+(maxHeight-.14)*t;
      const angle=trail*2.094+.47+.15*Math.sin(t*8.3+trail)+.12*t;
      const radial=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
      const outside=radial.clone().multiplyScalar(4.5).add(new THREE.Vector3(0,y,0));
      const origin=source.localToWorld(outside.clone());
      const target=source.localToWorld(new THREE.Vector3(0,y,0));
      ray.set(origin,target.sub(origin).normalize());
      const hit=ray.intersectObjects(bark,false)[0];
      if (!hit) break;
      const surface=hit.point.clone().applyMatrix4(inverse);
      // A short outward offset avoids z-fighting and preserves contact.
      const p=surface.clone().addScaledVector(radial,.012);
      points.push(p);
      if (i>1 && ((i+trail*2)%7===0 || (i>8 && Math.sin(i*2.41+trail)<.12))) continue;
      const sign=Math.sin(i*2.31+trail)>0?1:-1;
      const tangent=new THREE.Vector3(-radial.z,0,radial.x);
      const up=new THREE.Vector3(0,1,0).multiplyScalar(.38+.38*Math.sin(i*1.74+trail)**2)
        .addScaledVector(tangent,sign*.78).normalize();
      const across=new THREE.Vector3().crossVectors(up,radial).normalize();
      const length=(.10+.10*Math.sin(i*2.1+trail)**2)*(1-.35*t);
      const width=length*(.48+.16*Math.sin(i*1.3)**2);
      const base=positions.length/3;
      // Bent leaf card: a raised midrib and six vertices, not a floating quad.
      for(let row=0;row<2;row++)for(let col=0;col<3;col++){
        const q=p.clone().addScaledVector(up,row*length)
          .addScaledVector(across,(col-1)*width*.5)
          .addScaledVector(radial,.014+(col===1?.014:0)+row*.012);
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
      const stem=new THREE.Mesh(new THREE.TubeGeometry(path,points.length*2,.007,5,false),stemMaterial);
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


// Derive a conservative tangent-space relief from the original authored
// bark pigment. This is a height estimate, not a high-poly normal bake.
// Preserve the albedo; normal data never goes through sRGB conversion.
export function buildCourtyardBarkNormals(
  rgba: Uint8ClampedArray, width: number, height: number
): Uint8Array {
  const out=new Uint8Array(width*height*4);
  for(let i=0;i<out.length;i+=4){
    out[i]=128;out[i+1]=128;out[i+2]=255;out[i+3]=255;
  }
  if(width!==1254 || height!==1254)return out;
  for(const [x,y,w,h] of [[0,0,350,620],[350,0,245,495],[0,620,230,568]]){
    const heights=new Float32Array(w*h);
    const smooth=(a:number,b:number,x:number)=>{
      const t=Math.max(0,Math.min(1,(x-a)/(b-a)));
      return t*t*(3-2*t);
    };
    const hash=(a:number,b:number)=> {
      const n=Math.sin(a*127.1+b*311.7)*43758.5453;
      return n-Math.floor(n);
    };
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
      const i=((y+yy)*width+x+xx)*4;
      const r=rgba[i],g=rgba[i+1],b=rgba[i+2];
      const base=(.35*r+.50*g+.15*b)/255;
      // Pale lichen is a shallow organic layer, not a raised plate of bark.
      const wood=smooth(8,45,r-g);
      // Staggered, irregular elongated bark plates follow the vertical UV
      // grain. The relief is synthetic only; it never changes albedo pixels.
      const u=xx+3.8*Math.sin(yy*.032)+1.7*Math.sin(yy*.071+xx*.023);
      const v=yy+2.4*Math.sin(xx*.065);
      const column=Math.floor(u/11);
      const stagger=hash(column,17)*25;
      const cell=Math.floor((v+stagger)/27);
      const fu=u/11-column, fv=(v+stagger)/27-cell;
      const plate=smooth(.02,.23,Math.min(fu,1-fu))*
        smooth(.015,.16,Math.min(fv,1-fv));
      const grain=Math.sin(u*1.23+Math.sin(v*.12)*.65)*.010+
        Math.sin(u*.64+Math.sin(v*.051)*1.4)*.020;
      heights[yy*w+xx]=base+(wood*(.050+.040*hash(column,cell))*plate)+grain*wood;
    }
    const sample=(xx:number,yy:number,fallback:number)=>{
      const i=((y+yy)*width+x+xx)*4;
      return rgba[i+3]>=220?heights[yy*w+xx]:fallback;
    };
    for(let yy=4;yy<h-4;yy++)for(let xx=4;xx<w-4;xx++){
      const i=((y+yy)*width+x+xx)*4;
      if(rgba[i+3]<220)continue;
      const center=heights[yy*w+xx];
      const r=rgba[i],g=rgba[i+1];
      const strength=5.4*(.20+.80*smooth(8,45,r-g));
      const dx=(sample(xx+1,yy,center)-sample(xx-1,yy,center))*.45+
        (sample(xx+2,yy,center)-sample(xx-2,yy,center))*.35+
        (sample(xx+4,yy,center)-sample(xx-4,yy,center))*.20;
      const dy=(sample(xx,yy+1,center)-sample(xx,yy-1,center))*.45+
        (sample(xx,yy+2,center)-sample(xx,yy-2,center))*.35+
        (sample(xx,yy+4,center)-sample(xx,yy-4,center))*.20;
      const nx=-dx*strength,ny=-dy*strength;
      const inv=1/Math.sqrt(1+nx*nx+ny*ny);
      out[i]=Math.round((nx*inv*.5+.5)*255);
      out[i+1]=Math.round((ny*inv*.5+.5)*255);
      out[i+2]=Math.round((inv*.5+.5)*255);
    }
  }
  return out;
}

function makeCourtyardBarkNormalMap(map: THREE.Texture): THREE.DataTexture | undefined {
  if(typeof document==='undefined')return;
  const image=map.image;
  if(!image || image.width!==1254 || image.height!==1254)return;
  const canvas=document.createElement('canvas');
  canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)return;
  ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  const normal=new THREE.DataTexture(buildCourtyardBarkNormals(pixels.data,canvas.width,canvas.height),
    canvas.width,canvas.height,THREE.RGBAFormat);
  normal.name='Asri bark tangent relief';
  normal.colorSpace=THREE.NoColorSpace;
  normal.flipY=map.flipY;
  normal.channel=map.channel;
  normal.wrapS=map.wrapS;normal.wrapT=map.wrapT;
  normal.offset.copy(map.offset);normal.repeat.copy(map.repeat);
  normal.rotation=map.rotation;normal.center.copy(map.center);
  normal.matrixAutoUpdate=map.matrixAutoUpdate;normal.matrix.copy(map.matrix);
  normal.magFilter=THREE.LinearFilter;
  normal.minFilter=THREE.LinearMipmapLinearFilter;
  normal.generateMipmaps=true;
  normal.anisotropy=4;
  normal.needsUpdate=true;
  return normal;
}

// Use Three's tangent normal decoding but replace the outgoing lighting
// with a bounded, diffuse-only storybook response. No specular or PBR shine.
export function makeMatteCourtyardBark(
  original: THREE.MeshBasicMaterial, normal: THREE.Texture
): THREE.MeshPhongMaterial {
  const material=new THREE.MeshPhongMaterial({
    name:original.name, map:original.map, color:original.color.clone(),
    vertexColors:original.vertexColors, side:original.side,
    alphaTest:original.alphaTest, transparent:original.transparent,
    opacity:original.opacity, depthWrite:original.depthWrite,
    normalMap:normal, normalScale:new THREE.Vector2(.95,.95),
    specular:0x000000, shininess:0, toneMapped:false
  });
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace(/vec3 outgoingLight\s*=[^;]+;/,`
      // World-space key direction: not tied to camera movement.
      vec3 asriBarkKey=normalize(mat3(viewMatrix)*vec3(-0.55,0.80,0.45));
      float asriBarkDiffuse=dot(normal,asriBarkKey);
      float asriBarkBase=dot(normalize(nonPerturbedNormal),asriBarkKey);
      float asriRelief=clamp(asriBarkDiffuse-asriBarkBase,-0.48,0.48);
      // Keep the painted pigments as the dominant light information.
      vec3 outgoingLight=diffuseColor.rgb*clamp(0.82+0.24*max(asriBarkBase,0.0)+0.57*asriRelief,0.57,1.14);
    `);
  };
  material.customProgramCacheKey=()=> 'asri-matte-bark-tangent-relief-v2';
  material.userData={...original.userData,asriMatteBark:true,normalStrength:.95};
  return material;
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
      const replacements=new Map<THREE.Material,THREE.Material>();
      source.traverse(object=>{
        if(!(object instanceof THREE.Mesh))return;
        const replace=(material:THREE.Material)=>{
          if(!(material instanceof THREE.MeshBasicMaterial) || material.name!=='Kulit kayu' || !material.map)return material;
          const existing=replacements.get(material);
          if(existing)return existing;
          const normal=makeCourtyardBarkNormalMap(material.map);
          if(!normal)return material;
          const matte=makeMatteCourtyardBark(material,normal);
          replacements.set(material,matte);
          return matte;
        };
        object.material=Array.isArray(object.material)?object.material.map(replace):replace(object.material);
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
