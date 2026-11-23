import * as THREE from 'three';
import { makeBroadLeafGeometry, makePaintedLeafAlbedo } from './homeArtPass.ts';
import { applyRiverbankPainterlyShader, setRiverbankMeadowTexture } from './riverbankMaterial.ts';

import { CREEK, creekCenterX, creekWidth, creekCourseGLSL } from './creekCourse.ts';
import { selectedHomeRocks } from './homeRocks.ts';
import { applyRiversidePaint, loadRiversidePaint } from './riversidePaint.ts';
import { makeSedgeGeometry, makeBankFlowerGeometry } from './riversidePlants.ts';
export { CREEK, creekCenterX, creekWidth, creekOuterMeander } from './creekCourse.ts';

/** Approved image-generated hand-painted creek albedo, with UV edges
 * repaired for seamless +Z flow and 90-degree orientation baked into WebP.
 * The light 1024px asset is the actual water map in Three.js, not concept art.
 * Keep the existing bank albedo and separate localized foam/wake geometry.
 */
export const CREEK_PAINTED_TEXTURES=Object.freeze({
  water:'./textures/terrain/creek_water_painterly_illustrated.webp',
  bank:'./textures/terrain/creek_bank_painted.webp'
});
export const CREEK_FOAM_ART='./textures/terrain/creek_foam_painterly_flow.svg';
// This transparent SVG atlas traces the newly approved foam illustration;
// a single river-ribbon shader scrolls its twelve hand-painted decals.
export const CREEK_FOAM_FLOW=Object.freeze({
  metresPerSecond:.11, intervalMetres:5.5, columns:3, rows:4
});
export const CREEK_WATER_UV=Object.freeze({
  // Same 160 m ribbon and existing six-width-row geometry.
  longitudinalTileMetres:14.5,
  flowUvUnitsPerSecond:.018,
  widthTileCount:1,
  albedoSource:'user-approved-painterly-turquoise-water'
});

/** Shared exact inner bank-crest height for both the organic terrain
 * shoulders and the excavated cross-section. The bridge ramp stays modest.
 * Geometry is actual 3D, not a dark overlay on the original flat meadow. */
export function creekBankLipHeight(z:number):number{
  const raw=.081+.016*Math.sin(z*.51+.4)+.010*Math.sin(z*1.19-.3);
  const crossing=THREE.MathUtils.smoothstep(z,6.25,7.35)
    *(1-THREE.MathUtils.smoothstep(z,9.85,10.95));
  return THREE.MathUtils.clamp(raw*(1-.64*crossing),.026,.118);
}

/** Remove waterway pixels from flat visual ground AND shadow receiver.
 * Otherwise a real sub-zero river is hidden by the original 160m grass plane.
 */
export function carveVisualCreek<T extends THREE.Mesh>(mesh:T):T{
  const material=mesh.material;
  if(Array.isArray(material))throw new Error('Creek mask needs a single material');
  if(material.userData.creekVisualCutout)return mesh;
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    const fragmentCut=[
      'float zC=vCreekWorldXZ.y;',
      'if(zC>=-79.5&&zC<=79.5){',
      ' vec2 course=creekCourse(zC);',
      ' if(abs(vCreekWorldXZ.x-course.x)<course.y+.73)discard;',
      '}'
    ].join('\n');
    shader.vertexShader='varying vec2 vCreekWorldXZ;\n'+
      shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n'+
        'vCreekWorldXZ=(modelMatrix*vec4(transformed,1.0)).xz;');
    shader.fragmentShader=creekCourseGLSL+'\nvarying vec2 vCreekWorldXZ;\n'+
      shader.fragmentShader.replace('#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\n'+fragmentCut);
  };
  const prevKey=material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey=()=>prevKey()+'|lembah-sunken-creek-mask-v1';
  material.userData.creekVisualCutout=true;
  material.needsUpdate=true;
  mesh.userData.creekVisualCutout=true;
  return mesh;
}

function hash(x:number,y:number,seed:number):number{
  const h=Math.sin(x*127.1+y*311.7+seed*18.9)*43758.5453;
  return h-Math.floor(h);
}
function paintedCreekTexture(bed:boolean):THREE.DataTexture{
  const w=128,h=512,rgba=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=x/(w-1),v=y/(h-1),edge=Math.pow(Math.abs(2*u-1),2.8);
    const wash=9*Math.sin(v*47+u*17)*Math.sin(v*19-u*6)
      +6*Math.cos(v*11+u*8);
    const grain=(hash(Math.floor(x/7),Math.floor(y/13),19)-.5)*8;
    const k=(y*w+x)*4;
    rgba[k]=THREE.MathUtils.clamp(Math.round((bed?132:118)+wash*.45+grain-edge*(bed?8:6)),0,255);
    rgba[k+1]=THREE.MathUtils.clamp(Math.round((bed?123:172)+wash*.45+grain-edge*(bed?12:9)),0,255);
    rgba[k+2]=THREE.MathUtils.clamp(Math.round((bed?98:176)+wash*.5+grain-edge*(bed?7:11)),0,255);
    rgba[k+3]=255;
  }
  // Riverbed is a soft painted silt/sand wash, not a field of pebbles.
  // Larger stones in the scene are exclusively the two curated UV models.
  const texture=new THREE.DataTexture(rgba,w,h,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=THREE.ClampToEdgeWrapping;
  texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;
  texture.anisotropy=4;
  texture.needsUpdate=true;
  return texture;
}
let waterTexture:THREE.DataTexture|undefined;
let bedTexture:THREE.DataTexture|undefined;
export function makeCreekAlbedo():THREE.DataTexture{
  return waterTexture??=paintedCreekTexture(false);
}
export function makeCreekBedAlbedo():THREE.DataTexture{
  return bedTexture??=paintedCreekTexture(true);
}

/**
 * Painted RGBA foam illustration: small curving white-creme strokes plus
 * disconnected bubbles at natural current breaks near the mossy bank rocks.
 * Not a uniform noise layer: most of the river remains transparent/clear.
 * Foam patterns align along +Z (upstream -> downstream).
 */
let foamTexture:THREE.DataTexture|undefined;
export function makeCreekFoamAlbedo():THREE.DataTexture {
  if(foamTexture)return foamTexture;
  const w=256,h=1024,rgba=new Uint8Array(w*h*4);
  const mark=(cx:number,cy:number,rx:number,ry:number,amount:number)=>{
    for(let iy=Math.max(0,Math.floor(cy-ry));iy<=Math.min(h-1,Math.ceil(cy+ry));iy++){
      for(let ix=Math.max(0,Math.floor(cx-rx));ix<=Math.min(w-1,Math.ceil(cx+rx));ix++){
        const dx=(ix-cx)/rx,dy=(iy-cy)/ry,q=dx*dx+dy*dy;
        if(q>=1)continue;
        const alpha=Math.round(amount*Math.pow(1-q,.60));
        const k=(iy*w+ix)*4;
        if(alpha>rgba[k+3]){
          rgba[k]=239;
          rgba[k+1]=248;
          rgba[k+2]=235;
          rgba[k+3]=alpha;
        }
      }
    }
  };
  const bubbles:ReadonlyArray<readonly [number,number,number]>=[
    [-3.05,.10,1.2],[.80,.91,1.4],[4.40,.10,1.0],
    [6.02,.89,.8],[11.88,.10,1.1],[14.96,.90,1.5],
    [18.28,.10,1.0],[22.1,.90,.9]
  ];
  for(let index=0;index<bubbles.length;index++){
    const [z,u,intensity]=bubbles[index];
    const y0=(z-CREEK.start)/(CREEK.end-CREEK.start)*h;
    const x0=u*w;
    // Thin C-shaped drifting stroke, softly painted rather than thick white rings.
    for(let i=0;i<34;i++){
      const t=i/33,yy=y0+t*(5+intensity*4);
      const xx=x0+Math.sin(t*Math.PI*1.5+index)*4.2+intensity*2.2*t;
      mark(xx,yy,1.8+intensity*.8,1.5,146);
    }
    // A few broken pale white bubbles near the stone, not full-surface white noise.
    for(let j=0;j<11;j++){
      const seed=hash(index,j,240);
      const uShift=(hash(index,j,52)-.5)*17;
      const vShift=(hash(index,j,83)-.5)*19;
      const radius=1.0+seed*2.8;
      mark(x0+uShift,y0+vShift,radius,radius*.7,90+seed*100);
    }
  }
  // Very occasional slender downstream current trails, readable from above.
  for(const [z,u] of [[-9,.38],[2,.58],[12,.40],[26,.57],[41,.44]]){
    const y=(z-CREEK.start)/(CREEK.end-CREEK.start)*h;
    for(let k=0;k<38;k++){
      const t=k/37;
      mark((u+.015*Math.sin(t*4))*w,y+16*t,1.1,1.25,67);
    }
  }
  foamTexture=new THREE.DataTexture(rgba,w,h,THREE.RGBAFormat);
  foamTexture.colorSpace=THREE.SRGBColorSpace;
  foamTexture.wrapS=THREE.ClampToEdgeWrapping;
  foamTexture.wrapT=THREE.ClampToEdgeWrapping;
  foamTexture.magFilter=THREE.LinearFilter;
  foamTexture.minFilter=THREE.LinearMipmapLinearFilter;
  foamTexture.generateMipmaps=true;
  foamTexture.anisotropy=4;
  foamTexture.needsUpdate=true;
  return foamTexture;
}

function creekRibbon(side:-1|0|1|2|3):THREE.Mesh{
  const positions:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];
  const segments=284,levels=(side===0||side===3)?6:side===2?4:7;
  for(let i=0;i<=segments;i++){
    const t=i/segments,z=CREEK.start+(CREEK.end-CREEK.start)*t;
    const center=creekCenterX(z),half=creekWidth(z)/2;
    for(let j=0;j<levels;j++){
      const u=j/(levels-1);
      let x=0,y=0;
      let color:[number,number,number]=[1,1,1];
      if(side===0||side===3){
        // Extend under the dry bank: the bank depth cuts the varying waterline.
        x=center+(2*u-1)*(half+.51);
        y=CREEK.waterY+(side===3?.012:0);
        const depth=1-Math.pow(Math.abs(2*u-1),1.45);
        color=[1-depth*.17,1-depth*.11,1-depth*.08];
      }else if(side===2){
        x=center+(2*u-1)*(half-.30);
        y=CREEK.bedY+.012*Math.cos(z*.72+u*9);
      }else{
        // Soil is no longer a solid brown wall. Its top has a mossy edge,
        // shallow natural undulation, exposed soil and a damp darker foot.
        // The painted cross-section UV controls soil/moss color instead of
        // baking a uniform brown strip into the geometry.
        const lip=creekBankLipHeight(z);
        const rings=[
          // First ring EXACTLY matches the sculpted grassy terrace;
          // no micro-noise here or seams would open between the meshes.
          {dist:.79,y:lip,color:[1,1,1]},
          {dist:.69,y:lip*.79,color:[1,1,1]},
          {dist:.53,y:-.045,color:[.98,.98,.98]},
          {dist:.32,y:-.18,color:[.94,.95,.95]},
          {dist:.11,y:-.35,color:[.89,.91,.92]},
          {dist:-.10,y:-.52,color:[.86,.88,.89]},
          {dist:-.30,y:CREEK.bedY,color:[.82,.85,.86]}
        ];
        const ring=rings[j];
        // Gentle eroded ledges, ripples and scallops instead of a perfectly
        // straight bank ribbon. Preserve the exact bank-to-meadow weld (j=0)
        // and keep the bridge landings quiet for navigation.
        const bridgeQuiet=THREE.MathUtils.smoothstep(Math.abs(z-8.6),1.6,5.2);
        const rawScallop=bridgeQuiet*
          ((.038+.010*j)*Math.sin(z*.67+j*.73)+
           .036*Math.sin(z*1.73-j*.47)+
           .019*Math.sin(z*3.11+j*.91));
        // Constrain the lateral displacement to keep adjacent rings in
        // strictly land-to-water order and avoid inverted bank triangles.
        const microEdge=j===0?0:
          THREE.MathUtils.clamp(rawScallop,j===1?-.045:-.075,j===1?.045:.075);
        x=center+side*(half+ring.dist+microEdge);
        y=ring.y+(j>0&&j<5?bridgeQuiet*
          (.016*Math.sin(z*.84+j*.65)+.010*Math.sin(z*2.17-j*.7)):0);
        color=ring.color as [number,number,number];
      }
      positions.push(x,y,z);
      // Foam atlas is positioned once over the entire river. Water and
      // earth bank maps repeat every ~8–11 m so their brush strokes aren't
      // stretched across 160 m. U is the original real cross-section UV.
      uvs.push(u,side===3?t:(z-CREEK.start)/(side===0?CREEK_WATER_UV.longitudinalTileMetres:side===2?10:8));
      colors.push(...color);
    }
  }
  for(let i=0;i<segments;i++)for(let j=0;j<levels-1;j++){
    const a=i*levels+j,b=a+levels;
    indices.push(a,b,a+1,a+1,b,b+1);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();geo.computeBoundingSphere();
  const water=side===0,bed=side===2,foam=side===3;
  const material=new THREE.MeshBasicMaterial({
    color:water?'#ffffff':bed?'#ffffff':foam?'#ffffff':'#a99777',
    map:water?makeCreekAlbedo():bed?makeCreekBedAlbedo():
      foam?makeCreekFoamAlbedo():null,
    vertexColors:true,toneMapped:false,side:THREE.DoubleSide,
    transparent:water||foam,opacity:water?.90:foam?.60:1,
    depthWrite:!water&&!foam
  });
  if(side===-1||side===1){
    // 2-scale material removes the 8-metre square repeat in the bank albedo.
    // Material is unique to each bank, so the shader cannot touch water/foam.
    applyRiverbankPainterlyShader(material,'earth-bank');
    applyRiversidePaint(material,'bank');
  }
  if(bed)applyRiversidePaint(material,'bed');
  const mesh=new THREE.Mesh(geo,material);
  mesh.name=water?'Shallow stream west of childhood home':bed?
    'Visible gravel bed below clear creek water':foam?
    'Illustrated river foam and flow trails':side===-1?
    'Soft west creek bank':'Soft east creek bank';
  mesh.renderOrder=foam?5:water?4:0;
  mesh.castShadow=false;mesh.receiveShadow=false;
  if(!foam){
    // First paint load is async. The original DataTexture/warm earthy
    // fallback remains visible if images are unavailable.
    mesh.userData.sourcePaintedUV=true;
  }
  mesh.userData.depthProfile='3D-bank-to-bed-0.65m';
  if(foam){
    const foamClock={value:0};
    const atlasReady={value:0};
    const previous=material.onBeforeCompile;
    material.onBeforeCompile=(shader,renderer)=>{
      previous.call(material,shader,renderer);
      shader.uniforms.uFoamSeconds=foamClock;
      shader.uniforms.uFoamAtlasReady=atlasReady;
      shader.vertexShader='varying vec2 vFoamWorldXZ;\nvarying float vFoamAcross;\n'+
        shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
          vFoamWorldXZ=(modelMatrix*vec4(transformed,1.)).xz;
          vFoamAcross=uv.x;`);
      shader.fragmentShader='varying vec2 vFoamWorldXZ;\nvarying float vFoamAcross;\nuniform float uFoamSeconds;\nuniform float uFoamAtlasReady;\n'+
        shader.fragmentShader.replace('#include <map_fragment>',`
          #ifdef USE_MAP
            if(uFoamAtlasReady>.5) {
              // Drift downstream (+Z), independent of the painted streambed.
              // Each 5.5m stretch picks one of twelve generated foam sketches.
              float downstream=vFoamWorldXZ.y+79.5-uFoamSeconds*.11;
              float section=floor(downstream/5.5);
              float advance=fract(downstream/5.5);
              float seed=fract(sin(section*127.1+5.73)*43758.5453);
              float variant=floor(seed*12.);
              float col=mod(variant,3.);
              float row=floor(variant/3.);
              vec2 local=vec2(clamp(advance,.012,.988),
                clamp(vFoamAcross*.88+.06+.04*sin(section*2.1),.02,.98));
              vec2 atlasUV=vec2((col+local.x)/3.,(3.-row+local.y)/4.);
              vec4 paintedFoam=texture2D(map,atlasUV);
              float pulse=smoothstep(.04,.22,advance)*
                (1.-smoothstep(.82,.98,advance));
              float edge=1.-smoothstep(.78,.98,abs(vFoamAcross*2.-1.));
              // Sparse foam survives only in occasional stream stretches,
              // not as uniformly repeated white bands.
              float breakUp=step(.52,seed)*(.68+.32*sin(section*2.7)*sin(section*2.7));
              diffuseColor.rgb*=paintedFoam.rgb;
              diffuseColor.a*=paintedFoam.a*pulse*edge*breakUp;
            } else {
              #include <map_fragment>
            }
          #endif
        `);
    };
    const cache=material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey=()=>cache()+'|generated-foam-atlas-flow-v1';
    mesh.userData.foamTimeUniform=foamClock;
    mesh.userData.foamAtlasReady=atlasReady;
    mesh.userData.flowDirection='positive-Z';
  }
  if(water){
    const uniform={value:0};
    const previous=material.onBeforeCompile;
    material.onBeforeCompile=(shader,renderer)=>{
      previous.call(material,shader,renderer);
      shader.uniforms.uCreekTime=uniform;
      shader.vertexShader='varying vec2 vCreekFlowXZ;\nvarying float vCreekAcross;\n'+
        shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          vCreekFlowXZ=(modelMatrix*vec4(transformed,1.)).xz;
          vCreekAcross=2.*uv.x-1.;`);
      shader.fragmentShader='varying vec2 vCreekFlowXZ;\nvarying float vCreekAcross;\nuniform float uCreekTime;\n'+
        shader.fragmentShader.replace('#include <map_fragment>', `
          vec2 p=vCreekFlowXZ;
          float shoal=smoothstep(.29,.92,abs(vCreekAcross)+.056*sin(p.y*1.15+p.x*.52));
          float localTime=uCreekTime*.72;
          vec2 drift=vec2(.018*sin(p.y*2.3-localTime)+.008*sin(p.y*5.1+localTime*.4),
                          .014*sin(p.x*2.8+p.y*.8-localTime*.63));
          float luminance=.23;
          #ifdef USE_MAP
            vec2 currentUV=vMapUv+drift;
            currentUV.x=clamp(currentUV.x,.003,.997);
            luminance=dot(texture2D(map,currentUV).rgb,vec3(.21,.71,.08));
          #endif
          float brush=smoothstep(.065,.52,luminance);
          vec3 pool=mix(vec3(.012,.068,.082),vec3(.077,.237,.281),brush);
          vec3 margin=mix(vec3(.046,.135,.119),vec3(.122,.299,.271),brush);
          // Break the surface light into short strokes; leave the bottom stationary.
          float flow=sin(vCreekFlowXZ.y*10.8-localTime*1.9+1.65*sin(p.x*4.9+p.y*.7));
          float crest=sin(p.y*4.7+p.x*6.4-localTime*1.24+1.8*sin(p.x*3.1-p.y*.6));
          float highlight=smoothstep(.76,.982,flow*.60+crest*.40);
          float lightPatch=smoothstep(-.15,.82,sin(p.y*1.37+p.x*2.7)+.55*sin(p.x*4.1-p.y*.83));
          diffuseColor.rgb=mix(pool,margin,shoal)+vec3(.12,.17,.17)*highlight*lightPatch;
          diffuseColor.a*=mix(.966,.38,shoal);
        `);
    };
    material.customProgramCacheKey=()=>'lembah-depth-current-v2';
    mesh.userData.rippleUniform=uniform;
    mesh.userData.rippleType='mobile-two-frequency';
    mesh.userData.waterAlbedo=CREEK_WATER_UV.albedoSource;
  }
  return mesh;
}
export function createHomeCreek():THREE.Group{
  const root=new THREE.Group();
  root.name='Meandering shallow creek and earthen banks';
  root.add(creekRibbon(-1),creekRibbon(1),creekRibbon(2),creekRibbon(0),creekRibbon(3));
  root.add(createRockWaterWakes());
  root.userData.flowDirection='upstream-negative-Z-to-downstream-positive-Z';
  return root;
}

/**
 * Disconnected illustrative foam arcs hugging the two real mossy boulder
 * clusters. These are textured decals
 * placed from the submerged GLB footprints in a single instanced draw.
 */
export const ROCK_WAKES=selectedHomeRocks.filter(rock=>rock.submerge!==undefined);
let wakePainting:THREE.DataTexture|undefined;
export function makePaintedRockWake():THREE.DataTexture{
  if(wakePainting)return wakePainting;
  const w=128,h=192,rgba=new Uint8Array(w*h*4);
  for(let py=0;py<h;py++)for(let px=0;px<w;px++){
    const u=(px+.5)/w*2-1,v=(py+.5)/h*2-1;
    const theta=Math.atan2(v,u);
    const radius=Math.hypot(u*1.04,v*1.19);
    const outline=.65+.040*Math.sin(theta*3+.85)+.024*Math.sin(theta*7-.42);
    const facing=.64-.36*v;  // stronger on the upstream face
    const breakup=.32+.68*THREE.MathUtils.smoothstep(Math.sin(theta*6.1+radius*9),-.62,.29);
    const rim=Math.exp(-(((radius-outline)/.036)**2))*breakup*facing;
    const secondary=Math.exp(-(((radius-outline-.13)/.018)**2))*
      THREE.MathUtils.smoothstep(Math.sin(theta*4+.7),.10,.81)*.54;
    const trail=Math.exp(-(((Math.abs(u)-.33-.12*Math.sin(v*5))/.033)**2))*
      THREE.MathUtils.smoothstep(v,.16,.62)*(1-THREE.MathUtils.smoothstep(v,.63,.99));
    const strength=THREE.MathUtils.clamp(1.24*rim+secondary+.38*trail,0,1);
    const i=(py*w+px)*4;
    rgba[i]=242;rgba[i+1]=250;rgba[i+2]=237;
    rgba[i+3]=Math.round(strength*244);
  }
  const texture=new THREE.DataTexture(rgba,w,h,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=THREE.ClampToEdgeWrapping;
  texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;
  return wakePainting=texture;
}
export function createRockWaterWakes():THREE.InstancedMesh{
  const geometry=new THREE.PlaneGeometry(1.60,1.76);
  const material=new THREE.MeshBasicMaterial({
    name:'Hand-painted localized white creek foam',
    map:makePaintedRockWake(),
    transparent:true,opacity:.73,depthWrite:false,toneMapped:false,
    side:THREE.DoubleSide
  });
  const mesh=new THREE.InstancedMesh(geometry,material,ROCK_WAKES.length);
  mesh.name='Painted foam breaking against mossy river boulders';
  const object=new THREE.Object3D();
  for(let i=0;i<ROCK_WAKES.length;i++){
    const wake=ROCK_WAKES[i];
    object.position.set(wake.x,CREEK.waterY+.009,wake.z+.04*wake.size);
    // Plane V points upstream after rotation, matching the brighter impact rim.
    object.rotation.set(-Math.PI/2,0,.11*Math.sin(wake.yaw));
    object.scale.set(wake.size,wake.size,1);
    object.updateMatrix();
    mesh.setMatrixAt(i,object.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;
  mesh.frustumCulled=false;
  mesh.renderOrder=6;
  mesh.castShadow=false;
  mesh.receiveShadow=false;
  return mesh;
}

let creekArtLoad:Promise<[THREE.Texture,THREE.Texture]>|undefined;
async function loadGeneratedCreekFoam(root:THREE.Object3D):Promise<boolean>{
  const foam=root.getObjectByName('Illustrated river foam and flow trails');
  if(!(foam instanceof THREE.Mesh))return false;
  try{
    const atlas=await new THREE.TextureLoader().loadAsync(CREEK_FOAM_ART);
    atlas.colorSpace=THREE.SRGBColorSpace;
    atlas.wrapS=atlas.wrapT=THREE.ClampToEdgeWrapping;
    atlas.anisotropy=4;
    atlas.generateMipmaps=true;
    atlas.needsUpdate=true;
    const mat=foam.material as THREE.MeshBasicMaterial;
    mat.map=atlas;
    mat.needsUpdate=true;
    (foam.userData.foamAtlasReady as {value:number}).value=1;
    foam.userData.foamAtlasSource=CREEK_FOAM_ART;
    root.userData.paintedFoamLoaded=true;
    return true;
  }catch(error){
    console.warn('[LembahAsri] Original creek foam fallback kept',error);
    return false;
  }
}
/** Swap the lightweight placeholders for UV-painted illustrated textures. */
export async function loadPaintedCreekTextures(root:THREE.Object3D):Promise<boolean>{
  const water=root.getObjectByName('Shallow stream west of childhood home');
  const west=root.getObjectByName('Soft west creek bank');
  const east=root.getObjectByName('Soft east creek bank');
  if(!(water instanceof THREE.Mesh)||!(west instanceof THREE.Mesh)||
     !(east instanceof THREE.Mesh))return false;
  const shoreReady=loadRiversidePaint();
  // Foam is optional: broken SVG requests must never hide the river.
  const foamReady=loadGeneratedCreekFoam(root);
  if(!creekArtLoad){
    const loader=new THREE.TextureLoader();
    creekArtLoad=Promise.all([
      loader.loadAsync(CREEK_PAINTED_TEXTURES.water),
      loader.loadAsync(CREEK_PAINTED_TEXTURES.bank)
    ]);
  }
  try{
    const [waterArt,bankArt]=await creekArtLoad;
    for(const texture of [waterArt,bankArt]){
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.wrapS=THREE.ClampToEdgeWrapping;
      texture.wrapT=THREE.RepeatWrapping;
      texture.anisotropy=4;
      texture.generateMipmaps=true;
      texture.needsUpdate=true;
    }
    // Sampling the rotated, optimized authored texture from the actual
    // river mesh UV. Repeat on +Z; cross-section spans exactly one texture.
    waterArt.wrapS=THREE.ClampToEdgeWrapping;
    waterArt.wrapT=THREE.RepeatWrapping;
    waterArt.offset.set(0,0);
    waterArt.needsUpdate=true;
    const waterMat=water.material as THREE.MeshBasicMaterial;
    waterMat.map=waterArt;
    waterMat.color.set('#ffffff');
    waterMat.needsUpdate=true;
    // Mirrored sampling guarantees continuity at original image boundaries
    // even though the supplied image was not authored as a seamless tile.
    // Layered 7.7m detail and 29.3m macro UV are sampled in the bank shader.
    bankArt.wrapT=THREE.MirroredRepeatWrapping;
    bankArt.wrapS=THREE.ClampToEdgeWrapping;
    bankArt.needsUpdate=true;
    for(const bank of [west,east]){
      const mat=(bank as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.map=bankArt;
      mat.color.set('#ffffff');
      mat.needsUpdate=true;
    }
    // Match the bank lip to the actual meadow painting, including mirrored
    // world-UV antitiling. A failed optional load must not remove river art.
    try {
      const meadowArt=await new THREE.TextureLoader().loadAsync('./textures/terrain/village_grass_painted.webp');
      meadowArt.colorSpace=THREE.SRGBColorSpace;
      meadowArt.wrapS=meadowArt.wrapT=THREE.MirroredRepeatWrapping;
      meadowArt.anisotropy=4;
      meadowArt.needsUpdate=true;
      setRiverbankMeadowTexture(west.material as THREE.MeshBasicMaterial,meadowArt);
      setRiverbankMeadowTexture(east.material as THREE.MeshBasicMaterial,meadowArt);
      root.userData.sharedMeadowBankLip=true;
    }catch(error){
      console.warn('[LembahAsri] Keeping riverbank lip colour fallback',error);
    }
    await Promise.all([shoreReady,foamReady]);
    root.userData.paintedCreekLoaded=true;
    root.userData.paintedWaterAsset=CREEK_PAINTED_TEXTURES.water;
    return true;
  }catch(error){
    creekArtLoad=undefined;
    console.warn('[LembahAsri] Keeping creek painted fallback',error);
    return false;
  }
}

export function updateHomeCreekWater(water:THREE.Object3D|undefined,seconds:number):void{
  if(!water)return;
  const uniform=water.userData.rippleUniform as {value:number}|undefined;
  if(uniform)uniform.value=seconds;
  const foam=water.parent?.getObjectByName('Illustrated river foam and flow trails');
  const foamTime=foam?.userData.foamTimeUniform as {value:number}|undefined;
  if(foamTime)foamTime.value=seconds;
  // Slow optical flow of the actual authored river albedo downstream (+Z).
  // UV repeats every 11 m; this is a texture scroll, not a geometric move.
  if(water instanceof THREE.Mesh){
    const material=water.material as THREE.MeshBasicMaterial;
    if(material.map && material.map.wrapT===THREE.RepeatWrapping){
      material.map.offset.y=-(seconds*CREEK_WATER_UV.flowUvUnitsPerSecond)%1;
    }
  }
}

type BankClump={x:number;z:number;scale:number;yaw:number;tint:number};
/**
 * Bank greenery is grouped around boulders, with quiet breaks between.
 * Grass is volumetric low-poly geometry, leafy shrubs use authored leaf UV.
 * Only two InstancedMesh draws, no new colliders or sprites.
 */
export function createHomeCreekVegetation(): THREE.Group {
  const root=new THREE.Group();
  root.name='Curated creek bank reeds and leafy clumps';
  const bankGroups: ReadonlyArray<readonly [number,-1|1,number]>=[
    // Groups continue into the background, framing the stream's origin.
    // Alternating shores create asymmetric, organic planted reaches.
    [-43,-1,.68],[-37,1,.60],[-28,-1,.81],[-21,1,.74],
    [-14,-1,.78],[-8,1,.61],
    [-3.0,-1,1.0],[.9,1,1.08],[4.3,-1,1.05],
    [6.1,1,.72],[11.9,-1,.98],[14.8,1,1.15],
    [18.2,-1,.9],[21.0,1,1.2],[23.1,-1,.78],
    [33,1,.66],[42,-1,.57]
  ];
  let state=161123;
  const rng=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const reeds: BankClump[]=[];
  const shrubs: BankClump[]=[];
  for(const [z,side,intensity] of bankGroups) {
    // Create localized asymmetrical vegetation clumps, not a uniform border.
    const count=Math.round(7*intensity);
    for(let i=0;i<count;i++){
      const zz=z+(rng()-.5)*1.60;
      const edge=creekCenterX(zz)+side*creekWidth(zz)/2;
      const x=edge+side*(.70+.65*rng());
      const scale=(.60+rng()*.67)*intensity;
      reeds.push({x,z:zz,scale,yaw:rng()*Math.PI*2,tint:rng()});
    }
    const leafCount=Math.round(2.3*intensity);
    for(let i=0;i<leafCount;i++){
      const zz=z+(rng()-.5)*1.25;
      const x=creekCenterX(zz)+side*(creekWidth(zz)/2+.83+.44*rng());
      shrubs.push({
        x,z:zz,scale:.43+rng()*.40,
        yaw:rng()*Math.PI*2,tint:rng()
      });
    }
  }
  const instance=new THREE.Object3D();
  const reedMesh=new THREE.InstancedMesh(makeSedgeGeometry(true),
    new THREE.MeshBasicMaterial({
      color:'#ffffff',vertexColors:true,
      side:THREE.DoubleSide,toneMapped:false
    }),reeds.length);
  reedMesh.name='Stream clustered bank grasses';
  for(let i=0;i<reeds.length;i++){
    const p=reeds[i];
    instance.position.set(p.x,Math.max(.052,creekBankLipHeight(p.z)*.92),p.z);
    instance.rotation.set(0,p.yaw,0);
    instance.scale.setScalar(p.scale);
    instance.updateMatrix();
    reedMesh.setMatrixAt(i,instance.matrix);
    reedMesh.setColorAt(i,new THREE.Color(p.tint>.65?'#e8edbc':'#f8f0ca'));
  }
  reedMesh.instanceMatrix.needsUpdate=true;
  if(reedMesh.instanceColor)reedMesh.instanceColor.needsUpdate=true;
  reedMesh.frustumCulled=false;reedMesh.castShadow=false;
  root.add(reedMesh);

  const leafMesh=new THREE.InstancedMesh(makeBroadLeafGeometry(),
    new THREE.MeshBasicMaterial({
      color:'#ffffff',map:makePaintedLeafAlbedo(),
      vertexColors:true,side:THREE.DoubleSide,toneMapped:false
    }),shrubs.length);
  leafMesh.name='Stream broadleaf foliage clusters';
  for(let i=0;i<shrubs.length;i++){
    const p=shrubs[i];
    instance.position.set(p.x,Math.max(.045,creekBankLipHeight(p.z)*.85),p.z);
    instance.rotation.set(0,p.yaw,0);
    instance.scale.setScalar(p.scale);
    instance.updateMatrix();
    leafMesh.setMatrixAt(i,instance.matrix);
    leafMesh.setColorAt(i,new THREE.Color(p.tint>.65?'#77a75d':'#91b86b'));
  }
  leafMesh.instanceMatrix.needsUpdate=true;
  if(leafMesh.instanceColor)leafMesh.instanceColor.needsUpdate=true;
  leafMesh.frustumCulled=false;leafMesh.castShadow=false;
  root.add(leafMesh);
  // A handful of flower patches sit just above the grass line on the shoulders.
  const flowers=new THREE.InstancedMesh(makeBankFlowerGeometry(),
    new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false}),
    bankGroups.length*3);
  flowers.name='White wildflowers along the grassy creek';
  let flowerIndex=0;
  for(const [z,side] of bankGroups) {
    for(const shift of [-.92,.18,.94]) {
      const zz=z+shift;
      const inland=1.23+rng()*.44;
      instance.position.set(creekCenterX(zz)+side*(creekWidth(zz)*.5+inland),
        creekBankLipHeight(zz)+.028,zz);
      instance.rotation.set(0,rng()*6.28,0);
      instance.scale.setScalar(.87+rng()*.55);
      instance.updateMatrix();
      flowers.setMatrixAt(flowerIndex++,instance.matrix);
    }
  }
  flowers.computeBoundingSphere();
  root.add(flowers);
  root.userData.clusters=bankGroups.length;
  root.userData.reedInstances=reeds.length;
  root.userData.shrubInstances=shrubs.length;
  return root;
}
