const {chromium,webkit}=require('playwright');
const {PNG}=require('pngjs');
const fs=require('fs');
const type=process.env.MOVEMENT_BROWSER||'chromium';
const engine=type==='webkit'?webkit:chromium;
(async()=>{
 const browser=await engine.launch({
  headless:true,
  args:type==='chromium'?['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]
 });
 const page=await browser.newPage({
  viewport:type==='webkit'?{width:390,height:844}:{width:1280,height:800},deviceScaleFactor:1
 });
 const errors=[],shaderErrors=[],assetRequests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(/THREE\.WebGLProgram|Shader Error|ERROR:\s*0:/i.test(msg.text()))shaderErrors.push(msg.text());});
 page.on('request',req=>{if(/Running_Web_UV\.fbx|Run_Web_UV\.fbx/i.test(req.url()))assetRequests.push(req.url());});
 const diagnostics=()=>page.evaluate(()=>window.__movementDiagnostics?.());
 const delay=ms=>page.waitForTimeout(ms);
 const fixtureA=fs.readFileSync('/tmp/lembah-movement/run-tester/assets/Running_Web_UV.fbx');
 const fixtureB=fs.readFileSync('/tmp/lembah-movement/run-tester/assets/Run_Web_UV.fbx');
 async function upload(slot,name,buffer){
  await page.locator('#openUpload').click();
  const chooser=page.waitForEvent('filechooser');
  await page.locator('label[for="'+slot+'File"]').click();
  await (await chooser).setFiles({name,mimeType:'application/octet-stream',buffer});
  await page.waitForFunction(s=>window.__movementDiagnostics?.().slots[s].loaded===true,slot,{timeout:55000});
  await page.waitForFunction(s=>window.__movementDiagnostics?.().preview===s,slot,{timeout:20000});
  const d=await diagnostics();
  if(d.visibleSlot!==slot||!d.slots[slot].visible)throw Error(slot+' not visible on upload: '+JSON.stringify(d));
  if(d.slots[slot].meshCount<1||d.slots[slot].boneCount<10||d.slots[slot].movingTracks<5)
   throw Error(slot+' FBX missing original skinned model/animation: '+JSON.stringify(d));
  if(await page.locator('#uploadPanel').isVisible())throw Error('Upload panel did not close after '+slot);
  await delay(360);
  await page.screenshot({path:'/tmp/lembah-movement-'+type+'-'+slot+'.png'});
  return diagnostics();
 }
 function difference(a,b){
  const x=PNG.sync.read(a),y=PNG.sync.read(b);
  if(x.width!==y.width||x.height!==y.height)throw Error('Screenshot size mismatch');
  let changed=0,total=0;
  for(let py=Math.floor(x.height*.12);py<Math.floor(x.height*.83);py+=2)
    for(let px=Math.floor(x.width*.27);px<Math.floor(x.width*.73);px+=2){
      const i=(py*x.width+px)*4;
      const amount=Math.abs(x.data[i]-y.data[i])+
        Math.abs(x.data[i+1]-y.data[i+1])+
        Math.abs(x.data[i+2]-y.data[i+2]);
      if(amount>65)changed++;
      total++;
    }
  return changed/total;
 }
 async function down(dir){
  if(type==='webkit'){
   await page.locator('#dpad').evaluate((pad,direction)=>{
    const r=pad.getBoundingClientRect();
    const x=r.left+r.width/2,y=r.top+r.height/2;
    const e=(type,cx,cy)=>new PointerEvent(type,{bubbles:true,pointerId:234,pointerType:'touch',isPrimary:true,
      cancelable:true,clientX:cx,clientY:cy,buttons:1});
    pad.dispatchEvent(e('pointerdown',x,y));
    pad.dispatchEvent(e('pointermove',x+(direction==='d'?39:0),y-(direction==='w'?39:0)));
   },dir);
  }else await page.keyboard.down(dir);
 }
 async function up(dir){
  if(type==='webkit')await page.locator('#dpad').evaluate(el=>el.dispatchEvent(
   new PointerEvent('pointerup',{bubbles:true,pointerId:234,pointerType:'touch',isPrimary:true})));
  else await page.keyboard.up(dir);
 }
 try{
  await page.goto('http://127.0.0.1:8765/movement-tester/',{waitUntil:'domcontentloaded',timeout:55000});
  await page.waitForFunction(()=>window.__movementDiagnostics?.().ready===true,null,{timeout:45000});
  let d=await diagnostics();
  if(d.mode!=='manual-only'||d.builtInFBX!==0||d.modelCount!==0||
   Object.values(d.slots).some(s=>s.loaded))
   throw Error('Movement Tester still preloads built-in FBX: '+JSON.stringify(d));
  if(assetRequests.length)throw Error('Unexpected automatic FBX asset request: '+assetRequests.join(','));
  if(!(await page.locator('#emptyNotice').isVisible()))
   throw Error('Initial manual upload prompt missing');
  const blank=await page.locator('#stage canvas').screenshot();
  // First, upload a fully skinned FBX (in CI, existing asset is a test fixture
  // ONLY: browser MUST NOT download it automatically).
  await page.locator('#pickFirst').click();
  const idleChooser=page.waitForEvent('filechooser');
  await page.locator('label[for="idleFile"]').click();
  await (await idleChooser).setFiles({name:'Idle_manual.fbx',mimeType:'application/octet-stream',buffer:fixtureB});
  await page.waitForFunction(()=>window.__movementDiagnostics?.().slots.idle.loaded===true,null,{timeout:55000});
  await delay(500);
  d=await diagnostics();
  if(!d.slots.idle.visible||d.preview!=='idle'||d.bounds?.height<.8)
   throw Error('First manual FBX invisible or incorrectly scaled: '+JSON.stringify(d));
  const fresh=await page.locator('#stage canvas').screenshot();
  const avatarPixels=difference(blank,fresh);
  console.log('MANUAL FIRST FBX IMAGE CHANGE',type,avatarPixels.toFixed(4));
  if(avatarPixels<.007)throw Error('Uploaded first character did not visibly render in the browser: '+avatarPixels);
  await page.screenshot({path:'/tmp/lembah-movement-'+type+'-first-manual.png'});
  if(await page.locator('#emptyNotice').isVisible())throw Error('Empty notice still covers uploaded model');
  if(d.bounds.screen.some(v=>!Number.isFinite(v))||Math.abs(d.bounds.screen[0])>1.1||Math.abs(d.bounds.screen[1])>1.1)
   throw Error('First character is outside camera view: '+JSON.stringify(d.bounds));
  const firstSlot=JSON.stringify(d.slots.idle);
  await page.locator('#previewPause').click();
  if(!(await diagnostics()).previewPaused)throw Error('Preview pause not working');
  await page.locator('#previewPause').click();
  await page.locator('#previewDone').click();
  await page.locator('#openUpload').click();
  await page.locator('#cameraZoom').fill('1.5');
  await page.locator('#closeUpload').click();
  await delay(400);
  d=await diagnostics();
  if(d.cameraZoom<1.49||d.desiredDistance<4.6)
   throw Error('Camera zoom-out slider did not increase distance: '+JSON.stringify(d));
  await page.locator('#openUpload').click();
  await page.locator('#cameraZoom').fill('1');
  await page.locator('#closeUpload').click();
  // Space and JUMP work with physics before a dedicated Jump FBX exists.
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.__movementDiagnostics?.().jumpHeight>.12,null,{timeout:3000});
  let jumping=await diagnostics();
  if(!jumping.jumping||jumping.slots.jump.loaded||jumping.position[1]<.12)
   throw Error('Jump without FBX failed: '+JSON.stringify(jumping));
  if(jumping.flightSeconds<1.17||jumping.flightSeconds>1.46||
     jumping.jumpApexHeight>.7)
   throw Error('Jump physics still too fast or too tall: '+JSON.stringify(jumping));
  await page.screenshot({path:'/tmp/lembah-movement-'+type+'-jump-without-fbx.png'});
  await page.waitForFunction(()=>!window.__movementDiagnostics?.().jumping,null,{timeout:3000});
  const landed=await diagnostics();
  if(landed.jumpHeight!==0||Math.abs(landed.position[1])>.001)
   throw Error('Physical jump never landed: '+JSON.stringify(landed));
  if(type==='webkit'){
   await page.locator('#jumpTouch').click();
   await page.waitForFunction(()=>window.__movementDiagnostics?.().jumpHeight>.12,null,{timeout:3000});
   await page.waitForFunction(()=>!window.__movementDiagnostics?.().jumping,null,{timeout:3000});
  }
  // The next slot has a distinct FBX mesh/rig and must NOT modify Idle's rig.
  await upload('walk','Walking_manual.fbx',fixtureA);
  d=await diagnostics();
  if(d.modelCount!==2||d.slots.idle.visible||!d.slots.walk.visible)
   throw Error('FBX models not isolated by slot: '+JSON.stringify(d));
  if(JSON.stringify(d.slots.idle)!==firstSlot.replace('"visible":true','"visible":false'))
   throw Error('Uploading Walking mutated the original Idle slot');
  await page.locator('#previewDone').click();
  await down('w');await delay(600);
  d=await diagnostics();
  if(d.state!=='walk'||d.position[2]>-.05)
   throw Error('Walking WASD/joystick failed: '+JSON.stringify(d));
  await page.keyboard.press('r');await delay(240);
  d=await diagnostics();
  if(!d.runToggled||d.slots.run.loaded||d.modelCount!==2)
   throw Error('R toggle run changed unloaded slots: '+JSON.stringify(d));
  await page.keyboard.press('r');await delay(170);
  if((await diagnostics()).runToggled)throw Error('R did not toggle run off');
  await page.keyboard.down('Shift');await delay(250);
  d=await diagnostics();
  if(d.slots.run.loaded||d.modelCount!==2)throw Error('Shift magically loaded Running');
  await page.keyboard.up('Shift');await up('w');
  await upload('run','Running_manual.fbx',fixtureA);
  await page.locator('#previewDone').click();
  await down('w');await page.keyboard.press('r');await delay(420);
  d=await diagnostics();
  if(d.state!=='run'||d.visibleSlot!=='run'||!d.runToggled)
   throw Error('Alternate R key did not activate Running: '+JSON.stringify(d));
  await page.keyboard.press('r');
  await page.keyboard.down('Shift');await delay(300);
  d=await diagnostics();
  if(d.state!=='run'||d.visibleSlot!=='run'||d.runToggled)
   throw Error('Original Shift run control regressed: '+JSON.stringify(d));
  await page.keyboard.up('Shift');await up('w');
  await upload('anime','Anime_manual.fbx',fixtureB);
  await page.locator('#previewDone').click();
  await page.locator('#openUpload').click();await page.locator('[data-run="anime"]').click();
  await page.locator('#closeUpload').click();
  await down('w');await page.keyboard.down('Shift');await delay(420);
  d=await diagnostics();
  if(d.state!=='anime'||d.modelCount!==4||!['idle','walk','run','anime'].every(k=>d.slots[k].loaded&&d.slots[k].nativeRig))
   throw Error('Fourth manual slot failed: '+JSON.stringify(d));
  await page.keyboard.up('Shift');await up('w');
  await upload('jump','Jump_manual.fbx',fixtureB);
  d=await diagnostics();
  if(d.modelCount!==5||!d.slots.jump.nativeRig||d.slots.jump.duration<.01)
   throw Error('Manual jump FBX missing its native rig: '+JSON.stringify(d));
  // Both source assets are the same character. They must normalize from the
  // SAME bind pose to the SAME height, not from crouched animation frames.
  const sizes=d.avatarHeights;
  if(!sizes.idle||!sizes.jump || Math.abs(sizes.idle.normalized-2.08)>.07 ||
     Math.abs(sizes.jump.normalized-2.08)>.07 ||
     Math.abs(sizes.idle.normalized-sizes.jump.normalized)>.07)
   throw Error('Jump avatar changed body size compared to Idle: '+JSON.stringify(sizes));
  console.log('FBX AVATAR BIND POSE HEIGHT MATCH',type,JSON.stringify({idle:sizes.idle.normalized,jump:sizes.jump.normalized}));
  await page.locator('#previewDone').click();
  await page.locator('#jumpTouch').click();
  await page.waitForFunction(()=>window.__movementDiagnostics?.().jumpHeight>.10,null,{timeout:3000});
  d=await diagnostics();
  if(!d.jumping||d.visibleSlot!=='jump'||d.state!=='jump'||!d.slots.jump.visible)
   throw Error('Uploaded Jump FBX is not displayed during jump: '+JSON.stringify(d));
  if(d.flightSeconds<1.17||d.flightSeconds>1.46)
   throw Error('Jump FBX playback did not preserve slow physical timing: '+JSON.stringify(d));
  await delay(250);
  d=await diagnostics();
  if(!d.bounds||!Number.isFinite(d.bounds.screenHeight)||
     d.bounds.screenHeight<.14||d.bounds.screenHeight>1.50)
   throw Error('Jump avatar too tiny or clipped in camera: '+JSON.stringify(d.bounds));
  console.log('JUMP CAMERA SCREEN HEIGHT',type,d.bounds.screenHeight.toFixed(3));
  if(!d.framingBounds||!Number.isFinite(d.desiredDistance))
   throw Error('Automatic Jump camera framing not active: '+JSON.stringify(d));
  if(!d.bounds||d.bounds.screen.some(x=>!Number.isFinite(x))||
     Math.abs(d.bounds.screen[0])>.8||Math.abs(d.bounds.screen[1])>.85)
   throw Error('Jump character drifting outside camera: '+JSON.stringify(d.bounds));
  await page.screenshot({path:'/tmp/lembah-movement-'+type+'-jump-with-fbx.png'});
  await page.waitForFunction(()=>!window.__movementDiagnostics?.().jumping,null,{timeout:3000});
  d=await diagnostics();
  if(d.visibleSlot==='jump'||d.jumpHeight!==0)
   throw Error('Landed Jump FBX stuck instead of returning to Idle: '+JSON.stringify(d));
  await page.locator('#resetCharacter').click();
  d=await diagnostics();
  if(d.position.some(x=>Math.abs(x)>1e-5)||d.jumping||d.runToggled)
   throw Error('Reset character did not restore movement state');
  if(assetRequests.length)throw Error('FBXs should only be loaded from file inputs, not network: '+assetRequests.join(','));
  if(errors.length||shaderErrors.length)throw Error('Browser errors: '+errors.join(' | ')+'; '+shaderErrors.join(' | '));
  console.log('MANUAL FBX MOVEMENT + JUMP PASS',type,JSON.stringify({count:d.modelCount,mode:d.mode,visible:d.visibleSlot,
    jumpCount:d.jumpCount,avatarPixels:avatarPixels.toFixed(3),nativeRigs:Object.values(d.slots).every(x=>x.nativeRig)}));
 }catch(err){
  console.error('MANUAL FBX MOVEMENT FAIL',type,err.message);
  console.error('PAGE ERRORS',errors.join(' | '));
  console.error('CURRENT STATUS',await page.locator('#status').innerText().catch(()=>'(none)'));
  await page.screenshot({path:'/tmp/lembah-movement-'+type+'-failure.png'}).catch(()=>{});
  process.exitCode=1;
 }finally{await browser.close()}
})().catch(err=>{console.error('MOVEMENT TEST CRASH:',err);process.exitCode=1});