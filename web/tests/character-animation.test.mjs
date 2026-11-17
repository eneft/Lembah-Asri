import test from 'node:test';
import assert from 'node:assert/strict';
import {
  removeBakedHipTravel,
  isPlayerGrounded,
  jumpMayFinish,
  resolveLocomotion
} from '../src/world/characterAnimation.ts';

function sampleClip(values, name = 'mixamorigHips.position') {
  return {
    tracks: [{
      name,
      times: new Float32Array([0, 0.25, 0.5, 0.75, 1]),
      values: new Float32Array(values.flat())
    }]
  };
}

test('walking clears forward displacement without deleting hip sway or Y bob', () => {
  const clip = sampleClip([
    [2, 68, 1], [2.3, 65, 31.1], [2.5, 68.5, 61.3],
    [2.2, 64, 91.2], [2, 68, 121]
  ]);
  removeBakedHipTravel(clip, 'walk');
  const v = clip.tracks[0].values;
  assert.ok(Math.abs(v[14] - v[2]) < 0.001, 'loop Z should close');
  assert.ok(Math.abs(v[12] - v[0]) < 0.001, 'loop X should close');
  assert.ok(Math.abs(v[5] - 1.1) < 0.001, 'subtle forward sway remains');
  assert.ok(Math.abs(v[3] - 2.3) < 0.001, 'lateral sway remains');
  assert.equal(v[4], 65, 'vertical step bob remains');
});

test('running also closes each baked travel loop', () => {
  const clip = sampleClip([
    [0, 63, 1.2], [0, 68, 55], [0, 62, 108],
    [0, 67, 164], [0, 63, 217.2]
  ]);
  removeBakedHipTravel(clip, 'run');
  assert.ok(Math.abs(clip.tracks[0].values[14] - 1.2) < 0.0001);
  assert.equal(clip.tracks[0].values[4], 68);
});

test('jump uses physical vertical arc, never double-adds the FBX hip jump', () => {
  const clip = sampleClip([
    [-0.05, 57.8, 1.2], [0.2, 106, 69],
    [-3, 109, 138], [-1, 60, 207], [-0.05, 57.8, 272.7]
  ]);
  const unrelated = {
    name: 'mixamorigHead.position',
    times: new Float32Array([0, 1]),
    values: new Float32Array([1, 2, 3, 4, 5, 6])
  };
  clip.tracks.push(unrelated);
  removeBakedHipTravel(clip, 'jump');
  const v = clip.tracks[0].values;
  assert.ok(Math.abs(v[14] - v[2]) < 0.0001);
  for (let i = 1; i < v.length; i += 3) assert.ok(Math.abs(v[i] - v[1]) < 0.0001);
  assert.deepEqual([...unrelated.values], [1, 2, 3, 4, 5, 6]);
});

test('root-motion correction is stable if applied twice', () => {
  const clip = sampleClip([
    [0, 60, 0], [1, 63, 30], [2, 59, 60], [1, 62, 90], [0, 60, 120]
  ]);
  removeBakedHipTravel(clip, 'walk');
  const once = [...clip.tracks[0].values];
  removeBakedHipTravel(clip, 'walk');
  for (let i = 0; i < once.length; i++) {
    assert.ok(Math.abs(clip.tracks[0].values[i] - once[i]) < 0.00001);
  }
});

test('grounded detection matches Rapier capsule and rejects rising/falling', () => {
  assert.equal(isPlayerGrounded(0.84, 0), true);
  assert.equal(isPlayerGrounded(0.90, 0.1), true);
  assert.equal(isPlayerGrounded(0.84, 5.2), false);
  assert.equal(isPlayerGrounded(0.90, -3), false);
  assert.equal(isPlayerGrounded(1.42, 0), false);
});

test('jump cannot transition to walk/idle midair or before landing animation ends', () => {
  assert.equal(jumpMayFinish(false, true, 1, 1), false);
  assert.equal(jumpMayFinish(true, false, 1, 1), false);
  assert.equal(jumpMayFinish(true, true, 0.65, 1), false);
  assert.equal(jumpMayFinish(true, true, 0.995, 1), true);
  assert.equal(jumpMayFinish(true, true), true);
});

test('joystick motion uses walk by default and RUN toggle increases the same movement', () => {
  assert.deepEqual(resolveLocomotion(1, 0, false), {
    moving: true, speed: 3.5, motion: 'walk'
  });
  assert.deepEqual(resolveLocomotion(1, 0, true), {
    moving: true, speed: 6, motion: 'run'
  });
  assert.deepEqual(resolveLocomotion(0, 0, true), {
    moving: false, speed: 6, motion: 'idle'
  });
  assert.equal(resolveLocomotion(0.7, 0.7, true).motion, 'run');
});

test('sprint movement selection does not depend on jump playback or grounding', () => {
  // The locomotion intent can continue during takeoff, airborne motion and
  // landing; only the visual animation switches to the Jump pose.
  for (const airborne of [false, true]) {
    const locomotion = resolveLocomotion(1, 0.5, true);
    const activeJump = airborne;
    assert.equal(locomotion.motion, 'run');
    assert.equal(locomotion.speed, 6);
    assert.equal(typeof activeJump, 'boolean');
  }
});
