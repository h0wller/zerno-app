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


## 8. Production guest verification — 2026-11-13

**Verified source:** production deployment [run #43383317619](https://github.com/h0wller/zerno-app/actions/runs/43383317619), deployed SHA `c005b1c6832a5b722c97c43dd7cd525f638c209b` (branch `pizza`). The deploy job log confirms `git reset --hard origin/pizza`, successful client build, service-worker bump and PM2 online status.

- [x] Isolated unauthenticated guest sessions resolve `?brand=coffee` to `brand-coffee` / `data-brand=coffee`, and `?brand=delivery` to `brand-delivery` / `data-brand=delivery`.
- [x] First visible cards resolve to Эспрессо (coffee) and Маргарита (delivery); no staff-only controls were visible in the isolated guest sessions.
- [x] Runtime measurements at 320×740, 390×844, 768×1024 and 1440×900 for both brands found no horizontal overflow (`scrollWidth === clientWidth`).
- [x] Runtime-computed typography and brand tokens are recorded in `docs/audits/visual-ux-scorecard.md`.
- [x] Production revision is linked to the successful deployment SHA above; the live `STATIC_CACHE=v3553` was generated from `v646` by that build's `BUILD_NUM` bump.
- [ ] Persistent archive and individual visual review of all eight production first-viewport PNGs. The two 390×844 brand captures were visually inspected previously but were not saved into the repository; the later browser automation could not set exact viewport sizes or export image files.
- [ ] Cold-first-paint vs hydrated comparison on production.
- [ ] Customer cart, checkout, profile, bonuses, order confirmation/tracking, and staff roles remain outside this guest-menu baseline.

A browser automation attempt that reported a 1007×1007 actual viewport is classified as incomplete and is not used as evidence for the requested viewport matrix. Do not mark the screenshot protocol complete until the eight production PNGs are archived and inspected.
