import { applyPaintedPigment } from './paintedPigment.ts';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const UPLOADED_FENCE_URL = './models/environment/home-fence-module.glb?v=1';
// Preserve the authored XYZ proportions and the minimum 40 cm long-run depth.
// Lower prominence through the weathered pigment, not by shrinking the mesh.
export const FENCE_HEIGHT = 1.45;

type FenceRun = { label: string; center: [number, number, number]; half: [number, number, number] };

/** One shared authored mesh, fitted end-to-end along each existing collision run. */
export function createUploadedFenceRun(geometry: THREE.BufferGeometry, material: THREE.Material, run: FenceRun) {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (![size.x, size.y, size.z].every(v => Number.isFinite(v) && v > .001)) throw new Error('Invalid fence module bounds');
  const alongX = run.half[0] > run.half[2];
  const length = 2 * (alongX ? run.half[0] : run.half[2]);
  // Pick the module count closest to the nominal height, then fit the run
  // with one scalar on XYZ. Exact endpoints keep every existing gate open.
  const idealCount = length / (size.x * FENCE_HEIGHT / size.y);
  const candidates = [Math.max(1, Math.floor(idealCount)), Math.max(1, Math.ceil(idealCount))];
  const heightError = (n: number) => Math.abs(length * size.y / (n * size.x) - FENCE_HEIGHT);
  const count = heightError(candidates[0]) <= heightError(candidates[1]) ? candidates[0] : candidates[1];
  const step = length / count;
  const scale = step / size.x;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const marker = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    marker.scale.setScalar(scale);
    marker.position.set(-length / 2 + (i + .5) * step - center.x * scale, -bounds.min.y * scale, -center.z * scale);
    marker.updateMatrix();
    mesh.setMatrixAt(i, marker.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = run.label + ' — uploaded fence modules';
  mesh.userData.sourceFile = 'base_basic_shaded (1).glb';
  mesh.userData.moduleCount = count;
  mesh.userData.runLength = length;
  mesh.userData.uniformScale = scale;
  mesh.userData.moduleHeight = size.y * scale;
  mesh.userData.moduleDepth = size.z * scale;
  mesh.position.set(run.center[0], 0, run.center[2]);
  if (!alongX) mesh.rotation.y = -Math.PI / 2;
  return mesh;
}

export async function loadUploadedHomeFence(root: THREE.Group, runs: FenceRun[]): Promise<boolean> {
  try {
    const { scene } = await new GLTFLoader().loadAsync(UPLOADED_FENCE_URL);
    scene.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    scene.traverse(obj => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
    if (meshes.length !== 1) throw new Error('Expected one authored fence mesh');
    const source = meshes[0];
    const original = source.material;
    if (!(original instanceof THREE.MeshStandardMaterial) || !original.emissiveMap) throw new Error('Missing authored shaded texture');
    const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
    // The GLB uses a baked emissive atlas. Use that same UV atlas as a matte
    // non-PBR surface, avoiding double lighting or darkening the original art.
    const map = original.emissiveMap;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    const material = applyPaintedPigment(new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, toneMapped: false }));
    const painted = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      painted.call(material, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        float bambooValue = dot(diffuseColor.rgb, vec3(.25,.60,.15));
        vec3 weathered = vec3(.073,.067,.044) + bambooValue * vec3(.51,.48,.36);
        diffuseColor.rgb = mix(diffuseColor.rgb, weathered, .78);
      `);
    };
    material.customProgramCacheKey = () => 'weathered-bamboo-pigment-v1';
    const replacement = new THREE.Group();
    replacement.name = 'Home fence — uploaded GLB';
    for (const run of runs) replacement.add(createUploadedFenceRun(geometry, material, run));
    if (replacement.children.length !== 6) throw new Error('Unexpected home fence layout');
    // Replace only the existing fence visuals; retain every original collider.
    const old = root.children.filter(child => child.userData.bambooFence === true);
    if (old.length !== runs.length) throw new Error('Original fence layout mismatch');
    root.add(replacement);
    for (const child of old) root.remove(child);
    return true;
  } catch (error) {
    console.warn('[LembahAsri] Keeping existing bamboo fence fallback', error);
    return false;
  }
}
