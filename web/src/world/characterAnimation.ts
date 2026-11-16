/**
 * Mixamo FBXs store forward travel inside the Hips.position keyframes.
 * Rapier already translates the player, so playing that baked travel a second
 * time makes the mesh surge forward and snap backwards at each loop boundary.
 *
 * Remove only the linear X/Z travel while preserving side-to-side hip sway,
 * vertical walk/run bob, pose rotations and the original rig/UV/materials.
 * Jump height comes from Rapier, so omit its baked vertical travel as well.
 */
export type CharacterMotion = 'idle' | 'walk' | 'run' | 'jump';

type MutableSamples = { readonly length: number; [index: number]: number };
type PositionTrack = {
  name: string;
  times: ArrayLike<number>;
  values: MutableSamples;
};
type AnimationWithTracks = { tracks: PositionTrack[] };

export function removeBakedHipTravel(
  clip: AnimationWithTracks,
  motion: CharacterMotion
): void {
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.position') || !track.name.toLowerCase().includes('hips')) continue;
    const { times, values } = track;
    if (times.length < 2 || values.length !== times.length * 3) continue;

    const t0 = times[0];
    const duration = times[times.length - 1] - t0;
    if (duration <= 0) continue;

    const firstX = values[0];
    const firstY = values[1];
    const firstZ = values[2];
    const last = values.length - 3;
    const travelX = values[last] - firstX;
    const travelZ = values[last + 2] - firstZ;

    for (let key = 0; key < times.length; key++) {
      const fraction = (times[key] - t0) / duration;
      const offset = key * 3;
      values[offset] -= travelX * fraction;
      values[offset + 2] -= travelZ * fraction;
      if (motion === 'jump') {
        // The physical body already traces the jump arc; do not jump twice.
        values[offset + 1] = firstY;
      }
    }
  }
}

/** Rapier capsule(halfHeight=0.56, radius=0.28) rests at Y=0.84 on the floor. */
export const PLAYER_BODY_GROUND_Y = 0.84;

/** Avoid using an arbitrary airborne threshold that cuts off takeoff/landing. */
export function isPlayerGrounded(bodyY: number, verticalSpeed: number): boolean {
  return bodyY <= PLAYER_BODY_GROUND_Y + 0.10 && Math.abs(verticalSpeed) <= 0.30;
}

/**
 * A jump cannot yield to idle/walk/run until the physical landing AND the
 * entire non-looping jump animation are complete. A missing clip must not
 * permanently lock input/state while clips load asynchronously.
 */
export function jumpMayFinish(
  leftGround: boolean,
  onGround: boolean,
  playbackTime?: number,
  clipDuration?: number
): boolean {
  if (!leftGround || !onGround) return false;
  if (playbackTime === undefined || clipDuration === undefined) return true;
  return playbackTime >= clipDuration - 0.02;
}
