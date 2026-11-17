import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { keepCameraOutsideGeometry } from '../src/world/cameraOcclusion.ts';
import { activateCharacterMotion } from '../src/world/animationState.ts';

test('third-person camera stays on near side of a building wall', () => {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 1), new THREE.MeshBasicMaterial());
  wall.position.set(0, 2, -5);
  const start = new THREE.Vector3(0, 1.3, 0);
  const desired = new THREE.Vector3(0, 4, -10);
  const safe = keepCameraOutsideGeometry(start, desired, [wall]);
  assert.ok(safe.z > -4.5, 'camera cannot enter the wall');
  assert.ok(safe.z < -0.3, 'camera stays behind the player');
  assert.ok(safe.distanceTo(start) < desired.distanceTo(start));
});

test('camera position is unchanged when scenery does not obstruct it', () => {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 1), new THREE.MeshBasicMaterial());
  wall.position.set(30, 2, -5);
  const focus = new THREE.Vector3(0, 1.3, 0);
  const wanted = new THREE.Vector3(0, 4, -10);
  const safe = keepCameraOutsideGeometry(focus, wanted, [wall]);
  assert.ok(safe.distanceTo(wanted) < 0.0001);
  assert.ok(keepCameraOutsideGeometry(focus, wanted, []).distanceTo(wanted) < 0.0001);
});

test('camera collision follows transformed building hierarchy', () => {
  const parent = new THREE.Group();
  parent.position.set(0, 0, -5);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 2), new THREE.MeshBasicMaterial());
  roof.position.y = 5;
  parent.add(roof);
  const focus = new THREE.Vector3(0, 1.3, 0);
  const wanted = new THREE.Vector3(0, 7, -11);
  const safe = keepCameraOutsideGeometry(focus, wanted, [roof]);
  assert.ok(safe.distanceTo(wanted) > 0.5);
});

test('Idle starts at full weight and continues playing after stopping', () => {
  const root = new THREE.Object3D();
  const breathing = new THREE.NumberKeyframeTrack(
    '.position[y]', [0, 2, 4, 6, 8.333], [0, 0.03, 0, -0.03, 0]
  );
  const walking = new THREE.NumberKeyframeTrack(
    '.position[y]', [0, 0.5, 1], [0, 0.15, 0]
  );
  const running = new THREE.NumberKeyframeTrack(
    '.position[y]', [0, 0.3, 0.6], [0, 0.22, 0]
  );
  const mixer = new THREE.AnimationMixer(root);
  const actions = {
    idle: mixer.clipAction(new THREE.AnimationClip('idle', 8.333, [breathing])),
    walk: mixer.clipAction(new THREE.AnimationClip('walk', 1, [walking])),
    run: mixer.clipAction(new THREE.AnimationClip('run', 0.6, [running]))
  };

  let active = activateCharacterMotion(actions, undefined, 'idle', 0);
  assert.equal(active, 'idle');
  mixer.update(0.2);
  assert.equal(actions.idle.getEffectiveWeight(), 1);
  assert.equal(actions.idle.isRunning(), true);

  active = activateCharacterMotion(actions, active, 'walk', 0.16);
  mixer.update(0.3);
  assert.equal(active, 'walk');
  active = activateCharacterMotion(actions, active, 'run', 0.16);
  mixer.update(0.3);
  assert.equal(active, 'run');

  // Releasing the joystick must actually restore the authored Idle clip.
  active = activateCharacterMotion(actions, active, 'idle', 0.16);
  mixer.update(0.3);
  assert.equal(active, 'idle');
  assert.ok(actions.idle.getEffectiveWeight() > 0.99);
  assert.equal(actions.idle.isRunning(), true);
  const before = root.position.y;
  mixer.update(0.95);
  assert.notEqual(root.position.y, before, 'Idle poses animate over time');
});

test('missing delayed FBX clip preserves current Idle rather than disabling it', () => {
  const mixer = new THREE.AnimationMixer(new THREE.Object3D());
  const idle = mixer.clipAction(new THREE.AnimationClip('idle', 2, []));
  const actions = { idle };
  let active = activateCharacterMotion(actions, undefined, 'idle', 0);
  mixer.update(0.1);
  active = activateCharacterMotion(actions, active, 'walk', 0.16);
  assert.equal(active, 'idle');
  assert.equal(idle.getEffectiveWeight(), 1);
});
