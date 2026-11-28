// Exercise the shipped game with normal movement and touch controls, including
// WebGL shader compilation, relative Pages asset URLs, and a cold reload.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = path.resolve('dist');
const prefix = '/Lembah-Asri/';
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.glb':'model/gltf-binary'};
const server = createServer(async (req,res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
  const file = path.resolve(root, pathname.slice(prefix.length) || 'index.html');
  if (!file.startsWith(root + path.sep)) { res.writeHead(404).end(); return; }
  try {
    const {size} = await stat(file);
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'Content-Length':size});
    createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']
  });
  const page = await browser.newPage({ viewport:{width:960,height:640}, deviceScaleFactor:0.75, hasTouch:true, isMobile:true });
  page.setDefaultTimeout(60_000);
  const failures = [], art = new Set();
  page.on('pageerror', e => { failures.push(e.message); console.error(e.stack); });
  await page.addInitScript(() => {
    const events = new EventTarget();
    window.__THREE_DEVTOOLS__ = events;
    events.addEventListener('observe', ({ detail }) => {
      if (detail.isScene && detail.name !== 'Lembah Asri - World') {
        // Constructors emit before children have been attached.
        (window.testScenes ??= []).push(detail);
      }
    });
  });
  page.on('console', m => { if (/House GLB unavailable/.test(m.text())) console.error(m.text()); if (m.type() === 'error' && /Shader Error|VALIDATE_STATUS|Could not initialise WebGL|World export failed/i.test(m.text())) { failures.push(m.text()); console.error(m.text()); } });
  page.on('response', res => { if (res.ok()) art.add(new URL(res.url()).pathname); });
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  const url = 'http://127.0.0.1:' + server.address().port + prefix;
  await page.goto(url, {waitUntil:'domcontentloaded'});
  const ready = page.getByText('3D WORLD READY',{exact:true});
  const verifyHouse = async () => {
    const canvas=page.locator('.game-canvas');
    await page.waitForFunction(()=>['loaded','fallback'].includes(document.querySelector('.game-canvas')?.dataset.houseLoadState));
    assert.equal(await canvas.getAttribute('data-house-load-state'),'loaded',
      'Red Roof Cottage loader: '+await canvas.getAttribute('data-house-load-error'));
  };
  await ready.waitFor({timeout:150_000});
  await verifyHouse();
  // Check installed geometry, not merely the code or synthetic test output.
  await page.locator('.game-canvas[data-fence-revision="authored-shared-posts-v1"][data-fence-texture-revision="original-authored-glb"]').waitFor({timeout:120_000});
  await mkdir('artifacts/garden',{recursive:true});
  await page.screenshot({path:'artifacts/garden/00-pagar-sambungan.jpg',type:'jpeg',quality:90});
  const modeChoice = page.getByRole('combobox',{name:'Mode kontrol'});
  const controlMode = () => page.locator('.game-shell').getAttribute('data-control-mode');
  assert.equal(await modeChoice.inputValue(),'auto','first visit uses automatic mode');
  assert.equal(await controlMode(),'tablet','touch device defaults to touch HUD');
  await modeChoice.selectOption('desktop');
  assert.equal(await controlMode(),'desktop','explicit desktop must override touch device');
  assert.equal(await page.locator('.mobile-joystick').evaluate(el=>getComputedStyle(el).display),'none');
  await modeChoice.selectOption('tablet');
  assert.equal(await controlMode(),'tablet','tablet mode must show touch HUD at desktop-width viewport');
  assert.notEqual(await page.locator('.mobile-joystick').evaluate(el=>getComputedStyle(el).display),'none');
  assert.notEqual(await page.locator('.mobile-run').evaluate(el=>getComputedStyle(el).display),'none');
  assert.notEqual(await page.locator('.mobile-jump').evaluate(el=>getComputedStyle(el).display),'none');
  await page.reload({waitUntil:'domcontentloaded'});
  await ready.waitFor({timeout:150_000});
  await verifyHouse();
  assert.equal(await modeChoice.inputValue(),'tablet','mode must persist across reload');
  assert.equal(await controlMode(),'tablet');
  await modeChoice.selectOption('auto');
  assert.equal(await controlMode(),'tablet','auto restores device-dependent behavior');
  // A native select retains keyboard focus after changing mode. Return focus
  // to gameplay just as a player would, before issuing movement keys.
  await page.locator('.game-canvas canvas').click({position:{x:400,y:300}});
  const hud = page.getByRole('region',{name:'Rawat kebun'});
  // Walk diagonally across the open courtyard from the normal spawn until a
  // place actually comes within reach (independent of software renderer FPS).
  const position = () => page.evaluate(() => {
    const player = window.testScenes?.map(scene => scene.getObjectByName('LembahAsri_PlayerRoot')).find(Boolean);
    return {feet:player?.position.toArray(), focus:document.activeElement?.tagName};
  });
  assert.equal((await position()).focus,'CANVAS');
  await page.keyboard.down('d');
  await page.keyboard.down('w');
  try {
    await hud.waitFor({timeout:150_000});
  } catch (error) {
    console.error('Failed garden approach', await position(), failures);
    throw error;
  } finally { await page.keyboard.up('w'); await page.keyboard.up('d'); }
  await page.mouse.move(460,315);
  await page.mouse.down();
  await page.mouse.move(557,315,{steps:6});
  await page.mouse.up();
  const button = name => hud.getByRole('button',{name,exact:true});
  await button('Cangkul').waitFor();
  const twoFrames = () => page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await twoFrames();
  await mkdir('artifacts/garden',{recursive:true});
  await page.screenshot({path:'artifacts/garden/01-kebun-kosong.jpg',type:'jpeg',quality:87});
  await button('Cangkul').tap();
  await button('Siram').tap();
  await hud.getByText('Tanah gembur dan basah').waitFor();
  await button('Tanam sawi').tap();
  await hud.getByText('Benih sawi sudah disiram').waitFor();
  await twoFrames();
  await page.screenshot({path:'artifacts/garden/02-benih-disiram.jpg',type:'jpeg',quality:87});
  const readSeeds = () => page.evaluate(()=>Object.entries(localStorage)
    .filter(([key])=>key.startsWith('lembah-asri:home-garden:v1:')).map(([key,v])=>[key,JSON.parse(v)]));
  const snapshot = await readSeeds();
  assert.equal(snapshot.length,1);
  assert.ok(snapshot[0][1].tilled && snapshot[0][1].plantedAt && snapshot[0][1].wateredAt);
  // Finish the cycle on the selected bed. Only the crop clock advances.
  await page.clock.setFixedTime(new Date(Math.max(snapshot[0][1].plantedAt, snapshot[0][1].wateredAt) + 121_000));
  await button('Panen').tap();
  const harvested = await readSeeds();
  assert.equal(harvested.length,1);
  assert.equal(harvested[0][0],snapshot[0][0]);
  assert.equal(harvested[0][1].harvests,1);
  assert.equal(harvested[0][1].plantedAt,0);
  await page.reload({waitUntil:'domcontentloaded'});
  await ready.waitFor({timeout:150_000});
  await verifyHouse();
  assert.deepEqual(await readSeeds(),harvested);
  assert.ok(art.has(prefix+'textures/terrain/home_garden_rows.webp'),'the deployed garden painting was fetched');
  // Exercise the real download button on a fully loaded production world.
  // Retain the same native Scene JSON so it can be opened in Three.js Editor.
  await mkdir('artifacts/world',{recursive:true});
  const downloadPromise=page.waitForEvent('download',{timeout:150_000});
  const exportFailure=page.getByText(/^Export gagal:/).waitFor({timeout:150_000})
    .then(async()=>{throw new Error(await page.getByText(/^Export gagal:/).textContent());});
  const result=Promise.race([downloadPromise,exportFailure]);
  // Register the rejection handler before clicking to avoid unhandled errors
  // if the export fails while Playwright is still completing the input action.
  void result.catch(()=>{});
  await page.getByRole('button',{name:'Export World JSON',exact:true}).click();
  const download=await result.catch(async error=>{
    const notice=await page.locator('.perf-reading[role="status"]').textContent({timeout:3000}).catch(()=>'(no export status)');
    throw new Error('World JSON download failed: '+notice+'; '+error.message);
  });
  assert.equal(download.suggestedFilename(),'Lembah-Asri-World.json');
  const worldPath='artifacts/world/Lembah-Asri-World.json';
  await download.saveAs(worldPath);
  const exported=JSON.parse(await readFile(worldPath,'utf8'));
  assert.equal(exported.object.type,'Scene');
  assert.equal(exported.metadata.type,'Object');
  const names=new Set();
  let exportedHouse;
  const walk=o=>{
    names.add(o.name);
    if(o.name==='Rumah utama - Red Roof Cottage') exportedHouse=o;
    for(const child of o.children??[])walk(child);
  };
  walk(exported.object);
  for(const name of ['World painted grass UV terrain',
    'Rumah utama - Red Roof Cottage',
    'Home scene - layered local grove',
    'Shallow stream west of childhood home']){
    assert.ok(names.has(name),'missing exported world object: '+name);
  }
  assert.equal(exportedHouse?.userData?.sourceFile,'rumah_utama_red_roof.glb');
  assert.equal(exportedHouse?.userData?.uvPreserved,true);
  assert.equal(exportedHouse?.userData?.painterlyShader,true);
  assert.equal(exportedHouse?.userData?.houseCollision,'mesh-stairs-v1');
  assert.ok(exportedHouse.userData.houseCollisionTriangles>0);
  assert.ok(art.has(prefix+'models/environment/rumah_utama_red_roof.glb'),'the replacement GLB was fetched');
  assert.ok(!names.has('Rumah Masa Kecil - fallback geometry') || (()=>{
    let visibleFallback=false;
    const visit=o=>{if(o.name==='Rumah Masa Kecil - fallback geometry' && o.visible!==false) visibleFallback=true;for(const child of o.children??[])visit(child);};
    visit(exported.object);return !visibleFallback;
  })(),'fallback house must not remain visible');
  // The actual exported runtime scene must not contain the off-area village.
  for (const name of ['Balai Desa walls', 'Pendopo floor', 'Pasar Desa walls',
    'Puskesmas walls', 'Village plaza handpainted UV surface', 'Village bamboo footbridge',
    'Warung approach - walkable UV path', 'Island horizon - north sea, east village, south forest, west mountain',
    'Childhood home north - painted rice fields and volcano', 'Rolling meadow outside playable ground']) {
    assert.ok(!names.has(name), 'unexpected off-area world object: '+name);
  }
  assert.ok(exported.geometries.length>10 && exported.materials.length>10);
  assert.ok(exported.images.length>5);
  for(const image of exported.images){
    assert.ok(typeof image.url==='string' ? image.url.startsWith('data:') :
      image.url && (Array.isArray(image.url.data) || Array.isArray(image.url)),
      'texture source must be embedded, not a remote or blob URL');
  }
  for (const clip of ['Walking','Running','Jump']) {
    assert.ok(art.has(prefix + 'models/character/clips/' + clip + '.json'), 'missing clip ' + clip);
    assert.ok(!art.has(prefix + 'models/character/' + clip + '.fbx'), 'downloaded duplicate mesh ' + clip);
  }
  assert.deepEqual(failures,[]);
  console.log('Touch actions, soil, saved seed and WebGL garden verified from the production build.');
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
