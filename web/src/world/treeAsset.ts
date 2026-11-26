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

// The user rejected the large green marks on the wood. Restore nearby
// authored wood pigment, without changing the UV layout or foliage atlas.
export function lichenMask(r:number,g:number,b:number):number {
  const smooth=(a:number,z:number,x:number)=>{
    const t=Math.max(0,Math.min(1,(x-a)/(z-a)));
    return t*t*(3-2*t);
  };
  return (1-smooth(18,44,r-g))*smooth(10,29,g-b)*smooth(68,115,g);
}
export function naturalLichenPigment(r:number,g:number,b:number,
  wood:[number,number,number]=[147,104,66], amount=1):[number,number,number] {
  const m=lichenMask(r,g,b)*amount;
  if(m===0)return [r,g,b];
  const l=.30*r+.59*g+.11*b;
  const wl=.30*wood[0]+.59*wood[1]+.11*wood[2];
  // Retain a little local painted variation, but not the light green silhouette.
  const grain=Math.max(-9,Math.min(9,(l-wl)*.13));
  return [r*(1-m)+(wood[0]+grain)*m,g*(1-m)+(wood[1]+grain)*m,b*(1-m)+(wood[2]+grain)*m];
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
  const data=pixels.data, original=new Uint8ClampedArray(data);
  const stride=canvas.width;
  for(const [x,y,w,h] of [[0,0,350,620],[350,0,245,495],[0,620,230,568]]){
    for(let row=y;row<y+h;row++){
      const left=new Int32Array(w).fill(-1),right=new Int32Array(w).fill(-1);
      const isWood=(col:number)=>{
        const i=(row*stride+col)*4;
        return original[i+3]>230&&original[i]-original[i+1]>35&&lichenMask(original[i],original[i+1],original[i+2])<.08;
      };
      let last=-1;
      for(let col=0;col<w;col++){if(isWood(x+col))last=col;left[col]=last;}
      last=-1;
      for(let col=w-1;col>=0;col--){if(isWood(x+col))last=col;right[col]=last;}
      for(let col=0;col<w;col++){
        const i=(row*stride+x+col)*4;
        if(original[i+3]===0||lichenMask(original[i],original[i+1],original[i+2])<.015)continue;
        // Keep the small authored ground plants at the very bottom of root
        // islands; above those, green patches become surrounding wood.
        const rootArtwork=(x===0&&((y===620&&row>1118)||(y===0&&row>577)));
        if(rootArtwork)continue;
        const l=left[col],r=right[col];
        let wood:[number,number,number]=[147,104,66];
        if(l>=0||r>=0){
          const lo=l>=0?l:r,hi=r>=0?r:l;
          const t=hi===lo?0:(col-lo)/(hi-lo);
          const li=(row*stride+x+lo)*4,ri=(row*stride+x+hi)*4;
          wood=[0,1,2].map(c=>original[li+c]*(1-t)+original[ri+c]*t) as [number,number,number];
        }
        const c=naturalLichenPigment(original[i],original[i+1],original[i+2],wood);
        data[i]=c[0];data[i+1]=c[1];data[i+2]=c[2];
      }
    }
  }
  ctx.putImageData(pixels,0,0);
  const bark=map.clone();
  bark.source=new THREE.Source(canvas);
  bark.name='Asri restored wood pigment';
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
  let count=0;
  const paths: {points:THREE.Vector3[];radials:THREE.Vector3[];kind:string;turns:number}[]=[];
  // The center lines are measured against the approved courtyard GLB
  // (main trunk and its left/right lower boughs), not an imagined cylinder.
  const trace=(centers:THREE.Vector3[], turns:number, phase:number, kind:string)=>{
    const points:THREE.Vector3[]=[],radials:THREE.Vector3[]=[];
    let previous:THREE.Vector3|undefined;
    for(let i=0;i<centers.length;i++){
      const t=i/(centers.length-1), center=centers[i];
      const axis=centers[Math.min(i+1,centers.length-1)].clone()
        .sub(centers[Math.max(0,i-1)]).normalize();
      const ref=Math.abs(axis.y)>.85?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
      const side=ref.addScaledVector(axis,-ref.dot(axis)).normalize();
      const cross=new THREE.Vector3().crossVectors(axis,side).normalize();
      const angle=phase+turns*Math.PI*2*t+.18*Math.sin(t*9.7);
      let best:{p:THREE.Vector3;radial:THREE.Vector3;score:number}|undefined;
      for(const da of [0,-.08,.08,-.18,.18]){
        const radial=side.clone().multiplyScalar(Math.cos(angle+da)).addScaledVector(cross,Math.sin(angle+da));
        const maxRadius=kind==='branch'?.72:(kind==='root'?1.9:1.6);
        const from=center.clone().addScaledVector(radial,maxRadius);
        const origin=source.localToWorld(from);
        const target=source.localToWorld(center.clone());
        ray.set(origin,target.sub(origin).normalize());
        for(const hit of ray.intersectObjects(bark,false)){
          const p=hit.point.clone().applyMatrix4(inverse);
          const dist=p.clone().sub(center).dot(radial);
          if(dist<.025||dist>maxRadius+.01)continue;
          p.addScaledVector(radial,.016);
          const delta=previous?p.distanceTo(previous):0;
          if(previous&&delta>.28)continue;
          const score=Math.abs(da)*.65+delta*.45-dist*.26;
          if(!best||score<best.score)best={p,radial,score};
        }
      }
      if(!best){if(points.length>1)break;continue;}
      previous=best.p;
      points.push(best.p);radials.push(best.radial);
    }
    if(points.length>1)paths.push({points,radials,kind,turns});
  };
  const sampled=(waypoints:number[][],steps:number)=>{
    const curve=new THREE.CatmullRomCurve3(waypoints.map(p=>new THREE.Vector3(...p as [number,number,number])));
    return Array.from({length:steps+1},(_,i)=>curve.getPoint(i/steps));
  };
  // The main vine makes more than one full wrap. The secondary vine uses
  // a different pitch and only occupies the lower trunk.
  trace(sampled([[0,.48,0],[.02,1.45,0],[.04,2.45,-.02],[.12,3.35,-.12],[.16,4.12,-.10]],144),1.45,.52,'trunk');
  trace(sampled([[0,.42,0],[.02,1.15,0],[.04,1.92,-.02],[.06,2.55,-.05]],92),.85,3.55,'trunk');
  // Two individual boughs have their own tilted axial frame so the vines
  // actually wind around wood rather than continuing vertically in space.
  trace(sampled([[.44,4.06,-.09],[.95,4.26,-.19],[1.60,4.54,-.40],[2.20,4.87,-.55],[2.73,5.12,-.58]],96),1.25,1.7,'branch');
  trace(sampled([[-.25,3.62,-.17],[-.74,3.86,-.02],[-1.22,4.02,.14],[-1.75,4.25,.27],[-2.18,4.43,.33]],84),1.0,2.65,'branch');
  for(let k=0;k<paths.length;k++){
    const {points,radials,kind,turns}=paths[k];
    const path=new THREE.CurvePath<THREE.Vector3>();
    for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(points[i-1],points[i]));
    const stem=new THREE.Mesh(new THREE.TubeGeometry(path,points.length*2,kind==='branch'?.009:.012,5,false),stemMaterial);
    stem.name='Slender bark-hugging vine stem';
    stem.userData={tip:points[points.length-1].toArray(),kind,turns,maxSurfaceStep:.28};
    group.add(stem);
    let lastLeaf=-1;
    for(let i=1;i<points.length;i++){
      const p=points[i],radial=radials[i];
      const gap=kind==='branch'? .16:.19;
      if(lastLeaf>=0&&p.distanceTo(points[lastLeaf])<gap*(.8+.55*Math.sin(i*1.71+k)**2))continue;
      lastLeaf=i;
      const direction=points[Math.min(i+1,points.length-1)].clone().sub(points[i-1]).normalize();
      const tangent=new THREE.Vector3().crossVectors(radial,direction).normalize();
      const sign=Math.sin(i*2.31+k)>0?1:-1;
      const up=direction.clone().multiplyScalar(.45).addScaledVector(tangent,sign*.85).normalize();
      const across=new THREE.Vector3().crossVectors(up,radial).normalize();
      const length=(.15+.11*Math.sin(i*2.1+k)**2)*(kind==='branch'?.83:1);
      const width=length*(.54+.13*Math.sin(i*1.3)**2);
      const base=positions.length/3;
      for(let row=0;row<2;row++)for(let col=0;col<3;col++){
        const q=p.clone().addScaledVector(up,row*length)
          .addScaledVector(across,(col-1)*width*.5)
          .addScaledVector(radial,.014+(col===1?.018:0)+row*.022);
        positions.push(q.x,q.y,q.z);
        uvs.push(u0+(u1-u0)*col/2,row===0?v1:v0);
      }
      indices.push(base,base+3,base+1,base+1,base+3,base+4,
        base+1,base+4,base+2,base+2,base+4,base+5);
      count++;
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
          object.geometry.computeBoundingBox();
          const crown = object.geometry.boundingBox!;
          const crownCenter = crown.getCenter(new THREE.Vector3());
          const crownSize = crown.getSize(new THREE.Vector3()).max(new THREE.Vector3(.01,.01,.01));
          const painted = material.onBeforeCompile;
          material.onBeforeCompile = (shader, renderer) => {
            painted.call(material, shader, renderer);
            shader.uniforms.uCrownCenter = {value: crownCenter};
            shader.uniforms.uCrownSize = {value: crownSize};
            shader.vertexShader = 'uniform vec3 uCrownCenter,uCrownSize; varying float vCanopySun;\n' +
              shader.vertexShader.replace('#include <begin_vertex>', `
                #include <begin_vertex>
                vec3 crownOffset = (position-uCrownCenter)/uCrownSize;
                vec3 sunLocal = normalize(vec3(-.51,.81,-.32) * mat3(modelMatrix));
                vCanopySun = smoothstep(-.42,.45,dot(crownOffset,sunLocal));`);
            shader.fragmentShader = 'varying float vCanopySun;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
              #include <map_fragment>
              #ifdef USE_MAP
                vec3 leafWash = texture2D(map, vMapUv, 1.7).rgb;
                diffuseColor.rgb = mix(diffuseColor.rgb, leafWash, .32)
                  * mix(vec3(.68,.78,.64),vec3(1.24,1.04,.74),vCanopySun);
              #endif
            `);
          };
          material.customProgramCacheKey = () => 'village-canopy-sun-v2';
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
