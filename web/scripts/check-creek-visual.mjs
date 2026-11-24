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
      underwater:scene.getObjectByName('Curated original UV textured rock placements')?.userData.fullySubmergedRocks,
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
  assert.equal(facts.submerged,11);
  assert.equal(facts.underwater,4,'four true 3D rocks must be under the transparent water');
  assert.ok(facts.grass>260&&facts.grass<600,'restore the earlier softer riverside density');
  // Restore the real 3.65m orchard GLB from the pre-PR#93 layout,
  // not the temporary fallback. The former 7.5m sentinel must be absent.
  await page.waitForFunction(()=>{
    const tree=window.__lembahVisualQA.scene.getObjectByName('Old fruit tree');
    return tree?.userData?.renderStyle==='textured volumetric alpha-cutout GLB';
  },null,{timeout:120000});
  const orchard=await page.evaluate(()=>{
    const stage=window.__lembahVisualQA.scene
      .getObjectByName('Rumah Masa Kecil / Playable House Garden');
    const tree=stage?.getObjectByName('Old fruit tree');
    let meshCount=0,barkUV=false,leavesUV=false,leafAlpha=false;
    tree?.traverse(object=>{
      if(!object.isMesh)return;
      meshCount++;
      if(object.geometry.getAttribute('uv')){
        barkUV ||= !object.material.alphaTest;
        leavesUV ||= object.material.alphaTest>=.4;
      }
      leafAlpha ||= object.material.alphaTest>=.4;
    });
    return {
      x:tree?.position.x,z:tree?.position.z,
      renderStyle:tree?.userData?.renderStyle,meshCount,barkUV,leavesUV,leafAlpha,
      oldLargeGone:!stage?.getObjectByName('Pohon tua di depan rumah'),
      conceptGone:!stage?.getObjectByName('Concept mature shade tree near the garden'),
      oldRootsGone:!stage?.getObjectByName('Small 3D shade plants among natural buttress roots')
    };
  });
  assert.equal(orchard.x,-40);
  assert.equal(orchard.z,8.3);
  assert.equal(orchard.renderStyle,'textured volumetric alpha-cutout GLB');
  assert.ok(orchard.meshCount>=2 && orchard.barkUV && orchard.leavesUV && orchard.leafAlpha,
    'the old orchard tree is a genuine painted 3D asset');
  assert.ok(orchard.oldLargeGone && orchard.conceptGone && orchard.oldRootsGone,
    'remove every extra large courtyard tree and its groundcover');
  assert.ok(assets.has(prefix+'models/environment/pohon_rimbun_orchard.glb'),
    'the restored orchard GLB is actually loaded, not only the fallback');
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
  const contact=await page.evaluate(()=>{
    const stage=window.__lembahVisualQA.scene.getObjectByName('Rumah Masa Kecil / Playable House Garden');
    const wake=stage?.getObjectByName('Painted foam breaking against mossy river boulders');
    return wake ? {contacts:wake.userData.waterlineContacts,vertices:wake.geometry.attributes.position.count} : null;
  });
  assert.ok(contact&&contact.contacts>=4&&contact.vertices>100,'real rock-water intersections render in the production scene');
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
  const vista=await page.evaluate(()=>{
    const root=window.__lembahVisualQA.scene.getObjectByName('Distant Lembah Asri landscape 360');
    return root?.userData;
  });
  assert.equal(vista?.style,'layered-painterly-javanese-valley-v1');
  assert.equal(vista.trees,460);
  assert.equal(vista.houses,14);
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
  // The replacement house must be the actual uploaded binary, not the
  // safe procedural fallback. Verify PBR maps survived conversion.
  await page.waitForFunction(()=>{
    const home=window.__lembahVisualQA.scene.getObjectByName('Rumah utama - user uploaded PBR');
    return !!(home && home.getObjectByName('model'));
  },null,{timeout:120000});
  const importedHouse=await page.evaluate(()=>{
    const home=window.__lembahVisualQA.scene.getObjectByName('Rumah utama - user uploaded PBR');
    const model=home.getObjectByName('model');
    const m=model.material;
    model.geometry.computeBoundingBox();
    const bounds=model.geometry.boundingBox;
    const scale=home.scale.x;
    const size={
      x:(bounds.max.x-bounds.min.x)*scale,
      y:(bounds.max.y-bounds.min.y)*scale,
      z:(bounds.max.z-bounds.min.z)*scale
    };
    return {
      sourceFile:home.userData.sourceFile,
      triangles:model.geometry.index?.count/3,
      hasUV:!!model.geometry.getAttribute('uv'),
      standardPBR:m.isMeshStandardMaterial===true,
      baseColor:!!m.map,normal:!!m.normalMap,
      rough:!!m.roughnessMap,metal:!!m.metalnessMap,
      box:[size.x,size.y,size.z]
    };
  });
  assert.equal(importedHouse.sourceFile,'base_basic_pbr.glb');
  assert.equal(importedHouse.triangles,100000);
  assert.ok(importedHouse.hasUV && importedHouse.standardPBR
    && importedHouse.baseColor && importedHouse.normal
    && importedHouse.rough && importedHouse.metal,'user PBR materials and UVs remain intact');
  assert.ok(importedHouse.box[0]>7.2 && importedHouse.box[0]<9.7);
  assert.ok(importedHouse.box[1]>5.7 && importedHouse.box[1]<6.1);
  assert.ok(importedHouse.box[2]>8.5 && importedHouse.box[2]<9.7);
  assert.ok([...assets].some(url=>url.includes('rumah_utama_user_pbr.glb')));
  // Stage 5: inspect the actual WebGL scene after the imported 100k-triangle
  // PBR house finishes loading. Do not infer successful rendering from source.
  const daylight=await page.evaluate(()=>{
    const game=window.__lembahVisualQA;
    const scene=game.scene;
    const hemi=scene.children.find(o=>o.isHemisphereLight);
    const sun=game.sunLight;
    const skyFill=scene.children.find(o=>o.isDirectionalLight&&o!==sun);
    const house=scene.getObjectByName('Rumah utama - user uploaded PBR');
    const material=house?.getObjectByName('model')?.material;
    const shadow=scene.getObjectByName('World painted-terrain real shadows');
    return {
      style:scene.userData.painterlyLightingStyle,
      colorSpace:game.renderer.outputColorSpace,
      toneMapping:game.renderer.toneMapping,
      exposure:game.renderer.toneMappingExposure,
      sun:sun?.intensity,hemi:hemi?.intensity,fill:skyFill?.intensity,
      fogNear:scene.fog?.near,fogFar:scene.fog?.far,
      envIntensity:scene.environmentIntensity,
      housePBR:material?.isMeshStandardMaterial===true,
      houseStyle:material?.userData?.painterlyPBR,
      houseMaps:[material?.map,material?.normalMap,
        material?.roughnessMap,material?.metalnessMap].every(Boolean),
      roughness:material?.roughness,metalness:material?.metalness,
      normalScale:material?.normalScale?.x,
      shadowOpacity:shadow?.material?.opacity
    };
  });
  assert.equal(daylight.style,'lembah-painterly-daylight-stage5-v1');
  assert.equal(daylight.sun,1.55);
  assert.equal(daylight.hemi,1.1);
  assert.equal(daylight.fill,.3);
  assert.equal(daylight.exposure,1);
  assert.equal(daylight.envIntensity,.3);
  assert.equal(daylight.fogNear,38);
  assert.equal(daylight.fogFar,115);
  assert.ok(daylight.housePBR&&daylight.houseMaps);
  assert.equal(daylight.houseStyle,daylight.style);
  assert.ok(daylight.roughness>=.82 && daylight.metalness<=.22);
  assert.ok(Math.abs(daylight.normalScale)<=.62);
  assert.equal(daylight.shadowOpacity,.34);
  // Stage 1: compare the actual materials in the production WebGL scene.
  // Every grass source uses one finish; water is never treated as foliage.
  const meadowStyle=await page.evaluate(()=>{
    const scene=window.__lembahVisualQA.scene;
    const names=[
      'World painted grass UV terrain',
      'West bank sculpted meadow terrain',
      'East bank sculpted meadow terrain',
      'Soft west creek bank','Soft east creek bank',
      'Painted childhood courtyard',
      'Shallow stream west of childhood home'
    ];
    return names.map(name=>({
      name,style:scene.getObjectByName(name)?.material?.userData?.warmGrassStyle||null
    }));
  });
  for(const surface of meadowStyle.slice(0,6))
    assert.equal(surface.style,'warm-painterly-grass-stage1-v1',
      'missing shared grass palette: '+surface.name);
  assert.equal(meadowStyle[6].style,null,
    'river water must keep its original painterly material');

  // Capture the cleared front yard and the restored original fruit tree.
  await shot(-35.7,12.1,-1.13,'artifacts/creek/04-restored-front-courtyard.jpg',1.10,28);
  // Scenery framing from the west bank of the creek (matches the optional
  // ?view=konsep player entrance), while remaining real interactive 3D.
  await page.waitForFunction(() => window.__lembahVisualQA.scene.getObjectByName('Sumur beratap genteng')
    && window.__lembahVisualQA.scene.getObjectByName('Old fruit tree'));
  await shot(-41.3,6.65,-1.60,'artifacts/creek/05-riverside-concept-view.jpg',1.12,32);
  // The raised deck should carry a REAL physics capsule, and the render
  // should show feet resting on timber rather than disappearing into it.
  await shot(-45.4,8.6,.85,'artifacts/creek/03-character-standing-on-timber.jpg',1.52,90);
  const bodyY=await page.evaluate(()=>window.__lembahVisualQA.player.translation().y);
  assert.ok(bodyY>1.09&&bodyY<1.30,
    'character must settle at the physical deck level, not at terrain Y=0: '+bodyY);
  // Stage 3: check the published water surface itself, not only a shader
  // unit test. Verify real 3D submerged stones and retained painted art.
  const clearRiver=await page.evaluate(()=>{
    const scene=window.__lembahVisualQA.scene;
    const water=scene.getObjectByName('Shallow stream west of childhood home');
    const foam=scene.getObjectByName('Illustrated river foam and flow trails');
    const rocks=scene.getObjectByName('Curated original UV textured rock placements');
    const bed=scene.getObjectByName('Visible gravel bed below clear creek water');
    return {
      style:water?.material?.userData?.clearWaterStyle,
      opacity:water?.material?.opacity,
      transparent:water?.material?.transparent,
      depthWrite:water?.material?.depthWrite,
      textured:!!water?.material?.map,
      submergedRocks:rocks?.userData?.fullySubmergedRocks,
      bedDepthWrite:bed?.material?.depthWrite,
      foamAtlas:foam?.userData?.foamAtlasSource,
      foamOpacity:foam?.material?.opacity
    };
  });
  assert.equal(clearRiver.style,'clear-turquoise-painterly-stage3-v1');
  assert.ok(clearRiver.opacity>=.77&&clearRiver.opacity<=.81);
  assert.ok(clearRiver.transparent && !clearRiver.depthWrite);
  assert.ok(clearRiver.textured && clearRiver.bedDepthWrite);
  assert.equal(clearRiver.submergedRocks,4);
  assert.equal(clearRiver.foamAtlas,'./textures/terrain/creek_foam_painterly_restored_v2.png');
  assert.ok(clearRiver.foamOpacity>=.69&&clearRiver.foamOpacity<=.71);
  // Stage 4: actual browser scene has breathing space on both banks,
  // only sparse tall sedges around emerged boulders, and warm-grey rock paint.
  const shoreline=await page.evaluate(()=>{
    const scene=window.__lembahVisualQA.scene;
    const group=scene.getObjectByName('Curated creek bank reeds and leafy clumps');
    const rocks=scene.getObjectByName('UV mossy rock variant 00');
    const flowers=group?.getObjectByName('White wildflowers along the grassy creek');
    return {
      style:group?.userData?.shoreStyle,
      low:group?.userData?.lowGrassInstances,
      tall:group?.userData?.tallAccentInstances,
      flowers:flowers?.count,
      plantDraws:group?.children?.length,
      stoneStyle:rocks?.material?.userData?.shoreStoneStyle,
      originalStoneTexture:!!rocks?.material?.map
    };
  });
  assert.equal(shoreline.style,'localized-boulder-sedge-stage4-v1');
  assert.ok(shoreline.low>=75 && shoreline.low>shoreline.tall*10);
  assert.equal(shoreline.tall,7);
  assert.equal(shoreline.flowers,14);
  assert.equal(shoreline.plantDraws,3,'no new draw calls for plant variants');
  assert.equal(shoreline.stoneStyle,'warm-grey-soft-moss-stage4-v1');
  assert.ok(shoreline.originalStoneTexture,'real uploaded UV rock texture remains');
  // Stage 2: the grassy lip, exposed earth and intermittent stone foot must
  // all be live on both 3D banks; never alter the water/foam shaders.
  const bankRestore=await page.evaluate(()=>{
    const scene=window.__lembahVisualQA.scene;
    const west=scene.getObjectByName('Soft west creek bank');
    const east=scene.getObjectByName('Soft east creek bank');
    const water=scene.getObjectByName('Shallow stream west of childhood home');
    const foam=scene.getObjectByName('Illustrated river foam and flow trails');
    const bed=scene.getObjectByName('Visible gravel bed below clear creek water');
    return {west:west?.material?.userData?.bankStoneRestore,
      east:east?.material?.userData?.bankStoneRestore,
      westEcotone:west?.material?.userData?.bankEcotone,
      eastEcotone:east?.material?.userData?.bankEcotone,
      water:water?.material?.userData?.bankStoneRestore,
      foam:foam?.material?.userData?.bankEcotone,
      bed:bed?.material?.userData?.bankEcotone};
  });
  assert.equal(bankRestore.west,'natural-bank-ecotone-stage2-v1');
  assert.equal(bankRestore.east,bankRestore.west);
  assert.equal(bankRestore.westEcotone,'natural-riverbank-stage2-v1');
  assert.equal(bankRestore.eastEcotone,bankRestore.westEcotone);
  assert.equal(bankRestore.water,undefined);
  assert.equal(bankRestore.foam,undefined);
  assert.equal(bankRestore.bed,undefined);
  assert.ok(assets.has(prefix+'textures/terrain/creek_water_painterly_illustrated.webp'));
  assert.ok(assets.has(prefix+'models/environment/lembah_asri_rocks_original_16.glb'));
  // Drive the actual game controller with the same input methods as the mobile
  // joystick. This is not a separately constructed test physics world.
  const motion=await page.evaluate(async()=>{
    const game=window.__lembahVisualQA;
    const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
    async function run(x,z,direction,frames,jump=false){
      game.setTouchMove(0,0);game.setTouchRun(false);
      game.player.setTranslation({x,y:.86,z},true);
      game.player.setLinvel({x:0,y:0,z:0},true);
      game.currentPhysicsPosition.set(x,.86,z);game.previousPhysicsPosition.copy(game.currentPhysicsPosition);
      game.yaw=0;
      for(let i=0;i<15;i++)await frame();
      game.setTouchRun(true);game.setTouchMove(direction,0);
      if(jump)game.triggerJump();
      for(let i=0;i<frames;i++)await frame();
      game.setTouchMove(0,0);game.setTouchRun(false);
      const p=game.player.translation();return {x:p.x,y:p.y,z:p.z};
    }
    const west=await run(-50,0,1,100,true);
    const east=await run(-41.6,0,-1,100);
    const bridge=await run(-49.4,8.6,1,145);
    return {west,east,bridge};
  });
  assert.ok(motion.west.x<-47.1,'live mobile run+jump cannot enter west bank: '+JSON.stringify(motion));
  assert.ok(motion.east.x>-43.7,'live mobile run cannot enter east bank: '+JSON.stringify(motion));
  assert.ok(motion.bridge.x>-42.8,'live controller must still cross the real bridge: '+JSON.stringify(motion));
  console.log('Live bridge-only creek collision verified',JSON.stringify(motion));
  assert.deepEqual(errors,[]);
  console.log('Rendered restored pre-PR93 orchard and unchanged creek bridge:',JSON.stringify({bridge:facts,tree:orchard}));
}finally{
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
