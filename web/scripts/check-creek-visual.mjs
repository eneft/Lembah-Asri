// Production-build creek visual QA: capture actual Three.js rendering, not concept art.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root=path.resolve('dist'), prefix='/Lembah-Asri/';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary',
  '.jpg':'image/jpeg','.fbx':'application/octet-stream'};
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith(prefix)){res.writeHead(404).end();return;}
  const file=path.resolve(root,pathname.slice(prefix.length)||'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(404).end();return;}
  try{
    const {size}=await stat(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Content-Length':size});
    createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({
    executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']
  });
  const page=await browser.newPage({viewport:{width:800,height:1000},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  page.setDefaultTimeout(60000);
  const errors=[],assets=new Set();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{
    if(m.type()==='error'&&/Shader Error|VALIDATE_STATUS|Could not initialise WebGL/i.test(m.text()))
      errors.push(m.text());
  });
  page.on('response',response=>{if(response.ok())assets.add(new URL(response.url()).pathname);});
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+prefix+'?view=sungai',{waitUntil:'domcontentloaded'});
  await page.getByText('3D WORLD READY',{exact:true}).waitFor({timeout:150000});

  // Inspect React's in-memory ref only inside this disposable QA browser.
  // Shipping app/game code remains unchanged and no global testing API ships.
  const found=await page.evaluate(()=>{
    const root=document.getElementById('root');
    const key=Object.keys(root??{}).find(k=>k.startsWith('__reactContainer$'));
    if(!key)return 'no-react-root';
    const holder=root[key];
    const start=holder.stateNode?.current??holder;
    const stack=[start],seen=new Set();
    while(stack.length){
      const fiber=stack.pop();
      if(!fiber||seen.has(fiber))continue;
      seen.add(fiber);
      for(let hook=fiber.memoizedState;hook&&typeof hook==='object'&&'memoizedState' in hook;hook=hook.next){
        const value=hook.memoizedState?.current;
        if(value?.scene?.isScene&&value?.player?.setTranslation&&value?.camera?.isCamera){
          window.__lembahVisualQA=value;
          return 'game-found';
        }
      }
      if(fiber.sibling)stack.push(fiber.sibling);
      if(fiber.child)stack.push(fiber.child);
    }
    return 'game-ref-unavailable';
  });
  assert.equal(found,'game-found','cannot inspect scene safely in browser: '+found);
  await page.waitForFunction(()=>{
    const scene=window.__lembahVisualQA?.scene;
    return !!scene?.getObjectByName('UV mossy rock variant 00') &&
      !!scene?.getObjectByName('Fine soft creek bank grass') &&
      !!scene?.getObjectByName('Painted childhood courtyard');
  },null,{timeout:120000});
  const facts=await page.evaluate(()=>{
    const scene=window.__lembahVisualQA.scene;
    return {
      planks:scene.getObjectByName('Individual UV-painted timber bridge planks')?.count,
      submerged:scene.getObjectByName('Curated original UV textured rock placements')?.userData.partiallySubmergedRocks,
      grass:scene.getObjectByName('Fine soft creek bank grass')?.count,
      rails:scene.getObjectByName('Two painted side handrails')?.count
    };
  });
  assert.equal(facts.planks,16);
  assert.ok(facts.submerged>=6);
  assert.ok(facts.grass>260&&facts.grass<600,'restore the earlier softer riverside density');
  assert.equal(facts.rails,2);
  await mkdir('artifacts/creek',{recursive:true});
  await page.waitForFunction(()=>window.__lembahVisualQA.scene
    .getObjectByName('Rumah Masa Kecil / Playable House Garden')?.userData.paintedCreekLoaded);
  assert.ok(assets.has(prefix+'textures/terrain/creek_foam_original_painterly_atlas.png'),
    'the new foam image must actually load in the production browser');
  const foamState=await page.evaluate(()=>{
    const stage=window.__lembahVisualQA.scene.getObjectByName('Rumah Masa Kecil / Playable House Garden');
    const foam=stage.getObjectByName('Illustrated river foam and flow trails');
    return {loaded:stage.userData.paintedFoamLoaded,
      atlas:foam.userData.foamAtlasSource,
      ready:foam.userData.foamAtlasReady.value,
      clock:foam.userData.foamTimeUniform.value};
  });
  assert.equal(foamState.loaded,true,'the generated decal atlas should be active');
  assert.equal(foamState.ready,1);
  assert.equal(foamState.atlas,'./textures/terrain/creek_foam_original_painterly_atlas.png');
  assert.ok(foamState.clock>0,'foam clock advances with the water animation');
  for(const file of ['creek_cobbles.webp','creek_meadow.webp']){
    assert.ok(assets.has(prefix+'textures/terrain/'+file),'missing live creek image '+file);
  }
  const arrival=await page.evaluate(()=>window.__lembahVisualQA.player.translation());
  assert.ok(Math.abs(arrival.x+42.40)<.12 && Math.abs(arrival.z-10.95)<.12,
    'the riverside link should place the player at the near end of the bridge');
  await page.setViewportSize({width:540,height:960});
  await page.screenshot({path:'artifacts/creek/00-riverside-arrival.jpg',type:'jpeg',quality:93});
  await page.setViewportSize({width:800,height:1000});
  const shot=async(x,z,yaw,file,initialY=1.05,frames=14)=>{
    await page.evaluate(({x,z,yaw,initialY})=>{
      const game=window.__lembahVisualQA;
      const p={x,y:initialY,z};
      game.player.setTranslation(p,true);
      game.player.setLinvel({x:0,y:0,z:0},true);
      game.currentPhysicsPosition.set(x,p.y,z);
      game.previousPhysicsPosition.copy(game.currentPhysicsPosition);
      game.playerMesh.position.set(x,p.y-.84,z);
      game.yaw=yaw;
      game.cameraDistance=10.5;
      game.camera.position.set(x+Math.sin(yaw)*10.5,p.y+6.2,z+Math.cos(yaw)*10.5);
      game.cameraFocus.set(x,1.35,z);
      game.camera.lookAt(game.cameraFocus);
    },{x,z,yaw,initialY});
    await page.evaluate(count=>new Promise(resolve=>{
      let frames=0;
      const tick=()=>{if(++frames>=count)resolve();else requestAnimationFrame(tick);};
      requestAnimationFrame(tick);
    }),frames);
    await page.screenshot({path:file,type:'jpeg',quality:87});
  };
  await shot(-42.6,7.0,1.12,'artifacts/creek/01-bridge-bank.jpg');
  await shot(-42.25,13.0,.78,'artifacts/creek/02-bridge-upstream.jpg');
  // The raised deck should carry a REAL physics capsule, and the render
  // should show feet resting on timber rather than disappearing into it.
  await shot(-45.4,8.6,.85,'artifacts/creek/03-character-standing-on-timber.jpg',1.52,90);
  const bodyY=await page.evaluate(()=>window.__lembahVisualQA.player.translation().y);
  assert.ok(bodyY>1.09&&bodyY<1.30,
    'character must settle at the physical deck level, not at terrain Y=0: '+bodyY);
  assert.ok(assets.has(prefix+'textures/terrain/creek_water_painterly_illustrated.webp'));
  assert.ok(assets.has(prefix+'models/environment/lembah_asri_rocks_original_16.glb'));
  assert.deepEqual(errors,[]);
  console.log('Rendered and captured actual bridge, eroded banks, fine grass and immersed GLB rocks:',JSON.stringify(facts));
}finally{
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
