import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Movement Tester v3 — MANUAL ONLY. Each uploaded FBX retains its OWN mesh,
// skeleton, rest pose and animation. No built-in FBX, no bone retargeting.
const $=id=>document.getElementById(id);
const mobile=matchMedia('(max-width:760px), (pointer:coarse)').matches;
const renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:'default'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1:1.6));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NeutralToneMapping;
$('stage').appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#d9eae7');
const camera=new THREE.PerspectiveCamera(mobile?44:40,innerWidth/innerHeight,.08,120);
const followPosition=new THREE.Vector3(0,3.4,6.3);
const lookTarget=new THREE.Vector3(0,1,0);
const ambient=new THREE.HemisphereLight(0xfff8ed,0x7c9d89,1.15);
const sun=new THREE.DirectionalLight(0xffefdc,1.6);
sun.position.set(-3,6,5);scene.add(ambient,sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),
  new THREE.MeshStandardMaterial({color:0x8aaf90,roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.025;scene.add(ground);
const grid=new THREE.GridHelper(40,40,0x68947b,0x86aa93);
grid.position.y=-.018;grid.material.transparent=true;grid.material.opacity=.23;scene.add(grid);
for(let x=-8;x<=8;x+=4)for(let z=-8;z<=8;z+=4){
 const marker=new THREE.Mesh(new THREE.CircleGeometry(.055,16),
  new THREE.MeshBasicMaterial({color:0xd6ebbf,transparent:true,opacity:.7,depthWrite:false}));
 marker.rotation.x=-Math.PI/2;marker.position.set(x,.001,z);scene.add(marker);
}
const atlas=new THREE.TextureLoader().load('../run-tester/assets/basecolor.webp');
atlas.colorSpace=THREE.SRGBColorSpace;
const loader=new FBXLoader();
const actor=new THREE.Group();scene.add(actor);
const slots={
 idle:{label:'Idle',asset:null},
 walk:{label:'Walking',asset:null},
 run:{label:'Running',asset:null},
 anime:{label:'Run Anime',asset:null},
 jump:{label:'Jump',asset:null}
};
const keys=new Set();
const velocity=new THREE.Vector3(),movement=new THREE.Vector3();
let ready=false,loadingSlot=null,currentSlot=null,previewSlot=null,previewPaused=false;
let runStyle='run',rotationCorrection=0,runHeld=false,runToggled=false,stickX=0,stickZ=0;
// Simple avatar capsule jump; independent of the FBX skeleton and rig.
const jumpImpulse=5.65,jumpGravity=16.0;
let verticalSpeed=0,jumpHeight=0,jumping=false,jumpCount=0;
let lastTime=performance.now(),lastRafAt=performance.now(),frameCounter=0;
let lastAnimationInfo='',visibleSlot=null,pausedRest=false;
function setStatus(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function hasAssets(){return Object.values(slots).some(x=>!!x.asset);}
function setEmptyNotice(){
 $('emptyNotice').hidden=hasAssets();
 $('hint').textContent=hasAssets()?'WASD · Shift/R lari · Space Jump':'Upload FBX untuk mulai tes game';
}
function closeUploadPanel(){$('uploadPanel').hidden=true;$('openUpload').setAttribute('aria-expanded','false');}
function resetStick(){$('stick').style.transform='translate(0px,0px)';}
function setSlotLabel(slot,text){$(slot+'Name').textContent=text;}
function normalizeKey(s){
 const k=String(s).toLowerCase();
 return {arrowup:'w',arrowdown:'s',arrowleft:'a',arrowright:'d'}[k]||k;
}
function stopAllMovement(){
 keys.clear();runHeld=false;stickX=0;stickZ=0;
 velocity.set(0,0,0);movement.set(0,0,0);resetStick();
}
function resetCharacterPosition(){
 stopAllMovement();
 actor.position.set(0,0,0);actor.rotation.y=rotationCorrection;
 verticalSpeed=0;jumpHeight=0;jumping=false;runToggled=false;
 $('runToggle').classList.remove('active');$('runToggle').setAttribute('aria-pressed','false');
 followPosition.set(0,3.4,6.3);lookTarget.set(0,1,0);
 if(previewSlot)stopPreview();
 setStatus(hasAssets()?'Karakter kembali ke pusat':'Belum ada FBX · pilih ＋ Animasi');
}
function getMeshBounds(model){
 model.updateMatrixWorld(true);
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  mesh.skeleton?.update();
  if(typeof mesh.computeBoundingBox==='function')mesh.computeBoundingBox();
 });
 return new THREE.Box3().setFromObject(model);
}
function motionTrackCount(clip){
 let count=0;
 for(const track of clip.tracks){
  if(track.times.length<2)continue;
  const size=track.getValueSize();
  if(!size)continue;
  let moving=false;
  for(let i=1;i<track.times.length && !moving;i++)
   for(let j=0;j<size;j++)
    if(Math.abs(track.values[size*i+j]-track.values[j])>.004){moving=true;break;}
  if(moving)count++;
 }
 return count;
}
function makeInPlace(clip){
 // Retain the original FBX's binding and bone structure; only freeze
 // horizontal Hips/root motion to let WASD control the actor.
 const original=clip.clone();
 let frozen=0;
 for(const track of original.tracks){
  if(!/\.position$/.test(track.name)||!/(hips|pelvis|root)/i.test(track.name))continue;
  if(track.getValueSize()!==3)continue;
  const x=track.values[0],z=track.values[2];
  for(let k=0;k<track.values.length;k+=3){
   track.values[k]=x;track.values[k+2]=z;
  }
  frozen++;
 }
 original.name='manual_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
 return {clip:original,frozen};
}
function makeMaterial(original,geometry,toon=false){
 const hasUV=!!geometry.getAttribute('uv');
 const src=Array.isArray(original)?original[0]:original;
 const srcMap=src?.map||null;
 const map=srcMap||(hasUV?atlas:null);
 const color=srcMap||map?0xffffff:(src?.color?.getHex()??0xffffff);
 const opts={
  map,color,side:THREE.DoubleSide,
  transparent:!!src?.transparent,opacity:src?.opacity??1,
  alphaTest:src?.alphaTest||0
 };
 if(toon)return new THREE.MeshToonMaterial({...opts,normalMap:null});
 return new THREE.MeshBasicMaterial(opts);
}
function updateVisualMaterial(asset){
 asset.model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const choice=$('toon').checked?'toon':'flat';
  if(!mesh.userData.movementMaterials){
   mesh.userData.movementMaterials={
    flat:makeMaterial(mesh.material,mesh.geometry,false),
    toon:makeMaterial(mesh.material,mesh.geometry,true)
   };
  }
  mesh.material=mesh.userData.movementMaterials[choice];
 });
}
function removeAsset(old){
 if(!old)return;
 old.action.stop();
 old.mixer.stopAllAction();
 actor.remove(old.group);
 old.model.traverse(o=>{
  if(o.userData.movementMaterials)for(const m of Object.values(o.userData.movementMaterials))m.dispose();
  if(o.geometry?.dispose)o.geometry.dispose();
 });
}
function makeSlotAsset(file,model,slot){
 const meshes=[];model.traverse(x=>{if(x.isMesh)meshes.push(x)});
 if(!meshes.length)throw Error('FBX hanya berisi animasi/rig. Pilih FBX WITH SKIN yang menyertakan mesh karakter dan animasi.');
 const source=model.animations?.find(a=>a.tracks?.length && a.duration>0);
 if(!source)throw Error('FBX menyertakan model, tetapi tidak memiliki keyframe animasi.');
 const {clip,frozen}=makeInPlace(source);
 const mixer=new THREE.AnimationMixer(model);
 const action=mixer.clipAction(clip);
 if(slot==='jump'){
  action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;
 }else action.setLoop(THREE.LoopRepeat,Infinity);
 action.play();mixer.setTime(0);
 // Normalize EACH original skinned model separately. Never apply rotations
 // from another FBX's incompatible rest pose to this mesh.
 const initial=getMeshBounds(model);
 const height=initial.max.y-initial.min.y;
 if(!Number.isFinite(height)||height<.001)throw Error('Ukuran mesh FBX tidak valid.');
 model.scale.multiplyScalar(2.08/height);
 model.updateMatrixWorld(true);
 const transformed=getMeshBounds(model);
 const anchor=new THREE.Group();
 anchor.position.set(
  -(transformed.min.x+transformed.max.x)*.5,
  -transformed.min.y,
  -(transformed.min.z+transformed.max.z)*.5
 );
 const group=new THREE.Group();group.add(anchor);anchor.add(model);
 group.visible=false;
 updateVisualMaterial({model});
 return {file:file.name,slot,model,group,mixer,action,clip,
  duration:clip.duration,meshCount:meshes.length,movingTracks:motionTrackCount(clip),
  frozenMotion:frozen,boneCount:(()=>{let n=0;model.traverse(x=>{if(x.isBone)n++});return n})(),
  normalizedHeight:transformed.max.y-transformed.min.y};
}
function syncPreviewButtons(){
 for(const btn of document.querySelectorAll('[data-preview]')){
  const name=btn.dataset.preview;
  btn.disabled=!slots[name].asset;
  btn.classList.toggle('active',previewSlot===name);
 }
}
function showAsset(slot){
 if(!slot || !slots[slot]?.asset)return false;
 const next=slots[slot].asset;
 if(visibleSlot!==slot){
  // Independent skeletons: cross-fade is intentionally OFF. Cross-fading
  // incompatible FBXs on one skeleton destroyed the original character.
  for(const [name,entry] of Object.entries(slots)){
   if(!entry.asset)continue;
   entry.asset.group.visible=(name===slot);
   if(name!==slot)entry.asset.mixer.stopAllAction();
  }
  next.action.reset().setEffectiveWeight(1).play();
  next.mixer.setTime(0);
  if(slot==='jump') next.action.setEffectiveTimeScale(next.duration/(2*jumpImpulse/jumpGravity));
  visibleSlot=slot;
 }
 pausedRest=false;
 currentSlot=slot;
 return true;
}
function freezeCurrentPose(){
 if(currentSlot && slots[currentSlot]?.asset){
  pausedRest=true;
  slots[currentSlot].asset.action.paused=true;
 }
}
function isRunningInput(){return runHeld||runToggled||keys.has('shift');}
function setRunToggle(next){
 runToggled=!!next;
 $('runToggle').classList.toggle('active',runToggled);
 $('runToggle').setAttribute('aria-pressed',String(runToggled));
 $('runToggle').textContent=runToggled?'R · Lari ON':'R · Lari Toggle';
}
function beginJump(){
 if(!hasAssets()||jumping)return false;
 // An upload preview takes precedence until the user explicitly jumps.
 if(previewSlot)stopPreview();
 jumping=true;verticalSpeed=jumpImpulse;jumpCount++;
 if(slots.jump.asset)showAsset('jump');
 else if(visibleSlot)freezeCurrentPose();
 setStatus(slots.jump.asset?'Jump · animasi FBX diputar':'Jump fisik · upload FBX Jump untuk animasi khusus');
 return true;
}
function selectState(requested){
 let chosen=requested;
 if(!slots[chosen]?.asset){
  if(chosen==='anime'&&slots.run.asset)chosen='run';
  else if(chosen==='run'&&slots.anime.asset)chosen='anime';
  else if(chosen==='walk'&&slots.run.asset)chosen='run';
  else if(chosen==='walk'&&slots.anime.asset)chosen='anime';
  else if(chosen==='run'&&slots.walk.asset)chosen='walk';
  else if(chosen==='anime'&&slots.walk.asset)chosen='walk';
  else chosen=null;
 }
 if(!chosen){
  // Missing Idle must not make the uploaded character disappear.
  if(requested==='idle')freezeCurrentPose();
  return null;
 }
 showAsset(chosen);
 slots[chosen].asset.action.paused=false;
 return chosen;
}
function stopPreview(){
 previewSlot=null;previewPaused=false;
 $('previewBar').hidden=true;
 $('previewPause').textContent='⏸ Pause';
 syncPreviewButtons();
 const next=selectState('idle');
 if(!next)freezeCurrentPose();
 updateModeLabel();
}
function startPreview(slot){
 if(!slots[slot]?.asset)return;
 stopAllMovement();
 actor.position.set(0,0,0);actor.rotation.y=rotationCorrection;
 previewSlot=slot;previewPaused=false;
 $('previewBar').hidden=false;
 $('previewLabel').textContent='▶ '+slots[slot].label+' · '+slots[slot].asset.duration.toFixed(2)+' dtk';
 $('previewHint').textContent='FBX dimainkan dengan mesh dan skeleton aslinya, bukan retarget ke rig lain.';
 $('previewPause').textContent='⏸ Pause';
 showAsset(slot);
 const a=slots[slot].asset;
 a.mixer.setTime(0);a.action.paused=false;
 syncPreviewButtons();
 closeUploadPanel();
}
async function assignFile(slot,file){
 if(loadingSlot)throw Error('Sedang membaca '+slots[loadingSlot].label+'.');
 if(!/\.fbx$/i.test(file.name))throw Error('Pilih file dengan ekstensi .fbx.');
 loadingSlot=slot;
 setStatus('Mengimpor '+file.name+' ke '+slots[slot].label+'...');
 let newAsset;
 try{
  const buffer=await file.arrayBuffer();
  const model=loader.parse(buffer,'');
  newAsset=makeSlotAsset(file,model,slot);
  const previous=slots[slot].asset;
  if(previous){removeAsset(previous);if(visibleSlot===slot)visibleSlot=null;}
  actor.add(newAsset.group);
  slots[slot].asset=newAsset;
  setSlotLabel(slot,file.name+' · '+newAsset.duration.toFixed(2)+' dtk');
  syncPreviewButtons();setEmptyNotice();
  lastAnimationInfo=slots[slot].label+' dari '+file.name+': '+newAsset.meshCount+
   ' mesh, '+newAsset.boneCount+' tulang, '+newAsset.movingTracks+
   ' track bergerak. Skeleton file asli dipertahankan.';
  $('uploadResult').textContent=lastAnimationInfo;
  setStatus('Berhasil: '+file.name+'. '+newAsset.movingTracks+' track animasi bergerak.',newAsset.movingTracks===0);
  startPreview(slot);
 }finally{loadingSlot=null;}
}
for(const input of document.querySelectorAll('input[data-slot]')){
 input.addEventListener('change',async()=>{
  const file=input.files?.[0];input.value='';
  if(!file)return;
  try{await assignFile(input.dataset.slot,file)}
  catch(e){
   console.error('FBX import failed',e);
   const msg='Gagal memuat '+file.name+': '+(e.message||e);
   $('uploadResult').textContent=msg;setStatus(msg,true);
  }
 });
}
for(const btn of document.querySelectorAll('[data-preview]')){
 btn.addEventListener('click',()=>startPreview(btn.dataset.preview));
}
for(const btn of document.querySelectorAll('[data-run]')){
 btn.addEventListener('click',()=>{
  runStyle=btn.dataset.run;
  for(const b of document.querySelectorAll('[data-run]'))
   b.classList.toggle('active',b.dataset.run===runStyle);
  setStatus('Mode lari: '+(runStyle==='anime'?'Run Anime':'Running')+
   (slots[runStyle].asset?' siap':' belum di-upload'));
 });
}
$('toon').addEventListener('change',()=>{
 for(const entry of Object.values(slots))
  if(entry.asset)updateVisualMaterial(entry.asset);
});
$('face').addEventListener('input',()=>{
 rotationCorrection=Number($('face').value)*Math.PI/180;
 $('faceText').textContent=$('face').value+'°';
});
$('pickFirst').addEventListener('click',()=>{$('openUpload').click()});
$('openUpload').addEventListener('click',()=>{
 $('uploadPanel').hidden=false;$('openUpload').setAttribute('aria-expanded','true');
});
$('closeUpload').addEventListener('click',closeUploadPanel);
$('previewDone').addEventListener('click',stopPreview);
$('previewPause').addEventListener('click',()=>{
 if(!previewSlot)return;
 previewPaused=!previewPaused;
 $('previewPause').textContent=previewPaused?'▶ Lanjut':'⏸ Pause';
});
$('retry').addEventListener('click',()=>location.reload());
$('resetCharacter').addEventListener('click',resetCharacterPosition);
$('runToggle').addEventListener('click',()=>setRunToggle(!runToggled));
$('jumpTouch').addEventListener('click',beginJump);
function updateModeLabel(){
 const requested=jumping?'jump':movement.lengthSq()>.012?(isRunningInput()?'run':'walk'):'idle';
 const state=previewSlot?('PREVIEW '+slots[previewSlot].label.toUpperCase()):currentSlot?slots[currentSlot].label.toUpperCase():'BELUM ADA MODEL';
 $('mode').textContent=state+(pausedRest?' · pose terakhir':'');
}
document.addEventListener('keydown',event=>{
 if(event.target.closest('input[type="text"],input[type="number"],textarea,select'))return;
 const key=normalizeKey(event.key);
 if(key===' '||key==='space'||key==='spacebar'){
  event.preventDefault();
  if(!event.repeat)beginJump();
  return;
 }
 if(key==='r'){
  event.preventDefault();
  if(!event.repeat)setRunToggle(!runToggled);
  return;
 }
 if(['w','a','s','d','shift'].includes(key)){
  event.preventDefault();
  if(previewSlot)stopPreview();
  keys.add(key);
 }
});
document.addEventListener('keyup',event=>{
 const k=normalizeKey(event.key);
 if(['w','a','s','d','shift'].includes(k)){event.preventDefault();keys.delete(k);}
});
window.addEventListener('blur',()=>{stopAllMovement();});
const pad=$('dpad'),stick=$('stick');let activePointer=null;
pad.addEventListener('pointerdown',event=>{
 if(previewSlot)stopPreview();
 if(activePointer!==null)return;
 event.preventDefault();activePointer=event.pointerId;
 try{pad.setPointerCapture(event.pointerId)}catch{}
 moveStick(event);
});
function moveStick(event){
 if(event.pointerId!==activePointer)return;
 const r=pad.getBoundingClientRect();
 const x=event.clientX-r.left-r.width/2,y=event.clientY-r.top-r.height/2;
 const length=Math.hypot(x,y),scale=length>41?41/length:1;
 const dx=x*scale,dy=y*scale;
 stickX=dx/41;stickZ=dy/41;
 stick.style.transform='translate('+dx+'px,'+dy+'px)';
}
pad.addEventListener('pointermove',moveStick);
const releaseStick=event=>{
 if(event.pointerId!==activePointer)return;
 activePointer=null;stickX=0;stickZ=0;resetStick();
};
pad.addEventListener('pointerup',releaseStick);pad.addEventListener('pointercancel',releaseStick);
const runTouch=$('runTouch');
runTouch.addEventListener('pointerdown',e=>{
 e.preventDefault();if(previewSlot)stopPreview();
 runHeld=true;runTouch.classList.add('pressed');
 try{runTouch.setPointerCapture(e.pointerId)}catch{}
});
for(const event of ['pointerup','pointercancel'])runTouch.addEventListener(event,()=>{
 runHeld=false;runTouch.classList.remove('pressed');
});
function updateInput(){
 movement.set(Number(keys.has('d'))-Number(keys.has('a'))+stickX,0,
  Number(keys.has('s'))-Number(keys.has('w'))+stickZ);
 if(movement.lengthSq()>1)movement.normalize();
}
function simulate(dt){
 updateInput();
 if(!previewSlot){
  const amount=movement.length();
  const running=isRunningInput();
  const desired=jumping?'jump':amount>.12?(running?(runStyle==='anime'?'anime':'run'):'walk'):'idle';
  // While airborne, do not switch out of the original Jump animation.
  // With no Jump FBX, simply retain the previously visible original rig.
  if(!jumping)selectState(desired);
  if(amount>.12&&hasAssets()){
   const intended=movement.clone().multiplyScalar(running?3.65:1.65);
   velocity.lerp(intended,Math.min(1,dt*8));
   actor.position.addScaledVector(velocity,dt);
   actor.position.x=THREE.MathUtils.clamp(actor.position.x,-17.5,17.5);
   actor.position.z=THREE.MathUtils.clamp(actor.position.z,-17.5,17.5);
   const target=Math.atan2(movement.x,movement.z)+rotationCorrection;
   const difference=Math.atan2(Math.sin(target-actor.rotation.y),Math.cos(target-actor.rotation.y));
   actor.rotation.y+=difference*Math.min(1,dt*11);
  }else velocity.multiplyScalar(Math.max(0,1-dt*14));
 }else if(!previewPaused){
  const asset=slots[previewSlot]?.asset;
  if(asset)asset.action.paused=false;
 }
 if(jumping){
  verticalSpeed-=jumpGravity*dt;
  jumpHeight=Math.max(0,jumpHeight+verticalSpeed*dt);
  if(jumpHeight===0){
   jumping=false;verticalSpeed=0;
   pausedRest=false;
   // Return to the appropriate uploaded locomotion FBX on landing.
   const moving=movement.length()>.12;
   selectState(moving?(isRunningInput()?(runStyle==='anime'?'anime':'run'):'walk'):'idle');
  }
 }
 actor.position.y=jumpHeight;
 for(const [key,slot] of Object.entries(slots)){
  if(!slot.asset||key!==visibleSlot)continue;
  if(previewPaused||pausedRest)continue;
  slot.asset.mixer.update(dt);
 }
 $('mode').textContent=previewSlot?
  'PREVIEW · '+slots[previewSlot].label.toUpperCase() :
  jumping?('JUMP'+(slots.jump.asset?' · FBX':' · fisik')):
  currentSlot?(slots[currentSlot].label.toUpperCase()+(pausedRest?' · tunggu Idle':'')):
  'BELUM ADA FBX';
}
function resize(){
 camera.aspect=innerWidth/innerHeight;
 camera.fov=innerWidth<760?44:40;camera.updateProjectionMatrix();
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<760?1:1.6));
 renderer.setSize(innerWidth,innerHeight);
}
addEventListener('resize',resize);
let frameCount=0;
function renderStep(dt){
 simulate(dt);
 const eye=new THREE.Vector3(actor.position.x,3.4,actor.position.z+6.3);
 followPosition.lerp(eye,Math.min(1,dt*5));
 lookTarget.lerp(new THREE.Vector3(actor.position.x,1.05,actor.position.z),Math.min(1,dt*7));
 camera.position.copy(followPosition);camera.lookAt(lookTarget);
 renderer.render(scene,camera);frameCount++;
}
function frame(t){
 requestAnimationFrame(frame);
 const dt=Math.min(Math.max((t-lastTime)/1000,0),.055);
 lastTime=t;lastRafAt=performance.now();renderStep(dt);
}
setInterval(()=>{
 if(!ready||document.visibilityState==='hidden')return;
 const now=performance.now();
 if(now-lastRafAt<240)return;
 lastRafAt=now;
 renderStep(.075);
},100);
function visibleBounds(){
 const entry=visibleSlot?slots[visibleSlot]?.asset:null;
 if(!entry)return null;
 const box=getMeshBounds(entry.model);
 const anchor=entry.group.children[0];
 const worldBox=new THREE.Box3().setFromObject(entry.group);
 const center=worldBox.getCenter(new THREE.Vector3());
 const clip=center.clone().project(camera);
 return {
  height:worldBox.max.y-worldBox.min.y,
  center:[center.x,center.y,center.z],
  screen:[clip.x,clip.y,clip.z],
  min:[worldBox.min.x,worldBox.min.y,worldBox.min.z],
  max:[worldBox.max.x,worldBox.max.y,worldBox.max.z],
  anchorY:anchor.position.y,
  localHeight:box.max.y-box.min.y
 };
}
window.__movementDiagnostics=()=>({
 ready,mode:'manual-only',builtInFBX:0,
 modelCount:Object.values(slots).filter(x=>!!x.asset).length,
 slots:Object.fromEntries(Object.entries(slots).map(([k,v])=>[k,{
  loaded:!!v.asset,file:v.asset?.file||null,
  meshCount:v.asset?.meshCount||0,
  boneCount:v.asset?.boneCount||0,
  movingTracks:v.asset?.movingTracks||0,
  duration:v.asset?.duration||0,
  visible:!!v.asset?.group.visible,
  nativeRig:!!v.asset
 }])),
 visibleSlot,currentSlot,preview:previewSlot,previewPaused,
 position:actor.position.toArray(),state:currentSlot,
 activeAction:visibleSlot&&slots[visibleSlot].asset?{
  isRunning:slots[visibleSlot].asset.action.isRunning(),
  time:slots[visibleSlot].asset.action.time
 }:null,
 bounds:visibleBounds(),uploadFeedback:lastAnimationInfo,
 frames:frameCount,runStyle,runToggled,jumping,jumpHeight,jumpCount,verticalSpeed,
 mobile,joystick:[stickX,stickZ]
});
resize();requestAnimationFrame(frame);
ready=true;window.__movementReady=true;
setEmptyNotice();
syncPreviewButtons();
setStatus('Mode manual siap · upload FBX karakter + animasi lewat ＋ Animasi.');
$('mode').textContent='BELUM ADA FBX';
