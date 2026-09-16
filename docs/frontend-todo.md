# Frontend tech debt (Фаза 2, стратегия B1)
## Статус Фазы 3
- ✅ Ф3.1 — v68-полиш → public/app/core/a11y.js
- ✅ Ф3.2 — v62 CSS + panel-open → public/app/ui/styles.js
- ✅ Ф3.3 — v62 splash → public/app/core/splash.js
Ф3.11 (растворено) — секция 9 (чат-ядро) → public/app/chat-core.js
chatKey, fetch/toast-патчи, setBotName, kbAnswer, showHints, addMsg, mySend,
sendChat, reloadChatThread, chatMsgs-клики, chatFab-обёртка, loadScList,
updateStaffBadge вынесены. State (chatCtx/supportPending/chosenSupportCtx)
остаётся приватным в fix-views секция 0 и публикуется мостом
window.__fvChatState; chat-state.js — делегирующий прокси.
Пилюля ctxSwitch удалена (контекст следует за brandSeg).
### v10-support: гонка с интервалом
`fix-views.js` (блок `if(SUPPORT_ENTRY&&!chosenSupportCtx)`):
интервал 250ms ре-создаёт `#supportChooseOverlay`, если `showSupportOverlay()`
бросил исключение до `clearInterval(supIv)`. В CI проявляется как
`toHaveCount(0) failed: expected 0, received 1` в тесте `выбор доставки`.

**Обход сейчас:** `waitForTimeout(500)` в тесте + `retries:2` в CI.

**Фикс в Фазе 3:** обернуть тело интервала в try/finally, либо снимать интервал
при `chosenSupportCtx` безусловно.
### v61/v62 (fix-views) — loadDelivery / populateSlots / updateCartFab

В `fix-views.js` эти три функции **полностью заменяются** (не оборачиваются):
- `updateCartFab=function(){...}` (строка 200)
- `loadDelivery=async function(){...}` (строка 293)
- `populateSlots=function(){...}` (строка 312)

Оригинальные версии в `index.html` — **мёртвый код**, оставлены до Фазы 3.

**Почему не вынесены в `public/app/delivery.js` (F2.5, вариант B):**
если положить их в наш модуль, fix-views всё равно перезапишет их через
глобальное присваивание. Получится дубль, обёрнутый дважды — риск
двойных вызовов/побочных эффектов.

**Фикс в Фазе 3:** перенести содержимое fix-views версий в `delivery.js`
как единственную реализацию, удалить старые из `index.html` и `fix-views.js`.
### v61 (fix-views) — loadMyOrders перезаписывается

`loadMyOrders` в `fix-views.js` **полностью заменяется** на строках 527 и 1039.
Оригинал из `profile.js` (F2.2) — **мёртвый код** после загрузки fix-views.

**Фикс в Фазе 3:** перенести содержимое fix-views-версии в `profile.js`
как единственную реализацию, удалить дубликат из fix-views.
### v61 (fix-views) — openEditor и exitEdit заменяются целиком

`fix-views.js` переопределяет:
- `openEditor=function(id){...}` (строка 400)
- `exitEdit=function(){...}` (строка 481)

Оригиналы в `index.html` — **мёртвый код** после fix-views.
Связанные функции (`renderZone`, `loadImg`, `edit`, `#emZone/#emFile` handlers)
тоже остаются в inline: их использует fix-views-овский `openEditor`.

**Фикс в Фазе 3:** перенести содержимое fix-views-версий в `public/app/menu-editor.js`,
удалить дубликат.
### Ф3.1 (растворено) — v68-полиш → public/app/core/a11y.js

`fix-views.js` v68-полиш (a11y + reduced-motion + lazy-img) перенесён
в `public/app/core/a11y.js`. Удалён из fix-views, оставлен маркер.
### Ф3.2 (растворено) — v62 CSS + panel-open → public/app/ui/styles.js

CSS-инъекция v62 (`.chat-fab`, `.modal`, `.phead .gear`, `#settingsModal .set-row`,
`#deliveryView .search`) и MutationObserver `body.panel-open` перенесены
в `public/app/ui/styles.js`. Остальные части v62-IIFE (splash, settingsModal,
поиск в Пятнице, cashLog, custClose) — в следующих шагах.
### Ф3.3 (растворено) — v62 splash → public/app/core/splash.js

Splash-обработчик (`#brandSplashStatic`) перенесён в `public/app/core/splash.js`.
Добавлен экспорт `window.setChatCtx(ctx)` в fix-views (строка 624) —
точка входа для chatCtx из внешних модулей.
Фаза 3 (fix-views): ЗАВЕРШЕНА (Ф3.11–Ф3.23). fix-views.js удалён, тег f3.23.
Инвентаризация inline (Ф3.24): базы renderCart/orderCard/renderOrders/renderProfile/
loadMyOrders/showCust/renderLog/chatKey/addMsg/loadHistory/botReply/openStaffChat
живут в модулях; inline больше не дублирует их.
Остаток inline = ядро (глобалы, api/toast, auth, панели, QR, кофе-редактор,
review, renderAll/boot) → вынесено в отдельную Фазу 4.
Фаза 4 (план): 4.1 QR+review-кластер → core/qr.js, core/review.js;
4.2 auth-кластер → core/auth.js; 4.3 панели/виды → core/views.js (дополнить);
4.4 глобалы+утилиты → core/state.js, core/utils.js; renderAll/boot → core/boot.js;
удаление inline-скрипта; 4.5 ESM-миграция.

Фаза 4 (дедупликация inline): ЗАВЕРШЕНА (Ф4.1a/b, Ф4.2).
QR-кластер → core/qr.js; review-кластер → core/review.js; мёртвый loadPromos удалён.
Аудит остатка (weekpromo/pmSave/dash/loadSubs/confetti/promoBtn, база оверлея,
auth, панели, renderAll/boot): реализации одиночные, дублей нет — оставлены
в inline как ядро приложения.
Цепочка оверлея base→v66→v67 не тронута (контракт core/overlay.md).
Фаза 5 (план): вынос ядра из inline + переход на ESM — отдельная работа
с полным прогоном: 5.1 core/state.js (глобалы), 5.2 core/ui.js (api/toast/часы),
5.3 core/auth.js, 5.4 core/panel.js (база оверлея+панели), 5.5 core/boot.js
(renderAll/boot), 5.6 type=module + import/export, отказ от window.*-глобалов.