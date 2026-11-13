# API zerno-app

Краткий маршрутный справочник, сверенный с `server.js` и `server/routes/*.js` на ветке `pizza`. Точные схемы запроса/ответа, auth и коды ошибок см. в [OpenAPI 3.0](./openapi.yaml).

## Авторизация и guards

- Bearer-токен: `Authorization: Bearer <token>`.
- `userGuard` — авторизованный пользователь.
- `staffGuard` — кассир или администратор.
- `dispatchGuard` — кассир, диспетчер или администратор; очередь заказов и операции диспетчеризации доступны всем трём ролям.
- `menuGuard` — кассир, диспетчер или администратор; для не-администраторов `PUT /api/menu/:id` разрешает только переключение `on` в собственной секции (кассир — coffee, диспетчер — delivery).
- `chatGuard` — кассир, диспетчер или администратор; кассир видит кофейные треды, диспетчер — delivery-треды.
- `adminGuard` — администратор.
- Доступ следует проверять по middleware в конкретном роутере. Пометка «по реализации» означает, что краткая таблица намеренно не выводит роль только из названия пути.
- `POST /__test/otp` подключён только при `NODE_ENV=test`; это не production API.

## Система и bootstrap

| Метод и путь | Назначение | Доступ |
|---|---|---|
| `GET /api/health` | Health-check | Публичный |
| `GET /api/config` | Публичный bootstrap-конфиг | Публичный |
| `POST /api/clientlog` | Лог клиентских событий | Публичный |
| `GET /api/tg/diag` | Диагностика Telegram webhook/Bot API | adminGuard |
| `POST /api/tg/webhook` | Входящий Telegram webhook | Проверка webhook маршрутом |

## Авторизация и профиль

| Метод и путь | Назначение | Примечание |
|---|---|---|
| `POST /api/auth/request-reg-otp` | Запрос подтверждения регистрации по SMS или Telegram | `phone`, `name?`, `via?: tg\|sms`; Telegram-flow возвращает `tgUrl` и случайный `pollToken`, SMS-flow сообщает `via` |
| `POST /api/auth/check-reg` | Проверка Telegram-регистрации конкретной попытки | Body `pollToken`; одноразовый ключ выдаётся вместе с `tgUrl`, по номеру телефона токен не возвращается; SMS и Telegram ограничены по номеру и IP |
| `POST /api/auth/register` | Создать профиль и завершить регистрацию | Имя, телефон, согласие и подтверждение; возвращает `token` и `customer` |
| `POST /api/auth/tg-link` | Вход или привязка по подписанному Telegram initData | Может вернуть `needPhone` или `needBotConfirm` |
| `POST /api/auth/login` | Вход по телефону и PIN либо одноразовому коду | PIN или OTP из Telegram/SMS; первый PIN нельзя задать до подтверждения номера |
| `POST /api/auth/request-otp` | Запросить входной OTP | `phone`; код отправляется в привязанный Telegram, при отсутствии/ошибке Telegram — по SMS; лимиты по IP и номеру, ответ включает `via` |
| `POST /api/auth/setup-pin` | Первичная установка PIN в уже подтверждённой сессии | `pin`; требует `userGuard`, не выдаёт токен и не принимает телефон как доказательство владения |
| `POST /api/auth/set-pin` | Сменить PIN текущего профиля | `pin`; userGuard |
| `POST /api/auth/activate-guest` | Активировать профиль кодом кассира | `code`; userGuard |
| `POST /api/auth/activate` | Войти в режим сотрудника по коду роли | `code`; userGuard |
| `POST /api/staff/activate-guest` | Активация ожидающего гостя сотрудником | pendingGuard |
| `GET /api/staff/pending` | Гости, ожидающие активации | pendingGuard |
| `POST /api/auth/deactivate` | Деактивировать режим сотрудника | Авторизованный пользователь |
| `POST /api/exit` | Завершить текущую сессию | Авторизованный пользователь |
| `GET /api/me` | Текущий профиль | userGuard |
| `PUT /api/me` | Изменить имя профиля | userGuard |
| `DELETE /api/me` | Удалить профиль и персональные данные с предусмотренной деидентификацией заказов | userGuard; сотрудник не удаляет собственный профиль |
| `PUT /api/me/notify` | Изменить настройки каналов уведомлений | userGuard |

## Меню и доставка

| Метод и путь | Назначение | Доступ |
|---|---|---|
| `GET /api/menu` | Публичное меню кофейни | Публичный |
| `GET /api/menu/all` | Полное меню, включая выключенные позиции | menuGuard (cashier, dispatch, admin) |
| `POST /api/menu` | Создать позицию меню | adminGuard |
| `PUT /api/menu/reorder` | Изменить порядок позиций | adminGuard |
| `PUT /api/menu/:id` | Администратор редактирует позицию; сотрудник переключает только стоп-лист своей секции | menuGuard |
| `DELETE /api/menu/:id` | Удалить позицию меню | adminGuard |
| `POST /api/menu/upload` | Загрузить изображение позиции | adminGuard |
| `GET /api/dmenu` | Меню доставки | Публичный |
| `GET /api/delivery/info` | Часы, зоны, интервалы и конфигурация доставки | Публичный |
| `GET /api/delivery/addr` | Подсказки улиц по населённому пункту (`place`, `q`) | Публичный |
| `PUT /api/admin/weekpromo` | Изменить недельную акцию | adminGuard |

## Заказы

| Метод и путь | Назначение | Доступ |
|---|---|---|
| `POST /api/orders` | Создать заказ | userGuard; сервер валидирует заказ |
| `GET /api/orders` | Очередь заказов для персонала: без `status` — последние три дня; с `status` — до 50 заказов этого статуса без ограничения по дате | dispatchGuard (cashier, dispatch, admin); фильтры `status`, `staff`, `done` |
| `GET /api/orders/mine` | История заказов текущего пользователя | userGuard |
| `POST /api/orders/:id/status` | Изменить статус заказа | dispatchGuard |
| `POST /api/orders/:id/delay` | Задержать один заказ | dispatchGuard |
| `POST /api/orders/delay-all` | Массово задержать активные заказы | dispatchGuard |

Заказ использует серверную идемпотентность через optional `client_order_id` и fingerprint запроса. Клиентская блокировка кнопки не заменяет серверную защиту. Идемпотентность создания заказа не означает exactly-once доставку внешних уведомлений.

## Персонал и касса

| Метод и путь | Назначение | Доступ |
|---|---|---|
| `GET /api/staff/customers` | Поиск клиентов | staffGuard |
| `POST /api/staff/customers` | Создать профиль клиента сотрудником | staffGuard |
| `POST /api/staff/stamp` | Начислить один штамп клиенту | staffGuard |
| `POST /api/staff/redeem` | Списать бесплатный кофе | staffGuard |
| `POST /api/redeem` | Списать доступный бесплатный кофе текущего пользователя | userGuard |
| `POST /api/staff/scan` | Проверить QR гостя | staffGuard |
| `GET /api/staff/log` | Журнал операций кассы | staffGuard |

## Чат

| Метод и путь | Назначение | Доступ |
|---|---|---|
| `POST /api/chat/send` | Сообщение гостя | Публичный |
| `POST /api/chat/botlog` | Лог/событие чат-бота | По реализации |
| `GET /api/chat/thread` | Получить новые сообщения треда | Публичный; query `key` обязателен, `after` — необязательный ID последнего полученного сообщения; `ctx` задаётся при отправке сообщения гостя |
| `GET /api/chat/list` | Список тредов с фильтрацией по контексту и роли | chatGuard |
| `GET /api/chat/dialog` | Получить сообщения диалога сотрудником | chatGuard |
| `POST /api/chat/reply` | Ответить гостю | chatGuard |
| `POST /api/chat/close` | Закрыть тред | chatGuard |
| `POST /api/chat/open` | Переоткрыть тред | chatGuard |

## Промокоды и бонусы

| Метод и путь | Назначение | Доступ |
|---|---|---|
| `POST /api/promo/redeem` | Активировать кофейный промокод, начисляющий штампы или бесплатный кофе | userGuard; delivery-коды отклоняются с 400 и применяются в корзине доставки |
| `GET /api/promo/info` | Проверить delivery-промокод для корзины доставки | Публичный; возвращает только активные коды с scope=delivery |
| `GET /api/me/free-delivery` | Получить персональный одноразовый код бесплатной доставки | userGuard |
| `GET /api/promos` | Список промокодов | adminGuard |
| `POST /api/promos` | Создать промокод | adminGuard |
| `POST /api/promos/:id/toggle` | Включить или выключить промокод | adminGuard |
| `DELETE /api/promos/:id` | Удалить промокод | adminGuard |
| `GET /api/admin/bonuses` | Настройки бонусов регистрации, QR и установки | adminGuard |
| `PUT /api/admin/bonuses` | Сохранить настройки бонусов | adminGuard |
| `POST /api/bonus/install` | Однократное начисление бонуса установки | userGuard |

## Push

| Метод и путь | Назначение | Доступ |
|---|---|---|
| `GET /api/vapid` | Публичный VAPID-ключ | Публичный |
| `POST /api/push/subscribe` | Создать или обновить Web Push подписку | userGuard |
| `POST /api/push/test` | Тестовая отправка push текущему профилю | userGuard |
| `POST /api/push/fcm` | Регистрация FCM-токена | userGuard |
| `GET /api/push/subs` | Данные push-подписок | adminGuard |
| `POST /api/push/send` | Административная отправка push | adminGuard |
| `POST /api/push/send-hours-update` | Уведомление об изменении расписания доставки | adminGuard |
| `POST /api/push/unsubscribe` | Отписать Web Push endpoint текущего профиля | userGuard |
| `POST /api/push/del` | Удалить Web Push-подписки из `subs` для `cid` | adminGuard; FCM-токены из таблицы `fcm` этим маршрутом не удаляются |

## Статистика

| Метод и путь | Назначение | Доступ |
|---|---|---|
| `GET /api/stats` | Общая статистика | adminGuard |
| `GET /api/stats/redeems` | Статистика списаний | adminGuard |
| `GET /api/stats/orders` | Статистика заказов | adminGuard |

## Сверка и ограничения

- Старые пути `POST /api/auth/otp-send` и `POST /api/auth/otp-verify` отсутствуют. Для Telegram-регистрации используются `request-reg-otp` и `POST check-reg` с отдельным случайным `pollToken`; входной OTP отправляется через `request-otp` и проверяется в `POST /api/auth/login`.
- `GET /api/me/free-delivery` существует в `server/routes/promos.js`; он не является устаревшим маршрутом.
- `POST /__test/otp` существует только при `NODE_ENV=test` и не должен считаться публичным API.
- Краткая таблица не перечисляет все поля и коды ошибок. Для request/response схем используйте `docs/openapi.yaml`; при расхождении проверяйте `server.js` и `server/routes/*.js`.
- Изменение любого маршрута требует обновить эту таблицу, OpenAPI и соответствующие contract tests в одном PR.