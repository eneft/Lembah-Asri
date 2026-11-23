// Exercise the shipped game with normal movement and touch controls, including
// WebGL shader compilation, relative Pages asset URLs, and a cold reload.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
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
  const page = await browser.newPage({ viewport:{width:960,height:640}, hasTouch:true, isMobile:true });
  page.setDefaultTimeout(60_000);
  const failures = [], art = new Set();
  page.on('pageerror', e => failures.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && /Shader Error|VALIDATE_STATUS|Could not initialise WebGL/i.test(m.text())) failures.push(m.text()); });
  page.on('response', res => { if (res.ok()) art.add(new URL(res.url()).pathname); });
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  const url = 'http://127.0.0.1:' + server.address().port + prefix;
  await page.goto(url, {waitUntil:'domcontentloaded'});
  const ready = page.getByText('3D WORLD READY',{exact:true});
  await ready.waitFor({timeout:150_000});
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
  assert.equal(await modeChoice.inputValue(),'tablet','mode must persist across reload');
  assert.equal(await controlMode(),'tablet');
  await modeChoice.selectOption('auto');
  assert.equal(await controlMode(),'tablet','auto restores device-dependent behavior');
  const hud = page.getByRole('region',{name:'Rawat kebun'});
  // Walk diagonally across the open courtyard from the normal spawn until a
  // place actually comes within reach (independent of software renderer FPS).
  await page.keyboard.down('d');
  await page.keyboard.down('w');
  try { await hud.waitFor(); } finally { await page.keyboard.up('w'); await page.keyboard.up('d'); }
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
  await page.reload({waitUntil:'domcontentloaded'});
  await ready.waitFor({timeout:150_000});
  assert.deepEqual(await readSeeds(),snapshot);
  assert.ok(art.has(prefix+'textures/terrain/home_garden_rows.webp'),'the deployed garden painting was fetched');
  assert.deepEqual(failures,[]);
  console.log('Touch actions, soil, saved seed and WebGL garden verified from the production build.');
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
