import * as THREE from 'three';
import { BARK_ATLAS_SIZE, paintBarkUVAtlas, addUnwrappedBarkTube } from '../../scripts/tree-bark-uv.mjs';

/**
 * True 3D stylized trees with baked painterly UV albedo.
 *
 * Unlike the old four untextured ico-spheres, the crown is made of distinct
 * curved, textured leaves with visible midribs and varied color families.
 * The trunk and its branches share a seamless bark UV texture.
 *
 * Render cost per tree: two draw calls (bark, leaf crown), no sprites,
 * camera-facing cards, external URLs or PBR plastic lighting.
 */
export type PaintedTreeKind = 'orchard' | 'shade';
export type PaintedTreeOptions = {
  kind: PaintedTreeKind;
  seed?: number;
  height?: number;
};

let barkAtlas: THREE.DataTexture | undefined;
let leavesAtlas: THREE.DataTexture | undefined;

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function colorChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function noiseAt(x: number, y: number, seed: number): number {
  let v = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const top = THREE.MathUtils.lerp(noiseAt(ix,iy,seed), noiseAt(ix+1,iy,seed), u);
  const bottom = THREE.MathUtils.lerp(noiseAt(ix,iy+1,seed), noiseAt(ix+1,iy+1,seed), u);
  return THREE.MathUtils.lerp(top, bottom, v);
}

/** 256px opaque sRGB hand-painted bark: longitudinal grain, warm highlights, moss. */
/** The emergency fallback uses exactly the same UV layout + albedo as the
 * generated GLB, rather than a differently mapped striped procedural wood.
 */
export function makePaintedBarkAtlas(): THREE.DataTexture {
  if (barkAtlas) return barkAtlas;
  const texture=new THREE.DataTexture(
    paintBarkUVAtlas(), BARK_ATLAS_SIZE,BARK_ATLAS_SIZE,THREE.RGBAFormat
  );
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=THREE.ClampToEdgeWrapping;
  texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.anisotropy=4;
  texture.needsUpdate=true;
  barkAtlas=texture;
  return texture;
}

/**
 * 2x2 leaf atlas with four different naturally painted green pigments:
 * lit-lime, warm-mid green, shade-green, young yellow-green.
 * Every leaf has UVs inside a quarter tile (with mip-safe gutters).
 */
export function makePaintedLeafAtlas(): THREE.DataTexture {
  if (leavesAtlas) return leavesAtlas;
  const size = 256, pixels = new Uint8Array(size * size * 4);
  const bases = [
    [124, 177, 84], [100, 159, 81],
    [74, 131, 74], [141, 186, 101]
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const family = Math.floor(x / 128) + Math.floor(y / 128) * 2;
      const u = ((x % 128) + .5) / 128;
      const v = ((y % 128) + .5) / 128;
      const broad = smoothNoise(x / 22, y / 24, 16);
      const pigment = smoothNoise(x / 5.3, y / 8, 39);
      // Vein, branching veins and a gently shaded outer edge are painted into UVs.
      const vein = Math.exp(-Math.abs(u - .5) * 38) * 21;
      const sideVeins = Math.max(0,
        Math.cos((v * 8.7 + u * (u < .5 ? -2.3 : 2.3)) * Math.PI)) *
        Math.pow(Math.sin(Math.PI * u), 2) * 6;
      const border = Math.abs(u - .5) * 20;
      const gradient = -9 * (1 - v);
      const wash = 0.80 + broad * .27 + pigment * .13;
      const [r,g,b] = bases[family];
      const idx = (y * size + x) * 4;
      pixels[idx] = colorChannel(r * wash + vein * .76 + sideVeins - border + gradient);
      pixels[idx + 1] = colorChannel(g * wash + vein + sideVeins - border * .6 + gradient);
      pixels[idx + 2] = colorChannel(b * wash + vein * .52 + sideVeins * .4 - border*.3 + gradient);
      pixels[idx + 3] = 255;
    }
  }
  const map = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 4;
  map.needsUpdate = true;
  leavesAtlas = map;
  return map;
}

function makeBarkGeometry(_kind: PaintedTreeKind, random: () => number): THREE.BufferGeometry {
  const g={p:[] as number[],uv:[] as number[],idx:[] as number[],colors:[] as number[]};
  const spine=[
    [0,0,0],[.06,.93,.01],[-.06,1.80,-.04],
    [.045,2.55,.07],[-.035,3.32,.02]
  ];
  const widths=[.35,.28,.20,.12,.042];
  addUnwrappedBarkTube(g,spine,widths,11,'trunk');
  for(let k=0;k<7;k++){
    const a=k*Math.PI*2/7;
    addUnwrappedBarkTube(g,[
      [.065*Math.cos(a),.36,.065*Math.sin(a)],
      [.47*Math.cos(a),.035,.47*Math.sin(a)]
    ],[.14,.043],6,'twig',k);
  }
  const boughs=6;
  for(let k=0;k<boughs;k++){
    const a=k*Math.PI*2/boughs+(random()-.5)*.32;
    const y=1.85+(k%3)*.30,reach=1.17+random()*.52;
    const start=[.055*Math.cos(a),y,.055*Math.sin(a)];
    const elbow=[reach*.63*Math.cos(a),y+.38,reach*.63*Math.sin(a)];
    const tip=[reach*Math.cos(a),y+.59,reach*Math.sin(a)];
    addUnwrappedBarkTube(g,[start,elbow,tip],[.135,.076,.030],8,'bough',k);
    const side=a+(k%2?-.68:.68);
    const twig=[
      elbow[0]+(.46+random()*.25)*Math.cos(side),
      elbow[1]+.24+random()*.16,
      elbow[2]+(.46+random()*.25)*Math.sin(side)
    ];
    addUnwrappedBarkTube(g,[elbow,twig],[.051,.018],6,'twig',k+1);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(g.p,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(g.uv,2));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(g.colors,3));
  geo.setIndex(g.idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.userData.uvLayout='separate-unwrapped-painterly-islands';
  return geo;
}

type FoliageVertex = {
  p: THREE.Vector3;
  u: number;
  v: number;
  brightness: number;
};

function createCrownGeometry(kind: PaintedTreeKind, random: () => number): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], uv: number[] = [];
  const yOffset = kind === 'orchard' ? -.10 : 0;
  const lobes = [
    { x: .02,  y: 3.31, z: .02,  rx: .97, ry: .68, rz: .91, n: 48 },
    { x: -1.12,y: 3.15, z: .09,  rx: .81, ry: .62, rz: .79, n: 42 },
    { x: 1.08, y: 3.18, z: -.18, rx: .86, ry: .66, rz: .80, n: 41 },
    { x: -.24, y: 3.21, z: 1.06, rx: .79, ry: .66, rz: .72, n: 37 },
    { x: .27,  y: 3.29, z: -1.06,rx: .76, ry: .65, rz: .78, n: 35 },
    { x: -.41, y: 3.99, z: .21,  rx: .70, ry: .56, rz: .66, n: 34 },
    { x: .56,  y: 3.89, z: -.17, rx: .68, ry: .58, rz: .67, n: 33 },
    { x: -1.01,y: 2.56, z: .27,  rx: .59, ry: .44, rz: .59, n: 28 },
    { x: .97,  y: 2.61, z: .28,  rx: .61, ry: .44, rz: .56, n: 27 }
  ];
  const centers: THREE.Vector3[] = [];
  for (const lobe of lobes) {
    for (let i = 0; i < lobe.n; i++) {
      const theta = random() * Math.PI * 2;
      const v = random() * 2 - 1;
      const rad = Math.sqrt(1 - v * v);
      const shell = (i % 7 === 0 ? .38 : .66) + random() * .28;
      centers.push(new THREE.Vector3(
        (kind === 'orchard' ? .89 : 1) * (lobe.x + rad * Math.cos(theta) * lobe.rx * shell),
        lobe.y + yOffset + v * lobe.ry * shell,
        (kind === 'orchard' ? .90 : 1) * (lobe.z + rad * Math.sin(theta) * lobe.rz * shell)
      ));
    }
  }
  const trianglesPerLeaf = 12;
  function emit(v: FoliageVertex) {
    positions.push(v.p.x,v.p.y,v.p.z);
    colors.push(v.brightness, v.brightness*.995, v.brightness*.955);
    uv.push(v.u,v.v);
  }
  function tri(a:FoliageVertex,b:FoliageVertex,c:FoliageVertex) {
    emit(a);emit(b);emit(c);
  }
  // Sparse individual leaf silhouettes are visually unconvincing at distance.
  // Cluster with dense overlapping leaves of different sizes/orientations.
  for (let c=0; c<centers.length; c++) {
    const center=centers[c];
    const leafCount = 1; // each clustered point owns one large painted leaf
    for (let l=0;l<leafCount;l++) {
      const point = new THREE.Vector3(
        center.x+(random()-.5)*.72,
        center.y+(random()-.5)*.50,
        center.z+(random()-.5)*.72
      );
      const radial = new THREE.Vector3(point.x,0,point.z);
      if (radial.lengthSq() < .001) radial.set(1,0,0);
      radial.normalize();
      const angle = random()*Math.PI*2;
      const tangent = new THREE.Vector3(
        Math.cos(angle), 0, Math.sin(angle)
      );
      const direction = tangent.multiplyScalar(.56)
        .addScaledVector(radial,.44)
        .add(new THREE.Vector3(0,-.20+random()*.43,0)).normalize();
      const widthDir = new THREE.Vector3(-direction.z,.035,direction.x).normalize();
      const ridge = new THREE.Vector3().crossVectors(widthDir,direction).normalize();
      const length = (kind === 'shade' ? .59 : .63) + random() * .21;
      const breadth = .12 + random() * .045;
      const pigment = (Math.floor(random()*4))%4;
      const lowU=(pigment%2)*.5+.028, lowV=Math.floor(pigment/2)*.5+.028;
      const span=.444;
      const tone=.91+random()*.09;
      const at=(t:number,side:-1|0|1):FoliageVertex => {
        const envelope=Math.pow(Math.sin(Math.PI*t),.75);
        const s=breadth*side*envelope;
        const p=point.clone().addScaledVector(direction,length*t)
          .addScaledVector(widthDir,s)
          .addScaledVector(ridge,.025*envelope*(side===0?1:.18));
        p.y -= .055*t*t;
        return {
          p, u: lowU+span*(side===-1?.07:side===1?.93:.5),
          v:lowV+span*(.035+.93*t), brightness:tone*(side===0?1:.94)
        };
      };
      const steps=3;
      for(let j=0;j<steps;j++) {
        const t0=j/steps,t1=(j+1)/steps;
        const a=at(t0,-1),b=at(t0,0),d=at(t0,1);
        const e=at(t1,-1),f=at(t1,0),g=at(t1,1);
        tri(a,e,b);tri(b,e,f);tri(b,f,d);tri(d,f,g);
      }
    }
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geom.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  geom.userData = { leafCount: positions.length/(trianglesPerLeaf*3),
    texturedLeafCrown:true, layeredCenters:centers.length,
    layeredClusters: lobes.length };
  return geom;
}

/**
 * Returns actual 3D game meshes with reusable UV textures. Scale the whole
 * tree uniformly, never stretch one coordinate independently.
 */
export function createPaintedStoryTree({
  kind, seed=52027, height=4.6
}: PaintedTreeOptions): THREE.Group {
  if (!Number.isFinite(height) || height<=0) throw new Error('Invalid tree height');
  const random=seeded(seed);
  const root=new THREE.Group();
  root.name=kind==='shade'?'UV painted shade tree':'UV painted orchard fruit tree';
  const bark=new THREE.Mesh(makeBarkGeometry(kind,random),
    new THREE.MeshBasicMaterial({
      color:'#ffffff',map:makePaintedBarkAtlas(),vertexColors:true,toneMapped:false
    }));
  bark.name='UV hand-painted tree trunk and branches';
  bark.castShadow=true;
  bark.receiveShadow=false;
  root.add(bark);
  const crown=new THREE.Mesh(createCrownGeometry(kind,random),
    new THREE.MeshBasicMaterial({
      color:'#ffffff', map:makePaintedLeafAtlas(), vertexColors:true,
      side:THREE.DoubleSide, toneMapped:false
    }));
  crown.name='Layered individual UV-painted tree leaves';
  crown.castShadow=true;
  crown.receiveShadow=false;
  root.add(crown);
  root.scale.setScalar(height/(kind==='shade'?4.8:4.5));
  root.userData.treeRenderStyle='real-3d-uv-painted-not-solid-color';
  root.userData.treeSeed=seed;
  return root;
}
