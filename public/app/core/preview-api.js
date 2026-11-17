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

function previewSummary(orders, revenue, statusCounts = {}) {
  return {
    orders,
    revenue,
    cancelled: statusCounts.cancel || 0,
    pickup: Math.round(orders / 3),
    delivery: orders - Math.round(orders / 3),
    preorders: Math.round(orders / 5),
    byStatus: { new: statusCounts.new || 0, accept: statusCounts.accept || 0, cook: statusCounts.cook || 0, way: statusCounts.way || 0, done: statusCounts.done || 0 },
    top: [{ name: 'Пицца Маргарита', qty: Math.max(1, Math.round(orders / 2)) }, { name: 'Филадельфия', qty: Math.max(1, Math.round(orders / 3)) }],
    recent: [],
  };
}

function previewOrders() {
  return [{
    id: 'preview-order-1042',
    no: 1042,
    cid: 'preview-guest-01',
    name: 'Демо-гость',
    phone: '+7 900 000-00-01',
    status: 'accept',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    method: 'delivery',
    place: 'Янтарный',
    addr: 'Советская, 10',
    slot: 'asap',
    pay: 'card',
    items: [{ id: 'pz-marg', name: 'Маргарита', qty: 1, opt: '35 см, тонкое', price: 635, modifiers: [] }],
    gifts: [],
    total: 635,
    discount: 0,
    fee: 0,
    is_preorder: 0,
    by_staff: 0,
    comment: 'Демо-заказ для проверки интерфейса',
  }];
}

function previewCustomers() {
  return [
    { id: 'preview-customer-01', name: 'Анна Демо', phone: '+7 900 000-00-01', stamps: 7, free: 1, cups: 67, qr: 'PREVIEW-GUEST-01', role: 'guest', verified: 1, welcome: 0, tg: 0, notify_tg: 0, notify_web: 0, history: [] },
    { id: 'preview-customer-02', name: 'Иван Пример', phone: '+7 900 000-00-02', stamps: 3, free: 0, cups: 23, qr: 'PREVIEW-GUEST-02', role: 'guest', verified: 1, welcome: 0, tg: 0, notify_tg: 0, notify_web: 0, history: [] },
  ];
}

function previewStats() {
  const days = Array.from({ length: 14 }, (_, index) => ({
    label: new Date(Date.now() - (13 - index) * 86400000).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
    c: (index * 7 + 3) % 19,
  }));
  return {
    total: 248,
    staffCount: 5,
    newWeek: 14,
    newMonth: 47,
    stampsToday: 18,
    stampsWeek: 96,
    stampsMonth: 382,
    redeemed: 12,
    returning: 83,
    avgCups: 4.8,
    promoUses: 9,
    days,
  };
}

function previewOrdersStats() {
  const guest = previewSummary(18, 12450, { new: 3, accept: 4, cook: 3, way: 2, done: 6, cancel: 1 });
  const staff = previewSummary(4, 2850, { accept: 1, cook: 1, done: 2 });
  guest.avg = 692;
  staff.avg = 712;
  staff.recent = [{ no: 1042, name: 'Демо-сотрудник', total: 635, ts: new Date().toISOString() }];
  const todayGuest = { ...guest, orders: 3, revenue: 1960 };
  const todayStaff = { ...staff, orders: 1, revenue: 635 };
  return {
    today: { guest: todayGuest, staff: todayStaff },
    week: { guest, staff },
    days: Array.from({ length: 14 }, (_, index) => ({
      label: new Date(Date.now() - (13 - index) * 86400000).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      guest: (index * 3 + 2) % 9,
      staff: index % 3,
      revenue: ((index * 3 + 2) % 9) * 650,
    })),
  };
}

function previewReadResponse(url, role) {
  const path = url.pathname;
  const updatedAt = new Date().toISOString();
  const allMenu = COFFEE_MENU.concat(DELIVERY_MENU);

  switch (path) {
    case '/api/me':
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
    case '/api/menu':
      return jsonResponse({ items: COFFEE_MENU, updatedAt });
    case '/api/dmenu':
      return jsonResponse({ items: DELIVERY_MENU, updatedAt });
    case '/api/menu/all':
      return jsonResponse({ items: allMenu, updatedAt });
    case '/api/config':
      return jsonResponse({ tgUsername: '', smsAuthEnabled: false, preview: true });
    case '/api/delivery/info': {
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
    case '/api/delivery/addr':
      return jsonResponse({ suggestions: [] });
    case '/api/promo/info':
      return jsonResponse({ ok: false, error: 'Промокоды отключены в preview' });
    case '/api/me/free-delivery':
      return jsonResponse({ ok: false, free: false });
    case '/api/orders':
      return jsonResponse({ orders: role === 'dispatch' || role === 'admin' ? previewOrders() : [] });
    case '/api/orders/mine':
      return jsonResponse({ orders: [] });
    case '/api/chat/thread':
    case '/api/chat/dialog':
      return jsonResponse({ msgs: [] });
    case '/api/chat/list':
      return jsonResponse({ threads: [] });
    case '/api/staff/customers':
      return jsonResponse({ customers: previewCustomers() });
    case '/api/staff/log':
      return jsonResponse({ log: [{ t: 'Сегодня, 10:42', w: 'Демо-кассир', a: 'Демо-профиль открыт для проверки интерфейса' }] });
    case '/api/staff/pending':
      return jsonResponse({ pending: [{ id: 'preview-pending-01', name: 'Гость для демо', phone: '+7 900 000-00-03', actcode: '1234', created_at: updatedAt }] });
    case '/api/promos':
      return jsonResponse({ promos: [{ id: 'preview-promo-01', code: 'DEMO', kind: 'stamp', value: 1, active: 1, uses: 3, maxuses: 50, scope: 'coffee' }] });
    case '/api/admin/bonuses':
      return jsonResponse({ customers: previewCustomers(), items: [], history: [] });
    case '/api/admin/weekpromo':
      return jsonResponse({ weekPromo: { text: 'Демо-предложение', threshold: 1500, gift: 'Соус', until: null }, pizzaMonth: { name: 'Демо-пицца', on: true } });
    case '/api/stats':
      return jsonResponse(previewStats());
    case '/api/stats/redeems':
      return jsonResponse({ total: 12, byItem: { Капучино: 8, Американо: 4 }, recent: [{ action: 'Подарок списан: Капучино', by: 'Демо-кассир', time: updatedAt }] });
    case '/api/stats/orders':
      return jsonResponse(previewOrdersStats());
    case '/api/push/subs':
      return jsonResponse({ subs: [{ name: 'Демо-гость', phone: '+7 900 000-00-01', created: updatedAt }], tg: [] });
    case '/api/vapid':
      return jsonResponse({ publicKey: '' });
    case '/api/health':
      return jsonResponse({ ok: true, preview: true });
    default:
      return jsonResponse({ error: 'API endpoint is not mapped in read-only preview.' }, 404);
  }
}

export function createPreviewApiResponse(inputUrl, init = {}, role = 'guest') {
  const url = inputUrl instanceof URL ? inputUrl : new URL(String(inputUrl), 'https://zerno-motion-preview.vercel.app');
  const method = String(init.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!url.pathname.startsWith('/api/')) return jsonResponse({ error: 'Not found' }, 404);

  if (method === 'POST' && (url.pathname === '/api/chat/send' || url.pathname === '/api/chat/botlog')) {
    return jsonResponse({ ok: true, preview: true, persisted: false });
  }
  if (method !== 'GET') {
    return jsonResponse({ error: 'Это read-only preview: запись и реальные действия отключены.' }, 403);
  }
  return previewReadResponse(url, role);
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
