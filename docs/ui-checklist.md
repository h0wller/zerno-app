# UI/UX acceptance checklist — Zerno

**Статус:** текущий рабочий чек-лист, не исторический pre-refactor baseline.
**Проверяемая база:** ветка `pizza`; production URL: `https://friday.andcoffee.online/`.
**Последнее обновление:** 2026-11-22.

Этот список описывает требуемое покрытие. Галочки ставятся только по реально выполненному browser test/manual review с указанием commit, viewport и состояния роли. Отсутствие отметки не означает, что функция сломана.

## 1. Guest — coffee brand
- [ ] Cold open с `?brand=coffee`, корректный бренд/марка/текст/тема.
- [ ] Переключение coffee → delivery → coffee без чужих DOM-элементов и stale state.
- [ ] Первый экран: шапка компактная; logo, brand controls и profile имеют сбалансированное выравнивание.
- [ ] Текст «кофейня на берегу моря» читается и не обрезается.
- [ ] Меню: поиск, категории, карточки, состав, размеры/объёмы и цены.
- [ ] Профиль, бонусы, штампы, QR, чат и мои заказы.
- [ ] Keyboard focus, labels, contrast и target size.

## 1A. Регистрация и активация
- [ ] Web/PWA: в форме регистрации есть явная кнопка «Зарегистрироваться через Telegram» после имени, телефона, PIN и согласия. В обычном браузере кнопка открывает Telegram через синхронный popup; при блокировке popup остаётся явная ссылка «Открыть Telegram».
- [ ] Web/PWA: Telegram-бот просит поделиться собственным контактом; номер сверяется с регистрационным номером. После подтверждения polling возвращает сессию в ту же вкладку и исходный бренд/экран, без session token в Telegram URL.
- [ ] Обычная кнопка «Создать профиль» не запускает SMS: профиль остаётся pending до отдельной активации; подпись рядом заранее объясняет, что активировать его можно в профиле.
- [ ] В профиле pending-гостя кнопка «Подтвердить через Telegram» видна без раскрытия; состояния ожидания, ошибки и истечения срока объясняют пользователю, что делать дальше. Popup fallback показывает ссылку «Открыть Telegram».
- [ ] «Активировать через кассира» — единственное сворачиваемое действие профиля; внутри доступны #actCode и #actBtn.
- [ ] В Telegram Mini App кнопка browser-регистрации скрыта; сохраняется native flow на подписанном initData и SDK openTelegramLink.
- [ ] Проверить оба бренда, 320×640, 360×640, 390×844, 844×390, 820×1024 и 1440×900; на коротком landscape регистрационная карточка прокручивается внутри себя и позволяет добраться до обеих CTA; горизонтального overflow нет, hit-targets гостевого интерфейса не меньше 44×44 px.

## 2. Guest — delivery brand
- [ ] Cold open с `?brand=delivery`, правильный цвет, логотип, ticker, меню доставки.
- [ ] После reload с ненулевой прокруткой mobile rail сразу отображается как fixed floating capsule у нижнего края viewport с учётом safe-area; scroll не переводит его в sticky/pinned-состояние.
- [ ] Mobile staff `#adminBar` остаётся в пределах content column без отрицательного `margin-left` и без расширения на ширину rail. Общая поверхность category rail остаётся без внешней рамки.
- [ ] На mobile и compact landscape rail всегда остаётся fixed floating capsule; `category-rail.js` очищает legacy inline sticky geometry. Spacer/pin-класс отсутствуют. Позиция — по центру снизу, 10px + safe-area, каталог резервирует ровно высоту capsule и edge gap.
- [ ] Ticker расположен под шапкой без лишнего зазора/тени и непрерывно движется даже если исходный текст короче viewport; копии синхронны и не дублируются в accessibility tree. Клик по строке или Space/Enter ставит движение на паузу/возобновляет его без видимого индикатора. `prefers-reduced-motion: reduce` отключает автозапуск, но явный запуск пользователя разрешён.
- [ ] Гостевой switcher + logo + profile находятся в одной компактной строке и визуально центрированы.
- [ ] На mobile и compact landscape категории распределяются по ширине floating capsule без внутреннего горизонтального скролла: полный набор coffee/delivery, 44px hit-area, accessible name и `aria-pressed`; до 340px видимые подписи скрыты, но доступные имена остаются. Поверхность capsule берётся из `--category-rail-bg`, активная вкладка имеет отдельный контрастный цвет. На desktop категории остаются вертикальным sidebar шириной 80px; сабфильтры доставки сохраняют отдельный горизонтальный scroll/pill-контракт.
- [ ] Поиск: постоянный label, видимый focus, полезное empty state.
- [ ] Карточка пиццы: читаемые параметры и цены, явный выбор варианта без неверного preselection; ошибка выбора видима и доступна. После добавления CTA показывает `В корзине · N` (не только галочку), количество обновляется при плюс/минус; доступное имя сообщает, что CTA добавляет ещё одну единицу.
- [ ] Модификаторы/добавки: состояние, цена и доступность понятны.
- [ ] Корзина: строки, раскрытие добавок, удаление соседней строки, qty, итоги, скидки, доставка/самовывоз.
- [ ] Корзина → рекомендации: desktop — перетаскивание ЛКМ, видимый скроллбар и кнопки влево/вправо; вертикальное колесо продолжает прокручивать тело корзины. Mobile — свайп пальцем без desktop-контролов.
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

- [ ] **PWA update flow** — installed PWA (iOS/Android/desktop standalone): persistent update dialog with explicit “Обновить приложение” / “Позже”; no prompt in regular browser tabs; wait until cart/checkout/modal closes; show “Приложение обновлено” only after activation and reload.
- [ ] Viewports: 320, 360, 390, 414, 520, 690, 768, 820, 821, 844×390 и 1024×390 (короткий landscape), 1024×768, 1181, 1440, 1480, 1481, 1920, 2800 и 3840 px. На обоих брендах короткий landscape сохраняет горизонтальную навигацию; rail и первая карточка попадают в видимую область; поворот в обычный desktop возвращает вертикальную sidebar без перезагрузки. `.wrap` ограничен 1480px до 1480px viewport и 2560px начиная с 1481px, центрируется на широких экранах.
- [ ] Нет горизонтального overflow.
- [ ] Появление вертикального scrollbar не меняет `documentElement.clientWidth` и геометрию `.wrap` (постоянный `overflow-y: scroll` без дополнительного `scrollbar-gutter`).
- [ ] Геометрия first paint совпадает с hydrated state.
- [ ] Медленная сеть: CSS/fonts/menu/image задержаны; измеряется CLS, не только скриншот после загрузки.
- [ ] Первые карточки и медиа имеют зарезервированное место; image priority соответствует реальному первому ряду.
- [ ] Safe-area и экранная клавиатура не перекрывают действия.

### Mobile first-load / LCP — PR #300

Automated C8 coverage is complete on PR HEAD `8db36bf3bf9d82adf5ae3cb89f0628afda168201`; CI [run 45030665869](https://github.com/h0wller/zerno-app/actions/runs/45030665869) passed 14/14 jobs. This is test-server evidence only and does not approve production visuals.

- [x] Regression coverage for saved-brand guest prediction, matching-promise reuse, mismatch handling, network/503 fallback, selected-brand image preload and first-row image priority.
- [ ] Capture and inspect same-context before/after screenshots for both brands, using the production assets/data intended for the review.
- [ ] Inspect splash-before-choice and first catalog frame after choice for coffee and delivery.
- [ ] Inspect mobile portrait, mobile landscape, short landscape and a desktop control viewport.
- [ ] Inspect first-row images, delivery hero, scrolled catalog and horizontal category rail; include guest and relevant staff roles, overlays, cart and checkout.
- [ ] Inspect address/search with the on-screen keyboard, focus, safe-area, overflow, computed geometry and hit targets.
- [ ] Record the exact SHA, screenshot source, role, brand, viewport, state, opened frame and `accepted` / `changes requested` / `not reviewed` for every required capture.

The full C8 implementation contract, measurement caveats, cleanup inventory and remaining gate are in [docs/testing/mobile-lcp-initial-load.md](testing/mobile-lcp-initial-load.md). Do not mark this visual review complete from CI screenshots alone.

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
- [ ] Ticker дублирует группы только для непрерывного цикла; копии имеют `aria-hidden`, а исходная строка доступна как одна интерактивная область с click/Space/Enter pause-play и reduced-motion поведением.
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

## 8. Обязательный merge gate для визуальных изменений

Любая правка, меняющая визуальный результат или интерактивную геометрию (CSS, DOM, размеры, spacing, typography, цвета, иконки, анимации, responsive layout, состояние/позицию компонента), требует визуальной приёмки до merge.

- Baseline и after screenshots снимаются на одинаковых ролях, брендах, состояниях и viewport.
- Все обязательные PNG должны быть открыты и просмотрены; наличие артефакта само по себе не означает review.
- Для мобильных изменений обязательны portrait и landscape, включая короткий landscape; для брендовых — `coffee` и `delivery`.
- В коротком landscape (844×390 и 1024×390) при первом кадре должны быть видны горизонтальная лента категорий и содержательная часть первой карточки; лента остаётся в normal flow при прокрутке, а верхняя панель не занимает более 56px без safe-area.
- Playwright, computed-style assertions и зелёный CI необходимы, но не заменяют визуальную приёмку.
- В PR фиксируются SHA, источник screenshots, роль, бренд, viewport, состояние и явный статус визуального review.
- При отсутствии обязательного кадра или его проверки PR не готов к merge: оставлять draft или запрашивать изменения.
- Не обновлять screenshot baselines, чтобы скрыть неожиданный diff; сначала установить причину и получить визуальное одобрение.

