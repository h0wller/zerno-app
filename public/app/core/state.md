# Контракт глобального состояния (F1.3)

Всё состояние фронта живёт в `window.*` — это **временно**, до Фазы 3
(растворение fix-views.js и переход на ESM-модули).

## Глобалы

| Имя | Тип | Пишет | Читает |
|---|---|---|---|
| `MENU` | `MenuItem[]` | boot, editor | renderMenu, fix-views v61 |
| `DMENU` | `MenuItem[]` | bootDelivery | renderDeliveryMenu |
| `meta` | `{ updatedAt }` | boot | renderUpd |
| `me` | `Customer \| null` | setUser, loadMe, logout | renderBonus, renderProfile, syncBrandViews |
| `brand` | `'coffee' \| 'delivery'` | setBrand | syncBrandViews, renderMenu, fix-views v61 |
| `mode` | `'guest' \| 'cashier' \| 'admin' \| 'dispatch'` | setMode, boot | renderModes |
| `editMode` | `boolean` | exitEdit, editToggle | renderMenu |
| `cart` | `CartItem[]` | addToCart, removeFromCart | renderCart, updateCartFab |
| `deliveryInfo` | `{ zones, slots, ... } \| null` | bootDelivery | renderCart, populateSlots |
| `cat` | `'coffee' \| 'drinks' \| …` | rail click | renderMenu |
| `dcat` | `'pizza' \| 'rolls' \| …` | delivery rail click | renderDeliveryMenu |
| `query` | `string` | searchInput input | renderMenu |
| `USER_TOKEN` | `string \| null` | setUser, logout | api.js (authHeaders) |
| `onboarded` | `boolean` | skipAuth | boot |

## Правила для новых модулей (public/app/*)

1. **Не объявлять** собственные `let MENU` / `var MENU` — это затрёт inline-глобал и сломает fix-views.
2. Читать через `window.MENU`, `window.me` и т.д. (в классическом script `MENU` тоже сработает — window-глобал).
3. Писать через присваивание `window.X = …` — inline увидит изменение.
4. Перерисовку звать явно: `window.renderMenu()`, `window.syncOverlay()`, `window.renderCart()`.
5. Тяжёлые или потенциально часто меняющиеся глобалы (`cart`, `MENU`) **не дублировать** в модулях.

## План Фазы 3 (не сейчас)

- Растворить патчи fix-views v61…v69 в модули `public/app/ui/*`.
- Перевести inline на `<script type="module" src="./app/main.js">`.
- Заменить `window.*` на ESM `import/export`.
- Каждый глобал из таблицы выше превратить в явный `export let`/`export function` + подписку на изменения (pub/sub или Proxy).