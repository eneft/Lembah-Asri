import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Non-destructive look-development viewer: real UV-restored FBX keyframes and rig.
const clips = [
  { name: 'Running Normal', file: './assets/Running_Web_UV.fbx' },
  { name: 'Run Anime', file: './assets/Run_Web_UV.fbx' },
];
const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const status = $('#status');
const buttons = [$('#running'), $('#run')];
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
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

const ambient = new THREE.AmbientLight(0xffffff, .72);
const hemisphere = new THREE.HemisphereLight(0xf3faff, 0x789b7b, 1.08);
const key = new THREE.DirectionalLight(0xfff4e5, 2.2);
const fill = new THREE.DirectionalLight(0xcfedff, .82);
const rim = new THREE.DirectionalLight(0xfdf8ec, .95);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -4;
key.shadow.camera.right = 4;
key.shadow.camera.top = 4;
key.shadow.camera.bottom = -4;
key.shadow.camera.near = .1;
key.shadow.camera.far = 25;
key.shadow.bias = -.00018;
key.shadow.normalBias = .025;
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
grid.position.y = -.018;
scene.add(grid);

const presets = {
  day: {
    name: 'Day / Neutral', sky: '#d8edf2', floor: 0x9ab3a2, exposure: 1.02,
    ambient: .7, hemisphere: 1.15, hemiSky: 0xf7fcff, hemiGround: 0x899f8b,
    key: 2.25, keyColor: 0xfff4e5, keyPos: [3.2, 6, 4.5],
    fill: .82, fillColor: 0xcde5ff, fillPos: [-3.7, 2.4, 2.7],
    rim: 1.0, rimColor: 0xf1f7ff, rimPos: [-3.0, 3.7, -4.1]
  },
  sunset: {
    name: 'Warm Sunset', sky: '#f3d5bc', floor: 0xa5a082, exposure: .94,
    ambient: .76, hemisphere: 1.01, hemiSky: 0xffe5c9, hemiGround: 0x867965,
    key: 2.05, keyColor: 0xffb56e, keyPos: [-4.3, 3.5, 4.8],
    fill: .96, fillColor: 0xaecbff, fillPos: [4.4, 2.6, 2.3],
    rim: 1.42, rimColor: 0xffd8a1, rimPos: [2.5, 3.2, -4.2]
  },
  indoor: {
    name: 'Soft Indoor', sky: '#e7e5dc', floor: 0xa8aaa2, exposure: 1.07,
    ambient: .95, hemisphere: 1.24, hemiSky: 0xfff8e9, hemiGround: 0x969c99,
    key: 1.55, keyColor: 0xffebd5, keyPos: [1.1, 5.5, 3.6],
    fill: 1.24, fillColor: 0xe0eeff, fillPos: [-3.7, 3, 1.2],
    rim: .70, rimColor: 0xffffff, rimPos: [-1.5, 3.1, -3.9]
  }
};
let currentLight = 'day';
let currentMaterial = 'toon';
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
const flatMaterial = new THREE.MeshBasicMaterial({
  map: atlas, side: THREE.DoubleSide, toneMapped: false, alphaTest: .025
});
let activeMaterials = { toon: toonMaterial, flat: flatMaterial };
let customNormalMap = null;
let normalDetail = true;
let sourceTextureUrls = [];
function applyMaterial(){
  activeMaterials.toon.normalMap = normalDetail ? (customNormalMap || normalAtlas) : null;
  activeMaterials.toon.needsUpdate = true;
  const chosen = activeMaterials[currentMaterial];
  instances.forEach(ins => ins?.model.traverse(obj => {
    if (obj.isMesh) obj.material = chosen;
  }));
  setActive(materialButtons, 'material', currentMaterial);
  $('#materialLabel').textContent = currentMaterial === 'toon' ? 'Soft Anime Toon' : 'Albedo Original';
}
materialButtons.forEach(button => button.addEventListener('click', () => {
  currentMaterial = button.dataset.material;
  applyMaterial();
}));
normalToggle.addEventListener('change', () => {
  normalDetail = normalToggle.checked;
  applyMaterial();
});

const loader = new FBXLoader();
const instances = [null, null];
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
function install(index, model){
  model.traverse(obj => {
    if (obj.isMesh) {
      obj.material = activeMaterials[currentMaterial];
      obj.castShadow = true;
      obj.receiveShadow = false; // no hard black patches on hand-painted fabrics
      obj.frustumCulled = false;
    }
  });
  normalize(model);
  const mixer = new THREE.AnimationMixer(model);
  if (!model.animations?.length) throw new Error('Tidak ada animasi dalam ' + clips[index].file);
  const action = mixer.clipAction(model.animations[0]);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();
  model.visible = false;
  scene.add(model);
  instances[index] = { model, mixer, action, duration: model.animations[0].duration };
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
  clipText.textContent = index === 0 ? 'RUNNING' : 'RUN ANIME';
  setStatus(`${clips[index].name} · ${instances[index].duration.toFixed(2)}s per siklus · ${presets[currentLight].name}`);
}
buttons.forEach((b, i) => b.addEventListener('click', () => select(i)));
playButton.addEventListener('click', () => {
  playing = !playing;
  playButton.textContent = playing ? '⏸ Pause' : '▶ Play';
  playButton.setAttribute('aria-label', playing ? 'Pause animasi' : 'Mainkan animasi');
  instances.forEach(x => { if (x) x.mixer.timeScale = playing ? playbackSpeed : 0; });
});
resetButton.addEventListener('click', () => {
  camera.position.set(3.1, 2.2, 4.5);
  controls.target.set(0, 1.04, 0);
  controls.update();
});
speedSlider.addEventListener('input', () => {
  playbackSpeed = Number(speedSlider.value);
  speedText.textContent = playbackSpeed.toFixed(2) + '×';
  instances.forEach(x => { if (x) x.mixer.timeScale = playing ? playbackSpeed : 0; });
});
const chooser = $('#fbxFiles');
chooser.addEventListener('change', async event => {
  const files = Array.from(event.target.files || []);
  const fbx = files.filter(f => /\.fbx$/i.test(f.name));
  const first = fbx.find(f => /running/i.test(f.name));
  const second = fbx.find(f => /(^|[^a-z])run([^a-z]|$)/i.test(f.name) && !/running/i.test(f.name)) || fbx.find(f => f !== first);
  if (!first || !second) { setStatus('Pilih Running.fbx dan Run.fbx', true); return; }
  const findTexture = re => files.find(f => re.test(f.name));
  const baseImage = findTexture(/basecolor|albedo|diffuse/i);
  if (baseImage) {
    sourceTextureUrls.forEach(URL.revokeObjectURL);
    sourceTextureUrls = [];
    const make = file => {
      const url = URL.createObjectURL(file);
      sourceTextureUrls.push(url);
      return url;
    };
    const base = tex(make(baseImage), true);
    const userNormal = findTexture(/normal/i);
    const norm = userNormal ? tex(make(userNormal)) : null;
    activeMaterials = {
      toon: new THREE.MeshToonMaterial({
        map: base, gradientMap: gradient, normalMap: norm,
        normalScale: new THREE.Vector2(.2, .2),
        side: THREE.DoubleSide, alphaTest: .025
      }),
      flat: new THREE.MeshBasicMaterial({ map: base, toneMapped: false, side: THREE.DoubleSide, alphaTest: .025 })
    };
    normalDetail = !!norm;
    normalToggle.checked = normalDetail;
    normalToggle.disabled = !norm;
    // Rebind for dynamic normal toggling after custom texture import.
    customNormalMap = norm;
  }
  instances.forEach(x => {
    if (!x) return;
    scene.remove(x.model);
    x.mixer.stopAllAction();
  });
  instances[0] = null;
  instances[1] = null;
  [first, second].forEach((f, i) => { clips[i].file = URL.createObjectURL(f); });
  try {
    for (let i = 0; i < 2; i++) { setStatus('Memuat ' + [first, second][i].name); await loadModel(i); }
    applyMaterial();
    select(0);
    $('#fileHint').textContent = 'Dua animasi lokal berhasil dimuat';
  } catch (e) { console.error(e); setStatus('Gagal memuat FBX: ' + e.message, true); }
});

window.__lembahDiagnostics = () => ({
  selected, playing, material: currentMaterial, light: currentLight,
  exposure: renderer.toneMappingExposure,
  textured: !!activeMaterials[currentMaterial]?.map,
  textureLoaded: !!activeMaterials[currentMaterial]?.map?.image?.width,
  textureWidth: activeMaterials[currentMaterial]?.map?.image?.width || 0,
  clips: instances.map(x => {
    if (!x) return null;
    let mesh = null;
    x.model.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    const uv = mesh?.geometry?.getAttribute('uv');
    return { duration: x.duration, meshCount: uv?.count || 0,
      uv0: uv ? [uv.getX(0), uv.getY(0)] : null, materialType: mesh?.material?.type };
  })
});
function resize(){ camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }
addEventListener('resize', resize);
function animate(){
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .075);
  controls.update();
  instances.forEach(x => { if (x) x.mixer.update(delta); });
  renderer.render(scene, camera);
}
setLighting('day');
applyMaterial();
animate();
(async () => {
  try {
    for (let i = 0; i < clips.length; i++) {
      setStatus(`Memuat ${clips[i].name} (${i + 1}/2)...`);
      await loadModel(i);
    }
    select(0);
    $('#fileHint').textContent = 'Dua animasi telah dimuat otomatis';
  } catch (e) { console.error(e); setStatus('Aset otomatis gagal: ' + e.message + ' · Bisa pilih FBX manual', true); }
})();