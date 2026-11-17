import type { AnimationAction } from 'three';
import type { CharacterMotion } from './characterAnimation';

/**
 * Single authoritative transition for idle/walk/run/jump.
 * In particular, a zero-duration initial Idle must be played at full weight,
 * not scheduled through a zero-width animation fade interpolant.
 */
export function activateCharacterMotion(
  actions: Partial<Record<CharacterMotion, AnimationAction>>,
  active: CharacterMotion | undefined,
  requested: CharacterMotion,
  fade = 0.18
): CharacterMotion | undefined {
  const next = actions[requested];
  if (!next || active === requested) return active;

  const previous = active ? actions[active] : undefined;
  next.reset();
  next.enabled = true;
  next.setEffectiveTimeScale(requested === 'idle' ? 1.25 : 1);
  next.setEffectiveWeight(1);
  next.play();

  if (previous && previous !== next) {
    if (fade > 0) previous.crossFadeTo(next, fade, false);
    else previous.stop();
  } else if (fade > 0) {
    next.fadeIn(fade);
  }
  return requested;
}
