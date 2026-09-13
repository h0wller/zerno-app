# Frontend tech debt (Фаза 2, стратегия B1)

## fix-views.js заморожен

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