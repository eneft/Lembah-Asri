import * as THREE from 'three';

/**
 * Prevent the third-person camera from entering walls and roofs.
 * The view ray starts at the player's upper body and ends at the requested
 * camera position; a small gap keeps the near plane outside solid geometry.
 *
 * Only stable, solid building meshes are registered as blockers. Leaves and
 * other alpha-cutout details are deliberately excluded from this raycast.
 */
export function keepCameraOutsideGeometry(
  focus: THREE.Vector3,
  desired: THREE.Vector3,
  blockers: readonly THREE.Object3D[],
  padding = 0.35
): THREE.Vector3 {
  const direction = new THREE.Vector3().subVectors(desired, focus);
  const distance = direction.length();
  if (distance <= 0.0001 || blockers.length === 0) return desired.clone();

  direction.divideScalar(distance);
  const raycaster = new THREE.Raycaster(focus, direction, 0.01, distance);
  // The scene graph can move even if the wall mesh itself has no local motion.
  for (const mesh of blockers) mesh.updateWorldMatrix(true, false);
  const collisions = raycaster.intersectObjects([...blockers], false);
  if (collisions.length === 0) return desired.clone();

  const safeDistance = Math.max(0.30, collisions[0].distance - padding);
  return focus.clone().addScaledVector(direction, safeDistance);
}
