// fix-console-errors.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// 1. Исправление public/app/core/views.js: восстанавливаем блок пуш-баббла целиком
const viewsPath = path.join(root, 'public/app/core/views.js');
if (fs.existsSync(viewsPath)) {
  let content = fs.readFileSync(viewsPath, 'utf8');

  const pushBlockRegex = /\/\* ========== Пуш-баббл «Включите пуши» ========== \*\/[\s\S]*?\)\(\);(?=\s*(?:\/\*|$))/;

  const restoredPushBlock = `/* ========== Пуш-баббл «Включите пуши» ========== */
(function () {
  function findPush() {
    return (
      document.getElementById('pushHint') ||
      document.getElementById('pushBubble') ||
      document.querySelector('.pushHint, .push-bubble, .pushBubble')
    );
  }

  function place() {
    var b = findPush();
    var av = document.getElementById('profileTopBtn');
    if (!b || !av || b.style.display === 'none') return;
    var r = av.getBoundingClientRect();
    b.style.position = 'fixed';
    b.style.top = r.bottom + 10 + 'px';
    b.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    b.style.left = 'auto';
    b.style.margin = '0';
    b.style.zIndex = '1200';
  }

  function refresh() {
    var p = document.getElementById('panel');
    var open = p && p.classList.contains('open');
    var b = findPush();
    if (b) {
      b.style.display = open ? 'none' : '';
      if (!open) place();
    }
    pulsePushBtn(open);
  }

  function pushBtnEl() {
    var byId = document.getElementById('pushBtn');
    if (byId) return byId;
    var all = document.querySelectorAll('#profileBox button, .panel button');
    for (var i = 0; i < all.length; i++) {
      if (/Включить уведомления/.test(all[i].textContent || '')) return all[i];
    }
    return null;
  }

  function pulsePushBtn(open) {
    var btn = pushBtnEl();
    if (!btn) return;
    var need = !!open && /Включить уведомления/.test(btn.textContent || '');
    if (need && !btn.classList.contains('pulse')) {
      btn.classList.remove('pulse');
      void btn.offsetWidth;
      btn.classList.add('pulse');
    } else if (!need) {
      btn.classList.remove('pulse');
    }
  }

  var panelEl = document.getElementById('panel');
  if (panelEl && typeof MutationObserver !== 'undefined') {
    new MutationObserver(refresh).observe(panelEl, {
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style'],
    });
  }

  document.addEventListener('click', function () {
    setTimeout(refresh, 0);
  });
  window.addEventListener('resize', place);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh);
  } else {
    refresh();
  }

  setTimeout(refresh, 400);
  setTimeout(refresh, 1500);
})();`;

  if (pushBlockRegex.test(content)) {
    content = content.replace(pushBlockRegex, restoredPushBlock);
    fs.writeFileSync(viewsPath, content, 'utf8');
    console.log('✔ public/app/core/views.js успешно восстановлен');
  } else {
    console.warn('⚠ Блок пуш-баббла в views.js не найден по регулярному выражению');
  }
}

// 2. Исправление public/sw.js: заменяем несуществующий overlay.js на overlay-core.js
const swPath = path.join(root, 'public/sw.js');
if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  if (swContent.includes('/app/core/overlay.js')) {
    swContent = swContent.replace(
      /'\/app\/core\/overlay\.js'|"\.\/app\/core\/overlay\.js"|'public\/app\/core\/overlay\.js'|"\/app\/core\/overlay\.js"/g,
      "'/app/core/overlay-core.js'"
    );
    // Также инкрементируем версию кэша, чтобы воркер пересобрал кэш
    swContent = swContent.replace(/zerno-static-v(\d+)/, (_, v) => `zerno-static-v${Number(v) + 1}`);
    fs.writeFileSync(swPath, swContent, 'utf8');
    console.log('✔ public/sw.js: устаревший overlay.js заменен на overlay-core.js, STATIC_CACHE инкрементирован');
  } else {
    console.log('ℹ В sw.js уже нет упоминания /app/core/overlay.js');
  }
}

// 3. Создание заглушки-файла public/app/core/overlay.js (на случай, если сторонние вызовы или тесты все еще обращаются к нему)
const stubOverlayPath = path.join(root, 'public/app/core/overlay.js');
if (!fs.existsSync(stubOverlayPath)) {
  fs.writeFileSync(stubOverlayPath, '/* overlay.js stub — redirected to overlay-core.js */\n', 'utf8');
  console.log('✔ Создана пустая заглушка public/app/core/overlay.js во избежание 404');
}