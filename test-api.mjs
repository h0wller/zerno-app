import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = 3999, BASE = `http://localhost:${PORT}`, DB = 'test-tmp.db';
if (fs.existsSync(DB)) fs.unlinkSync(DB);
const srv = spawn('node', ['server.js'], { env: { ...process.env, DB_PATH: DB, PORT: String(PORT) }, stdio: 'ignore' });
const wait = ms => new Promise(r => setTimeout(r, ms));
async function up(){ for(let i=0;i<60;i++){ try{ const r=await fetch(BASE+'/api/health'); if(r.ok) return true; }catch(e){} await wait(200);} return false; }
let pass=0, fail=0;
const check=(name,cond,extra='')=>{ if(cond){pass++;console.log('✅',name);} else {fail++;console.log('❌',name,extra);} };
async function api(path,{method='GET',token,body}={}){
  const r=await fetch(BASE+'/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
  let j={}; try{j=await r.json();}catch(e){}
  return {status:r.status,j};
}
const register=(name,phone)=>api('/auth/register',{method:'POST',body:{name,phone,pin:'1234'}});
const run=async()=>{
  const g=(await register('Гость','+7 900 000-00-01')).j.token;
  const c=(await register('Кассир','+7 900 000-00-02')).j.token; await api('/auth/activate',{method:'POST',token:c,body:{code:'2468'}});
  const d=(await register('Диспетчер','+7 900 000-00-03')).j.token; await api('/auth/activate',{method:'POST',token:d,body:{code:'5719'}});
  const a=(await register('Админ','+7 900 000-00-04')).j.token; await api('/auth/activate',{method:'POST',token:a,body:{code:'1234'}});
  const gid=(await api('/me',{token:g})).j.customer.id;
  check('роли выдались',(await api('/me',{token:c})).j.customer?.role==='cashier'&&(await api('/me',{token:d})).j.customer?.role==='dispatch');
  await api('/chat/send',{method:'POST',token:g,body:{key:gid+':d',text:'Позвать сотрудника',human:1,ctx:'delivery'}});
  await api('/chat/send',{method:'POST',token:g,body:{key:gid+':c',text:'Позвать сотрудника',human:1,ctx:'coffee'}});
  const lc=await api('/chat/list',{token:c}), ld=await api('/chat/list',{token:d}), la=await api('/chat/list',{token:a});
  check('кассир видит только кофейню',lc.j.threads?.length===1&&lc.j.threads[0].ctx==='coffee',JSON.stringify(lc.j.threads));
  check('диспетчер только доставку',ld.j.threads?.length===1&&ld.j.threads[0].ctx==='delivery',JSON.stringify(ld.j.threads));
  check('админ видит оба',la.j.threads?.length===2);
  const key=ld.j.threads[0]?.key||'';
  check('ключ без двойного суффикса',/:[cd]$/.test(key)&&!/:[cd]:[cd]$/.test(key),key);
  await api('/chat/close',{method:'POST',token:d,body:{key}});
  await api('/chat/send',{method:'POST',token:g,body:{key,text:'Позвать снова',human:1,ctx:'delivery'}});
  const ld2=await api('/chat/list',{token:d});
  check('после закрытия новый вызов открывает тред',ld2.j.threads?.some(t=>t.key===key));
  await api('/chat/reply',{method:'POST',token:d,body:{key,text:'Диспетчер на связи'}});
  const th=await api('/chat/thread?key='+encodeURIComponent(key));
  check('гость видит ответ сотрудника',th.j.msgs?.some(m=>m.who==='staff'));
  check('кассир не читает чужой тред',(await api('/chat/dialog?key='+encodeURIComponent(key),{token:c})).status===403);
  await api('/admin/weekpromo',{method:'PUT',token:a,body:{text:'Тест пиво',threshold:2000,gift:'Пиво',until:new Date(Date.now()+86400000).toISOString()}});
  await api('/admin/weekpromo',{method:'PUT',token:a,body:{pmName:'Маргарита',pmOn:true}});
  const info=await api('/delivery/info');
  check('обе акции живы одновременно',!!info.j.weekPromo&&!!info.j.pizzaMonth);
  await api('/promos',{method:'POST',token:a,body:{code:'PIZZA10',kind:'percent',value:10}});
  const pizza=(await api('/dmenu')).j.items.find(p=>p.cat==='pizza');
  const ord=await api('/orders',{method:'POST',token:g,body:{method:'delivery',place:'Янтарный',addr:'Советская 1',slot:'asap',pay:'cash',items:[{id:pizza.id,oi:1,qty:2}],promo:'PIZZA10'}});
  check('заказ с промокодом создан',ord.status===200&&ord.j.order?.promodiscount>0,JSON.stringify(ord.j));
  check('подарок пиццы месяца начислен',(ord.j.order?.gifts||[]).length>=1);
  check('диспетчер видит заказ',(await api('/orders',{token:d})).j.orders?.some(o=>o.no===ord.j.order?.no));
  check('статус меняется',(await api('/orders/'+ord.j.order.id+'/status',{method:'POST',token:d,body:{status:'accept'}})).status===200);
  check('диспетчер не лезет в кассу',(await api('/staff/customers',{token:d})).status===403);
  check('кассир не лезет в админку',(await api('/promos',{token:c})).status===403);
};
(async()=>{
  if(!await up()){ console.log('❌ сервер не поднялся'); srv.kill(); process.exit(1); }
  try{ await run(); }catch(e){ fail++; console.log('❌ ошибка сценария:',e.message); }
  console.log(`\nИТОГО: ✅ ${pass}  ❌ ${fail}`);
  srv.kill(); try{fs.unlinkSync(DB);}catch(e){}
  process.exit(fail?1:0);
})();