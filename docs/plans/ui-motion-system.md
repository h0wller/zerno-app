# Zerno Motion System — интеграция в PR #273

**Статус:** implementation in progress. Этот документ фиксирует scope интеграции и критерии завершения; он не переносит CI или визуальные результаты из донорских веток.

## Источники изменений

- **PR #268** — общая motion-система: общие timing/easing tokens, cart sheet, адресная шторка, chat, auth/PIN/QR/modal, toast, profile/staff feedback, reduced-motion поведение, confetti и scroll behavior.
- **PR #277** — только входная анимация карточек и press feedback stepper. Не переносить branch целиком и не импортировать изменения cart FAB, category rail или responsive grid из #277.

Вся реализация адаптируется к текущему markup, CSS cascade, DOM ownership и responsive contract ветки `fix/restore-floating-category-rail-20261117` PR #273.

## Motion principles

1. Сначала изменяется состояние; анимация не блокирует клик, навигацию, checkout, API или focus.
2. Единые timing tokens для coffee и delivery; компонентные селекторы остаются у локальных CSS owners.
3. Использовать opacity/transform без изменения layout и размеров hit target.
4. Не использовать overshoot/bounce для панелей, кнопок, сообщений и навигации.
5. `prefers-reduced-motion` — полноценное состояние: отключать необязательное движение и циклы, сохраняя немедленную видимость состояния и feedback.
6. Не добавлять animation library, универсальный animation manager или новый MutationObserver.

## Non-negotiable integration constraints

- Не менять category rail DOM ownership или реализацию #273 в `public/app/ui/category-rail.js`, `menu.js`, `delivery.js` и `150-rail.css`.
- Сохранить одновременный fade rail и видимого `#cartFab` при обычном скролле, подавление fade при программном scroll-to-top от активной категории и отмену подавления при ручном вмешательстве.
- Геометрия, hit target и transform cart FAB остаются контрактом #273; не переносить FAB geometry/transform из #268/#277 и не импортировать из #277 поведение скрытия FAB во время скролла. Совместный rail/FAB fade покрывается текущими тестами #273.
- Сохранить трёхколоночную сетку до 1599px; не переносить правило #268/#277 с четырьмя колонками от 1400px.
- `card-enter`: 180ms opacity + translateY(8px), без scale, `animation-fill-mode: backwards`. Не использовать `both`: после завершения входа hover lift должен снова работать.
- Stepper press feedback: 120ms, scale 0.96 и brightness 0.96; не менять минимальный hit target 44×44.
- `public/sw.js` static cache остаётся `zerno-static-v668`; URL ресурсов в `public/index.html` остаются с `?v=668`. CI выполняет временную сборку; generated bundle/cache bump не коммитится из CI.
- Не обновлять screenshot baselines для сокрытия diff.

## Explicitly excluded functional changes from #268

Эти изменения не входят в motion scope и не должны появляться в PR #273:

1. **Staff-chat Escape/focus lifecycle:** Escape dismissal, opener focus capture/restore в `public/app/chat.js` и `public/app/core/overlay-core.js`, плюс функциональные тесты.
2. **Delivery catalog hydration marker:** `data-catalog-ready` в `public/app/delivery.js` и связанная skeleton/hydration regression в `tests/slow-network-layout.spec.js`.
3. **Latest-order slot reservation:** `#profileBox #myOrders { min-height: 64px; }` и соответствующий тест удержания позиции в `public/app/ui/theme/110-panel.css` / `tests/profile-orders.spec.js`.

Также исключены 4-column breakpoint/test 1400px, любые изменения `public/sw.js` и любые API/business-logic changes.

## Component ownership and selected implementation paths

- `cart.js` остаётся владельцем состояния/рендера корзины. Из #268 берётся только reduced-motion выбор для continue-shopping scroll; основной cart sheet меняет визуальное состояние через уже существующий `.open` state и CSS в `60-cart.css` с зеркалом critical CSS в `index.html`.
- `core/address-book.js` владеет lifecycle адресной шторки: не скрывать sheet до конца exit transition; отменять ожидающее закрытие при reopen; under reduced motion скрывать немедленно.
- `core/ui.js` / `window.toast` не меняется. Toast motion — CSS в `130-service.css`, тесты — `tests/toast-motion.spec.js`.
- `core/fx.js` владеет confetti canvas/RAF; stop/cancel остаётся локальным.
- `core/views.js` владеет динамическим delivery option shake override (Layer 2b).
- `ui/styles.js` владеет runtime chat hint pulse styles.
- Category rail и floating cart DOM ownership остаются в #273; новый JS animation manager не добавляется.

## Test and visual acceptance

Targeted Playwright coverage is wired into the existing CI groups:
- cart sheet lifecycle, interruption and reduced motion;
- address sheet entry/exit/reopen and reduced motion;
- chat panel/message/FAB and hint motion;
- auth modal, generic overlay, PIN/QR, confetti and ambient effects under reduced motion;
- toast entry/exit (180/120ms) and reduced motion;
- profile/deeplink/preorder reduced motion;
- card entrance/hover and stepper active feedback;
- rail fade during manual downward scroll and no fade during selected-category scroll-to-top.

Final visual evidence must be generated from the final #273 HEAD, not an earlier commit. Required captures include coffee and delivery at 390×844: (a) normal downward scroll showing the rail fade and delivery cart FAB fade when populated, (b) selected-category scroll-to-top with both controls restored and no programmatic fade. Include relevant motion frames and reduced-motion states from the motion test artifacts.

The PR remains Draft until CI on the final exact HEAD is reviewed and the required screenshots are actually opened/visually inspected. A generated artifact or green CI alone is not visual acceptance.
