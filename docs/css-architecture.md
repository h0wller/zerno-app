# CSS-архитектура «…и кофе × Пятница»

**Статус:** нормативная карта логических владельцев CSS. Последнее обновление: 2026-11-05.
**Главный принцип:** логические слои ответственности не равны порядку подключения файлов или результату cascade.

## 1. Логические слои

### Слой 1 — базовый UI: `public/app/ui/theme/*.css`
Общие нейтральные стили, базовая геометрия, компоненты и общие состояния. Брендовые значения должны поступать из токенов. Не расширять селекторы бренда в базовом слое без отдельного архитектурного решения.

### Слой 2a — данные брендов: `public/app/ui/brand-tokens.css`
Только custom properties брендов. Не размещать здесь компонентную разметку, layout или состояния.

### Слой 2b — layout и брендовая синхронизация: `public/app/core/views.js`
Динамически подключаемые layout/media правила и брендовые поведенческие переопределения. Новые правила должны иметь обоснованный ownership, scope и responsive acceptance. Не дублировать здесь базовую геометрию без необходимости, но и не применять абсолютный запрет на layout: исключения принадлежат этому слою и должны быть явно объяснены.

### Слой 3 — локальные стили компонентов
Стили, создаваемые/подключаемые модулем-владельцем поведения (например, cart, delivery, chat). Их scope не должен захватывать чужие компоненты. Цвета используют токены.

### Слой 4 — critical CSS: `public/index.html`
Минимальная страховка первого кадра: фон, резервирование критической геометрии, ранние состояния splash/header и предотвращение FOUC/CLS. Полное состояние или полноценный стиль компонента здесь не дублируется.

## 2. Порядок подключения и каскад

- Логические слои выше описывают ownership, а не математический приоритет каскада.
- Файлы theme подключаются отдельными stylesheet links; точный список, порядок и загрузочные fallback сверяйте с актуальными `public/index.html`.
- Не указывайте фиксированное количество файлов/имён как бессрочную норму: при добавлении/удалении CSS обновляйте этот документ на основе фактических links и `sw.js`.
- `scripts/css-audit.mjs` проверяет ограниченный набор статических инвариантов; он не является полноценным CSS parser и не заменяет проверку computed styles.

## 3. Критерии добавления и удаления CSS

Перед добавлением правила зафиксировать:
1. Какой компонент или базовый паттерн им владеет?
2. Почему существующий слой-владелец не подходит?
3. Какие бренды и breakpoints затрагиваются?
4. Есть ли похожие правила в других слоях и являются ли они реальным дублированием или намеренным fallback/override?
5. Какой тест или скриншот подтверждает сохранение геометрии?

Не удалять повторяющиеся selectors только по совпадению текста. Учитывать media-контекст, specificity, порядок подключения, inline styles, бренд, critical fallback и hydrated DOM.

## 4. First paint, fonts и CLS

Ранний HTML/CSS должен резервировать тот же внешний размер шапки, марки, поиска, медиа карточек и фиксированных контролов, который будет после загрузки CSS/шрифтов и гидратации. Проверять:
- first paint при throttled CSS/fonts;
- геометрию после hydration;
- CLS и horizontal overflow;
- 320–390 px, промежуточные mobile widths, tablet и desktop;
- staff role hydration отдельно от guest state.

Для delivery storefront существует отдельный regression contract: `docs/testing/slow-network-layout.md`. Его порог CLS и viewport breakpoints менять только при обоснованной смене UX-контракта.

## 5. Responsive визуальная приёмка

Минимальный набор состояний:
- guest · coffee;
- guest · delivery;
- cashier;
- dispatcher;
- admin;
- cart closed/open and checkout validation;
- brand switch in both directions;
- authenticated state and cold guest state.

Снимки должны быть изолированы по роли и бренду. Не считать scrape с неизвестной сессией или скрытыми staff-панелями эталоном гостевого интерфейса.

После стилей запускайте релевантные Playwright specs и полный CI. `npm run ui:baseline` использовать только при намеренном обновлении эталона после визуального review.

## 6. Логотипы и media

- Горизонтальная марка «Пятница» использует горизонтальный SVG; квадратный raster в широком боксе запрещён, если это приводит к сжатию марки.
- Для кофейни квадратный raster + SVG fallback допустим, когда форма media-box квадратная.
- Реальную загрузку/кэширование SVG и raster сверять с актуальным `public/sw.js` и тестами.

## 7. Ownership

Полная карта DOM/CSS владельцев: `docs/module-map.md`. При переносе владения или изменении точки входа обновлять карту в том же PR. В случае расхождения сверяться с фактическим кодом и фиксировать корректировку в отдельном diff.

## 8. Проверки

- `npm run pretest`
- `npx playwright test <relevant-spec>`
- `npm run audit`
- просмотр CI screenshots/report, если сценарий их прикладывает

Не ослаблять assertions для сокрытия layout regressions. Визуальное изменение принимается только после сравнения screenshot states и review фактического responsive поведения.


### Detached floating category capsule

- `ui/category-rail.js` owns viewport lifecycle and clears legacy inline sticky values only for mobile and short landscape. `menu.js` / `delivery.js` retain category markup and selection ownership.
- The capsule is fixed at `max-width:820px` and short landscape (`min-width:821px`, landscape, `max-height:480px`). Ordinary desktop and tablet portrait retain the vertical in-flow sidebar.
- `150-rail.css` owns capsule geometry and brand-token appearance. `20-cards.css` and minimal critical CSS in `index.html` reserve bottom scroll clearance; an extra FAB lane exists only while the cart launcher is visible.
- The cart state/FAB remain owned by `cart.js`; the category capsule and launcher are hidden while the cart sheet is open.
- The rail has no horizontal scrolling. Category controls retain accessible names and 44×44px minimum hit areas. Delivery subfilters keep their own independent overflow behavior.
- Include safe-area exactly once in the 10–12px visual bottom gap and test both brands at 320/360/390/430 portrait and 844×390 / 1024×390 compact landscape.


### Mobile detached category capsule correction

- На floating breakpoints (max-width:820px и short landscape) .wrap имеет одну контентную колонку. Fixed capsule не занимает grid track; слева не резервируется прежняя 80px rail column.
- Первый кадр в index.html и hydrated layout в core/views.js используют одинаковый одноколоночный .wrap. Отрицательные rail-компенсации margin-left на меню/заголовке в этих breakpoints не используются.
- cartFab остаётся DOM/state owner cart.js; inline SVG glyph — статическая презентация в HTML, а lane определяется responsive CSS над capsule.
