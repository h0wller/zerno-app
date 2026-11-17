const COFFEE_MENU = [
  { id: 'espresso', cat: 'coffee', e: '⚡', name: 'Эспрессо', desc: '40 мл чистой честности. Без молока и компромиссов', comp: ['эспрессо'], vol: '40 мл', price: '200', tag: '', coffee: 1, on: 1, section: 'coffee', opts: [] },
  { id: 'cap', cat: 'coffee', e: '☕', name: 'Капучино', desc: 'Классика, за которой возвращаются. Пенка — хоть рисуй', comp: ['эспрессо', 'молоко'], vol: '200/300 мл', price: '250/340', tag: 'Хит', coffee: 1, on: 1, section: 'coffee', opts: [{ name: '200 мл', price_delta: 250 }, { name: '300 мл', price_delta: 340 }] },
  { id: 'lat', cat: 'coffee', e: '🥛', name: 'Латте', desc: 'Мягкий и тёплый, как объятие. Только вкуснее', comp: ['эспрессо', 'молоко'], vol: '300/400 мл', price: '310/360', tag: '', coffee: 1, on: 1, section: 'coffee', opts: [{ name: '300 мл', price_delta: 310 }, { name: '400 мл', price_delta: 360 }] },
  { id: 'raf', cat: 'coffee', e: '🍦', name: 'Раф', desc: 'Сливочный, сладкий, затягивает', comp: ['эспрессо', 'сливки', 'ваниль'], vol: '300/400 мл', price: '360/400', tag: '', coffee: 1, on: 1, section: 'coffee', opts: [{ name: '300 мл', price_delta: 360 }, { name: '400 мл', price_delta: 400 }] },
  { id: 'batch', cat: 'coffee', e: '🫖', name: 'Батч брю', desc: 'Заварили с любовью. Кислит, сладит, живёт', comp: ['фильтр-кофе'], vol: '200/300 мл', price: '220/260', tag: '', coffee: 1, on: 1, section: 'coffee', opts: [{ name: '200 мл', price_delta: 220 }, { name: '300 мл', price_delta: 260 }] },
  { id: 'matcha', cat: 'drinks', e: '🍵', name: 'Матча', desc: 'Зелёная, яркая, сбалансированная', comp: ['матча', 'молоко'], vol: '300/400 мл', price: '290/360', tag: 'New', coffee: 0, on: 1, section: 'coffee', opts: [{ name: '300 мл', price_delta: 290 }, { name: '400 мл', price_delta: 360 }] },
  { id: 'cocoa', cat: 'drinks', e: '🍫', name: 'Какао', desc: 'Из детства, с маршмеллоу и без сожалений', comp: ['какао', 'молоко'], vol: '300/400 мл', price: '290/370', tag: '', coffee: 0, on: 1, section: 'coffee', opts: [{ name: '300 мл', price_delta: 290 }, { name: '400 мл', price_delta: 370 }] },
  { id: 'syrniki', cat: 'food', e: '🥞', name: 'Сырники', desc: 'Нежные сырники со сметаной и ягодами', comp: ['творог', 'сметана', 'ягоды'], vol: 'порция', price: '350', tag: '', coffee: 0, on: 1, section: 'coffee', opts: [] },
  { id: 'carrot', cat: 'desserts', e: '🥕', name: 'Морковный торт', desc: 'Орех хрустит, крем тает', comp: ['морковь', 'крем-чиз', 'грецкий орех'], vol: '120 г', price: '360', tag: 'Хит', coffee: 0, on: 1, section: 'coffee', opts: [] },
  { id: 'drip', cat: 'shop', e: '☕', name: 'Дрип', desc: 'Кофе в кармане. Завари где угодно', comp: ['Tasty Coffee'], vol: '1 шт.', price: '150', tag: '', coffee: 0, on: 1, section: 'coffee', opts: [] },
];

const PIZZA_OPTIONS = [
  { l: '25 см, пышное', w: '415 г', p: 535, sz: 25 },
  { l: '35 см, пышное', w: '750 г', p: 735, sz: 35 },
  { l: '25 см, тонкое', w: '335 г', p: 435, sz: 25 },
  { l: '35 см, тонкое', w: '550 г', p: 635, sz: 35 },
];

const DELIVERY_MENU = [
  { id: 'pz-marg', cat: 'pizza', e: '🍕', name: 'Маргарита', desc: 'Красный соус, моцарелла', comp: ['красный соус', 'моцарелла'], vol: '25/35 см', price: '0', tag: 'Классика', coffee: 0, on: 1, section: 'delivery', opts: PIZZA_OPTIONS },
  { id: 'pz-pep', cat: 'pizza', e: '🍕', name: 'Пепперони', desc: 'Красный соус, моцарелла, пепперони, халапеньо', comp: ['красный соус', 'моцарелла', 'пепперони', 'халапеньо'], vol: '25/35 см', price: '0', tag: 'Хит', coffee: 0, on: 1, section: 'delivery', opts: [{ l: '25 см, пышное', w: '470 г', p: 790, sz: 25 }, { l: '35 см, пышное', w: '840 г', p: 1090, sz: 35 }, { l: '25 см, тонкое', w: '390 г', p: 690, sz: 25 }, { l: '35 см, тонкое', w: '640 г', p: 990, sz: 35 }] },
  { id: 'pz-hamgr', cat: 'pizza', e: '🍕', name: 'Ветчина и грибы', desc: 'Белый соус, моцарелла, шампиньоны, ветчина, чеддер', comp: ['белый соус', 'моцарелла', 'шампиньоны', 'ветчина', 'чеддер'], vol: '25/35 см', price: '0', tag: '', coffee: 0, on: 1, section: 'delivery', opts: [{ l: '25 см, пышное', w: '545 г', p: 745, sz: 25 }, { l: '35 см, пышное', w: '990 г', p: 1095, sz: 35 }, { l: '25 см, тонкое', w: '465 г', p: 645, sz: 25 }, { l: '35 см, тонкое', w: '790 г', p: 995, sz: 35 }] },
  { id: 'pz-cheese', cat: 'pizza', e: '🍕', name: 'Сырная', desc: 'Белый соус, моцарелла, чеддер, камамбер', comp: ['белый соус', 'моцарелла', 'чеддер', 'камамбер'], vol: '25/35 см', price: '0', tag: '', coffee: 0, on: 1, section: 'delivery', opts: [{ l: '25 см, пышное', w: '500 г', p: 845, sz: 25 }, { l: '35 см, пышное', w: '850 г', p: 1145, sz: 35 }, { l: '25 см, тонкое', w: '420 г', p: 745, sz: 25 }, { l: '35 см, тонкое', w: '650 г', p: 1045, sz: 35 }] },
  { id: 'rl-phil-og', cat: 'rolls', e: '🍣', name: 'Филадельфия с огурцом', desc: 'Рис, нори, сливочный сыр, огурец и лосось', comp: ['рис', 'нори', 'сливочный сыр', 'огурец', 'лосось'], vol: '250 г', price: '650', tag: 'Популярное', coffee: 0, on: 1, section: 'delivery', opts: [] },
  { id: 'rl-hos-og', cat: 'rolls', e: '🍣', name: 'Хосомаки с огурцом', desc: 'Рис, нори, огурец и микрозелень', comp: ['рис', 'нори', 'огурец'], vol: '150 г', price: '220', tag: '', coffee: 0, on: 1, section: 'delivery', opts: [] },
  { id: 'set-phil', cat: 'sets', e: '🍱', name: 'Сет Филадельфия', desc: 'Три любимых ролла в одном сете', comp: ['филадельфия', 'ролл с огурцом'], vol: '750 г', price: '1740', tag: '', coffee: 0, on: 1, section: 'delivery', opts: [] },
  { id: 'dr-cola', cat: 'drinks', e: '🥤', name: 'Кола', desc: 'Охлаждённая газировка', comp: ['напиток'], vol: '0,5 л', price: '160', tag: '', coffee: 0, on: 1, section: 'delivery', opts: [] },
  { id: 'sc-red', cat: 'sauces', e: '🥫', name: 'Соус красный', desc: 'Томатный соус со специями', comp: ['томат', 'специи'], vol: '40 г', price: '80', tag: '', coffee: 0, on: 1, section: 'delivery', opts: [] },
  { id: 'sc-garlic', cat: 'sauces', e: '🥫', name: 'Соус чесночный', desc: 'Сливочный соус с чесноком', comp: ['чеснок', 'сливки'], vol: '40 г', price: '80', tag: '', coffee: 0, on: 1, section: 'delivery', opts: [] },
];

const PREVIEW_ROLES = new Set(['guest', 'cashier', 'dispatch', 'admin']);

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function kaliningradDate(offset = 0) {
  const value = new Date(Date.now() + 2 * 60 * 60 * 1000 + offset * 86400000);
  return [value.getUTCFullYear(), String(value.getUTCMonth() + 1).padStart(2, '0'), String(value.getUTCDate()).padStart(2, '0')].join('-');
}

export function isReadOnlyPreviewHost(hostname = '') {
  const host = String(hostname).toLowerCase();
  return /^(?:zerno-motion-preview)(?:-[a-z0-9-]+)?\.vercel\.app$/.test(host)
    || host === 'zerno-motion-preview.vercel.app';
}

export function createPreviewApiResponse(inputUrl, init = {}, role = 'guest') {
  const url = inputUrl instanceof URL ? inputUrl : new URL(String(inputUrl), 'https://zerno-motion-preview.vercel.app');
  const method = String(init.method || 'GET').toUpperCase();
  const path = url.pathname;

  if (method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!path.startsWith('/api/')) return jsonResponse({ error: 'Not found' }, 404);

  if (method !== 'GET') {
    if (method === 'POST' && (path === '/api/chat/send' || path === '/api/chat/botlog')) {
      return jsonResponse({ ok: true, preview: true, persisted: false });
    }
    return jsonResponse({ error: 'Это read-only preview: запись и реальные действия отключены.' }, 403);
  }

  const updatedAt = new Date().toISOString();
  const allMenu = COFFEE_MENU.concat(DELIVERY_MENU);
  if (path === '/api/me') {
    if (!PREVIEW_ROLES.has(role) || role === 'guest') return jsonResponse({ error: 'Демо-гость без авторизации' }, 401);
    return jsonResponse({
      customer: {
        id: 'preview-' + role,
        name: role === 'cashier' ? 'Демо-кассир' : role === 'dispatch' ? 'Демо-диспетчер' : 'Демо-администратор',
        phone: '+7 900 000-00-00',
        role,
        verified: 1,
        stamps: 7,
        free: 1,
        cups: 67,
        qr: 'PREVIEW-' + role.toUpperCase(),
        notify_tg: 0,
        notify_web: 0,
        history: [],
      },
    });
  }
  if (path === '/api/menu') return jsonResponse({ items: COFFEE_MENU, updatedAt });
  if (path === '/api/dmenu') return jsonResponse({ items: DELIVERY_MENU, updatedAt });
  if (path === '/api/menu/all') return jsonResponse({ items: allMenu, updatedAt });
  if (path === '/api/config') return jsonResponse({ tgUsername: '', smsAuthEnabled: false, preview: true });
  if (path === '/api/delivery/info') {
    const days = [0, 1].map((offset) => ({
      offset,
      date: kaliningradDate(offset),
      open: 11,
      close: 22,
    }));
    return jsonResponse({
      slotStep: 30,
      eta: 45,
      schedule: { open: 11, close: 22 },
      today: { date: days[0].date, isOpen: true, canAcceptAsap: true, open: 11, close: 22 },
      days,
      busySlots: [],
      zones: [
        { name: 'Янтарный', fee: 0, places: ['Янтарный'] },
        { name: 'Светлогорск', fee: 250, places: ['Светлогорск', 'Отрадное'] },
      ],
      weekPromo: { text: '', threshold: 0, gift: '', until: null },
      pizzaMonth: { name: '', on: false },
    });
  }
  if (path === '/api/delivery/addr') return jsonResponse({ suggestions: [] });
  if (path === '/api/promo/info') return jsonResponse({ ok: false, error: 'Промокоды отключены в preview' });
  if (path === '/api/me/free-delivery') return jsonResponse({ ok: false, free: false });
  if (path === '/api/orders' || path === '/api/orders/mine') return jsonResponse({ orders: [] });
  if (path === '/api/chat/thread' || path === '/api/chat/dialog') return jsonResponse({ msgs: [] });
  if (path === '/api/chat/list') return jsonResponse({ threads: [] });
  if (path === '/api/promos') return jsonResponse({ promos: [] });
  if (path === '/api/admin/bonuses') return jsonResponse({ customers: [], items: [], history: [] });
  if (path === '/api/admin/weekpromo') return jsonResponse({ weekPromo: { text: '', threshold: 0, gift: '' }, pizzaMonth: { name: '', on: false } });
  if (path === '/api/vapid') return jsonResponse({ publicKey: '' });
  if (path === '/api/health') return jsonResponse({ ok: true, preview: true });

  return jsonResponse({ error: 'API endpoint is not mapped in read-only preview.' }, 404);
}

export function installReadOnlyPreviewApi(win = window) {
  if (!win || !isReadOnlyPreviewHost(win.location && win.location.hostname)) return false;

  const params = new URLSearchParams(win.location.search || '');
  const roleParam = params.get('previewRole') || 'guest';
  const role = PREVIEW_ROLES.has(roleParam) ? roleParam : 'guest';
  win.__ZERNO_READONLY_PREVIEW__ = true;
  win.__ZERNO_PREVIEW_ROLE__ = role;
  win.USER_TOKEN = role === 'guest' ? null : 'preview-session-' + role;

  try {
    win.localStorage.removeItem('zt_user');
    win.localStorage.removeItem('zt_role');
    win.localStorage.removeItem('zt_cartpromo');
  } catch (_) {}

  const nativeFetch = win.fetch.bind(win);
  win.fetch = function (input, init = {}) {
    let url;
    try {
      const raw = input && typeof input === 'object' && input.url ? input.url : String(input);
      url = new URL(raw, win.location.href);
    } catch (_) {
      return nativeFetch(input, init);
    }

    if (url.origin !== win.location.origin || !url.pathname.startsWith('/api/')) {
      return nativeFetch(input, init);
    }

    const requestMethod = init.method || (input && input.method) || 'GET';
    return Promise.resolve(createPreviewApiResponse(url, { ...init, method: requestMethod }, role));
  };

  const robots = win.document && win.document.querySelector('meta[name="robots"]');
  if (!robots && win.document && win.document.head) {
    const meta = win.document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow,noarchive';
    win.document.head.appendChild(meta);
  }
  if (win.document) {
    win.document.title = (win.document.title || 'Zerno') + ' · DEMO / READ ONLY';
    win.document.documentElement.dataset.previewMode = 'readonly';
  }

  return true;
}
