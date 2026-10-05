# Карта владения модулями («…и кофе × Пятница»)

Каноническая карта «модуль → часть сайта». Единственный источник правды о том,
какой модуль владеет какими DOM-узлами и поведением.
Правило-инцидент: один DOM-узел — ровно один модуль-владелец; остальные читают
состояние через window.*-контракты.
Обновляется тем же PR, что и создание/переименование/удаление модуля
(см. docs/frontend-todo.md, разд. 5, п. 7).

Колонка «Контракты» — window.*-функции, которые модуль публикует для других.

## 0. Точка входа, жизненный цикл, кэш

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `public/app/main.js` | Единственная ESM-точка входа; порядок импортов = порядок инициализации; `boot.js` строго последним | — |
| `public/app/core/boot.js` | `renderAll()`, `boot()`; ЕДИНСТВЕННАЯ регистрация SW (SKIP_WAITING + reload только при hadController); install-баннер; iOS-хинт; IMG-FB v1 (фолбэк webp→svg при ошибке загрузки) | `window.renderAll`, `window.boot` |
| `public/sw.js` | `STATIC_CACHE` — App Shell (cache-first + фоновая ревалидация); `MEDIA_CACHE` — svg network-first (no-cache), png/webp SWR; `API_CACHE` — /api/menu SWR 5 мин | — |
| `public/index.html` (инлайн, СЛОЙ 4) | early-brand-guard; critical-fouc-guard; perf-bridge (Lighthouse); TgUx-стаб; префетч /api/menu и /api/dmenu; lcp-inline-css; FOUC-guard Ф3.51 (первый кадр шапки/марки/тикера); владелец клика сплэша; early-chrome-guard. Легаси-дубль регистрации SW — кандидат на удаление (владелец boot.js) | — |

## 1. Глобальное состояние, сеть, утилиты

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `core/state.js` | window-глобалы: USER_TOKEN, onboarded, MENU, meta, me, mode, editMode, brand; CATS/TINT; iOS gesture-guard; детект TG Mini App | `window.CATS`, `window.TINT`, `window.__isTgMiniApp` |
| `core/utils.js` | Чистые утилиты форматирования/DOM | `$`, `clone`, `esc`, `fmt`, `fmtTs`, `ph10`, `fmtPhone`, `bindMask`, `hoursNow`, `hashStr`, `rng`, `fmtMulti` |
| `core/api.js` | fetchJSON-обёртка (легаси-контракт) | `window.API_BASE`, `window.fetchJSON` |
| `core/ui.js` | `api()` с обработкой 401; тосты; дата обновления меню; PERF-дедуп одинаковых GET | `window.api`, `window.toast`, `window.renderUpd` |
| `core/config.js` | Bootstrap /api/config (имя TG-бота), триггеры relink/verifyNote | `window.TG_USERNAME` |

## 2. Бренд, виды, шапка

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `core/views.js` | CSS-инъекция СЛОЯ 2 (layout + `[data-brand]`); `sv()`/`setMode`/`syncBrandViews` — финальные владельцы (перебивают шимы catalog.js); DOM-переезды (deliveryView/ordersView/cashierView → section, deliveryRail → wrap); пилюля `#venueToggle` и дропдаун `#brandSeg`; размещение пуш-бабла; `fitSearch` (ширина поиска); `stripLogoInlineStyles` — inline-страховка размеров марки; кластер шапки Ф5.30 | `window.syncBrandViews`, `window.setMode`, `window.stripLogoInlineStyles`, `window.__fitSearch`, `window.__syncHeaderCluster` |
| `admin-extra.js` | `applyBrandChrome()`: содержимое `#tickerTrack` и `.mark` (официальные svg/img; Ф5.39: Пятница — горизонтальный SVG 160×40 без webp-растра); `loadPromos` (модалка админа); guard'ы кофейного меню до загрузки MENU; согласие ПД при регистрации | `window.applyBrandChrome`, `window.loadPromos` |
| `core/catalog.js` | `loadMenu`, `renderModes`; легаси `setMode`/`syncBrandViews` (перезаписываются views.js при инициализации) | `window.loadMenu`, `window.renderModes` |
| `core/splash.js` | Динамический сплэш `#brandSplash`, выбор бренда `finish()` | — |
| `profile-brand.js` | Брендовые правила профиля (fridayInfo, myOrders, placebox), `renderVerifyNote`, relink; единственная обёртка renderProfile | `window.applyProfileBrand`, `window.renderVerifyNote` |
| `core/auth.js` | `applyAuthBrand` — логотип и подзаголовок модалки авторизации | `window.applyAuthBrand` |
| `brands/registry.js` | — манифест (window.BRANDS, brandConfig()); | `ui/brand-tokens.css` | — токены брендов

## 3. Меню (кофейня и доставка)

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `menu.js` | `#rail` (категории), `#searchInput`, рендер `#grid`; зум фото (`openZoom`); модалка модификаторов; LCP-картинка eager | `window.renderMenu`, `window.renderRail`, `window.openZoom` |
| `menu-editor.js` | `openEditor`/`exitEdit`, сохранение emModal, editToggle | `window.openEditor`, `window.exitEdit` |
| `core/editor.js` | Делегирование кликов `#grid`; фотозона редактора (`renderZone`/`loadImg`/`closeEditor`); имя гостя; resetBtn | `window.renderZone`, `window.closeEditor`, `window.loadImg` |
| `delivery.js` | `window.DMENU`, cart (инициализация из LS); `#deliveryRail`; рендер `#deliveryGrid` + скелетоны; стоп-лист и редактор в доставке; слоты (`populateSlots`); режимы предзаказа; СЛОЙ 3-стили steprow | `window.loadDelivery`, `window.renderDeliveryMenu`, `window.preorderMode`, `window.populateSlots` |
| `ui/delivery-search.js` | Поиск в Пятнице (`#dSearch` внутри `.mh-right`) и фильтрация грида | — |

## 4. Корзина и чекаут

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `cart.js` | ЕДИНСТВЕННЫЙ владелец мутаций корзины и save; `#cartItems`, аддоны (`#cartAddons`), итоги (`#cartTotal`/`#cartSum`/`#cartFee`/`#cartDiscount`), строка подарков `#cartGifts`, `deliveryPromoBar`; видимость и содержимое cartFab; валидация чекаута и POST /api/orders | `window.renderCart`, `window.totalsNow`, `window.updateCartFab`, `window.cartFabShow`, `window.clearPromo` |
| `core/address-dict.js` | Справочник улиц и тарифов | `window.AddressModule` |
| `core/address-autocomplete.js` | Дропдаун подсказок `#checkoutStreet` | — |
| `core/address-book.js` | Шторка «Мои адреса» (`#addrBookSheet`), кнопка в чекауте | `window.AddressBook` |
| `address.js` | datalist `#streetSuggestions` на витрине корзины (генерируется fetch-streets) | клиентская часть `window.AddressModule` |

Примечание: `delivery.js` исторически экспортировал `renderCart` — перезаписывается `cart.js`
при инициализации (порядок в main.js). Мутации qty — только cart.js (инцидент Ф5.21c).

## 5. Заказы, диспетчер, живые обновления

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `orders.js` | `#ordersList` (диспетчер), обработчики статусов/задержек; «Активация гостей» (`loadPending`); инжект redeems в дашборд | `window.renderOrders`, `window.loadPending` |
| `live.js` | Поллинги заказов/профиля при изменениях; pageshow/visibilitychange; zpush-сообщения от SW | — |

## 6. Профиль, бонусы, QR, отзывы

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `profile.js` | `renderBonus` (штампы, freeSlot), `renderProfile`, `loadMyOrders`, `renderOrdersModal`; создание ordersModal и myOrdersBtn; QR-текст под канвасом | `window.renderBonus`, `window.renderProfile`, `window.loadMyOrders` |
| `core/qr.js` | `drawQR`, полноэкранный `#qrModal`, wake lock | `window.drawQR`, `window.openQRFull`, `window.closeQRFull` |
| `core/review.js` | `#reviewBtn`, `maybeAskReview` | `window.maybeAskReview` |
| `core/preorder-timer.js` | Таймеры «Предзаказ» в карточках заказов профиля | `window.PreorderTimer` |
| `core/notify.js` | Каналы уведомлений (ntTg/ntWeb, `#notifyDetails`) | `window.syncNotifyAll`, `window.applyNotify`, `window.syncNotifyUI` |

## 7. Авторизация и доступ

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `core/auth.js` | `#authModal` (open/close/swap), формы регистрации/входа/OTP, `setUser`, `#setPinModal`, `#profileTopBtn`, logoutBtn | `window.openAuth`, `window.closeAuth`, `window.authSwap`, `window.setUser`, `window.openSetPin`, `window.closeSetPin` |
| `core/staffpin.js` | `#pinModal` (код сотрудника), `tryActivate`, делегирование submit форм | `window.openPin`, `window.closePin`, `window.tryActivate` |

## 8. Персонал: кассир и сканер

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `cashier.js` | cashierView: поиск гостя, штамп/списание, «Новый гость», журнал кассира (`renderLog`); модалка `#redeemPick` (какой кофе списать) | `window.renderLog`, `window.showCust` |
| `scanner.js` | `#scanModal`, камера, подгрузка jsQR | — |
| `ui/cashier-card.js` | Кнопка «Закрыть карточку» гостя | — |
| `ui/cashier-log.js` | Фильтр кофейных событий в `#cashLog`, unhide карточки журнала | — |

## 9. Чат и поддержка

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `chat.js` | Гостевой чат с ботом (`#chatPanel`), стафф-чат (`#staffChatModal`), бейджи, поллинг треда | `window.addMsg`, `window.sendChat`, `window.openStaffChat` |
| `chat-core.js` | Контекстные суффиксы chatKey, база знаний (kbAnswer), бар подсказок `#chatHintsBar`, `#supportChooseOverlay`, fetch-патч ctx | `window.setBotName`, `window.reloadChatThread`, `window.showSupportOverlay` |
| `core/chat-head.js` | Стабильные классы шапки чата (`.chatHead`/`.chName`) | — |
| `core/chat-state.js` | Мост контекста чата (`window.chatState`); views.js держит дубль `__fvChatState` для легаси | `window.chatState` |

## 10. Пуш-уведомления

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `core/push.js` | `ensurePush`, VAPID-утилиты, самовосстановление подписки | `window.ensurePush` |
| `core/push-ui.js` | `enablePush`, видимость `#pushBtn`, пуш-бабл `#pushHint`, FCM/Capacitor, массовая рассылка (админ) | `window.enablePush`, `window.refreshPushBtn`, `window.togglePushHint` |

## 11. Оверлеи, панели, системный UX

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `core/overlay-core.js` | `syncOverlay` (модалки/шторки/корзина), popstate/Escape/клик по оверлею; TgUx (MainButton, BackButton, haptics) | `window.syncOverlay`, `window.TgUx` |
| `core/panel.js` | Шторка профиля `#panel`, вкладки `.tabs`, обработчик mbonusBtn | `window.openPanel`, `window.closePanel`, `window.setTab` |
| `core/swipe.js` | iOS-свайп закрытия `#panel` | — |
| `ui/scrolltop.js` | `#scrollTopBtn`; ЕДИНСТВЕННЫЙ владелец позиции рейла (`alignRailWithCard`); обёртка `.topbar-right` на ≥821px | `window.alignRailWithCard` |
| `ui/settings.js` | `#settingsModal` (PIN, каналы, сброс), шестерёнки профиля | — |
| `core/fx.js` | Канвас конфетти `#fx` | `window.confetti` |
| `core/a11y.js` | loading=lazy для небрендовых изображений | — |
| `core/deeplink.js` | Диплинки: brand/tab/no/support/reorder/auth_token | — |
| `ui/styles.js` | Глобальные инжекции СЛОЯ 3: z-index, body.panel-open, пульсы чата, футер, cartPanel ≥900px, бар подсказок | — |

## 12. Промокоды и дашборд владельца

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `core/promo.js` | `#promoModal`: CRUD кодов, недельная акция и пицца месяца | `window.closePromo`, `window.loadWeekPromo` |
| `core/dash.js` | `#dashModal`: статистика, график штампов, подписчики пушей | `window.loadSubs`, `window.closeDash` |

## 13. CSS по слоям (подробнее — docs/css-architecture.md)

- СЛОЙ 1 (база): `ui/theme-v2.css`, `ui/fonts.css`.
- СЛОЙ 2 (layout + бренд): `core/views.js` (массив rules).
- СЛОЙ 3 (компонентный): инжекции внутри модулей (delivery.js steprow, ui/styles.js, пульсы чата).
- СЛОЙ 4 (critical): инлайн-`<style>` в `index.html`.
- Брендовые растры (Ф5.39): горизонтальные логотипы — только SVG; квадратные марки — `<picture>` webp+svg разрешён. Владелец содержимого марки — `admin-extra.js`.

## 14. Сервер (кратко)

| Модуль | Зона ответственности |
| --- | --- |
| `server.js` | Сборка Express, статика с Cache-Control (sw.js — no-store), роуты меню |
| `server/routes/*` | auth, staff, promos, orders, chat, tg (webhook-бот), push, stats |
| `server/domain/*` | customers, loyalty (штампы/подарки), helpers, валидация адреса |
| `server/services/*` | Оркестратор пушей (TG+web+FCM), telegram, fcm, sms |
| `server/middleware/*` | Гарды ролей, security-заголовки, CORS, zod-валидация |
| `server/db/*` | SQLite-коннект, схема+миграции, сид (меню/dmenu, VAPID) |

## Регламент изменений

1. Новый модуль или смена владельца → правка этой карты в том же PR.
2. Запрещено создавать второго писателя в DOM-узел «намеренно»: вспомнить Ф5.21c (дубль мутаций корзины), Ф3.25 (марка), Ф5.60/F5.62 (рейл и mbonus в CSS).
3. Контракты window.* перечислены в колонке «Контракты»; удалять только вместе с потребителями (помогает knip).
