# D2 — клиентская оболочка Zerno

> **Статус:** согласовано для реализации · 2026-11-03  
> **Ветка:** `feat/customer-shell-d2`  
> **Целевая база:** `design/customer-experience-redesign` (D1, основана на `pizza@4bd2fd3`)  
> **Область:** header, brand switch, ticker integration, responsive category navigation, unchanged catalog grid.

## 1. Решение

D2 перестраивает общую оболочку витрины двух брендов, не переписывая каталоги и их бизнес-логику. На мобильных категория становится горизонтальной строкой в потоке непосредственно перед содержимым каталога; на ширине от 821 px остаётся вертикальным боковым рейлом. В навигации используются существующие `#rail` и `#deliveryRail`, а не новые компоненты или копии.

Отдельный shortcut бонусов `#mbonusBtn` удаляется. Для Coffee единственная точка входа в бонусы — профиль через `#profileTopBtn`, затем существующая вкладка `#tabBonus`. Экран штампов, прогресс, QR и погашение подарка остаются в `profile.js`; в Delivery вкладка по-прежнему скрыта, а `setTab('bonus')` переводит пользователя обратно в профиль.

## 2. Цели и не-цели

### Цели
- Освободить мобильную ширину каталога, убрав постоянно зарезервированную колонку вертикального рейла.
- Сохранить привычный вертикальный rail на desktop.
- Разместить мобильные категории после заголовка/поиска и до карточек.
- Сохранить владельцев состояния, обработчиков, рендера и ScrollSpy.
- Упростить общую шапку: логотип, переключатель заведения и профиль без отдельного бонусного FAB/pill.
- Не менять сетку карточек, тикерную механику, тарифы, API и сценарии персонала.

### Не-цели
- Переписывать `menu.js`, `delivery.js` или модель категорий в единый модуль.
- Добавлять независимый category state, второй ScrollSpy либо дублированную desktop/mobile разметку.
- Перестраивать товарные карточки, поиск, subfilters, корзину, checkout или профиль.
- Изменять текст/контент, клонирование, ResizeObserver или анимацию тикера в `admin-extra.js`.
- Перерисовывать логотипы или менять брендовые токены ради нового визуального языка.
- Менять staff header/режимы, кроме безопасного удаления клиентского bonus shortcut.

## 3. Наблюдаемая текущая архитектура

- `public/index.html`: исходная оболочка. Coffee `#rail` находится внутри `#menuView` после `.menu-head` и перед `#grid`; Delivery `#deliveryRail` — внутри `#deliveryView` после `#deliveryBanner` и перед `#deliverySubFilter`. Это нативный mobile DOM-порядок и не требует JS-переезда на первом кадре.
- `public/app/core/views.js`: владелец переключения бренда, видимости видов и runtime layout; `syncViewsVisibility()` управляет видимостью `#menuView`, `#deliveryView` и соответствующих рейлов. Breakpoint-controller оставляет рейлы внутри view на ширине ≤820 px и переносит те же DOM-узлы в `.wrap` только на desktop; при resize возвращает их обратно.
- `public/app/menu.js`: владеет Coffee `#rail`, его кнопками `data-cat`, переменной `cat`, click handler и фильтрацией `#grid`. Coffee в текущем коде переключает категорию по клику; отдельный ScrollSpy в просмотренных исходниках не обнаружен.
- `public/app/delivery.js`: владеет Delivery `#deliveryRail`, `dcat`, click handler, сеткой `#deliveryGrid` и `syncRailActiveOnScroll()`. ScrollSpy определяет текущую категорию по видимым карточкам и переключает `.on` на рейле.
- `public/app/ui/scrolltop.js`: единственный владелец desktop геометрии вертикального рейла через `alignRailWithCard()` и `updateRailStickyPosition()`. Сейчас он предполагает, что parent рейла — `.wrap`; для mobile flow этот расчёт должен быть отключён и очищать inline sticky-позицию.
- `public/app/core/panel.js`: владеет вкладками и открытием профиля. Существующая вкладка `#tabBonus` уже показывает `#pvBonus`; API/данные бонусов не требуют переноса.
- `public/app/profile.js`: владеет бонусной моделью UI, QR, штампами, прогрессом и погашением. `updateMbonusBadge()` используется только удаляемым shortcut и может быть убран после удаления ссылок.
- `public/app/core/auth.js`: `#profileTopBtn` открывает существующий профиль; это становится общей точкой входа в account panel.
- `public/app/core/preorder-timer.js`: делегированный click selector содержит `#mbonusBtn`; после удаления shortcut остаётся `#profileTopBtn` и остальные действующие триггеры.
- `public/app/ui/theme/160-11-canonical-grid-menu.css`: содержит согласованную сетку карточек 1/2/3/4 и desktop rail geometry. Grid breakpoints остаются без изменений.
- `public/index.html` содержит critical CSS-зеркало первого кадра. Mobile one-column shell и отсутствие bonus FAB должны быть согласованы с deferred theme CSS, чтобы не возникал FOUC/CLS.

## 4. Инварианты

1. В DOM существует ровно один `#rail` и один `#deliveryRail`.
2. Переезд выполняется через `appendChild/insertBefore` уже созданного узла; node identity, ID, listeners, button data attributes и локальное состояние сохраняются.
3. При ширине ≤820 px `#rail` находится в `#menuView` после `.menu-head` и непосредственно перед `#grid`; `#deliveryRail` находится в `#deliveryView` после `#deliveryBanner` и перед `#deliverySubFilter` / `#deliveryGrid`.
4. При ширине ≥821 px оба рейла восстановлены прямыми детьми `.wrap` перед общей `section`, в исходном порядке.
5. Переключатель breakpoint идемпотентен; вызов повторно в той же зоне не создаёт перемещений/дубликатов.
6. На mobile rail — обычный горизонтальный flow: `display:flex`, `flex-direction:row`, `overflow-x:auto`, без sticky top/transform/позиционирования из desktop helper.
7. На desktop rail остаётся вертикальным; `scrolltop.js` продолжает рассчитывать существующую безопасную позицию.
8. Delivery ScrollSpy продолжает обновлять активную категорию и при горизонтальном представлении обеспечивает видимость активной кнопки без вертикального `scrollIntoView`. Отдельный Playwright-тест прокручивает rail к концу и проверяет, что вызов ScrollSpy возвращает active item в видимую область.
9. Coffee category clicks сохраняют фильтрацию через существующую переменную `cat`; не приписывать Coffee несуществующий ScrollSpy.
10. `#mbonusBtn` отсутствует в DOM и не создаётся runtime; бонусы Coffee доступны через account panel; Delivery bonus tab остаётся скрытой.
11. Никаких API, DB, роли, цены, промокода или бонусных правил в D2 не меняется.
12. Ticker content, clone lifecycle, ResizeObserver и animation owner остаются в `admin-extra.js`; D2 не переписывает механизм движения.

## 5. Предлагаемый механизм

### 5.1. Responsive rail reparenting

Исходный HTML — mobile-first: Coffee rail находится внутри `#menuView` между `.menu-head` и `#grid`, Delivery rail — внутри `#deliveryView` между `#deliveryBanner` и `#deliverySubFilter`. Поэтому мобильный первый кадр не зависит от загрузки JS и не ждёт переноса DOM.

В `views.js` контроллер на `matchMedia('(max-width: 820px)')`:
- на старте оставляет rail nodes в исходных mobile-flow позициях при ширине ≤820 px;
- на ширине ≥821 px помещает те же узлы прямыми детьми `.wrap` перед общей `section`;
- при изменении breakpoint выполняет обратный перенос без клонирования, пересоздания обработчиков или потери state;
- слушает только `change` event, не создаёт observers/polling loops.

На desktop critical CSS скрывает вложенные rail nodes до reparenting; после переноса `scrolltop.js` вычисляет прежнюю вертикальную sticky-геометрию.

### 5.2. Mobile category strip

- Сменить mobile `.wrap` с 80 px rail column на одну колонку.
- Заголовок/поиск занимают ширину секции, без компенсации через `--menu-rail-width` и отрицательный margin.
- Coffee rail следует за `.menu-head`; Delivery rail следует за `.menu-head` и `#deliveryBanner`, но остаётся перед контекстным subfilter и grid.
- Кнопки имеют горизонтальный ряд, фиксированную по содержимому ширину и минимум 44 px по высоте; длинные названия не расширяют страницу.
- Active item прокручивается внутри rail container только по горизонтали.
- Existing desktop rail selectors должны быть ограничены direct-child rail nodes у `.wrap`, чтобы вложенные mobile nodes не унаследовали desktop sticky geometry.
- Базовая сетка карточек остаётся: до 519 — 1, 520–1180 — 2, 1181–1599 — 3, 1600+ — 4.

### 5.3. Bonus shortcut removal

Удалить `#mbonusBtn` markup, critical/deferred positioning CSS, click handler и связанные IntersectionObserver/style selectors. Удалить вызовы/объявление `updateMbonusBadge()` только после проверки всех ссылок. Убрать упоминание shortcut в `preorder-timer.js`. Сохранить `#tabBonus`, `#pvBonus`, `renderBonus()`, QR и redeem flow. Не делать отдельную бонусную кнопку в profile body: вкладка уже является существующей и проверенной навигацией панели.

### 5.4. Header and ticker

Удаление bonus shortcut высвобождает место в topbar; аватар остаётся справа. Брендовый знак/логотип и dropdown venue switch сохраняют IDs и handlers. Для Coffee subtitle сохранить существующий зарезервированный слот и существующую проверку overlap. Ticker markup/styles/content/animation remain unchanged; проверить соседство тикера с шапкой и его ширину в обеих марках.

## 6. Альтернативы и причины отклонения

- **CSS-only grid/order:** отклонено для прежнего DOM. D2 меняет исходную HTML-структуру так, чтобы один rail-узел уже находился в требуемом mobile flow; desktop reparenting остаётся необходимым для боковой колонки. Никакие копии и CSS-подмены DOM-порядка не используются.
- **Дублированные mobile/desktop rails:** отклонено. Появится два DOM ID или придётся переносить состояние/обработчики, увеличивается риск рассинхронизации Coffee/Delivery category state.
- **Один общий category component/state:** отклонено. Бизнес-поведение Coffee и Delivery разное; у Delivery есть ScrollSpy и subfilters, у Coffee фильтр по `cat`. Объединение не нужно для визуального изменения.
- **Оставить FAB/bonus pill, скрывать только CSS:** отклонено. Это сохраняет ненужный DOM, listeners, CSS и второй отдельный вход в бонусы; пользователь выбрал удаление shortcut и доступ через профиль.

## 7. In-context challenge: риски и меры

Этот разбор выполнен тем же автором на основании исходников; это не независимое Goldfish review и не изолированный субагент.

- **YAGNI/сложность:** один media-query controller и перенос исходных nodes дешевле нового компонента. Не добавлять MutationObserver или второй state store.
- **UX:** на экранах 320–390 px horizontal rail должен быть scrollable без page overflow; active Delivery item должен оставаться видимым; touch targets не меньше 44 px.
- **Миграция/совместимость:** desktop parent и sticky logic восстанавливаются на ширине 821 px; проверяются resize туда-обратно и обычный viewport load.
- **Ошибки/восстановление:** отсутствующий anchor должен приводить к безопасному no-op; отсутствующая rail node не должна останавливать boot. Смена brand при mobile должна прятать неактивный rail так же, как сейчас.
- **Наблюдаемость:** добавить focused Playwright проверки placement, identity, click/ScrollSpy и бонусного входа; CI PR runs сохраняют diagnostics. Вне D2 ранее сообщённые владельцем 2 failed + 1 flaky теста не расследуются.
- **Долгосрочная поддержка:** обновить `docs/module-map.md`; явно отметить `views.js` как владельца только reparenting/layout, не category state; не менять business ownership модулей.
- **CSS/CLS:** critical CSS и deferred theme CSS должны совпадать на mobile rail geometry; версии ассетов не выставлять вручную — использовать `npm run build:client`.

## 8. Проверки и критерии приёмки

- Coffee и Delivery на 320, 390, 768, 820, 821 и 1440 px.
- Mobile: правильный parent, горизонтальный flex strip в потоке после меню head и до карточек; Delivery rail перед subfilter; отсутствует 80 px пустая колонка; нет document horizontal overflow.
- Desktop: оба rails direct child `.wrap`, vertical, centered/sticky behavior сохраняется.
- При переключении 390 → 1440 → 390 тот же узел сохраняет identity, listeners и работу click handlers.
- Delivery ScrollSpy по-прежнему переключает active category; активная кнопка видна в горизонтальной полосе.
- Coffee category click по-прежнему фильтрует каталог.
- Нет `#mbonusBtn` ни в DOM, ни в runtime; Coffee bonus tab доступна из profile; Delivery bonus tab скрыта.
- Header subtitle не перекрывает profile control; original logos не изменены; ticker продолжает занимать полную ширину и использовать существующий animation owner.
- Нет изменений API, cart, checkout, price logic, auth/session, permissions или staff workflows.
- CI: `npm run check`, `npm run pretest`, linters/audits/smoke, Bonus Lifecycle, Bonus Signup и полный Playwright; не считать проверку успешной до фактического успешного workflow.

## 9. Implementation sequence and rollback

1. Добавить focused Playwright tests на mobile flow, desktop reparenting, DOM identity, bonus entry и Delivery active-item reveal.
2. Реализовать mobile-first DOM placement, desktop reparenting в `views.js` и mobile reset/desktop align в `scrolltop.js`.
3. Перестроить mobile rail и wrap CSS в canonical theme и critical CSS.
4. Удалить bonus shortcut и его вспомогательные ссылки/стили; сохранить tab flow.
5. Обновить `docs/module-map.md` и D2 status в design doc.
6. Собрать через `npm run build:client`, не редактируя cache version вручную.
7. Проверить CI, screenshot diagnostics и обе марки на контрольных viewport; merge/deploy отдельно после согласования.
8. Rollback: revert D2 PR целиком; никаких миграций/данных для отката не требуется.

## 10. Открытые технические проверки

- Точный computed style и горизонтальная видимость active delivery item проверяются по Playwright после реализации.
- Если контентный banner Delivery создаётся асинхронно, insertion target остаётся `#deliverySubFilter`; rail должен быть размещён до него независимо от состояния баннера.
- Если breakpoint переключается во время открытой панели/состояния бренда, rail move не должен менять view visibility или фокус.
- Профиль entry point для гостя ведёт в существующий auth prompt, а после входа в профиль вкладка Bonus остаётся доступна; данные не клонируются в profile identity section.
