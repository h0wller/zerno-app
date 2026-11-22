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
| `public/app/core/boot.js` | `renderAll()`, `boot()`; подтверждение сессии и синхронизация проверенной staff-роли (`applyStaffRoleState`); ЕДИНСТВЕННАЯ регистрация SW; предложение обновления и подтверждение перезапуска только в установленной PWA (обычные вкладки не прерываются); install-баннер; iOS-хинт; IMG-FB v1 (фолбэк webp→svg при ошибке загрузки) | `window.renderAll`, `window.boot`, `window.applyStaffRoleState` |
| `public/sw.js` | App Shell Network-First с offline fallback; `MEDIA_CACHE` — svg network-first, raster SWR; `API_CACHE` — /api/menu SWR 5 мин; входящие `push`/`notificationclick`, same-origin navigation и сообщение `zpush` для live refresh | События `push`, `notificationclick`, `message` от окна; новые версии ждут явного подтверждения пользователя перед активацией |
| `public/index.html` (инлайн, СЛОЙ 4) | early-brand-guard; critical-fouc-guard; perf-bridge (Lighthouse); TgUx-стаб; C8 guest-only prediction while splash is pending: only when `zt_user` is empty and `zt_brand` is exactly `coffee` or `delivery`; requests the saved-brand catalog and preloads the first active image in its initial visible category; matching selection reuses the promise, failed prediction falls back to the selected-brand request, and a late mismatched response cannot preload the hidden brand or activate its delivery hero; `window.__ztPrimeMenuLcp` bridges the selected catalog fetch; `window.__ztApplyDeliveryHero` applies only the matching delivery hero before/after hydration; owns splash selection and early-chrome/FOUC guards. Catalog and catalog DOM remain owned by `core/catalog.js`, `menu.js` and `delivery.js` | `window.__ztPrimeMenuLcp`, `window.__ztApplyDeliveryHero` (early bootstrap contracts) |

## 1. Глобальное состояние, сеть, утилиты

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `core/state.js` | window-глобалы: USER_TOKEN, onboarded, MENU, meta, me, mode, editMode, brand; CATS/TINT; iOS gesture-guard; детект TG Mini App | `window.CATS`, `window.TINT`, `window.__isTgMiniApp` |
| `core/utils.js` | Чистые утилиты форматирования/DOM | `$`, `clone`, `esc`, `fmt`, `fmtTs`, `ph10`, `fmtPhone`, `bindMask`, `fmtMulti` |
| `core/api.js` | Определяет базовый URL API для app-origin и локальных frontend-серверов | `window.API_BASE` |
| `core/ui.js` | `api()` с обработкой 401 и 20-секундным timeout; дедуп только безопасных GET без caller AbortSignal; ARIA live toasts с адаптивной длительностью | `window.api`, `window.toast`, `window.renderUpd` |
| `core/config.js` | Bootstrap /api/config (имя TG-бота и состояние opt-in-функций), триггеры relink/verifyNote | `window.TG_USERNAME`, `window.SMS_AUTH_ENABLED`; событие `app:config-loaded` |

## 2. Бренд, виды, шапка

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `core/views.js` | CSS-инъекция layout/media и `[data-brand]` правил; `sv()`/`setMode`/`syncBrandViews` — финальные владельцы; DOM-переезды заголовка и timestamp в `.menu-controls-row`, `#iosHint` после ticker и `#modeSeg` между HTML-shell, меню и topbar; `#venueToggle`/`#brandSeg`, пуш-бабл, `fitSearch`, размеры марки и header cluster. Не reparent-ит `#rail`/`#deliveryRail`: они остаются статическими direct children `.wrap`; мобильную fixed-геометрию владеет `150-rail.css`, runtime lifecycle — `ui/category-rail.js`; после переключения видимости view `sv()` вызывает `window.alignRailWithCard()` для guest и staff без DOM reparenting. Critical CSS `index.html` зеркалит first-frame geometry `.wrap` (1480px на 1181–1480px, 2560px с центрированием от 1481px) и постоянное место под scrollbar без дополнительного пустого gutter | `window.syncBrandViews`, `window.setMode`, `window.stripLogoInlineStyles`, `window.__fitSearch`, `window.__syncHeaderCluster` |
| `admin-extra.js` | `applyBrandChrome()`: содержимое `#tickerTrack`, измерение и дублирование `.tickerGroup` для непрерывного цикла на любой ширине, невидимые click/keyboard pause-play и reduced-motion state; `.mark` (официальные svg/img; Ф5.39: Пятница — горизонтальный SVG 160×40 без webp-растра); `loadPromos` (модалка админа); guard'ы кофейного меню до загрузки MENU | `window.applyBrandChrome`, `window.loadPromos` |
| `core/catalog.js` | `loadMenu`, `renderModes`; обработчик переключателя режима делегирует вызов `window.setMode` (реализация находится в `core/views.js`) | `window.loadMenu`, `window.renderModes` |
| `core/splash.js` | Динамический сплэш `#brandSplash`, выбор бренда `finish()` | — |
| `profile-brand.js` | Брендовые правила профиля (fridayInfo, myOrders, placebox), `renderVerifyNote`, relink; единственная обёртка renderProfile | `window.applyProfileBrand`, `window.renderVerifyNote` |
| `core/auth.js` | `applyAuthBrand` — логотип и подзаголовок модалки авторизации | `window.applyAuthBrand` |
| `brands/registry.js` | — манифест (window.BRANDS, brandConfig()); | `ui/brand-tokens.css` | — токены брендов

## 3. Меню (кофейня и доставка)

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `core/menu-content.js` | Общее чистое правило отображения состава: описание пиццы доставки служит текстовым составом, структурированный `comp` остаётся в данных | `getVisibleComposition` |
| `core/nutrition.js` + `core/nutrition-data.js` | Оценочный расчёт КБЖУ по ТТК, справочнику ингредиентов и вложенным заготовкам | `window.INGREDIENTS_DB`, `window.TECH_CARDS`, `window.calculateDishKbju` |
| `menu.js` | `#rail` (категории, accessible names, selected-state `aria-pressed`), `#searchInput`, рендер `#grid`; определяет общий `window.scrollMenuContentToStart` и вызывает его после смены категории в horizontal-rail viewport: верх контента под sticky topbar (+12px), `behavior: 'auto'` при reduced motion, без привязки к нижней капсуле; повторный тап активной категории сохраняет #269 scroll-to-top; зум фото (`openZoom`); модалка модификаторов; LCP-картинка eager | `window.renderMenu`, `window.renderRail`, `window.scrollMenuContentToStart`, `window.openZoom` |
| `menu-editor.js` | `openEditor`/`exitEdit`, сохранение emModal, editToggle | `window.openEditor`, `window.exitEdit` |
| `core/editor.js` | Делегирование кликов `#grid`; фотозона редактора (`renderZone`/`loadImg`/`closeEditor`); имя гостя | `window.renderZone`, `window.closeEditor`, `window.loadImg` |
| `delivery.js` | `window.DMENU`; `#deliveryRail` (категории, short label «Добавки», accessible names, selected-state `aria-pressed` и `aria-current="location"` для видимой scroll spy категории); при смене категории вызывает общий `window.scrollMenuContentToStart` для активного subfilter или `#deliveryGrid`, выравнивая верх контента под sticky topbar (+12px) только в horizontal-rail viewport; повторный тап активной категории сохраняет #269 scroll-to-top; рендер `#deliverySubFilter` внутри статически зарезервированного `#deliverySubFilterViewport`; рендер `#deliveryGrid` + скелетоны; рендерит и сверяет `#deliveryGrid`; ранний preloader-контракт из `index.html` выбирает первую активную карточку стартовой категории `pizza` (не первую строку всего `/api/dmenu`, где раньше могли идти соусы/добавки); использует `window.__ztApplyDeliveryHero` для сверки/переактивации hero после рендера той же видимой категории, сохраняя исходный image owner-контракт; стоп-лист и редактор; слоты; режимы предзаказа; видимый CTA `В корзине · N` и стили steprow. Состояние корзины делегируется в `cart.js` | `window.loadDelivery`, `window.renderDeliveryMenu`, `window.preorderMode`, `window.populateSlots` |
| `ui/delivery-search.js` | Поиск в Пятнице (`#dSearch` внутри `.mh-right`) и фильтрация грида | — |

## 4. Корзина и чекаут

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `cart.js` | Единственный владелец состояния, инициализации, мутаций, сохранения и открытия корзины; `#cartItems`, аддоны, итоги, подарки, cartFab; синхронизация цен доставки; состояние раскрытых модификаторов синхронизируется с индексами строк при удалении; сборка и отправка заказа | `window.renderCart`, `window.totalsNow`, `window.updateCartFab`, `window.cartFabShow`, `window.clearPromo`, `window.addDeliveryCartItem`, `window.adjustDeliveryCartItem`, `window.syncDeliveryCartPrices`, `window.replaceCartItems` |
| `checkout-validation.js` | Проверка адреса и времени доставки перед оформлением; подсветка ошибочного поля и переключатель «сейчас / ко времени» | `window.CheckoutValidation` |
| `address.js` | Единственный владелец `window.AddressModule` и datalist `#streetSuggestions`; сгенерированный справочник улиц, нормализация и валидация | `window.AddressModule` |
| `core/address-autocomplete.js` | Дропдаун подсказок `#checkoutStreet` | — |
| `core/address-book.js` | Шторка «Мои адреса» (`#addrBookSheet`), кнопка в чекауте; владеет close lifecycle через `.open`, transitionend/таймер и `hidden`; тариф адреса читает из `window.deliveryInfo.zones` | `window.AddressBook` |

Примечание: `delivery.js` исторически содержал второй рендерер и писатели корзины; они удалены. Все изменения состояния корзины проходят через контракты `cart.js`.

## 5. Заказы, диспетчер, живые обновления

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `order-tracking.js` | Модалка `#orderTrackModal`, state-specific delivery/pickup/cancel state, items/modifiers/gifts/fees/discounts/eta; перерисовка только при изменении данных | `window.openOrderTrackModal`, `window.closeOrderTrackModal` |
| `core/order-reorder.js` | Чистое восстановление позиций заказа: выбранные варианты, модификаторы и ключи корзины; общий helper для deep link и tracking | `restoreOrderItems` (ESM export) |
| `orders.js` | `#ordersList` (диспетчер), обработчики статусов/задержек; «Активация гостей» (`loadPending`); инжект redeems в дашборд | `window.renderOrders`, `window.loadPending` |
| `live.js` | Fallback polling заказов (15 с) и профиля (45 с), быстрый refresh по `zpush`, pageshow/visibilitychange/focus | — |

## 6. Профиль, бонусы, QR, отзывы

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `profile.js` | Готовность `me`, единый рендер карточки лояльности внутри `#profileCoffeeSection`, `updateMbonusBadge`, `renderProfile`, редактирование имени и раскрытие истории | `window.renderBonus`, `window.renderProfile` |
| `profile-orders.js` | Последний заказ и полный список заказов; общий кэш/запрос для карточки и модалки; обработка «Отследить» | `window.loadMyOrders`, `window.renderOrdersModal`, `window.updateMyOrdersCache`, `window.invalidateMyOrders` |
| `profile-brand.js` | Включение брендовых секций профиля, блок «Пятница», единый `renderVerifyNote` | `window.applyProfileBrand`, `window.renderVerifyNote` |
| `core/qr.js` | `drawQR`, единственная полноэкранная QR-модалка `#qrModal`, открытие QR из профиля, wake lock | `window.drawQR`, `window.openQRFull`, `window.closeQRFull` |
| `core/review.js` | `#reviewBtn`, `maybeAskReview` | `window.maybeAskReview` |
| `core/preorder-timer.js` | Таймеры «Предзаказ» в карточках заказов профиля | `window.PreorderTimer` |
| `core/notify.js` | Единое состояние каналов уведомлений в настройках профиля | `window.syncNotifyAll`, `window.applyNotify`, `window.syncNotifyUI` |

## 7. Авторизация и доступ

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `core/auth-session.js` | Установка/сброс клиентской сессии, сброс `__ztAuthDead`, безопасная запись localStorage, повторная привязка сохранённого FCM token после входа | `window.setUser`; `ztBus` event `auth:user-changed` |
| `core/auth.js` | Единственный владелец `#authModal` (open/close/swap и сброс временного состояния), вход по PIN/OTP, `#profileTopBtn`, выход и удаление аккаунта | `window.openAuth`, `window.closeAuth`, `window.authSwap` |
| `core/auth-pin.js` | Единственный владелец `#setPinModal`: задание PIN для старого профиля и смена PIN | `window.openSetPin`, `window.closeSetPin` |
| `core/registration.js` | Регистрация, согласие, OTP Telegram и поллинг подтверждения; единственный владелец динамической видимости `#regOtpBtn`/`#regOtpRow` по `window.SMS_AUTH_ENABLED` | `window.resetRegistrationState` |
| `core/staffpin.js` | `#pinModal` (код сотрудника), `tryActivate`, делегирование submit форм | `window.openPin`, `window.closePin`, `window.tryActivate` |

## 8. Персонал: кассир и сканер

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `cashier.js` | cashierView: поиск гостя, штамп/списание, «Новый гость», журнал кассира (`renderLog`); единая модалка `#redeemPick` для выбора напитка перед любым кассовым списанием | `window.renderLog`, `window.showCust`, `window.openRedeemPicker(customer, onSuccess, returnFocus)` — открывает picker; запрос `POST /api/staff/redeem` отправляется только после выбора напитка; `onSuccess` получает обновлённого гостя |
| `scanner.js` | `#scanModal`, камера/ручной ввод QR, `#guestCard` и штамп гостя; списание подарка делегирует в picker кассира | вызывает `window.openRedeemPicker(customer, onSuccess, returnFocus)`; не отправляет `POST /api/staff/redeem` напрямую |
| `ui/cashier-card.js` | Кнопка «Закрыть карточку» гостя | — |
| `ui/cashier-log.js` | Фильтр кофейных событий в `#cashLog`, unhide карточки журнала | — |

## 9. Чат и поддержка

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `chat.js` | Гостевой чат с ботом (`#chatPanel`), стафф-чат (`#staffChatModal`), бейджи, поллинг треда | `window.addMsg`, `window.sendChat`, `window.openStaffChat`, `window.openStaffChatThread` |
| `chat-core.js` | Контекстные суффиксы chatKey, база знаний (kbAnswer), бар подсказок `#chatHintsBar`, создание и выбор `#supportChooseOverlay` для `support=choose`, fetch-контракт чата: Bearer владельца или `X-Chat-Access-Token` анонимного треда; вызов сотрудника предлагается только при активной пользовательской сессии | `window.setBotName`, `window.reloadChatThread`, `window.showSupportOverlay` |
| `core/chat-head.js` | Стабильные классы шапки чата (`.chatHead`/`.chName`) | — |
| `core/chat-state.js` | Мост контекста чата (`window.chatState`); views.js держит дубль `__fvChatState` для легаси | `window.chatState` |

## 10. Пуш-уведомления

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `core/push.js` | `ensurePush`, VAPID-утилиты, самовосстановление подписки | `window.ensurePush` |
| `core/push-ui.js` | `enablePush`, VAPID подписка и подтверждающий `/push/test`, видимость `#pushBtn`, `#pushHint`, FCM/Capacitor; проверка фактической доставки | `window.enablePush`, `window.refreshPushBtn`, `window.togglePushHint` |

Серверный контракт отправки, диагностика ошибок и расследование бонусных уведомлений: [docs/telegram-notification-investigation-2026-10-29.md](telegram-notification-investigation-2026-10-29.md).

## 11. Оверлеи, панели, системный UX

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `core/overlay-core.js` | `syncOverlay` (модалки/шторки/корзина), popstate/Escape/клик по оверлею; TgUx (MainButton, BackButton, haptics) | `window.syncOverlay`, `window.TgUx` |
| `core/panel.js` | Единая шторка профиля `#panel`, фокус возврата и действия «Назад»; старый вызов `openPanel('bonus')` открывает тот же профиль | `window.openPanel`, `window.closePanel`, `window.setTab` |
| `core/swipe.js` | iOS-свайп закрытия `#panel` | — |
| `ui/category-rail.js` | Runtime lifecycle category rail: очищает legacy inline sticky geometry на mobile/compact-landscape, сохраняет desktop alignment, синхронно управляет временным fade primary rail и видимого `#cartFab` при обычном scroll, исключает fade на время любого программного скролла (возврат наверх, смена категории) и публикует viewport predicate для horizontal rail. Не владеет DOM категорий, selected state или корзиной | `window.alignRailWithCard`, `window.usesHorizontalCategoryRailViewport`, `window.scrollToTopWithoutRailFade`, `window.scrollToWithoutRailFade` |
| `ui/settings.js` | `#settingsModal` (PIN, каналы уведомлений, выход, typed-confirmation удаления); шестерёнка и управление фокусом | `window.openProfileSettings`, `window.closeProfileSettings` |
| `core/fx.js` | Канвас конфетти `#fx` | `window.confetti` |
| `core/a11y.js` | loading=lazy для небрендовых изображений; общий алгоритм удержания Tab-фокуса в границах модалки без владения самими модалками | `window.trapModalFocus` |
| `core/deeplink.js` | Диплинки: brand/tab/no/reorder/auth_token; legacy `staff_chat` делегирует в `chat.js` | — |
| `ui/styles.js` | Глобальные инжекции СЛОЯ 3: z-index, body.panel-open, пульсы чата, футер, cartPanel ≥900px, бар подсказок | — |

## 12. Промокоды и дашборд владельца

| Модуль | Владеет | Контракты |
| --- | --- | --- |
| `core/promo.js` | `#promoModal`: CRUD кодов, недельная акция и пицца месяца | `window.closePromo`, `window.loadWeekPromo` |
| `core/dash.js` | `#dashModal`: вкладки брендов, статистика «…и кофе» (штампы, подписчики пушей) | `window.loadSubs`, `window.closeDash` |
| `core/dash-orders.js` | вкладка «Пятница» в `#dashModal`: Bento-плитки заказов, график 14 дней, топ-5 позиций и блок «свои» | `window.loadOrdersStats` |

## 13. CSS по слоям (подробнее — docs/css-architecture.md)

- СЛОЙ 1 (база): `ui/theme/*.css`, `ui/fonts.css`.
- СЛОЙ 2 (layout + бренд): `core/views.js` (массив rules).
- СЛОЙ 3 (компонентный): инжекции внутри модулей (delivery.js steprow, ui/styles.js, пульсы чата).
- СЛОЙ 4 (critical): инлайн-`<style>` в `index.html`.
- Брендовые растры (Ф5.39): горизонтальные логотипы — только SVG; квадратные марки — `<picture>` webp+svg разрешён. Владелец содержимого марки — `admin-extra.js`.

## 14. Сервер (кратко)

| Модуль | Зона ответственности |
| --- | --- |
| `server.js` | Express application, static assets and menu routes; for `GET /` with an explicit `brand=coffee` / `brand=delivery` or deterministic `lighthouse=1` / `clean=1` audit input, emits a document-level `Link` preload for the first active image in the initial visible category (coffee / pizza); only local `/media/dishes/` assets, with responsive image parameters when available |
| `server/routes/*` | auth, staff, promos, orders, chat, tg (webhook-бот), push, stats |
| `server/domain/*` | customers, loyalty (штампы/подарки), helpers, валидация адреса |
| `server/utils/session-policy.js` | Единая политика абсолютного TTL пользовательских bearer-сессий; используется выпуском токенов и миграцией SQLite | `USER_SESSION_TTL_MS` |
| `server/utils/auth-rate-limits.js` + `server/utils/otp.js` | Persisted OTP send limits/cooldowns, rate-limit state and bounded in-memory OTP store; `server/routes/auth.js` owns request/verify endpoints | `getOtpSendState`, `recordOtpSend`, `otpStore`, `consumeOtp` |
| `server/services/push.js` | Единый fan-out: Telegram HTML отдельно от plain text Web Push/FCM; возвращает per-channel фактический delivery status и удаляет истёкшие subscriptions | `sendPush(cid, { title, text, html }, markup?)`; legacy positional поддерживается временно |
| `server/services/telegram.js` | Telegram Bot API; HTML escaping и plain-text fallback при ошибках parse entities/лимите длины | `tgSend`, `escapeTelegramHtml`, `telegramHtmlToPlainText` |
| `server/services/fcm.js` | FCM отправка и очистка недействительных registration tokens | `sendFcm(cid, title, body)` |
| `server/middleware/*` | Гарды ролей, security-заголовки, CORS, zod-валидация |
| `server/db/*` | SQLite-коннект, схема+миграции, сид (меню/dmenu, VAPID) |

## Регламент изменений

1. Новый модуль или смена владельца → правка этой карты в том же PR.
2. Запрещено создавать второго писателя в DOM-узел «намеренно»: вспомнить Ф5.21c (дубль мутаций корзины), Ф3.25 (марка), Ф5.60/F5.62 (рейл и mbonus в CSS).
3. Контракты window.* перечислены в колонке «Контракты»; удалять только вместе с потребителями (помогает knip).
