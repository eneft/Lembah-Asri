const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const fs = require('node:fs');
fs.mkdirSync('browser-evidence', { recursive: true });
const base = 'https://eneft.github.io/Lembah-Asri/';
const trials = [
  { name: 'published-main-desktop', url: base, viewport: {width: 1280, height: 720} },
  { name: 'published-main-mobile', url: base, viewport: {width: 390, height: 844}, isMobile: true },
  { name: 'published-run8-desktop', url: base + 'run8/', viewport: {width: 1280, height: 720} }
];
const out = [];
const browser = await chromium.launch({headless:true, executablePath:'/usr/bin/google-chrome', args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
function sample(buf) {
 const p=PNG.sync.read(buf);
 const uniq=new Set(); let visible=0;
 for(let y=Math.round(p.height*0.18);y<p.height*0.82;y+=9){
  for(let x=Math.round(p.width*0.14);x<p.width*0.86;x+=9){
    const i=(y*p.width+x)*4,r=p.data[i],g=p.data[i+1],b=p.data[i+2];
    uniq.add((r>>4)*256+(g>>4)*16+(b>>4));
    if(Math.max(r,g,b)>55) visible++;
  }
 }
 return {uniqueQuantizedColors:uniq.size, nonDarkSampleCount:visible, imageWidth:p.width, imageHeight:p.height};
}
for (const t of trials) {
 const ctx=await browser.newContext({viewport:t.viewport,isMobile:!!t.isMobile,hasTouch:!!t.isMobile,deviceScaleFactor:1,ignoreHTTPSErrors:false});
 const page=await ctx.newPage();
 const errors=[],failedRequests=[];
 page.on('pageerror', e=>errors.push(String(e).slice(0,300)));
 page.on('console', m=>{if(m.type()==='error')errors.push(m.text().slice(0,300))});
 page.on('requestfailed',r=>failedRequests.push({url:r.url().slice(0,150),reason:r.failure()?.errorText}));
 const res={name:t.name,url:t.url,viewport:t.viewport,httpStatus:null,canvas:null,screenshot:null,frameAfterInput:null,error:null,errors,failedRequests};
 try {
  const nav=await page.goto(t.url,{waitUntil:'domcontentloaded',timeout:45000});
  res.httpStatus=nav?.status();
  await page.waitForSelector('canvas', {state:'attached',timeout:60000});
  await page.waitForTimeout(20000);
  res.canvas=await page.evaluate(()=>{const c=document.querySelector('canvas');const r=c.getBoundingClientRect(); return {width:c.width,height:c.height,cssWidth:Math.round(r.width),cssHeight:Math.round(r.height),visible:getComputedStyle(c).display!=='none'}});
  const before=await page.screenshot({path:'browser-evidence/'+t.name+'.png',timeout:20000});
  res.screenshot=sample(before);
  if(!t.isMobile){
   await page.locator('canvas').click({position:{x:Math.max(3,Math.floor(res.canvas.cssWidth/2)),y:Math.max(3,Math.floor(res.canvas.cssHeight/2))},timeout:20000}).catch(()=>{});
   await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1600); await page.keyboard.up('ArrowRight');
   res.frameAfterInput=sample(await page.screenshot({path:'browser-evidence/'+t.name+'-after-right.png'}));
  }
  res.passedHttpAndCanvas=res.httpStatus===200 && res.canvas.width>0 && res.canvas.height>0 && res.canvas.cssWidth>0 && res.canvas.cssHeight>0 && res.screenshot.uniqueQuantizedColors>25;
 } catch (e) {res.error=String(e).slice(0,1000);res.passedHttpAndCanvas=false;try{await page.screenshot({path:'browser-evidence/'+t.name+'-error.png',timeout:5000})}catch{}}
 out.push(res); console.log('BROWSER CHECK',JSON.stringify(res));
 await ctx.close();
}
await browser.close();
fs.writeFileSync('browser-evidence/report.json',JSON.stringify(out,null,2));
console.log('BROWSER SUMMARY '+JSON.stringify(out.map(x=>({name:x.name,passed:x.passedHttpAndCanvas,errors:x.errors.length,requestsFailed:x.failedRequests.length}))));
if(out.some(x=>!x.passedHttpAndCanvas))process.exitCode=1;
