const {chromium, webkit}=require('playwright');
const engine=process.env.BROWSER_ENGINE==='webkit' ? webkit : chromium;
(async()=>{
 const browser=await engine.launch({headless:true,args:process.env.BROWSER_ENGINE==='webkit'?[]:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded',timeout:45000});
  // Safari/WebKit UI regression is independent of WebGL and texture loading.
  if(process.env.BROWSER_ENGINE==='webkit'){
    await page.setViewportSize({width:390,height:844});
    const drawer=page.locator('#settingsDrawer');
    const toggle=page.locator('#settingsToggle');
    if(!(await toggle.isVisible())) throw Error('Safari settings summary not visible');
    if(await drawer.evaluate(el=>el.open)) throw Error('Safari settings initially expanded');
    await toggle.click();
    if(!(await drawer.evaluate(el=>el.open)) || !(await page.locator('#advancedControls').isVisible()))
      throw Error('Safari gear did not open settings drawer');
    await page.screenshot({path:'/tmp/lembah-run-browser-safari-settings-open.png'});
    await toggle.click();
    if((await drawer.evaluate(el=>el.open)) || (await page.locator('#advancedControls').isVisible()))
      throw Error('Safari gear did not close settings drawer');
    console.log('MOBILE SAFARI SETTINGS PASS: native HTML details opens and closes');
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
  await page.locator('[data-material="flat"]').click();
  let preview = await page.evaluate(() => window.__lembahDiagnostics());
  if(preview.material !== 'flat' || !preview.clips.every(c=>c.materialType === 'MeshBasicMaterial'))
    throw Error('Original albedo material comparison failed: ' + JSON.stringify(preview));
  await page.screenshot({path:'/tmp/lembah-run-browser-original-albedo.png'});
  await page.locator('[data-material="toon"]').click();
  preview = await page.evaluate(() => window.__lembahDiagnostics());
  if(preview.material !== 'toon' || !preview.clips.every(c=>c.materialType === 'MeshToonMaterial'))
    throw Error('Anime soft toon material failed: ' + JSON.stringify(preview));
  await page.locator('#normalDetail').uncheck();
  await page.locator('#normalDetail').check();
  await page.locator('#exposure').fill('1.15');
  await page.locator('#settingsToggle').click();

  await page.locator('#run').click();
  const anime=await page.locator('#status').innerText();
  if(!(await page.locator('#run').getAttribute('class')).includes('active'))throw Error('Anime selection active state missing');
  await page.waitForTimeout(500);
  if(!anime.includes('Run Anime'))throw Error('Anime clip unavailable: '+anime);
  await page.screenshot({path:'/tmp/lembah-run-browser-anime.png'});
  await page.locator('#play').click();
  if(!(await page.locator('#play').innerText()).includes('Play'))throw Error('Pause toggle failed');
  await page.locator('#speed').fill('1.5');
  // Mobile: no full-height panel blocking the avatar, with lighting always accessible.
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(400);
  const mobileLayout=await page.evaluate(()=>{
    const p=document.querySelector('.panel').getBoundingClientRect();
    const advance=document.querySelector('#advancedControls');
    return {dockHeight:p.height,dockTop:p.top,viewportHeight:innerHeight,
      dayVisible:document.querySelector('[data-light="day"]').getBoundingClientRect().height>0,
      settingsVisible:document.querySelector('#settingsToggle').getBoundingClientRect().height>0,
      advancedHidden:!document.querySelector('#settingsDrawer').open && advance.getClientRects().length===0};
  });
  if(mobileLayout.dockHeight>155 || !mobileLayout.dayVisible || !mobileLayout.settingsVisible || !mobileLayout.advancedHidden)
    throw Error('Mobile compact controls failed: '+JSON.stringify(mobileLayout));
  await page.screenshot({path:'/tmp/lembah-run-browser-mobile-minimal.png'});
  await page.locator('#settingsToggle').click();
  if(!(await page.locator('#advancedControls').isVisible()) || !(await page.locator('#settingsDrawer').evaluate(el=>el.open))) throw Error('Mobile native settings drawer failed');
  await page.screenshot({path:'/tmp/lembah-run-browser-mobile-settings-'+(process.env.BROWSER_ENGINE || 'chromium')+'.png'});
  await page.locator('#settingsToggle').click();
  if(await page.locator('#advancedControls').isVisible() || (await page.locator('#settingsDrawer').evaluate(el=>el.open))) throw Error('Mobile native settings drawer did not close');
  await page.locator('[data-light="sunset"]').click();
  if((await page.evaluate(()=>window.__lembahDiagnostics())).light!=='sunset') throw Error('Mobile lighting selection failed');
  console.log('MOBILE RUN TESTER PASS:',JSON.stringify(mobileLayout));
  console.log('RUN 3D BROWSER PASS:',JSON.stringify({normal:initial,anime,pause:true,speed:'1.5x',errors}));
  if(errors.length)console.log('Nonfatal page console errors:',errors.join('; '));
 }catch(e){
  console.error('RUN 3D BROWSER FAIL:',e.message);
  console.error('Browser status:',await page.locator('#status').innerText().catch(()=>'(unavailable)'));
  console.error('Page errors:',errors.join(' | '));
  await page.screenshot({path:'/tmp/lembah-run-browser-error.png'}).catch(()=>{});
  process.exitCode=1;
 }finally{await browser.close();}
})();