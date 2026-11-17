# Zerno Motion System — аудит и спецификация

**Статус на 2026-11-17:** Stage 0–1 завершены; core implementation Stage 2–4 проверена на обоих брендах. Stage 5 — финальная визуальная приёмка — остаётся открытым: нужны полная staff role/overlay matrix, interruption/resize + keyboard/focus/touch checks и отдельное расследование document-level CLS. Последняя полностью зелёная проверка application/test HEAD `1529c5dbeacc72b6c264478a10e617bf723189bd` — CI run `44119483640` (13/13 jobs; Responsive UI: 136 passed, 4 skipped, 0 failed/flaky).
**PR:** #268, Draft. Ветка: `design/ui-animation-system-20261116`.
**Последний проверенный application/test HEAD:** `1529c5dbeacc72b6c264478a10e617bf723189bd` (CI run `44119483640`).
**Base:** `pizza`, SHA `dacb424bdff9d073b3b9a4e13d723db1da92d078`.

## 1. Цель и motion-язык

Zerno должен ощущаться быстрым, спокойным и пространственно понятным. Telegram — референс скорости реакции и ясности, но не шаблон для буквального копирования.

Анимация используется только для пяти задач: подтвердить ввод, показать изменение состояния, объяснить пространственное перемещение, обозначить прогресс или подтвердить результат. Она не должна украшать неподвижное состояние, маскировать задержку или удерживать пользователя до завершения перехода.

### Принципы

1. **Сначала действие.** Изменение состояния выполняется сразу. Анимация не является условием клика, навигации, checkout, API-запроса или передачи фокуса.
2. **Ограниченный motion-бюджет.** В один момент не должно конкурировать несколько крупных движений. Не запускать одновременно заметное движение панели, бейджа, ticker и pulse.
3. **Пространственная последовательность.** Sheet появляется с физического края; центральная модалка — на месте; toast — кратко со своей стороны. Закрытие повторяет ту же логику.
4. **Без упругости в интерфейсе.** Не использовать bounce/spring для навигации, панелей, кнопок и сообщений. Кривые с overshoot выше 1 требуют отдельного обоснования.
5. **Геометрия стабильна.** По умолчанию не анимировать layout. Использовать opacity/transform там, где размер и место уже зарезервированы. Не двигать hit-target под пальцем.
6. **Единый timing для двух брендов.** Coffee и delivery используют одни timing tokens. Цвет, тень и поверхность остаются во владении брендовых токенов.
7. **Локальное владение.** Общие timing tokens живут в Layer 1; селекторы и поведение остаются у CSS/JS-владельца компонента.
8. **Reduced motion — полноценное состояние.** Убирать необязательные перемещения, bounce, бесконечные циклы и smooth scroll, сохраняя мгновенную видимость состояния и обратную связь.
9. **Никакой новой runtime-абстракции.** Не добавлять animation library, универсальный JS animation manager или новый MutationObserver.

## 2. GitHub и зависимость category rail

### PR #268

На момент аудита PR открыт, Draft, base pizza, head 265e984381a8fcf4149ec3e129747001efd0dd7a. Diff содержал только этот план. В ходе Stage 0 application code не менялся.

### PR #265 / #266

PR #265 закрыт без merge (2026-11-17); ветка feat/mobile-bottom-category-rail-20261116. PR #266 также закрыт без merge (2026-11-17), head 15e0fb273f73f4b6238ebdd0694de662b522031f. Обе ветки признаны устаревшими и не являются активными зависимостями.

Исторически #266 пересекался с menu.js, 150-rail.css, 20-cards.css, critical CSS в index.html, sw.js и связанными тестами. После закрытия #265/#266 эти ветки не блокируют работу в актуальной базе pizza; запрещено переносить их устаревший floating-capsule/rail redesign.

### Более новое состояние pizza: PR #269

В ходе проверки обнаружено, что PR #269 feat: improve category rail scroll behavior уже объединён в pizza. Merge commit: dacb424bdff9d073b3b9a4e13d723db1da92d078.

#269 добавил повторное нажатие выбранной категории для прокрутки вверх, убрал старый scroll-top control/module и реализовал fade основных категорий во время скролла. Delivery subfilters не затухают. Новым владельцем rail behavior стал ui/category-rail.js.

PR #268 синхронизирован с pizza через merge commit `c86e3257b970c3e259aa31029cf03bdaa0615abb`; его второй parent — pizza SHA `dacb424bdff9d073b3b9a4e13d723db1da92d078`, содержащий #269. PR #265 и #266 закрыты без merge; активной stacked dependency больше нет.

**Решение по scope:** #269 — единственный актуальный rail baseline: повторное нажатие выбранной категории прокручивает вверх, основные категории fade/restore, legacy scroll-top удалён. Не менять base и не переписывать историю. Category/card/stepper/add-product motion остаются незавершёнными задачами, но больше не заблокированы #266; работать только с текущими owners в pizza и не менять геометрию/поведение rail.

## 3. Архитектурные ограничения и ownership

Проект использует четыре логических слоя CSS:

- **Layer 1:** public/app/ui/theme/*.css — нейтральная база компонентов и общие timing tokens.
- **Layer 2a:** public/app/ui/brand-tokens.css — только брендовые custom properties.
- **Layer 2b:** public/app/core/views.js — динамические брендовые и layout-правила.
- **Layer 3:** компонентные стили рядом с модулем-владельцем.
- **Layer 4:** минимальный critical CSS в public/index.html, синхронизированный с первым кадром, но не являющийся вторым источником поведения.

DOM ownership остаётся прежним: cart.js владеет состоянием и рендером корзины; core/overlay-core.js — общей синхронизацией overlay; core/panel.js — lifecycle профайл-drawer и возвратом фокуса; core/swipe.js — touch-жестом панели; chat.js/chat-core.js — чатом и подсказками; core/auth.js — auth modal; profile.js — содержимым профиля; core/fx.js — canvas confetti; core/deeplink.js — deep-link подсветкой; admin-extra.js — ticker. После синхронизации pizza в PR #268 также присутствует `ui/category-rail.js`, владелец rail behavior из #269.

Межмодульная связь использует window.ztBus или уже существующие API владельцев. Не добавлять observer на body/documentElement, не менять DOM ownership, не вводить глобальные обработчики/monkey-patching.

## 4. Полный inventory

Инвентарь охватывает все 32 CSS-файла в public/app/ui/theme/, critical CSS в public/index.html и JS motion paths. Это исходный Stage 0 снимок до синхронизации с pizza; декларации описывают исходную реализацию, а не измеренную perceived duration. Новые владельцы/пересечения сверять с текущим HEAD.

### 4.1 CSS Layer 1

| Файл / компонент | Текущая motion | Reduced motion / последствия | Решение и покрытие |
|---|---|---|---|
| 00-head.css | Motion правил нет; корневые нейтральные токены. | Нет собственного пути. | Единственный владелец общих timing tokens. Не размещать здесь компонентные селекторы. |
| 10-base.css | Motion правил нет. | Нет собственного пути. | Без изменений. |
| 20-cards.css | .card transform/opacity 200ms ease + pop 500ms с --d; image transform 500ms, emoji 300ms; stepper 100ms. | Reduce отсутствует. Card entrance и hover используют transform одновременно; stepper scale меняет визуальную область hit-target. | Card/stepper motion остаются на отдельную проверку; не менять grid/hit-target и использовать текущие responsive owners. |
| 30-utils.css | Определяет ping, stampin, shimmer; потребители задают длительность. | Глобального reduced режима нет. | Keyframes остаются нейтральными; reduce определяется каждым потребителем. |
| 40-catalog.css | Skeleton shimmer 1.2s infinite. | Reduce отсутствует; постоянная перерисовка фона, без layout shift. | Оставлять только во время загрузки; статическое состояние под reduce. |
| 50-edit-mode.css | Switch background и knob left переходят за 250ms. | Reduce отсутствует; left вызывает layout/paint. | Позже проверить замену left на transform при сохранении geometry. |
| 60-cart.css | cartPanel transform 300ms cubic-bezier(.2,1,.3,1); close button transform 150ms; hover scale 1.08. | Reduce отсутствует. Sheet не меняет поток, но на время движения сдвигает hit-targets. | Цель Stage 1. Сохраняем пространственное направление, токенизируем duration/easing, отключаем travel под reduce. |
| 70-ticker.css | zt-marquee translate3d, 30s linear infinite. | Reduce реализован: marquee отключается, viewport становится вручную прокручиваемым. | Сохранить доступный fallback; проверить динамическую смену системной настройки. |
| 80-splash.css | spRise 600–700ms с задержками; spFloat 3.2s infinite; кнопки около 120ms. | Основные анимации отключаются в reduce. | Сократить ощущаемую задержку; сохранить parity с critical CSS. |
| 90-modals.css | Overlay opacity 300ms; modal-card opacity/transform 300ms; close hover rotate/scale; PIN shake 400ms; QR canvas stampin 450ms с overshoot. | Reduce отключает overlay/card/control/form/zone transitions, PIN shake и QR canvas entrance; общие modal, PIN и QR checks добавлены. Blur backdrop остаётся paint cost. | Сохранять компонентный ownership и проверять normal/reduced transitions, focus и overlay cleanup. |
| 100-chat.css | FAB transition 200ms; ::before ping 2.4s infinite; chat panel all-properties 300ms; messages 300ms cubic-bezier(.2,1.2,.4,1), scale/translate; controls 150–200ms. | Reduce выключает .chat/.chat-fab/.msg, но не .chat-fab::before — ping продолжается. | Явно перечислить transition properties; убрать idle ping и overshoot; проверить reduce. |
| 110-panel.css | Tabs/stamp 200–300ms; .stamp.n nextp 1.6s infinite; .freeCard .fe sway 2.6s infinite; .hmini rise 300ms; stats hover transform. | Local reduce выключает stamp/free-card/history animation, stamp/stat transitions и stat hover travel; regression matrix добавлена. | Не анимировать историю/ambient profile decoration под reduce; сохранить state feedback. |
| 120-cashier.css | Cashier rise 400ms; customer panel 350ms; log rows 300ms; stampin 500ms с overshoot; staff-guide chevron 180ms. | Local reduce disables all four entrance/stamp animations and guide chevron transition; staff regression added. | Сохранять мгновенную видимость и неизменную геометрию staff UI. |
| 130-service.css | Toast entry 180ms and exit 120ms with shared timing tokens; freePulse 2.2s, glowPulse 1.5s, avatar pulse-hint 2s, pushHint/freeBanner entrance. | Reduce disables toast animation, service pulses, avatar hint and one-shot hint entrances; regression covers both brands. | Keep message/colour feedback but remove optional movement and perpetual paint. |
| 140-topbar.css | Mode control/avatar/rail/search/role actions 200–250ms; avatar and edit hover translate/scale. | Local reduce removes header-control transitions and avatar/edit hover travel. Rail hover remains owned by the current ui/category-rail.js implementation from #269. | Keep local to topbar controls; do not duplicate rail selectors here. |
| 150-rail.css | На current pizza после #269 есть fade и reduce для rail. | Delivery subfilters исключены из fade; mobile sticky поведение принадлежит ui/category-rail.js. | Сохранять #269 baseline; любые изменения — только scoped regression и без rail redesign. |
| 160-01-rail-fab-mobile.css | cartFab opacity/transform 300ms; badge 350ms; skeleton pulse 1.4s; empty state 400ms; address sheet 220ms; preorder timer 300ms + pulse 2s; validation shake 400ms. | Reduce покрывает skeleton, empty, address sheet/button, preorder waiting pulse и validation shake; cartFab/badge остаются без reduce. | CartFab — отдельный этап. Сохранить геометрию и кликабельность. |
| 160-02-addr-panel-fix.css | #mbonusBtn opacity/transform 250ms. | Reduce отсутствует. | Проверить, что selector остаётся живым, затем локально нормализовать. |
| 160-03-topbar-search-panel.css | .wrap > .panel transform 350ms. | Reduce отсутствует. | Не менять без проверки panel.js/views.js и swipe transform. |
| 160-04-wrap-cls-sheets.css | image transform 300ms; panel transform 350ms (несколько селекторов); cartPanel 300ms. | Reduce отсутствует. cartPanel transition дублируется в 60-cart.css; panel пересекается с views/swipe. | Проверить cascade/computed style; убрать только подтверждённый дубль, не делать global panel override. |
| 160-05-base-components.css | Motion правил нет. | Нет собственного пути. | Без изменений. |
| 160-06-delivery-header.css | venue toggle bg/transform/border 200ms; arrow 200ms; brand segment fadeIn 200ms; CTA 150ms. | Reduce отсутствует. | Локальная нормализация остаётся отдельной задачей; зависимости от закрытого #266 нет. |
| 160-07-orders-cards.css | В HEAD #268 legacy scrollTop transition 250ms; order tracking button 120ms. | Reduce отсутствует. В current pizza scrollTop удалён PR #269. | Не возвращать scrollTop. Переоценить после синхронизации base. |
| 160-08-cart-addons.css | add-on chips 150ms; add button transform/shadow/bg 120ms; scroll controls 150ms. | Reduce отключает основную группу add-on transition. | Сохранить scoped правила; проверить focus/hit targets. |
| 160-09-preorder-subfilters.css | progress fill width 300ms; overflow cue opacity 180ms; subchip color 150ms; option state 150ms. | Reduce отключает только overflow cue. width может инициировать layout. | Оставить width только для зарезервированной геометрии; расширить reduce. |
| 160-10-rail-mobile-opts.css | time mode state 150ms; order-step opacity/transform 250ms. | Reduce отсутствует. | Нормализовать local state, не анимировать layout. |
| 160-11-canonical-grid-menu.css | Явно animation:none для delivery cards. | Намеренное подавление входа. | Сохранить. |
| 160-12-admin-bar-tail.css | Явно animation:none для delivery menu header. | Намеренное подавление входа. | Сохранить. |
| 160-13-dashboard-bento.css | Dashboard tabs bg/color/shadow 180ms. | Reduce отсутствует. | Позже нормализовать простое состояние без transform. |
| 160-14-auth-modal.css | Form/mode switch 180ms; busy spinner 700ms infinite linear. | Scoped reduce устанавливает transition/animation 0.01ms и iteration 1; spinner отдельно отключён. | Оставить мгновенное состояние; позже проверить избыточно широкий descendant selector. |
| 160-15-mobile-support-toolbar.css | Support/mode controls 150ms. | Reduce отключает. | Сохранить scoped reduce. |
| 170-profile-button.css | Profile avatar 250ms; tabs 200ms; stamp track 180ms; chevrons 160–180ms; profile actions 120ms. | Reduce also disables avatar hover scale, tabs, progress width, Friday chevron and existing profile action transitions. | Keep profile panel geometry stable; do not animate the whole profile on open. |

### 4.2 JS и динамический CSS

| Владелец | Триггер и текущий эффект | Риски / reduce | Решение |
|---|---|---|---|
| core/views.js | Вставляет Layer 2 CSS: delivery option shake 400ms, active translateY(1px), brand/mode/panel rules; RAF adds pulse. | Dynamic .opts.shake now has a scoped reduce override. Explicit smooth scroll for option validation remains in delivery.js; it still needs direct interaction/reduced-motion verification. | Preserve Layer 2b ownership; do not add a global scroll override. |
| core/swipe.js | Mobile profile swipe пишет inline transform, отключает transition во время drag; завершение 320ms + overlay opacity 320ms. Nudge 1.1s cubic(.3,1.4,.4,1), hintFade 1.6s. | Нет reduce; overshoot; resize/reopen потенциально конкурируют с cleanup. | Gesture сохраняется отзывчивым, но decorative nudge/hint отключаются под reduce. Проверить прерывание/resize. |
| ui/styles.js | Вставляет общий .pulse: scale + expanding shadow, 1.3s infinite; chatHint pulse 1.2s × 3. | Нет reduce; broad selector может затронуть несвязанные .pulse consumers; shadow repaint. | Сузить владельца и убрать idle loop. |
| core/fx.js | window.confetti creates 90 particles; canvas RAF draw/clear for the effect lifetime. | Skip canvas initialization when reduce is active; stop and clear the next RAF frame if the preference changes live. Hidden-document cancellation remains open. | Keep the event-bound effect, with no motion for reduce clients. |
| core/deeplink.js | Order-card flash 2.4s and smooth scroll; review action smooth-scrolls then glows. | Under reduce, flash animation is disabled while outline remains as state feedback; order/review scroll uses auto. | Keep state indication, remove optional motion. |
| admin-extra.js | ResizeObserver/RAF измеряют ticker overflow; CSS владеет marquee; matchMedia reduce читается в JS. | Не отдельный animation loop. | Сохранить owner/fallback, проверить live preference changes. |
| cart.js | Synchronous cart open/close; addon scrollBy uses auto under reduce; continue-shopping action scrolls delivery grid. | Continue-shopping scroll now selects auto for reduce and smooth otherwise; cart business logic and API remain unchanged. | Keep cart lifecycle owner and cover navigation scroll in the existing cart E2E spec. |
| core/overlay-core.js | Overlay classes, Escape, backdrop, popstate и cart/modal orchestration. | Не ждёт окончания animation. | Сохранить lifecycle owner. |
| core/panel.js | Drawer open/close + focus restore. | Координируется с inline transform из swipe.js. | Сохранить владельца; проверять repeated open/close, Escape, focus. |
| chat.js / chat-core.js | Chat open/close, message/hint state. | FAB pseudo ping и dynamic hint pulse неполностью reduce-safe. | Сохранить JS owner; изменить только component CSS/Layer3 owner. |
| core/splash.js + index.html | JS lifecycle; CSS/critical CSS first-frame entrance/float. | Reduce есть, но две копии могут рассинхронизироваться. | Сохранять parity Layer4/Layer1. |
| ui/scrolltop.js | В HEAD #268 legacy scroll button/rail position owner. | Current pizza после #269 модуль retired, rail переехал в ui/category-rail.js. | Не возвращать/не модифицировать в Stage 1. |
| menu.js / delivery.js | Menu render, categories, filters, zoom/image priorities. | Current pizza is authoritative; rail presentation is in ui/category-rail.js, catalog state remains in storefront owners. | Сохранять single-owner boundaries; changes can proceed on current base with targeted tests and no #269 redesign. |
| ztBus | EventTarget bus для межмодульных событий. | Нового motion event bus не требуется. | Использовать только при уже существующей потребности владельца. |

### 4.3 Critical CSS

public/index.html дублирует splash spRise/spFloat и reduced-motion declarations, чтобы первый кадр не ждал deferred CSS. Delivery critical CSS подавляет entrance animation для сохранения геометрии; staff scan FAB имеет transition около 250ms. Layer 4 должен оставаться минимальным first-frame mirror. Любое изменение timing splash должно сохранять parity между index.html и 80-splash.css.

## 5. Найденные проблемы и риски

### Reduced motion неполон

Частичное покрытие есть для ticker, splash, chat panel/messages (но не FAB pseudo ring), auth, skeleton/empty state, address book, preorder waiting, отдельных validation/add-on/profile controls. Без локального reduce остаются карточки/stepper, generic modal/overlay, PIN/QR feedback, cashier entrance/stamp, toast/bonus pulse, topbar, cart sheet/FAB, swipe nudge/hint, delivery shake, chat hint pulse, confetti, deeplink flash и smooth scroll.

Не вводить один глобальный выключатель transitions. Каждый владелец должен сохранить мгновенную обратную связь и конечное состояние.

### Дублирование и конфликты

- .cartPanel transition объявлен в 60-cart.css и повторно в 160-04-wrap-cls-sheets.css. Сейчас значения совпадают; удалить дубль только после computed-style/cascade проверки.
- .panel transition находится в нескольких CSS owner scopes и затрагивается core/views.js; core/swipe.js пишет inline transform и снимает transition во время жеста. Глобальное переопределение сломает swipe.
- .card entrance keyframes и hover используют transform параллельно.
- .chat использует broad transition shorthand вместо явного списка; FAB pseudo ping выпадает из reduced selector.
- .pulse в ui/styles.js слишком общий; views.js применяет его к notification state.
- У profile stamp возможен specificity conflict между animation:none и nextp.
- Повторное имя rise не означает общего owner: у разных компонентов разные trigger и lifecycles.
- Critical splash CSS намеренно дублируется; синхронизировать обе копии.

### Performance, scroll и hit targets

- Большинство panel transitions — transform/opacity и не меняют document flow, но на время движения меняют hit-target координаты.
- Shadows/background/border и backdrop blur вызывают paint. Overlay blur статичен во время показа, но занимает весь viewport.
- Width transitions в progress/stamp создают локальную layout работу; оставить только с зарезервированной геометрией.
- Ticker, ping, sway, pulse, skeleton и confetti создают циклическую работу; выключать для reduce, а декоративные циклы — когда документ скрыт.
- Smooth scroll в deeplink и одном cart path не проверяет reduced motion. Cart add-on scroll уже выбирает auto.
- Текущий код не ожидает transitionend. Сохранить отсутствие таких блокировок.
- Имеющиеся CLS/layout tests полезны, но не измеряют промежуточные кадры и timing.

## 6. Motion specification

### Классы

| Класс | Когда нужен | Правило Zerno |
|---|---|---|
| Micro-interactions | Press, selected state, chip/filter, stepper, small confirmation | Реакция мгновенная; чаще color/opacity. Transform только если геометрия hit-target не меняется. |
| Component transitions | Card state, category rail, cart FAB count/sum, stepper, filter state | Geometry зарезервирована; короткий opacity/color или малый transform. Не анимировать document flow. |
| Spatial transitions | Cart sheet, modal, drawer, profile, chat, address book | Один направленный transform+opacity. Закрытие так же быстрое. Повторное действие retargets transition. |
| Context transitions | Coffee/delivery, guest/staff, category/content, order state | State/data меняются сразу. Crossfade только если предотвращает визуальный flash; не анимировать весь grid и scroll как декорацию. |
| Feedback motion | Validation, error/success, toast, order flash, chat hints, confetti | Короткий one-shot, subordinate to text/color. Без overshoot; reduce убирает shake/particles, не результат. |
| Ambient motion | Ticker, skeleton, ping/pulse/float | Только пока показывает loading/announcement. Не держать idle controls в цикле. Останавливать для reduce и hidden state. |

### Candidate timing tokens

Инвентарь показал существующие кластеры: примерно 100–180ms для micro-controls, 180–250ms для state changes и 300–350ms для spatial panels. Первый кандидат:

- --motion-duration-micro: 120ms
- --motion-duration-state: 180ms
- --motion-duration-spatial: 300ms
- --motion-ease-standard: cubic-bezier(.2,.8,.2,1)
- --motion-ease-spatial: cubic-bezier(.2,1,.3,1)

Это кандидатные значения, не финальная калибровка. Они должны быть проверены по видео cart sheet normal/reduced и измерению промежуточной геометрии. После ревью timing можно уточнить. Brand token files не владеют duration/easing.

Spring token не планируется. Существующие overshooting curves (.2,1.2,.4,1; .2,1.4,.4,1; .2,1.6,.4,1; .3,1.4,.4,1) не применять к core navigation, panels, buttons и messages. Исключительный декоративный эффект допустим только один раз, с малым overshoot, ограниченной длительностью и отключением под reduce.

### Приоритет решений

- Press: feedback сразу; предпочитать color/opacity, не двигать hit-target.
- Category/filter: выбранное состояние немедленное; rail behavior уже реализован #269 на current pizza и не включён в Stage 1.
- Cards: убрать долгий stagger/pop; image zoom оставить только на fine pointer при доказанной пользе; stepper — короткий.
- Add product: счётчик/цена сразу; подтверждение не должно двигать card/FAB.
- Cart FAB: короткое обновление суммы/count; не менять положение или размер hit-target.
- Cart sheet: mobile снизу, desktop справа; spatial token; быстрое close/reopen retarget; reduce — мгновенно.
- Modal/drawer: та же spatial family, но focus/lifecycle остаются у текущего owner.
- Chat: панель пространственная; сообщение получает только subtle opacity/translate без bounce-scale; постоянный idle ping не нужен.
- Brand/role: состояние меняется сразу; не анимировать каталог целиком.
- Validation: текст/цвет/иконка остаются; shake необязателен и отсутствует для reduce.
- Toast/order: one-shot opacity/state emphasis, без overshoot и без smooth scroll под reduce.
- Confetti: optional; пропускать под reduce и когда документ hidden; success остаётся понятным без частиц.
- Ticker/skeleton: сохранить manual ticker fallback; skeleton статичен под reduce.

## 7. Реализация по этапам

### Stage 0 — inventory и baseline (завершён)

- [x] Проверены PR #268/#265/#266/#269, base/head и diffs.
- [x] Прочитаны обязательные источники и сверены с текущим кодом.
- [x] Просмотрены все 32 CSS-файла, critical CSS и JS motion owners.
- [x] Зафиксировано различие PR #268 HEAD и current pizza после #269.
- [x] Получен и осмотрен baseline CI run 43973988903 на pizza SHA dacb424bdff9d073b3b9a4e13d723db1da92d078.
- [x] Зафиксировано, что Stage 0 не изменил application code.

Baseline evidence:
- CI run 43973988903: все 13 jobs successful: Code Quality, Visual UX, Mobile Chrome, Profile, Bonuses, UI baseline, Menu/search, Auth, Staff API, Responsive UI, PWA, Cart/checkout, Visual stability.
- Визуальные артефакты содержат coffee/delivery, hydrated/initial menu, mobile/tablet/desktop размеры, desktop card grids, profile и chat portrait/landscape/short landscape для обеих тем; в Mobile Chrome artifact есть rail faded/restored captures.
- Открыты и осмотрены coffee/delivery mobile menu frames, chat frames portrait/landscape/short landscape для обеих тем и profile frames.
- Это стабильные состояния, не видео timing. Не использовать baseline update script.

### Stage 1 — tokens + cart sheet

- [x] Добавлены Playwright сценарии reduced-motion open/close для 390×844, 844×390 и 1024×768; normal-motion interruption close/reopen; visibility during exit; final geometry, overlay cleanup и отсутствие horizontal overflow.
- [x] RED получен на закрытой геометрии и reduced-motion cart state; strict offscreen geometry восстановлена, существующие assertions сохранены.
- [x] Записаны и осмотрены normal/reduced cart recordings: exit около 300 мс, sheet уходит вниз, повторное открытие после interruption возвращается к нижней привязке; reduced motion меняет состояние синхронно.
- [x] Добавлены единые timing/easing tokens в Layer 1 owner `00-head.css`.
- [x] Spatial tokens применены в owner `60-cart.css`; DOM/lifecycle owner не менялся.
- [x] Локальный reduced-motion путь проверен вместе с visibility, pointer-events, overlay и body scroll-lock cleanup.
- [x] Cart and checkout E2E: 31/31; общий CI run 44039724343 — success.
- [x] Cart sheet geometry визуально осмотрена в portrait, compact landscape и desktop; baseline не обновлялся.
- [x] Cart data/render/price/checkout/API/network и DOM ownership не менялись.

### Stage 2 — modal/drawer and context

- [x] Добавлен reduced-motion auth modal/overlay test: open, Escape, focus restore, aria-hidden и pointer-events cleanup.
- [x] RED подтверждён на overlay fade; после CSS-фикса computed duration карточки проверяется численно с учётом Chromium serialization (`0.01ms` → `1e-05s`).
- [x] Reduced-motion auth visual matrix: coffee/delivery × portrait/compact landscape/desktop × open/closed; 12 кадров открыты и осмотрены.
- [x] Component-owned modal CSS uses spatial tokens and local reduced motion; core/overlay-core.js, core/panel.js and JS focus lifecycle remain unchanged.
- [x] Generic modal/shared overlay, staff PIN error and fullscreen QR reduced-motion assertions are covered by `auth-modal-ux.spec.js`. PIN-error and fullscreen-QR screenshots were attached to Auth artifact `playwright-Auth-44111856462` and opened/reviewed at delivery, `390×844`, reduced motion.
- [x] Address book sheet: normal entry/exit, reduced-motion immediate close, rapid reopen cancellation; `transitionrun` + delayed hidden lifecycle доказаны тестами.
- [x] RED подтверждён: прежний JS переключал `hidden` синхронно, из-за чего entry/exit transition не запускались; GREEN после component-owned lifecycle fix в `core/address-book.js`.
- [x] Cart/checkout screenshot `cart-address-book-390px` открыт и осмотрен: delivery/mobile 390×844, нижняя sheet, фон/контекст читаемы, 44×44px close/edit/delete targets, bottom/overflow assertions сохранены.
- [x] Добавлено reduced-motion покрытие generic modal/shared overlay и PIN/QR в `tests/auth-modal-ux.spec.js`; `90-modals.css` отключает transition у modal/overlay controls, PIN shake и QR canvas entrance.
- [x] Auth E2E на текущем source HEAD: CI #4087, 42/42 passed. Reduced-motion auth modal matrix (coffee/delivery × portrait/compact landscape/desktop × open/closed) — 12 кадров открыты и осмотрены; layout/focus visual state принят.
- [x] PIN-error и fullscreen-QR кадры на delivery / `390×844` под reduced motion открыты и визуально приняты в CI `44111856462`. Остальные staff overlays остаются открытыми для Stage 5.

### Stage 3 — micro/component

- [x] Chat FAB idle ping удалён как постоянный ambient loop; pulse hints отключаются под reduced motion.
- [x] Chat panel использует spatial tokens; message entrance — 180 мс opacity/translate без scale bounce.
- [x] Добавлен chat motion spec для coffee/delivery × portrait/short landscape: FAB без idle ping, panel timing, message timing, hint pulse normal/reduced, geometry и overflow.
- [x] RED получен на `::before` animationName=`ping`; GREEN — Responsive UI 129/129, Mobile Chrome 130/130.
- [x] PR #268 синхронизирован с pizza/#269 merge commit `c86e3257`; текущий rail owner `ui/category-rail.js` находится в ветке.
- [ ] Category/card/stepper/add-product motion ещё не закрыты визуально; реализовывать отдельно на текущих owners, сохраняя #269 rail geometry и scroll behavior.
- [x] Cart FAB: opacity-only show/hide, фиксированная ширина/позиция, без scale на hover/press; `prefers-reduced-motion` отключает transition.
- [x] Cart FAB regression test: стабильные bounds/transform, hover/pressed hit-target в normal и reduced motion; Cart/checkout 32/32.
- [ ] Category selected, stepper, add-product and card image micro-interactions still need a dedicated motion pass and cross-brand visual review; #266 is no longer a dependency.
- [x] Topbar role/brand controls and avatar/edit hover travel are static under reduced motion; regression is in staff-topbar-layout.spec.js.
- [x] Profile avatar, stamp progress, chevron and profile action transitions are reduced-motion safe; profile ambient feedback is covered by profile-orders.spec.js.
- [ ] Сохранить grid geometry и неизменность hit-target.

### Stage 4 — feedback/ambient

- [x] Chat hint pulse отключается при reduced motion; конечный pulse в normal motion сохранён как event-bound feedback.
- [x] Необоснованный постоянный chat FAB ping удалён.
- [x] Checkout validation scroll honors `prefers-reduced-motion`: `auto` under reduce, `smooth` otherwise; regression is in `tests/cart-checkout-clarity.spec.js`.
- [x] Order deep link uses instant scroll and disables its one-shot flash animation under reduce; regression is in `tests/profile-orders.spec.js`.
- [x] Confetti skips canvas initialization under reduce and clears/stops an active RAF loop when the preference changes; covered in tests/auth-modal-ux.spec.js.
- [x] Service toast and ambient hints/pulses are static under reduce; tested for both brands in chat-support.spec.js and auth-modal-ux.spec.js.
- [x] Cashier/customer/stamp/log entrance motion and staff-guide chevron are static under reduce; staff-topbar-layout.spec.js covers the owner styles.
- [x] Continue-shopping navigation scroll switches to auto under reduce; cart-checkout-clarity.spec.js covers both reduce and normal motion.
- [x] Delivery option .opts.shake is visually suppressed under reduce in the dynamic CSS owner; delivery-card-cart-state.spec.js checks the change.
- [ ] Delivery option validation and category selection in delivery.js still pass explicit smooth scroll options; verify normal/reduced motion and interrupted selection. No global scroll override.
- [x] Toast CSS переведён на общие tokens: entry 180ms и exit 120ms, без overshoot; при reduced motion entry мгновенный, exit скрывает toast без анимации.
- [x] Normal/reduced toast assertions для coffee/delivery добавлены также в `tests/chat-support.spec.js`, который присутствует в эффективном базовом CI workflow; тест ожидает готовность `window.toast`.
- [x] Toast RED/GREEN подтверждён: CI #4084 на `aeeb5ae40d91a3a483f0d5363d6c6d0f383eb696` поймал пропуск краткого `.out` (300ms); CI #4085 прошёл после ускорения polling до `[50, 100]`. Normal/reduced состояния для coffee/delivery проходят в `chat-support.spec.js` и `toast-motion.spec.js`; standalone spec перечислен в `Responsive UI` workflow один раз.
- [x] Toast timing визуально проверен: `toast-motion.spec.js` фиксирует реальные CSS animations `tin`/`tout` на 50% длительности через Web Animations API и прикладывает midpoint кадры normal entry/exit для coffee/delivery; reduced entry/exit также сняты. Все 8 кадров открыты и осмотрены в Responsive UI artifact `playwright-Responsive UI-44111856462` (`390×844`).
- [x] `core/fx.js` теперь отменяет активный RAF и очищает canvas/particles на `visibilitychange` → hidden; новый вызов `confetti()` в hidden игнорируется, автоматического resume при visible нет. RED зафиксирован в CI #4086, GREEN — Auth 42/42 в CI #4087.
- [ ] Продолжить отдельный аудит hidden/offscreen CSS loops и staff surfaces; не вводить общий lifecycle manager или глобальный override.
- [x] Ticker manual fallback подтверждён: `tests/pour-accessibility.spec.js` проверяет normal marquee, `animation-name:none`, `overflow-x:auto` и реальное ручное перемещение при reduced motion; CI #4087 прошёл.
- [x] Splash first-frame parity проверена: critical CSS против deferred `80-splash.css` для coffee/delivery, mobile `390×844` и desktop `1024×768`; normal timeline продолжает исходный `spFloat`, geometry/motion совпадают. Reduced-motion critical/theme кадры статичны. Пары открыты и осмотрены в Visual stability artifact `playwright-Visual stability-44111856462`.

### Stage 5 — финальная проверка

- [x] Реализованные core motion paths имеют normal/reduced regression coverage; оставшиеся overlays и отложенные category/card/delivery paths отдельно перечислены ниже и не считаются закрытыми.
- [ ] Быстрые повторные действия, interruption, viewport resize, keyboard/focus, touch.
- [ ] Оба бренда, guest/staff, mobile portrait, compact/short landscape, desktop.
- [ ] CLS, overflow, scroll, hit-target и overlay focus.
- [x] Toast: midpoint screenshots и computed progress assertions для entry/exit 180/120 ms; normal/reduced кадры coffee и delivery открыты и просмотрены на `1529c5dbeacc72b6c264478a10e617bf723189bd`.
- [x] Staff chat: normal/reduced screenshots для coffee и delivery (`390×844`) открыты и просмотрены; cashier redeem/scanner regression также проходит в обоих брендах. Admin и cashier visual fixtures изолированы разными BrowserContext, так как `auth-session.js` намеренно перезагружает соседние вкладки при изменении `zt_role`.
- [x] Profile-panel CSS source audit: loyalty `.stamp.n` / `.freeCard .fe` overrides уже задают `animation:none`; `.hmini` — одноразовый entrance, не perpetual loop. Не добавлять redundant override.
- [ ] Остальные обязательные staff after screenshots/role surfaces и полная interruption/resize matrix: keyboard/focus/touch.
- [ ] CLS, overflow, scroll, hit-target и overlay focus; document-level CLS `0.0511` остаётся отдельным follow-up.

## 8. Existing test coverage и пробелы

Существующие тесты:
- tests/cart-regress.spec.js и tests/cart-checkout-clarity.spec.js — реальные add/update/remove, empty cart, totals и cart open state.
- tests/swipe-panel-close.spec.js — CDP touch gesture, focus restore, scroll preservation, CLS < 0.001.
- tests/chat-support.spec.js — chat geometry/open и toast motion для coffee/delivery portrait, landscape, short landscape.
- tests/toast-motion.spec.js — отдельные normal/reduced motion проверки toast; в актуальном PR workflow выполняется один раз в Responsive UI.
- tests/auth-modal-ux.spec.js — auth, generic modal/overlay, staff PIN error, fullscreen QR, confetti and service ambient reduced-motion checks.
- tests/staff-topbar-layout.spec.js — topbar and cashier motion/reduced-motion states.
- tests/delivery-card-cart-state.spec.js — delivery option validation shake is static under reduced motion.
- tests/profile-orders.spec.js — order deeplink scroll/flash and profile ambient reduced-motion checks.
- tests/cart-checkout-clarity.spec.js — checkout validation scroll uses instant behavior under reduced motion and smooth behavior otherwise.
- tests/profile-orders.spec.js — order deep-link scroll and flash respect reduced motion.
- tests/pour-accessibility.spec.js — ticker reduced motion и manual scroll.
- tests/auth-modal-ux.spec.js — auth state/geometry.
- tests/slow-network-layout.spec.js и responsive suites — first-frame layout/overflow.
- tests/category-rail-scroll-behavior.spec.js — rail behavior на current pizza после #269.

Пробелы:
- Нет специальных тестов timing tokens.
- Cart sheet reduced-motion open/close и interruption close/reopen покрыты `tests/cart-motion-system.spec.js`; общий Cart/checkout проходит на проверенном SHA.
- Generic modal/overlay/PIN/QR, validation scroll, order deep-link flash/scroll и confetti reduce paths имеют regression assertions. Auth modal matrix, PIN-error и fullscreen-QR кадры осмотрены на актуальном CI `44111856462`. Визуальная приёмка остальных staff overlays ещё нужна.
- Staff overlays кроме PIN, interruption/resize для generic modal, chat FAB pseudo ping, hint pulse, bonus/free/staff ambient pulses и остальные smooth-scroll paths требуют дальнейшей проверки.
- Нет проверки resize во время перехода с фокусом/scroll.
- Toast entry/exit теперь имеет детерминированные промежуточные кадры; остальные overlay/interruption пути в основном фиксируют stable states и требуют отдельного timing review.

Новые тесты должны утверждать реальное поведение, timing/interruption и геометрию, не только наличие CSS transition.

## 9. Guardrails

- Не менять cart/catalog/checkout business logic и API contracts.
- Не менять DOM ownership и не добавлять universal animation manager.
- Не добавлять dependency, observer или global transition override.
- Не reintroduce closed #265/#266/#270 rail concepts or alter the #269 rail contract; any rail/card change must preserve current owner boundaries and pass geometry/scroll tests.
- Не менять base, не мержить PR, не делать force-push, не создавать parallel PR.
- Не обновлять screenshot baseline.
- Изменения public/* должны пройти штатный cache-busting через npm run build:client, который запускает npm run bump:sw. Никаких ручных инкрементов SW cache version.
- TDD: test first → RED в CI → минимальный CSS change → GREEN.
- PR остаётся Draft до полного CI и обязательного visual gate.

## 10. Текущий статус

Срез на 2026-11-17. PR #268, branch `design/ui-animation-system-20261116`, base `pizza` (`dacb424bdff9d073b3b9a4e13d723db1da92d078`). Проверенный source HEAD: `071e9a2b32fe0ba33febf24817a2969cff77e7f0`. PR остаётся Draft; `mergeable=true`, конфликтов с base нет.

**Подтверждённый CI:** run [44111856462](https://github.com/h0wller/zerno-app/actions/runs/44111856462) на точном HEAD `071e9a2b32fe0ba33febf24817a2969cff77e7f0`, conclusion `success`, 13/13 jobs. Auth — 43/43 passed; Responsive UI — 135 passed, 4 skipped, 0 flaky; Mobile Chrome — 139 passed, 4 skipped. Cart/checkout, Profile, Menu/search, Staff API, Visual UX capture, Visual stability, UI baseline, Bonuses, PWA и Code Quality также завершились success. Все build steps прошли; `npm run build:client` выполняет штатный `npm run bump:sw` перед esbuild.

**Изменения последнего цикла:** коммиты `086470b`, `1630647` и `071e9a2` усилили только тестовую визуальную фиксацию toast motion в `tests/toast-motion.spec.js`: реальная CSS animation ставится на паузу на 50% длительности, проверяются промежуточные opacity/translateX и прикладываются кадры. Runtime CSS/JS, DOM ownership, бизнес-логика, API и screenshot baselines этим циклом не менялись. Ранее добавленное локальное reduced-motion правило для `.auth-badge-confirmed` сохраняет подтверждение видимым без entrance animation.

**Визуальная приёмка на source HEAD `071e9a2`:**
- Splash: critical first frame и deferred theme CSS сопоставлены для coffee/delivery на mobile `390×844` и desktop `1024×768`, в normal и reduced motion. Геометрия и параметры анимаций совпадают; normal `spFloat` не перезапускается после поздней загрузки CSS.
- Skeleton: coffee first-frame skeleton на `390×844` в reduced motion статичен, без shimmer/pulse.
- Auth: confirmation badge осмотрен в normal/reduced для coffee/delivery на `390×844`; статус остаётся видимым. PIN-error и fullscreen QR осмотрены на delivery / `390×844` в reduced motion. Ранее принятая auth modal matrix — 12 кадров coffee/delivery × portrait/compact landscape/desktop × open/closed.
- Toast: normal entry/exit midpoint и reduced entry/exit для coffee/delivery на `390×844` открыты и осмотрены; reduced сохраняет немедленную видимость/скрытие без движения, normal даёт короткий spatial feedback без overshoot.
- Staff toast: placement осмотрен для coffee/delivery при ширине `821px` и `1024px`; нижняя центральная позиция не перекрывает role/edit controls и support FAB. Полная визуальная приёмка cashier/dispatcher/admin overlays ещё не завершена.

**Состояние этапов:** Stage 0 и Stage 1 завершены. Stage 2: auth/address-book, PIN-error и QR motion paths визуально проверены; остальные staff overlays ещё не приняты. Stage 3: реализованные chat/FAB/topbar/profile/cashier paths reduce-safe; category/card/stepper/add-product interactions остаются незакрытым motion scope (не dependency blocker). Stage 4: toast, splash, ticker, confetti, service/profile/cashier ambient и реализованные scroll paths покрыты; delivery validation/category scroll требуют дополнительной normal/reduced проверки. Stage 5 открыт до завершения полной matrix и residual findings.

**Оставшиеся findings / риски:**
- Category/card/stepper/add-product interactions и delivery validation/category smooth-scroll остаются незавершёнными проверками. #266 закрыт; использовать текущие owners, не менять #269 rail layout/scroll contract.
- Нужна визуальная приёмка оставшихся staff overlays и состояний cashier/dispatcher/admin; текущие PIN/QR и cashier feedback captures не заменяют полный role/overlay matrix.
- Не все быстрые повторные действия, interruption и viewport resize проверены одновременно с keyboard/focus/scroll на generic modal и оставшихся overlays.
- Исторический Mobile Chrome log фиксировал staff-header CLS = `0` и document CLS = `0.0511`. Этот finding закрывается последующим исправлением повторной skeleton-вставки в delivery.js; regression теперь проверяет весь document CLS, а не только шапку (см. §11/§12).
- F2.x support chooser race исторически проявлялась как retry в CI #4087; в текущем run Responsive UI — 0 flaky и 0 retries. Считать не воспроизведённой на текущем SHA, но оставить как follow-up до отдельного целевого retest.
- Отдельный аудит hidden/offscreen CSS loops не завершён. Не вводить общий lifecycle manager или глобальный reduced-motion override.

**Следующий шаг:** закрыть оставшиеся staff overlays/role matrix, проверить interruption + resize и завершить card/stepper/add-product visual review. CLS follow-up исправлен; PR остаётся Draft до полного visual gate.


## 11. Продолжение Stage 5 — 2026-11-17

**Текущий срез ветки:** PR #268 остаётся Draft, base `pizza` SHA `dacb424bdff9d073b3b9a4e13d723db1da92d078`, без конфликтов. Последний application/test HEAD с полным зелёным CI — `2365b3be7b4613d63acaca9f280dba3f199ce11e`, run [44125051592](https://github.com/h0wller/zerno-app/actions/runs/44125051592), 13/13 jobs. Последующий диагностический run [44128635061](https://github.com/h0wller/zerno-app/actions/runs/44128635061) также прошёл 13/13; в нём runtime-код не менялся, а временная телеметрия в `tests/slow-network-layout.spec.js` после анализа удалена отдельным revert-коммитом.

### Закрытые проверки этой сессии

- [x] Staff chat: Escape закрывает `#staffChatModal` через публичный owner-контракт `window.closeStaffChat`; focus capture/restore остаётся у `chat.js`; закрытие очищает shared overlay. Тест проверяет keyboard open/close, focus на Close, возврат к opener, overlay `aria-hidden`/pointer-events и границы карточки для coffee/delivery × portrait 390×844, compact landscape 844×390, desktop 1280×900.
- [x] Открыты и осмотрены 12 staff-chat кадров open/closed для обеих марок и трёх viewport. На mobile используется нижняя sheet, на landscape и desktop — центрированная карточка; явного overflow или потери контекста не обнаружено.
- [x] Preorder waiting pulse: на мобильной/планшетной закрытой profile drawer бесконечный `preorder-pulse` отключён локальным правилом owner CSS; конечный entrance сохраняется, при открытии pulse возвращается, reduced motion оставляет анимацию выключенной. RED/GREEN подтверждены Profile E2E в run `44125051592`.
- [x] Повторная проверка всех 13 CI-групп на application/test HEAD `2365b3b` прошла успешно.

### CLS follow-up — причина установлена и исправление внесено

На desktop delivery при viewport 1440×900 исходный regression воспроизводил document CLS 0.0510983, при staff-header CLS 0. Главный триггер — повторная staff-загрузка delivery.js повторно вставляла шесть skeleton cards поверх уже завершённого пустого каталога; #deliveryGrid кратковременно раздувался, меняя высоту grid row и позицию footer. В delivery.js добавлен data-catalog-ready guard: skeleton показываются только до первого успешного каталога, после renderDeliveryMenu() фиксируется готовность. Повторная staff-hydration больше не добавляет skeleton nodes.

ui/category-rail.js восстановлен до исходной реализации на актуальной ветке до экспериментального CLS-offset изменения. Убраны delivery-only transform и special margin offset; возвращены штатный marginTop и мобильные alignSelf/sticky переходы. Причину document CLS устраняет повторная вставка skeleton cards в delivery.js; отдельное изменение rail geometry не требуется и не должно нарушать #269 bottom-alignment/sticky contract.

Regression в tests/slow-network-layout.spec.js теперь ожидает data-catalog-ready, наблюдает #deliveryGrid только в границах сценария и запрещает повторную вставку skeleton cards. Главное assertion — document CLS <0.01, дополнительное — staff-header CLS <0.01. В локальном Chromium до восстановления desktop stretch было получено document CLS = 0 и staffHeader CLS = 0; exact geometry + CLS перепроверяются latest-head CI после восстановления desktop stretch.

Profile sidebar: #myOrders получает min-height:64px, чтобы переход loading → empty не сдвигал #fridayInfo. В tests/profile-orders.spec.js добавлен RED/GREEN regression, удерживающий API response и проверяющий высоту slot и y следующего блока с допуском 1 px; локальный Profile E2E прошёл 19/19. Preorder pulse fixture переведена на явную будущую дату, чтобы тест не зависел от времени запуска.

Временная диагностическая телеметрия удалена; существующие geometry/CLS assertions не ослаблялись, screenshot baselines не обновлялись.

### Оставшиеся цели Stage 5

- [ ] Завершить current-head CI после восстановления desktop rail stretch contract и исправления time-dependent preorder fixture.
- [ ] Довести interruption + rapid reopen + resize одновременно с keyboard/focus/scroll для generic modal и оставшихся staff overlays; отдельные cart/toast/address/gesture прогоны ещё не подтверждены на current head.
- [ ] Завершить role/viewport matrix для cashier, dispatcher и admin overlays. Уже проверены 12 кадров admin staff-chat для двух брендов и трёх viewport; это не заменяет полную staff matrix.
- [ ] Выполнить отдельную visual review card entrance, quantity stepper, add-to-cart и delivery option states в обоих брендах; не менять высоту cards/hit targets и не менять #269 rail layout.
- [ ] Поднять безопасный интерактивный read-only preview для телефона. Vercel project provisioned, но deploy не завершён: текущий Express + SQLite runtime нельзя просто подключить к production DB; preview требует mock API/test fixtures без реальных заказов/мутаций.
- [ ] Не переводить PR в Ready и не мержить до зелёного current-head CI и обязательного visual gate.

## 12. Продолжение Stage 5 — 2026-11-17, current-head follow-up

**Срез PR:** PR #268 остаётся Draft, base pizza (dacb424bdff9d073b3b9a4e13d723db1da92d078), ветка design/ui-animation-system-20261116. PR #265 и #266 закрыты без merge; #267 и #269 слиты; #270 закрыт без merge. Активных stacked dependencies для работы над текущими owners нет. Не возвращать закрытый floating-capsule/rail design.

**Изменения после предыдущего snapshot:**
- delivery.js: повторная staff hydration больше не показывает шесть skeleton cards поверх уже завершённого каталога (data-catalog-ready guard). Это устраняет временное увеличение #deliveryGrid.
- ui/category-rail.js: после CI выявлены desktop bottom-alignment и mobile sticky regressions от экспериментального offset/alignSelf изменения. Восстановлен исходный файл целиком из pre-change commit; #269 rail geometry/sticky owner не меняется.
- 110-panel.css: latest-order placeholder резервирует 64 px; regression проверяет, что #fridayInfo не смещается при loading → empty.
- profile-orders.spec.js: preorder-pulse fixture переведена на конкретную будущую дату и больше не зависит от времени запуска.
- slow-network-layout.spec.js: полный document CLS и отсутствие повторной skeleton-вставки проверяются явно; baseline не обновлялся.

**Локально подтверждено в изолированной Chromium Sandbox до её завершения:** staff hydration CLS test — document CLS 0, staffHeader CLS 0; category rail E2E 6/6; Profile E2E 19/19 с будущей датой; desktop profile hydration 1/1; unit/integration 186/186; npm run check, CSS audit, brand check, observer audit и git diff --check прошли. Эти результаты относятся к локальным прогонам; current-head CI остаётся источником истины для итоговой приемки.

**Текущий CI finding:** run 44152517813 выявил time-dependent preorder date fixture; она исправлена явной будущей датой. Run 44154868940 подтвердил Profile success, но нашёл регрессии rail на mobile sticky и desktop bottom alignment после экспериментального offset. Эти rail изменения отменены полным восстановлением исходного category-rail.js; текущая проверка запущена в run 44156396036 и должна завершиться перед закрытием Stage 5.

**Vercel preview:** project zerno-stage5-preview provisioned, но живой *.vercel.app deployment и read-only API adapter не созданы. Не подключать production SQLite или Telegram webhook к preview. Preview должен использовать отдельные fixtures и read-only mock API.

**Что ещё не принято визуально:**
- Полная matrix overlays для cashier/dispatcher/admin (normal/reduced, open/closed, portrait/landscape/desktop) — не завершена.
- Interruption/rapid reopen + resize в сочетании с keyboard/focus/touch/scroll на generic modal и staff overlays — не завершены полностью.
- Card entrance, quantity stepper, add-to-cart и delivery option motion требуют отдельного cross-brand visual review; #269 rail не редизайнить.
- Интерактивный mobile preview на телефоне отсутствует.

PR остаётся Draft. Нельзя считать Stage 5 завершённым только по зелёному CI: требуются current-head checks и визуальная приемка оставшихся состояний.
