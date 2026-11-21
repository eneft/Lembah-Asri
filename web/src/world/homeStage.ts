import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createTerrainMaterial, createPaintedTerrainPlane, makeTerrainEdgeMask, type TerrainSurface } from './terrainMaterials.ts';
import { createHomeGroundDetails } from './homeGroundDetails.ts';
import { createHouseGroundTransition, featherMergedHouseGround, createHouseContactShadow } from './houseTerrainSeam.ts';
import { createHomeArtPass } from './homeArtPass.ts';
import { createPaintedStoryTree } from './paintedTrees.ts';
import { loadPaintedTreeSource, instantiatePaintedTree } from './treeAsset.ts';
import { attachCuratedHomeRocks } from './homeRocks.ts';
import { createHomeCreek, createHomeCreekVegetation, carveVisualCreek } from './homeCreek.ts';

/**
 * The player's childhood home in the same continuous 3D world as the village.
 * Coordinates are metres, Y=0 is the walking floor, and the front door faces +Z.
 * No animals or cultivated crops: this place has been abandoned for years.
 */
export const HOME = {
  // Option B: ~74% larger linear footprint than the previously rendered
  // 5.5 m imported GLB. Keep X/Z scale uniform to preserve the approved art.
  house: { x: -32.5, z: -9.4, width: 9.6, depth: 9.6, height: 5.85 },
  spawn: { x: -29.5, y: 1.2, z: 7.4 },
  gate: { x: -16.5, z: 9 },
  villageRoad: { x: 0, z: 9 },
  garden: { x: -22, z: 0.5 },
  well: { x: -39, z: 4 },
  stream: { x: -45.5, z: 9 }
} as const;

/**
 * Fit the approved house to the larger Option-B footprint *uniformly*.
 * This is intentionally not a non-uniform X/Z stretch: doors, roof tiles,
 * UVs, hand-painted atlas and architectural proportions stay intact.
 */
export function computeHouseScale(size: Pick<THREE.Vector3, 'x' | 'y' | 'z'>): number {
  if (size.x <= 0 || size.y <= 0 || size.z <= 0
    || !Number.isFinite(size.x) || !Number.isFinite(size.y) || !Number.isFinite(size.z)) {
    throw new Error('Invalid source house dimensions');
  }
  return Math.min(
    HOME.house.width / size.x,
    HOME.house.depth / size.z,
    HOME.house.height / size.y
  );
}

export type SolidCollider = {
  center: [number, number, number];
  half: [number, number, number];
  label: string;
};
export type HomeStage = {
  root: THREE.Group;
  solids: SolidCollider[];
  cameraBlockers: THREE.Object3D[];
  ready: Promise<boolean>;
};

const mat = (hex: string) => new THREE.MeshBasicMaterial({ color: hex, toneMapped: false });

/** Creates a real geometry mesh. Shadow casting is optional for small props. */
function box(
  parent: THREE.Object3D, label: string, size: [number, number, number],
  at: [number, number, number], material: THREE.Material, shadow = true
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = label;
  mesh.position.set(...at);
  mesh.castShadow = shadow;
  parent.add(mesh);
  return mesh;
}
function cylinder(
  parent: THREE.Object3D, label: string, top: number, bottom: number, height: number,
  at: [number, number, number], material: THREE.Material, sides = 10
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, sides), material);
  mesh.name = label;
  mesh.position.set(...at);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function floorPatch(
  parent: THREE.Object3D, label: string, width: number, depth: number,
  x: number, z: number, color: string, elevation = 0.025,
  surface?: TerrainSurface, feathered = false
) {
  const mesh = surface
    ? createPaintedTerrainPlane(surface, width, depth, x, z, elevation, feathered)
    : new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        new THREE.MeshBasicMaterial({ color, toneMapped: false })
      );
  mesh.name = label;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, elevation, z);
  // Fixed overlay order prevents dirt/path layers from popping during camera
  // motion while feathered alpha masks handle the meadow-to-earth transition.
  if (feathered) {
    mesh.renderOrder = surface === 'path' ? 3 : surface === 'soil' ? 2 : 1;
  }
  parent.add(mesh);
  return mesh;
}

function buildLocalHouseFallback(root: THREE.Object3D): THREE.Group {
  // Stylized one-storey Indonesian village house, kept as a genuine 3D backup.
  // Replaced by the original approved GLB once downloaded and decoded.
  const group = new THREE.Group();
  group.name = 'Rumah Masa Kecil - fallback geometry';
  group.position.set(HOME.house.x, 0, HOME.house.z);
  // The original FBX-independent fallback was smaller than the approved GLB.
  // Increase its footprint, veranda and roof as one coherent backup building.
  // Leave the approved imported GLB unchanged.
  group.scale.set(1.28, 1.38, 1.15);
  root.add(group);

  const plaster = mat('#e7ddbc');
  const teal = mat('#53847b');
  const timber = mat('#76573d');
  const roof = mat('#b96748');
  const roofLight = mat('#cb7c55');

  box(group, 'Aged plaster walls', [7.5, 3.05, 5.5], [0, 1.525, 0], plaster);
  for (const x of [-3.7, 3.7]) {
    box(group, 'Teal structural posts', [0.2, 3.2, 0.23], [x, 1.6, 2.78], teal);
  }
  box(group, 'Front horizontal beam', [7.6, 0.19, 0.22], [0, 2.98, 2.78], teal);
  box(group, 'Timber front door', [1.22, 2.22, 0.12], [0.35, 1.11, 2.8], timber);
  box(group, 'Door lintel', [1.45, 0.14, 0.16], [0.35, 2.3, 2.83], teal);
  for (const x of [-2.18, 2.34]) {
    box(group, 'Teal shutter', [1.15, 1.2, 0.13], [x, 1.8, 2.83], teal);
    box(group, 'Dark window inset', [0.76, 0.87, 0.14], [x, 1.8, 2.91], mat('#405958'));
  }
  box(group, 'Timber veranda', [8.2, 0.25, 2], [0, 0.22, 3.4], timber);
  for (const x of [-3.45, 3.45]) {
    box(group, 'Veranda posts', [0.17, 2.6, 0.17], [x, 1.52, 4.12], teal);
  }
  box(group, 'Veranda beam', [7.3, 0.19, 0.17], [0, 2.8, 4.13], teal);
  // Two terracotta roof planes with a ridge along X and a generous eave.
  const front = box(group, 'Terracotta roof front', [8.6, 0.24, 3.6], [0, 3.69, 1.6], roof);
  front.rotation.x = 0.34;
  const rear = box(group, 'Terracotta roof back', [8.6, 0.24, 3.6], [0, 3.69, -1.6], roofLight);
  rear.rotation.x = -0.34;
  box(group, 'Roof ridge', [8.7, 0.22, 0.23], [0, 4.25, 0], roof);
  box(group, 'Veranda wooden bench', [1.25, 0.14, 0.5], [-2.25, 0.65, 3.4], timber);
  return group;
}

function addAbandonedPlots(root: THREE.Object3D) {
  const earth = createTerrainMaterial('soil', 2.35, 1.55);
  const edges = mat('#a2875c');
  const dryWeeds = [mat('#7b8553'), mat('#8f9365')];
  const patches = [
    [-24.8, -0.5], [-21.8, -0.5], [-18.8, -0.5],
    [-24.8, 1.8], [-21.8, 1.8], [-18.8, 1.8]
  ];
  for (const [x, z] of patches) {
    box(root, 'Empty abandoned soil plot', [2.35, 0.09, 1.55], [x, 0.078, z], earth, false);
    for (const offset of [-1.05, 1.05]) {
      box(root, 'Dry plot border', [0.07, 0.14, 1.65], [x + offset, 0.12, z], edges, false);
    }
  }
  // A few weeds at the borders only. No productive crops, flowers, livestock.
  const weeds = [[-26, 2.8], [-18, -2], [-21, 3.1], [-25.9, -2.1], [-17.4, 2.5]];
  weeds.forEach(([x, z], i) => {
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.48, 5), dryWeeds[i % dryWeeds.length]
    );
    leaf.name = 'Sparse border weed';
    leaf.position.set(x, 0.30, z);
    root.add(leaf);
  });
}

function addShed(root: THREE.Object3D) {
  const g = new THREE.Group();
  g.name = 'Empty timber storage shed';
  g.position.set(-22, 0, -10.4);
  root.add(g);
  const wood = mat('#806147');
  const dark = mat('#604b39');
  const rusty = mat('#ab7657');
  box(g, 'Shed walls', [3.5, 2.35, 3.0], [0, 1.17, 0], wood);
  for (const x of [-1.65, 1.65]) {
    box(g, 'Shed frame', [0.13, 2.5, 0.17], [x, 1.25, 1.55], dark);
  }
  const roof = box(g, 'Lean-to roof', [4.1, 0.15, 3.5], [0, 2.56, 0], rusty);
  roof.rotation.z = -0.13;
  box(g, 'Shed opening', [1.33, 1.77, 0.04], [0.52, 0.95, 1.56], dark);
  for (let i = 0; i < 4; i++) {
    cylinder(g, 'Stored timber logs', 0.1, 0.1, 1.6,
      [-1.18 + i * 0.23, 0.24, 2.0], wood, 7).rotation.z = Math.PI / 2;
  }
}

/** 
 * One hand-painted UV atlas, with *separate* stone and timber surfaces.
 * Stone occupies atlas pixels y=0..255, wood grain/end grain y=256..511.
 * Keep the actual masonry/wood as 3D meshes; no billboard or PBR re-lighting.
 */
function addStoneWell(root: THREE.Object3D, loadTexture: boolean) {
  const wellMat = (color: string, surface: 'stone' | 'coping' | 'inner-stone' | 'timber') => {
    const material = new THREE.MeshBasicMaterial({
      color, toneMapped: false, vertexColors: surface !== 'timber'
    });
    material.userData.wellSurface = surface;
    return material;
  };
  const stone = wellMat('#999887', 'stone');
  const coping = wellMat('#a9a693', 'coping');
  const inner = wellMat('#696e65', 'inner-stone');
  const timber = wellMat('#966d49', 'timber');

  if (loadTexture) {
    new THREE.TextureLoader().load('./textures/props/well.webp', texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping; // continuous courses at the ring seam
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.anisotropy = 8;
      for (const material of [stone, coping, inner, timber]) {
        material.map = texture;
        // The atlas is already painted/shaded. Preserve its original albedo,
        // with a darker well interior and slightly warmer capstones.
        material.color.set(
          material === inner ? '#a3a49a' :
          material === coping ? '#f5f0e5' : '#ffffff'
        );
        material.needsUpdate = true;
      }
    }, undefined, error => console.warn('[LembahAsri] Well texture unavailable', error));
  }

  // Each course samples only the stone half of the atlas. The vertex tint is
  // baked color variation (not dynamic lighting) and keeps the stones organic.
  function masonryBand(
    name: string, profile: number[][], pixelRows: number[],
    material: THREE.MeshBasicMaterial
  ) {
    const geometry = new THREE.LatheGeometry(
      profile.map(([radius, height]) => new THREE.Vector2(radius, height)), 32
    );
    const uv = geometry.getAttribute('uv');
    const position = geometry.getAttribute('position');
    const colors = new Float32Array(uv.count * 3);
    const isInner = material === inner;
    for (let i = 0; i < uv.count; i++) {
      const angle = uv.getX(i) * Math.PI * 2;
      // Leave a clear buffer from the wood region to avoid brown mip bleeding
      // into capstones, especially at third-person camera distances.
      uv.setY(i, 1 - pixelRows[i % profile.length] / 512);
      const variation = Math.sin(angle * 7 + 0.8) * 0.012
        + Math.sin(angle * 11 - 0.4) * 0.007;
      if (!isInner) {
        const radius = Math.hypot(position.getX(i), position.getZ(i));
        if (radius > 0.01) {
          const scale = (radius + variation) / radius;
          position.setXYZ(i, position.getX(i) * scale, position.getY(i), position.getZ(i) * scale);
        }
      }
      const shade = Math.max(0.88, Math.min(1,
        0.955 + 0.027 * Math.sin(angle * 7 + 1.1)
        + 0.016 * Math.cos(angle * 11 - 0.6)
        + (material === coping ? 0.018 : 0)));
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade * 0.992;
      colors[i * 3 + 2] = shade * 0.978;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(HOME.well.x, 0, HOME.well.z);
    mesh.castShadow = true;
    root.add(mesh);
  }
  masonryBand('Old village well stone rim', [[0.9, 0], [0.85, 0.68]], [190, 3], stone);
  masonryBand('Well coping stones', [[0.85, 0.68], [0.89, 0.71], [0.87, 0.79],
    [0.84, 0.81], [0.65, 0.81], [0.62, 0.77]], [238, 232, 225, 218, 201, 194], coping);
  masonryBand('Inner well masonry', [[0.62, 0.77], [0.62, 0.13]], [3, 189], inner);
  cylinder(root, 'Well opening', 0.625, 0.625, 0.02,
    [HOME.well.x, 0.14, HOME.well.z], mat('#364c50'), 32);

  function beam(name: string, length: number, x: number, y: number) {
    const mesh = box(root, name, [0.15, length, 0.17], [x, y, HOME.well.z], timber);
    const uv = mesh.geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 4);
      const end = face === 2 || face === 3;
      const side = [0, 2, 0, 0, 1, 3][face];
      // Long-grain follows the beam; short end faces use the concentric rings
      // on the right of the timber atlas. Stay clear of stone/wood seam.
      const u = end ? 0.63 + uv.getX(i) * 0.24 : (side + uv.getX(i) * 0.98) / 8;
      uv.setXY(i, u, 0.03 + uv.getY(i) * 0.44);
    }
    return mesh;
  }
  for (const offset of [-0.92, 0.92]) {
    beam('Well timber post', 2.1, HOME.well.x + offset, 1.1);
  }
  beam('Well crossbar', 2.05, HOME.well.x, 2.18).rotation.z = Math.PI / 2;
}

function addWellAndFruitTree(root: THREE.Object3D, loadTexture: boolean) {
  addStoneWell(root, loadTexture);
  // Actual stylized 3D tree with a UV-painted wood trunk and layered,
  // individually shaped textured leaves. No untextured ico-sphere crown.
  const tree = createPaintedStoryTree({
    kind: 'orchard', seed: 210917, height: 3.65
  });
  tree.name = 'Old fruit tree';
  tree.position.set(-40, 0, 8.3);
  root.add(tree);
}

function addWoodenFence(
  root: THREE.Object3D, solids: SolidCollider[], label: string,
  x: number, z: number, length: number, direction: 'x' | 'z'
) {
  if (length < 0.6) return;
  const timber = mat('#907352');
  const size: [number, number, number] =
    direction === 'x' ? [length, 0.16, 0.12] : [0.12, 0.16, length];
  for (const y of [0.69, 1.18]) box(root, label + ' timber rails', size, [x, y, z], timber);
  const postCount = Math.max(2, Math.ceil(length / 2.1) + 1);
  for (let i = 0; i < postCount; i++) {
    const delta = -length / 2 + (length * i) / (postCount - 1);
    const px = x + (direction === 'x' ? delta : 0);
    const pz = z + (direction === 'z' ? delta : 0);
    box(root, label + ' fence post', [0.15, 1.48, 0.15], [px, 0.74, pz], timber);
  }
  solids.push({
    label,
    center: [x, 0.77, z],
    half: direction === 'x' ? [length / 2, 0.77, 0.12] : [0.12, 0.77, length / 2]
  });
}

function addStreamAndBridge(root: THREE.Object3D) {
  // Sunken real cross-section, UV-painted riverbed + flowing translucent water.
  // The large visual grass/shadow planes must also be carved to see below Y=0.
  root.add(createHomeCreek());
  // Dense growth only around the major stone clusters, never on the bridge.
  root.add(createHomeCreekVegetation());
  const stones = mat('#92978a');
  for (let i = 0; i < 26; i++) {
    const z = -4 + i * 1.06;
    for (const side of [-1, 1]) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.23 + (i % 3) * 0.07, 0), stones
      );
      rock.name = 'Stream bank stone';
      rock.scale.set(1.3, 0.45, 0.75);
      rock.position.set(-45.5 + side * 1.48, 0.11, z);
      root.add(rock);
    }
  }
  // A western connector bridge; no decorative 'floating island' boundary.
  box(root, 'West wooden bridge walkway', [5.1, 0.2, 2.4], [-45.5, 0.18, 8.6], mat('#9d7751'));
  for (const z of [7.5, 9.7]) {
    for (const x of [-47.7, -43.3]) {
      box(root, 'Bridge timber rail post', [0.13, 0.86, 0.13], [x, 0.66, z], mat('#73563c'));
    }
  }
}

/**
 * Creates the home-area geometry synchronously and loads the existing GLB
 * asynchronously, keeping a fallback house if the model is unavailable.
 * On the existing continuous 160 m world ground, all props are 3D geometry.
 */
export function createHomeStage(loadApprovedModel = true): HomeStage {
  const root = new THREE.Group();
  root.name = 'Rumah Masa Kecil / Playable House Garden';
  const solids: SolidCollider[] = [];
  const cameraBlockers: THREE.Object3D[] = [];

  // Earth clearing with no cultivated flowers or crops; connects directly
  // to the existing village, without a floating island/cliff edge.
  const clearing = carveVisualCreek(floorPatch(root,
    'Childhood courtyard - earth clearing', 32, 29, -29, 0.4,
    '#ac9575', 0.028, 'earth', true));
  const worn = floorPatch(root, 'Worn central courtyard', 15, 12, -29, 5.2, '#b7a07c', 0.052, 'soil', true);
  floorPatch(root, 'Path from the house gate to the village', 22, 3.3, -8.5, HOME.gate.z, '#b9a27d', 0.066, 'path', true);
  // A wider approach helps the enlarged house read as the protagonist's home.
  // Ends at the actual front wall rather than diving under the house.
  const entrance = floorPatch(root, 'House entrance footpath', 3.8, 12.8,
    HOME.house.x, 2.4, '#baa17a', 0.078, 'path', true);

  // The GLB soil edge now samples this SAME authored courtyard albedo.
  // Await the shared image when attaching the imported building so the seam
  // cannot briefly render black while its map is still downloading.
  const courtyardAlbedo: Promise<THREE.Texture | undefined> = loadApprovedModel
    ? new THREE.TextureLoader().loadAsync('./textures/terrain/home_courtyard.webp')
      .then(texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        texture.needsUpdate = true;
        // Local UVs place the painting once on the 32 x 29 m clearing.
        const material = new THREE.MeshBasicMaterial({
          map: texture, alphaMap: makeTerrainEdgeMask(), transparent: true,
          depthWrite: false, toneMapped: false
        });
        const painted = new THREE.Mesh(clearing.geometry, material);
        painted.name = 'Painted childhood courtyard';
        carveVisualCreek(painted);
        painted.rotation.copy(clearing.rotation);
        painted.position.copy(clearing.position);
        painted.renderOrder = clearing.renderOrder;
        root.add(painted);
        clearing.visible = worn.visible = entrance.visible = false;
        return texture;
      })
      .catch(error => {
        console.warn('[LembahAsri] Using fallback courtyard', error);
        return undefined;
      })
    : Promise.resolve(undefined);

  const fallback = buildLocalHouseFallback(root);
  addAbandonedPlots(root);
  addShed(root);
  addWellAndFruitTree(root, loadApprovedModel);
  // Keep fallback tree while the 3D GLB downloads. Replace it with the actual
  // voluminous alpha-cutout textured orchard tree when the asset is ready.
  const orchardReady: Promise<boolean> = loadApprovedModel
    ? loadPaintedTreeSource('orchard')
      .then(source => {
        const oldTree = root.getObjectByName('Old fruit tree');
        if (oldTree) root.remove(oldTree);
        const tree = instantiatePaintedTree(source, 3.65, -40, 8.3, 0.21);
        tree.name = 'Old fruit tree';
        root.add(tree);
        return true;
      }).catch(error => {
        console.warn('[LembahAsri] Keeping orchard tree fallback', error);
        return false;
      })
    : Promise.resolve(false);
  addStreamAndBridge(root);
  // Original 16-variation stone GLB loads once. Until ready, retain the old
  // simple stream stones as a safe fallback; remove and dispose only after
  // the UV-textured original rocks have been attached successfully.
  const rockReady: Promise<boolean> = loadApprovedModel
    ? attachCuratedHomeRocks(root).then(() => {
        const oldStones = root.children.filter(child => child.name === 'Stream bank stone');
        let stoneMaterial: THREE.Material | undefined;
        for (const stone of oldStones) {
          root.remove(stone);
          if (stone instanceof THREE.Mesh) {
            stone.geometry.dispose();
            stoneMaterial = Array.isArray(stone.material) ? stone.material[0] : stone.material;
          }
        }
        stoneMaterial?.dispose();
        // Original UV rock pack replaces the old procedural pebble scatter
        // as well. Keep the grass, painted soil and intentional stepping stones.
        // Only remove the placeholder stones AFTER 29 new placements exist.
        const details = root.getObjectByName('Childhood home organic ground details');
        if (details) {
          for (const child of [...details.children]) {
            if (!child.name.startsWith('Textured natural stones variant ')) continue;
            details.remove(child);
            if (child instanceof THREE.Mesh) child.geometry.dispose();
          }
        }
        console.info('[LembahAsri] Original 16-variant rocks now visible: 29 curated placements');
        return true;
      }).catch(error => {
        console.warn('[LembahAsri] Keeping old bank-stone fallback', error);
        return false;
      })
    : Promise.resolve(false);
  // Paint-in real grass and stones along the worn yard boundary; leave paths clear.
  root.add(createHomeGroundDetails());
  // Additional genuine 3D foliage and textured stones, matching the approved
  // painterly courtyard reference without altering the approved house model.
  root.add(createHomeArtPass());
  // Real house GLB contains a painted soil skirt. Blend its contact area into
  // the existing world-UV earth below instead of creating a separate island.
  root.add(createHouseGroundTransition(
    HOME.house.x, HOME.house.z, HOME.house.width, HOME.house.depth
  ));
  // Very soft contact under the FRONT foundation, not a glowing painted rim.
  root.add(createHouseContactShadow(
    HOME.house.x, HOME.house.z + HOME.house.depth / 2 + 0.12,
    HOME.house.width + 0.75, 2.5
  ));

  // Fence boundary with a 5 m gap facing the connected village road.
  addWoodenFence(root, solids, 'North rear fence', -30.5, -16.5, 27, 'x');
  addWoodenFence(root, solids, 'South front fence', -31, 15, 26, 'x');
  addWoodenFence(root, solids, 'East side fence north', -16.8, -6.2, 19, 'z');
  addWoodenFence(root, solids, 'East side fence south', -16.8, 13.7, 2.6, 'z');
  addWoodenFence(root, solids, 'West side fence north', -43.8, -11.6, 9.3, 'z');
  addWoodenFence(root, solids, 'West side fence south', -43.8, 13.7, 2.6, 'z');

  // Player cannot walk through house walls or the storage structure.
  solids.push({
    label: 'Childhood home walls',
    center: [HOME.house.x, HOME.house.height / 2, HOME.house.z],
    half: [HOME.house.width / 2 + 0.15, HOME.house.height / 2, HOME.house.depth / 2 + 0.15]
  }, {
    label: 'Storage shed walls',
    center: [-22, 1.2, -10.4],
    half: [1.75, 1.2, 1.5]
  }, {
    label: 'Old village well',
    center: [HOME.well.x, 0.55, HOME.well.z],
    half: [0.84, 0.55, 0.84]
  });

  const cameraProxy = box(
    root, 'House camera collision proxy',
    [HOME.house.width + 0.9, HOME.house.height + 0.6, HOME.house.depth + 0.9],
    [HOME.house.x, (HOME.house.height + 0.6) / 2, HOME.house.z], mat('#ffffff'), false
  );
  cameraProxy.visible = false;
  cameraBlockers.push(cameraProxy);

  const loaded = !loadApprovedModel ? Promise.resolve(false) : new GLTFLoader().loadAsync('./models/environment/rumah_utama.glb').then(async gltf => {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const dimensions = bounds.getSize(new THREE.Vector3());
    if (dimensions.x <= 0.01 || dimensions.z <= 0.01 || !Number.isFinite(dimensions.y)) {
      throw new Error('House GLB bounds not valid');
    }
    // Preserve the original model's geometry and UVs; normalize its authored
    // dimensions into the house plot without destructive nonuniform scaling.
    const scale = computeHouseScale(dimensions);
    scene.scale.setScalar(scale);
    const center = bounds.getCenter(new THREE.Vector3());
    scene.position.set(HOME.house.x - center.x * scale, -bounds.min.y * scale,
      HOME.house.z - center.z * scale);
    scene.name = 'Approved original rumah_utama.glb';
    const { applyHandPaintedMaterials } = await import('./handPaintedMaterials');
    applyHandPaintedMaterials(scene, 8);
    scene.updateMatrixWorld(true);
    // Keep the authored courtyard painting loaded before the visible GLB.
    await courtyardAlbedo;
    featherMergedHouseGround(scene, new THREE.Box3().setFromObject(scene));
    fallback.visible = false;
    root.add(scene);
    return true;
  }).catch(error => {
    console.warn('[LembahAsri] House GLB unavailable; keep 3D house fallback', error);
    return false;
  });

  return { root, solids, cameraBlockers, ready: Promise.all([loaded, orchardReady, rockReady]).then(([house]) => house) };
}
