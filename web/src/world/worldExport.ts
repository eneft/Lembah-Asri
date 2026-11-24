import * as THREE from 'three';

/**
 * Produce the native Three.js Object/Scene JSON format, not a layout-only file.
 * Never mutate the running game. The editor snapshot uses portable materials,
 * embedded image sources and actual buffer attributes (including sculpted
 * parametric meshes whose original constructor parameters are no longer valid).
 */
export function serializeWorldScene(
  scene: THREE.Scene,
  excluded: ReadonlySet<THREE.Object3D> = new Set()
): string {
  const snapshot = new THREE.Scene();
  snapshot.name = 'Lembah Asri - World';
  snapshot.background = scene.background instanceof THREE.Color ? scene.background.clone() : null;
  snapshot.fog = scene.fog?.clone() ?? null;
  // A GPU-generated PMREM render target has no portable CPU image.
  // Keep the scene lights, not the runtime environment render target.
  const geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const objects = new Map<THREE.Object3D, THREE.Object3D>();
  const lightTargets: Array<[THREE.DirectionalLight | THREE.SpotLight, THREE.Object3D]> = [];
  const textures = new Map<string, THREE.Texture>();

  const visit = (source: THREE.Object3D, parent: THREE.Object3D) => {
    if (excluded.has(source) || !source.visible) return;
    const copy = source.clone(false);
    // Shader injection callbacks are deliberately not transferred to editor JSON.
    if (copy instanceof THREE.Mesh) {
      const original = copy.geometry;
      let baked = geometries.get(original);
      if (!baked) {
        // BufferGeometry.toJSON otherwise stores constructor parameters instead
        // of the deformed vertices/extra UV channels of a PlaneGeometry, etc.
        baked = new THREE.BufferGeometry().copy(original);
        geometries.set(original, baked);
      }
      copy.geometry = baked;
      const materials = Array.isArray(copy.material) ? copy.material : [copy.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture && !value.isRenderTargetTexture) {
            if (!value.image) throw new Error('Texture not ready: ' + (value.name || value.uuid));
            textures.set(value.source.uuid, value);
          }
        }
      }
    }
    objects.set(source, copy);
    parent.add(copy);
    if ((source instanceof THREE.DirectionalLight || source instanceof THREE.SpotLight) &&
        (copy instanceof THREE.DirectionalLight || copy instanceof THREE.SpotLight)) {
      lightTargets.push([copy, source.target]);
    }
    for (const child of source.children) visit(child, copy);
  };

  for (const child of scene.children) visit(child, snapshot);
  for (const [light, sourceTarget] of lightTargets) {
    let target = objects.get(sourceTarget);
    if (!target) {
      target = sourceTarget.clone(false);
      snapshot.add(target);
      objects.set(sourceTarget, target);
    }
    light.target = target;
  }
  snapshot.updateMatrixWorld(true);
  snapshot.userData = {
    exportFormat: 'lembah-asri-world-v1',
    notes: 'Visual scene snapshot; runtime physics, gameplay and onBeforeCompile shaders are not included.'
  };
  const json = snapshot.toJSON();
  // Three's default serializer uses JPEG for large images. Preserve alpha in
  // large authored foliage/atlas images by replacing that encoding with PNG.
  for (const entry of (json.images ?? []) as Array<{uuid:string;url:unknown}>) {
    const texture = textures.get(entry.uuid);
    const image = texture?.image;
    if (typeof document !== 'undefined' && image && !image.data &&
        (image.width > 2048 || image.height > 2048) &&
        typeof entry.url === 'string' && entry.url.startsWith('data:image/jpeg')) {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to embed texture in world JSON');
      context.drawImage(image, 0, 0);
      entry.url = canvas.toDataURL('image/png');
      canvas.width = canvas.height = 0;
    }
  }
  return JSON.stringify(json);
}

export function downloadWorldJSON(json: string): void {
  const url = URL.createObjectURL(new Blob([json], {type:'application/json'}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'Lembah-Asri-World.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Firefox and Safari may start reading the object URL after the click.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
