import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPaintedTerrainPlane, makeTerrainEdgeMask, type TerrainSurface } from './terrainMaterials.ts';
import { GARDEN, sculptGardenGround, gardenCollision, gardenProfile, gardenUV, type GardenGround } from './gardenLayout.ts';
import { GardenSurface } from './gardenSurface.ts';
import { createHomeGroundDetails } from './homeGroundDetails.ts';
import { createHouseGroundTransition, featherMergedHouseGround, createHouseContactShadow } from './houseTerrainSeam.ts';
import { createHomeArtPass } from './homeArtPass.ts';
import { createPaintedStoryTree } from './paintedTrees.ts';
import { loadPaintedTreeSource, instantiatePaintedTree } from './treeAsset.ts';
import { loadUserReferenceTextureSet, applyUserReferenceDryRock } from './userReferenceTextures.ts';
import { attachCuratedHomeRocks } from './homeRocks.ts';
import { createHomeCreek, createHomeCreekVegetation, carveVisualCreek, loadPaintedCreekTextures, installRockContactFoam } from './homeCreek.ts';
import { createSculptedCreekMeadow, createFineCreekBankGrass } from './homeTerrain3D.ts';
import { applyRiversidePaint } from './riversidePaint.ts';
import { applyCreekCourtyardAlbedo } from './shoreCourtyard.ts';
import { applyWarmCourtyardGrass } from './grassPalette.ts';
import { createHousePainterlyMaterial } from './housePainterlyMaterial.ts';
import { createPaintedWoodenBridge, loadPaintedBridgeTextures } from './paintedBridge.ts';
import { loadUserSuppliedWoodenBridge } from './uploadedBridge.ts';
import { createUVBambooFence, loadBambooFencePBR } from './bambooFence.ts';
import { loadUploadedHomeFence } from './uploadedHomeFence.ts';

/**
 * The player's childhood home in the same continuous 3D world as the village.
 * Coordinates are metres, Y=0 is the walking floor, and the front door faces +Z.
 * A restored village vegetable garden now sits beside the player's childhood home.
 */
export const HOME = {
  // Option B: ~74% larger linear footprint than the previously rendered
  // 5.5 m imported GLB. Keep X/Z scale uniform to preserve the approved art.
  house: { x: -32.5, z: -8.45, width: 12, depth: 12, height: 7.3125 },
  spawn: { x: -29.5, y: 1.2, z: 7.4 },
  gate: { x: -16.5, z: 9 },
  villageRoad: { x: 0, z: 9 },
  garden: GARDEN,
  well: { x: -39, z: 4 },
  stream: { x: -45.5, z: 9 }
} as const;

// Restore ONLY the courtyard tree placement from the verified pre-PR#93
// baseline. Preserve newer house PBR, terrain, creek, bridge and game logic.
export const ORIGINAL_COURTYARD_FRUIT_TREE = Object.freeze({
  x: -40, z: 8.3, height: 3.65, yaw: 0.21, seed: 210917
});

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
  garden: GardenSurface;
  gardenGround: GardenGround;
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
  // Replaced by the uploaded house PBR GLB once downloaded and decoded.
  const group = new THREE.Group();
  group.name = 'Rumah Masa Kecil - fallback geometry';
  group.position.set(HOME.house.x, 0, HOME.house.z);
  // The original FBX-independent fallback was smaller than the approved GLB.
  // Increase its footprint, veranda and roof as one coherent backup building.
  // Leave the approved imported GLB unchanged.
  group.scale.set(1.6, 1.725, 1.4375);
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

function addWellOnly(root: THREE.Object3D, loadTexture: boolean) {
  const fallback = new THREE.Group();
  addStoneWell(fallback, loadTexture);
  root.add(fallback);
  if (!loadTexture) return Promise.resolve();
  return new GLTFLoader().loadAsync('./models/environment/sumur_pekarangan.glb').then(async ({scene}) => {
    const { applyHandPaintedMaterials } = await import('./handPaintedMaterials.ts');
    applyHandPaintedMaterials(scene, 4);
    scene.name = 'Sumur beratap genteng';
    scene.position.set(HOME.well.x, 0, HOME.well.z);
    scene.rotation.y = -1.24;
    root.add(scene);
    root.remove(fallback);
  }).catch(error => console.warn('[LembahAsri] Keeping fallback well', error));
}

function addWoodenFence(
  root: THREE.Object3D, solids: SolidCollider[], label: string,
  x: number, z: number, length: number, direction: 'x' | 'z'
) {
  if (length < 0.6) return;
  // Real 3D bamboo, four UV islands and a matte non-metal PBR material.
  // Keep the original fence footprint and gap/physics exactly unchanged.
  root.add(createUVBambooFence(label,x,z,length,direction));
  solids.push({
    label,
    center: [x, 0.77, z],
    half: direction === 'x' ? [length / 2, 0.77, 0.12] : [0.12, 0.77, length / 2]
  });
}

function addStreamAndBridge(root: THREE.Object3D) {
  // Organic, genuinely sculpted 3D grassy shoulders merge into the entire
  // world meadow. Exact crest vertices meet the recessed creek geometry.
  // This replaces a straight brown ribbon without altering world physics.
  root.add(createSculptedCreekMeadow());
  // Sunken real cross-section, UV-painted riverbed + flowing translucent water.
  // The flat world grass/shadow planes are already cut only inside this channel.
  root.add(createHomeCreek());
  // Dense growth only around the major stone clusters, never on the bridge.
  root.add(createHomeCreekVegetation());
  root.add(createFineCreekBankGrass());
  // No fallback row of 52 plain stones. Only the two selected UV GLB rock
  // types are displayed, with natural scale variation.
  // The safe old bridge stays visible during GLB load; on success its
  // wooden pieces are replaced with the exact user-uploaded 3D bridge.
  // Crossing position and Rapier surface remain unchanged.
  root.add(createPaintedWoodenBridge());
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

  // A worn earth yard and soft meadow edge connect the homestead directly
  // to the existing village, without a floating island/cliff edge.
  const clearing = carveVisualCreek(floorPatch(root,
    'Childhood courtyard - earth clearing', 32, 29, -29, 0.4,
    '#ac9575', 0.028, 'earth', true));
  const garden = new GardenSurface();
  sculptGardenGround(clearing);
  garden.bind(clearing.material);
  applyRiversidePaint(clearing.material,'meadow');
  const gardenGround = gardenCollision(clearing);
  root.add(garden.crops);
  const gardenReady = loadApprovedModel ? garden.loadArt() : Promise.resolve();
  const worn = floorPatch(root, 'Worn central courtyard', 15, 12, -29, 5.2, '#b7a07c', 0.052, 'soil', true);
  // The old wear layer is visible while the courtyard albedo loads. Keep its
  // transparency continuous where the footpath enters the cultivated earth.
  const wearMask = worn.material.alphaMap as THREE.DataTexture;
  const { data, width, height } = wearMask.image;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const wx = worn.position.x + ((x + .5) / width - .5) * worn.geometry.parameters.width;
    const wz = worn.position.z + (.5 - (y + .5) / height) * worn.geometry.parameters.height;
    const { u, t } = gardenUV(wx, wz);
    data[(y * width + x) * 4 + 1] *= 1 - gardenProfile(u, t).coverage;
  }
  wearMask.needsUpdate = true;
  floorPatch(root, 'Path from the house gate to the village', 22, 3.3, -8.5, HOME.gate.z, '#b9a27d', 0.066, 'path', true);
  // A wider approach helps the enlarged house read as the protagonist's home.
  // Ends at the actual front wall rather than diving under the house.
  const entrance = floorPatch(root, 'House entrance footpath', 3.8, 12.8,
    HOME.house.x, 2.4, '#baa17a', 0.078, 'path', true);

  // The GLB soil edge now samples this SAME authored courtyard albedo.
  // Await the shared image when attaching the imported building so the seam
  // cannot briefly render black while its map is still downloading.
  const courtyardAlbedo: Promise<THREE.Texture | undefined> = loadApprovedModel
    ? new THREE.TextureLoader().loadAsync('./textures/terrain/home_courtyard.webp?restored=98')
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
        garden.bind(material);
        // Only green pigment is softly graded; GardenSurface overrides soil
        // after the map sample, preserving planting and tilled-earth colors.
        applyWarmCourtyardGrass(material);
        applyRiversidePaint(material,'meadow');
        painted.rotation.copy(clearing.rotation);
        painted.position.copy(clearing.position);
        painted.renderOrder = clearing.renderOrder;
        root.add(painted);
        // The sculpted creek bank crosses the brighter courtyard painting.
        // Share its actual image and alpha mask with the overlapping shore,
        // rather than blending the unrelated world-grass tile over the yard.
        applyCreekCourtyardAlbedo(root, painted);
        clearing.visible = worn.visible = entrance.visible = false;
        return texture;
      })
      .catch(error => {
        console.warn('[LembahAsri] Using fallback courtyard', error);
        return undefined;
      })
    : Promise.resolve(undefined);

  const fallback = buildLocalHouseFallback(root);
  addShed(root);
  const wellReady = addWellOnly(root, loadApprovedModel);
  // Pre-PR#93 courtyard: the original modest orchard tree beside the well.
  // Replace its UV-painted procedural fallback with the old orchard GLB when
  // loaded, without reintroducing the large tree, exposed roots or collider.
  const oldFruitFallback = createPaintedStoryTree({
    kind: 'orchard',
    seed: ORIGINAL_COURTYARD_FRUIT_TREE.seed,
    height: ORIGINAL_COURTYARD_FRUIT_TREE.height
  });
  oldFruitFallback.name = 'Old fruit tree';
  oldFruitFallback.position.set(
    ORIGINAL_COURTYARD_FRUIT_TREE.x, 0, ORIGINAL_COURTYARD_FRUIT_TREE.z
  );
  root.add(oldFruitFallback);
  const orchardReady: Promise<boolean> = loadApprovedModel
    ? loadPaintedTreeSource('orchard').then(source => {
        const restoredTree = instantiatePaintedTree(
          source, ORIGINAL_COURTYARD_FRUIT_TREE.height,
          ORIGINAL_COURTYARD_FRUIT_TREE.x,
          ORIGINAL_COURTYARD_FRUIT_TREE.z,
          ORIGINAL_COURTYARD_FRUIT_TREE.yaw
        );
        restoredTree.name = 'Old fruit tree';
        root.add(restoredTree);
        root.remove(oldFruitFallback);
        return true;
      }).catch(error => {
        console.warn('[LembahAsri] Keeping the original fruit tree fallback', error);
        return false;
      })
    : Promise.resolve(false);
  addStreamAndBridge(root);
  const creekArtReady: Promise<boolean> = loadApprovedModel
    ? loadPaintedCreekTextures(root) : Promise.resolve(false);
  const bridgeArtReady: Promise<boolean> = loadApprovedModel
    ? loadPaintedBridgeTextures() : Promise.resolve(false);
  const uploadedBridgeReady: Promise<boolean> = loadApprovedModel
    ? loadUserSuppliedWoodenBridge(root) : Promise.resolve(false);
  // User-approved landscape: exactly two UV-textured rock models.
  const rockReady: Promise<boolean> = loadApprovedModel
    ? attachCuratedHomeRocks(root).then(async () => {
        installRockContactFoam(root);
        // Only dry stones inherit the uploaded painted rock albedo; mossy
        // stream stones retain their original shaded GLB and water shader.
        try {
          const images=await loadUserReferenceTextureSet();
          applyUserReferenceDryRock(root,images);
        } catch (error) {
          console.warn('[LembahAsri] Keeping original UV stone paint',error);
        }
        console.info('[LembahAsri] Rendered 2 rock species: mossy + plain, 27 placements');
        return true;
      }).catch(error => {
        console.warn('[LembahAsri] Original UV rock asset unavailable', error);
        return false;
      })
    : Promise.resolve(false);

  // Preserve the plants and painted soil, but never add procedural pebbles
  // or the extra four varieties of stepping-stone meshes.
  const groundDetails = createHomeGroundDetails();
  for (const child of [...groundDetails.children]) {
    if (!child.name.startsWith('Textured natural stones variant ')) continue;
    groundDetails.remove(child);
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
  root.add(groundDetails);
  const vegetation = createHomeArtPass();
  for (const child of [...vegetation.children]) {
    if (!child.name.startsWith('Naturally shaped textured stepping stones ')) continue;
    vegetation.remove(child);
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
  root.add(vegetation);
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
  // Asset loading is async: colored bamboo geometry is visible immediately.
  // The approved illustration's albedo/normal/roughness maps arrive together.
  const fenceRuns = solids.filter(solid => solid.label.includes('fence'));
  const fencePBRReady: Promise<boolean> = loadApprovedModel
    ? loadUploadedHomeFence(root, fenceRuns).then(ok => ok || loadBambooFencePBR()) : Promise.resolve(false);

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

  // The supplied PBR house replaces the previous approved house GLB.
  // Keep the old 3D fallback only until the new asset finishes loading.
  const uploadedHouseUrl='./models/environment/rumah_utama_user_pbr.glb?house=pbr-v1';
  const loaded = !loadApprovedModel ? Promise.resolve(false) : new GLTFLoader().loadAsync(uploadedHouseUrl).then(async gltf => {
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
    scene.name = 'Rumah utama - user uploaded PBR';
    scene.userData.sourceFile='base_basic_pbr.glb';
    scene.userData.uvPreserved=true;
    scene.userData.pbrPreserved=false;
    scene.userData.painterlyShader=true;
    // Use a non-PBR diffuse shader; retain source GLB and authored albedo UVs.
    let houseMeshes=0;
    scene.traverse(obj=>{
      if(!(obj instanceof THREE.Mesh))return;
      const materials=Array.isArray(obj.material)?obj.material:[obj.material];
      const painted = materials.map(material=>{
        if(!(material instanceof THREE.MeshStandardMaterial)
          || !material.map || !material.normalMap
          || !material.roughnessMap || !material.metalnessMap){
          throw new Error('Uploaded house lost one of its three original PBR maps');
        }
        material.map.colorSpace=THREE.SRGBColorSpace;
        material.map.anisotropy=8;
        for(const map of [material.normalMap,material.roughnessMap,material.metalnessMap]){
          map.colorSpace=THREE.NoColorSpace;
          map.anisotropy=4;
        }
        // Retain the exact GLB textures and UVs, but reduce hard PBR
        // highlights to match surrounding soft hand-painted objects.
        return createHousePainterlyMaterial(material);
      });
      obj.material=Array.isArray(obj.material)?painted:painted[0];
      obj.castShadow=true;
      obj.receiveShadow=true;
      houseMeshes++;
    });
    if(houseMeshes!==1)throw new Error('Unexpected imported house mesh count');
    scene.updateMatrixWorld(true);
    // Keep the authored courtyard painting loaded before the visible GLB.
    await courtyardAlbedo;
    // The old house used a custom MeshBasic ground shader. The new file
    // already contains its own exterior details and real PBR materials:
    // leave those intact and use only the existing separate soil underlay.
    fallback.visible = false;
    root.add(scene);
    return true;
  }).catch(error => {
    console.warn('[LembahAsri] House GLB unavailable; keep 3D house fallback', error);
    return false;
  });

  return { root, solids, cameraBlockers, garden, gardenGround, ready: Promise.all([loaded, wellReady, orchardReady, rockReady, fencePBRReady, creekArtReady, bridgeArtReady, uploadedBridgeReady, gardenReady]).then(([house]) => house) };
}
