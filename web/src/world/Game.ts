import { applyPaintedPigment } from './paintedPigment.ts';
import * as THREE from 'three';
import { serializeWorldScene } from './worldExport';
import RAPIER from '@dimforge/rapier3d-compat';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { createPaintedStoryTree } from './paintedTrees';
import { loadPaintedTreeSource, instantiatePaintedTree } from './treeAsset';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { PLAYER_BODY_GROUND_Y, isPlayerGrounded, jumpMayFinish, removeBakedHipTravel, resolveLocomotion } from './characterAnimation';
import { applyHandPaintedMaterials } from './handPaintedMaterials';
import { keepCameraOutsideGeometry } from './cameraOcclusion';
import { activateCharacterMotion } from './animationState';
import { ChapterFarm } from './chapterFarm';
import { chapterMode, type ChapterTask } from './homeChapter';
import { HomeFarm, type FarmHUD } from './homeFarm';
import { HoeSwing } from './hoeSwing';
import { reachablePlot, farmKeys, type FarmAction } from './farmPlots';
import { sculptGardenGround, plantingPlaces, gardenHeightAt, type GardenGround } from './gardenLayout';
import { createHomeStage, HOME, type SolidCollider } from './homeStage';
import { HOME_SCENIC_CAMERA } from './homeScenicCamera';
import { bridgeWalkHeightAt, makeBridgeWalkCollider, VILLAGE_CROSSING, BRIDGE_WALK, makeVillageBridgeCollider, villageBridgeHeightAt } from './paintedBridge';
import { installCreekCollision, guardCreekPlayerMovement } from './creekCollision';
import { applyRiversidePaint } from './riversidePaint';
import { villageFinishes, villageStream } from './villageSurfaces';
import { CREEK_PAINTED_TEXTURES, carveVisualCreek, updateHomeCreekWater } from './homeCreek';
import { applyMeadowAntiTileShader } from './meadowAntiTile';
import { createPaintedTerrainPlane, loadPaintedTerrainTextures } from './terrainMaterials';
import { createInstancedGrass } from './lowPolyGrass';
import { applyLembahDaylight, applyHomeWarmMorning, HOME_WARM_MORNING, LEMBAH_DAYLIGHT } from './sceneArtDirection';
import { createOutskirts } from './islandOutskirts';
import { createDistantValley, createNorthHomePanorama } from './distantValley';
import { createWarungStage } from './warungStage';
import { HOME_AREA, resolveSceneArea, inHomeArea, constrainHomePosition } from './sceneAreas';
import { HOME_LANDSCAPE, createHomeLandscapeGround, createHomeBoundaryGrove, homeLandscapeHeight } from './homeLandscape';
import {
  chapterSunOffset, villageSunOffset, homeMorningSunOffset, configureSunShadows, focusSunShadows, createPaintedShadowReceiver,
  createCharacterContactShadow, updateCharacterContactShadow
} from './sceneShadows';

type Motion = 'idle' | 'walk' | 'run' | 'jump';
export type PerformanceStats = { fps: number; drawCalls: number; triangles: number };

// Keep the horizon near the upper edge while retaining the ground ahead.
const CAMERA_HEIGHT_RATIO = .46;
const HOME_CAMERA_FOCUS_HEIGHT = 1.45;


export class Game {
  private renderer: THREE.WebGLRenderer;
  private readonly area = resolveSceneArea(window.location.search);
  private outskirts: ReturnType<typeof createOutskirts> = [];
  private panorama?: ReturnType<typeof createDistantValley>;
  private environmentTarget?: THREE.WebGLRenderTarget;
  private characterBaseColor?: THREE.Texture;
  private readonly sunOffset = this.area === 'home' ? homeMorningSunOffset : chapterMode() ? chapterSunOffset : villageSunOffset;
  private sunLight!: THREE.DirectionalLight;
  private characterContactShadow!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private villageWater?: THREE.Texture;
  private flowingCreekWater?: THREE.Object3D;
  private creekElapsedSeconds = 0;
  private scene = new THREE.Scene();
  private worldExportAssets: Promise<unknown>[] = [];
  private camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
  private world!: RAPIER.World;
  private player!: RAPIER.RigidBody;
  private playerMesh!: THREE.Group;
  private hoe?: HoeSwing;
  private mixer?: THREE.AnimationMixer;
  private actions: Partial<Record<Motion, THREE.AnimationAction>> = {};
  private jumpInProgress = false;
  private jumpLeftGround = false;
  private activeMotion?: Motion;
  private keys = new Set<string>();
  private touchMove = { x: 0, y: 0 };
  private touchRun = false;
  private previousPhysicsPosition = new THREE.Vector3();
  private currentPhysicsPosition = new THREE.Vector3();
  private cameraFocus = new THREE.Vector3();
  private cameraObstacles: THREE.Object3D[] = [];
  private homeSolids: SolidCollider[] = [];
  private houseReady: Promise<boolean> = Promise.resolve(false);
  private farm!: HomeFarm | ChapterFarm;
  private gardenGround!: GardenGround;

  private exportingScene = false;
  async exportWorldJSON(): Promise<string> {
    if (this.exportingScene) throw new Error('Scene export already running');
    this.exportingScene = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      // Stop submitting WebGL frames while preparing the editor snapshot:
      // otherwise mobile/software renderers compete for CPU and memory with
      // PNG encoding and geometry serialization.
      await Promise.race([
        Promise.all(this.worldExportAssets),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Scene assets did not finish loading')), 60_000);
        })
      ]);
      return serializeWorldScene(this.scene, new Set([this.playerMesh, this.characterContactShadow]));
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      this.exportingScene = false;
      this.last = performance.now();
    }
  }

  setFarmListener(fn?: (hud: FarmHUD | null) => void) { this.farm.setListener(fn); }

  useFarmAction(action: FarmAction, id?: number) {
    if (!this.playerMesh) return false;
    const {x, y, z} = this.playerMesh.position;
    this.farm.update(x, y, z, this.playerMesh.rotation.y);
    if (action !== 'hoe') return this.farm.act(action, id);
    if (this.jumpInProgress || this.hoe?.active) return false;
    const plot = plantingPlaces[id ?? reachablePlot(x,z,this.playerMesh.rotation.y)];
    if (!plot || !this.farm.act(action, plot.id)) return false;
    if (Math.hypot(plot.x-x,plot.z-z) > .05)
      this.playerMesh.rotation.y = Math.atan2(plot.x-x,plot.z-z);
    const facing = this.playerMesh.rotation.y;
    const bladeX = x + .82*Math.sin(facing);
    const bladeZ = z + .82*Math.cos(facing);
    this.hoe?.start(gardenHeightAt(bladeX,bladeZ)-y);
    return true;
  }

  interactChapter(expected?: ChapterTask) {
    if (!(this.farm instanceof ChapterFarm) || !this.playerMesh) return;
    const {x,y,z} = this.playerMesh.position;
    this.farm.update(x,y,z,this.playerMesh.rotation.y);
    this.farm.interact(expected);
  }

  private onWalkingGround() {
    const p = this.player.translation(), velocity = this.player.linvel();
    const ground=(x:number,z:number)=>
      Math.max(gardenHeightAt(x,z),bridgeWalkHeightAt(x,z), this.area === 'legacy' ? villageBridgeHeightAt(x,z) : 0, ...this.homeSolids
        .filter(s => /^(COL_Lantai|COL_Anak_tangga_)/.test(s.label)
          && Math.abs(x-s.center[0]) <= s.half[0]+0.02
          && Math.abs(z-s.center[2]) <= s.half[2]+0.02)
        .map(s => s.center[1]+s.half[1]));
    const height = ground(p.x, p.z);
    // Raised soil and the timber bridge share the same real physical contact
    // height. Otherwise running/jumping on the bridge is classified airborne.
    const step = .06;
    const slopeX = (ground(p.x + step, p.z) - ground(p.x - step, p.z)) / (2 * step);
    const slopeZ = (ground(p.x, p.z + step) - ground(p.x, p.z - step)) / (2 * step);
    return isPlayerGrounded(p.y - height, velocity.y - slopeX * velocity.x - slopeZ * velocity.z);
  }
  private performanceListener?: (stats: PerformanceStats) => void;
  private performanceFrames = 0;
  private performanceElapsed = 0;
  private lastPerfTick = performance.now();
  private idleSpine?: THREE.Bone;
  private idleSpineOffset = 0;
  private idleBlend = 0;
  private idleSeconds = 0;
  private jumpElapsed = 0;
  private jumpRequested = false;

  setTouchMove(x: number, y: number) {
    this.touchMove.x = THREE.MathUtils.clamp(x, -1, 1);
    this.touchMove.y = THREE.MathUtils.clamp(y, -1, 1);
  }
  setTouchRun(enabled: boolean) { this.touchRun = enabled; }
  setPerformanceMonitor(listener?: (stats: PerformanceStats) => void) {
    this.performanceListener = listener;
    this.performanceFrames = 0;
    this.performanceElapsed = 0;
  }
  triggerJump() { this.jumpRequested = true; }

  private frame = 0;
  private running = true;
  // Face the childhood home on the opening scene, camera behind the player.
  private yaw = 0;
  private last = performance.now();
  private accumulator = 0;
  private playerRuntimeLogged = false;
  private host: HTMLElement;
  private resizeObserver: ResizeObserver;
  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    // Menu navigation should never also drive the player.
    if (e.target instanceof HTMLElement && e.target.closest('select, input, textarea, [contenteditable="true"]')) return;
    if (key === 'e' && this.farm instanceof ChapterFarm) {
      if (!e.repeat) this.interactChapter();
      return;
    }
    if (/^[1-4]$/.test(key)) {
      if (!e.repeat) this.useFarmAction(farmKeys[Number(key) - 1]);
      return;
    }
    if (key === ' ' && e.target instanceof HTMLElement && e.target.closest('button')) return;
    this.keys.add(key);
    if (key === ' ') {
      e.preventDefault();
      if (!e.repeat) this.jumpRequested = true;
    }
  };
  private releaseKeyboard = () => {
    this.keys.clear();
    this.jumpRequested = false;
    this.dragging = false;
  };
  private onVisibilityChange = () => {
    if (document.hidden) this.releaseKeyboard();
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); };
  private onPointerUp = () => { this.dragging = false; };
  private cameraDistance = 8.6;

  private constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    // Limit render-target memory and GPU bandwidth on touch/mobile devices.
    // FBX character atlases are 4K and several animation files are large.
    const mobile = window.matchMedia('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Color management is configured together with the outdoor light rig
    // below, preserving NeutralToneMapping rather than switching to toon.
    // Outdoor sky environment: use a daylight sky instead of the previous
    // indoor RoomEnvironment so PBR albedo receives natural open-air lighting.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const sky = new Sky();
    sky.scale.setScalar(450000);
    sky.material.uniforms['turbidity'].value = 7;
    sky.material.uniforms['rayleigh'].value = 2;
    sky.material.uniforms['mieCoefficient'].value = 0.004;
    sky.material.uniforms['mieDirectionalG'].value = 0.82;
    // Match the environment sun direction to the scene's directional key light.
    const sunDirection = this.sunOffset.clone().normalize();
    sky.material.uniforms['sunPosition'].value.copy(sunDirection);
    const skyScene = new THREE.Scene();
    skyScene.add(sky);
    this.environmentTarget = pmrem.fromScene(skyScene);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = LEMBAH_DAYLIGHT.environmentIntensity;
    sky.geometry.dispose();
    sky.material.dispose();
    pmrem.dispose();
    this.renderer.domElement.tabIndex = 0;
    host.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 6, -9);
    const hemisphere = new THREE.HemisphereLight('#e9f5ff', '#82775f', 1.15);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight('#fff0d8', 2.1);
    this.sunLight = sun;
    configureSunShadows(sun, mobile);
    // Shadow camera follows the actor, not the map origin. This prevents
    // the childhood home from falling off the edge of the shadow frustum.
    focusSunShadows(sun, HOME.spawn.x, HOME.spawn.z, this.sunOffset);
    this.scene.add(sun, sun.target);
    // Keep a soft sky-side fill for matte PBR surfaces. Hand-painted
    // MeshBasicMaterial UV art never gets a second lighting pass.
    const skyFill = new THREE.DirectionalLight('#c7e5f4', 0.42);
    skyFill.position.set(12, 9, 18);
    this.scene.add(skyFill);
    applyLembahDaylight(this.scene, this.renderer, sun, hemisphere, skyFill);
    this.addEnvironment();
    if (this.area === 'home') applyHomeWarmMorning(this.scene, this.renderer, sun, hemisphere, skyFill);
    // Texture-load after all terrain surfaces have registered their UV scale.
    // A failed image request keeps the existing fallback color, not a blank map.
    this.worldExportAssets.push(loadPaintedTerrainTextures(
      Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
    ));
    // Static occluder meshes need valid world matrices for camera raycasts.
    this.scene.updateMatrixWorld(true);
    this.worldExportAssets.push(this.loadEnvironmentTrees());
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    window.addEventListener('blur', this.releaseKeyboard);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
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
    if (game.area === 'home') {
      const { minX, maxX, minZ, maxZ } = HOME_AREA;
      game.world.createCollider(RAPIER.ColliderDesc.cuboid((maxX-minX)/2, .25, (maxZ-minZ)/2)
        .setTranslation((minX+maxX)/2, -.25, (minZ+maxZ)/2), floor);
    } else {
      game.world.createCollider(RAPIER.ColliderDesc.cuboid(80, 0.25, 80).setTranslation(0, -0.25, 0), floor);
    }
    const { vertices, indices } = game.gardenGround;
    game.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES), floor);
    // Bridge deck + its long gentle approach ramps use a real collision
    // surface, not a render-only wooden slab that swallows the player's feet.
    const bridgeWalk=makeBridgeWalkCollider();
    game.world.createCollider(
      RAPIER.ColliderDesc.trimesh(bridgeWalk.vertices,bridgeWalk.indices).setFriction(.92),
      floor
    );
    if (game.area === 'legacy') {
      const villageWalk = makeVillageBridgeCollider();
      game.world.createCollider(RAPIER.ColliderDesc.trimesh(villageWalk.vertices,villageWalk.indices).setFriction(.92),floor);
    }
    // Invisible solid volumes follow the actual watercourse. The only opening
    // is the existing raised bridge; its deck and ramps stay unchanged.
    installCreekCollision(game.world, floor, RAPIER);
    // Distinct static colliders for the house, empty storage shed and fences.
    // Paths and the open gate remain physically traversable.
    await game.houseReady;
    const fixedScenery = game.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    for (const solid of game.homeSolids) {
      const [hx,hy,hz] = solid.half;
      const [x,y,z] = solid.center;
      game.world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx,hy,hz).setTranslation(x,y,z),
        fixedScenery
      );
    }
    const view = new URLSearchParams(window.location.search).get('view');
    const riverside = view === 'sungai';
    const conceptView = view === HOME_SCENIC_CAMERA.query;
    const arrival = conceptView
      ? {x:HOME_SCENIC_CAMERA.x,y:HOME.spawn.y,z:HOME_SCENIC_CAMERA.z}
      : riverside ? {x:-42.40,y:HOME.spawn.y,z:10.95} : chapterMode() ? {x:HOME.house.x, y:HOME.spawn.y, z:14.6} : HOME.spawn;
    if (conceptView) {
      // Interactive world seen from the river, with the well, raised bank,
      // trees and homestead all still real 3D and fully walkable.
      game.yaw = HOME_SCENIC_CAMERA.yaw;
      game.cameraDistance = HOME_SCENIC_CAMERA.distance;
    } else if (riverside) {
      game.yaw = .21;
      game.cameraDistance = 6.8;
    }
    const body = game.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(arrival.x, arrival.y, arrival.z).lockRotations().setCcdEnabled(true));
    game.world.createCollider(RAPIER.ColliderDesc.capsule(0.56, 0.28).setFriction(0.8), body);
    game.player = body;
    try {
      game.playerMesh = await game.loadPlayer();
      game.playerMesh.visible = true;
      if (riverside || chapterMode()) game.playerMesh.rotation.y = Math.PI;
      game.playerMesh.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.visible = true;
          object.frustumCulled = false;
        }
      });
      // Place the physics root at the body's real spawn transform before
      // the first render. The FBX visual starts at local origin; using that
      // as the initial camera target frames an empty point instead of the
      // Rapier spawn location on mobile.
      const spawn = game.player.translation();
      game.previousPhysicsPosition.set(spawn.x, spawn.y, spawn.z);
      game.currentPhysicsPosition.copy(game.previousPhysicsPosition);
      game.playerMesh.position.set(spawn.x, spawn.y - PLAYER_BODY_GROUND_Y, spawn.z);
      game.scene.add(game.playerMesh);
      game.playerMesh.updateMatrixWorld(true);
      // Snap the camera to the actual spawn position on first load.
      const spawnTarget = game.playerMesh.position.clone();
      const spawnOffset = new THREE.Vector3(
        Math.sin(game.yaw) * game.cameraDistance,
        game.cameraDistance * CAMERA_HEIGHT_RATIO,
        Math.cos(game.yaw) * game.cameraDistance
      );
      game.camera.position.copy(spawnTarget.clone().add(spawnOffset));
      game.cameraFocus.copy(spawnTarget).add(new THREE.Vector3(0, HOME_CAMERA_FOCUS_HEIGHT, 0));
      game.camera.lookAt(game.cameraFocus);
      const playerBounds = new THREE.Box3().setFromObject(game.playerMesh);
      console.info('[LembahAsri] Player visible', {
        meshes: (() => { let count = 0; game.playerMesh!.traverse(o => { if (o instanceof THREE.Mesh) count++; }); return count; })(),
        bounds: playerBounds.getSize(new THREE.Vector3()).toArray(),
        position: game.playerMesh.position.toArray(),
        camera: game.camera.position.toArray()
      });
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
    return applyPaintedPigment(new THREE.MeshLambertMaterial({
      color: new THREE.Color(color), toneMapped: false
    }));
  }

  private async loadPlayer(): Promise<THREE.Group> {
    const loader = new FBXLoader();
    const base = './models/character/';
    // Use the existing Idle FBX as both the visible character mesh and rig.
    // Keep its original UV layout and use the matching diffuse texture shipped
    // with this character package. No remote or replacement mesh is required.
    const [model, shaded] = await Promise.all([
      loader.loadAsync(base + 'Idle.fbx'),
      new THREE.TextureLoader().loadAsync(base + 'shaded.png')
    ]);
    model.name = 'LembahAsri_Player';
    const bounds = new THREE.Box3().setFromObject(model);
    const height = Math.max(bounds.max.y - bounds.min.y, 0.001);
    const scale = 1.68 / height;
    model.scale.setScalar(scale);

    const actorRoot = new THREE.Group();
    actorRoot.name = 'LembahAsri_PlayerRoot';
    const visualOffset = new THREE.Group();
    visualOffset.name = 'LembahAsri_PlayerVisualOffset';
    visualOffset.position.y = -bounds.min.y * scale;
    visualOffset.add(model);
    actorRoot.add(visualOffset);

    // Use the authored shaded atlas: it is the approved character texture
    // for this mesh and already contains the intended painted lighting.
    // FBX UVs require this PNG orientation; do not change the approved atlas.
    shaded.flipY = true;
    this.characterBaseColor = shaded;
    // Same unlit hand-painted preset as the GLB trees: no double-shading/PBR.
    applyHandPaintedMaterials(
      model,
      Math.min(8, this.renderer.capabilities.getMaxAnisotropy()),
      shaded
    );
    model.traverse(object => {
      if (object instanceof THREE.Mesh) object.frustumCulled = false;
      // The authored idle cycle lasts 8.33 s and has minimal movement.
      // Add a gentle spine breathing layer only when the player is idle.
      if (object instanceof THREE.Bone && /spine$/i.test(object.name) && !this.idleSpine) {
        this.idleSpine = object;
      }
    });

    actorRoot.updateMatrixWorld(true);
    this.mixer = new THREE.AnimationMixer(model);
    const idleClip = model.animations[0];
    if (!idleClip) throw new Error('Clip idle tidak ditemukan pada Idle.fbx');
    removeBakedHipTravel(idleClip, 'idle');
    idleClip.name = 'idle';
    const idleAction = this.mixer.clipAction(idleClip);
    idleAction.setLoop(THREE.LoopRepeat, Infinity);
    this.actions.idle = idleAction;
    // Start the actual FBX Idle immediately at full weight (no zero-length fade).
    this.activeMotion = activateCharacterMotion(this.actions, undefined, 'idle', 0);
    this.hoe = new HoeSwing(actorRoot);
    return actorRoot;
  }

  private async loadMotionClips() {
    const loader = new THREE.FileLoader();
    const clips: Array<[Exclude<Motion, 'idle'>, string]> = [
      ['walk', 'Walking.json'],
      ['run', 'Running.json'],
      ['jump', 'Jump.json']
    ];
    // Parallel background loading avoids serially blocking the first render.
    const results = await Promise.allSettled(
      clips.map(async ([motion, file]) => {
        const data = await loader.loadAsync('./models/character/clips/' + file);
        if (typeof data !== 'string') throw new Error('Invalid animation response: ' + file);
        const clip = THREE.AnimationClip.parse(JSON.parse(data));
        removeBakedHipTravel(clip, motion);
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
    this.activeMotion = activateCharacterMotion(this.actions, this.activeMotion, motion, fade);
  }

  private mat(color: string) {
    return this.makeAlbedoMaterial(color);
  }
  private box(parent: THREE.Object3D, name: string, size: [number,number,number], pos: [number,number,number], color: string) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), this.mat(color));
    mesh.name = name; mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private addEnvironment() {
    // Build only the active playable scene; keep the old village as an
    // explicit development preview while individual scenes are authored.
    const isolated = this.area === 'home';
    const loader = new THREE.TextureLoader();
    const loadWorldTexture = (url: string) => {
      // TextureLoader returns an empty Texture immediately. Keep a valid
      // image even on network/decode failure, instead of resolving readiness
      // with a null source that cannot be serialized by Three.js.
      const fallback = document.createElement('canvas');
      fallback.width = fallback.height = 2;
      const ctx = fallback.getContext('2d')!;
      if (/island-horizon|north-home-panorama|island-groves/.test(url)) {
        // Optional scenery disappears into the existing sky if art is missing.
        ctx.clearRect(0, 0, 2, 2);
      } else {
        ctx.fillStyle = /creek_meadow/.test(url) ? '#9db66a'
          : /creek_water/.test(url) ? '#75b3ac' : '#ffffff';
        ctx.fillRect(0, 0, 2, 2);
      }
      const texture = new THREE.CanvasTexture(fallback);
      texture.name = url;
      texture.userData.sourceURL = url;
      const ready = loader.loadAsync(url).then(loaded => {
        // Preserve settings applied by the caller (wrap, UV, color space).
        texture.image = loaded.image;
        texture.needsUpdate = true;
        texture.userData.sourceState = 'loaded';
      }).catch(error => {
        texture.userData.sourceState = 'fallback';
        console.warn('[LembahAsri] Using explicit scenery texture fallback:', url, error);
      });
      this.worldExportAssets.push(ready);
      return texture;
    };
    const finish = villageFinishes(loadWorldTexture);
    const home = createHomeStage(true, chapterMode(), isolated);
    this.host.dataset.fenceRevision = 'loading';
    this.worldExportAssets.push(home.ready.then(result => {
      const fence=home.root.getObjectByName('Home fence — uploaded GLB');
      this.host.dataset.fenceRevision=fence?.userData.spacingRevision ?? 'fallback';
      this.host.dataset.fenceTextureRevision=fence?.userData.textureRevision ?? 'fallback';
      return result;
    }));
    this.scene.add(home.root);
    const shed = home.root.getObjectByName('Empty timber storage shed');
    shed?.traverse(part => {
      if (part instanceof THREE.Mesh && part.name !== 'Shed opening') {
        part.material = part.name === 'Lean-to roof' ? finish.roof : finish.wood;
      }
    });
    this.farm = chapterMode() ? new ChapterFarm(home.garden) : new HomeFarm(home.garden);
    this.gardenGround = home.gardenGround;
    this.flowingCreekWater = home.root.getObjectByName('Shallow stream west of childhood home');
    this.cameraObstacles.push(...home.cameraBlockers);
    this.homeSolids = home.solids;
    this.houseReady = home.houseReady;
    const size = isolated ? HOME_AREA.maxZ-HOME_AREA.minZ+4 : 160;
    const cx = isolated ? (HOME_AREA.minX+HOME_AREA.maxX)/2 : 0;
    const cz = isolated ? (HOME_AREA.minZ+HOME_AREA.maxZ)/2 : 0;
    const ground = isolated ? createHomeLandscapeGround() : createPaintedTerrainPlane('grass', size, size, cx, cz, 0);
    ground.name = 'World painted grass UV terrain';
    carveVisualCreek(ground);
    // Break distant 3.5-m repeating grass tile grid globally, using the
    // approved painterly albedo without adding dark overlay planes.
    applyMeadowAntiTileShader(ground.material);
    applyRiversidePaint(ground.material,'meadow');
    this.scene.add(ground);
    // Preserve the painted albedo: a transparent ShadowMaterial layer catches
    // actual character, roof and tree shadows without re-lighting the texture.
    const groundShadows = createPaintedShadowReceiver(
      'World painted-terrain real shadows', size, size, cx, cz, 0.103
    );
    if (isolated) {
      groundShadows.material.color.set(HOME_WARM_MORNING.shadowColor);
      groundShadows.material.opacity=HOME_WARM_MORNING.shadowOpacity;
    }
    this.scene.add(carveVisualCreek(sculptGardenGround(groundShadows)));
    this.characterContactShadow = createCharacterContactShadow();
    if (isolated) {
      this.characterContactShadow.userData.baseOpacity=HOME_WARM_MORNING.contactShadowOpacity;
      this.characterContactShadow.material.opacity=HOME_WARM_MORNING.contactShadowOpacity;
    }
    this.scene.add(this.characterContactShadow);
    // One or two InstancedMesh draws for all small 3D grass tufts.
    this.scene.add(createInstancedGrass(73137, isolated
      ? (x,z) => inHomeArea(x,z) : undefined));
    if (!isolated) {
      const plaza = new THREE.Mesh(new THREE.BoxGeometry(24,0.18,18), this.mat('#c8b991'));
      plaza.position.set(0,0.02,-5); plaza.receiveShadow = true; this.scene.add(plaza);
      const plazaTop = createPaintedTerrainPlane('plaza', 24, 18, 0, -5, 0.113);
      plazaTop.name = 'Village plaza handpainted UV surface';
      this.scene.add(plazaTop);
      // Plaza surface is higher than the world receiver; receive shadows over
      // its hand-painted paved/earth surfaces as well.
      this.scene.add(createPaintedShadowReceiver(
        'Village plaza real shadows', 24, 18, 0, -5, 0.151
      ));
      const hall = new THREE.Group(); hall.position.set(-13,0,-12); this.scene.add(hall);
      const hallWall = this.box(hall,'Balai Desa walls',[10,4.2,7],[0,2.1,0],'#e8d5ae');
      hallWall.material = finish.wall;
      this.cameraObstacles.push(hallWall);
      this.box(hall,'Balai Desa timber trim',[10.2,.25,7.2],[0,3.6,0],'#76543a').material = finish.wood;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4,2.8,4),finish.roof);
      roof.position.set(0,5.2,0); roof.rotation.y=Math.PI/4; roof.castShadow=true; hall.add(roof);
      this.cameraObstacles.push(roof);
      this.box(hall,'Balai Desa veranda',[11,.3,2],[0,.3,4.2],'#9b7852');
      const gazebo = new THREE.Group(); gazebo.position.set(7,0,-7); this.scene.add(gazebo);
      this.box(gazebo,'Pendopo floor',[7,.35,6],[0,.35,0],'#9a7956');
      for (const x of [-2.8,2.8]) for (const z of [-2.3,2.3]) this.box(gazebo,'Pendopo post',[.22,3.1,.22],[x,1.9,z],'#79563a').material = finish.wood;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(5.2,2,4),finish.roof); cap.position.y=4.2; cap.rotation.y=Math.PI/4; cap.castShadow=true; gazebo.add(cap);
      this.cameraObstacles.push(cap);
      this.addBuilding(-1,-20,'Pasar Desa',finish);
      // Keep the market and add the separately editable warung alongside it.
      // Include stage colliders BEFORE Rapier static bodies are constructed.
      const warung = createWarungStage();
      this.worldExportAssets.push(warung.ready);
      this.scene.add(warung.root);
      warung.root.getObjectByName('Warung - low-poly clay fallback')?.traverse(part => {
        if (!(part instanceof THREE.Mesh)) return;
        if (/wall/i.test(part.name)) part.material = finish.wall;
        else if (/roof plane/i.test(part.name)) part.material = finish.roof;
        else if (/timber|shelv|counter|post|lintel|support/i.test(part.name)) part.material = finish.wood;
      });
      this.cameraObstacles.push(...warung.cameraBlockers);
      this.homeSolids.push(...warung.solids);
      // A real path joins its front step to the existing village plaza.
      const warungPath = createPaintedTerrainPlane('path', 2.0, 6.8, -9.5, -17.15, 0.021, true);
      warungPath.name = 'Warung approach - walkable UV path';
      warungPath.renderOrder = 3;
      this.scene.add(warungPath);
      this.addBuilding(17,-18,'Puskesmas',finish);
      // Separate the raised plaza path from the ground path. Previously the
      // 35 m plane sat 3 cm *inside* the plaza, causing occlusion popping.
      const path = createPaintedTerrainPlane('path',5,20.5,0,14.25,.018,true);
      path.renderOrder=3; this.scene.add(path);
      const plazaPath = createPaintedTerrainPlane('path',5,14.5,0,-3.25,.138,true);
      plazaPath.renderOrder=3; this.scene.add(plazaPath);
      // Trees are placed using local UV-painted 3D assets in loadEnvironmentTrees.
      this.villageWater = loadWorldTexture(CREEK_PAINTED_TEXTURES.water);
      this.scene.add(villageStream(this.villageWater));
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(VILLAGE_CROSSING.width,.24,VILLAGE_CROSSING.length),finish.wood); bridge.position.set(0,BRIDGE_WALK.top-.12,VILLAGE_CROSSING.z); bridge.castShadow=true; this.scene.add(bridge);
      // The two crossings share the authored bamboo model and atlas. Fit the
      // second visual to its existing deck after the home bridge has loaded.
      this.worldExportAssets.push(home.ready.then(() => {
        const original = home.root.getObjectByName('Uploaded wooden bridge - original GLB');
        if (!original) return;
        const crossing = new THREE.Group();
        crossing.name = 'Village bamboo footbridge';
        const copy = original.clone();
        copy.position.set(0,original.position.y,0);
        crossing.add(copy);
        crossing.rotation.y = Math.PI/2;
        crossing.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(crossing);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const mount = new THREE.Group();
        mount.scale.set(VILLAGE_CROSSING.width/size.x, 1, VILLAGE_CROSSING.length/size.z);
        mount.position.set(-center.x*mount.scale.x,0,VILLAGE_CROSSING.z-center.z*mount.scale.z);
        mount.add(crossing);
        this.scene.add(mount);
        bridge.visible = false;
      }));
    }
    if (isolated) {
      // No old island panorama, ocean, mountain, or village silhouette.
      // Compact depth comes from the real local hills and UV-painted grove.
      this.scene.background = new THREE.Color(HOME_LANDSCAPE.sky);
      this.scene.fog = new THREE.Fog(HOME_LANDSCAPE.sky, HOME_LANDSCAPE.fogNear, HOME_LANDSCAPE.fogFar);
      this.scene.userData.sceneArea = 'home';
    } else {
      const horizon = loadWorldTexture('textures/terrain/island-horizon.webp?v=3');
      this.outskirts = createOutskirts(loadWorldTexture('textures/terrain/creek_meadow.webp'),
        loadWorldTexture('textures/terrain/island-groves.webp'));
      this.scene.add(...this.outskirts);
      this.panorama = createDistantValley(horizon);
      this.panorama.add(createNorthHomePanorama(loadWorldTexture('textures/terrain/north-home-panorama.webp?v=1')));
      this.scene.add(this.panorama);
    }
  }
  private addBuilding(x:number,z:number,name:string,finish:ReturnType<typeof villageFinishes>) {
    const g=new THREE.Group(); g.position.set(x,0,z); this.scene.add(g);
    const wall = this.box(g,name+' walls',[7,3.5,6],[0,1.75,0],'#ecdfc3');
    wall.material = finish.wall;
    this.cameraObstacles.push(wall);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(5.2,2.1,4),finish.roof); roof.position.y=4.45; roof.rotation.y=Math.PI/4; roof.castShadow=true; g.add(roof);
    this.cameraObstacles.push(roof);
  }
  /** UV-painted true 3D trees, bundled locally instead of fetched from
   * an external GLB URL. All trees use the same reusable bark/leaf atlases.
   * The actual leaf crown is layered 3D geometry (not spheres or billboards).
   */
  private async loadEnvironmentTrees() {
    const placements: Array<{ x: number; z: number; height: number; yaw: number; seed: number }> = [
      { x: -50.2, z: -6.8, height: 4.9, yaw: 0.2, seed: 107 },
      { x: -51.7, z: 2.4, height: 4.9, yaw: 2.54, seed: 152 },
      { x: -53.6, z: -17.8, height: 5.7, yaw: 1.54, seed: 156 },
      { x: -51, z: -24, height: 4.3, yaw: .31, seed: 159 },
      { x: -42.9, z: -23.1, height: 5.1, yaw: 1.67, seed: 164 },
      { x: -56.4, z: 11.2, height: 4.6, yaw: .91, seed: 169 },
      { x: -50, z: 19, height: 3.5, yaw: 1.1, seed: 218 },
      { x: 25, z: 4, height: 4.3, yaw: 2.2, seed: 331 },
      { x: 24, z: -28, height: 4.0, yaw: 0.7, seed: 442 },
      { x: -7, z: -30, height: 3.4, yaw: 2.8, seed: 559 },
      { x: 29, z: 14, height: 3.8, yaw: 1.7, seed: 667 },
      { x: -31, z: -22, height: 4.5, yaw: 0.9, seed: 773 },
      // Sparse 3D tree silhouettes frame the distant creek, breaking the
      // huge featureless field without fencing in the village or touching
      // the playable house/road. Reuse the same UV tree source and shader.
      { x: -57, z: -42, height: 4.6, yaw: 2.4, seed: 831 },
      { x: -60, z: -28, height: 3.7, yaw: 0.6, seed: 907 },
      { x: -34, z: -39, height: 4.0, yaw: 1.5, seed: 991 }
    ];
    let source: THREE.Group | undefined;
    try {
      source = await loadPaintedTreeSource('shade');
    } catch (error) {
      // A broken/missing GLB must never prevent the rest of the game loading.
      console.warn('[LembahAsri] Using local 3D tree fallback', error);
    }
    if (this.area === 'home') {
      const groveSource = source ?? createPaintedStoryTree({kind:'shade',height:5.5,seed:1800});
      this.scene.add(createHomeBoundaryGrove(groveSource));
    }
    for (const placement of placements) {
      if (this.area === 'home' && !inHomeArea(placement.x,placement.z,HOME_AREA.grassPadding)) continue;
      const tree = source
        ? instantiatePaintedTree(source, placement.height, placement.x, placement.z, placement.yaw)
        : createPaintedStoryTree({
            kind: 'shade', height: placement.height, seed: placement.seed
          });
      if (!source) {
        tree.position.set(placement.x, 0, placement.z);
        tree.rotation.y = placement.yaw;
      }
      if (this.area === 'home') tree.position.y += homeLandscapeHeight(placement.x,placement.z);
      tree.name = 'Village handpainted shade tree ' + placement.seed;
      this.scene.add(tree);
    }
  }
  private pointerX=0;
  private dragging=false;
  private onPointerDown=(e:PointerEvent)=>{this.renderer.domElement.focus({preventScroll:true});this.dragging=true;this.pointerX=e.clientX;this.renderer.domElement.setPointerCapture(e.pointerId);};
  private onPointerMove=(e:PointerEvent)=>{
    if (!this.dragging) return;
    this.yaw -= (e.clientX-this.pointerX)*.006;
    this.pointerX=e.clientX;
  };
  private onWheel=(e:WheelEvent)=>{this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance * (e.deltaY>0?1.08:.92), 5, 17);};
  private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  private loop=()=>{if(!this.running)return;this.frame=requestAnimationFrame(this.loop);const now=performance.now();const dt=Math.min((now-this.last)/1000,.2);this.last=now;
    if (this.exportingScene) return;
    this.creekElapsedSeconds+=dt;
    if (this.villageWater) this.villageWater.offset.y = this.creekElapsedSeconds * .017;
    updateHomeCreekWater(this.flowingCreekWater,this.creekElapsedSeconds);
    // The render loop starts during construction, before async FBX + texture loading finishes.
    // Do not read playerMesh.position or update physics-driven visuals until the model exists.
    if(this.world&&this.player&&this.playerMesh){
      this.accumulator+=dt;
      const keyboardForward=(this.keys.has('w')?1:0)-(this.keys.has('s')?1:0);
      const keyboardSide=(this.keys.has('d')?1:0)-(this.keys.has('a')?1:0);
      const forward=Math.abs(this.touchMove.y)>.04?-this.touchMove.y:keyboardForward;
      const side=Math.abs(this.touchMove.x)>.04?this.touchMove.x:keyboardSide;
      // Touch RUN is a toggle so movement + sprint + jump needs only two fingers.
      const sprint=this.keys.has('shift') || this.touchRun;
      const { moving, speed, motion: desired } = resolveLocomotion(this.hoe?.active ? 0 : forward,this.hoe?.active ? 0 : side,sprint);
      const dir=moving ? new THREE.Vector3(side,0,-forward) : new THREE.Vector3();
      if(moving) dir.normalize().applyAxisAngle(new THREE.Vector3(0,1,0),this.yaw);
      const vel=this.player.linvel();
      this.player.setLinvel({x:dir.x*speed,y:vel.y,z:dir.z*speed},true);
      // Jump only from a resting capsule; never restart or cut it midair.
      if(this.jumpRequested && !this.hoe?.active && !this.jumpInProgress && this.onWalkingGround()){
        this.player.setLinvel({x:dir.x*speed,y:5.2,z:dir.z*speed},true);
        this.jumpInProgress=true;
        this.jumpLeftGround=false;
        this.jumpElapsed=0;
        this.playMotion('jump',0.08);
      }
      this.jumpRequested=false;
      // Interpolate the fixed 60 Hz physics transforms for stable rendering on
      // 90/120 Hz displays and variable-frame-rate mobile browsers.
      const fixedStep=1/60;
      while(this.accumulator>=fixedStep){
        this.previousPhysicsPosition.copy(this.currentPhysicsPosition);
        this.world.timestep=fixedStep;
        const before=this.player.translation();
        this.world.step();
        const stepped=this.player.translation();
        const bounded = this.area === 'home' ? constrainHomePosition(stepped.x,stepped.z) : stepped;
        const creekSafe=guardCreekPlayerMovement(before,bounded);
        const safe={...creekSafe,blocked:creekSafe.blocked || bounded.x!==stepped.x || bounded.z!==stepped.z};
        if(safe.blocked){
          const v=this.player.linvel();
          this.player.setTranslation({x:safe.x,y:stepped.y,z:safe.z},true);
          this.player.setLinvel({x:Math.abs(safe.x-stepped.x)>1e-5?0:v.x,y:v.y,z:Math.abs(safe.z-stepped.z)>1e-5?0:v.z},true);
        }
        this.currentPhysicsPosition.set(safe.x,stepped.y,safe.z);
        this.accumulator-=fixedStep;
      }
      const p=this.player.translation();
      const renderAlpha=THREE.MathUtils.clamp(this.accumulator/fixedStep,0,1);
      const rendered=this.previousPhysicsPosition.clone().lerp(this.currentPhysicsPosition,renderAlpha);
      this.playerMesh.position.set(rendered.x,rendered.y-PLAYER_BODY_GROUND_Y,rendered.z);
      if (!this.playerRuntimeLogged) {
        this.playerRuntimeLogged = true;
        const bounds = new THREE.Box3().setFromObject(this.playerMesh);
        console.info('[LembahAsri] Player runtime transform', {
          physics: [p.x, p.y, p.z],
          mesh: this.playerMesh.position.toArray(),
          worldBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
          visible: this.playerMesh.visible,
          camera: this.camera.position.toArray()
        });
      }
      if(moving){
        const facing=Math.atan2(dir.x,dir.z);
        const angularDelta=Math.atan2(
          Math.sin(facing-this.playerMesh.rotation.y),
          Math.cos(facing-this.playerMesh.rotation.y)
        );
        this.playerMesh.rotation.y+=angularDelta*(1-Math.exp(-16*dt));
      }
      if(this.jumpInProgress){
        this.jumpElapsed+=dt;
        const onGround=this.onWalkingGround();
        if(!onGround) this.jumpLeftGround=true;
        // Leave Jump active throughout takeoff, flight and the landing pose.
        this.playMotion('jump',0.08);
        const jumpAction=this.actions.jump;
        if(jumpMayFinish(this.jumpLeftGround,onGround,jumpAction?.time,jumpAction?.getClip().duration)
          || (this.jumpLeftGround && onGround && this.jumpElapsed > 2.1)){
          this.jumpInProgress=false;
          this.jumpLeftGround=false;
          this.jumpElapsed=0;
          this.playMotion(desired,0.16);
        }
      } else {
        this.playMotion(desired,0.16);
      }
      // Idle is an authored 8.33 s clip with subtle keyframes. Preserve
      // that clip and add a low-amplitude procedural breathing layer so that
      // the idle state is visible without changing the asset or skeleton.
      this.hoe?.restore();
      if (this.idleSpine) this.idleSpine.rotation.x -= this.idleSpineOffset;
      this.mixer?.update(dt);
      this.idleSeconds += dt;
      this.idleBlend = THREE.MathUtils.damp(
        this.idleBlend,
        this.activeMotion === 'idle' && !moving && !this.jumpInProgress ? 1 : 0,
        5,
        dt
      );
      this.idleSpineOffset = this.idleBlend * Math.sin(this.idleSeconds * 1.9) * 0.025;
      if (this.idleSpine) this.idleSpine.rotation.x += this.idleSpineOffset;
      this.hoe?.update(dt);
    }
    const target=this.playerMesh?.position??new THREE.Vector3();
    if (this.playerMesh) {
      this.farm.update(target.x, target.y, target.z, this.playerMesh.rotation.y);
      focusSunShadows(this.sunLight, target.x, target.z, this.sunOffset);
      updateCharacterContactShadow(this.characterContactShadow, target);
    }
    const desiredFocus=target.clone().add(new THREE.Vector3(0,HOME_CAMERA_FOCUS_HEIGHT,0));
    this.cameraFocus.lerp(desiredFocus,1-Math.exp(-12*dt));
    const offset=new THREE.Vector3(Math.sin(this.yaw)*this.cameraDistance,this.cameraDistance*CAMERA_HEIGHT_RATIO,Math.cos(this.yaw)*this.cameraDistance);
    const requested=target.clone().add(offset);
    const safeRequested=keepCameraOutsideGeometry(this.cameraFocus,requested,this.cameraObstacles);
    // Snap towards the near-side wall when obstructed, ease back out when clear.
    const easing=safeRequested.distanceTo(requested)>0.01 ? 1 : 1-Math.exp(-8*dt);
    const smoothed=this.camera.position.clone().lerp(safeRequested,easing);
    this.camera.position.copy(keepCameraOutsideGeometry(this.cameraFocus,smoothed,this.cameraObstacles));
    this.camera.lookAt(this.cameraFocus);
    this.renderer.render(this.scene,this.camera);
    // Diagnostic HUD is opt-in and samples at most once per second to avoid
    // the per-frame React rerenders that previously made mobile input janky.
    if (this.performanceListener) {
      this.performanceElapsed += Math.max(0, (now - this.lastPerfTick) / 1000);
      this.lastPerfTick = now;
      this.performanceFrames++;
      if (this.performanceElapsed >= 1) {
        this.performanceListener({
          fps: Math.round(this.performanceFrames / this.performanceElapsed),
          drawCalls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles
        });
        this.performanceFrames = 0;
        this.performanceElapsed = 0;
      }
    } else {
      this.lastPerfTick = now;
    }
  };
  dispose(){
    window.removeEventListener('blur', this.releaseKeyboard);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.running=false;this.hoe?.dispose();this.farm?.dispose();cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();window.removeEventListener('keydown',this.onKeyDown);window.removeEventListener('keyup',this.onKeyUp);window.removeEventListener('pointerup',this.onPointerUp);window.removeEventListener('pointercancel',this.onPointerUp);
    for (const layer of this.outskirts) {
      layer.geometry.dispose();
      layer.material.map?.dispose();
      layer.material.dispose();
    }
    if (this.panorama) {
      for (const child of this.panorama.children) {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
          child.material.map?.dispose();
          child.material.dispose();
          child.geometry.dispose();
        }
      }
      this.panorama.material.map?.dispose();
      this.panorama.material.dispose();
      this.panorama.geometry.dispose();
    }
    this.environmentTarget?.dispose();this.characterBaseColor?.dispose();this.renderer.dispose();if(this.renderer.domElement.parentElement===this.host)this.host.removeChild(this.renderer.domElement);this.world?.free();}
}
