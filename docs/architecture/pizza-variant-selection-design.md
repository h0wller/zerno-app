# Технический дизайн: доступный выбор варианта пиццы

> **Статус:** Draft для review; не разрешение на runtime-реализацию.
> **Концепт:** [pizza-variant-selection-concept.md](./pizza-variant-selection-concept.md).
> **Базовый код:** ветка pizza, commit 4bd2fd3ad19bdcd6a060e080100e72302923814e.
> **Область:** только опции в карточке пиццы и передача выбранной опции в существующую корзину.

## 1. Цель и инварианты

Заменить toggle-подобные кнопки опций на нативную radio group, сохранив компактную двухколоночную сетку и весь текущий cart/server contract. Без явного выбора Add не должен менять корзину; ошибка должна быть видима и доступна для клавиатуры и assistive technology.

Сохранить без изменений:
- индекс опции — индекс исходной записи в opts[];
- cart key — product.id + "_" + optionIndex;
- поля cart item: id, oi, name, opt, price, sz, qty;
- повторный Add того же oi увеличивает qty той же строки; другой oi создаёт отдельную строку;
- syncDeliveryCartPrices продолжает обновлять цену/label/size по актуальному меню;
- серверный POST /api/orders проверяет oi и вычисляет цену по menu.opts;
- cart.js остаётся единственным владельцем quantity mutations.

## 2. Текущие владельцы

| Ответственность | Файл и символ |
|---|---|
| HTML опций | public/app/delivery.js: renderPizzaOptsHtml |
| Карточка / повторный render первой карточки | renderDeliveryCard, updateFirstDeliveryCard |
| Клик по свободной части карточки | handleDeliveryCardClick |
| Выбор | handleDeliveryOptionClick |
| Проверка перед Add | resolveDeliveryAddSelection |
| Запись/инкремент cart item | upsertDeliveryCartItem |
| Cart rendering/mutations | public/app/cart.js |
| Серверная проверка варианта и цены | server/routes/orders.js: POST /api/orders |
| Сетка/плитки | public/app/ui/theme/160-09-preorder-subfilters.css |
| Типографика/min-height | public/app/ui/theme/160-11-canonical-grid-menu.css |
| Брендовые overrides и runtime CSS | public/app/core/views.js |
| Первый кадр | public/index.html: #critical-css |

## 3. DOM и доступность

renderPizzaOptsHtml должен создать один fieldset.opts на карточку, legend с именем «Размер и тесто» и по одному нативному input[type=radio] внутри label.opt-btn для каждого элемента opts[].

Каждый label визуально сохраняет текущую компоновку: первая строка — размер и тесто, вторая — вес и цена. Radio получает уникальный name на основе product id; value и data-oi остаются индексом записи opts[]. Accessible name radio должен включать размер, тесто, вес и цену.

Не добавлять вручную role=radiogroup, role=radio или aria-checked: native input уже предоставляет семантику. Не скрывать input через display:none или visibility:hidden — он должен оставаться focusable. Не добавлять required без настоящей form-validity boundary: Add проверяется существующим обработчиком.

Внешняя плитка остаётся label. Checked-state оформляется через input:checked + .opt-content; focus-visible — через input:focus-visible + .opt-content. Не дублировать checked в ручном .sel. Добавить заметный маркер выбора, не зависящий только от цвета. Сохранить брендовые токены «Пятницы» и touch target не менее 44×44 px. Не использовать :has().

Нативные radio группируются по одинаковому name. WAI-ARIA APG описывает для radio group Tab/Shift+Tab, Space и стрелки; MDN описывает name как ключ группировки. См. [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) и [MDN radio input](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/radio).

## 4. События и ошибка

### Выбор

Заменить handleDeliveryOptionClick на delegated change handler для radio input внутри #deliveryGrid. Не переключать .sel вручную: браузер сам управляет checked, взаимоисключением и клавиатурой. При change очистить inline error, aria-describedby и shake для текущей группы.

### Обязательная поправка click delegation

Сейчас handleDeliveryGridClick вызывает handleDeliveryCardClick раньше обработчика опций. handleDeliveryCardClick исключает e.target.closest('.opts button'). После миграции на label/input клик по подписи опции перестанет попадать под это исключение и может запускать ошибку выбора из обработчика всей карточки.

Поэтому:
1. Клик внутри .opts должен завершаться в handleDeliveryGridClick до handleDeliveryCardClick, Add и stepper handlers.
2. Выбор обрабатывается отдельным delegated change на #deliveryGrid.
3. handleDeliveryCardClick проверяет input[type=radio]:checked, не .sel.
4. Клики по [data-add], [data-step], .edBtn и .donoff сохраняют прежние маршруты.
5. Отдельный RED-тест подтверждает, что клик по label выбирает только radio и не вызывает ложную ошибку.

### Add без выбора

resolveDeliveryAddSelection ищет checked radio в текущем .cbody. Если product имеет opts, но checked radio отсутствует:
- не вызывать upsertDeliveryCartItem;
- показать inline error «Выберите размер и тесто»;
- временно связать fieldset с сообщением через aria-describedby;
- сфокусировать первый radio и прокрутить группу в видимую область;
- сохранить возврат null, чтобы текущая Add-цепочка не меняла корзину.

При выборе radio ошибка скрывается, aria-describedby очищается. Клик по свободной части карточки использует тот же helper ошибки. Текущий toast можно оставить дополнительной обратной связью только после ручного screen-reader прогона на предмет двойного объявления.

### Временное состояние и повторный render

Checked state живёт в DOM и не сохраняется в localStorage/sessionStorage до Add. При повторном render карточки незавершённый выбор очищается; cart item уже добавленной опции остаётся сохранённым.

updateFirstDeliveryCard переписывает .cbody.innerHTML, поэтому все listeners должны быть делегированы с #deliveryGrid, а не с каждого radio/label.

## 5. Cart / API / server

Меняется только источник выбранной опции в resolveDeliveryAddSelection:
- optionIndex берётся из selectedRadio.dataset.oi;
- option — product.opts[optionIndex];
- price — Number(option.p);
- opt — option.l;
- sz — Number(option.sz) || 0.

upsertDeliveryCartItem, cart row rendering, stepper, promo, subtotal и checkout не переписывать. POST /api/orders продолжает проверять li.oi, разрешать опцию в server-side menu.opts и вычислять цену на сервере. Новых API-полей, endpoints, pricing rules и миграций БД не требуется.

## 6. CSS scope

| Файл | Точечное изменение |
|---|---|
| 160-09-preorder-subfilters.css | fieldset/legend reset; label плитка; checked/focus/error styles |
| 160-11-canonical-grid-menu.css | типографика и min-height на label/content, не на button |
| public/app/core/views.js | обновить generic active selector и brand delivery selectors с button/.sel на label/checked |
| public/index.html #critical-css | согласовать зеркальные tile/grid selectors первого кадра |
| scripts/css-audit.mjs | проверить разрешённые CSS layers и duplicate-owner warnings |

Не добавлять !important, [data-brand] или hard-coded craft colors в theme CSS. Брендовые overrides остаются в views.js. Critical CSS — намеренное FOUC/layout mirror, не новый владелец компонента. Обновлять существующие canonical blocks, не добавлять второй набор правил. Удалить устаревшие .opts button.sel селекторы после миграции.

## 7. Тест-план

Новый spec: tests/pizza-variant-selection.spec.js. В текущем playwright.config.js Mobile Chrome исключает только menu-cards.spec.js, поэтому новый spec запускается в обоих проектах. Fixture menu-cards уже содержит шесть пицц с четырьмя вариантами; использовать его повторно или сделать локальную fixture-копию. Не хардкодить цены в production code.

Первый runtime commit — RED: PZ-01–PZ-06 должны упасть на текущей button-разметке/поведении. Проверять пользовательское состояние, не spy на внутренние функции.

| ID | Сценарий | Проверка |
|---|---|---|
| PZ-01 | Рендер 4 options | Четыре radio, none checked, уникальный name per product |
| PZ-02 | Доступность | Group «Размер и тесто»; radio names включают размер/тесто/вес/цену |
| PZ-03 | Выбор второй опции | Она checked, остальные unchecked; marker и checked style согласованы |
| PZ-04 | Повторный клик по выбранной | Checked не сбрасывается |
| PZ-05 | Клавиатура | Tab входит/выходит; arrows перемещают/выбирают; Space выбирает focused radio |
| PZ-06 | Add без выбора | Inline error виден; фокус на первом radio; cart и zt_cart неизменны |
| PZ-07 | Add выбранной опции | Cart item содержит ожидаемые oi/opt/price/sz/qty |
| PZ-08 | Повторный Add того же oi | Одна строка; qty увеличен на 1 |
| PZ-09 | Add другого oi | Две строки и корректная общая сумма |
| PZ-10 | Reload / menu sync | Cart variant и актуальные price/label сохраняются без изменения oi |
| PZ-11 | Viewport matrix | 320×568, 360×640, 375×667, 390×844, 768×1024, 1280×800; нет обрезания/overflow; hit target ≥44 px |
| PZ-12 | Два browser projects | Chromium и Mobile Chrome; pageerror пуст |

Playwright: getByRole('group') / getByRole('radio'), toBeChecked(), locator.press('ArrowRight') / press('Space'), web-first assertions, boundingBox() и computed styles. Проверить radio group в двух карточках одновременно, чтобы доказать разные name. Cart DOM и localStorage — внешнее состояние.

## 8. Порядок реализации и команды

1. Создать отдельную feature branch от актуального pizza; runtime code не добавлять в PR #131.
2. RED: новый spec PZ-01–PZ-06, получить ожидаемые падения.
3. Markup: renderPizzaOptsHtml → fieldset/legend/label/radio; сохранить data-oi и data model.
4. Events: убрать ручной .sel toggle; delegated change; исключить option click из handleDeliveryCardClick; обновить checked lookup.
5. Error helper: inline message, aria description, focus/scroll, reset on change; cart write path не менять.
6. CSS: canonical theme selectors, brand runtime overrides, critical mirror; проверить diff и duplicate owners.
7. GREEN: PZ-01–PZ-12 и menu-cards/cart-regress/cart-checkout-clarity.
8. Screenshots до/после на 320×568 и 390×844; затем Ponytail review, same-context EGM review и GitHub code review.
9. Перед promotion проверить PWA cold start и Telegram Mini App на iOS/Android.

Node 22, корень проекта:
- npm run build:client
- npx playwright test tests/pizza-variant-selection.spec.js tests/menu-cards.spec.js tests/cart-regress.spec.js tests/cart-checkout-clarity.spec.js
- npm run pretest
- npm run test:e2e
- npm run lint:code

build:client обновляет STATIC_CACHE и client bundle; не запускать до runtime changes. npm run pretest обязателен. test:e2e повторно собирает клиент, поэтому проверять фактический порядок сборки и generated artifacts по working tree/CI и не фиксировать артефакты без diff review.

## 9. Сбои, rollback, диагностика

- Пустой opts: прежний single-meta renderer, без пустой radio group.
- Неверный data-oi/индекс: не добавлять товар; не брать product.price для item с options.
- Если oi сохранённой строки больше не существует в обновлённом меню, не подменять опцию молча; UX stale option вне scope.
- После re-render delegated events продолжают работать; фокус не ссылается на удалённый input.
- Если AT не объявляет ошибку, визуальное сообщение остаётся видимым; ручная AT проверка обязательна перед релизом.

Rollback — вернуть прежние renderer, click handler и CSS selectors. Cart item, API и БД не мигрируют. Для диагностики проверять pageerror, failed requests и screenshots; не логировать токены и checkout-персональные данные.

## 10. Компромиссы и открытые вопросы

| Вариант | Оценка |
|---|---|
| Native fieldset/radio/label | **Выбран:** нативная семантика, checked, keyboard и focus; минимум custom interaction code |
| Buttons + aria-pressed | Не выбран: toggle-button semantics вместо radio group; keyboard пришлось бы поддерживать вручную |
| Size → crust в два шага | Не выбран: больше шагов и скрытое сравнение цен при четырёх вариантах |

Зафиксировано владельцем продукта: первый сценарий — выбор пиццы; native radio без preselection; inline error при Add без выбора; сохраняется текущая сетка и cart/server contract.

До runtime PR подтвердить два визуальных нюанса:
1. Видимый компактный legend «Размер и тесто» или визуально скрытый legend с accessible group name. Рекомендация — видимый; проверить высоту на 320×568 и 390×844.
2. Оставлять ли toast вместе с inline error. Рекомендация — только если ручной screen-reader прогон не создаёт двойного объявления.

Не выполнены VoiceOver/TalkBack, axe, Playwright или performance checks для изменённого кода, поскольку реализации ещё нет. Live screenshot pixels не просмотрены. Graphify — статическая подсказка; Playwright-файлы сверены напрямую.

## 11. Источники

Код: delivery.js (renderPizzaOptsHtml, renderDeliveryCard, updateFirstDeliveryCard, handleDeliveryCardClick, handleDeliveryOptionClick, resolveDeliveryAddSelection, upsertDeliveryCartItem, handleDeliveryGridClick); cart.js; server/routes/orders.js; 160-09-preorder-subfilters.css; 160-11-canonical-grid-menu.css; views.js; index.html #critical-css; menu-cards.spec.js; cart-regress.spec.js; cart-checkout-clarity.spec.js; playwright.config.js; PROJECT_RULES.md.

Документация:
- [WAI-ARIA APG — Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
- [MDN — input type=radio](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/radio)
- [Playwright 1.64.1 — toBeChecked](https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-be-checked)
- [Playwright 1.64.1 — radio actions](https://playwright.dev/docs/input#check-and-assert-checkboxes-and-radio-buttons)

## 12. Гейт перехода к реализации

После review draft runtime PR должен быть отдельным от PR #131. Scope: delivery.js, существующие theme/critical/runtime CSS selectors, новый tests/pizza-variant-selection.spec.js и необходимые cache/bundle artifacts. cart.js, API, server route, DB schema и pricing остаются функционально неизменными.

До runtime PR остаётся подтвердить legend и сохранение/отключение toast; остальные решения следуют из принятого UX-концепта и исходных контрактов.
