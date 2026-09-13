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