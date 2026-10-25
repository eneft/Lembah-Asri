import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const $=id=>document.getElementById(id);
const mobile=matchMedia('(max-width:760px), (pointer:coarse)').matches;
const stage=$('stage'),status=$('status');
const renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:'default'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1:1.6));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NeutralToneMapping;
stage.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color('#d9eae7');
const camera=new THREE.PerspectiveCamera(mobile?42:40,innerWidth/innerHeight,.08,100);
const followPosition=new THREE.Vector3(0,3.5,6.8);
const lookTarget=new THREE.Vector3(0,1,0);
const ambient=new THREE.HemisphereLight(0xfff8ed,0x7c9d89,1.3);
const sun=new THREE.DirectionalLight(0xffefdc,2.0);
sun.position.set(-3,6,5);
scene.add(ambient,sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x8aaf90,roughness:1}));
ground.rotation.x=-Math.PI/2;
ground.position.y=-.025;
scene.add(ground);
const groundLines=new THREE.GridHelper(40,40,0x68947b,0x86aa93);
groundLines.position.y=-.018;
groundLines.material.transparent=true;
groundLines.material.opacity=.23;
scene.add(groundLines);
const markers=new THREE.Group();
for(let x=-8;x<=8;x+=4) for(let z=-8;z<=8;z+=4){
  const tile=new THREE.Mesh(new THREE.CircleGeometry(.055,16),new THREE.MeshBasicMaterial({color:0xd6ebbf,transparent:true,opacity:.7,depthWrite:false}));
  tile.rotation.x=-Math.PI/2; tile.position.set(x,.001,z); markers.add(tile);
}
scene.add(markers);
const textureLoader=new THREE.TextureLoader();
const atlas=textureLoader.load('../run-tester/assets/basecolor.webp',undefined,undefined,e=>setStatus('Texture belum termuat, model tetap bisa dites',true));
atlas.colorSpace=THREE.SRGBColorSpace;
const flatMaterial=new THREE.MeshBasicMaterial({map:atlas,side:THREE.DoubleSide,alphaTest:.025});
const toonMaterial=new THREE.MeshToonMaterial({map:atlas,side:THREE.DoubleSide,alphaTest:.025});
const loader=new FBXLoader();
const actor=new THREE.Group(); scene.add(actor);
const slots={
  idle:{clip:null,label:'Idle'},
  walk:{clip:null,label:'Walking'},
  run:{clip:null,label:'Running'},
  anime:{clip:null,label:'Run Anime'}
};
const keys=new Set();
let root=null,mixer=null,currently=null,state='idle',runStyle='run',ready=false;
let rotationCorrection=0,runHeld=false,stickX=0,stickZ=0;
let lastTime=performance.now();
const velocity=new THREE.Vector3();
const movement=new THREE.Vector3();
const baseRigByName=new Map();
let loadingSlot=null;
let previewSlot=null;
let previewPaused=false;
let lastAnimationInfo='';
function setStatus(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
function setSlotLabel(slot,text){$(slot+'Name').textContent=text;}
function normBoneName(name){
  return String(name||'').replace(/^.*:/,'').replace(/^mixamorig/i,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
}
function trackNameParts(name){
  const index=name.lastIndexOf('.');
  if(index<0)return null;
  return {node:name.slice(0,index),prop:name.slice(index+1)};
}
function buildRigIndex(model){
  baseRigByName.clear();
  model.traverse(node=>{
    if(!node.name)return;
    const key=normBoneName(node.name);
    if(!baseRigByName.has(key))baseRigByName.set(key,node.name);
  });
}
function mapToBaseRig(original,slot){
  if(!original?.tracks?.length)throw Error('FBX tidak memiliki keyframe animasi');
  const matched=[], unmatched=[],targetNames=new Set();
  for(const track of original.tracks){
    const part=trackNameParts(track.name);
    if(!part){unmatched.push(track.name);continue;}
    const key=normBoneName(part.node);
    const bone=baseRigByName.get(key);
    if(!bone){unmatched.push(track.name);continue;}
    const converted=track.clone();
    converted.name=bone+'.'+part.prop;
    // Make locomotion in-place: x/z from hip translation must not drift away
    // from the controlled player capsule. Keep original vertical bounce.
    if(/(?:hips|pelvis|root)/i.test(part.node) && part.prop==='position' && converted.getValueSize()===3){
      const originX=converted.values[0],originZ=converted.values[2];
      for(let i=0;i<converted.values.length;i+=3){
        converted.values[i]=originX;
        converted.values[i+2]=originZ;
      }
    }
    matched.push(converted);targetNames.add(bone);
  }
  // An FBX may have a valid skeleton but contain only a static pose.
  // Report that honestly rather than claiming the clip is visibly animated.
  let movingTracks=0;
  for(const track of matched){
    const count=track.times?.length || 0;
    const step=track.getValueSize();
    if(count<2 || !step)continue;
    const values=track.values;
    let varied=false;
    for(let k=1;k<count && !varied;k++){
      for(let j=0;j<step;j++){
        if(Math.abs(values[k*step+j]-values[j])>0.004){varied=true;break;}
      }
    }
    if(varied)movingTracks++;
  }
  const fraction=matched.length/original.tracks.length;
  if(matched.length<5 || fraction<.55)throw Error('Rig tidak cocok: '+matched.length+'/'+original.tracks.length+' track cocok. Gunakan FBX dengan skeleton karakter yang sama.');
  if(!Number.isFinite(original.duration)||original.duration<=0)throw Error('Animasi FBX tidak memiliki durasi gerak');
  const clip=new THREE.AnimationClip(slot+'_'+Date.now(),original.duration,matched);
  clip.userData={sourceTracks:original.tracks.length,compatibleTracks:matched.length,coverage:fraction,nodes:targetNames.size,unmatched:unmatched.slice(0,4),movingTracks};
  return clip;
}
function normalizeCharacter(model){
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model);
  const height=box.max.y-box.min.y;
  if(!Number.isFinite(height)||height<.001)throw Error('Model FBX tidak memiliki ukuran valid');
  model.scale.multiplyScalar(2.1/height);
  model.updateMatrixWorld(true);
  const centered=new THREE.Box3().setFromObject(model);
  const midpoint=centered.getCenter(new THREE.Vector3());
  model.position.x-=midpoint.x;
  model.position.z-=midpoint.z;
  model.position.y-=centered.min.y;
  model.updateMatrixWorld(true);
}
async function loadBase(){
  setStatus('Memuat karakter 3D...');
  const model=await new Promise((res,rej)=>loader.load('../run-tester/assets/Running_Web_UV.fbx',res,undefined,rej));
  let meshCount=0;
  model.traverse(node=>{
    if(node.isMesh){
      meshCount++;
      node.material=$('toon').checked?toonMaterial:flatMaterial;
      node.frustumCulled=false;
      // No costly geometry rebuilding on iPhone; hand-painted atlas is readable unlit.
    }
  });
  if(!meshCount||!model.animations?.length)throw Error('Model/animasi bawaan tidak lengkap');
  normalizeCharacter(model);
  actor.add(model);
  root=model;
  buildRigIndex(model);
  mixer=new THREE.AnimationMixer(root);
  slots.run.clip=mapToBaseRig(model.animations[0],'run');
  setSlotLabel('run','Running bawaan · siap');
  syncPreviewButtons();
  ready=true;
  window.__movementReady=true;
  setStatus('Siap · tambah Idle dan Walking lewat ＋ Animasi');
  updateModeLabel();
}
async function loadAnime(){
  if(slots.anime.clip)return slots.anime.clip;
  const model=await new Promise((resolve,reject)=>loader.load('../run-tester/assets/Run_Web_UV.fbx',resolve,undefined,reject));
  const clip=mapToBaseRig(model.animations?.[0],'anime');
  slots.anime.clip=clip;
  setSlotLabel('anime','Run Anime bawaan · siap');
  syncPreviewButtons();
  return clip;
}
async function assignFile(slot,file){
  if(!ready)throw Error('Model dasar belum siap');
  if(loadingSlot)throw Error('Sedang memuat '+loadingSlot);
  if(!/\.fbx$/i.test(file.name))throw Error('Pilih file .fbx');
  loadingSlot=slot;
  setStatus('Membaca '+file.name+' untuk '+slots[slot].label+'...');
  try{
    // FBX is parsed locally. No file upload, API request or persistent storage.
    const buffer=await file.arrayBuffer();
    const asset=loader.parse(buffer,'');
    const original=asset.animations?.[0];
    const clip=mapToBaseRig(original,slot);
    // Remove the previous action before replacing a clip; otherwise the old
    // Running action may keep influencing the skeleton during a slot upload.
    mixer.stopAllAction();
    if(slots[slot].clip)mixer.uncacheClip(slots[slot].clip);
    slots[slot].clip=clip;
    setSlotLabel(slot,file.name+' · '+Math.round(clip.userData.coverage*100)+'% cocok · '+clip.duration.toFixed(2)+' dtk');
    const notice=clip.userData.movingTracks===0
      ? 'Peringatan: semua keyframe tampak statis, jadi gerakannya mungkin tidak kelihatan.'
      : clip.userData.movingTracks+' track memiliki perubahan gerak.';
    lastAnimationInfo=slots[slot].label+' dari '+file.name+': '+clip.userData.compatibleTracks+'/'+clip.userData.sourceTracks+' track rig cocok. '+notice;
    $('uploadResult').textContent=lastAnimationInfo;
    setStatus('FBX '+slots[slot].label+' terpasang • '+notice,clip.userData.movingTracks===0);
    currently=null;
    syncPreviewButtons();
    // Preview the freshly uploaded clip directly. In the old tester the
    // upload drawer obscured the character, and WALK only played on WASD.
    startPreview(slot);
    closeUploadPanel();
  }finally{loadingSlot=null;}
}
const previewNames={idle:'IDLE',walk:'WALKING',run:'RUNNING',anime:'RUN ANIME'};
function syncPreviewButtons(){
  for(const b of document.querySelectorAll('[data-preview]')){
    const slot=b.dataset.preview;
    b.disabled=!(slots[slot]?.clip) && !(slot==='anime'&&ready);
    b.title=b.disabled?'Belum ada FBX untuk slot ini':'Lihat gerakan '+previewNames[slot];
    b.classList.toggle('active',previewSlot===slot);
  }
}
function closeUploadPanel(){
  $('uploadPanel').hidden=true;
  $('openUpload').setAttribute('aria-expanded','false');
}
function stopPreview(){
  previewSlot=null;
  previewPaused=false;
  $('previewBar').hidden=true;
  $('previewPause').textContent='⏸ Pause';
  currently=null; // allow the regular locomotion state machine to take over
  syncPreviewButtons();
  updateModeLabel();
}
function startPreview(slot){
  if(!slots[slot]?.clip)return;
  keys.clear();runHeld=false;stickX=0;stickZ=0;resetStick();
  velocity.set(0,0,0);
  movement.set(0,0,0);
  actor.position.set(0,0,0);
  previewSlot=slot;
  previewPaused=false;
  currently=null;
  $('previewBar').hidden=false;
  $('previewPause').textContent='⏸ Pause';
  $('previewLabel').textContent='▶ '+previewNames[slot]+' · '+slots[slot].clip.duration.toFixed(2)+' dtk';
  transition(slot);
  if(slots[slot].clip.userData?.movingTracks===0){
    $('previewHint').textContent='File terpasang, tetapi keyframe-nya tidak menunjukkan perubahan gerak.';
  }else $('previewHint').textContent='Animasi diputar langsung pada karakter. Tekan Selesai untuk tes game.';
  syncPreviewButtons();
  closeUploadPanel();
}
for(const button of document.querySelectorAll('[data-preview]')){
  button.addEventListener('click',async()=>{
    const slot=button.dataset.preview;
    if(slot==='anime'&&!slots.anime.clip){
      try{await loadAnime();}
      catch(err){setStatus('Run Anime gagal dimuat: '+err.message,true);return;}
    }
    startPreview(slot);
  });
}
$('previewDone').addEventListener('click',stopPreview);
$('previewPause').addEventListener('click',()=>{
  if(!previewSlot)return;
  previewPaused=!previewPaused;
  $('previewPause').textContent=previewPaused?'▶ Lanjut':'⏸ Pause';
});

for(const input of document.querySelectorAll('input[data-slot]')){
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];
    input.value='';
    if(!file)return;
    try{await assignFile(input.dataset.slot,file);}
    catch(err){
      console.error(err);
      const message='Gagal '+input.dataset.slot+': '+(err?.message||err);
      $('uploadResult').textContent=message;
      setStatus(message,true);
    }
  });
}
async function chooseRun(style){
  runStyle=style;
  for(const b of document.querySelectorAll('[data-run]'))b.classList.toggle('active',b.dataset.run===style);
  if(style==='anime'&&!slots.anime.clip){
    setStatus('Memuat Run Anime ...');
    try{await loadAnime();setStatus('Run Anime siap');}
    catch(err){setStatus('Run Anime gagal: '+err.message,true);return;}
  }
  currently=null;
  updateModeLabel();
}
for(const b of document.querySelectorAll('[data-run]'))b.addEventListener('click',()=>chooseRun(b.dataset.run));
$('toon').addEventListener('change',()=>{
  root?.traverse(n=>{if(n.isMesh)n.material=$('toon').checked?toonMaterial:flatMaterial;});
});
$('face').addEventListener('input',()=>{
  rotationCorrection=Number($('face').value)*Math.PI/180;
  $('faceText').textContent=$('face').value+'°';
});
function updateModeLabel(){
  if(!ready)return;
  const isMoving=movement.lengthSq()>.04;
  const requested=isMoving?(runningInput()?(runStyle==='anime'?'anime':'run'):'walk'):'idle';
  const hasClip=!!slots[requested].clip;
  $('mode').textContent=(requested==='idle'?'IDLE':requested==='walk'?'WALKING':requested==='anime'?'RUN ANIME':'RUNNING')+(hasClip?'':' · FBX belum diisi');
}
function runningInput(){return runHeld||keys.has('shift');}
function transition(next){
  if(!mixer)return;
  if(next===currently)return;
  const prev=currently;
  currently=next;
  const item=slots[next];
  const action=item?.clip?mixer.clipAction(item.clip,root):null;
  if(action){
    action.reset();action.setLoop(THREE.LoopRepeat,Infinity);
    action.setEffectiveTimeScale(next==='walk'?1:next==='idle'?1:1.05);
    action.setEffectiveWeight(1).fadeIn(.2).play();
  }
  if(prev&&slots[prev]?.clip){
    const before=mixer.existingAction(slots[prev].clip,root);
    if(before){
      if(action)before.fadeOut(.2);
      else before.stop();
    }
  }
  if(!action){
    mixer.stopAllAction();
    root.pose?.(); // restore skin bind pose if available when Idle has no FBX
  }
  updateModeLabel();
}
function normalizeKey(key){
  const k=String(key).toLowerCase();
  return ({arrowup:'w',arrowleft:'a',arrowdown:'s',arrowright:'d'}[k]||k);
}
document.addEventListener('keydown',event=>{
  // Buttons may retain focus after closing the upload drawer. WASD still moves.
  if(event.target.closest('input[type="text"],input[type="number"],textarea,select'))return;
  const k=normalizeKey(event.key);
  if(['w','a','s','d','shift'].includes(k)){
    event.preventDefault();
    if(previewSlot)stopPreview();
    keys.add(k);
  }
});
document.addEventListener('keyup',event=>{
  const k=normalizeKey(event.key);
  if(['w','a','s','d','shift'].includes(k)){event.preventDefault();keys.delete(k);}
});
window.addEventListener('blur',()=>{keys.clear();stickX=0;stickZ=0;runHeld=false;resetStick();});
const pad=$('dpad'),stick=$('stick');
let activePointer=null;
function resetStick(){stick.style.transform='translate(0px,0px)';}
pad.addEventListener('pointerdown',event=>{
  if(previewSlot)stopPreview();
  if(activePointer!==null)return;
  event.preventDefault();activePointer=event.pointerId;
  try{pad.setPointerCapture(event.pointerId);}catch{} // Fallback for Safari and synthetic pointers
  moveStick(event);
});
function moveStick(event){
  if(event.pointerId!==activePointer)return;
  const bounds=pad.getBoundingClientRect();
  const x=event.clientX-(bounds.left+bounds.width/2);
  const y=event.clientY-(bounds.top+bounds.height/2);
  const limit=41,magnitude=Math.hypot(x,y);
  const scale=magnitude>limit?limit/magnitude:1;
  const ux=x*scale,uy=y*scale;
  stickX=ux/limit;stickZ=uy/limit;
  stick.style.transform='translate('+ux+'px,'+uy+'px)';
}
pad.addEventListener('pointermove',moveStick);
const releaseStick=event=>{
  if(event.pointerId!==activePointer)return;
  activePointer=null;stickX=0;stickZ=0;resetStick();
};
pad.addEventListener('pointerup',releaseStick);pad.addEventListener('pointercancel',releaseStick);
const runButton=$('runTouch');
runButton.addEventListener('pointerdown',event=>{
  event.preventDefault();if(previewSlot)stopPreview();runHeld=true;runButton.classList.add('pressed');
  runButton.setPointerCapture(event.pointerId);
});
for(const type of ['pointerup','pointercancel'])runButton.addEventListener(type,()=>{
  runHeld=false;runButton.classList.remove('pressed');
});
function updateInput(){
  movement.set(
    Number(keys.has('d'))-Number(keys.has('a'))+stickX,
    0,
    Number(keys.has('s'))-Number(keys.has('w'))+stickZ
  );
  if(movement.lengthSq()>1)movement.normalize();
}
function simulate(dt){
  updateInput();
  if(!ready)return;
  if(previewSlot){
    if(!previewPaused)mixer.update(dt);
    $('mode').textContent='PREVIEW · '+previewNames[previewSlot];
    return;
  }
  const magnitude=movement.length();
  let desired='idle';
  if(magnitude>.12)desired=runningInput()?(runStyle==='anime'?'anime':'run'):'walk';
  // Animate the requested state if it exists. Otherwise show honest fallback:
  // Moving with no Walking FBX reuses the Running clip slowly.
  const valid=slots[desired]?.clip ? desired :
    desired==='walk'&&slots.run.clip ? 'run' :
    desired==='anime'&&slots.run.clip ? 'run' : null;
  if(valid)transition(valid);
  else if(currently!==null)transition('idle');
  const speed=runningInput()?3.7:1.65;
  const intended=movement.clone().multiplyScalar(speed);
  velocity.lerp(intended,Math.min(1,dt*9));
  actor.position.addScaledVector(velocity,dt);
  actor.position.x=THREE.MathUtils.clamp(actor.position.x,-17.5,17.5);
  actor.position.z=THREE.MathUtils.clamp(actor.position.z,-17.5,17.5);
  if(magnitude>.12){
    const nextAngle=Math.atan2(movement.x,movement.z)+rotationCorrection;
    const deltaAngle=Math.atan2(Math.sin(nextAngle-actor.rotation.y),Math.cos(nextAngle-actor.rotation.y));
    actor.rotation.y+=deltaAngle*Math.min(1,dt*11);
  }
  mixer.update(dt);
  $('mode').textContent=magnitude<=.12
    ? (slots.idle.clip?'IDLE':'IDLE · FBX belum diisi')
    : runningInput()?(desired==='anime'&&slots.anime.clip?'RUN ANIME':'RUNNING')
    : (slots.walk.clip?'WALKING':'WALKING · sementara pakai Run');
}
function resize(){
  camera.aspect=innerWidth/innerHeight;
  camera.fov=innerWidth<760?44:40;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<760?1:1.6));
  renderer.setSize(innerWidth,innerHeight);
}
window.addEventListener('resize',resize);
let lastRafAt=performance.now();
let frameCounter=0;
function drawStep(dt){
  simulate(dt);
  const eye=new THREE.Vector3(actor.position.x,3.4,actor.position.z+6.3);
  followPosition.lerp(eye,Math.min(1,dt*5));
  const target=new THREE.Vector3(actor.position.x,1.05,actor.position.z);
  lookTarget.lerp(target,Math.min(1,dt*7));
  camera.position.copy(followPosition);
  camera.lookAt(lookTarget);
  renderer.render(scene,camera);
  frameCounter++;
}
function frame(t){
  requestAnimationFrame(frame);
  const dt=Math.min(Math.max((t-lastTime)/1000,0),.055);
  lastTime=t;
  lastRafAt=performance.now();
  drawStep(dt);
}
// Some WebKit instances suspend requestAnimationFrame during FBX parsing or
// while a file chooser has focus. Run a 10fps backup only if RAF has actually
// stalled; it remains completely inactive during normal 60fps playback.
setInterval(()=>{
  if(!ready || document.visibilityState==='hidden')return;
  const now=performance.now();
  if(now-lastRafAt<240)return;
  lastRafAt=now;
  try{drawStep(.075);}
  catch(err){console.error('Movement fallback frame:',err)}
},100);
$('openUpload').addEventListener('click',()=>{
  $('uploadPanel').hidden=false;$('openUpload').setAttribute('aria-expanded','true');
});
$('closeUpload').addEventListener('click',closeUploadPanel);
$('retry').addEventListener('click',()=>location.reload());
function probePose(){
  const transforms=[];
  root?.traverse(node=>{
    if(!node.isBone)return;
    const name=normBoneName(node.name);
    if(!/(?:leftarm|rightarm|leftforearm|rightforearm|leftupleg|rightupleg|spine|hips)/.test(name))return;
    transforms.push({bone:name,quat:node.quaternion.toArray().map(x=>Number(x.toFixed(5)))});
  });
  return transforms.slice(0,15);
}
window.__movementDiagnostics=()=>({
  ready,rigNodes:baseRigByName.size,
  slots:Object.fromEntries(Object.entries(slots).map(([k,v])=>[k,{loaded:!!v.clip,coverage:v.clip?.userData?.coverage||0,tracks:v.clip?.tracks?.length||0,movingTracks:v.clip?.userData?.movingTracks ?? 0,duration:v.clip?.duration||0}])),
  state:currently,requested:state,preview:previewSlot,previewPaused,position:actor.position.toArray(),
  pose:probePose(),
  activeAction:currently&&slots[currently].clip?(()=>{
    const action=mixer?.existingAction(slots[currently].clip,root);
    return action?{isRunning:action.isRunning(),time:action.time,weight:action.getEffectiveWeight()}:null;
  })():null,
  uploadFeedback:lastAnimationInfo,
  runStyle, toon:$('toon').checked,mobile,
  facing:Math.round(rotationCorrection*180/Math.PI),joystick:[stickX,stickZ],frames:frameCounter
});
resize();requestAnimationFrame(frame);
loadBase().catch(err=>{
  console.error(err);
  window.__movementFail?.('Gagal memuat karakter utama: '+(err.message||err));
});
