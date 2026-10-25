const {chromium,webkit}=require('playwright');
const fs=require('fs');
const type=process.env.MOVEMENT_BROWSER||'chromium';
const engine=type==='webkit'?webkit:chromium;
(async()=>{
 const browser=await engine.launch({headless:true,args:type==='chromium'?['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
 const page=await browser.newPage({viewport:type==='webkit'?{width:390,height:844}:{width:1280,height:800},deviceScaleFactor:1});
 const errors=[],shaderErrors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(/THREE\.WebGLProgram|Shader Error|ERROR:\s*0:/i.test(msg.text()))shaderErrors.push(msg.text());});
 try{
  await page.goto('http://127.0.0.1:8765/movement-tester/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__movementDiagnostics?.().ready===true,null,{timeout:100000});
  let d=await page.evaluate(()=>window.__movementDiagnostics());
  if(!d.slots.run.loaded || d.rigNodes<10)throw Error('Base FBX did not bind: '+JSON.stringify(d));
  if(d.slots.idle.loaded || d.slots.walk.loaded)throw Error('Idle/Walking should await uploads, not invented');
  if(errors.length)throw Error('Startup error: '+errors.join(' | '));
  await page.screenshot({path:'/tmp/lembah-movement-'+type+'-idle.png'});
  // WebKit mobile uses the on-screen joystick, not a physical keyboard.
  let joystickCenter=null;
  async function beginDirection(direction){
    if(type==='webkit'){
      const box=await page.locator('#dpad').boundingBox();
      if(!box)throw Error('Mobile joystick not visible');
      joystickCenter={x:box.x+box.width/2,y:box.y+box.height/2};
      await page.locator('#dpad').evaluate((pad,dir)=>{
        const bounds=pad.getBoundingClientRect();
        const cx=bounds.left+bounds.width/2,cy=bounds.top+bounds.height/2;
        const create=(type,x,y)=>new PointerEvent(type,{
          bubbles:true,cancelable:true,isPrimary:true,pointerId:234,
          pointerType:'touch',clientX:x,clientY:y,buttons:1
        });
        pad.dispatchEvent(create('pointerdown',cx,cy));
        pad.dispatchEvent(create('pointermove',cx+(dir==='d'?39:0),cy-(dir==='w'?39:0)));
      },direction);
      const v=await page.evaluate(()=>window.__movementDiagnostics().joystick);
      if(Math.hypot(...v)<.5)throw Error('Touch joystick input not received: '+JSON.stringify(v));
    }else await page.keyboard.down(direction);
  }
  async function endDirection(direction){
    if(type==='webkit'){
      await page.locator('#dpad').evaluate(pad=>{
        pad.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,isPrimary:true,pointerId:234,pointerType:'touch'}));
      });
    }else await page.keyboard.up(direction);
  }
  await beginDirection('w');
  await page.waitForTimeout(650);
  d=await page.evaluate(()=>window.__movementDiagnostics());
  if(d.position[2]>-.06)throw Error('W movement failed: '+JSON.stringify(d));
  await page.keyboard.down('Shift');
  await page.waitForTimeout(650);
  d=await page.evaluate(()=>window.__movementDiagnostics());
  if(d.state!=='run')throw Error('Shift+W did not use Running: '+JSON.stringify(d));
  await page.keyboard.up('Shift');
  await endDirection('w');
  const prev=d.position[2];
  await page.locator('#openUpload').click();
  if(!(await page.locator('#uploadPanel').isVisible()))throw Error('Upload menu did not open');
  const file=fs.readFileSync('/tmp/lembah-movement/run-tester/assets/Run_Web_UV.fbx');
  const walkingChooser=page.waitForEvent('filechooser');
  await page.locator('label[for="walkFile"]').click();
  await (await walkingChooser).setFiles({name:'Walking_Compatible.fbx',mimeType:'application/octet-stream',buffer:file});
  await page.waitForFunction(()=>window.__movementDiagnostics?.().slots.walk.loaded===true,null,{timeout:60000});
  d=await page.evaluate(()=>window.__movementDiagnostics());
  if(d.slots.walk.tracks>53)throw Error('Unexpected excess FBX tracks');
  if(!Number.isFinite(d.modelScale)||d.modelScale<=0)throw Error('Bad base avatar normalization');
  // The source FBX may have been authored at a different world origin.
  // Never apply its absolute Hips.position or the visible avatar will vanish.
  const hipsDelta=d.hipsPosition&&d.restHipsPosition?Math.hypot(...d.hipsPosition.map((v,i)=>v-d.restHipsPosition[i]))*d.modelScale:0;
  if(hipsDelta>.22)throw Error('Imported FBX moved avatar hips away from base rig: '+hipsDelta);

  if(d.slots.walk.coverage<.55 || d.slots.walk.movingTracks<5)throw Error('Uploaded Walking has no animated bone motion: '+JSON.stringify(d));
  if(d.preview!=='walk' || d.activeAction?.isRunning!==true)throw Error('Uploaded Walking was not previewed on the actor: '+JSON.stringify(d));
  if(await page.locator('#uploadPanel').isVisible())throw Error('Upload drawer hides character after Walking import');
  await page.waitForTimeout(240);
  d=await page.evaluate(()=>window.__movementDiagnostics());
  if(d.activeAction?.weight<.5 || d.activeAction?.time===0)throw Error('Uploaded Walking preview is not actually playing: '+JSON.stringify(d));
  const initialPose=d.pose;
  await page.waitForTimeout(155);
  const changedPose=(await page.evaluate(()=>window.__movementDiagnostics())).pose;
  let poseShift=0;
  for(let i=0;i<Math.min(initialPose.length,changedPose.length);i++)for(let j=0;j<4;j++)
    poseShift+=Math.abs(initialPose[i].quat[j]-changedPose[i].quat[j]);
  if(initialPose.length<3 || poseShift<0.03) throw Error('Walking clip is playing but bones do not move: '+JSON.stringify({poseShift,initialPose,changedPose}));
  console.log('VISIBLE RETARGETED FBX POSE MOTION',type,poseShift.toFixed(3));
  await page.screenshot({path:'/tmp/lembah-movement-'+type+'-walking-preview.png'});
  await page.locator('#previewDone').click();
  await page.waitForTimeout(150);
  const returned=await page.evaluate(()=>window.__movementDiagnostics());
  const dist=returned.hipsPosition&&returned.restHipsPosition?Math.hypot(...returned.hipsPosition.map((v,i)=>v-returned.restHipsPosition[i])):0;
  if(dist>0.001)throw Error('Character did not return to bind pose when Idle missing: '+dist);
  await beginDirection('d');await page.waitForTimeout(500);
  d=await page.evaluate(()=>window.__movementDiagnostics());
  if(d.state!=='walk')throw Error('Walking clip not being played: '+JSON.stringify(d));
  await endDirection('d');
  await page.locator('#openUpload').click();
  const idleChooser=page.waitForEvent('filechooser');
  await page.locator('label[for="idleFile"]').click();
  await (await idleChooser).setFiles({name:'Idle_Compatible.fbx',mimeType:'application/octet-stream',buffer:file});
  await page.waitForFunction(()=>window.__movementDiagnostics?.().slots.idle.loaded===true,null,{timeout:60000});
  await page.waitForTimeout(450);
  d=await page.evaluate(()=>window.__movementDiagnostics());
  if(d.preview!=='idle' || d.state!=='idle' || d.activeAction?.weight<.5)
    throw Error('Idle FBX imported but not visibly previewed: '+JSON.stringify(d));
  await page.locator('#previewPause').click();
  if(!(await page.evaluate(()=>window.__movementDiagnostics().previewPaused)))throw Error('Preview pause failed');
  await page.locator('#previewPause').click();
  await page.screenshot({path:'/tmp/lembah-movement-'+type+'-idle-preview.png'});
  await page.locator('#previewDone').click();
  await page.locator('#resetCharacter').click();
  const centered=await page.evaluate(()=>window.__movementDiagnostics());
  if(centered.position.some(x=>Math.abs(x)>1e-6))throw Error('Pusatkan failed: '+JSON.stringify(centered.position));
  await page.locator('#openUpload').click();
  await page.locator('[data-run="anime"]').click();
  await page.waitForFunction(()=>window.__movementDiagnostics?.().slots.anime.loaded===true,null,{timeout:60000});
  await page.locator('#closeUpload').click();
  await page.keyboard.down('Shift');await beginDirection('w');
  await page.waitForTimeout(430);
  d=await page.evaluate(()=>window.__movementDiagnostics());
  if(d.state!=='anime')throw Error('Run Anime not combined onto single actor: '+JSON.stringify(d));
  await page.keyboard.up('w');await page.keyboard.up('Shift');
  await page.screenshot({path:'/tmp/lembah-movement-'+type+'-game.png'});
  if(errors.length||shaderErrors.length)throw Error('Browser errors: '+errors.join('; ')+' / '+shaderErrors.join('; '));
  console.log('MOVEMENT COMBO PASS',type,JSON.stringify(d));
 }catch(err){
  console.error('MOVEMENT COMBO FAIL',type,err.message);
  console.error('Page errors:',errors.join('; '));
  console.error('Current status:',await page.locator('#status').innerText().catch(()=>'(none)'));
  await page.screenshot({path:'/tmp/lembah-movement-'+type+'-failure.png'}).catch(()=>{});
  process.exitCode=1;
 }finally{await browser.close()}
})().catch(err=>{console.error('MOVEMENT SCRIPT FAIL',err.message);process.exitCode=1});