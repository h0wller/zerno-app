// fix-cart-and-cls.mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();

function log(msg, ok = true) {
  console.log(`${ok ? '✅' : '⚠️'} ${msg}`);
}

function updateFile(relPath, transform) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    log(`Файл не найден: ${relPath}`, false);
    return false;
  }
  const original = fs.readFileSync(absPath, 'utf8');
  const updated = transform(original);
  if (original !== updated) {
    fs.writeFileSync(absPath, updated, 'utf8');
    log(`Обновлен: ${relPath}`);
    return true;
  }
  log(`Без изменений: ${relPath}`);
  return false;
}

console.log('=== УСТРАНЕНИЕ ОШИБКИ CART.JS И ФИКС CLS ===\n');

// ─────────────────────────────────────────────────────────────
// 1. Исправление cart.js: объявление activeAddonTab и чистый рендер
// ─────────────────────────────────────────────────────────────
console.log('--- 1. Исправление ReferenceError и рендера допов в cart.js ---');
updateFile('public/app/cart.js', (src) => {
  let res = src;

  // 1.1 Гарантируем объявление переменной activeAddonTab в начале IIFE
  if (!res.includes("var activeAddonTab = 'all';")) {
    res = res.replace(
      /("use strict";\s*)/,
      `$1\n  var activeAddonTab = 'all';\n`
    );
  }

  // 1.2 Полный и автономный блок классификации и рендера допов с жестким инлайн-флексом
  const cleanAddonsLogic = `
  function getAddonType(item) {
    if (item.cat === 'drinks') return 'drinks';
    var nm = (item.name || '').toLowerCase();
    if (/соев|имбир|васаб|палочк/.test(nm)) return 'rolls';
    if (/соус/.test(nm)) return 'sauce';
    return 'pizza';
  }

  function renderAddons() {
    var host = document.getElementById("cartAddons");
    if (!host) {
      var ci = document.getElementById("cartItems");
      if (ci && ci.parentNode) {
        host = document.createElement("div");
        host.id = "cartAddons";
        ci.parentNode.insertBefore(host, ci);
      }
    }
    if (!host) return;
    if (!checkIsDelivery()) {
      host.innerHTML = "";
      return;
    }

    var sauces = (typeof DMENU !== 'undefined' && DMENU) ? DMENU.filter(function (p) {
      return (p.cat === "sauces" || p.cat === "drinks") && p.on;
    }) : [];

    if (!sauces.length) {
      host.innerHTML = "";
      return;
    }

    var cartList = (typeof cart !== 'undefined' ? cart : []);
    var hasPizza = cartList.some(function (c) {
      var it = (typeof DMENU !== 'undefined' && DMENU) ? DMENU.find(function(x){ return String(x.id) === String(c.id); }) : null;
      return it && it.cat === 'pizza';
    });
    var hasRolls = cartList.some(function (c) {
      var it = (typeof DMENU !== 'undefined' && DMENU) ? DMENU.find(function(x){ return String(x.id) === String(c.id); }) : null;
      return it && (it.cat === 'rolls' || it.cat === 'sets');
    });

    var sorted = sauces.slice().sort(function (a, b) {
      var typeA = getAddonType(a);
      var typeB = getAddonType(b);
      if (hasRolls && !hasPizza) {
        if (typeA === 'rolls' && typeB !== 'rolls') return -1;
        if (typeA !== 'rolls' && typeB === 'rolls') return 1;
      }
      if (hasPizza && !hasRolls) {
        if ((typeA === 'sauce' || typeA === 'pizza') && (typeB !== 'sauce' && typeB !== 'pizza')) return -1;
        if ((typeA !== 'sauce' && typeA !== 'pizza') && (typeB === 'sauce' || typeB === 'pizza')) return 1;
      }
      return 0;
    });

    var filtered = sorted.filter(function (p) {
      if (activeAddonTab === 'all') return true;
      return getAddonType(p) === activeAddonTab;
    });

    var tabs = [
      { id: 'all', l: 'Все' },
      { id: 'sauce', l: '🥫 Соусы' },
      { id: 'pizza', l: '🍕 К пицце' },
      { id: 'rolls', l: '🍣 К роллам' },
      { id: 'drinks', l: '🥤 Напитки' }
    ];

    var tabsHtml = tabs.map(function(t) {
      var isOn = activeAddonTab === t.id;
      return '<button type="button" class="atab ' + (isOn ? 'on' : '') + '" data-atab="' + t.id + '" style="flex:0 0 auto;border:1px solid ' + (isOn ? 'var(--flame,#C03B2A)' : 'var(--line,#E5DACB)') + ';background:' + (isOn ? 'var(--flame,#C03B2A)' : '#fff') + ';color:' + (isOn ? '#fff' : '#12303E') + ';border-radius:10px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">' + t.l + '</button>';
    }).join('');

    var itemsHtml = filtered.map(function (p) {
      var inCart = cartList.find(function (c) { return String(c.id) === String(p.id); });
      return '<button type="button" class="addonChip" data-addon="' + p.id + '" style="flex:0 0 auto;white-space:nowrap;margin:0;">' +
        (inCart ? '<b>×' + inCart.qty + '</b> ' : '') +
        esc(p.name) + ' · ' + fmt(parseInt(p.price, 10) || 0) +
      '</button>';
    }).join('');

    host.innerHTML =
      '<div style="margin:8px 0 10px;padding:8px 10px;background:rgba(18,58,107,0.03);border-radius:12px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">' +
          '<span style="font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#8B98A5;white-space:nowrap;">Добавить к заказу</span>' +
          '<div class="addon-tabs" style="display:flex;gap:5px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;">' +
            tabsHtml +
          '</div>' +
        '</div>' +
        '<div class="addon-rail" style="display:flex;gap:8px;overflow-x:auto;flex-wrap:nowrap;padding:4px 2px 6px;-webkit-overflow-scrolling:touch;scrollbar-width:none;">' +
          itemsHtml +
        '</div>' +
      '</div>';
  }
`;

  // Заменяем тело функции renderAddons до начала updateDeliveryPromoBar
  res = res.replace(
    /(?:window\.__activeAddonTab[\s\S]*?)?function\s+renderAddons\s*\(\)\s*\{[\s\S]*?(?=function\s+updateDeliveryPromoBar)/,
    cleanAddonsLogic.trim() + '\n\n  '
  );

  // 1.3 Исправляем обработчик клика в cPanel (чиним ReferenceError)
  const cPanelHandlerFix = `
      var tabBtn = e.target.closest('[data-atab]');
      if (tabBtn) {
        e.preventDefault();
        e.stopPropagation();
        activeAddonTab = tabBtn.dataset.atab;
        renderAddons();
        return;
      }
`;

  // Удаляем любые старые кривые вставки data-atab и вставляем чистый обработчик
  res = res.replace(/var\s+(?:tabBtn|at)\s*=\s*e\.target\.closest\('\[data-atab\]'\);[\s\S]*?return;\s*\}/g, '');
  res = res.replace(
    /(cPanel\.addEventListener\('click',\s*function\s*\(e\)\s*\{)/,
    `$1${cPanelHandlerFix}`
  );

  return res;
});

// ─────────────────────────────────────────────────────────────
// 2. Ликвидация CLS = 0.915 в theme-v2.css и index.html
// ─────────────────────────────────────────────────────────────
console.log('\n--- 2. Ликвидация сдвига макета CLS (position: fixed для сплэша) ---');

// В theme-v2.css гарантируем position: fixed для #brandSplashStatic без !important
updateFile('public/app/ui/theme-v2.css', (src) => {
  let res = src;
  if (res.includes('#brandSplashStatic{background:#FFFFFF}')) {
    res = res.replace(
      '#brandSplashStatic{background:#FFFFFF}',
      '#brandSplashStatic{position:fixed;inset:0;z-index:400;background:#FFFFFF;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}'
    );
  }
  return res;
});

// В public/index.html закрепляем в critical-style правильное поведение сплэша
updateFile('public/index.html', (src) => {
  let res = src;
  const criticalSplashStyle = `
      #brandSplashStatic, #brandSplash {
        position: fixed !important;
        inset: 0 !important;
        z-index: 400 !important;
        width: 100% !important;
        height: 100% !important;
        background: #FFFFFF !important;
      }
`;
  if (!res.includes('#brandSplashStatic, #brandSplash')) {
    res = res.replace(/(<style[^>]*>)/i, `$1${criticalSplashStyle}`);
  }
  return res;
});

// ─────────────────────────────────────────────────────────────
// 3. Бамп версии STATIC_CACHE в sw.js
// ─────────────────────────────────────────────────────────────
console.log('\n--- 3. Бамп версии кэша в sw.js ---');
updateFile('public/sw.js', (src) => {
  return src.replace(/(zerno-static-v)(\d+)/g, (_match, prefix, num) => {
    const next = parseInt(num, 10) + 1;
    log(`STATIC_CACHE: ${prefix}${num} -> ${prefix}${next}`);
    return `${prefix}${next}`;
  });
});

// ─────────────────────────────────────────────────────────────
// 4. Проверка синтаксиса и запуск аудита
// ─────────────────────────────────────────────────────────────
console.log('\n--- 4. Проверка синтаксиса и npm run audit ---');
try {
  execSync('node --check public/app/cart.js', { stdio: 'inherit' });
  execSync('npm run audit', { stdio: 'inherit' });
  console.log('\n🏆 ВСЕ АВТО-БАРЬЕРЫ ЗЕЛЕНЫЕ (0 ОШИБОК, 0 ВОРНИНГОВ)!');
} catch (e) {
  console.error('❌ Ошибка аудита:', e.message);
  process.exit(1);
}