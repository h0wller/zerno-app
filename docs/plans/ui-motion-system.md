# Zerno Motion System — аудит и спецификация

**Статус:** инвентарь завершён, спецификация подготовлена; Stage 1 ожидает TDD RED.
**PR:** #268, Draft. Ветка: design/ui-animation-system-20261116.
**HEAD на момент аудита:** 265e984381a8fcf4149ec3e129747001efd0dd7a.
**Base:** pizza. Базовая точка PR: 61ca1a47f5782af057e1dfc09b56341a31ddaa88.

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

PR #265 открыт и не объединён; ветка feat/mobile-bottom-category-rail-20261116. PR #266 открыт, не Draft, основан на #265; head 15e0fb273f73f4b6238ebdd0694de662b522031f.

В #266 пересекаются menu.js, 150-rail.css, 20-cards.css, critical CSS в index.html, sw.js и связанные тесты. Поэтому rail, menu и card motion нельзя безопасно реализовывать из старой базы #268 без согласования зависимости.

### Более новое состояние pizza: PR #269

В ходе проверки обнаружено, что PR #269 feat: improve category rail scroll behavior уже объединён в pizza. Merge commit: dacb424bdff9d073b3b9a4e13d723db1da92d078.

#269 добавил повторное нажатие выбранной категории для прокрутки вверх, убрал старый scroll-top control/module и реализовал fade основных категорий во время скролла. Delivery subfilters не затухают. Новым владельцем rail behavior стал ui/category-rail.js.

Важно: PR #268 остался на старой base SHA 61ca1a47… и не содержит #269. PR #266 по-прежнему открыт и построен поверх #265.

**Решение по scope:** не переносить #269/#266 в #268, не менять base, не переписывать историю и не трогать rail/category/menu/card файлы в первом этапе. Начать с cart sheet, чьи владельцы не затрагивались этими изменениями. Возврат к rail возможен только после явного разрешения зависимости веток.

## 3. Архитектурные ограничения и ownership

Проект использует четыре логических слоя CSS:

- **Layer 1:** public/app/ui/theme/*.css — нейтральная база компонентов и общие timing tokens.
- **Layer 2a:** public/app/ui/brand-tokens.css — только брендовые custom properties.
- **Layer 2b:** public/app/core/views.js — динамические брендовые и layout-правила.
- **Layer 3:** компонентные стили рядом с модулем-владельцем.
- **Layer 4:** минимальный critical CSS в public/index.html, синхронизированный с первым кадром, но не являющийся вторым источником поведения.

DOM ownership остаётся прежним: cart.js владеет состоянием и рендером корзины; core/overlay-core.js — общей синхронизацией overlay; core/panel.js — lifecycle профайл-drawer и возвратом фокуса; core/swipe.js — touch-жестом панели; chat.js/chat-core.js — чатом и подсказками; core/auth.js — auth modal; profile.js — содержимым профиля; core/fx.js — canvas confetti; core/deeplink.js — deep-link подсветкой; admin-extra.js — ticker. На актуальном pizza rail после #269 владеет ui/category-rail.js, но этот модуль отсутствует в HEAD PR #268.

Межмодульная связь использует window.ztBus или уже существующие API владельцев. Не добавлять observer на body/documentElement, не менять DOM ownership, не вводить глобальные обработчики/monkey-patching.

## 4. Полный inventory

Инвентарь охватывает все 32 CSS-файла в public/app/ui/theme/, critical CSS в public/index.html и JS motion paths. Значения ниже — декларации исходного кода на HEAD PR #268, не измеренная perceived duration.

### 4.1 CSS Layer 1

| Файл / компонент | Текущая motion | Reduced motion / последствия | Решение и покрытие |
|---|---|---|---|
| 00-head.css | Motion правил нет; корневые нейтральные токены. | Нет собственного пути. | Единственный владелец общих timing tokens. Не размещать здесь компонентные селекторы. |
| 10-base.css | Motion правил нет. | Нет собственного пути. | Без изменений. |
| 20-cards.css | .card transform/opacity 200ms ease + pop 500ms с --d; image transform 500ms, emoji 300ms; stepper 100ms. | Reduce отсутствует. Card entrance и hover используют transform одновременно; stepper scale меняет визуальную область hit-target. | Карточки требуют отдельной проверки; пока не менять из-за пересечения с #266. |
| 30-utils.css | Определяет ping, stampin, shimmer; потребители задают длительность. | Глобального reduced режима нет. | Keyframes остаются нейтральными; reduce определяется каждым потребителем. |
| 40-catalog.css | Skeleton shimmer 1.2s infinite. | Reduce отсутствует; постоянная перерисовка фона, без layout shift. | Оставлять только во время загрузки; статическое состояние под reduce. |
| 50-edit-mode.css | Switch background и knob left переходят за 250ms. | Reduce отсутствует; left вызывает layout/paint. | Позже проверить замену left на transform при сохранении geometry. |
| 60-cart.css | cartPanel transform 300ms cubic-bezier(.2,1,.3,1); close button transform 150ms; hover scale 1.08. | Reduce отсутствует. Sheet не меняет поток, но на время движения сдвигает hit-targets. | Цель Stage 1. Сохраняем пространственное направление, токенизируем duration/easing, отключаем travel под reduce. |
| 70-ticker.css | zt-marquee translate3d, 30s linear infinite. | Reduce реализован: marquee отключается, viewport становится вручную прокручиваемым. | Сохранить доступный fallback; проверить динамическую смену системной настройки. |
| 80-splash.css | spRise 600–700ms с задержками; spFloat 3.2s infinite; кнопки около 120ms. | Основные анимации отключаются в reduce. | Сократить ощущаемую задержку; сохранить parity с critical CSS. |
| 90-modals.css | overlay opacity 300ms; modal-card opacity/transform 350ms cubic-bezier(.2,1,.3,1); close hover rotate/scale; PIN shake 400ms; QR stampin 450ms с overshoot. | Reduce есть только для authModal card. Generic overlay/modal, PIN и QR не покрыты. Blur на весь экран остаётся paint cost. | Унифицировать пространственное движение локально; добавить reduced поведение без глобального override. |
| 100-chat.css | FAB transition 200ms; ::before ping 2.4s infinite; chat panel all-properties 300ms; messages 300ms cubic-bezier(.2,1.2,.4,1), scale/translate; controls 150–200ms. | Reduce выключает .chat/.chat-fab/.msg, но не .chat-fab::before — ping продолжается. | Явно перечислить transition properties; убрать idle ping и overshoot; проверить reduce. |
| 110-panel.css | Tabs 200ms, stamp 300ms; nextp 1.6s infinite; free-card icon sway 2.6s infinite; authPrompt rise 400ms, hmini rise 300ms. | Reduce отключает только некоторые stamp/free-card циклы. Возможен конфликт specificity: unconditional profile stamp animation:none и более поздняя .stamp.n animation:nextp. | Проверить computed style; убрать бессмысленные бесконечные движения; расширить локальный reduce. |
| 120-cashier.css | cashier rise 400ms; customer panel 350ms; log rows 300ms; stampin 500ms cubic-bezier(.2,1.6,.4,1); controls 180–220ms. | Reduce отсутствует. Stamp явно overshoot. | Убрать overshoot и entrance delay под reduce; проверить staff role. |
| 130-service.css | Toast in 350ms cubic-bezier(.2,1.4,.4,1), out 300ms; bonus opacity/transform 250ms; qty 100ms; freePulse 2.2s infinite; glowPulse 1.5s infinite; form state 200ms. | Reduce отсутствует. Shadow pulse вызывает paint. | Сдержанный one-shot toast; убрать idle pulse/glow; сохранить текст/цветовой feedback под reduce. |
| 140-topbar.css | role switch/avatar/rail 250ms; search 200ms; shared rise keyframe. | Reduce отсутствует. | Состояния нормализовать; pure data replacement не анимировать. |
| 150-rail.css | На HEAD #268 motion rules отсутствуют. На current pizza после #269 есть fade и reduce для rail. | HEAD/base различаются; subfilters исключены из fade. | Не трогать в Stage 1. Требует разрешения зависимости #268/#266/#269. |
| 160-01-rail-fab-mobile.css | cartFab opacity/transform 300ms; badge 350ms; skeleton pulse 1.4s; empty state 400ms; address sheet 220ms; preorder timer 300ms + pulse 2s; validation shake 400ms. | Reduce покрывает skeleton, empty, address sheet/button, preorder waiting pulse и validation shake; cartFab/badge остаются без reduce. | CartFab — отдельный этап. Сохранить геометрию и кликабельность. |
| 160-02-addr-panel-fix.css | #mbonusBtn opacity/transform 250ms. | Reduce отсутствует. | Проверить, что selector остаётся живым, затем локально нормализовать. |
| 160-03-topbar-search-panel.css | .wrap > .panel transform 350ms. | Reduce отсутствует. | Не менять без проверки panel.js/views.js и swipe transform. |
| 160-04-wrap-cls-sheets.css | image transform 300ms; panel transform 350ms (несколько селекторов); cartPanel 300ms. | Reduce отсутствует. cartPanel transition дублируется в 60-cart.css; panel пересекается с views/swipe. | Проверить cascade/computed style; убрать только подтверждённый дубль, не делать global panel override. |
| 160-05-base-components.css | Motion правил нет. | Нет собственного пути. | Без изменений. |
| 160-06-delivery-header.css | venue toggle bg/transform/border 200ms; arrow 200ms; brand segment fadeIn 200ms; CTA 150ms. | Reduce отсутствует. | Локальная нормализация после разрешения rail dependency. |
| 160-07-orders-cards.css | В HEAD #268 legacy scrollTop transition 250ms; order tracking button 120ms. | Reduce отсутствует. В current pizza scrollTop удалён PR #269. | Не возвращать scrollTop. Переоценить после синхронизации base. |
| 160-08-cart-addons.css | add-on chips 150ms; add button transform/shadow/bg 120ms; scroll controls 150ms. | Reduce отключает основную группу add-on transition. | Сохранить scoped правила; проверить focus/hit targets. |
| 160-09-preorder-subfilters.css | progress fill width 300ms; overflow cue opacity 180ms; subchip color 150ms; option state 150ms. | Reduce отключает только overflow cue. width может инициировать layout. | Оставить width только для зарезервированной геометрии; расширить reduce. |
| 160-10-rail-mobile-opts.css | time mode state 150ms; order-step opacity/transform 250ms. | Reduce отсутствует. | Нормализовать local state, не анимировать layout. |
| 160-11-canonical-grid-menu.css | Явно animation:none для delivery cards. | Намеренное подавление входа. | Сохранить. |
| 160-12-admin-bar-tail.css | Явно animation:none для delivery menu header. | Намеренное подавление входа. | Сохранить. |
| 160-13-dashboard-bento.css | Dashboard tabs bg/color/shadow 180ms. | Reduce отсутствует. | Позже нормализовать простое состояние без transform. |
| 160-14-auth-modal.css | Form/mode switch 180ms; busy spinner 700ms infinite linear. | Scoped reduce устанавливает transition/animation 0.01ms и iteration 1; spinner отдельно отключён. | Оставить мгновенное состояние; позже проверить избыточно широкий descendant selector. |
| 160-15-mobile-support-toolbar.css | Support/mode controls 150ms. | Reduce отключает. | Сохранить scoped reduce. |
| 170-profile-button.css | Profile button 250ms; tabs 200ms; stamp track width 180ms; chevrons 160–180ms; controls 120ms. | Reduce покрывает только часть путей. Width может вызывать layout. | Локально расширить reduce; не анимировать весь профиль при открытии. |

### 4.2 JS и динамический CSS

| Владелец | Триггер и текущий эффект | Риски / reduce | Решение |
|---|---|---|---|
| core/views.js | Вставляет Layer 2 CSS: delivery option shake 400ms, active translateY(1px), brand/mode/panel правила; RAF добавляет pulse. | Shake не имеет reduce; динамический panel transform пересекается с CSS и swipe inline transform. | Оставить owner; reduce добавлять в тот же динамический style owner. |
| core/swipe.js | Mobile profile swipe пишет inline transform, отключает transition во время drag; завершение 320ms + overlay opacity 320ms. Nudge 1.1s cubic(.3,1.4,.4,1), hintFade 1.6s. | Нет reduce; overshoot; resize/reopen потенциально конкурируют с cleanup. | Gesture сохраняется отзывчивым, но decorative nudge/hint отключаются под reduce. Проверить прерывание/resize. |
| ui/styles.js | Вставляет общий .pulse: scale + expanding shadow, 1.3s infinite; chatHint pulse 1.2s × 3. | Нет reduce; broad selector может затронуть несвязанные .pulse consumers; shadow repaint. | Сузить владельца и убрать idle loop. |
| core/fx.js | window.confetti создаёт 90 частиц; canvas RAF draw/clear до ухода за экран. | Нет reduce и hidden-document cancellation; layout shift отсутствует, но есть постоянный paint на время эффекта. | Под reduce пропустить эффект или показать static feedback; прекращать при hidden. |
| core/deeplink.js | Order card flash 2.4s (background + outline); scrollIntoView smooth; review action also smooth-scrolls then glow. | Нет reduce; background repaint; scroll может конфликтовать со sticky state. | Сохранить смысловую подсветку, под reduce убрать движение и делать instant scroll. |
| admin-extra.js | ResizeObserver/RAF измеряют ticker overflow; CSS владеет marquee; matchMedia reduce читается в JS. | Не отдельный animation loop. | Сохранить owner/fallback, проверить live preference changes. |
| cart.js | Синхронные open/close class changes; addon scrollBy выбирает auto под reduce; один grid scrollIntoView smooth reduce не учитывает. | Не ждёт transitionend — это верное поведение. | Бизнес-логику не менять; добавить reduce-safe scroll в будущем изолированном изменении владельца. |
| core/overlay-core.js | Overlay classes, Escape, backdrop, popstate и cart/modal orchestration. | Не ждёт окончания animation. | Сохранить lifecycle owner. |
| core/panel.js | Drawer open/close + focus restore. | Координируется с inline transform из swipe.js. | Сохранить владельца; проверять repeated open/close, Escape, focus. |
| chat.js / chat-core.js | Chat open/close, message/hint state. | FAB pseudo ping и dynamic hint pulse неполностью reduce-safe. | Сохранить JS owner; изменить только component CSS/Layer3 owner. |
| core/splash.js + index.html | JS lifecycle; CSS/critical CSS first-frame entrance/float. | Reduce есть, но две копии могут рассинхронизироваться. | Сохранять parity Layer4/Layer1. |
| ui/scrolltop.js | В HEAD #268 legacy scroll button/rail position owner. | Current pizza после #269 модуль retired, rail переехал в ui/category-rail.js. | Не возвращать/не модифицировать в Stage 1. |
| menu.js / delivery.js | Menu render, categories, filters, zoom/image priorities. | Изменены #266/#269; ownership на current pizza отличается от HEAD #268. | Не менять до разрешения branch dependency. |
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
- [x] Component-owned CSS модалки использует spatial tokens и локальный reduced-motion; `core/overlay-core.js`, `core/panel.js` и JS focus lifecycle не менялись.
- [ ] Отдельно проверить address book и staff overlays; это остаётся в Stage 2.

### Stage 3 — micro/component

- [x] Chat FAB idle ping удалён как постоянный ambient loop; pulse hints отключаются под reduced motion.
- [x] Chat panel использует spatial tokens; message entrance — 180 мс opacity/translate без scale bounce.
- [x] Добавлен chat motion spec для coffee/delivery × portrait/short landscape: FAB без idle ping, panel timing, message timing, hint pulse normal/reduced, geometry и overflow.
- [x] RED получен на `::before` animationName=`ping`; GREEN — Responsive UI 129/129, Mobile Chrome 130/130.
- [ ] Разрешить #268 rail/base dependency до category/rail motion; не переносить #266/#269 в текущую ветку без согласования.
- [ ] Test press/selected, stepper, add-product, card image и cart FAB.
- [ ] Сохранить grid geometry и неизменность hit-target.

### Stage 4 — feedback/ambient

- [x] Chat hint pulse отключается при reduced motion; конечный pulse в normal motion сохранён как event-bound feedback.
- [x] Необоснованный постоянный chat FAB ping удалён.
- [ ] Сделать validation, toast, order flash и confetti reduced-motion safe.
- [ ] Останавливать декоративные циклы у hidden/offscreen surface, где безопасно.
- [ ] Сохранить ticker manual fallback и splash first-frame parity.

### Stage 5 — финальная проверка

- [ ] Normal и reduce для каждого изменённого пути.
- [ ] Быстрые повторные действия, interruption, viewport resize, keyboard/focus, touch.
- [ ] Оба бренда, guest/staff, mobile portrait, compact/short landscape, desktop.
- [ ] CLS, overflow, scroll, hit-target и overlay focus.
- [ ] Короткие recordings, когда screenshot не показывает timing/interruption.
- [ ] Открыть каждый обязательный after screenshot. Записать SHA, viewport, brand, role, state и визуальный результат.

## 8. Existing test coverage и пробелы

Существующие тесты:
- tests/cart-regress.spec.js и tests/cart-checkout-clarity.spec.js — реальные add/update/remove, empty cart, totals и cart open state.
- tests/swipe-panel-close.spec.js — CDP touch gesture, focus restore, scroll preservation, CLS < 0.001.
- tests/chat-support.spec.js — chat geometry/open для coffee/delivery portrait, landscape, short landscape.
- tests/pour-accessibility.spec.js — ticker reduced motion и manual scroll.
- tests/auth-modal-ux.spec.js — auth state/geometry.
- tests/slow-network-layout.spec.js и responsive suites — first-frame layout/overflow.
- tests/category-rail-scroll-behavior.spec.js — rail behavior на current pizza после #269.

Пробелы:
- Нет специальных тестов timing tokens.
- Нет cart sheet reduced-motion coverage.
- Нет rapid open-close-reopen во время активного перехода.
- Нет generic modal/overlay reduced/interruption tests.
- Не проверены chat FAB pseudo ping, hint pulse, confetti, order flash и smooth scroll в reduce.
- Нет проверки resize во время перехода с фокусом/scroll.
- Большинство visual tests фиксируют stable states, а не промежуточные кадры.

Новые тесты должны утверждать реальное поведение, timing/interruption и геометрию, не только наличие CSS transition.

## 9. Guardrails

- Не менять cart/catalog/checkout business logic и API contracts.
- Не менять DOM ownership и не добавлять universal animation manager.
- Не добавлять dependency, observer или global transition override.
- Не менять rail/menu/card files до разрешения branch dependency.
- Не менять base, не мержить PR, не делать force-push, не создавать parallel PR.
- Не обновлять screenshot baseline.
- Изменения public/* должны пройти штатный cache-busting через npm run build:client, который запускает npm run bump:sw. Никаких ручных инкрементов SW cache version.
- TDD: test first → RED в CI → минимальный CSS change → GREEN.
- PR остаётся Draft до полного CI и обязательного visual gate.

## 10. Текущий статус

Срез на 2026-11-17, PR #268, branch `design/ui-animation-system-20261116`, base `pizza`, HEAD до документационного обновления: `b599c835d9dda95463515cc588ea262cf8c8722a`.

Stage 0 завершён. Stage 1 (cart sheet) завершён. Stage 2 частично завершён: auth modal/overlay реализованы и визуально проверены; address book/staff overlays остаются. Stage 3 частично завершён только для chat panel/FAB/hints; category rail, product cards, category selection и cart FAB ещё не реализованы. Stage 4 частично закрывает chat hint и постоянный FAB ping; validation/toast/order flash/confetti и остальные ambient циклы остаются.

Последний полный CI run `44039724343` на `b599c835`: 13/13 jobs successful. Ключевые группы: Cart/checkout 31 passed, Auth 36 passed, Responsive UI 129 passed, Mobile Chrome 130 passed. В CI client build штатный `npm run build:client` запустил `npm run bump:sw` и сообщил `v649 → v650`; результат зафиксирован в commit `179be0e` (`public/sw.js`, `public/index.html`), проверены `STATIC_CACHE=zerno-static-v650` и 69 asset refs `?v=650`.

Visual review: cart normal/reduced recordings и геометрия осмотрены в mobile portrait, compact landscape и desktop; auth reduced-motion 12 кадров (2 бренда × 3 viewport × open/closed) осмотрены; chat motion проверен в двух брендах и portrait/short landscape через Playwright. Baselines не обновлялись.

Rail/category/card motion отложен: PR #266 остаётся отдельной stacked-зависимостью, #269 уже находится в pizza; #268 base не менялся. Не объединять и не переносить ветки без согласования.

Следующий этап: завершить cache-busting v650, затем micro-interactions карточек/категорий только после повторной проверки статуса #266; отдельно покрыть cart FAB, profile/address book/staff overlays и оставшиеся feedback/ambient effects.
