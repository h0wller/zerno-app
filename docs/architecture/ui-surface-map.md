# Карта UI-слоёв и пользовательских поверхностей Zerno

> Срез проверен по ветке `pizza`, commit `4bd2fd3ad19bdcd6a060e080100e72302923814e`, 2026-11-03.
> Это карта фактических точек входа и владельцев, а не новая нормативная архитектура. Там, где существующая документация противоречит исходникам, противоречие отмечено явно.

## 1. Точка входа и порядок инициализации

Клиент запускается как ESM-граф из `public/app/main.js`. Входной файл содержит только статические импорты; `core/bus.js` подключён первым, `core/boot.js` — последним. Порядок значим: он задаёт последовательность инициализации глобальных контрактов и модулей. Источник: [public/app/main.js].

Основные пользовательские поверхности:

- Кофейня: `#menuView`, `#rail`, `#grid`; рендер каталога и выбор категории — [public/app/menu.js: renderMenu, renderRail].
- Доставка: `#deliveryView`, `#deliveryRail`, `#deliveryGrid`; фильтры категории и вариантов — [public/app/delivery.js: renderDeliveryMenu, renderDeliveryRail, resolveDeliveryAddSelection].
- Общий каркас и переключение бренда/режима — [public/app/core/views.js: sv, syncViewsVisibility, syncStaffAndGuestControls, setMode].
- Переключатели ролей строятся отдельно — [public/app/core/catalog.js: renderModes].
- Корзина и оформление — [public/app/cart.js: renderCartBase, totalsNow, renderCart]; валидация адреса и времени — [public/app/checkout-validation.js: CheckoutValidation].
- Профиль и боковая панель — [public/app/core/panel.js: openPanel, closePanel]; профильные данные и заказы — [public/app/profile.js, public/app/profile-orders.js].
- Позиция мобильного/планшетного рейла — [public/app/ui/scrolltop.js: alignRailWithCard, updateRailStickyPosition].

## 2. Рендер и состояние каталогов

### Кофейня

`public/app/menu.js` владеет категорийным состоянием `cat`, поиском `query`, рендером `#grid` и `#rail`. Кнопки категории имеют `data-cat`; выбранная категория визуально отмечается классом `.on`. Поиск фильтрует название, описание и состав. Источник: [public/app/menu.js: coffeePool, renderMenu, renderRail].

### Доставка

`public/app/delivery.js` владеет `dcat`, `activeIngredient`, `activeAddonTab`, рендером `#deliveryRail` и `#deliveryGrid`. Категории формируются из `DCATS` с `data-dcat`; клик сбрасывает ingredient/add-on фильтры, обновляет меню и прокручивает к заголовку/поиску. Источники: [public/app/delivery.js: renderDeliveryRail, renderDeliveryMenu, renderSubFilter].

Выбор варианта товара не является косметическим состоянием: `resolveDeliveryAddSelection` требует выбранный вариант для товара с `opts`, получает цену и индекс, а `upsertDeliveryCartItem` сохраняет вариант, размер, цену и количество. Повторное добавление того же варианта увеличивает его количество. Источник: [public/app/delivery.js: resolveDeliveryAddSelection, upsertDeliveryCartItem, handleDeliveryAddClick].

## 3. Шапка и переключение ролей

`views.js` синхронизирует видимость кофейного/доставочного каталогов, staff controls, profile/bonus controls и FAB; `setMode` проверяет роль, меняет режим, переключает views, запускает соответствующие сервисы и обновляет кнопки. Источник: [public/app/core/views.js: sv, syncStaffAndGuestControls, canEnterMode, setMode].

`renderModes` строит доступные действия по роли:
- guest: «Гость»;
- cashier/admin: дополнительно «Кассир»;
- dispatch/cashier/admin: дополнительно «Заказы»;
- admin: дополнительно «Админ».

Обработчик делегирован на `#modeSeg` и вызывает `window.setMode`. Источник: [public/app/core/catalog.js: renderModes].

Переключение бренда во время режима cashier/orders переводит интерфейс обратно в guest перед сменой бренда. Источник: [public/app/core/views.js: applyBrandSelection, handleBrandSegmentClick].

## 4. Геометрия и позиционирование

### Рейл

На ширинах до 1180 px `160-11-canonical-grid-menu.css` задаёт каркас `.wrap` с колонкой рейла 80 px и колонкой контента `minmax(0, 1fr)`. Сам рейл вертикальный, sticky, с внутренним вертикальным скроллом и кнопками высотой 56 px (44 px в коротком landscape). На больших экранах ширина рейла увеличивается до 92 px. Источник: [public/app/ui/theme/160-11-canonical-grid-menu.css: responsive grid/rail rules].

Динамическое вертикальное позиционирование — отдельная ответственность `scrolltop.js`: он измеряет нижнюю границу шапки и menu-head, вычисляет доступную полосу viewport, помещает рейл по центру и ограничивает высоту. Для изменения размера/позиции одного CSS недостаточно: нужно учитывать [public/app/ui/scrolltop.js: alignRailWithCard, updateRailStickyPosition].

### Шапка и critical CSS

`160-06-delivery-header.css` задаёт базовую и responsive-геометрию `.topbar`, `.venueWrap`, `.brand`, `#profileTopBtn` и `#modeSeg`. В staff-режиме на узких экранах шапка увеличивается и выделяет отдельную строку для переключателей режима. Источник: [public/app/ui/theme/160-06-delivery-header.css].

`160-04-wrap-cls-sheets.css` содержит часть responsive/CLS-правил для wrap, panel, header и cart panel. В `public/index.html` также есть большой inline `#critical-css`, который заранее задаёт первый кадр и ряд layout-правил до применения theme CSS. Эти дубли нельзя автоматически удалять: до изменений нужно сопоставить вычисленные стили, загрузочный порядок и slow-network сценарии. Источники: [public/index.html: #critical-css], [public/app/ui/theme/160-04-wrap-cls-sheets.css], [public/app/ui/theme/160-06-delivery-header.css].

## 5. Корзина и checkout

`cart.js` — единственный владелец мутаций количества и рендера корзины. Ветка delivery.js сохраняет выбранные опции и добавляет товары; корзина синхронизирует текущие цены из меню и отображает актуальные суммы. Источники: [public/app/cart.js: renderCartBase, totalsNow, renderCart], [public/app/delivery.js: syncDeliveryCartPrices, upsertDeliveryCartItem].

`checkout-validation.js` проверяет населённый пункт, улицу, дом и актуальный временной слот; подсвечивает и фокусирует первое проблемное поле. Источник: [public/app/checkout-validation.js: resolveCheckoutAddress, resolveCheckoutSlot, flagField].

PR #130 уже реализовал раздельные строки subtotal/discount/delivery fee/total, объяснение скидок и бесплатной доставки, отсутствие угадываемого населённого пункта и пояснение обновлённой цены. Повторно проектировать эту же финансовую ясность не нужно; последующие изменения должны опираться на [tests/cart-checkout-clarity.spec.js] и [tests/cart-regress.spec.js].

## 6. Существующие проверки UX/UI

| Сценарий | Текущая защита |
|---|---|
| Геометрия header/menu-head/rail, обе марки, 320/390/768/1440 px, scroll | [tests/menu-header-rail-layout.spec.js] |
| Карточки обоих брендов, размеры, ряды, hit-targets | [tests/menu-cards.spec.js] |
| Снимки гостевых экранов, профиль/бонусы, касса и рабочие режимы | [tests/ui-baseline.spec.js] |
| Диалог регистрации: focus trap, Escape, focus restore, mobile sizing | [tests/auth-modal-ux.spec.js] |
| Labels, контраст границы поиска, hit targets, ticker, staff header | [tests/pour-accessibility.spec.js] |
| Смета корзины, скидки, адрес и стоимость доставки | [tests/cart-checkout-clarity.spec.js] |
| Мутации корзины, варианты, stepper и итог | [tests/cart-regress.spec.js] |

Наличие теста не означает, что сценарий исследован с реальным пользователем. Большинство имеющихся проверок — regression/geometry/accessibility automation, а не usability research.

## 7. Архитектурные расхождения документации

Обнаружены три несовпадающих описания CSS:
1. [PROJECT_RULES.md] задаёт три слоя: theme CSS, brand-tokens.css, runtime selectors in views.js, при этом в дополнительных правилах утверждает, что вся геометрия находится в theme и в views.js остаются брендовые overrides.
2. [docs/css-architecture.md] и [docs/module-map.md] продолжают описывать views.js как слой layout+brand, упоминают прежние inline style safeguards и часть уже мигрировавших владельцев.
3. [scripts/css-audit.mjs] — исполняемый источник конкретных CSS-инвариантов: theme !important/brand selectors/colors, allowlist runtime rules, brand-tokens purity, запрет токенов в views.js, logo inline safeguards, лимит 85 brand selectors и duplicate warnings.

Не следует переписывать CSS или удалять правила, опираясь только на один из этих описательных файлов. Следующий отдельный инженерный шаг — согласовать один нормативный документ с реально исполняемыми правилами и фактической загрузкой CSS, затем исправить остальные карты.

## 8. Границы этого среза

Проверены основные UI entry points, layout owners, ordering/cart flow и существующие регрессионные тесты. Не проводился полный аудит каждого staff screen и каждого API/error state; не запускались Playwright, Lighthouse, Axe или полное ручное тестирование. Live-публичная страница подтверждает общую структуру каталога, но не заменяет authenticated staff testing. Все предложения по изменению UX ниже следует считать гипотезами до визуального и usability-прогона.
