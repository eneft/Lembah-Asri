/* Browser render smoke test for the actual exported /terrain-test/ Godot Web scene.
   Saves request failures, console errors, loader state and screenshot. */
const {chromium}=require("playwright");
const {PNG}=require("pngjs");
const fs=require("node:fs");
const path=require("node:path");
const out=process.env.AUDIT_DIR||process.cwd();
const url=process.env.AUDIT_URL||"http://127.0.0.1:8767/terrain-test/";
let browser;
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const report={url,requests:[],failures:[],errors:[],snapshots:[]};
  const begin=Date.now();
  try{
    const launch={headless:true,args:["--no-sandbox","--disable-dev-shm-usage",
      "--enable-webgl","--ignore-gpu-blocklist","--use-gl=angle",
      "--use-angle=swiftshader","--enable-unsafe-swiftshader"]};
    if(process.env.CHROME_PATH)launch.executablePath=process.env.CHROME_PATH;
    browser=await chromium.launch(launch);
    const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
    const page=await ctx.newPage();
    page.on("pageerror",err=>report.errors.push(String(err.message).slice(0,300)));
    page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text().slice(0,300))});
    page.on("requestfailed",req=>report.failures.push({url:req.url().slice(-100),error:req.failure()?.errorText}));
    page.on("response",resp=>{if(/\.(pck|wasm|js)(\?|$)/.test(resp.url())){
      report.requests.push({file:resp.url().slice(-100),status:resp.status(),
        type:resp.headers()["content-type"]});
    }});
    await page.goto(url,{waitUntil:"domcontentloaded",timeout:50000});
    for(let i=0;i<20;i++){
      await page.waitForTimeout(5000);
      const state=await page.evaluate(()=>{
        const c=document.querySelector("#canvas"),box=document.querySelector("#la-boot-v78");
        const status=document.querySelector("#status");
        return {ready:window.__lembahTerrainReadyV78===true,
          canvas:c?{w:c.width,h:c.height,display:getComputedStyle(c).display}:null,
          loader:box?{hidden:box.hidden,txt:box.textContent.slice(0,270)}:null,
          status:status?{display:getComputedStyle(status).display,txt:status.textContent.slice(0,120)}:null,
          webgl2:typeof WebGL2RenderingContext==="function"};
      });
      report.snapshots.push({afterSeconds:Math.round((Date.now()-begin)/1000),state});
      if(state.ready){await page.waitForTimeout(2500);break}
      if(state.loader && /gagal|terputus|tidak berhasil/i.test(state.loader.txt))break;
    }
    const canvas=page.locator("#canvas");
    const rect=await canvas.boundingBox();
    if(rect&&rect.width>=50&&rect.height>=50){
      const buffer=await canvas.screenshot({path:path.join(out,"terrain-canvas.png"),timeout:20000});
      const pic=PNG.sync.read(buffer);
      const colors=new Set(),middleColors=new Set(),middleLuma=[];
      let black=0,count=0;
      for(let y=0;y<pic.height;y+=Math.max(1,Math.ceil(pic.height/44))){
        for(let x=0;x<pic.width;x+=Math.max(1,Math.ceil(pic.width/68))){
          const i=(y*pic.width+x)*4;
          const rgb=[pic.data[i],pic.data[i+1],pic.data[i+2]];
          const key=rgb.map(v=>Math.round(v/8)).join(".");
          colors.add(key);
          if(rgb[0]+rgb[1]+rgb[2]<45)black++;
          count++;
          // Only inspect unobstructed world view: no HUD text, virtual
          // joysticks or HTML boot panel. The earlier test counted colored
          // UI pixels as "3D scene visible" even when ONLY sky was shown.
          if(x>pic.width*0.23 && x<pic.width*0.77 &&
             y>pic.height*0.25 && y<pic.height*0.68){
            middleColors.add(key);
            middleLuma.push((rgb[0]+rgb[1]+rgb[2])/3);
          }
        }
      }
      const mean=middleLuma.reduce((a,b)=>a+b,0)/Math.max(1,middleLuma.length);
      const variance=middleLuma.reduce((a,b)=>a+(b-mean)*(b-mean),0)/Math.max(1,middleLuma.length);
      report.pixels={variety:colors.size,blackFraction:Number((black/count).toFixed(3)),
        worldVariety:middleColors.size,worldLumaStd:Number(Math.sqrt(variance).toFixed(2))};
    }
  }catch(e){report.fatal=String(e.stack||e).slice(-1200)}
  finally{if(browser)await browser.close()}
  fs.writeFileSync(path.join(out,"terrain-browser-report.json"),JSON.stringify(report,null,2)+"\n");
  const last=report.snapshots.length?report.snapshots[report.snapshots.length-1].state:null;
  const visible=!!(report.pixels&&report.pixels.variety>=30&&report.pixels.blackFraction<0.97&&
    report.pixels.worldVariety>=32&&report.pixels.worldLumaStd>=7.0);
  const ready=!!(last&&last.ready);
  // A real scene behind a permanently visible loading panel is still a
  // broken Web experience. Test both actual pixels AND loader dismissal.
  const loaderHidden=!!(last&&last.loader&&last.loader.hidden);
  const ok=ready&&visible&&loaderHidden&&!report.fatal&&!report.failures.length&&
    report.requests.every(r=>r.status<400);
  console.log("V7.8 BROWSER RENDER:",JSON.stringify({ready,visible,loaderHidden,ok,pixels:report.pixels,
    secs:Math.round((Date.now()-begin)/1000),state:last,
    requests:report.requests,failures:report.failures.slice(0,5),
    errors:report.errors.slice(0,8),fatal:report.fatal}));
  if(!ok)process.exitCode=1;
}
main().catch(err=>{console.error("V7.8 BROWSER FATAL",err);process.exitCode=1});
