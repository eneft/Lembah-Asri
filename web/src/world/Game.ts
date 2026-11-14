import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
  private world!: RAPIER.World;
  private player!: RAPIER.RigidBody;
  private playerMesh!: THREE.Group;
  private keys = new Set<string>();
  private touchMove = { x: 0, y: 0 };

  setTouchMove(x: number, y: number) {
    this.touchMove.x = THREE.MathUtils.clamp(x, -1, 1);
    this.touchMove.y = THREE.MathUtils.clamp(y, -1, 1);
  }
  private frame = 0;
  private running = true;
  private yaw = Math.PI;
  private pitch = 0.28;
  private last = performance.now();
  private accumulator = 0;
  private host: HTMLElement;
  private resizeObserver: ResizeObserver;
  private onKeyDown = (e: KeyboardEvent) => { this.keys.add(e.key.toLowerCase()); };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); };
  private onPointerUp = () => { this.dragging = false; };
  private cameraDistance = 10;

  private constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#a9d4e9');
    this.scene.fog = new THREE.Fog('#c8dfcf', 38, 115);
    this.camera.position.set(0, 6, -9);
    this.scene.add(new THREE.HemisphereLight('#e9f5ff', '#7d795d', 2.0));
    const sun = new THREE.DirectionalLight('#fff0d2', 3.0);
    sun.position.set(-18, 30, -12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -35; sun.shadow.camera.right = 35;
    sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -35;
    this.scene.add(sun);
    this.addEnvironment();
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
    game.playerMesh = game.makePlayer();
    game.scene.add(game.playerMesh);
    return game;
  }

  private mat(color: string, roughness = 1) {
    return new THREE.MeshStandardMaterial({ color, roughness });
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
    // Balai desa: modular massing placeholder, kept deliberately asset-swappable.
    const hall = new THREE.Group(); hall.position.set(-13,0,-12); this.scene.add(hall);
    this.box(hall,'Balai Desa walls',[10,4.2,7],[0,2.1,0],'#e8d5ae');
    this.box(hall,'Balai Desa timber trim',[10.2,.25,7.2],[0,3.6,0],'#76543a');
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4,2.8,4),this.mat('#a94f35'));
    roof.position.set(0,5.2,0); roof.rotation.y=Math.PI/4; roof.castShadow=true; hall.add(roof);
    this.box(hall,'Balai Desa veranda',[11,.3,2],[0,.3,4.2],'#9b7852');
    // Pendopo alun-alun.
    const gazebo = new THREE.Group(); gazebo.position.set(7,0,-7); this.scene.add(gazebo);
    this.box(gazebo,'Pendopo floor',[7,.35,6],[0,.35,0],'#9a7956');
    for (const x of [-2.8,2.8]) for (const z of [-2.3,2.3]) this.box(gazebo,'Pendopo post',[.22,3.1,.22],[x,1.9,z],'#79563a');
    const cap = new THREE.Mesh(new THREE.ConeGeometry(5.2,2,4),this.mat('#a95036')); cap.position.y=4.2; cap.rotation.y=Math.PI/4; cap.castShadow=true; gazebo.add(cap);
    // Market and clinic masses.
    this.addBuilding(-1,-20,'Pasar Desa','#d8bd91','#8f4934');
    this.addBuilding(17,-18,'Puskesmas','#e9e4d3','#a95036');
    // Dirt paths.
    const path = new THREE.Mesh(new THREE.PlaneGeometry(5,35),this.mat('#b99b70'));
    path.rotation.x=-Math.PI/2; path.position.set(0,.08,7); this.scene.add(path);
    // Stylized trees with trunk and clustered foliage.
    for (const [x,z,s] of [[-22,-4,1.5],[-20,12,1.2],[22,2,1.7],[19,-27,1.2],[-5,-25,1.1],[13,13,1.1]] as number[][]) this.addTree(x,z,s);
    // Small stream and timber bridge.
    const water = new THREE.Mesh(new THREE.BoxGeometry(48,.12,2.6),new THREE.MeshStandardMaterial({color:'#5bafc2',roughness:.25,metalness:.05}));
    water.position.set(0,-.02,17); this.scene.add(water);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(5,.35,4),this.mat('#8b6242')); bridge.position.set(0,.35,17); bridge.castShadow=true; this.scene.add(bridge);
    // Distant hill silhouettes.
    for (let i=0;i<9;i++) { const hill=new THREE.Mesh(new THREE.SphereGeometry(9,12,8),this.mat(i%2?'#789b72':'#668c70')); hill.scale.set(1,.55,.65); hill.position.set(-48+i*12,5,-52); this.scene.add(hill); }
  }
  private addBuilding(x:number,z:number,name:string,walls:string,roofColor:string) {
    const g=new THREE.Group(); g.position.set(x,0,z); this.scene.add(g);
    this.box(g,name+' walls',[7,3.5,6],[0,1.75,0],walls);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(5.2,2.1,4),this.mat(roofColor)); roof.position.y=4.45; roof.rotation.y=Math.PI/4; roof.castShadow=true; g.add(roof);
  }
  private addTree(x:number,z:number,s:number) {
    const g=new THREE.Group(); g.position.set(x,0,z); g.scale.setScalar(s); this.scene.add(g);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.38,3,7),this.mat('#79543a')); trunk.position.y=1.5; trunk.castShadow=true; g.add(trunk);
    for(let i=0;i<7;i++){const leaf=new THREE.Mesh(new THREE.IcosahedronGeometry(1.25,1),this.mat(i%2?'#648b4c':'#7c9c52')); leaf.position.set(Math.sin(i*2.4)*1.1,3.1+Math.cos(i*1.8)*.7,Math.cos(i*2.4)*1.1); leaf.scale.set(1.15,.9,1); leaf.castShadow=true; g.add(leaf);}
  }
  private makePlayer() {
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(.25,.55,4,8),this.mat('#e8d4b3')); body.position.y=.78; body.castShadow=true; g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.23,12,10),this.mat('#c98e68')); head.position.y=1.35; head.castShadow=true; g.add(head);
    const cap=new THREE.Mesh(new THREE.SphereGeometry(.27,12,6,0,Math.PI*2,0,Math.PI/2),this.mat('#526d45')); cap.position.y=1.55; cap.castShadow=true; g.add(cap);
    const pack=this.box(g,'Backpack',[.42,.48,.22],[0,.85,-.30],'#65784a');
    pack.rotation.x=-.12;
    return g;
  }
  private pointerX=0;
  private dragging=false;
  private onPointerDown=(e:PointerEvent)=>{this.dragging=true;this.pointerX=e.clientX;this.renderer.domElement.setPointerCapture(e.pointerId);};
  private onPointerMove=(e:PointerEvent)=>{if(!this.dragging)return;this.yaw-=(e.clientX-this.pointerX)*.006;this.pointerX=e.clientX;};
  private onWheel=(e:WheelEvent)=>{this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance * (e.deltaY>0?1.08:.92), 5, 17);};
  private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  private loop=()=>{if(!this.running)return;this.frame=requestAnimationFrame(this.loop);const now=performance.now();const dt=Math.min((now-this.last)/1000,.05);this.last=now;
    if(this.world&&this.player){this.accumulator+=dt;const keyboardForward=(this.keys.has('w')?1:0)-(this.keys.has('s')?1:0);const keyboardSide=(this.keys.has('d')?1:0)-(this.keys.has('a')?1:0);const forward=Math.abs(this.touchMove.y)>.04?-this.touchMove.y:keyboardForward;const side=Math.abs(this.touchMove.x)>.04?this.touchMove.x:keyboardSide;const speed=this.keys.has('shift')?6:3.5;const dir=new THREE.Vector3(side,0,forward);dir.applyAxisAngle(new THREE.Vector3(0,1,0),this.yaw).normalize();const vel=this.player.linvel();this.player.setLinvel({x:dir.x*speed,y:vel.y,z:dir.z*speed},true);while(this.accumulator>=1/60){this.world.timestep=1/60;this.world.step();this.accumulator-=1/60;}const p=this.player.translation();this.playerMesh.position.set(p.x,p.y-.84,p.z);if(dir.lengthSq()>.01)this.playerMesh.rotation.y=Math.atan2(dir.x,dir.z);}
    const target=this.playerMesh?.position??new THREE.Vector3();const offset=new THREE.Vector3(Math.sin(this.yaw)*this.cameraDistance,this.cameraDistance*.58,Math.cos(this.yaw)*this.cameraDistance);this.camera.position.lerp(target.clone().add(offset),.09);this.camera.lookAt(target.clone().add(new THREE.Vector3(0,1.3,0)));this.renderer.render(this.scene,this.camera);
  };
  dispose(){this.running=false;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();window.removeEventListener('keydown',this.onKeyDown);window.removeEventListener('keyup',this.onKeyUp);window.removeEventListener('pointerup',this.onPointerUp);window.removeEventListener('pointercancel',this.onPointerUp);this.renderer.dispose();this.host.removeChild(this.renderer.domElement);this.world?.free();}
}