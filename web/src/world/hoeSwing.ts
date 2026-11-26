import * as THREE from 'three';

const vec = () => new THREE.Vector3();
const quat = () => new THREE.Quaternion();
const smooth = THREE.MathUtils.smoothstep;
type Arm = { upper: THREE.Bone; fore: THREE.Bone; hand: THREE.Bone; side: number };

// Rotate a joint in world space, then express the result in its parent frame.
function aim(joint: THREE.Bone, child: THREE.Bone, target: THREE.Vector3, weight: number) {
  const origin = joint.getWorldPosition(vec());
  const from = child.getWorldPosition(vec()).sub(origin).normalize();
  const to = target.clone().sub(origin).normalize();
  const world = quat().setFromUnitVectors(from, to).multiply(joint.getWorldQuaternion(quat()));
  const local = joint.parent!.getWorldQuaternion(quat()).invert().multiply(world);
  joint.quaternion.slerp(local, weight);
}

function grip(arm: Arm, target: THREE.Vector3, pole: THREE.Vector3, weight: number) {
  const shoulder = arm.upper.getWorldPosition(vec());
  const elbow = arm.fore.getWorldPosition(vec());
  const upperLength = elbow.distanceTo(shoulder);
  const lowerLength = arm.hand.getWorldPosition(vec()).distanceTo(elbow);
  const axis = target.clone().sub(shoulder);
  const reach = THREE.MathUtils.clamp(axis.length(), Math.abs(upperLength-lowerLength)+.001, upperLength+lowerLength-.001);
  axis.normalize();
  const along = (reach*reach + upperLength*upperLength - lowerLength*lowerLength) / (2*reach);
  pole.sub(shoulder);
  pole.addScaledVector(axis, -pole.dot(axis)).normalize();
  const bend = shoulder.clone().addScaledVector(axis, along)
    .addScaledVector(pole, Math.sqrt(Math.max(0, upperLength*upperLength-along*along)));
  aim(arm.upper, arm.fore, bend, weight);
  aim(arm.fore, arm.hand, target, weight);
}

export class HoeSwing {
  private readonly tool = new THREE.Group();
  private readonly joints = new Map<THREE.Bone, THREE.Quaternion>();
  private readonly arms: Arm[] = [];
  private readonly spine?: THREE.Bone;
  private elapsed = 0;
  private ground = 0;
  get active() { return this.tool.visible; }

  constructor(privateRoot: THREE.Group) {
    const bone = (suffix: string) => privateRoot.getObjectByName('mixamorig'+suffix) as THREE.Bone | undefined;
    this.spine = bone('Spine');
    for (const [name, side] of [['Left',1], ['Right',-1]] as const) {
      const upper = bone(name+'Arm'), fore = bone(name+'ForeArm'), hand = bone(name+'Hand');
      if (upper && fore && hand) this.arms.push({upper,fore,hand,side});
    }
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.018,.023,.91,8),
      new THREE.MeshBasicMaterial({color:0x976737}));
    handle.position.y = .455;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(.19,.037,.23),
      new THREE.MeshBasicMaterial({color:0x596365}));
    blade.position.set(0,.89,.095);
    blade.rotation.x = -.23;
    this.tool.name = 'Cangkul';
    this.tool.visible = false;
    this.tool.add(handle,blade);
    privateRoot.add(this.tool);
  }

  start(groundOffset: number) {
    this.elapsed = 0;
    this.ground = groundOffset;
    this.tool.visible = true;
  }

  // Undo the previous procedural pose before the locomotion mixer runs.
  restore() {
    for (const [joint, rotation] of this.joints) joint.quaternion.copy(rotation);
    this.joints.clear();
  }

  update(dt: number) {
    if (!this.active) return;
    this.elapsed += dt;
    if (this.elapsed >= 1.05) { this.tool.visible = false; return; }
    const t = this.elapsed;
    const lift = smooth(t,0,.34);
    const strike = smooth(t,.34,.56);
    const recover = smooth(t,.66,1.05);
    const down = strike*(1-recover);
    const raised = lift*(1-strike);
    const weight = smooth(t,0,.12)*(1-recover);
    const root = this.tool.parent!;
    const angle = 1.1 - 1.40*raised + 1.24*down;
    this.tool.rotation.x = angle;
    this.tool.position.set(-.045, .98+.27*raised+(.77+this.ground-.98)*down, .22+.06*down);
    if (this.spine) {
      this.joints.set(this.spine,this.spine.quaternion.clone());
      const axis = vec().set(1,0,0).applyQuaternion(root.getWorldQuaternion(quat()))
        .applyQuaternion(this.spine.parent!.getWorldQuaternion(quat()).invert());
      this.spine.quaternion.premultiply(quat().setFromAxisAngle(axis,.48*down-.09*raised));
    }
    for (const arm of this.arms) {
      this.joints.set(arm.upper,arm.upper.quaternion.clone());
      this.joints.set(arm.fore,arm.fore.quaternion.clone());
      const target = this.tool.localToWorld(vec().set(0,arm.side===1?.29:.055,0));
      grip(arm,target,root.localToWorld(vec().set(arm.side*.55,.75,-.15)),weight);
    }
  }

  dispose() {
    for (const part of this.tool.children as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>[]) {
      part.geometry.dispose();
      part.material.dispose();
    }
    this.tool.removeFromParent();
  }
}
