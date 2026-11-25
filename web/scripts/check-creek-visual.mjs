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
      if (!object.isMesh) return;
      meshes++;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      hasUVPaint ||= !!object.geometry.attributes.uv && materials.some(material =>
        material.isMeshBasicMaterial && material.map?.image?.width > 0
      );
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
  assert.ok(facts.meshes>=1&&facts.hasUVPaint,'render the baked bridge atlas on its matte UV material');
  assert.ok(facts.dimensions.x>5.05&&facts.dimensions.x<5.15,'full creek span');
  assert.ok(facts.dimensions.z>2.04&&facts.dimensions.z<2.14,'crossing width matches collider');
  assert.equal(facts.oldPlanks,undefined,'old procedural bridge should be gone');
  assert.ok(assets.has(prefix+'models/environment/bridge_user_reference_wood_v2.glb'));
  assert.equal(facts.submerged,11);
  assert.equal(facts.underwater,4,'four true 3D rocks must be under the transparent water');
  const grounding=await page.evaluate(()=>{
    const scene=window.__lembahVisualQA.scene;
    const rock=scene.getObjectByName('UV mossy rock variant 00');
    const names=['Visible gravel bed below clear creek water','Soft west creek bank','Soft east creek bank',
      'West bank sculpted meadow terrain','East bank sculpted meadow terrain'];
    const triangles=[];
    for(const name of names){
      const o=scene.getObjectByName(name),g=o.geometry,p=g.attributes.position,idx=g.index;
      for(let i=0;i<idx.count;i+=3){
        const v=[0,1,2].map(k=>{
          const j=idx.getX(i+k),q=[p.getX(j),p.getY(j),p.getZ(j)];
          const m=o.matrixWorld.elements;
          return [m[0]*q[0]+m[4]*q[1]+m[8]*q[2]+m[12],m[1]*q[0]+m[5]*q[1]+m[9]*q[2]+m[13],m[2]*q[0]+m[6]*q[1]+m[10]*q[2]+m[14]];
        });
        triangles.push(v);
      }
    }
    const ground=(x,z)=>{
      let best=-Infinity;
      for(const [a,b,c] of triangles){
        if(x<Math.min(a[0],b[0],c[0])-1e-6||x>Math.max(a[0],b[0],c[0])+1e-6||
           z<Math.min(a[2],b[2],c[2])-1e-6||z>Math.max(a[2],b[2],c[2])+1e-6)continue;
        const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
        if(Math.abs(d)<1e-10)continue;
        const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d;
        const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d,w=1-u-v;
        if(Math.min(u,v,w)>=-1e-6)best=Math.max(best,u*a[1]+v*b[1]+w*c[1]);
      }
      return Number.isFinite(best)?best:0;
    };
    const p=rock.geometry.attributes.position,box=rock.geometry.boundingBox,m=rock.instanceMatrix.array;
    const results=[];
    for(let i=0;i<rock.count;i++){
      let embed=-Infinity,top=-Infinity;const o=i*16;
      for(let j=0;j<p.count;j++){
        const x=p.getX(j),y=p.getY(j),z=p.getZ(j);
        const wx=m[o]*x+m[o+4]*y+m[o+8]*z+m[o+12],wy=m[o+1]*x+m[o+5]*y+m[o+9]*z+m[o+13],wz=m[o+2]*x+m[o+6]*y+m[o+10]*z+m[o+14];
        top=Math.max(top,wy);
        if(y<=box.min.y+(box.max.y-box.min.y)*.12+1e-6)embed=Math.max(embed,ground(wx,wz)-wy);
      }
      results.push({embed,top});
    }
    return results;
  });
  assert.equal(grounding.length,20);
  assert.ok(grounding.every(r=>r.embed>=.025&&r.embed<=.085),'no river rock may float above the actual rendered terrain: '+JSON.stringify(grounding));
  assert.ok(grounding.slice(12,16).every(r=>r.top<-.215),'four bed rocks remain submerged');
  assert.ok(grounding.slice(16,20).every(r=>r.top>-.16),'four current breakers remain visible');
  assert.ok(facts.grass>260&&facts.grass<600,'restore the earlier softer riverside density');
  await page.waitForFunction(()=>{
    const shade=window.__lembahVisualQA.scene.getObjectByName('Pohon peneduh halaman');
    return shade?.children.length===1 &&
      shade.children[0].userData.renderStyle==='textured volumetric alpha-cutout GLB';
  },null,{timeout:120000});
  assert.ok(assets.has(prefix+'models/environment/pohon_pekarangan.glb'));
  // The small fruit tree still occupies the original spot beside the well.
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
    'legacy tree overlays must not duplicate the authored shade GLB');
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
  await page.waitForFunction(()=>{
    const scene=window.__lembahVisualQA.scene;
    return ['Island horizon - north sea, east village, south forest, west mountain',
      'Rolling meadow outside playable ground','Middle-distance orchard, forest and coastal palms']
      .every(name=>scene.getObjectByName(name)?.material?.map?.image?.width>0);
  },null,{timeout:120000});
  const vista=await page.evaluate(()=>{
    const scene=window.__lembahVisualQA.scene;
    const horizon=scene.getObjectByName('Island horizon - north sea, east village, south forest, west mountain');
    const meadow=scene.getObjectByName('Rolling meadow outside playable ground');
    const groves=scene.getObjectByName('Middle-distance orchard, forest and coastal palms');
    const p=horizon.geometry.getAttribute('position'), uv=horizon.geometry.getAttribute('uv');
    return {width:horizon.material.map.image.width,height:horizon.material.map.image.height,
      seam:[p.getX(0),p.getY(0),p.getZ(0)].every((v,i)=>v===[p.getX(p.count-7),p.getY(p.count-7),p.getZ(p.count-7)][i]),
      uvClosed:uv.getX(0)===0 && uv.getX(p.count-7)===1,
      meadow:!!meadow.material.map.image,groves:!!groves.material.map.image};
  });
  assert.ok(vista.width>=6000 && vista.height>=178 && vista.seam && vista.uvClosed);
  assert.ok(vista.meadow && vista.groves,'all landscape layers must load in the production browser');
  // Check the actual imported fence, not just the procedural fallback.
  await page.waitForFunction(()=>!!window.__lembahVisualQA.scene.getObjectByName('Home fence — uploaded GLB'),null,{timeout:120000});
  const fence=await page.evaluate(()=>{
    const group=window.__lembahVisualQA.scene.getObjectByName('Home fence — uploaded GLB');
    return group.children.map(run=>{
      const wood=run.getObjectByName('Continuous authored bamboo');
      const vines=run.getObjectByName('Climbing vines — painted 3D');
      const meshes=wood.children;
      let uniform=true;
      for(const mesh of meshes){
        const m=mesh.instanceMatrix.array;
        for(let i=0;i<mesh.count;i++){
          const o=i*16;
          const x=Math.hypot(m[o],m[o+1],m[o+2]);
          const y=Math.hypot(m[o+4],m[o+5],m[o+6]);
          const z=Math.hypot(m[o+8],m[o+9],m[o+10]);
          uniform &&= Math.abs(x-y)<1e-5 && Math.abs(y-z)<1e-5;
        }
      }
      const count=meshes.reduce((n,m)=>n+m.count,0);
      return {uniform,count,depth:run.userData.moduleDepth,length:run.userData.runLength,
        source:run.userData.sourceFile,hasUV:meshes.every(m=>!!m.geometry.getAttribute('uv')),
        hasMap:meshes.every(m=>!!m.material.map?.image),hasBounds:meshes.every(m=>!!m.geometry.boundingBox),
        singleSeam:count===1||(meshes.length===2&&meshes[0].count===1&&meshes[1].geometry.boundingBox.min.x>meshes[0].geometry.boundingBox.min.x),
        leaves:vines.userData.leafCount,clusters:vines.userData.clusters,branches:vines.userData.branches,rootGrass:vines.userData.rootGrass,
        realLeaves:vines.userData.leafCount===0||vines.getObjectByName('Climbing vine leaves')?.count===vines.userData.leafCount};
    });
  });
  assert.equal(fence.length,6);
  assert.ok(fence.every(f=>f.uniform && f.count>0 && f.source==='base_basic_shaded (1).glb' && f.hasUV && f.hasMap && f.hasBounds));
  assert.ok(fence.filter(f=>f.length>=19).every(f=>f.depth>.4),'long fences preserve their original 3D depth');
  assert.ok(fence.every(f=>f.singleSeam),'interior joins must omit duplicated end posts');
  assert.ok(fence.every(f=>f.realLeaves && (f.length<4?f.clusters===0:f.leaves>=f.clusters*31 && f.clusters>0 && f.branches===f.clusters*3 && f.rootGrass===f.clusters*10)),'sparse volumetric climbing leaves on long fence runs');
  assert.ok(assets.has(prefix+'models/environment/home-fence-module.glb'));
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
  // Inspect the actual replacement, not the safe previous-house fallback.
  await page.waitForFunction(()=>{
    const home=window.__lembahVisualQA.scene.getObjectByName('Rumah utama - Rumah Masa Kecil');
    return !!(home && home.getObjectByName('Pintu_engsel'));
  },null,{timeout:120000});
  const importedHouse=await page.evaluate(()=>{
    const home=window.__lembahVisualQA.scene.getObjectByName('Rumah utama - Rumah Masa Kecil');
    let triangles=0,meshes=0,uvMeshes=0,normal=false,baseColor=false,emissive=false,matte=true;
    home.traverse(o=>{
      if(!o.isMesh)return;
      meshes++;
      triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;
      if(o.geometry.getAttribute('uv'))uvMeshes++;
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        normal||=!!m.normalMap;
        baseColor||=!!m.map;
        emissive||=!!m.emissive && m.emissive.getHex()!==0;
        matte&&=m.isMeshStandardMaterial===true && m.roughness===1 && m.metalness===0;
      }
    });
    return {sourceFile:home.userData.sourceFile,colliders:home.userData.authoredColliderCount,
      scale:home.scale.toArray(),triangles,meshes,uvMeshes,normal,baseColor,emissive,matte};
  });
  assert.equal(importedHouse.sourceFile,'Rumah_Masa_Kecil.glb');
  assert.equal(importedHouse.triangles,24990);
  assert.equal(importedHouse.meshes,60);
  assert.equal(importedHouse.colliders,16);
  assert.ok(importedHouse.uvMeshes>0 && importedHouse.normal && importedHouse.baseColor && importedHouse.emissive && importedHouse.matte);
  assert.ok(importedHouse.scale[0]>0 && importedHouse.scale.every(s=>s===importedHouse.scale[0]));
  assert.ok([...assets].some(url=>url.includes('Rumah_Masa_Kecil.glb')));
  const daylight=await page.evaluate(()=>{
    const game=window.__lembahVisualQA;
    const scene=game.scene;
    const hemi=scene.children.find(o=>o.isHemisphereLight);
    const sun=game.sunLight;
    const skyFill=scene.children.find(o=>o.isDirectionalLight&&o!==sun);
    const house=scene.getObjectByName('Rumah utama - Rumah Masa Kecil');
    const material=house?.getObjectByName('Genteng_depan')?.material;
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
      houseStyle:material?.userData?.housePainterlyShader,
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
  assert.equal(daylight.fogNear,64);
  assert.equal(daylight.fogFar,190);
  assert.equal(daylight.housePBR,true);
  assert.equal(daylight.roughness,1);
  assert.equal(daylight.metalness,0);
  assert.equal(daylight.shadowOpacity,.43);
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
  console.log('Starting live mobile controller collision verification after visual captures');
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
    // Visual QA above already exercised the real renderer and captured all
    // requested views. Software WebGL in CI can take seconds per frame; for
    // input-only verification suppress drawing, not the game loop, Rapier
    // steps, input processing, animations or runtime movement guard.
    const render=game.renderer.render;
    game.renderer.render=()=>{};
    try {
      const west=await run(-50,0,1,120,true);
      const east=await run(-41.6,0,-1,120);
      const bridge=await run(-49.4,8.6,1,180);
      return {west,east,bridge};
    } finally {
      game.setTouchMove(0,0);game.setTouchRun(false);
      game.renderer.render=render;
    }
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
