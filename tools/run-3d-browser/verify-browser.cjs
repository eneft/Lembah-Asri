const {chromium, webkit}=require('playwright');
const fs=require('fs');
const PNG=require('pngjs').PNG;
const engine=process.env.BROWSER_ENGINE==='webkit' ? webkit : chromium;
(async()=>{
 const browser=await engine.launch({headless:true,args:process.env.BROWSER_ENGINE==='webkit'?[]:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shaderErrors=[];
 page.on('console',msg=>{
   if(/(?:THREE\.WebGLProgram|Shader Error|VALIDATE_STATUS|GL_INVALID|ERROR:\s*0:)/i.test(msg.text()))
     shaderErrors.push(msg.text().slice(0,1400));
 });
 try{
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded',timeout:45000});
  // Safari/WebKit UI regression is independent of WebGL and texture loading.
  if(process.env.BROWSER_ENGINE==='webkit'){
    await page.setViewportSize({width:390,height:844});
    const drawer=page.locator('#settingsPanel');
    const toggle=page.locator('#settingsToggle');
    if(!(await toggle.isVisible())) throw Error('Safari settings summary not visible');
    if(await drawer.isVisible()) throw Error('Safari settings initially expanded');
    await toggle.click();
    if(!(await drawer.isVisible()) || !(await page.locator('#advancedControls').isVisible()))
      throw Error('Safari gear did not open settings drawer');
    await page.waitForTimeout(1500);
    if(!(await drawer.isVisible())) throw Error('Safari settings closed automatically after opening');
    if(!(await page.locator('#quickUpload').isVisible())) throw Error('Safari FBX upload shortcut missing');
    if(!(await page.locator('#fbxFiles').count())) throw Error('Safari FBX input missing');
    await page.locator('#normalDetail').click();
    if(!(await drawer.isVisible())) throw Error('Safari settings closed when toggling Normal map');
    await page.screenshot({path:'/tmp/lembah-run-browser-safari-settings-open.png'});
    await page.locator('#settingsClose').click();
    if((await drawer.isVisible()) || (await page.locator('#advancedControls').isVisible()))
      throw Error('Safari explicit close button failed');
    console.log('MOBILE SAFARI SETTINGS PASS: menu stays open until explicit Close');
    return;
  }
  await page.waitForFunction(()=>document.querySelector('#fileHint')?.textContent.includes('Dua animasi telah dimuat otomatis'),{timeout:105000});
  await page.waitForTimeout(1800);
  const diagnostic=await page.evaluate(()=>window.__lembahDiagnostics?.());
  console.log('FBX PREVIEW DIAGNOSTICS:',JSON.stringify(diagnostic));
  if(!diagnostic?.textureLoaded)throw Error('Base Color texture did not load');
  if(!diagnostic.clips.every(c=>c?.meshCount>0))throw Error('FBX UV map missing: '+JSON.stringify(diagnostic.clips));
  const initial=await page.locator('#status').innerText();
  if(!initial.includes('Running Normal'))throw Error('Normal clip unavailable: '+initial);
  await page.screenshot({path:'/tmp/lembah-run-browser-normal.png'});
  // Lighting look-dev controls must work without changing original animation clips.
  for (const lighting of ['sunset','indoor','day']) {
    await page.locator('[data-light="'+lighting+'"]').click();
    const info = await page.evaluate(() => window.__lembahDiagnostics());
    if(info.light !== lighting) throw Error('Lighting preset failed: ' + lighting + ' -> ' + info.light);
    if(lighting !== 'day') await page.screenshot({path:'/tmp/lembah-run-browser-'+lighting+'.png'});
  }
  await page.locator('#settingsToggle').click();
  if(!(await page.locator('#advancedControls').isVisible())) throw Error('Desktop settings drawer failed');
  await page.waitForTimeout(800);
  if(!(await page.locator('#settingsPanel').isVisible())) throw Error('Desktop menu unexpectedly auto-closed');
  await page.locator('[data-material="flat"]').click();
  let preview = await page.evaluate(() => window.__lembahDiagnostics());
  if(preview.material !== 'flat' || !preview.clips.every(c=>c.materialType === 'MeshBasicMaterial'))
    throw Error('Original albedo material comparison failed: ' + JSON.stringify(preview));
  await page.screenshot({path:'/tmp/lembah-run-browser-original-albedo.png'});
  await page.locator('[data-material="toon"]').click();
  preview = await page.evaluate(() => window.__lembahDiagnostics());
  if(preview.material !== 'toon' || !preview.clips.every(c=>c.materialType === 'MeshToonMaterial'))
    throw Error('Anime soft toon material failed: ' + JSON.stringify(preview));
  await page.locator('[data-material="painterly"]').click();
  preview=await page.evaluate(()=>window.__lembahDiagnostics());
  if(preview.material!=='painterly' || !preview.painterlyShader || preview.painterlyRamp!==256 || preview.painterlyVersion!==2 || preview.hardFloorShadow!==false ||
     !preview.clips.every(c=>c.materialType==='MeshToonMaterial')) throw Error('Painterly anime shader not installed: '+JSON.stringify(preview));
  await page.locator('#showGrid').check();
  if(!(await page.evaluate(()=>window.__lembahDiagnostics().debugGrid)))throw Error('Grid debug toggle failed');
  await page.locator('#showGrid').uncheck();
  await page.locator('#showShadow').uncheck();
  if((await page.evaluate(()=>window.__lembahDiagnostics().shadowVisible)))throw Error('Contact shadow toggle failed');
  await page.locator('#showShadow').check();
  await page.waitForTimeout(300);
  if(shaderErrors.length)throw Error('Painterly shader WebGL compilation failed: '+shaderErrors.join(' | '));
  // Freeze the same animation pose for a real old/new visual pixel check.
  await page.locator('#play').click();
  await page.waitForTimeout(180);
  const freshShot=await page.locator('#stage canvas').screenshot({path:'/tmp/lembah-painterly-v2-stage.png'});
  await page.locator('[data-material="toon"]').click();
  await page.waitForTimeout(180);
  const oldShot=await page.locator('#stage canvas').screenshot({path:'/tmp/lembah-soft-toon-legacy-stage.png'});
  const fresh=PNG.sync.read(freshShot), old=PNG.sync.read(oldShot);
  if(fresh.width!==old.width||fresh.height!==old.height)throw Error('Visual comparison dimension mismatch');
  let changed=0, compared=0;
  for(let y=Math.floor(fresh.height*.08);y<Math.floor(fresh.height*.78);y+=2) {
    for(let x=Math.floor(fresh.width*.30);x<Math.floor(fresh.width*.70);x+=2) {
      const i=(y*fresh.width+x)*4;
      const delta=Math.abs(fresh.data[i]-old.data[i])+
        Math.abs(fresh.data[i+1]-old.data[i+1])+Math.abs(fresh.data[i+2]-old.data[i+2]);
      if(delta>38)changed++;
      compared++;
    }
  }
  // A mathematically valid fragment shader can still produce a black avatar.
  // Reject an image where a large portion of the center becomes near-black.
  let veryDark=0,nearTotal=0;
  for(let y=Math.floor(fresh.height*.15);y<Math.floor(fresh.height*.80);y+=2){
    for(let x=Math.floor(fresh.width*.30);x<Math.floor(fresh.width*.70);x+=2){
      const i=(y*fresh.width+x)*4;
      if(Math.max(fresh.data[i],fresh.data[i+1],fresh.data[i+2])<24)veryDark++;
      nearTotal++;
    }
  }
  const blackRatio=veryDark/nearTotal;
  console.log('PAINTERLY DARK PIXEL RATIO:',blackRatio.toFixed(4));
  if(blackRatio>.025)throw Error('Painterly material is a black silhouette: '+blackRatio);
  const fraction=changed/compared;
  console.log('PAINTERLY V2 IMAGE DIFF:',fraction.toFixed(4),changed,'/',compared);
  if(fraction<0.012)throw Error('Painterly still visually indistinguishable from old Soft Toon: '+fraction);
  await page.locator('[data-material="painterly"]').click();
  await page.locator('#play').click(); // Resume original animation state.
  await page.screenshot({path:'/tmp/lembah-run-browser-painterly.png'});
  await page.locator('#normalDetail').uncheck();
  await page.locator('#normalDetail').check();
  await page.locator('#exposure').fill('1.15');
  await page.locator('#speed').fill('1.5');
  await page.locator('#settingsClose').click();

  await page.locator('#run').click();
  const anime=await page.locator('#status').innerText();
  if(!(await page.locator('#run').getAttribute('class')).includes('active'))throw Error('Anime selection active state missing');
  await page.waitForTimeout(500);
  if(!anime.includes('Run Anime'))throw Error('Anime clip unavailable: '+anime);
  await page.screenshot({path:'/tmp/lembah-run-browser-anime.png'});
  await page.locator('#play').click();
  if(!(await page.locator('#play').innerText()).includes('Play'))throw Error('Pause toggle failed');
  // Mobile: no full-height panel blocking the avatar, with lighting always accessible.
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(400);
  const mobileLayout=await page.evaluate(()=>{
    const p=document.querySelector('.panel').getBoundingClientRect();
    const advance=document.querySelector('#advancedControls');
    return {dockHeight:p.height,dockTop:p.top,viewportHeight:innerHeight,
      dayVisible:document.querySelector('[data-light="day"]').getBoundingClientRect().height>0,
      settingsVisible:document.querySelector('#settingsToggle').getBoundingClientRect().height>0,
      advancedHidden:document.querySelector('#settingsPanel').hidden && advance.getClientRects().length===0};
  });
  if(mobileLayout.dockHeight>155 || !mobileLayout.dayVisible || !mobileLayout.settingsVisible || !mobileLayout.advancedHidden)
    throw Error('Mobile compact controls failed: '+JSON.stringify(mobileLayout));
  await page.screenshot({path:'/tmp/lembah-run-browser-mobile-minimal.png'});
  // Upload a third FBX with a different name and preserve the built-in two.
  const input = page.locator('#fbxFiles');
  await input.setInputFiles({
    name:'Custom_Test_03.fbx',
    mimeType:'application/octet-stream',
    buffer:fs.readFileSync('/tmp/lembah-run-web/assets/Run_Web_UV.fbx')
  });
  await page.waitForFunction(()=>window.__lembahDiagnostics?.().uploaded===1,{timeout:45000});
  const uploaded = await page.evaluate(()=>window.__lembahDiagnostics());
  if(uploaded.names.length!==3||uploaded.names[0]!=='Running Normal'||uploaded.names[1]!=='Run Anime'||uploaded.selected!==2)
    throw Error('Upload replaced built-in animations: '+JSON.stringify(uploaded));
  if(!(await page.locator('#extrasRow').isVisible()))throw Error('Uploaded animation button is missing');
  if(uploaded.clips[2]?.materialType !== 'MeshToonMaterial') throw Error('Painterly material not applied to uploaded FBX');
  const grounded = uploaded.clips[2];
  if(!Number.isFinite(grounded.autoGround) || grounded.groundSamples<7 || Math.abs(grounded.contactGroundY)>0.001)
    throw Error('FBX animation was not calibrated to ground: '+JSON.stringify(grounded));
  console.log('AUTO GROUND PASS:',JSON.stringify({offset:grounded.autoGround,samples:grounded.groundSamples}));

  await page.locator('#running').click();
  if((await page.evaluate(()=>window.__lembahDiagnostics())).selected!==0)throw Error('Built-in Running unavailable after upload');
  await page.locator('#extraClips button').click();
  if((await page.evaluate(()=>window.__lembahDiagnostics())).selected!==2)throw Error('Cannot reselect custom FBX');
  await page.screenshot({path:'/tmp/lembah-run-browser-mobile-custom-fbx.png'});
  await page.locator('#settingsToggle').click();
  if(!(await page.locator('#groundRow').isVisible())) throw Error('Ground controls not visible for uploaded FBX');
  // Negative input[type=range] fails locator.fill() in some Playwright versions;
  // dispatch the same native input event as dragging the range thumb.
  await page.locator('#groundOffset').evaluate(el=>{
    el.value='-0.20';
    el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  const afterOffset = (await page.evaluate(()=>window.__lembahDiagnostics())).clips[2];
  if(Math.abs(afterOffset.manualOffset + 0.2)>0.011 ||
     Math.abs(afterOffset.anchorY-afterOffset.autoGround+0.2)>0.011)
    throw Error('Manual ground offset failed: '+JSON.stringify(afterOffset));
  await page.locator('#groundReset').click();
  const afterReset = (await page.evaluate(()=>window.__lembahDiagnostics())).clips[2];
  if(Math.abs(afterReset.manualOffset)>0.001 ||
     Math.abs(afterReset.anchorY-afterReset.autoGround)>0.001)
    throw Error('Ground reset failed: '+JSON.stringify(afterReset));
  if(!(await page.locator('#advancedControls').isVisible()) || !(await page.locator('#settingsPanel').isVisible())) throw Error('Mobile settings drawer failed');
  await page.waitForTimeout(1000);
  if(!(await page.locator('#settingsPanel').isVisible())) throw Error('Mobile settings closed unexpectedly');
  await page.screenshot({path:'/tmp/lembah-run-browser-mobile-settings-'+(process.env.BROWSER_ENGINE || 'chromium')+'.png'});
  await page.locator('[data-material="flat"]').click();
  if(!(await page.locator('#settingsPanel').isVisible())) throw Error('Mobile settings closed on material switch');
  await page.locator('#clearExtras').click();
  if((await page.evaluate(()=>window.__lembahDiagnostics())).uploaded!==0)throw Error('Clear extras did not restore two built-in FBXs');
  await page.locator('#settingsClose').click();
  if(await page.locator('#advancedControls').isVisible() || (await page.locator('#settingsPanel').isVisible())) throw Error('Mobile settings explicit close failed');
  await page.locator('[data-light="sunset"]').click();
  if((await page.evaluate(()=>window.__lembahDiagnostics())).light!=='sunset') throw Error('Mobile lighting selection failed');
  console.log('MOBILE RUN TESTER PASS:',JSON.stringify(mobileLayout));
  console.log('RUN 3D BROWSER PASS:',JSON.stringify({normal:initial,anime,pause:true,speed:'1.5x',errors}));
  if(shaderErrors.length)throw Error('WebGL shader compilation failures: '+shaderErrors.join(' | '));
  if(errors.length)console.log('Nonfatal page console errors:',errors.join('; '));
 }catch(e){
  console.error('RUN 3D BROWSER FAIL:',e.message);
  console.error('Browser status:',await page.locator('#status').innerText().catch(()=>'(unavailable)'));
  console.error('Page errors:',errors.join(' | '));
  await page.screenshot({path:'/tmp/lembah-run-browser-error.png'}).catch(()=>{});
  process.exitCode=1;
 }finally{await browser.close();}
})();