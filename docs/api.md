# API zerno-app

Краткий маршрутный справочник, сверенный с `server.js` и `server/routes/*.js` на ветке `pizza`. Точные схемы запроса/ответа, auth и коды ошибок см. в [OpenAPI 3.0](./openapi.yaml).

## Авторизация и guards

- Bearer-токен: `Authorization: Bearer <token>`.
- `userGuard` — авторизованный пользователь.
- `staffGuard` — сотрудник с кассовыми полномочиями.
- `dispatchGuard` — диспетчерские и административные полномочия.
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
| `POST /api/auth/request-reg-otp` | Запрос подтверждения регистрации по SMS или Telegram | `phone`, `name?`, `via?: tg\|sms`; Telegram-flow может вернуть `tgUrl` |
| `GET /api/auth/check-reg` | Проверка статуса Telegram-регистрации | Query `phone`; при подтверждении возвращает `token` и `customer` |
| `POST /api/auth/register` | Создать профиль и завершить регистрацию | Имя, телефон, согласие и подтверждение; возвращает `token` и `customer` |
| `POST /api/auth/tg-link` | Вход или привязка по подписанному Telegram initData | Может вернуть `needPhone` или `needBotConfirm` |
| `POST /api/auth/login` | Вход по телефону и PIN либо OTP | `phone` + `pin` или `otp`; возможен `needPin` |
| `POST /api/auth/request-otp` | Запросить входной OTP в привязанный Telegram | `phone`; код отправляется в Telegram |
| `POST /api/auth/setup-pin` | Первичная установка PIN | `phone`, `pin`; проверяется состояние профиля |
| `POST /api/auth/set-pin` | Сменить PIN текущего профиля | `pin`; userGuard |
| `POST /api/auth/activate-guest` | Активировать профиль кодом кассира | `code`; userGuard |
| `POST /api/auth/activate` | Войти в режим сотрудника по коду роли | `code`; userGuard |
| `POST /api/staff/activate-guest` | Активация гостя сотрудником | Проверить role guard в реализации |
| `GET /api/staff/pending` | Гости, ожидающие активации | Проверить role guard в реализации |
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
| `GET /api/menu/all` | Полное меню, включая выключенные позиции | adminGuard |
| `POST /api/menu` | Создать позицию меню | adminGuard |
| `PUT /api/menu/reorder` | Изменить порядок позиций | adminGuard |
| `PUT /api/menu/:id` | Обновить позицию меню | adminGuard |
| `DELETE /api/menu/:id` | Удалить позицию меню | adminGuard |
| `POST /api/menu/upload` | Загрузить изображение позиции | adminGuard |
| `GET /api/dmenu` | Меню доставки | Публичный |
| `GET /api/delivery/info` | Часы, зоны, интервалы и конфигурация доставки | Публичный |
| `GET /api/delivery/addr` | Адресные данные доставки | См. middleware в orders route |
| `PUT /api/admin/weekpromo` | Изменить недельную акцию | adminGuard |

## Заказы

| Метод и путь | Назначение | Доступ |
|---|---|---|
| `POST /api/orders` | Создать заказ | Маршрут публичный; сервер валидирует заказ |
| `GET /api/orders` | Получить заказы пользователя | userGuard |
| `GET /api/orders/mine` | История заказов пользователя | userGuard |
| `POST /api/orders/:id/status` | Изменить статус заказа | dispatchGuard |
| `POST /api/orders/:id/delay` | Задержать один заказ | dispatchGuard |
| `POST /api/orders/delay-all` | Массово задержать активные заказы | dispatchGuard |

Заказ использует серверную идемпотентность через optional `client_order_id` и fingerprint запроса. Клиентская блокировка кнопки не заменяет серверную защиту. Идемпотентность создания заказа не означает exactly-once доставку внешних уведомлений.

## Персонал и касса

| Метод и путь | Назначение | Доступ |
|---|---|---|
| `GET /api/staff/customers` | Поиск клиентов | staffGuard |
| `POST /api/staff/customers` | Создать профиль клиента сотрудником | staffGuard |
| `POST /api/staff/stamp` | Начислить или списать штампы | staffGuard |
| `POST /api/staff/redeem` | Списать бесплатный кофе | staffGuard |
| `POST /api/staff/scan` | Проверить QR гостя | staffGuard |
| `GET /api/staff/log` | Журнал операций кассы | staffGuard |

## Чат

| Метод и путь | Назначение | Доступ |
|---|---|---|
| `POST /api/chat/send` | Сообщение гостя | Публичный |
| `POST /api/chat/botlog` | Лог/событие чат-бота | По реализации |
| `GET /api/chat/thread` | Получить тред; query `ctx` задаёт контекст | Публичный |
| `GET /api/chat/list` | Список тредов | staffGuard |
| `GET /api/chat/dialog` | Данные диалога | По реализации |
| `POST /api/chat/reply` | Ответ сотрудника | staffGuard |
| `POST /api/chat/close` | Закрыть тред | staffGuard |
| `POST /api/chat/open` | Переоткрыть тред | staffGuard |

## Промокоды и бонусы

| Метод и путь | Назначение | Доступ |
|---|---|---|
| `POST /api/promo/redeem` | Активировать промокод | userGuard |
| `GET /api/promo/info` | Проверить условия промокода | Публичный |
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
| `POST /api/push/subscribe` | Web Push подписка | По реализации |
| `POST /api/push/test` | Тестовая отправка push | adminGuard |
| `POST /api/push/fcm` | Регистрация FCM-токена | По реализации |
| `GET /api/push/subs` | Данные push-подписок | adminGuard |
| `POST /api/push/send` | Административная отправка push | adminGuard |
| `POST /api/push/send-hours-update` | Уведомление об изменении расписания доставки | adminGuard |
| `POST /api/push/unsubscribe` | Отписать Web Push endpoint | По реализации |
| `POST /api/push/del` | Удалить FCM token | По реализации |

## Статистика

| Метод и путь | Назначение | Доступ |
|---|---|---|
| `GET /api/stats` | Общая статистика | adminGuard |
| `GET /api/stats/redeems` | Статистика списаний | adminGuard |
| `GET /api/stats/orders` | Статистика заказов | adminGuard |

## Сверка и ограничения

- Старые пути `POST /api/auth/otp-send` и `POST /api/auth/otp-verify` отсутствуют в актуальных роутерах. Для регистрации используются `request-reg-otp` и `check-reg`; для входного OTP — `request-otp` и `otp` в `POST /api/auth/login`.
- `GET /api/me/free-delivery` существует в `server/routes/promos.js`; он не является устаревшим маршрутом.
- `POST /__test/otp` существует только при `NODE_ENV=test` и не должен считаться публичным API.
- Краткая таблица не перечисляет все поля и коды ошибок. Для request/response схем используйте `docs/openapi.yaml`; при расхождении проверяйте `server.js` и `server/routes/*.js`.
- Изменение любого маршрута требует обновить эту таблицу, OpenAPI и соответствующие contract tests в одном PR.