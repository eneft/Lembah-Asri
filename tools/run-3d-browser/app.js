import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Non-destructive look-development viewer: real UV-restored FBX keyframes and rig.
const clips = [
  { name: 'Running Normal', file: './assets/Running_Web_UV.fbx', builtIn: true },
  { name: 'Run Anime', file: './assets/Run_Web_UV.fbx', builtIn: true },
];
const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const status = $('#status');
const buttons = [$('#running'), $('#run')];
const extraButtons = $('#extraClips');
const extrasRow = $('#extrasRow');
const playButton = $('#play');
const resetButton = $('#reset');
const speedSlider = $('#speed');
const speedText = $('#speedText');
const clipText = $('#clip');
const exposureSlider = $('#exposure');
const exposureText = $('#exposureText');
const normalToggle = $('#normalDetail');
const lightingButtons = [...document.querySelectorAll('[data-light]')];
const materialButtons = [...document.querySelectorAll('[data-material]')];

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// AgX keeps the original hand-painted hues natural under warm/cool lighting.
renderer.toneMapping = THREE.AgXToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#d8edf2', 14, 28);
const camera = new THREE.PerspectiveCamera(39, innerWidth / innerHeight, .03, 100);
camera.position.set(3.1, 2.2, 4.5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.04, 0);
controls.enableDamping = true;
controls.minDistance = 1.35;
controls.maxDistance = 10;
controls.maxPolarAngle = Math.PI / 2.06;
controls.update();
// Phone framing keeps the full animated model clear of the two-row bottom dock.
const compactView = () => window.matchMedia('(max-width:750px)').matches;
function homeCamera(){
  const phone = compactView();
  camera.fov = phone ? 39 : 39;
  camera.position.set(...(phone ? [2.55, 2.0, 3.75] : [3.1, 2.2, 4.5]));
  controls.target.set(0, phone ? .98 : 1.04, 0);
  camera.updateProjectionMatrix();
  controls.update();
}
homeCamera();

const ambient = new THREE.AmbientLight(0xffffff, .72);
const hemisphere = new THREE.HemisphereLight(0xf3faff, 0x789b7b, 1.08);
const key = new THREE.DirectionalLight(0xfff4e5, 2.2);
const fill = new THREE.DirectionalLight(0xcfedff, .82);
const rim = new THREE.DirectionalLight(0xfdf8ec, .95);
// Painterly studio contact shadow replaces hard cast silhouette.
key.castShadow = false;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -4;
key.shadow.camera.right = 4;
key.shadow.camera.top = 4;
key.shadow.camera.bottom = -4;
key.shadow.camera.near = .1;
key.shadow.camera.far = 25;
key.shadow.bias = -.00018;
key.shadow.normalBias = .019;
key.shadow.blurSamples = 12;
key.shadow.intensity = 0.58;
[key, fill, rim, ambient, hemisphere].forEach(light => scene.add(light));
const floorMat = new THREE.MeshStandardMaterial({ color: 0x9ab3a2, roughness: 1, metalness: 0 });
const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 72), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -.035;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(12, 24, 0x91aba7, 0xb1c9bd);
grid.material.transparent = true;
grid.material.opacity = .14;
grid.visible = false; // The staging grid is diagnostic, not a final-game visual.
grid.position.y = -.018;
scene.add(grid);
// Soft hand-painted contact shadow, independent of skinned mesh animation.
// This is a translucent procedural shadow, not an extra baked asset.
const shadowResolution = 128;
const shadowBytes = new Uint8Array(shadowResolution*shadowResolution*4);
for(let y=0;y<shadowResolution;y++){
  for(let x=0;x<shadowResolution;x++){
    const dx = (x + .5 - shadowResolution/2)/(shadowResolution/2);
    const dy = (y + .5 - shadowResolution/2)/(shadowResolution/2);
    const r2 = dx*dx + dy*dy;
    const falloff = Math.pow(Math.max(0,1-r2),3);
    const pos = (y*shadowResolution+x)*4;
    shadowBytes[pos]=56;
    shadowBytes[pos+1]=62;
    shadowBytes[pos+2]=52;
    shadowBytes[pos+3]=Math.round(falloff*95);
  }
}
const shadowTexture = new THREE.DataTexture(shadowBytes,shadowResolution,shadowResolution,THREE.RGBAFormat);
shadowTexture.colorSpace=THREE.SRGBColorSpace;
shadowTexture.minFilter=THREE.LinearFilter;
shadowTexture.magFilter=THREE.LinearFilter;
shadowTexture.generateMipmaps=false;
shadowTexture.needsUpdate=true;
const paintedShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1.75,1.35),
  new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1})
);
paintedShadow.rotation.x=-Math.PI/2;
paintedShadow.position.y=0.004;
paintedShadow.renderOrder=1;
scene.add(paintedShadow);

// Keep the key/fill/rim rig for the three comparable lighting presets.
const presets = {
  day: {
    name: 'Day / Neutral', sky: '#deeaf0', floor: 0xadb6a5, exposure: 1.24,
    ambient: .5, hemisphere: .94, hemiSky: 0xf7fcff, hemiGround: 0x899f8b,
    key: 1.68, keyColor: 0xfff2e3, keyPos: [3.2, 6, 4.5],
    fill: .46, fillColor: 0xe0edff, fillPos: [-3.7, 2.4, 2.7],
    rim: .58, rimColor: 0xf5f8ff, rimPos: [-3.0, 3.7, -4.1]
  },
  sunset: {
    name: 'Warm Sunset', sky: '#f3d9c5', floor: 0xb7ac93, exposure: 1.12,
    ambient: .52, hemisphere: .92, hemiSky: 0xffe5c9, hemiGround: 0x867965,
    key: 1.65, keyColor: 0xffca9c, keyPos: [-4.3, 3.5, 4.8],
    fill: .52, fillColor: 0xd4e4ff, fillPos: [4.4, 2.6, 2.3],
    rim: .76, rimColor: 0xffe3bf, rimPos: [2.5, 3.2, -4.2]
  },
  indoor: {
    name: 'Soft Indoor', sky: '#ece9e2', floor: 0xaea9a0, exposure: 1.24,
    ambient: .7, hemisphere: 1.02, hemiSky: 0xfff8e9, hemiGround: 0x969c99,
    key: 1.35, keyColor: 0xffead7, keyPos: [1.1, 5.5, 3.6],
    fill: .65, fillColor: 0xe1efff, fillPos: [-3.7, 3, 1.2],
    rim: .43, rimColor: 0xffffff, rimPos: [-1.5, 3.1, -3.9]
  }
};
let currentLight = 'day';
let currentMaterial = 'painterly';
let exposureAdjust = 1;
function setActive(items, attr, selected){
  items.forEach(button => {
    const active = button.dataset[attr] === selected;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function setLighting(name){
  if (!presets[name]) return;
  currentLight = name;
  const p = presets[name];
  scene.background = new THREE.Color(p.sky);
  scene.fog.color.set(p.sky);
  floorMat.color.setHex(p.floor);
  ambient.intensity = p.ambient;
  hemisphere.intensity = p.hemisphere;
  hemisphere.color.setHex(p.hemiSky);
  hemisphere.groundColor.setHex(p.hemiGround);
  for (const [light, intensity, color, pos] of [
    [key, p.key, p.keyColor, p.keyPos],
    [fill, p.fill, p.fillColor, p.fillPos],
    [rim, p.rim, p.rimColor, p.rimPos],
  ]) {
    light.intensity = intensity;
    light.color.setHex(color);
    light.position.set(...pos);
  }
  // Move warm/cool shadow palettes together with the three original light presets.
  const palette = name==='sunset'
    ? {shade:[.45,.43,.59],lit:[1.28,1.08,.86],rim:0xffedcc}
    : name==='indoor'
    ? {shade:[.47,.51,.60],lit:[1.18,1.12,1.07],rim:0xfff8e7}
    : {shade:[.38,.51,.70],lit:[1.22,1.11,1.01],rim:0xfff1dd};
  painterlyUniforms.shadowTint.value.set(...palette.shade);
  painterlyUniforms.lightTint.value.set(...palette.lit);
  painterlyUniforms.rimTint.value.setHex(palette.rim);
  renderer.toneMappingExposure = p.exposure * exposureAdjust;
  setActive(lightingButtons, 'light', name);
  $('#lightingLabel').textContent = p.name;
}
lightingButtons.forEach(button => button.addEventListener('click', () => setLighting(button.dataset.light)));
exposureSlider.addEventListener('input', () => {
  exposureAdjust = Number(exposureSlider.value);
  exposureText.textContent = exposureAdjust.toFixed(2) + '×';
  setLighting(currentLight);
});

const textureLoader = new THREE.TextureLoader();
function tex(path, color = false){
  const t = textureLoader.load(path, () => { /* displayed asynchronously */ });
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  // Keep TextureLoader's default flipY: these FBX's restored UVs were validated that way.
  return t;
}
const atlas = tex('./assets/basecolor.webp', true);
const normalAtlas = tex('./assets/normal.webp');
const rampValues = [
  90,90,90,255, 132,132,132,255, 175,175,175,255,
  207,207,207,255, 233,233,233,255, 255,255,255,255,
];
const gradient = new THREE.DataTexture(new Uint8Array(rampValues), 6, 1, THREE.RGBAFormat);
gradient.colorSpace = THREE.NoColorSpace;
gradient.magFilter = THREE.NearestFilter;
gradient.minFilter = THREE.NearestFilter;
gradient.generateMipmaps = false;
gradient.needsUpdate = true;
// Hand-painted albedo stays authoritative; no metallic sheen or glossy plastic.
const toonMaterial = new THREE.MeshToonMaterial({
  map: atlas, gradientMap: gradient,
  normalMap: normalAtlas,
  normalScale: new THREE.Vector2(.2, .2),
  color: 0xffffff, side: THREE.DoubleSide,
  alphaTest: .025
});

/* Lembah Asri painterly renderer v1.
 * Smooth stylized diffuse ramp with soft wrap lighting and a subtle shader rim.
 * Vertex/fragment modifications use stable Three.js shader includes; no UV or
 * FBX animation is changed. Cache key separates this from ordinary toon.
 */
const softRampBytes = new Uint8Array(256 * 4);
function smooth01(lo,hi,t){
  const v=THREE.MathUtils.clamp((t-lo)/(hi-lo),0,1);
  return v*v*(3-2*v);
}
for(let i=0;i<256;i++){
  const x=i/255;
  // Painterly grayscale illumination: rich shadows, smooth midtones, pale light.
  const value = 0.64 + .22*smooth01(.10,.58,x) + .12*smooth01(.52,.98,x);
  const v=Math.round(255*Math.min(.99,value));
  softRampBytes.set([v,v,v,255],i*4);
}
const softGradient = new THREE.DataTexture(softRampBytes,256,1,THREE.RGBAFormat);
softGradient.colorSpace=THREE.NoColorSpace;
softGradient.magFilter=THREE.LinearFilter;
softGradient.minFilter=THREE.LinearFilter;
softGradient.generateMipmaps=false;
softGradient.needsUpdate=true;
// Painterly V2: previous rim-only modification left the stock lighting washed out.
// New custom diffuse response preserves the input texture, UV, normal and rig.
const painterlyUniforms = {
  keyVS:{value:new THREE.Vector3(.4,.7,.6)},
  shadowTint:{value:new THREE.Vector3(.38,.51,.70)},
  lightTint:{value:new THREE.Vector3(1.22,1.11,1.01)},
  rimTint:{value:new THREE.Color('#fff1dd')},
  rimIntensity:{value:.16},
  inkStrength:{value:.15}
};
function makePainterlyMaterial({map=null,normalMap=null,color=0xffffff,transparent=false,opacity=1,alphaTest=0}={}){
  const material=new THREE.MeshToonMaterial({
    map,normalMap,normalScale:new THREE.Vector2(.12,.12),
    gradientMap:softGradient,color,side:THREE.DoubleSide,
    transparent,opacity,alphaTest
  });
  material.userData.painterly=true;
  material.customProgramCacheKey=()=> 'LembahAsriPainterlyShaderV4KnownGood';
  material.onBeforeCompile=shader=>{
    shader.uniforms.uLembahRimStrength=painterlyUniforms.rimIntensity;
    shader.uniforms.uLembahRimTint=painterlyUniforms.rimTint;
    shader.vertexShader=shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vLembahNormal;\nvarying vec3 vLembahView;'
    ).replace(
      '#include <fog_vertex>',
      'vLembahNormal = normalize(transformedNormal);\nvLembahView=normalize(-mvPosition.xyz);\n#include <fog_vertex>'
    );
    shader.fragmentShader=shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nuniform float uLembahRimStrength;\nuniform vec3 uLembahRimTint;\nvarying vec3 vLembahNormal;\nvarying vec3 vLembahView;'
    ).replace('#include <opaque_fragment>', [
      'vec3 laN=normalize(vLembahNormal);',
      'vec3 laV=normalize(vLembahView);',
      'float laL=dot(laN,normalize(vec3(0.4,0.78,0.48)));',
      'float laShade=smoothstep(-0.24,0.65,laL);',
      'vec3 laTone=mix(vec3(0.53,0.67,0.83),vec3(1.13,1.08,1.01),laShade);',
      // Preserve exactly the same outgoingLight as the prior working V1.
      'outgoingLight *= laTone;',
      'float laRim=pow(1.0-abs(dot(laN,laV)),4.0);',
      'outgoingLight+=uLembahRimTint*(laRim*uLembahRimStrength);',
      '#include <opaque_fragment>'
    ].join('\n'));
  };
  return material;
}
const painterlyMaterial=makePainterlyMaterial({map:atlas,normalMap:normalAtlas,alphaTest:.025});

const flatMaterial = new THREE.MeshBasicMaterial({
  map: atlas, side: THREE.DoubleSide, toneMapped: false, alphaTest: .025
});
let activeMaterials = { painterly:painterlyMaterial, toon: toonMaterial, flat: flatMaterial };
let customNormalMap = null;
let normalDetail = true;
let sourceTextureUrls = [];
function applyMaterial(){
  activeMaterials.toon.normalMap = normalDetail ? (customNormalMap || normalAtlas) : null;
  activeMaterials.toon.needsUpdate = true;
  activeMaterials.painterly.normalMap = normalDetail ? (customNormalMap || normalAtlas) : null;
  activeMaterials.painterly.needsUpdate = true;
  for(const ins of instances){
    ins?.model.traverse(obj=>{
      if(!obj.isMesh || !obj.userData.testMaterials)return;
      const painter=obj.userData.testMaterials.painterly;
      const materialOriginal=obj.userData.testMaterials.sourceNormal;
      const mats=Array.isArray(painter)?painter:[painter];
      mats.forEach((m,i)=>{
        m.normalMap=normalDetail?(Array.isArray(materialOriginal)?materialOriginal[i]:materialOriginal):null;
        m.needsUpdate=true;
      });
    });
  }
  const chosen = activeMaterials[currentMaterial];
  instances.forEach((ins, index) => ins?.model.traverse(obj => {
    if (!obj.isMesh) return;
    // Uploads keep their own UV layouts, embedded maps, colors and material slots.
    const looks = obj.userData.testMaterials;
    obj.material = index < 2 || !looks ? chosen : looks[currentMaterial];
  }));
  setActive(materialButtons, 'material', currentMaterial);
  $('#materialLabel').textContent = currentMaterial === 'painterly' ? 'Painterly V2 • Warna & bayangan lebih dalam' : currentMaterial === 'toon' ? 'Soft Toon Lama' : 'Albedo Original';
  if(instances[selected]) select(selected);
}
materialButtons.forEach(button => button.addEventListener('click', () => {
  currentMaterial = button.dataset.material;
  applyMaterial();
}));
$('#showGrid').addEventListener('change',e=>{grid.visible=e.target.checked;});
$('#showShadow').addEventListener('change',e=>{paintedShadow.visible=e.target.checked;});
normalToggle.addEventListener('change', () => {
  normalDetail = normalToggle.checked;
  applyMaterial();
});

// A custom FBX may have a completely different UV map. Build look-dev materials
// from the imported FBX's own maps, or from images supplied in the same selection.
function customMaterialVariants(original, extraTextures){
  const source = original || new THREE.MeshPhongMaterial({color:0xd5d7ce});
  const input = Array.isArray(source) ? source : [source];
  const toon = [];
  const flat = [];
  const painterly = [];
  const normals = [];
  for (const material of input) {
    const colorMap = extraTextures.color || material?.map || null;
    const detailMap = extraTextures.normal || material?.normalMap || null;
    normals.push(detailMap);
    const tint = colorMap ? 0xffffff : (material?.color?.clone() || new THREE.Color(0xd9dbd0));
    const transparent = !!material?.transparent;
    const alphaTest = material?.alphaTest || 0;
    painterly.push(makePainterlyMaterial({map:colorMap,normalMap:normalDetail?detailMap:null,color:tint,side:THREE.DoubleSide,transparent,opacity:material?.opacity ?? 1,alphaTest}));
    toon.push(new THREE.MeshToonMaterial({
      map:colorMap, normalMap:normalDetail ? detailMap:null,
      normalScale:new THREE.Vector2(.2,.2), gradientMap:gradient, color:tint,
      side:THREE.DoubleSide, transparent, opacity:material?.opacity ?? 1, alphaTest
    }));
    flat.push(new THREE.MeshBasicMaterial({
      map:colorMap, color:tint, side:THREE.DoubleSide, toneMapped:false,
      transparent, opacity:material?.opacity ?? 1, alphaTest
    }));
  }
  return {painterly:Array.isArray(source)?painterly:painterly[0],toon:Array.isArray(source)?toon:toon[0],flat:Array.isArray(source)?flat:flat[0],sourceNormal:Array.isArray(source)?normals:normals[0]};
}

const loader = new FBXLoader();
const instances = [null, null];
const uploadedUrls = [];
let activeUpload = false;
let selected = 0, playing = true, playbackSpeed = 1;
const clock = new THREE.Clock();
function setStatus(msg, isError = false){ status.textContent = msg; status.classList.toggle('error', isError); }
function normalize(model){
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  if (bounds.isEmpty()) throw new Error('FBX tidak memuat mesh');
  const size = bounds.getSize(new THREE.Vector3());
  if (!(size.y > .001)) throw new Error('Tinggi karakter FBX tidak valid');
  model.scale.multiplyScalar(2.15 / size.y);
  model.updateMatrixWorld(true);
  const fixed = new THREE.Box3().setFromObject(model);
  const center = fixed.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(center.x, fixed.min.y, center.z));
  model.updateMatrixWorld(true);
}
// Calibrate *animated* skinned bounds, not only the FBX bind pose. Importers
// often store an animated Hips/root translation which moves the shoes well
// above the floor after normalization. A parent anchor is not animated by FBX
// tracks, so it is safe to correct without editing the original keyframes.
function animatedFloorBounds(model){
  model.updateMatrixWorld(true);
  model.traverse(obj => {
    if (!obj.isSkinnedMesh) return;
    obj.skeleton?.update();
    // SkinnedMesh's cached boundingBox is otherwise based on an earlier pose.
    obj.computeBoundingBox();
  });
  return new THREE.Box3().setFromObject(model);
}
function groundCustomModel(model, mixer, animation, anchor){
  const duration = animation?.duration || 0;
  const samples = duration > 0.001 ? 9 : 1;
  let lowest = Infinity;
  let sampled = 0;
  for(let i=0; i<samples; i++){
    if(animation) mixer.setTime(duration * i / samples);
    const box = animatedFloorBounds(model);
    if(Number.isFinite(box.min.y)){
      lowest = Math.min(lowest, box.min.y);
      sampled++;
    }
  }
  if(animation) mixer.setTime(0);
  if (!sampled || !Number.isFinite(lowest)) throw new Error('Posisi kaki FBX tidak dapat diukur');
  anchor.position.y = -lowest; // floor surface at world y = 0
  anchor.updateMatrixWorld(true);
  return {floorCorrection:-lowest,contactGroundY:0,samples:sampled};
}
function setCustomFloorOffset(instance, value){
  if(!instance?.anchor) return;
  instance.floorOffset = value;
  instance.anchor.position.y = instance.floorCorrection + instance.floorOffset;
  instance.anchor.updateMatrixWorld(true);
}
function syncFloorUI(){
  const slider = $('#groundOffset'), label = $('#groundText'), row = $('#groundRow');
  const inst=instances[selected];
  row.hidden = !inst?.anchor;
  slider.value = String(inst?.floorOffset || 0);
  label.textContent = (inst?.floorOffset || 0).toFixed(2)+' m';
}

function install(index, model, suppliedTextures = {}){
  const custom = index >= 2;
  let meshCount = 0;
  model.traverse(obj => {
    if (obj.isMesh) {
      meshCount++;
      if (custom) obj.userData.testMaterials = customMaterialVariants(obj.material, suppliedTextures);
      obj.material = custom ? obj.userData.testMaterials[currentMaterial] : activeMaterials[currentMaterial];
      obj.castShadow = true;
      obj.receiveShadow = false; // no hard black patches on painted fabrics
      obj.frustumCulled = false;
    }
  });
  if (!meshCount) throw new Error('FBX ini hanya berisi animasi/rig tanpa mesh karakter. Unggah FBX yang menyertakan model (with skin).');
  normalize(model);
  // Keep the anchor separate from any animated FBX root/hips transforms.
  const anchor = custom ? new THREE.Group() : null;
  if(anchor) anchor.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const animation = model.animations?.[0] || null;
  if (animation) {
    const action = mixer.clipAction(animation);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
  }
  let grounding = {floorCorrection:0,contactGroundY:null,samples:0};
  if(custom) grounding = groundCustomModel(model,mixer,animation,anchor);
  model.visible = false;
  scene.add(anchor || model);
  instances[index] = { model, anchor, mixer, action:animation ? mixer.existingAction(animation) : null,
    duration:animation?.duration || 0, static:!animation, floorOffset:0, ...grounding };
  if (index === selected) select(index);
}
async function loadModel(index){
  return new Promise((resolve, reject) => {
    loader.load(clips[index].file, model => {
      try { install(index, model); resolve(); } catch (e) { reject(e); }
    }, e => {
      const percent = e.total ? Math.round(e.loaded / e.total * 100) : 0;
      if (percent > 0) setStatus(`Memuat model ${index + 1}/2 · ${percent}%`);
    }, reject);
  });
}
function renderExtras(){
  extrasRow.hidden = clips.length <= 2;
  extraButtons.replaceChildren();
  clips.slice(2).forEach((clip, i) => {
    const index = i + 2;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'extraClip';
    b.textContent = String(index+1).padStart(2,'0')+' · '+clip.name;
    b.title = clip.name;
    b.setAttribute('aria-pressed',String(index === selected));
    b.addEventListener('click',()=>select(index));
    extraButtons.appendChild(b);
  });
}
function select(index){
  if (!instances[index]) { setStatus('Animasi ' + (index + 1) + ' belum dimuat'); return; }
  selected = index;
  instances.forEach((x, i) => {
    if (!x) return;
    x.model.visible = i === index;
    x.mixer.timeScale = playing ? playbackSpeed : 0;
  });
  buttons.forEach((b, i) => {
    b.classList.toggle('active', i === index);
    b.setAttribute('aria-pressed', String(i === index));
  });
  [...extraButtons.children].forEach((b,i)=>{
    const active = i+2 === index;
    b.classList.toggle('active',active);
    b.setAttribute('aria-pressed',String(active));
  });
  clipText.textContent = index < 2 ? (index === 0 ? 'RUNNING' : 'RUN ANIME') : clips[index].name;
  syncFloorUI();
  setStatus(`${clips[index].name} · ${instances[index].static?'pose statis / tanpa animasi':instances[index].duration.toFixed(2)+'s per siklus'} · ${presets[currentLight].name} · ${currentMaterial==='painterly'?'Painterly V2':currentMaterial==='toon'?'Toon Lama':'Albedo'}`);
}
buttons.forEach((b, i) => b.addEventListener('click', () => select(i)));
playButton.addEventListener('click', () => {
  playing = !playing;
  playButton.textContent = playing ? '⏸ Pause' : '▶ Play';
  playButton.classList.toggle('paused', !playing);
  playButton.setAttribute('aria-label', playing ? 'Pause animasi' : 'Mainkan animasi');
  instances.forEach(x => { if (x) x.mixer.timeScale = playing ? playbackSpeed : 0; });
});
resetButton.addEventListener('click', homeCamera);
speedSlider.addEventListener('input', () => {
  playbackSpeed = Number(speedSlider.value);
  speedText.textContent = playbackSpeed.toFixed(2) + '×';
  instances.forEach(x => { if (x) x.mixer.timeScale = playing ? playbackSpeed : 0; });
});
// Settings use native HTML <details> so the gear works without JS event handlers.
const chooser = $('#fbxFiles');
const uploadStatus = $('#uploadStatus');
function setUploadStatus(message, isError=false){
  uploadStatus.textContent = message;
  uploadStatus.classList.toggle('uploadError',isError);
  if (isError) setStatus(message,true);
}
async function addNewFbx(files){
  const fbxFiles = files.filter(f => /\.fbx$/i.test(f.name));
  if (!fbxFiles.length) {
    setUploadStatus('Pilih minimal satu file .fbx untuk dites.',true); return;
  }
  if (activeUpload) { setUploadStatus('File lain sedang dimuat.',true); return; }
  activeUpload = true;
  const getImage = pattern => files.find(f => pattern.test(f.name));
  const baseFile = getImage(/(?:basecolor|albedo|diffuse)/i);
  const normalFile = getImage(/normal/i);
  // Only user-supplied images are applied to uploaded characters; otherwise
  // preserve the FBX's embedded materials, never force Lembah Asri atlas.
  const extras = {
    color:baseFile ? tex(URL.createObjectURL(baseFile),true) : null,
    normal:normalFile ? tex(URL.createObjectURL(normalFile)) : null
  };
  let count = 0;
  try{
    for(const file of fbxFiles){
      setUploadStatus('Memuat '+file.name+' ...');
      const object = loader.parse(await file.arrayBuffer(), '');
      const index = clips.length;
      clips.push({name:file.name.replace(/\.fbx$/i,''),file:file.name,builtIn:false});
      instances.push(null);
      try {
        install(index,object,extras);
        count++;
        renderExtras();
        select(index);
      } catch(err) {
        clips.pop(); instances.pop();
        setUploadStatus(file.name+': '+err.message,true);
      }
    }
    if (count > 0) {
      setUploadStatus(count+' FBX tambahan berhasil dimuat. Pilih lewat tombol di bawah animasi.');
      $('#fileHint').textContent=count+' FBX tambahan berhasil ditambahkan, 2 bawaan tetap ada.';
    }
  } catch(err){
    console.error(err);
    setUploadStatus('FBX gagal dibaca: '+err.message,true);
  } finally{
    activeUpload=false;
    chooser.value=''; // Safari permits choosing the same file again.
  }
}
chooser.addEventListener('change',event=>{
  const files=Array.from(event.target.files||[]);
  if(files.length) addNewFbx(files);
});
$('#clearExtras').addEventListener('click',()=>{
  for(const item of instances.slice(2)){
    if(!item)continue;
    scene.remove(item.anchor || item.model);
    item.mixer.stopAllAction();
    item.model.traverse(obj => {if(obj.isMesh && obj.userData.testMaterials) {
      for(const kind of ['painterly','toon','flat']) {
        const m=obj.userData.testMaterials[kind];
        (Array.isArray(m)?m:[m]).forEach(v=>v.dispose());
      }
    }});
  }
  clips.splice(2);
  instances.splice(2);
  uploadedUrls.splice(0).forEach(URL.revokeObjectURL);
  renderExtras();
  select(0);
  setUploadStatus('FBX tambahan dibersihkan. Dua animasi bawaan tetap tersedia.');
});

// Manual fine-tuning for unusual shoes/props/offsets. Does not touch bones.
$('#groundOffset').addEventListener('input', event => {
  const instance = instances[selected];
  if (!instance?.anchor) return;
  const value = Number(event.target.value);
  setCustomFloorOffset(instance, value);
  $('#groundText').textContent = value.toFixed(2)+' m';
});
$('#groundReset').addEventListener('click',()=>{
  const instance = instances[selected];
  if (!instance?.anchor) return;
  setCustomFloorOffset(instance, 0);
  syncFloorUI();
});

window.__lembahDiagnostics = () => ({
  selected, playing, material: currentMaterial, light: currentLight,
  painterlyShader:painterlyMaterial.userData.painterly,
  painterlyVersion:2,
  painterlyShadowTint:[...painterlyUniforms.shadowTint.value],
  hardFloorShadow:key.castShadow,
  painterlyRamp:softGradient.image?.width,
  shadowVisible:paintedShadow.visible,
  debugGrid:grid.visible,
  totalClips:clips.length, names:clips.map(x=>x.name), uploaded:Math.max(0,clips.length-2),
  exposure: renderer.toneMappingExposure,
  textured: !!activeMaterials[currentMaterial]?.map,
  textureLoaded: !!activeMaterials[currentMaterial]?.map?.image?.width,
  textureWidth: activeMaterials[currentMaterial]?.map?.image?.width || 0,
  clips: instances.map(x => {
    if (!x) return null;
    let mesh = null;
    x.model.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    const uv = mesh?.geometry?.getAttribute('uv');
    return { duration: x.duration, meshCount: uv?.count || 0, static:x.static||false,
      uv0: uv ? [uv.getX(0), uv.getY(0)] : null, materialType: mesh?.material?.type,
      autoGround:x.floorCorrection ?? null, manualOffset:x.floorOffset ?? 0,
      groundSamples:x.samples ?? 0, contactGroundY:x.contactGroundY ?? null,
      anchorY:x.anchor?.position.y ?? null };
  })
});
let lastCompact = compactView();
function resize(){
  const nextCompact = compactView();
  if (lastCompact !== nextCompact) { homeCamera(); lastCompact = nextCompact; }
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, nextCompact ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();
function animate(){
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .075);
  controls.update();
  // Three.js fragment normals are in view space, so update key direction
  // as the user orbits the camera around the avatar.
  camera.updateMatrixWorld(true);
  painterlyUniforms.keyVS.value.copy(key.position).sub(key.target.position).normalize().transformDirection(camera.matrixWorldInverse);
  instances.forEach(x => { if (x) x.mixer.update(delta); });
  renderer.render(scene, camera);
}
setLighting('day');
applyMaterial();
animate();
(async () => {
  try {
    for (let i = 0; i < 2; i++) {
      setStatus(`Memuat ${clips[i].name} (${i + 1}/2)...`);
      await loadModel(i);
    }
    if (selected < 2) select(0);
    $('#fileHint').textContent = 'Dua animasi telah dimuat otomatis';
  } catch (e) { console.error(e); setStatus('Aset otomatis gagal: ' + e.message + ' · Bisa pilih FBX manual', true); }
})();