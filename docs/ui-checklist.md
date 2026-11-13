# UI/UX acceptance checklist — Zerno

**Статус:** текущий рабочий чек-лист, не исторический pre-refactor baseline.
**Проверяемая база:** ветка `pizza`; production URL: `https://friday.andcoffee.online/`.
**Последнее обновление:** 2026-11-13.

Этот список описывает требуемое покрытие. Галочки ставятся только по реально выполненному browser test/manual review с указанием commit, viewport и состояния роли. Отсутствие отметки не означает, что функция сломана.

## 1. Guest — coffee brand
- [ ] Cold open с `?brand=coffee`, корректный бренд/марка/текст/тема.
- [ ] Переключение coffee → delivery → coffee без чужих DOM-элементов и stale state.
- [ ] Первый экран: шапка компактная; logo, brand controls и profile имеют сбалансированное выравнивание.
- [ ] Текст «кофейня на берегу моря» читается и не обрезается.
- [ ] Меню: поиск, категории, карточки, состав, размеры/объёмы и цены.
- [ ] Профиль, бонусы, штампы, QR, чат и мои заказы.
- [ ] Keyboard focus, labels, contrast и target size.

## 2. Guest — delivery brand
- [ ] Cold open с `?brand=delivery`, правильный цвет, логотип, ticker, меню доставки.
- [ ] Ticker расположен под шапкой и не создаёт лишний зазор/тень. При обычной настройке движения ticker работает; при `prefers-reduced-motion: reduce` автоматическая анимация отключена, а содержимое остаётся доступным для ручной прокрутки.
- [ ] Гостевой switcher + logo + profile находятся в одной компактной строке и визуально центрированы.
- [ ] Категорийный rail располагается под шапкой и поиском и центрируется; нет горизонтального overflow.
- [ ] Поиск: постоянный label, видимый focus, полезное empty state.
- [ ] Карточка пиццы: читаемые параметры и цены, явный выбор варианта без неверного preselection; ошибка выбора видима и доступна.
- [ ] Модификаторы/добавки: состояние, цена и доступность понятны.
- [ ] Корзина: строки, раскрытие добавок, удаление соседней строки, qty, итоги, скидки, доставка/самовывоз.
- [ ] Checkout: адрес, слот, оплата, комментарий, validation, повторное открытие/закрытие.
- [ ] Заказ: блокировка повторного клика; отдельно проверять серверную идемпотентность при retry/reload.
- [ ] Профиль, история заказа, чат.

## 3. Staff roles
- [ ] Cashier: поиск/создание гостя, проверка личности, штамп, списание, QR scanner, журнал.
- [ ] Dispatcher: новые заказы, статусы, предзаказы, задержки с причиной, чат.
- [ ] Admin: menu editor, stop-list, photos, promotions, dashboard, account settings.
- [ ] Staff controls не должны появляться в guest DOM/visual flow после гидратации.
- [ ] Возврат из profile/modal свайпом и кнопкой не вызывает скачок layout/header.

## 4. Responsive and performance
- [ ] Viewports: 320, 360, 390, 414, 520, 690, 820, 821, 1024, 1181, 1600 px (релевантные сценарии).
- [ ] Нет горизонтального overflow.
- [ ] Геометрия first paint совпадает с hydrated state.
- [ ] Медленная сеть: CSS/fonts/menu/image задержаны; измеряется CLS, не только скриншот после загрузки.
- [ ] Первые карточки и медиа имеют зарезервированное место; image priority соответствует реальному первому ряду.
- [ ] Safe-area и экранная клавиатура не перекрывают действия.

## 5. Screenshot protocol
Каждый набор скриншотов должен включать:
- дату и commit SHA/production build;
- роль/состояние auth и выбранный brand;
- viewport и device scale factor;
- состояние интерфейса (cold, hydrated, overlay/modal/cart/checkout);
- источник: Playwright CI artifact или проверенный browser session.

Именование: `<brand>-<role>-<state>-<viewport>-<commit>.png`.
Не публиковать скриншоты с персональными данными клиентов, активными заказами или секретами. Для гостевых снимков нужна чистая, явно гостевая сессия. Browser scrape с неопределённым auth state маркировать preliminary и не использовать как baseline.

## 6. Current unverified observations (2026-11-05)
- [ ] Production scrape по URL `?brand=delivery` вернул контент обеих витрин и блоки кассира/диспетчера/админа; чистая гостевая сессия и фактическая видимость каждого блока не подтверждены. Требуется isolating browser state.
- [ ] Ticker в извлечённом текстовом слое повторялся дважды; нужно проверить фактический DOM/CSS, это может быть loop copy либо дублированное содержимое.
- [ ] Scrape `?brand=coffee` вернул версию кофейного меню и delivery markup в общем документе; проверить ожидаемое dual-brand DOM и видимость после hydration.
- [ ] В видимом scrape content время/дни, дата обновления меню и брендовые meta/theme цвета выглядят неоднородными между URL; проверить локальную временную зону и runtime brand state.
- [ ] В delivery scrape показана строка «доставка 0 ₽» и самовывоз −10%; проверить точное условие eligibility, персональную бесплатную доставку и тексты, не обещающие бесплатную доставку всем.

Эти наблюдения — не подтверждённые UI-дефекты до проверки в реальном браузере.

## 7. Acceptance workflow
1. Получить isolated browser contexts для двух гостевых брендов и staff roles.
2. Снять baseline desktop/mobile до изменений.
3. Для каждого finding записать screenshot, DOM evidence, reproduction и severity.
4. Сформировать отдельные минимальные PR; не смешивать visual changes с backend/business logic.
5. В каждом PR: targeted Playwright, all CI gates, screenshots before/after, responsive review.
6. Обновлять этот документ вместе с изменением acceptance state.


## 9. Supporting CI screenshot review — 2026-11-13

- [x] Eight hydrated guest first-viewport screenshots in CI run [#3033](https://github.com/h0wller/zerno-app/actions/runs/43421869883) were individually inspected: coffee and delivery at 320×740, 390×844, 768×1024 and 1440×900. [Artifact #14034162976](https://github.com/h0wller/zerno-app/actions/runs/43421869883).
- [x] Test-server captures show the expected one-/two-/three-column catalog transitions, visible menu controls and no apparent text/variant/action overlap in the inspected first viewport.
- [x] Keep this artifact classified as localhost fixture evidence. The separate live-production eight-PNG archive is available in CI run [#3064](https://github.com/h0wller/zerno-app/actions/runs/43427135621), artifact [#14037897354](https://github.com/h0wller/zerno-app/actions/runs/43427135621/artifacts/14037897354).

## 8. Production guest verification — 2026-11-13

**Verified source:** production deployment [run #43383317619](https://github.com/h0wller/zerno-app/actions/runs/43383317619), deployed SHA `c005b1c6832a5b722c97c43dd7cd525f638c209b` (branch `pizza`). The deploy job log confirms `git reset --hard origin/pizza`, successful client build, service-worker bump and PM2 online status.

- [x] Isolated unauthenticated guest sessions resolve `?brand=coffee` to `brand-coffee` / `data-brand=coffee`, and `?brand=delivery` to `brand-delivery` / `data-brand=delivery`.
- [x] First visible cards resolve to Эспрессо (coffee) and Маргарита (delivery); no staff-only controls were visible in the isolated guest sessions.
- [x] Runtime measurements at 320×740, 390×844, 768×1024 and 1440×900 for both brands found no horizontal overflow (`scrollWidth === clientWidth`).
- [x] Runtime-computed typography and brand tokens are recorded in `docs/audits/visual-ux-scorecard.md`.
- [x] Production revision is linked to the successful deployment SHA above; the live `STATIC_CACHE=v3553` was generated from `v646` by that build's `BUILD_NUM` bump.
- [x] Persistent CI artifact and individual visual review of all eight production first-viewport PNGs completed in run [#3064](https://github.com/h0wller/zerno-app/actions/runs/43427135621), artifact [#14037897354](https://github.com/h0wller/zerno-app/actions/runs/43427135621/artifacts/14037897354).
- [ ] Cold-first-paint vs hydrated comparison on production.
- [ ] Customer cart, checkout, profile, bonuses, order confirmation/tracking, and staff roles remain outside this guest-menu baseline.

The earlier browser automation attempt that reported a 1007×1007 actual viewport remains classified as incomplete. It was superseded by the exact-viewport Playwright archive in CI run #3064; that run, not the earlier automation, closes the eight-image production first-viewport archive requirement.

## 10. Production guest runtime follow-up — 2026-11-13

- [x] Isolated guest sessions verified the expected active brand root for both URLs: `data-brand=coffee` / `brand-coffee` and `data-brand=delivery` / `brand-delivery`.
- [x] Staff-only controls were not visible in either isolated guest session.
- [x] Production DOM showed no horizontal overflow at 320×740, 390×844, 768×1024 and 1440×900 for both brands; vertical scrollbar width is excluded by comparing `scrollWidth` with `clientWidth`.
- [x] Persistent production PNG archive/manual inspection is complete: eight exact-viewport screenshots were archived and individually reviewed in CI run #3064, artifact #14037897354.
- [ ] Ticker duplicate/loop semantics, exact hidden dual-brand DOM inventory, discount eligibility wording, native iOS Safari and customer/staff overlay states remain unverified.
- Production identity is tied to commit `c005b1c6832a5b722c97c43dd7cd525f638c209b` by [successful Timeweb deploy run #43383317619](https://github.com/h0wller/zerno-app/actions/runs/43383317619); this is the current production baseline and not PR #203.


## 11. Production guest screenshot archive and visual review — 2026-11-13

**Source:** live production `https://friday.andcoffee.online/`, deployed commit `c005b1c6832a5b722c97c43dd7cd525f638c209b`, independently linked to Timeweb deploy run [#43383317619](https://github.com/h0wller/zerno-app/actions/runs/43383317619).  
**Capture:** dedicated Playwright job in CI run [#3064](https://github.com/h0wller/zerno-app/actions/runs/43427135621). The test passed 1/1 and uploaded [artifact #14037897354](https://github.com/h0wller/zerno-app/actions/runs/43427135621/artifacts/14037897354), containing eight PNGs and a JSON manifest.

- [x] Coffee and delivery were captured at 320×740, 390×844, 768×1024 and 1440×900, device scale factor 1.
- [x] All eight images were individually opened and reviewed at native resolution.
- [x] The manifest confirms the requested viewport for every image, correct active `data-brand`, expected first product (Эспрессо / Маргарита), empty staff-control visibility list and no horizontal overflow.
- [x] Capture sessions were isolated and unauthenticated; service workers were blocked; no clicks, sign-in, cart actions, orders, payments or data writes were performed.
- [ ] Cold-first-paint vs hydrated comparison on production remains pending; this archive covers the hydrated first viewport.
- [ ] Customer cart, checkout, profile, bonuses, order confirmation/tracking and staff roles remain outside this guest-menu baseline.

**Visual observations for follow-up, not yet classified as defects:** the coffee search placeholder is shortened at 320px; the desktop coffee first viewport shows an empty outlined auxiliary panel; ticker separators render as small square marks. Their intended states/source characters must be checked before scoring or changing CSS.


## 12. Latest verification refresh — 2026-11-13

- [x] Current PR head `c63f170513e94d2b8cd6bf4167561492adb99c2f` passes [CI run #3078](https://github.com/h0wller/zerno-app/actions/runs/43431777234), 15/15 jobs.
- [x] Dedicated production guest screenshot job passes 1/1 and retains eight PNGs plus manifest in [artifact #14038748509](https://github.com/h0wller/zerno-app/actions/runs/43431777234/artifacts/14038748509).
- [x] Production deployment identity is verified as `c005b1c6832a5b722c97c43dd7cd525f638c209b` by Timeweb deploy run #43383317619.
- [ ] Cold-first-paint vs hydrated production comparison, customer cart/checkout/profile/bonus/order states, staff roles, native iOS and Telegram Mini App remain open.

The observations in section 6 are historical scrape observations, not current defects. The isolated guest verification and exact-viewport production archive in sections 8–11 supersede the old uncertainty about guest auth state, active brand selection and first-viewport responsive overflow. The ticker/discount/hidden-DOM observations remain open only where explicitly listed in the newer sections.
