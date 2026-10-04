# Frontend Roadmap & Tech Debt (ZERNO-APP)

## 1. Текущий статус проекта

* Ветка: `pizza`.

* Базовый статус: E2E-тесты Playwright — **20 passed**, `css-audit.mjs` — **0 нарушений**.

* Инвалидация и PWA: внедрён релизный цикл F3.58 (активация через `SKIP_WAITING`, `updateViaCache: 'none'`, ETag/`no-cache` на сервере для `.svg`, поддержка `pageshow` для bfcache).

* Монолит `fix-views.js` полностью устранён (закрыто в Фазе 3, тег `f3.23`).

---

## 2. Фаза 5: Вынос inline-ядра из `public/index.html` (Текущий приоритет)

Inline-скрипт `public/index.html` по-прежнему содержит более 500 строк бизнес-логики ядра. Задача фазы — оставить в `index.html` исключительно критический скелет и разметку.

### [ ] 5.2 — UI & Сетевое ядро (`public/app/core/ui.js`)

* Вынести функцию запросов `api()` с обработкой 401 и обновлением `window.__ztAuthDead`.

* Вынести систему системных сообщений `toast()`.

* Вынести генерацию тикера `TK` и форматирование даты обновления меню `renderUpd()`.

* Обеспечить обратную совместимость через `window.api` и `window.toast`.

### [ ] 5.3 — Кластер авторизации (`public/app/core/auth.js`)

* Вынести модальные окна и функции `openAuth()`, `closeAuth()`, `authSwap()`.

* Вынести логику `setUser()` (сохранение токенов, сброс состояний, отрисовка QR-кодов).

* Вынести формы регистрации, входа по PIN/OTP и сброса доступа.

* Вынести экран ввода пин-кода персонала `openPin()`, `closePin()`, `tryActivate()`.

### [ ] 5.4 — Панели, шторка и оверлеи (`public/app/core/panel.js`)

* Вынести контроллер шторки профиля (`openPanel`, `closePanel`).

* Вынести обработчик переключения вкладок `.tabs button` (`setTab`).

* Централизовать синхронизацию с `overlay.js`.

### [ ] 5.5 — Инициализация и жизненный цикл (`public/app/core/boot.js`)

* Вынести агрегационную функцию `renderAll()`.

* Сформировать стартовую точку входа `boot()`: загрузка пользователя, проверка сплэша, инициализация видов.

* Очистить тег `<body>` в `public/index.html` от остаточных инлайн-скриптов.

### [ ] 5.6 — Миграция на ESM (ECMAScript Modules)

* Перевести загрузку клиентского кода на единую точку входа: `<script type="module" src="./app/main.js"></script>`.

* Заменить неявные зависимости `window.*` на декларативные `import` и `export`.

* Изолировать приватные состояния модулей (`cart`, `MENU`, `me`).

---

## 3. Оптимизация CSS и закрытие техдолга (`docs/css-tech-debt.md`)

| Задача | Текущее состояние | Целевое решение | Приоритет |
| **Разгрузка Слоя 0**`<br>` | Inline `<style>` в `index.html` содержит ~90% базовых компонентов

 | Перенос классов модалок, карточек, корзины и чата в `theme-v2.css` (Слой 1).

 | **P1** |
| **Дубль `.brand .mark**``<br>` | Стили логотипа дублируются в `index.html` и `views.js`.

 | Оставить в Слое 0 только сброс габаритов против FOUC, layout перенести в Слой 2.

 | **P2** |
| **Токен `--topbar-h**``<br>` | Переменная объявлена инлайном в `index.html`.

 | Закрепить базовый токер в `:root` внутри `theme-v2.css`.

 | **P2** |
| **Ф5.9: Очистка `theme-v2.css**``<br>` | Наличие классов-рудиментов (`#brand-toggle`, `.pizza-opts-grid`, `.staff-call-btn`).

 | Полная ревизия и удаление неиспользуемых селекторов.

 | **P3** |

---

## 4. Бэклог продуктовых фич (`docs/notes.md`)

### [ ] Предзаказы вне рабочих часов

* **Контекст:** Сервис доставки работает строго с 11:00 до 22:00.

* **UI/UX:** При попытке чекаута вне интервала показывать модальное окно выбора предзаказа с выбором даты (завтра/послезавтра) и слота (утро 11:00–14:00, день 14:00–18:00, вечер 18:00–22:00).

* **Бэкенд:** Расширить таблицу `orders` полями `is_preorder INTEGER DEFAULT 0` и `preorder_date TEXT`.

* **Профиль:** Добавить индикацию и фильтр «Предзаказы» в раздел «Мои заказы».

---

## 5. Регламент внесения изменений

1. Правка кода в public/app/*или server/*
2. node --check <затронутые файлы>
3. npm run pretest (node scripts/css-audit.mjs) -> ожидание: 0 нарушений
4. npm run test:e2e -> ожидание: 20 passed
5. Инкремент STATIC_CACHE в public/sw.js при правках фронтенда
6. Формат коммита: fix(scope): F3.XX - описание изменений
7. Создание/переименование/удаление модуля → обновить docs/module-map.md тем же PR

---

## 6. Архив выполненных этапов

* **Фаза 1–3 (f3.23):** Полный распил и ликвидация монолита `fix-views.js`. Выделены независимые модули `a11y.js`, `api.js`, `cart.js`, `cashier.js`, `chat-core.js`, `chat.js`, `config.js`, `deeplink.js`, `delivery.js`, `live.js`, `menu-editor.js`, `menu.js`, `notify.js`, `orders.js`, `overlay.js`, `profile-brand.js`, `profile.js`, `push.js`, `scanner.js`, `splash.js`, `styles.js`, `swipe.js`, `utils.js`, `views.js`.

* **Фаза 4 (Ф4.1–Ф4.2):** Дедупликация инлайн-кода: QR-генератор перенесён в `core/qr.js`, отзывы — в `core/review.js`, базовые переменные — в `core/state.js`. Удалён мёртвый код промокодов.

* **PWA & Cache стабилизация (F3.58):** Устранено неконтролируемое кэширование `.svg` в `server.js`, обеспечен корректный жизненный цикл воркера через `skipWaiting`/`updateViaCache: none`, закрыта проблема сброса состояния при жестах iOS/Android bfcache.

### [x] 5.4 — Панели, шторка и оверлеи (`public/app/core/panel.js`)

* Вынесен контроллер шторки профиля (`openPanel`, `closePanel`).
* Вынесен обработчик переключения вкладок `.tabs button` (`setTab`).
* Синхронизация с `overlay.js` через `window.syncOverlay`.
* Обработчик `mbonusBtn` перенесён в модуль.
* Убран `onclick="closePanel()"` из `btn-back`.

### [x] 5.5 — Инициализация и жизненный цикл (`public/app/core/boot.js`)

* Вынесена агрегационная функция `renderAll()`.
* Сформирована точка входа `boot()`: загрузка пользователя, меню, инициализация видов.
* Единая регистрация SW (SKIP_WAITING + reload только при hadController) — дубль из `<body>` удалён.
* Инлайн-скрипты install-баннера и iOS-хинта переехали в boot.js; `<body>` без инлайн-кода.

### [x] 5.6.1 - Инлайн-ядро вынесено вербатим в public/app/core/legacy-core.js (тег на той же позиции)

gesture-guard дословно в state.js. В index.html остались только INLINE #1 (префетч /api/menu)
и INLINE #3 (splash/FOUC-guard) — оба задокументированы как разрешённый critical-скелет.
Декомпозиция legacy-core.js на кластеры (promo/dash/push-ui/staffpin/overlay-DROP) — бэклог Ф5.7,
file-to-file, сухим прогоном по якорям.

### [x] 5.6.1 - Инлайн-ядро → legacy-core.js вербатим (тег на той же позиции); gesture-guard → state.js

### [x] 5.7 - legacy-core.js декомпозирован на 8 кластерных classic-модулей (вербатим, порядок тегов = прежний порядок кода)

overlay-база (syncOverlay/popstate/Escape) остаётся в overlay-core.js до ESM-этапа: overlay.js самодостаточен,
слияние дублей — задача Ф5.6.2.

### [x] 5.6.2a - ESM-пилот fx.js (module + шим confetti). Фикс: histPushed возвращён overlay-core.js

(объявление попало в fx.js при сплите Ф5.7 и стало module-private → ReferenceError в popstate).

### [x] 5.6.2b - catalog.js → module + window-шимы (loadMenu/renderModes/setMode/syncBrandViews)

Долг: push-ui.js — голые записи fxx/fxOn (неявные глобалы), чинить перед его конверсией.

### [x] 5.6.2b-fix3 - откат вставки var fxx/fxOn: они объявлены многострочным let в push-ui.js

(построчный grep пропустил; var+let = SyntaxError с каскадом renderProfile/sv).
Мина fxx/fxOn отменена: ложноположительная (let-глобалы видны из модулей).
Урок: проверки объявлений — только многострочно-осведомлённым regex или парсером, не построчно.

### [x] 5.6.2f-h - editor/push-ui/overlay-core → module. Конфетти консолидировано в fx.js

(module-private состояние: класс синхронизационных багов window-шимов устранён).
ВСЕ 8 КЛАСТЕРОВ + конфетти — модули. Perf-бэклог: CLS 0.33 local (7 shifts, DevTools Layout shifts) —
разбор после финала ESM.

### [x] 5.6.2i - window-резолв само-вызовов + e2e кейс 15-delivery-cashier-clean

(стафф-режимы в бренде Пятница прячут delivery-меню немедленно; регресс-страховка).

### [x] 5.8a - листья menu-editor/address/review → module. Фиксы: топ-левельный само-вызов

в fx.js (window.fitFx до шима), шим maybeAskReview в review.js.
Правило: скрипт window-резолва пропускает вызовы в top-level области модуля.

### [x] 5.8b - IIFE-листья (chat-семейство, overlay, swipe, notify, splash, settings

delivery-search, cashier-log/card, live, scanner, scrolltop, styles, a11y, admin-extra,
config, deeplink) → module. Гэйты скрипта: IIFE-паттерн + defer-тег, иначе skip.

### [x] F5.14–F5.17 - мобильный эпик (принято продуктом)

* F5.14: база .wrap из critical в Слой 1 (каскадный корень «узких стафф-экранов»);
  is-admin в setMode; тикер visibility:hidden в стаффе (высота полосы держит modeSeg).

* F5.16: overflow-x:clip (sticky-рейл); «Активация гостей» ≤6 строк со внутренним скроллом;
  компактные тосты ≤640px.
* F5.17: рейл вертикальный, sticky по центру вертикали (top:50%+translateY);
  mbonus = компактная пилюля по центру над FAB; IntersectionObserver прячет её у футера.

### [won't fix] F5.18–F5.19 - эксперименты с формой бонус-бейджа (колонка слева

::before/::after, круг с баблом) и кнопки рейла Пятницы ×2 — отклонены продуктом, откат.
Открытый продуктовый вопрос: место/форма бонус-бейджа на мобиле — решать мокапом,
не CSS-итерациями (4 итерации без сходимости).

строки 5.8h + fix2 + «e2e: скелетоны исключены из селекторов отрендеренного меню».
fix2: путь core/review.js в графе импортов + файловый чекер импортов main.js

### [x] 5.6-финал шаг 3 - utils/api/ui/auth/panel → module (голова графа; контракт window.api принадлежит ui.js)

### [x] Ф5.20 - stale-кэш Safari/PWA: SW code-fetch с cache:'reload', канон-хост 301, purge edge; урок: network-first в SW обязан обходить HTTP-кэш движка, иначе бампы STATIC_CACHE бессильны в A2HS

### [x] 5.6-финал шаг 4 - state.js/push.js → module; window-контракты cat/query/loadPending

тест-фикс сплэша. Фаза 5 (ESM-миграция) ЗАКРЫТА: 26 модулей в графе main.js,
classic = vendor + 3 инлайна (префетч, splash-guard, владелец клика сплэша).
fix(js): Ф5.21/21b/21c - корзина: гард индекса, единый владелец мутаций и подарков

* 21: гард cart[i] (TypeError reading 'qty' при дочистке)
* 21b: renderGifts() в cart.js — владелец #cartGifts (блок жил в мёртвом renderCart
  delivery.js после Ф5.8h → «2×35 → Маргарита в подарок» не показывалась);
  fee=0 и промо-плашка скрыты на пустой корзине
* 21c: дубль мутаций qty убран: delivery.js #cartItems + cart.js #cartPanel мутировали
  cart на одном клике (1 клик = +2, qty 1→3); мутации/save только в cart.js,
  syncAddButtons гарантирован после рендера

### [x] Пакет C - e2e-страховка ручных регрессий (30 кейсов; pageerror-коллекторы)

### [x] Ф5.22 - comp-чипсы на карточках доставки (рендер; сохранение работало всегда)

### [x] Ф5.23 - степпер на карточке доставки: снятие за 1 тап, выравнивание кнопок по низу

### [x] Ф6.1-6.2 - перф-пакет закрыт: CLS 0.04 / INP 48ms / LCP 1.51s (цели ≤0.10/≤0.05 достигнуты)

### [x] Ф5.24 - ngSave: 400-exists = 409-фолбэк (гонка серверного exists-ветвления)

### [x] Ф5.25 - stampIcon/cupWord → window-шимы (голые чтения через границу модулей

e2e были слепы, потому что при 0 штампов вызова нет)

### [x] продуктовое решение 28.09: бейдж = элемент шапки на ≥821 (ширина кластера = venueToggle), вертикальная колонка рейла на мобиле; вопрос формы закрыт, мокап не нужен

`npx repomix --remote 'https://github.com/h0wller/zerno-app/tree/pizza' --remove-empty-lines --output-show-line-numbers --compress`
### [x] Ф5.39 - логотип Пятницы на мобиле: квадратный webp убран из марки, горизонтальный SVG 160×40 в admin-extra.js; STATIC_CACHE v292→v293, MEDIA_CACHE v12 (purge квадратных растров)

### [x] Ф5.40 - admin-extra.js: восстановлен парсинг после ручного слияния веток (eslint Parsing error 110:2), файл заменён целиком выверенной версией

### [x] Ф5.41 - документация: каноническая карта владения docs/module-map.md; public/app/README.md из пустого → индекс; css-architecture.md + правило растров Ф5.39; ui-checklist.md + проверки логотипа и PWA cold-start
