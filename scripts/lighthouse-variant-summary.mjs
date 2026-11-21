#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve(process.argv[2]||'lighthouse-reports');
const config=JSON.parse(fs.readFileSync(path.join(process.cwd(),'scripts/lighthouse-variants.json'),'utf8'));
const variants=config.variants, brands=['coffee','delivery'];
const readers={LCP:r=>r.audits?.['largest-contentful-paint']?.numericValue,FCP:r=>r.audits?.['first-contentful-paint']?.numericValue,SI:r=>r.audits?.['speed-index']?.numericValue,TBT:r=>r.audits?.['total-blocking-time']?.numericValue,CLS:r=>r.audits?.['cumulative-layout-shift']?.numericValue};
const parts=['timeToFirstByte','resourceLoadDelay','resourceLoadDuration','elementRenderDelay'];
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function stats(values){const a=values.filter(finite).sort((x,y)=>x-y);if(!a.length)return{min:null,median:null,max:null,count:0};const m=Math.floor(a.length/2);return{min:a[0],median:a.length%2?a[m]:(a[m-1]+a[m])/2,max:a[a.length-1],count:a.length};}
function breakdown(r){const items=r.audits?.['lcp-breakdown-insight']?.details?.items||[],t=items.find(x=>x.type==='table');if(!t?.items)return null;const o={};for(const k of parts){const x=t.items.find(y=>y.subpart===k);o[k]=finite(x?.duration)?x.duration:null;}o.total=parts.every(k=>finite(o[k]))?parts.reduce((s,k)=>s+o[k],0):null;return o;}
const files=fs.readdirSync(dir).filter(f=>/^[A-F]-(coffee|delivery)-(simulate|devtools)-\d+\.json$/.test(f)).sort();
const records=files.map(file=>{const r=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8')),m=file.match(/^([A-F])-(coffee|delivery)-(simulate|devtools)-(\d+)\.json$/);const row={file,variant:m[1],brand:m[2],mode:m[3],sample:Number(m[4]),lighthouseVersion:r.lighthouseVersion||null,observedLcpMs:r.audits?.metrics?.details?.items?.[0]?.observedLargestContentfulPaint??null,observedBreakdownMs:breakdown(r),metrics:{}};for(const [k,read]of Object.entries(readers)){row.metrics[k]=read(r)??null;if(!finite(row.metrics[k]))throw Error(file+': missing '+k);}if(!row.observedBreakdownMs||parts.some(k=>!finite(row.observedBreakdownMs[k])))throw Error(file+': missing observed LCP breakdown');return row;});
const summaries=[];
for(const v of variants)for(const b of brands){const rows=records.filter(r=>r.variant===v&&r.brand===b&&r.mode==='simulate');if(rows.length!==config.runs)throw Error(v+'/'+b+': expected '+config.runs+' simulate runs, got '+rows.length);const s={variant:v,brand:b,runs:rows.length,metrics:{},observedLcpMs:stats(rows.map(r=>r.observedLcpMs)),observedBreakdownMs:{}};for(const k of Object.keys(readers))s.metrics[k]=stats(rows.map(r=>r.metrics[k]));for(const k of [...parts,'total'])s.observedBreakdownMs[k]=stats(rows.map(r=>r.observedBreakdownMs[k]));summaries.push(s);}
for(const v of config.devtoolsVariants)for(const b of brands){const rows=records.filter(r=>r.variant===v&&r.brand===b&&r.mode==='devtools');if(rows.length!==5)throw Error(v+'/'+b+': expected five DevTools reports, got '+rows.length);}
const manifests=variants.map(v=>{const f=path.join(dir,'manifest-'+v+'.json');if(!fs.existsSync(f))throw Error('Missing manifest '+f);return JSON.parse(fs.readFileSync(f,'utf8'));});
const result={baseSha:config.baseSha,headSha:config.headSha,runs:config.runs,variants,devtoolsVariants:config.devtoolsVariants,lighthouseVersions:[...new Set(records.map(r=>r.lighthouseVersion).filter(Boolean))],manifests,records,summary:summaries};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(result,null,2));
const fmt=(n,k)=>finite(n)?(k==='CLS'?n.toFixed(5):Math.round(n).toString()):'—';
const lines=['# Lighthouse variant matrix','','Pinned base: '+config.baseSha+'  ','Pinned head: '+config.headSha+'  ','Simulate runs: '+config.runs+' per brand/variant; DevTools: '+config.devtoolsVariants.join(', ')+'','','| Variant | Brand | Metric | Min (ms) | Median (ms) | Max (ms) |','|---|---|---|---:|---:|---:|'];
for(const s of summaries)for(const k of ['FCP','LCP','SI','TBT','CLS']){const x=s.metrics[k];lines.push('| '+s.variant+' | '+s.brand+' | '+k+' | '+fmt(x.min,k)+' | '+fmt(x.median,k)+' | '+fmt(x.max,k)+' |');}
lines.push('','## Observed LCP breakdown','','| Variant | Brand | Part | Min (ms) | Median (ms) | Max (ms) |','|---|---|---|---:|---:|---:|');
for(const s of summaries)for(const k of [...parts,'total']){const x=s.observedBreakdownMs[k];lines.push('| '+s.variant+' | '+s.brand+' | '+k+' | '+fmt(x.min)+' | '+fmt(x.median)+' | '+fmt(x.max)+' |');}
lines.push('','## Variant manifests','');
for(const m of manifests)lines.push('- **'+m.variant+'**: '+(m.changedFiles.length?m.changedFiles.join(', '):'no source files changed')+'; block SHA-256: '+JSON.stringify(m.changedBlockSha256));
lines.push('','Lighthouse JSON reports and saved traces/assets are included in this artifact.');
fs.writeFileSync(path.join(dir,'summary.md'),lines.join('\n')+'\n');console.log(lines.join('\n'));
