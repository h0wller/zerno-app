# Контракт оверлея (F1.4)

## Слои

1. **base** — `syncOverlay()` в `public/index.html` (~2026). Открывает `#overlay` для любого `.modal.show` / `#cartPanel.open` / `#panel.open`. **Мёртв после загрузки fix-views.js** (v66 заменяет), но нужен во время boot.
2. **v66** — `fix-views.js:1611–1650`. `window.syncOverlay = apply`. Управляет z-index (модалка 330 / корзина 110 / шторка 310), ведёт `histPushed66`, ставит `MutationObserver` на `body`.
3. **v67** — `fix-views.js:1651–1683`. Перепиcывает `#overlay.onclick`: закрывает только верхнюю модалку по CLOSE-карте.
4. **v68** — `fix-views.js:1684+`. Свайп по `#panel`, вызывает `window.syncOverlay()` в конце.

## Что делать новым модулям (public/app/*)

**Делать:**
- Изменять состояние модалки — только добавить/убрать класс `show` на `.modal` / `open` на `#cartPanel`/`#panel`. `MutationObserver` из v66 сам вызовет `apply()`.
- Если хочется явно — звать `window.syncOverlay()`.

**Не делать:**
- Не трогать `#overlay.onclick` — там цепочка base → v66 → v67.
- Не добавлять свой `MutationObserver` на `body`.
- Не переопределять `window.syncOverlay`.
- Не задавать `z-index` для overlay-элементов из JS — только через классы и CSS v66.

## Технический долг (Фаза 3)

- Base `syncOverlay` + её `popstate`/`onclick`/Escape — слить в v66.
- v66/v67/v68 — растворить в `public/app/core/overlay.js` (ESM).
- Порядок инициализации сейчас критичен: inline → utils → api → fix-views. В Фазе 3 будет explicit `await initOverlay()`.