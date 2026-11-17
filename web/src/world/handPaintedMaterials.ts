import * as THREE from 'three';

/**
 * Shared in-game rendering preset for painted assets.
 *
 * Both the GLB tree albedo and the character's approved shaded.png atlas are
 * displayed as authored. MeshBasicMaterial avoids the second lighting pass
 * from PBR/Lambert shading while the 3D mesh still casts a world shadow.
 *
 * Trees use their imported base-color map; the FBX player supplies its own
 * approved atlas explicitly because its imported material may not contain it.
 * Keep each asset's UV layout and texture orientation unchanged.
 */
export function applyHandPaintedMaterials(
  root: THREE.Object3D,
  maxAnisotropy: number,
  atlasOverride?: THREE.Texture
): void {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;

    const convert = (source: THREE.Material): THREE.Material => {
      // Avoid silently discarding special shaders on tree meshes.
      // The FBX player always gets its explicit authored atlas.
      if (!atlasOverride && !(source instanceof THREE.MeshStandardMaterial)) {
        return source;
      }

      const imported = source as THREE.Material & {
        map?: THREE.Texture | null;
        alphaMap?: THREE.Texture | null;
        vertexColors?: boolean;
      };
      const colorMap = atlasOverride ?? imported.map ?? null;
      if (colorMap) {
        colorMap.colorSpace = THREE.SRGBColorSpace;
        colorMap.anisotropy = maxAnisotropy;
        colorMap.needsUpdate = true;
      }

      return new THREE.MeshBasicMaterial({
        color: 0xffffff,
        map: colorMap,
        side: source.side,
        transparent: source.transparent,
        opacity: source.opacity,
        alphaMap: imported.alphaMap ?? null,
        alphaTest: source.alphaTest,
        vertexColors: imported.vertexColors ?? false,
        depthWrite: source.depthWrite,
        depthTest: source.depthTest,
        toneMapped: false
      });
    };

    object.material = Array.isArray(object.material)
      ? object.material.map(convert)
      : convert(object.material);
    object.castShadow = true;
    object.receiveShadow = false;
  });
}
