import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve(process.argv[2] || 'index.html');

if (!fs.existsSync(filePath)) {
  console.error(`Ошибка: файл не найден по пути ${filePath}`);
  process.exit(1);
}

let html = fs.readFileSync(filePath, 'utf8');

// 1. Создание резервной копии
fs.writeFileSync(`${filePath}.bak`, html, 'utf8');
console.log(`[Backup] Создана копия: ${filePath}.bak`);

// 2. Внедрение CSS-правил стабилизации CLS в #critical-css
const cssFixes = `
/* ─── CLS Stabilization (Lighthouse Fix) ─── */
#rail,
#deliveryRail {
  min-height: 48px;
  contain: layout;
}

#deliveryBanner:empty,
#deliverySubFilter[hidden] {
  display: none !important;
}

.menu-head {
  padding-bottom: 0 !important;
  animation: none !important;
}

.topbar #profileTopBtn {
  width: 44px !important;
  height: 44px !important;
  min-width: 44px !important;
  flex-shrink: 0 !important;
  transition: opacity 0.2s ease !important;
}

.ticker {
  height: 30px;
  overflow: hidden;
  contain: strict;
}
`;

if (html.includes('id="critical-css"') && !html.includes('CLS Stabilization')) {
  html = html.replace(/(<style id="critical-css"[^>]*>[\s\S]*?)(<\/style>)/, `$1\n${cssFixes}\n$2`);
  console.log('✓ CSS-стили стабилизации CLS добавлены в #critical-css');
} else {
  console.log('ℹ Стили CLS уже применены или блок #critical-css не найден');
}

// 3. Добавление статического preload для LCP-изображения
const lcpPreloadTag = '<link rel="preload" href="/media/dishes/1-card.webp" as="image" type="image/webp" fetchpriority="high">';

if (!html.includes('href="/media/dishes/1-card.webp" as="image"')) {
  const fontPreloadHook = '<link rel="preload" href="/app/ui/fonts/golos-text-400.woff2" as="font" type="font/woff2" crossorigin>';
  if (html.includes(fontPreloadHook)) {
    html = html.replace(fontPreloadHook, `${fontPreloadHook}\n  ${lcpPreloadTag}`);
    console.log('✓ Статический preload для LCP-изображения добавлен в <head>');
  } else {
    html = html.replace('</head>', `  ${lcpPreloadTag}\n</head>`);
    console.log('✓ Preload для LCP-изображения добавлен перед </head>');
  }
} else {
  console.log('ℹ Preload для LCP-изображения уже присутствует');
}

// 4. Синхронизация aria-label кнопки бонусов (WCAG 2.5.3)
const oldBonusAttr = 'id="mbonusBtn" type="button" aria-label="Бонусы"';
const newBonusAttr = 'id="mbonusBtn" type="button" aria-label="Бонусы: 0 из 10"';

if (html.includes(oldBonusAttr)) {
  html = html.replace(oldBonusAttr, newBonusAttr);
  console.log('✓ Атрибут aria-label для #mbonusBtn обновлен');
} else {
  console.log('ℹ Кнопка #mbonusBtn уже обновлена или имеет другой формат атрибутов');
}

// 5. Запись изменений
fs.writeFileSync(filePath, html, 'utf8');
console.log(`\nУспешно! Файл ${filePath} обновлен.`);