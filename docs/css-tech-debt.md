# CSS Tech Debt — известные отклонения от 3-слойной архитектуры

**Дата фиксации:** 22 сентября 2026
**Статус:** работает корректно, архитектурно требует рефакторинга

## Известные отклонения

### P1 — Слой 0 раздут

`public/index.html` inline `<style>` содержит ~90% всего UI (карточки, модалки,
чат, корзину, рейл, `.wrap`), а не только критический рендеринг.

**Правильно:** только safe-area, размеры логотипа первого кадра, FOUC-guard.
**Планируется:** поэтапный перенос в `theme-v2.css` (Слой 1).

### P2 — дубли правил Слоя 0 и Слоя 2

`.topbar`, `.venueToggle`, `#brandSeg` описаны и в `index.html`, и в `views.js`.

### P2 — `--topbar-h` в Слое 0

Токен должен быть в `theme-v2.css :root`, а не в inline `<style>`.

### P3 — `styles.js` смешивает слои

Runtime-файл содержит базовые компоненты (`.siteFooter`, `.omCard`) и layout
(`.cartPanel ≥900px`, `#grid 3-4 col`).

### P3 — дубль `.donoff`

Правило есть и в `theme-v2.css`, и в `styles.js`. Владелец — `theme-v2.css`.

## Не чинить срочно

Рефакторинг Слоя 0 рискован — легко сломать FOUC, размеры логотипа, splash-guard.
Делать отдельным этапом с проверкой после каждого шага.
**Прогресс:** чанк 1 (cartPanel/тикер/сплэш) — Фаза 4; чанк 2 (модалки + полноэкранный QR) — F5.7:
база → theme-v2.css, бренд → views.js, .chk де-!important через специфичность.
чанк 3 (чат + chatFab) — F5.8: база → theme-v2.css, владелец .chatHint переехал из views.js,
armed/pulse — styles.js; пульс бара подсказок теперь 3 цикла (hintPulse) вместо бесконечного.
чанк 4 (карточки меню + правая панель) — F5.9: база → theme-v2.css, 4 бренд-правила → views.js,
!important снят через специфичность (.card .tag.hit, .stats .stat, #pvBonus .stamp/.freeCard).
чанк 5 (кассир) — F5.10: механический перенос с предохранителями,
база → theme-v2.css, бренд → views.js; правила с !important без компенсации
остаются в Слое 0 до ручной доработки.
чанк 6b (F5.11b): residual растворён — 3 системных/layout правила → views.js,
.ava.pulse-hint → theme-v2 без !important; большой инлайн-`<style>` = только «шапка» + «каркас».
чанк 8 (F5.13) — ФИНАЛ P1/P2: большой инлайн-`<style>` растворён целиком (35 правил базы → theme-v2,
14 бренд/layout → views.js, 3 → critical CRITICAL-first-frame, 3 DROP марка, --amber смерджен).
F5.13b: дубль delivery-марки слит union-слиянием деклараций (старое правило перебивает конфликты).
P1/P2 = закрыто; Слой 0 = splash-guard + critical-блок.

### чанк 9 (F5.43–F5.51) — ФИНАЛ P2/P3 и ликвидация Specificity War
- **F5.43–F5.44**: Token Inversion Pattern — введены токены `--topbar-*`, `--venue-toggle-*`, `--cart-qty-*`, `--cashier-bg` в `brand-tokens.css` (Слой 2а). База `#deliveryGrid`, `.opts`, `.venueToggle`, `.topbar` перенесена в `theme-v2.css` (Слой 1) без единого `!important`.
- **F5.45**: Из `views.js` (Слой 2б) удалены дубли модалки сплэша, `#deliveryGrid` и селекторы с `!important`.
- **F5.46**: Из `styles.js` (Слой 3) полностью удалён блок десктопной корзины `.cartPanel ≥900px !important`. Сетка `.grid` нормализована в Слое 1.
- **F5.47**: Из `<style id="critical-css">` в `index.html` (Слой 0) удалены дубли шапки, тикера и сплэша. Оставлен чистый FOUC-скелет.
- **F5.49–F5.51**: Устранён дубль-владелец марки `.brand .mark`. Базовые стили `#myOrders`, `.myOrderCard`, `.addonChip`, `.cta` перенесены в Слой 1.
- **Итог**: P1, P2 и P3 полностью ЗАКРЫТЫ. Конфликтов между 4 слоями нет.
