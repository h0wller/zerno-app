#!/usr/bin/env node
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto'; import {execFileSync} from 'node:child_process';
const [variant,projectArg,reportArg]=process.argv.slice(2),root=process.cwd();
const config=JSON.parse(fs.readFileSync(path.join(root,'scripts/lighthouse-variants.json'),'utf8'));
const project=path.resolve(projectArg||''),report=path.resolve(reportArg||''),base=config.baseSha,head=config.headSha;
if(!/^[a-f0-9]{40}$/.test(base)||!/^[a-f0-9]{40}$/.test(head))throw Error('Pinned baseSha/headSha must be 40-character SHAs');
if(!config.variants.includes(variant))throw Error('Unknown variant '+variant);
if(!fs.existsSync(project)||!fs.existsSync(report))throw Error('Worktree/report directory missing');
const git=(args,opts={})=>execFileSync('git',args,{cwd:project,encoding:'utf8',stdio:['ignore','pipe','pipe'],...opts}).trim();
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const show=(sha,file)=>execFileSync('git',['show',sha+':'+file],{cwd:root,encoding:'utf8'});
const changed=()=>git(['diff','--name-only',head,'--']).split('\n').filter(Boolean).sort(),hashes={};
function block(html,marker,label){const count=html.split(marker).length-1;if(count!==1)throw Error(label+': expected exactly one '+marker+' marker, found '+count);const start=html.indexOf(marker),close=html.indexOf('</script>',start);if(close<0)throw Error(label+': closing </script> not found after '+marker);return{text:html.slice(start,close+9),start,end:close+9};}
function patchIndex(id,marker){
 const file='public/index.html',b=show(base,file),h=show(head,file),bb=block(b,marker,'base '+id),hb=block(h,marker,'head '+id);
 const desired=h.slice(0,hb.start)+bb.text+h.slice(hb.end);if(desired===h)throw Error(variant+': '+id+' generated empty patch');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lcp-patch-'));
 try{
  fs.mkdirSync(path.join(tmp,'a/public'),{recursive:true});fs.mkdirSync(path.join(tmp,'b/public'),{recursive:true});
  fs.writeFileSync(path.join(tmp,'a',file),h);fs.writeFileSync(path.join(tmp,'b',file),desired);
  let patch;try{patch=execFileSync('git',['diff','--no-index','--no-ext-diff','--','a/'+file,'b/'+file],{cwd:tmp,encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch(e){if(e.status!==1)throw e;patch=e.stdout;}
  patch=patch.replaceAll('a/a/public/index.html','a/public/index.html').replaceAll('b/b/public/index.html','b/public/index.html');
  const pf=path.join(tmp,id+'.patch');fs.writeFileSync(pf,patch);
  try{execFileSync('git',['apply','--check',pf],{cwd:project,stdio:'pipe'});}catch(e){throw Error(variant+' '+id+': git apply --check failed: '+String(e.stderr||e.message),{cause:e});}
  execFileSync('git',['apply',pf],{cwd:project,stdio:'pipe'});
  const applied=block(fs.readFileSync(path.join(project,file),'utf8'),marker,variant+' applied '+id);
  if(applied.text!==bb.text)throw Error(variant+' '+id+': applied block differs from pinned base');
  const diff=execFileSync('git',['diff','--',file],{cwd:project,encoding:'utf8'});if(!diff.trim())throw Error(variant+' '+id+': index.html diff is empty after patch');
  hashes[id]={base:hash(bb.text),head:hash(hb.text),applied:hash(applied.text)};
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
const expected=variant==='F'?base:head,actual=git(['rev-parse','HEAD']);if(actual!==expected)throw Error(variant+': expected worktree at '+expected+', got '+actual);
if(variant==='B'){
 const pf=path.join(root,'scripts/perf-variants/B.patch');
 try{execFileSync('git',['apply','--check',pf],{cwd:project,stdio:'pipe'});}catch(e){throw Error('B: B.patch failed git apply --check: '+String(e.stderr||e.message),{cause:e});}
 execFileSync('git',['apply',pf],{cwd:project,stdio:'pipe'});
 const f='public/app/core/boot.js',content=fs.readFileSync(path.join(project,f),'utf8');
 if(!content.includes('await loadMenu();')||content.includes('await loadMenu({ render: false });'))throw Error('B: patch did not change only the intended boot.js call');
 hashes[f+'#loadInitialCatalog']=hash(content.slice(content.indexOf('async function loadInitialCatalog'),content.indexOf('\nasync function boot')));
}else if(variant==='C')patchIndex('zt-lcp-head','<script id="zt-lcp-head">');
else if(/^C[1-5]$/.test(variant)){
 const file='public/index.html',html=fs.readFileSync(path.join(project,file),'utf8');
 const marker='<script id="zt-lcp-head">',current=block(html,marker,variant+' head').text;
 const baseHtml=show(base,file),baseBlock=block(baseHtml,marker,'base '+variant).text;
 let desired=current;
 if(variant==='C1') desired=baseBlock;
 if(variant==='C2'){
  const start=desired.indexOf("              var preload = document.createElement('link');");
  const end=desired.indexOf("              if (brand === 'delivery') {",start);
  if(start<0||end<0) throw Error('C2: preload creation block markers not found');
  desired=desired.slice(0,start)+desired.slice(end);
 }
 if(variant==='C3'){
  const from="return response.clone().json().then(function (payload) {";
  const to="var streams = response.body.tee();\n          var appResponse = new Response(streams[0], { status: response.status, statusText: response.statusText, headers: response.headers });\n          return new Response(streams[1]).json().then(function (payload) {";
  if(!desired.includes(from)) throw Error('C3: clone JSON marker not found');
  desired=desired.replace(from,to).replace("            return response;\n          }, function () {\n            return response;\n          });","            return appResponse;\n          }, function () {\n            return appResponse;\n          });");
 }
 if(variant==='C4'){
  desired=desired.replace("      var pending = null;","      var pending = null;\n      var splashWasPending = window.__brandSplashPending === true;");
  desired=desired.replace("          return response.clone().json().then(function (payload) {","          if (!splashWasPending) return response;\n          return response.clone().json().then(function (payload) {");
 }
 if(variant==='C5'){
  const from="        }).then(function (response) {\n          if (!response || !response.ok) return response;\n          return response.clone().json().then(function (payload) {";
  const to="        });\n        if (brand === 'delivery') {\n          promise.then(function (response) {\n            if (!response || !response.ok) return;\n            response.clone().json().then(function (payload) {";
  if(!desired.includes(from)) throw Error('C5: response clone chain start not found');
  desired=desired.replace(from,to);
  desired=desired.replace("            return response;\n          }, function () {\n            return response;\n          });\n        });","            }).catch(function () {});\n          }).catch(function () {});\n        }");
 }
 if(desired===current) throw Error(variant+': generated block unchanged');
 const html2=html.replace(current,desired);
 const temp=path.join(report,'variant-'+variant+'.html');fs.writeFileSync(temp,html2);
 const patchFile=path.join(report,variant+'.patch');
 // Generate a canonical patch from the current file to the transformed file.
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lcp-'+variant+'-'));
 try{
  fs.mkdirSync(path.join(tmp,'a/public'),{recursive:true});fs.mkdirSync(path.join(tmp,'b/public'),{recursive:true});
  fs.writeFileSync(path.join(tmp,'a',file),html);fs.writeFileSync(path.join(tmp,'b',file),html2);
  try{patch=execFileSync('git',['diff','--no-index','--no-ext-diff','--','a/'+file,'b/'+file],{cwd:tmp,encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch(e){if(e.status!==1)throw e;patch=e.stdout;}
  patch=patch.replaceAll('a/a/public/index.html','a/public/index.html').replaceAll('b/b/public/index.html','b/public/index.html');
  fs.writeFileSync(patchFile,patch);
  execFileSync('git',['apply','--check',patchFile],{cwd:project,stdio:'pipe'});
  execFileSync('git',['apply',patchFile],{cwd:project,stdio:'pipe'});
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 const applied=block(fs.readFileSync(path.join(project,file),'utf8'),marker,variant+' applied').text;
 if(applied!==desired) throw Error(variant+': applied block mismatch');
 hashes[variant]={head:hash(current),applied:hash(applied),base:hash(baseBlock)};
}
else if(variant==='D')patchIndex('zt-early-brand-guard','<script id="zt-early-brand-guard">');
else if(variant==='E'){
 execFileSync('git',['checkout',base,'--','public/app/core/state.js','public/app/core/splash.js'],{cwd:project,stdio:'pipe'});
 for(const f of ['public/app/core/state.js','public/app/core/splash.js'])hashes[f]=hash(fs.readFileSync(path.join(project,f)));
}else if(variant==='F'){if(git(['status','--porcelain','--untracked-files=no']))throw Error('F: base control worktree is not clean');}
else if(variant!=='A')throw Error('Unhandled variant '+variant);
const files=changed();if(variant==='A'&&files.length)throw Error('A: expected no changes from pinned head, found '+files.join(', '));
const absentAtBaseFiles=[];
if(variant==='F')for(const f of files){const target=path.join(project,f);if(fs.existsSync(target))hashes[f]=hash(fs.readFileSync(target));else{hashes[f]=hash('ABSENT_AT_BASE');absentAtBaseFiles.push(f);}}
if(!['A','F'].includes(variant)&&!files.length)throw Error(variant+': expected non-empty source diff against pinned head');
const manifest={variant,baseSha:base,headSha:head,worktreeCommit:actual,changedFiles:files,changedBlockSha256:hashes,absentAtBaseFiles,contract:config.variantContracts[variant]};
fs.writeFileSync(path.join(report,'manifest-'+variant+'.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
