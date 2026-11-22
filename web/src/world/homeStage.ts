import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createTerrainMaterial, createPaintedTerrainPlane, makeTerrainEdgeMask, type TerrainSurface } from './terrainMaterials.ts';

/**
 * The player's childhood home in the same continuous 3D world as the village.
 * Coordinates are metres, Y=0 is the walking floor, and the front door faces +Z.
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

function makeGardenRidgeGeometry(length: number): THREE.BufferGeometry {
  // A low, hand-shaped soil mound with no timber edging. Rows run along X,
  // leaving narrow grass-and-earth paths that stay open to the player.
  const profile: Array<[number, number]> = [
    [-0.58, 0.055], [-0.43, 0.14], [-0.22, 0.205],
    [0.22, 0.205], [0.43, 0.14], [0.58, 0.055]
  ];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const x0 = -length / 2;
  const x1 = length / 2;
  for (let i = 0; i < profile.length - 1; i++) {
    const [z0, y0] = profile[i];
    const [z1, y1] = profile[i + 1];
    const base = positions.length / 3;
    positions.push(x0, y0, z0, x1, y0, z0, x0, y1, z1, x1, y1, z1);
    uvs.push(0, i / profile.length, 1, i / profile.length,
      0, (i + 1) / profile.length, 1, (i + 1) / profile.length);
    indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function addBambooTrellis(root: THREE.Object3D, centerX: number, centerZ: number) {
  const bamboo = mat('#aa8a50');
  const darkBamboo = mat('#836a43');
  const beam = (name: string, from: THREE.Vector3, to: THREE.Vector3, radius = 0.035) => {
    const direction = new THREE.Vector3().subVectors(to, from);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.84, radius, direction.length(), 6), bamboo
    );
    mesh.name = name;
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    root.add(mesh);
  };
  // Two simple A-frame supports and a top rail, like a practical village-yard
  // support for beans or tomatoes. It sits at the far edge of the beds.
  for (const x of [centerX - 2.15, centerX + 2.15]) {
    const left = new THREE.Vector3(x - 0.5, 0.08, centerZ);
    const top = new THREE.Vector3(x, 1.35, centerZ);
    const right = new THREE.Vector3(x + 0.5, 0.08, centerZ);
    beam('Bamboo garden trellis leg', left, top);
    beam('Bamboo garden trellis leg', top, right);
    const crossbar = box(root, 'Bamboo garden trellis crossbar', [0.07, 0.07, 1.15],
      [x, 1.05, centerZ], darkBamboo, true);
    crossbar.rotation.z = -0.12;
  }
  beam('Bamboo trellis top rail',
    new THREE.Vector3(centerX - 2.15, 1.35, centerZ),
    new THREE.Vector3(centerX + 2.15, 1.35, centerZ), 0.045);
}

function addHomeGarden(root: THREE.Object3D) {
  const gardenCenter = HOME.garden;
  const bedLength = 8.6;
  const rows = [-2.0, -0.65, 0.7, 2.05];
  const soil = createTerrainMaterial('soil', bedLength, 1.16);
  rows.forEach((rowZ, rowIndex) => {
    const bed = new THREE.Mesh(makeGardenRidgeGeometry(bedLength), soil);
    bed.name = 'Hand-shaped vegetable garden bed';
    bed.position.set(gardenCenter.x, 0, gardenCenter.z + rowZ);
    bed.castShadow = true;
    bed.receiveShadow = true;
    bed.userData.cropRow = rowIndex;
    root.add(bed);
  });

  const leafGeometry = new THREE.SphereGeometry(1, 7, 5);
  const leafMaterials = [mat('#557b43'), mat('#6d914b'), mat('#829c55'), mat('#496c3b')];
  const leafInstances = leafMaterials.map((material, i) => {
    const mesh = new THREE.InstancedMesh(leafGeometry, material, 160);
    mesh.name = ['Sawi and kangkung leaves', 'Garden leafy greens',
      'Tomato vines', 'Eggplant foliage'][i];
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  });
  const fruitDefinitions = [
    { name: 'Ripe red garden tomatoes', color: '#c94f38', scale: [0.09, 0.1, 0.09] as const, capacity: 64 },
    { name: 'Purple village eggplants', color: '#704777', scale: [0.075, 0.15, 0.075] as const, capacity: 40 },
    { name: 'Red chili peppers', color: '#d65b35', scale: [0.045, 0.12, 0.045] as const, capacity: 64 }
  ];
  const fruitInstances = fruitDefinitions.map(({ name, color, capacity }) => {
    const mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 7, 5), mat(color), capacity
    );
    mesh.name = name;
    mesh.castShadow = true;
    root.add(mesh);
    return mesh;
  });
  const leafCounts = leafInstances.map(() => 0);
  const fruitCounts = fruitInstances.map(() => 0);
  const dummy = new THREE.Object3D();
  const plantsPerRow = 6;
  const startX = gardenCenter.x - 3.25;
  const spacing = 1.3;

  rows.forEach((rowZ, rowIndex) => {
    for (let plantIndex = 0; plantIndex < plantsPerRow; plantIndex++) {
      const x = startX + plantIndex * spacing;
      const z = gardenCenter.z + rowZ + ((plantIndex % 2) - 0.5) * 0.11;
      const leafKind = rowIndex === 0 ? 0 : rowIndex === 1 ? 1 : rowIndex === 2 ? 2 : 3;
      const leaves = rowIndex === 0 || rowIndex === 3 ? 6 : 5;
      for (let leaf = 0; leaf < leaves; leaf++) {
        const angle = leaf * Math.PI * 2 / leaves + (plantIndex % 2) * 0.2;
        const reach = (rowIndex === 1 ? 0.16 : 0.22) + (leaf % 2) * 0.045;
        dummy.position.set(x + Math.cos(angle) * reach, 0.24 + (leaf % 3) * 0.045,
          z + Math.sin(angle) * reach * 0.62);
        dummy.rotation.set(-0.42 + (leaf % 2) * 0.12, -angle, 0.12 * Math.sin(angle));
        const size = rowIndex === 1 ? 0.21 : 0.27;
        dummy.scale.set(size, 0.075, size * 0.48);
        dummy.updateMatrix();
        leafInstances[leafKind].setMatrixAt(leafCounts[leafKind]++, dummy.matrix);
      }
      // Small fruit clusters provide crop variety without turning the garden
      // into a uniform wall of green. These are static scene dressing for now.
      const fruitKind = rowIndex === 1 ? 2 : rowIndex === 2 ? 0 : rowIndex === 3 ? 1 : -1;
      if (fruitKind >= 0) {
        const fruitCount = fruitKind === 0 ? 2 : 3;
        for (let fruit = 0; fruit < fruitCount; fruit++) {
          const angle = fruit * Math.PI * 2 / fruitCount + plantIndex * 0.37;
          const def = fruitDefinitions[fruitKind];
          const scale = def.scale;
          dummy.position.set(x + Math.cos(angle) * 0.16, 0.31 + fruit % 2 * 0.09,
            z + Math.sin(angle) * 0.12);
          dummy.rotation.set(0.18, angle, 0.28 * Math.sin(angle));
          dummy.scale.set(scale[0], scale[1], scale[2]);
          dummy.updateMatrix();
          fruitInstances[fruitKind].setMatrixAt(fruitCounts[fruitKind]++, dummy.matrix);
        }
      }
    }
  });
  leafInstances.forEach((mesh, i) => { mesh.count = leafCounts[i]; mesh.instanceMatrix.needsUpdate = true; });
  fruitInstances.forEach((mesh, i) => { mesh.count = fruitCounts[i]; mesh.instanceMatrix.needsUpdate = true; });
  addBambooTrellis(root, gardenCenter.x, gardenCenter.z + 2.9);
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

/** Atlas bands contain wall courses, coping stones, timber grain and end grain. */
function addStoneWell(root: THREE.Object3D, loadTexture: boolean) {
  const stone = mat('#999887');
  const timber = mat('#966d49');
  const inner = mat('#696e65');
  const materials = [stone, timber, inner];
  if (loadTexture) {
    new THREE.TextureLoader().load('./textures/props/well.webp', texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      for (const material of materials) {
        material.map = texture;
        material.color.set(material === inner ? '#92988e' : '#ffffff');
        material.needsUpdate = true;
      }
    }, undefined, error => console.warn('[LembahAsri] Well texture unavailable', error));
  }

  // Separate UV bands let the coping wrap inward over the lip of the opening.
  function masonryBand(name: string, profile: number[][], pixels: number[], material: THREE.Material) {
    const geometry = new THREE.LatheGeometry(
      profile.map(([radius, height]) => new THREE.Vector2(radius, height)), 32
    );
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      uv.setY(i, 1 - pixels[i % profile.length] / 512);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(HOME.well.x, 0, HOME.well.z);
    root.add(mesh);
  }
  masonryBand('Old village well stone rim', [[0.9, 0], [0.85, 0.68]], [191, 1], stone);
  masonryBand('Well coping stones', [[0.85, 0.68], [0.89, 0.71], [0.87, 0.79],
    [0.84, 0.81], [0.65, 0.81], [0.62, 0.77]], [254, 246, 233, 226, 199, 193], stone);
  masonryBand('Inner well masonry', [[0.62, 0.77], [0.62, 0.13]], [1, 191], inner);
  cylinder(root, 'Well opening', 0.625, 0.625, 0.02,
    [HOME.well.x, 0.14, HOME.well.z], mat('#364c50'), 32);

  function beam(name: string, length: number, x: number, y: number) {
    const mesh = box(root, name, [0.15, length, 0.17], [x, y, HOME.well.z], timber);
    const uv = mesh.geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 4);
      const end = face === 2 || face === 3;
      const side = [0, 2, 0, 0, 1, 3][face];
      const u = end ? 0.63 + uv.getX(i) * 0.24 : (side + uv.getX(i) * 0.98) / 8;
      uv.setXY(i, u, 0.008 + uv.getY(i) * 0.483);
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
  const wood = mat('#806349');
  // A simple local fruit tree is a separate real-geometry prop (not an image billboard).
  const tree = new THREE.Group();
  tree.name = 'Old fruit tree';
  tree.position.set(-40, 0, 8.3);
  root.add(tree);
  cylinder(tree, 'Fruit tree trunk', 0.22, 0.32, 2.55, [0, 1.27, 0], wood, 7);
  for (const [x, y, z, radius] of [
    [-0.78, 3.16, 0.1, 1.2], [0.65, 3.4, 0.13, 1.35],
    [0, 3.8, -0.45, 1.2], [0.12, 2.95, 0.75, 1.12]
  ]) {
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 1),
      mat(y > 3.6 ? '#6e8f64' : '#7b9b70')
    );
    crown.name = 'Handpainted-style fruit tree crown';
    crown.position.set(x, y, z);
    crown.castShadow = true;
    tree.add(crown);
  }
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
  const stream = floorPatch(root, 'Shallow stream west of childhood home',
    2.6, 29, -45.5, 10, '#73b3b1', 0.012);
  stream.material.depthWrite = true;
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

  // A worn earth yard and soft meadow edge connect the homestead directly
  // to the existing village, without a floating island/cliff edge.
  const clearing = floorPatch(root, 'Childhood courtyard - earth clearing', 32, 29, -29, 0.4, '#ac9575', 0.028, 'earth', true);
  const worn = floorPatch(root, 'Worn central courtyard', 15, 12, -29, 5.2, '#b7a07c', 0.052, 'soil', true);
  floorPatch(root, 'Path from the house gate to the village', 22, 3.3, -8.5, HOME.gate.z, '#b9a27d', 0.066, 'path', true);
  // A wider approach helps the enlarged house read as the protagonist's home.
  // Ends at the actual front wall rather than diving under the house.
  const entrance = floorPatch(root, 'House entrance footpath', 3.8, 12.8,
    HOME.house.x, 2.4, '#baa17a', 0.078, 'path', true);

  if (loadApprovedModel) {
    new THREE.TextureLoader().load('./textures/terrain/home_courtyard.webp', texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      // Local UVs place the entire painting once, with the trail toward the east gate.
      const material = new THREE.MeshBasicMaterial({
        map: texture, alphaMap: makeTerrainEdgeMask(), transparent: true,
        depthWrite: false, toneMapped: false
      });
      const painted = new THREE.Mesh(clearing.geometry, material);
      painted.name = 'Painted childhood courtyard';
      painted.rotation.copy(clearing.rotation);
      painted.position.copy(clearing.position);
      painted.renderOrder = clearing.renderOrder;
      root.add(painted);
      clearing.visible = worn.visible = entrance.visible = false;
    }, undefined, error => console.warn('[LembahAsri] Using fallback courtyard', error));
  }

  const fallback = buildLocalHouseFallback(root);
  addHomeGarden(root);
  addShed(root);
  addWellAndFruitTree(root, loadApprovedModel);
  addStreamAndBridge(root);

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
    fallback.visible = false;
    root.add(scene);
    return true;
  }).catch(error => {
    console.warn('[LembahAsri] House GLB unavailable; keep 3D house fallback', error);
    return false;
  });

  return { root, solids, cameraBlockers, ready: loaded };
}
