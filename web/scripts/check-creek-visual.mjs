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
  await page.waitForFunction(()=>window.__lembahVisualQA.scene
    .getObjectByName('West wooden bridge walkway')?.userData.userBridgeLoaded===true,
    null,{timeout:120000});
  const facts=await page.evaluate(()=>{
    const scene=window.__lembahVisualQA.scene;
    const bridge=scene.getObjectByName('West wooden bridge walkway');
    const imported=scene.getObjectByName('Uploaded wooden bridge - original GLB');
    let meshes=0,hasUVPaint=false;
    imported?.traverse(object=>{
      if(object.isMesh){meshes++;hasUVPaint ||= !!object.material.emissiveMap;}
    });
    return {
      uploaded:bridge?.userData.userBridgeLoaded,
      asset:bridge?.userData.bridgeAsset,
      triangles:bridge?.userData.sourceTriangles,
      sourceFile:bridge?.userData.sourceFile,
      rotationY:bridge?.userData.modelRotationY,
      dimensions:bridge?.userData.worldDimensions,
      meshes,hasUVPaint,
      oldPlanks:scene.getObjectByName('Individual UV-painted timber bridge planks')?.count,
      submerged:scene.getObjectByName('Curated original UV textured rock placements')?.userData.partiallySubmergedRocks,
      grass:scene.getObjectByName('Fine soft creek bank grass')?.count
    };
  });
  assert.equal(facts.uploaded,true);
  assert.equal(facts.sourceFile,'base_basic_shaded(2).glb');
  assert.ok(Math.abs(facts.rotationY-Math.PI/2)<.0001,'the second GLB must be rotated across the river');
  assert.equal(facts.asset,'./models/environment/bridge_user_reference_wood_v2.glb');
  assert.equal(facts.triangles,10000,'new uploaded bridge with all authored triangles must replace old');
  assert.ok(facts.meshes>=1&&facts.hasUVPaint,'preserve painted emissive atlas');
  assert.ok(facts.dimensions.x>5.05&&facts.dimensions.x<5.15,'full creek span');
  assert.ok(facts.dimensions.z>2.04&&facts.dimensions.z<2.14,'crossing width matches collider');
  assert.equal(facts.oldPlanks,undefined,'old procedural bridge should be gone');
  assert.ok(assets.has(prefix+'models/environment/bridge_user_reference_wood_v2.glb'));
  assert.ok(facts.submerged>=6);
  assert.ok(facts.grass>260&&facts.grass<600,'restore the earlier softer riverside density');
  // Only approve the game after the actual 3D concept tree and root UVs
  // render. A fallback or a decorative 2D plane cannot satisfy this check.
  await page.waitForFunction(()=>{
    const tree=window.__lembahVisualQA.scene
      .getObjectByName('Concept mature shade tree near the garden');
    return tree?.userData.referenceGLBLoaded===true;
  },null,{timeout:120000});
  const conceptTree=await page.evaluate(()=>{
    const tree=window.__lembahVisualQA.scene
      .getObjectByName('Concept mature shade tree near the garden');
    const roots=tree?.getObjectByName('Exposed hand-painted buttress roots');
    const painted=tree?.getObjectByName('Hand-painted old shade tree crown and branches');
    const leafSprays=tree?.getObjectByName('Reference broad hand-painted leaf sprays');
    let meshes=0,uvPainted=false,cutouts=false;
    painted?.traverse(object=>{
      if(!object.isMesh)return;
      meshes++;
      for(const material of (Array.isArray(object.material)?object.material:[object.material])){
        uvPainted ||= !!material.map;
        cutouts ||= material.alphaTest>.4;
      }
    });
    return {
      loaded:tree?.userData.referenceGLBLoaded,
      source:tree?.userData.referenceSource,
      x:tree?.position.x,z:tree?.position.z,
      meshes,uvPainted,cutouts,
      roots:roots?.geometry.userData.buttressRoots,
      barkPainted:!!roots?.material.map,
      broadSprays:leafSprays?.count,
      broadUV:!!leafSprays?.geometry?.getAttribute('uv'),
      broadPainted:!!leafSprays?.material?.map,
      true3D:leafSprays?.userData.isTrue3D
    };
  });
  assert.equal(conceptTree.loaded,true);
  assert.ok(conceptTree.meshes>=2 && conceptTree.uvPainted && conceptTree.cutouts,
    'concept shade tree must use actual UV-painted 3D bark and alpha foliage');
  assert.ok(conceptTree.roots>=8&&conceptTree.barkPainted,
    'a mature tropical tree needs separate textured exposed roots');
  assert.equal(conceptTree.broadSprays,96,'game must display improved broad painterly foliage');
  assert.ok(conceptTree.broadUV&&conceptTree.broadPainted&&conceptTree.true3D,
    'Work foliage continuation must be UV-painted 3D geometry, never a 2D billboard');
  assert.ok(Math.abs(conceptTree.x+21.8)<.01&&Math.abs(conceptTree.z-10.8)<.01);
  assert.ok(assets.has(prefix+'models/environment/pohon_rimbun_shade.glb'));
  await mkdir('artifacts/creek',{recursive:true});
  await page.waitForFunction(()=>window.__lembahVisualQA.scene
    .getObjectByName('Rumah Masa Kecil / Playable House Garden')?.userData.paintedCreekLoaded);
  assert.ok(assets.has(prefix+'textures/terrain/creek_foam_painterly_restored_v2.png'),
    'the new foam image must actually load in the production browser');
  const foamState=await page.evaluate(()=>{
    const stage=window.__lembahVisualQA.scene.getObjectByName('Rumah Masa Kecil / Playable House Garden');
    const foam=stage.getObjectByName('Illustrated river foam and flow trails');
    const image=foam.material.map?.image;
    const cvs=document.createElement('canvas');
    cvs.width=image?.naturalWidth??image?.width??0;
    cvs.height=image?.naturalHeight??image?.height??0;
    const ctx=cvs.getContext('2d',{willReadFrequently:true});
    if(ctx && cvs.width && cvs.height)ctx.drawImage(image,0,0);
    const rgba=ctx&&cvs.width&&cvs.height?ctx.getImageData(0,0,cvs.width,cvs.height).data:[];
    let maxAlpha=0,strongCount=0;
    for(let i=3;i<rgba.length;i+=4){
      maxAlpha=Math.max(maxAlpha,rgba[i]);
      if(rgba[i]>200)strongCount++;
    }
    return {loaded:stage.userData.paintedFoamLoaded,
      atlas:foam.userData.foamAtlasSource,
      ready:foam.userData.foamAtlasReady.value,
      clock:foam.userData.foamTimeUniform.value,
      imageWidth:cvs.width,imageHeight:cvs.height,
      maxAlpha,strongCount,
      materialOpacity:foam.material.opacity};
  });
  assert.equal(foamState.loaded,true,'the generated decal atlas should be active');
  assert.equal(foamState.ready,1);
  assert.equal(foamState.atlas,'./textures/terrain/creek_foam_painterly_restored_v2.png');
  assert.equal(foamState.imageWidth,480);
  assert.equal(foamState.imageHeight,480);
  assert.ok(foamState.maxAlpha>=240,'foam sprite bright cores must not disappear');
  assert.ok(foamState.strongCount>15000,
    'browser texture must retain bright painted foam, not merely faint outlines');
  assert.ok(foamState.materialOpacity>=.69);
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
  // The reference tree should sit at the right side of the cultivated yard,
  // above-ground and visible in a player-height 3/4 framing.
  await shot(-27.3,11.9,-1.13,'artifacts/creek/04-concept-mature-shade-tree.jpg',1.10,28);
  // Scenery framing from the west bank of the creek (matches the optional
  // ?view=konsep player entrance), while remaining real interactive 3D.
  await shot(-41.8,5.8,-.94,'artifacts/creek/05-riverside-concept-view.jpg',1.12,32);
  // The raised deck should carry a REAL physics capsule, and the render
  // should show feet resting on timber rather than disappearing into it.
  await shot(-45.4,8.6,.85,'artifacts/creek/03-character-standing-on-timber.jpg',1.52,90);
  const bodyY=await page.evaluate(()=>window.__lembahVisualQA.player.translation().y);
  assert.ok(bodyY>1.09&&bodyY<1.30,
    'character must settle at the physical deck level, not at terrain Y=0: '+bodyY);
  assert.ok(assets.has(prefix+'textures/terrain/creek_water_painterly_illustrated.webp'));
  assert.ok(assets.has(prefix+'models/environment/lembah_asri_rocks_original_16.glb'));
  assert.deepEqual(errors,[]);
  console.log('Rendered real 3D concept shade tree and unchanged creek bridge:',JSON.stringify({bridge:facts,tree:conceptTree}));
}finally{
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
