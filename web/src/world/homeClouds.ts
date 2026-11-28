import * as THREE from 'three';

export function createHomeClouds(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = 3;
  const group = new THREE.Group();
  group.name = 'Awan pekarangan';
  const band = (radius: number, height: number, elevation: number, opacity: number) => {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true);
    const material = new THREE.MeshBasicMaterial({
      map: texture, side: THREE.BackSide, transparent: true, opacity,
      fog: false, toneMapped: false, depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = elevation;
    group.add(mesh);
    return mesh;
  };
  const far = band(270, 12, 18, .54);
  const near = band(235, 30, 20, .96);
  far.renderOrder = -11;
  near.renderOrder = -10;
  far.rotation.y = .46;
  near.rotation.y = .06;
  return {
    group,
    update(camera: THREE.Camera, dt: number) {
      group.position.copy(camera.position);
      far.rotation.y += dt * .0008;
      near.rotation.y += dt * .0028;
    },
    dispose() {
      group.removeFromParent();
      for (const mesh of [far, near]) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      texture.dispose();
    }
  };
}
