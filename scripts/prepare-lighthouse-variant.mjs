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
