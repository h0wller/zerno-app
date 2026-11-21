#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,v]=a.replace(/^--/,'').split('=');return [k,v??'1'];}));
const {url,label}=args, runs=Number(args.runs||5), delays=(args.delays||'0,3000').split(',').map(Number), brands=(args.brands||'coffee,delivery').split(','), out=path.resolve(args.out||'splash-results');
if(!url||!label||delays.some(x=>![0,3000].includes(x))||brands.some(x=>!['coffee','delivery'].includes(x))) throw Error('invalid splash-series arguments');
const apiPaths=new Set(['/api/menu','/api/dmenu']), throughput=1638.4*1024/8;
async function runOnce(browser,brand,delayMs,run){
 const context=await browser.newContext({viewport:{width:360,height:800},deviceScaleFactor:1.75,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const row={label,brand,delayMs,run,requests:[],console:[]}, byId=new Map(); let target=null, clickAt=null;
 try{
  await context.addInitScript(()=>{try{localStorage.setItem('zt_inst_hide','1');}catch{}});
  const page=await context.newPage();
  page.on('console',m=>{if(['error','warning'].includes(m.type()))row.console.push({type:m.type(),text:m.text()});});
  page.on('pageerror',e=>row.console.push({type:'pageerror',text:e.message}));
  page.on('response',async r=>{if(new URL(r.url()).pathname!==(brand==='delivery'?'/api/dmenu':'/api/menu')||!r.ok())return;try{const p=await r.json(),cat=brand==='delivery'?'pizza':'coffee',first=p.items?.find(x=>x?.on&&x.img&&x.cat===cat);if(first?.img)target=new URL(first.img,url).href;row.apiItemsCount=p.items?.length??null;}catch(e){row.console.push({type:'api-json-error',text:e.message});}});
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:throughput,uploadThroughput:throughput});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  cdp.on('Network.requestWillBeSent',e=>{const pathname=new URL(e.request.url).pathname;if(!apiPaths.has(pathname)&&!pathname.startsWith('/media/dishes/'))return;const x={requestId:e.requestId,pathname,url:e.request.url,startedAt:Date.now(),finishedAt:null,encodedDataLength:0,failed:false};byId.set(e.requestId,x);row.requests.push(x);});
  cdp.on('Network.loadingFinished',e=>{const x=byId.get(e.requestId);if(x){x.finishedAt=Date.now();x.encodedDataLength=e.encodedDataLength||0;}});
  cdp.on('Network.loadingFailed',e=>{const x=byId.get(e.requestId);if(x){x.finishedAt=Date.now();x.failed=true;x.errorText=e.errorText;}});
  await page.goto(url+'/',{waitUntil:'load',timeout:90000});
  const choice=page.locator('#brandSplashStatic [data-go="'+brand+'"], #brandSplash [data-go="'+brand+'"]').first();
  await choice.waitFor({state:'visible',timeout:60000});if(delayMs)await page.waitForTimeout(delayMs);
  clickAt=Date.now();row.clickAt=clickAt;await choice.click();
  const deadline=Date.now()+25000;let cardAt=null;
  while(Date.now()<deadline&&cardAt===null){
   if(target){const found=await page.evaluate(({brandName,targetUrl})=>{const grid=document.querySelector(brandName==='delivery'?'#deliveryGrid':'#grid');return !!grid&&[...grid.querySelectorAll('.card:not(.skeleton-card) .media img')].some(i=>{if(!i.currentSrc||!i.complete||i.naturalWidth<=0||!i.getClientRects().length)return false;try{return new URL(i.currentSrc).href===targetUrl;}catch{return false;}});},{brandName:brand,targetUrl:target});if(found)cardAt=Date.now();}
   if(cardAt===null)await page.waitForTimeout(50);
  }
  row.clickToCardMs=cardAt===null?null:cardAt-clickAt;row.firstCatalogItemUrl=target;
  const before=row.requests.filter(x=>x.startedAt<clickAt),after=row.requests.filter(x=>x.startedAt>=clickAt);
  row.bytesBeforeClick=before.filter(x=>x.finishedAt!==null&&x.finishedAt<=clickAt).reduce((s,x)=>s+x.encodedDataLength,0);
  row.requestsBeforeClick=before.length;row.requestsAfterClick=after.length;
  row.apiRequestsBeforeClick=before.filter(x=>apiPaths.has(x.pathname)).length;row.apiRequestsAfterClick=after.filter(x=>apiPaths.has(x.pathname)).length;
  row.dishRequestsBeforeClick=before.filter(x=>x.pathname.startsWith('/media/dishes/')).length;row.dishRequestsAfterClick=after.filter(x=>x.pathname.startsWith('/media/dishes/')).length;
  row.failedRuns=cardAt===null?1:0;
  if(row.failedRuns){const prefix='failure-'+label+'-'+brand+'-delay'+delayMs+'-run'+run;await page.screenshot({path:path.join(out,prefix+'.png'),fullPage:true}).catch(e=>row.screenshotError=e.message);row.timeoutConsole=row.console;row.requestsAfterClickDetails=after;fs.writeFileSync(path.join(out,prefix+'.json'),JSON.stringify(row,null,2));}
  return row;
 }catch(e){row.error=e.message;row.failedRuns=1;fs.writeFileSync(path.join(out,'error-'+label+'-'+brand+'-delay'+delayMs+'-run'+run+'.json'),JSON.stringify(row,null,2));throw e;}
 finally{await context.close();}
}
function stats(v){const n=v.filter(x=>typeof x==='number').sort((a,b)=>a-b);if(!n.length)return null;const m=Math.floor(n.length/2);return{median:n.length%2?n[m]:(n[m-1]+n[m])/2,min:n[0],max:n.at(-1),n:n.length};}
fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({args:['--no-sandbox']}),records=[];
try{for(const delay of delays)for(const brand of brands)for(let run=1;run<=runs;run++)records.push(await runOnce(browser,brand,delay,run));}finally{await browser.close();}
const summary=delays.flatMap(delay=>brands.map(brand=>{const rows=records.filter(x=>x.delayMs===delay&&x.brand===brand);return{label,brand,delayMs:delay,runs:rows.length,clickToCardMs:stats(rows.map(x=>x.clickToCardMs)),bytesBeforeClick:stats(rows.map(x=>x.bytesBeforeClick)),requestsBeforeClick:stats(rows.map(x=>x.requestsBeforeClick)),requestsAfterClick:stats(rows.map(x=>x.requestsAfterClick)),apiRequestsBeforeClick:stats(rows.map(x=>x.apiRequestsBeforeClick)),apiRequestsAfterClick:stats(rows.map(x=>x.apiRequestsAfterClick)),dishRequestsBeforeClick:stats(rows.map(x=>x.dishRequestsBeforeClick)),dishRequestsAfterClick:stats(rows.map(x=>x.dishRequestsAfterClick)),failedRuns:rows.reduce((s,x)=>s+(x.failedRuns||0),0)};}));
fs.writeFileSync(path.join(out,'splash-'+label+'.json'),JSON.stringify({label,records,summary},null,2));process.stdout.write(JSON.stringify(summary,null,2)+'\\n');
