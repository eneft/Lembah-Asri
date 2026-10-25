import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// The animations and rig are read directly from the user's two original FBX
// files, with the original GLB UV map restored. No procedural running motion.
const clips = [
  {name: 'Running Normal', file: './assets/Running_Web_UV.fbx'},
  {name: 'Run Anime', file: './assets/Run_Web_UV.fbx'},
];
const stage = document.querySelector('#stage');
const status = document.querySelector('#status');
const buttons = [document.querySelector('#running'), document.querySelector('#run')];
const playButton = document.querySelector('#play');
const resetButton = document.querySelector('#reset');
const speed = document.querySelector('#speed');
const speedText = document.querySelector('#speedText');
const clipText = document.querySelector('#clip');
const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a2a2e');
scene.fog = new THREE.Fog('#1a2a2e',9,20);
const camera = new THREE.PerspectiveCamera(40,window.innerWidth/window.innerHeight,0.03,100);
camera.position.set(3.0,2.0,4.4);
const controls = new OrbitControls(camera,renderer.domElement);
controls.target.set(0,1.0,0);
controls.enableDamping = true;
controls.minDistance = 1.35;
controls.maxDistance = 10;
controls.maxPolarAngle = Math.PI/2.06;
controls.update();
scene.add(new THREE.HemisphereLight(0xd5e9fa,0x536b58,2.35));
const key = new THREE.DirectionalLight(0xffefd5,3.1);
key.position.set(-3,7,5);key.castShadow = true;key.shadow.mapSize.set(1024,1024);
key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=6;key.shadow.camera.bottom=-4;
scene.add(key);
const fill = new THREE.DirectionalLight(0xa0cbe0,.9);fill.position.set(4,3,-5);scene.add(fill);
const ground = new THREE.Mesh(new THREE.CircleGeometry(7,64),new THREE.MeshStandardMaterial({color:0x344b46,roughness:1}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.position.y=-.03;scene.add(ground);
const grid = new THREE.GridHelper(12,24,0x628781,0x49665e);
grid.position.y=-.025;grid.material.transparent=true;grid.material.opacity=.22;scene.add(grid);
const textureLoader = new THREE.TextureLoader();
function texture(path,asColor=false){let t=textureLoader.load(path);if(asColor)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
let userMaterial = null; // Material FBX embedded remains authoritative unless custom PNG textures were selected.
const loader = new FBXLoader();
const instances = [null,null];
let selected=0, playing=true, playbackSpeed=1, loading=0;
const clock = new THREE.Clock();
function setStatus(msg,isError=false){status.textContent=msg;status.classList.toggle('error',isError);}
function normalize(model){
 model.updateMatrixWorld(true);
 const bounds = new THREE.Box3().setFromObject(model);
 if(bounds.isEmpty())throw new Error('FBX tidak memuat mesh');
 const size=bounds.getSize(new THREE.Vector3());
 if(!(size.y>0.001))throw new Error('Tinggi karakter FBX tidak valid');
 const factor=2.15/size.y;
 model.scale.multiplyScalar(factor);
 model.updateMatrixWorld(true);
 const fixed = new THREE.Box3().setFromObject(model);
 const center=fixed.getCenter(new THREE.Vector3());
 model.position.sub(new THREE.Vector3(center.x,fixed.min.y,center.z));
 model.updateMatrixWorld(true);
}
function install(index,model){
 model.traverse(obj=>{
   if(obj.isMesh){if(userMaterial)obj.material=userMaterial;obj.castShadow=true;obj.receiveShadow=true;obj.frustumCulled=false;}
 });
 normalize(model);
 const mixer = new THREE.AnimationMixer(model);
 const animations = model.animations;
 if(!animations?.length)throw new Error('Tidak ada AnimationClip dalam '+clips[index].file);
 const action=mixer.clipAction(animations[0]);action.setLoop(THREE.LoopRepeat,Infinity);action.play();
 model.visible=false;
 scene.add(model);
 instances[index]={model,mixer,action,duration:animations[0].duration};
 if(index===selected)select(index);
}
async function loadModel(index){
 return new Promise((resolve,reject)=>{
   loader.load(clips[index].file,object=>{
     try{install(index,object);resolve();}catch(e){reject(e);}
   },e=>{
     const percent=e.total ? Math.round(e.loaded/e.total*100) : 0;
     if(percent>0)setStatus(`Memuat model ${index+1}/2 · ${percent}%`);
   },reject);
 });
}
function select(index){
 if(!instances[index]){setStatus('Animasi '+(index+1)+' belum selesai dimuat');return;}
 selected=index;
 for(let i=0;i<instances.length;i++)if(instances[i]){
    instances[i].model.visible = i===index;
    instances[i].mixer.timeScale=playing?playbackSpeed:0;
 }
 buttons.forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-pressed',String(i===index));});
 clipText.textContent = index===0?'RUNNING':'RUN ANIME';
 setStatus(clips[index].name+' · gerakan FBX asli · '+instances[index].duration.toFixed(2)+' detik / siklus');
}
buttons.forEach((b,i)=>b.addEventListener('click',()=>select(i)));
playButton.addEventListener('click',()=>{
 playing=!playing;playButton.textContent=playing?'⏸ Pause':'▶ Play';playButton.setAttribute('aria-label',playing?'Pause animasi':'Mainkan animasi');
 for(const x of instances)if(x)x.mixer.timeScale=playing?playbackSpeed:0;
});
resetButton.addEventListener('click',()=>{camera.position.set(3,2,4.4);controls.target.set(0,1,0);controls.update();});
speed.addEventListener('input',()=>{playbackSpeed=Number(speed.value);speedText.textContent=playbackSpeed.toFixed(2)+'×';for(const x of instances)if(x)x.mixer.timeScale=playing?playbackSpeed:0;});
function resize(){camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);}
window.addEventListener('resize',resize);
function animate(){requestAnimationFrame(animate);const delta=Math.min(clock.getDelta(),.075);controls.update();for(const x of instances)if(x)x.mixer.update(delta);renderer.render(scene,camera);}
animate();

const chooser=document.querySelector('#fbxFiles');
chooser.addEventListener('change',async (event)=>{
 const list=Array.from(event.target.files||[]);
 const fbx=list.filter(f=>/\.fbx$/i.test(f.name));
 const normal=fbx.find(f=>/running/i.test(f.name));
 const anime=fbx.find(f=>/(^|[^a-z])run([^a-z]|$)/i.test(f.name) && !/running/i.test(f.name)) || fbx.find(f=>f!==normal);
 if(!normal||!anime){setStatus('Pilih dua FBX: Running_Textured.fbx dan Run_Textured.fbx',true);return;}
 const findTexture=(re)=>list.find(f=>re.test(f.name));
 const color=findTexture(/basecolor|albedo|diffuse/i);
 if(color){
   const tex=texture(URL.createObjectURL(color),true);
   userMaterial=new THREE.MeshStandardMaterial({map:tex,roughness:.87,metalness:0,side:THREE.DoubleSide});
   const normalImage=findTexture(/normal/i),rough=findTexture(/roughness/i),metal=findTexture(/metallic/i);
   if(normalImage){userMaterial.normalMap=texture(URL.createObjectURL(normalImage));userMaterial.normalScale.set(.7,.7);}
   if(rough){userMaterial.roughnessMap=texture(URL.createObjectURL(rough));}
   if(metal){userMaterial.metalnessMap=texture(URL.createObjectURL(metal));userMaterial.metalness=.16;}
 }else{userMaterial=null;}
 const sources=[normal,anime];
 for(const item of instances){if(item){scene.remove(item.model);item.mixer.stopAllAction();}}
 instances[0]=null;instances[1]=null;
 for(let i=0;i<2;i++)clips[i].file=URL.createObjectURL(sources[i]);
 try{
   for(let i=0;i<clips.length;i++){setStatus('Memuat '+sources[i].name+' ...');await loadModel(i);}
   select(0);document.querySelector('#fileHint').textContent='2 animasi berhasil dimuat';
 }catch(err){console.error(err);setStatus('Gagal membaca FBX: '+err.message,true);}
});
setStatus('Pilih Running_Textured.fbx dan Run_Textured.fbx melalui kotak di bagian atas.');
