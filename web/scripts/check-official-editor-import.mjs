// Exercise the real upstream Editor, Menubar.File and ObjectLoader, then
// render the imported project in upstream WebGL. No mock importer.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root=path.resolve('.editor-upstream');
const fixture=`<!doctype html><html><body>
<script type="importmap">{"imports":{"three":"/build/three.module.js","three/addons/":"/examples/jsm/","three/examples/":"/examples/"}}</script>
<script src="/editor/js/libs/signals.min.js"></script>
<script type="module">
import * as THREE from 'three';
import { Editor } from '/editor/js/Editor.js';
import { EditorControls } from '/editor/js/EditorControls.js';
import { MenubarFile } from '/editor/js/Menubar.File.js';
const editor=new Editor();
editor.controls=new EditorControls(editor.camera);
document.body.appendChild(MenubarFile(editor).dom);
window.editor=editor;
window.THREE=THREE;
</script></body></html>`;
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/test.html'){res.writeHead(200,{'Content-Type':'text/html'}).end(fixture);return;}
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{
    const {size}=await stat(file);
    res.writeHead(200,{'Content-Length':size,'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'application/octet-stream'});
    createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/Shader Error|VALIDATE_STATUS|WebGLProgram/.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/test.html');
  await page.waitForFunction(()=>!!window.editor);
  // The real File/Open menu's input and change handler invokes editor.fromJSON.
  await page.locator('input[type=file][accept=".json"]').setInputFiles(path.resolve('artifacts/world/Lembah-Asri-World-Editor.json'));
  await page.waitForFunction(()=>window.editor.scene.getObjectByName('Rumah utama - user uploaded PBR') && window.editor.scene.getObjectByName('Island horizon - north sea, east village, south forest, west mountain'),null,{timeout:180000});
  const facts=await page.evaluate(()=>{
    const {editor,THREE}=window;
    const house=editor.scene.getObjectByName('Rumah utama - user uploaded PBR');
    const terrain=editor.scene.getObjectByName('World painted grass UV terrain');
    const creek=editor.scene.getObjectByName('Shallow stream west of childhood home');
    editor.scene.updateMatrixWorld(true);
    editor.camera.updateMatrixWorld(true);
    const center=new THREE.Box3().setFromObject(house).getCenter(new THREE.Vector3());
    const screen=center.project(editor.camera);
    let meshes=0;editor.scene.traverse(o=>{if(o.isMesh)meshes++;});
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(900,560);
    document.body.appendChild(renderer.domElement);
    renderer.render(editor.scene,editor.camera);
    const gl=renderer.getContext(), pixels=new Uint8Array(900*560*4);
    gl.readPixels(0,0,900,560,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const colors=new Set();
    for(let i=0;i<pixels.length;i+=64)colors.add((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);
    return {meshes,terrain:!!terrain,creek:!!creek,
      houseMap:!!house.getObjectByName('model')?.material?.map?.image,
      houseOnScreen:Math.abs(screen.x)<1&&Math.abs(screen.y)<1&&Math.abs(screen.z)<1,
      colors:colors.size,triangles:renderer.info.render.triangles};
  });
  assert.ok(facts.meshes>30 && facts.terrain && facts.creek && facts.houseMap,JSON.stringify(facts));
  assert.ok(facts.houseOnScreen && facts.colors>100 && facts.triangles>10000,JSON.stringify(facts));
  await mkdir('artifacts/world',{recursive:true});
  await page.locator('canvas').last().screenshot({path:'artifacts/world/editor-import.jpg',type:'jpeg',quality:90});
  assert.deepEqual(errors,[]);
  console.log('Actual upstream editor File/Open and WebGL render verified',JSON.stringify(facts));
}finally{
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
