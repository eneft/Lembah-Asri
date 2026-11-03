#!/usr/bin/env node
"use strict";
// Unlike Godot's editor-side smoke tests, open the ACTUAL exported Web
// index.html, *.wasm and *.pck inside a real WebGL2 Chromium runtime.
const fs = require("fs");
const path = require("path");
const {chromium} = require("playwright-core");

const root = "/tmp/lembah-terrain-chromium";
fs.mkdirSync(root,{recursive:true});
const lines=[];
function report(tag, value) {
    const line = "["+tag+"] "+String(value).slice(0,1200);
    lines.push(line);
    console.log(line);
}
let browser;
async function main() {
    const url="http://127.0.0.1:9137/terrain-test/";
    const binary=process.env.CHROME_BIN || "/usr/bin/google-chrome";
    browser=await chromium.launch({
        headless:true,
        executablePath:binary,
        timeout:45000,
        args:[
          "--no-sandbox","--disable-gpu-sandbox",
          "--enable-webgl","--use-gl=angle","--use-angle=swiftshader",
          "--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required",
          "--disable-dev-shm-usage"
        ]
    });
    const context=await browser.newContext({
        viewport:{width:1280,height:720},
        deviceScaleFactor:1,
        ignoreHTTPSErrors:true
    });
    const page=await context.newPage();
    const responses={};
    page.on("pageerror",e=>report("PAGEERROR",e.stack||e.message));
    page.on("console",msg=>{
        const m=msg.text();
        if(msg.type()==="error" || /error|failed|webgl|rendering|godot|out of memory/i.test(m))
            report("CONSOLE "+msg.type(),m);
    });
    page.on("requestfailed",req=>report("REQUESTFAILED",req.url()+" "+(req.failure()?.errorText||"")));
    page.on("response",response=>{
        const u=response.url();
        if(/\/terrain-test\/(index\.(pck|wasm|js)|)$/.test(u)) {
            responses[u.split("/").pop()||"html"]={
                code:response.status(),
                type:response.headers()["content-type"]||"",
                len:response.headers()["content-length"]||""
            };
            report("HTTP",JSON.stringify([u,response.status(),responses[u.split("/").pop()||"html"]]));
        }
        if(response.status()>=400)report("HTTPERROR",u+" "+response.status());
    });
    await page.goto(url,{waitUntil:"domcontentloaded",timeout:45000});
    let last={};
    const start=Date.now();
    while(Date.now()-start<135000) {
        await page.waitForTimeout(1500);
        last=await page.evaluate(()=>{
            const canvas=document.getElementById("canvas");
            const loader=document.getElementById("status");
            const overlay=document.getElementById("la-boot-v78");
            let webgl2=false, webglError="";
            if(typeof WebGL2RenderingContext==="undefined")webglError="No WebGL2RenderingContext in browser";
            else webgl2=true;
            return {
                title:document.title,
                canvas:canvas?{
                    width:canvas.width,height:canvas.height,
                    clientWidth:canvas.clientWidth,clientHeight:canvas.clientHeight,
                    visibility:getComputedStyle(canvas).visibility,
                    display:getComputedStyle(canvas).display
                }:null,
                loader:loader?{display:getComputedStyle(loader).display,text:loader.textContent?.slice(0,140)}:null,
                overlay:overlay?{hidden:overlay.hidden,failed:overlay.classList.contains("la-failed"),text:overlay.textContent?.slice(0,260)}:null,
                webgl2,webglError
            };
        });
        if(last.overlay?.failed){report("LOADER_FAILED",JSON.stringify(last));break;}
        if(last.overlay?.hidden && last.canvas?.width>200) {
            await page.waitForTimeout(5500); // actually draw a few gameplay frames
            report("BOOT_FINISHED",Math.round((Date.now()-start)/1000)+"s");
            break;
        }
        if(Math.floor((Date.now()-start)/1000)%15<2)
            report("WAIT",Math.round((Date.now()-start)/1000)+"s "+JSON.stringify(last).slice(0,350));
    }
    report("STATE",JSON.stringify(last));
    report("RESPONSES",JSON.stringify(responses));
    await page.screenshot({path:path.join(root,"page.png"),timeout:30000});
    const canvas=page.locator("#canvas");
    if(await canvas.count())await canvas.screenshot({path:path.join(root,"canvas.png"),timeout:30000});
    if(!last.webgl2||!last.canvas||last.overlay?.failed||!last.overlay?.hidden)
        throw new Error("Browser game did not reach rendered state: "+JSON.stringify(last));
    for(const asset of ["html","index.pck","index.wasm","index.js"])
        if(!responses[asset] || responses[asset].code!==200)throw new Error("Missing/invalid "+asset+" browser response "+JSON.stringify(responses));
    report("PASS","Godot WebGL2 booted actual exported terrain-test pack in Chromium");
}
main().catch(err=>{
    report("FAIL",err.stack||err);
    process.exitCode=1;
}).finally(async()=>{
    fs.writeFileSync(path.join(root,"console.txt"),lines.join("\n")+"\n");
    if(browser)await browser.close().catch(()=>{});
});