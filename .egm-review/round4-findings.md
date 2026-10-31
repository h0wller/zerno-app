# Round 4 findings (HEAD 51f94fce)

## P2-1 Major — watchdog vs slow network
index.html watchdog снимает резерв по таймеру (8с), не проверяя settle auth.
Фикс: флаг window.__staffHintSettled + однократное продление до 15с.

## P2-2 Medium — storage-sync newValue===null
auth-session.js: при удалении ключа в другой вкладке ветка инвалидации может не сработать, data-stready не выставляется.
Фикс: newValue===null -> тот же путь, что локальный logout.

## P2-3 Low — парсинг zt_role в 3 модулях
boot.js / auth-session.js / ui.js читают ключ независимо.
Фикс: общий helper readRoleHint().

## P3 — CI hygiene
Playwright full-page скриншоты ~116MB/run, retention 7d, hardcoded PR number в workflow.
