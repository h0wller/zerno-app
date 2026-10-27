import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = 3999, BASE = `http://localhost:${PORT}`, DB = 'test-tmp.db';
if (fs.existsSync(DB)) fs.unlinkSync(DB);
const srv = spawn('node', ['server.js'], { env: { ...process.env, DB_PATH: DB, PORT: String(PORT), TG_WEBHOOK_SECRET: '' }, stdio: 'ignore' });
const wait = ms => new Promise(r => setTimeout(r, ms));
async function up(){ for(let i=0;i<60;i++){ try{ const r=await fetch(BASE+'/api/health'); if(r.ok) return true; }catch(e){} await wait(200);} return false; }
let pass=0, fail=0;
const check=(name,cond,extra='')=>{ if(cond){pass++;console.log('✅',name);} else {fail++;console.log('❌',name,extra);} };
async function api(path,{method='GET',token,body}={}){
  const r=await fetch(BASE+'/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
  let j={}; try{j=await r.json();}catch(e){}
  return {status:r.status,j};
}
const register=(name,phone)=>api('/auth/register',{method:'POST',body:{name,phone,pin:'3364'}});
const run=async()=>{
  const g=(await register('Гость','+7 900 000-00-01')).j.token;
  const c=(await register('Кассир','+7 900 000-00-02')).j.token; await api('/auth/activate',{method:'POST',token:c,body:{code:'2468'}});
  const d=(await register('Диспетчер','+7 900 000-00-03')).j.token; await api('/auth/activate',{method:'POST',token:d,body:{code:'5719'}});
  const a=(await register('Админ','+7 900 000-00-04')).j.token; await api('/auth/activate',{method:'POST',token:a,body:{code:'3364'}});
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
  const ordPre = await api('/orders',{method:'POST',token:g,body:{method:'delivery',place:'Янтарный',addr:'Советская 1',slot:'26-09 | 14-00',pay:'cash',items:[{id:pizza.id,oi:1,qty:1}]}});
  check('предзаказ сохранён',ordPre.status===200&&ordPre.j.order?.is_preorder===1&&ordPre.j.order?.preorder_date==='26-09');
  check('подарок пиццы месяца начислен',(ord.j.order?.gifts||[]).length>=1);
  check('диспетчер видит заказ',(await api('/orders',{token:d})).j.orders?.some(o=>o.no===ord.j.order?.no));
  check('статус меняется',(await api('/orders/'+ord.j.order.id+'/status',{method:'POST',token:d,body:{status:'accept'}})).status===200);
  // F2.5.6: выполненный предзаказ остаётся у диспетчера и его статус можно менять вручную
  await api('/orders/'+ordPre.j.order.id+'/status',{method:'POST',token:d,body:{status:'done'}});
  const preList = (await api('/orders',{token:d})).j.orders || [];
  check('предзаказ done виден диспетчеру',preList.some(o=>o.no===ordPre.j.order?.no&&o.status==='done'));
  check('done→accept для предзаказа',(await api('/orders/'+ordPre.j.order.id+'/status',{method:'POST',token:d,body:{status:'accept'}})).status===200);
  check('обычный done скрыт из ленты',(await api('/orders',{token:d})).j.orders?.every(o=>!(o.status==='done'&&!o.is_preorder)));
  check('диспетчер не лезет в кассу',(await api('/staff/customers',{token:d})).status===403);
  check('кассир не лезет в админку',(await api('/promos',{token:c})).status===403);

  // ── безопасность админки и Telegram ──
  check('tg/diag без входа — 401',(await api('/tg/diag')).status===401);
  check('tg/diag для кассира — 403',(await api('/tg/diag',{token:c})).status===403);
  check('staff/demo удалён — 404',(await api('/staff/demo',{token:c})).status===404);
  check('вебхук без секрета — 503',(await fetch(BASE+'/api/tg/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status===503);
  check('tg-link с мусором — 401',(await api('/auth/tg-link',{method:'POST',body:{initData:'hash=00&user=%7B%7D&auth_date=1'}})).status===401);

  // ── бонусы: настройка только админу, однократное начисление ──
  check('бонусы: кассир не меняет — 403',(await api('/admin/bonuses',{method:'PUT',token:c,body:{kinds:{install:{coffee:2,delivery:0}}}})).status===403);
  const setB=await api('/admin/bonuses',{method:'PUT',token:a,body:{days:30,kinds:{install:{coffee:2,delivery:150}}}});
  check('бонусы: админ сохраняет',setB.status===200&&setB.j.kinds?.install?.coffee===2,JSON.stringify(setB.j));
  const gi=await register('Установщик','+7 900 000-00-05');
  const ti=gi.j.token;
  const idI=(await api('/me',{token:ti})).j.customer.id;
  await api('/staff/activate-guest',{method:'POST',token:c,body:{id:idI}});
  const i1=await api('/bonus/install',{method:'POST',token:ti});
  check('установка: первый раз начислено',i1.j.granted===true&&!!i1.j.code,JSON.stringify(i1.j));
  const i2=await api('/bonus/install',{method:'POST',token:ti});
  check('установка: повтор ничего не даёт',i2.j.granted===false);
  const meI=(await api('/me',{token:ti})).j.customer;
  check('установка: штампы пришли (+2)',meI.stamps===2,String(meI.stamps));
  await api('/admin/bonuses',{method:'PUT',token:a,body:{days:30,kinds:{install:{coffee:0,delivery:0}}}});

  // ── удаление профиля ──
  const gd=await register('Удаляемый','+7 900 000-00-06');
  const td=gd.j.token;
  check('удаление: сотрудник не может — 403',(await api('/me',{method:'DELETE',token:c})).status===403);
  const del=await api('/me',{method:'DELETE',token:td});
  check('удаление: гость удалён',del.status===200&&del.j.ok===true);
  check('удаление: старый токен не работает — 401',(await api('/me',{token:td})).status===401);
};
(async()=>{
  if(!await up()){ console.log('❌ сервер не поднялся'); srv.kill(); process.exit(1); }
  try{ await run(); }catch(e){ fail++; console.log('❌ ошибка сценария:',e.message); }
  console.log(`\nИТОГО: ✅ ${pass}  ❌ ${fail}`);
  srv.kill(); try{fs.unlinkSync(DB);}catch(e){}
  process.exit(fail?1:0);
})();