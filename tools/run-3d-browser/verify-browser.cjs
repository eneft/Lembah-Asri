const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>document.querySelector('#fileHint')?.textContent.includes('Dua animasi telah dimuat otomatis'),{timeout:105000});
  const initial=await page.locator('#status').innerText();
  if(!initial.includes('Running Normal'))throw Error('Normal clip unavailable: '+initial);
  await page.screenshot({path:'/tmp/lembah-run-browser-normal.png'});
  await page.locator('#run').click();
  const anime=await page.locator('#status').innerText();
  if(!anime.includes('Run Anime'))throw Error('Anime clip unavailable: '+anime);
  await page.screenshot({path:'/tmp/lembah-run-browser-anime.png'});
  await page.locator('#play').click();
  if(!(await page.locator('#play').innerText()).includes('Play'))throw Error('Pause toggle failed');
  await page.locator('#speed').fill('1.5');
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