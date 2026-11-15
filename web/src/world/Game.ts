import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type Motion = 'idle' | 'walk' | 'run' | 'jump';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
  private world!: RAPIER.World;
  private player!: RAPIER.RigidBody;
  private playerMesh!: THREE.Group;
  private mixer?: THREE.AnimationMixer;
  private actions: Partial<Record<Motion, THREE.AnimationAction>> = {};
  private activeMotion?: Motion;
  private keys = new Set<string>();
  private touchMove = { x: 0, y: 0 };
  private jumpRequested = false;

  setTouchMove(x: number, y: number) {
    this.touchMove.x = THREE.MathUtils.clamp(x, -1, 1);
    this.touchMove.y = THREE.MathUtils.clamp(y, -1, 1);
  }
  triggerJump() { this.jumpRequested = true; }

  private frame = 0;
  private running = true;
  private yaw = Math.PI;
  private pitch = 0.28;
  private last = performance.now();
  private accumulator = 0;
  private host: HTMLElement;
  private resizeObserver: ResizeObserver;
  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    this.keys.add(key);
    if (key === ' ' && !e.repeat) this.jumpRequested = true;
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); };
  private onPointerUp = () => { this.dragging = false; };
  private cameraDistance = 10;

  private constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    // Generate a soft image-based environment so imported PBR assets receive
    // broad ambient reflections like they do in the source 3D viewer.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentTarget = pmrem.fromScene(roomEnvironment, 0.04);
    this.scene.environment = environmentTarget.texture;
    this.scene.environmentIntensity = 0.55;
    roomEnvironment.dispose();
    pmrem.dispose();
    host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#a9d4e9');
    this.scene.fog = new THREE.Fog('#c8dfcf', 38, 115);
    this.camera.position.set(0, 6, -9);
    this.scene.add(new THREE.HemisphereLight('#e9f5ff', '#9b9277', 1.85));
    const sun = new THREE.DirectionalLight('#fff3dc', 1.65);
    sun.position.set(-18, 30, -12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 4;
    sun.shadow.camera.left = -35; sun.shadow.camera.right = 35;
    sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -35;
    this.scene.add(sun);
    this.addEnvironment();
    void this.loadEnvironmentTrees();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: true });
    this.resize();
    this.loop();
  }

  static async create(host: HTMLElement) {
    await RAPIER.init();
    const game = new Game(host);
    game.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const floor = game.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    game.world.createCollider(RAPIER.ColliderDesc.cuboid(80, 0.25, 80).setTranslation(0, -0.25, 0), floor);
    const body = game.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.2, 7).lockRotations());
    game.world.createCollider(RAPIER.ColliderDesc.capsule(0.56, 0.28).setFriction(0.8), body);
    game.player = body;
    try {
      game.playerMesh = await game.loadPlayer();
      game.scene.add(game.playerMesh);
      // Show the character as soon as the idle model is ready. The other
      // animation FBXs are large; load them after the player is already visible.
      void game.loadMotionClips();
    } catch (error) {
      game.dispose();
      throw new Error(`Gagal memuat karakter 3D dan animasinya: ${String(error)}`);
    }
    return game;
  }

  /**
   * Keep imported FBX/GLB materials intact. Rebuilding them as
   * MeshStandardMaterial can silently discard shader/material settings and
   * make a hand-painted asset look flat or incorrectly shaded.
   * Only color textures are tagged as sRGB; data maps remain linear.
   */
  private prepareImportedMaterials(root: THREE.Object3D) {
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        const textured = material as THREE.Material & {
          map?: THREE.Texture | null;
          emissiveMap?: THREE.Texture | null;
        };
        if (textured.map) {
          textured.map.colorSpace = THREE.SRGBColorSpace;
          textured.map.needsUpdate = true;
        }
        if (textured.emissiveMap) {
          textured.emissiveMap.colorSpace = THREE.SRGBColorSpace;
          textured.emissiveMap.needsUpdate = true;
        }
        material.needsUpdate = true;
      }
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }

  private makeAlbedoMaterial(color: string) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.88,
      metalness: 0
    });
  }

  private async loadPlayer(): Promise<THREE.Group> {
    const loader = new FBXLoader();
    const base = './models/character/';
    // Load only the base character first so the player can appear immediately.
    // The walk/run/jump FBXs are fetched separately in the background.
    const idleAsset = await loader.loadAsync(base + 'Orc-Idle.fbx');
    const model = idleAsset as THREE.Group;
    model.name = 'LembahAsri_Player';
    const bounds = new THREE.Box3().setFromObject(model);
    const height = Math.max(bounds.max.y - bounds.min.y, 0.001);
    const scale = 1.68 / height;
    model.scale.setScalar(scale);
    model.position.y = -bounds.min.y * scale;
    this.prepareImportedMaterials(model);

    this.mixer = new THREE.AnimationMixer(model);
    const idleClip = idleAsset.animations[0];
    if (!idleClip) throw new Error('Clip idle tidak ditemukan pada Orc Idle.fbx');
    idleClip.name = 'idle';
    const idleAction = this.mixer.clipAction(idleClip);
    idleAction.setLoop(THREE.LoopRepeat, Infinity);
    this.actions.idle = idleAction;
    this.playMotion('idle', 0);
    return model;
  }

  private async loadMotionClips() {
    const loader = new FBXLoader();
    const clips: Array<[Exclude<Motion, 'idle'>, string]> = [
      ['walk', 'Walking.fbx'],
      ['run', 'Running.fbx'],
      ['jump', 'Jump-Over.fbx']
    ];
    // Parallel background loading avoids serially blocking the first render.
    const results = await Promise.allSettled(
      clips.map(async ([motion, file]) => {
        const asset = await loader.loadAsync('./models/character/' + file);
        const clip = asset.animations[0];
        if (!clip) throw new Error(`Clip ${motion} tidak ditemukan pada ${file}`);
        clip.name = motion;
        const action = this.mixer!.clipAction(clip);
        if (motion === 'jump') {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        } else {
          action.setLoop(THREE.LoopRepeat, Infinity);
        }
        this.actions[motion] = action;
      })
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Gagal memuat animasi ${clips[index][0]}:`, result.reason);
      }
    });
  }

  private playMotion(motion: Motion, fade = 0.18) {
    const next = this.actions[motion];
    if (!next || this.activeMotion === motion) return;
    const previous = this.activeMotion ? this.actions[this.activeMotion] : undefined;
    next.reset().enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.play();
    if (previous && previous !== next) previous.crossFadeTo(next, fade, false);
    else next.fadeIn(fade);
    this.activeMotion = motion;
  }

  private mat(color: string) {
    return this.makeAlbedoMaterial(color);
  }
  private box(parent: THREE.Object3D, name: string, size: [number,number,number], pos: [number,number,number], color: string) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), this.mat(color));
    mesh.name = name; mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private addEnvironment() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160,160), this.mat('#91a96e'));
    ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; this.scene.add(ground);
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(24,0.18,18), this.mat('#c8b991'));
    plaza.position.set(0,0.02,-5); plaza.receiveShadow = true; this.scene.add(plaza);
    const hall = new THREE.Group(); hall.position.set(-13,0,-12); this.scene.add(hall);
    this.box(hall,'Balai Desa walls',[10,4.2,7],[0,2.1,0],'#e8d5ae');
    this.box(hall,'Balai Desa timber trim',[10.2,.25,7.2],[0,3.6,0],'#76543a');
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4,2.8,4),this.mat('#a94f35'));
    roof.position.set(0,5.2,0); roof.rotation.y=Math.PI/4; roof.castShadow=true; hall.add(roof);
    this.box(hall,'Balai Desa veranda',[11,.3,2],[0,.3,4.2],'#9b7852');
    const gazebo = new THREE.Group(); gazebo.position.set(7,0,-7); this.scene.add(gazebo);
    this.box(gazebo,'Pendopo floor',[7,.35,6],[0,.35,0],'#9a7956');
    for (const x of [-2.8,2.8]) for (const z of [-2.3,2.3]) this.box(gazebo,'Pendopo post',[.22,3.1,.22],[x,1.9,z],'#79563a');
    const cap = new THREE.Mesh(new THREE.ConeGeometry(5.2,2,4),this.mat('#a95036')); cap.position.y=4.2; cap.rotation.y=Math.PI/4; cap.castShadow=true; gazebo.add(cap);
    this.addBuilding(-1,-20,'Pasar Desa','#d8bd91','#8f4934');
    this.addBuilding(17,-18,'Puskesmas','#e9e4d3','#a95036');
    const path = new THREE.Mesh(new THREE.PlaneGeometry(5,35),this.mat('#b99b70'));
    path.rotation.x=-Math.PI/2; path.position.set(0,.08,7); this.scene.add(path);
    // Tree placement is handled by the imported hand-painted GLB asset.
    const water = new THREE.Mesh(new THREE.BoxGeometry(48,.12,2.6),this.mat('#5bafc2'));
    water.position.set(0,-.02,17); this.scene.add(water);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(5,.35,4),this.mat('#8b6242')); bridge.position.set(0,.35,17); bridge.castShadow=true; this.scene.add(bridge);
    for (let i=0;i<9;i++) { const hill=new THREE.Mesh(new THREE.SphereGeometry(9,12,8),this.mat(i%2?'#789b72':'#668c70')); hill.scale.set(1,.55,.65); hill.position.set(-48+i*12,5,-52); this.scene.add(hill); }
  }
  private addBuilding(x:number,z:number,name:string,walls:string,roofColor:string) {
    const g=new THREE.Group(); g.position.set(x,0,z); this.scene.add(g);
    this.box(g,name+' walls',[7,3.5,6],[0,1.75,0],walls);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(5.2,2.1,4),this.mat(roofColor)); roof.position.y=4.45; roof.rotation.y=Math.PI/4; roof.castShadow=true; g.add(roof);
  }
  private async loadEnvironmentTrees() {
    const treeUrl = 'https://d2ol7oe51mr4n9.cloudfront.net/user_3KuXgabELoP13yL56g9yyaMqNeN/406c5088-133a-4af3-8e72-cc8c4d69228e.glb';
    const placements: Array<{ x: number; z: number; height: number; yaw: number }> = [
      { x: -24, z: -4, height: 4.1, yaw: 0.2 },
      { x: -24, z: 13, height: 3.5, yaw: 1.1 },
      { x: 25, z: 4, height: 4.3, yaw: 2.2 },
      { x: 24, z: -28, height: 4.0, yaw: 0.7 },
      { x: -7, z: -30, height: 3.4, yaw: 2.8 },
      { x: 29, z: 14, height: 3.8, yaw: 1.7 },
      { x: -31, z: -22, height: 4.5, yaw: 0.9 }
    ];

    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(treeUrl);
      const source = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(source);
      const sourceHeight = Math.max(bounds.max.y - bounds.min.y, 0.001);
      this.prepareImportedMaterials(source);
      // Keep the authored hand-painted color dominant; soften only the
      // imported normal response so the bark and leaf brushwork stays legible.
      source.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          const mapped = material as THREE.Material & {
            normalScale?: THREE.Vector2;
            aoMap?: THREE.Texture | null;
            aoMapIntensity?: number;
          };
          if (mapped.normalScale) mapped.normalScale.set(0.5, 0.5);
          if (mapped.aoMap) mapped.aoMapIntensity = 0.72;
        }
      });

      for (const placement of placements) {
        const tree = source.clone(true);
        const scale = placement.height / sourceHeight;
        tree.scale.setScalar(scale);
        tree.position.set(placement.x, -bounds.min.y * scale, placement.z);
        tree.rotation.y = placement.yaw;
        tree.traverse(object => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        this.scene.add(tree);
      }
    } catch (error) {
      console.error('Gagal memuat aset pohon Lembah Asri:', error);
    }
  }
  private pointerX=0;
  private dragging=false;
  private onPointerDown=(e:PointerEvent)=>{this.dragging=true;this.pointerX=e.clientX;this.renderer.domElement.setPointerCapture(e.pointerId);};
  private onPointerMove=(e:PointerEvent)=>{if(!this.dragging)return;this.yaw-=(e.clientX-this.pointerX)*.006;this.pointerX=e.clientX;};
  private onWheel=(e:WheelEvent)=>{this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance * (e.deltaY>0?1.08:.92), 5, 17);};
  private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  private loop=()=>{if(!this.running)return;this.frame=requestAnimationFrame(this.loop);const now=performance.now();const dt=Math.min((now-this.last)/1000,.05);this.last=now;
    if(this.world&&this.player){
      this.accumulator+=dt;
      const keyboardForward=(this.keys.has('w')?1:0)-(this.keys.has('s')?1:0);
      const keyboardSide=(this.keys.has('d')?1:0)-(this.keys.has('a')?1:0);
      const forward=Math.abs(this.touchMove.y)>.04?-this.touchMove.y:keyboardForward;
      const side=Math.abs(this.touchMove.x)>.04?this.touchMove.x:keyboardSide;
      const moving=Math.hypot(forward,side)>.08;
      const sprint=this.keys.has('shift');
      const speed=sprint?6:3.5;
      const dir=new THREE.Vector3(side,0,-forward);
      if(moving) dir.normalize().applyAxisAngle(new THREE.Vector3(0,1,0),this.yaw);
      const vel=this.player.linvel();
      this.player.setLinvel({x:dir.x*speed,y:vel.y,z:dir.z*speed},true);
      if(this.jumpRequested && this.player.translation().y < 1.35){
        this.player.setLinvel({x:vel.x,y:5.2,z:vel.z},true);
        this.playMotion('jump',0.08);
      }
      this.jumpRequested=false;
      while(this.accumulator>=1/60){this.world.timestep=1/60;this.world.step();this.accumulator-=1/60;}
      const p=this.player.translation();
      this.playerMesh.position.set(p.x,p.y-.84,p.z);
      if(moving)this.playerMesh.rotation.y=Math.atan2(dir.x,dir.z);
      const airborne=p.y>1.42;
      if(airborne && this.activeMotion!=='jump') this.playMotion('jump',0.08);
      else if(!airborne){
        const desired:Motion=moving?(sprint?'run':'walk'):'idle';
        this.playMotion(desired,0.16);
      }
      this.mixer?.update(dt);
    }
    const target=this.playerMesh?.position??new THREE.Vector3();
    const offset=new THREE.Vector3(Math.sin(this.yaw)*this.cameraDistance,this.cameraDistance*.58,Math.cos(this.yaw)*this.cameraDistance);
    this.camera.position.lerp(target.clone().add(offset),.09);this.camera.lookAt(target.clone().add(new THREE.Vector3(0,1.3,0)));this.renderer.render(this.scene,this.camera);
  };
  dispose(){this.running=false;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();window.removeEventListener('keydown',this.onKeyDown);window.removeEventListener('keyup',this.onKeyUp);window.removeEventListener('pointerup',this.onPointerUp);window.removeEventListener('pointercancel',this.onPointerUp);this.renderer.dispose();if(this.renderer.domElement.parentElement===this.host)this.host.removeChild(this.renderer.domElement);this.world?.free();}
}
