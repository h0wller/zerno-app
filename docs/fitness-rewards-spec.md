# Техническая спецификация: «Кофе за пробежку»

Статус: **проектирование согласовано; реализация не начата**  
Дата фиксации решений: 2026-11-15  
Целевая работа: PR #252 — `feat/fitness-gpx-rewards`  
Проверенная база исходников: PR HEAD `cb8eb9dd5382b918ea477bfb5f42fb36bf34f8c7`

Документ описывает целевое поведение и границы реализации. Названия новых таблиц, полей и маршрутов ниже являются проектными контрактами, а не утверждением об их существовании в текущем коде. Перед миграциями контракты сверяются с актуальной веткой `pizza` после синхронизации PR.

## 1. Принятые продуктовые решения

| Вопрос | Зафиксированное решение |
|---|---|
| Награда | Один бесплатный фильтр-кофе |
| Кассовая позиция | Существующая позиция «Батч брю» в `public/app/cashier.js`; сервер должен проверять её как разрешённый товар, а не доверять произвольной строке `item` |
| Порог дистанции | Индивидуальный для каждой версии кампании |
| Источники | GPX/FIT/TCX — недоверенные контейнеры; device/provider sources — только после отдельной проверки и утверждения политики доверия |
| Ручное решение по GPX | Администратор может выполнить явный manual override с обязательной причиной и аудитом; это не переводит evidence в криптографически verified |
| Глобальный запуск наград | **HOLD** до появления как минимум одного работающего server-verifiable источника с утверждённой политикой доверия |
| Совместимость ручного override с HOLD | До открытия глобального gate никакие награды не выдаются, в том числе вручную одобренные GPX. После открытия gate ручной override может быть исключением для GPX по правилам кампании |
| Срок подачи | Активность можно отправить в течение 7 календарных дней после окончания кампании; сама активность должна быть совершена в период кампании |
| Лояльность | Использовать существующую систему Zerno; отдельный спортивный баланс не создавать |
| Повторы | Начисление идемпотентно; одна активность не может повторно принести награду в одной кампании/версии |
| Версии кампаний | Условия фиксируются при приёме заявки; изменение кампании не меняет условия уже созданной заявки |
| Strava | Не использовать в production и не включать в reward pipeline без отдельного письменного согласования условий использования API |
| UI | Telegram Bot — обязательный основной интерфейс; Mini App необязателен |

### 1.1. Что означает «ручное одобрение GPX»

Ручное одобрение — это административное бизнес-исключение, а не доказательство подлинности файла. В БД состояние источника остаётся `unverified` (или соответствующим состоянием evidence), а решение администратора хранится отдельно в review/audit записи.

Ручной override:
- доступен только администратору;
- требует непустую причину и ссылку на основание проверки в пределах допустимой политики хранения;
- фиксирует администратора, время, старое и новое решение;
- не может обходить глобальный reward gate;
- не может повторно одобрить уже отклонённую/погашенную заявку без отдельной корректирующей операции.

Если бизнес намерен разрешить ручные GPX-награды до появления server-verifiable источника, это будет изменением принятого решения и потребует отдельного согласования.

## 2. Текущее состояние по проверенному исходному коду

### 2.1. Приём и evidence

- `server/routes/tg.js` принимает Telegram Documents, проверяет привязанный и подтверждённый guest-профиль, сейчас принимает только `.gpx`, загружает файл через `downloadTelegramDocument` и вызывает `fitnessRewardService.submitActivity`.
- `server/services/telegram-file.js` ограничивает файл 1 MiB, валидирует путь Telegram и использует timeout/stream size checks.
- `server/utils/gpx-activity.js` разбирает GPX в памяти с лимитом до 20 000 точек.
- `server/domain/fitness-rewards.js` сохраняет GPX как `unverified`, дедуплицирует по SHA-256 fingerprint и не выдаёт награду.
- `server/domain/fitness-evidence.js` сохраняет нормализованные HealthKit/Health Connect summaries как unverified; идентификатор provider record хэшируется на сервере.
- `server/domain/fitness-attestation.js` и `POST /api/fitness/attestation/challenges` реализуют одноразовый challenge, но не регистрацию и проверку App Attest key/assertion. Сам challenge не подтверждает источник.
- `fitness_activities.source` сейчас ограничен `gpx`; `fitness_device_evidence` — отдельная таблица для device summaries.

### 2.2. Telegram UX

Сейчас есть приём GPX-документа и команда `/fitness`, показывающая последний спортивный подарок. Нет полноценного каталога кампаний, списка заявок и подробной истории статусов. Приём выключается `FITNESS_REWARDS_ENABLED`.

### 2.3. Существующие награды и касса

- `customers.free` — общий счётчик бесплатных кофе в существующей лояльности.
- `server/domain/loyalty.js`: `grant()` превращает десятый штамп в `customers.free + 1`; `grantStamps()` использует `applyStamps()`; `redeem()` уменьшает `customers.free` и принимает произвольный `item`.
- Промокод типа `free` в `server/routes/promos.js` также напрямую увеличивает `customers.free`.
- `public/app/cashier.js` предлагает кассиру шесть позиций, включая «Батч брю», но `POST /api/staff/redeem` передаёт выбранное имя товара строкой; серверный allowlist товара сейчас не подтверждён.
- Текущая `fitness_rewards` — отдельные RUN-коды с состояниями active/redeemed/expired и отдельным маршрутом погашения. Это не общий баланс лояльности и не должно становиться целевой моделью новых наград.

### 2.4. Текущие ограничения запуска

- HealthKit и Health Connect summaries пока device-reported/unverified.
- App Attest server verifier не реализован.
- Strava read-only интеграция существует, но production gated; Strava не является источником наград.
- Текущий GPX intake не подтверждает подлинность активности.
- Никакой новый reward issuance не должен включаться до закрытия global verification gate.

## 3. Архитектурные границы

1. **Telegram adapter** — команды, документы, ответы и уведомления. Не содержит бизнес-расчёта наград.
2. **Evidence intake** — загрузка, парсинг, нормализация, fingerprint и дедупликация.
3. **Source verifier** — отдельный verifier каждого доверенного источника; только он выставляет machine-verified состояние после проверки происхождения.
4. **Review service** — ручные решения администраторов. Не меняет машинное состояние evidence на verified.
5. **Campaign engine** — выбирает зафиксированные версии кампаний, рассчитывает eligibility, лимиты и заявки.
6. **Loyalty integration** — создаёт ограниченное право на бесплатный фильтр-кофе в существующей системе лояльности и обеспечивает погашение кассой.
7. **Admin UI/API** — использует существующий административный интерфейс и `adminGuard`; отдельную админку не создавать.
8. **Outbox/notifications** — отправляет Telegram-уведомления после фиксации транзакции; повторная доставка уведомления не повторяет начисление.

Strava не подключается к этим компонентам. HealthKit/Health Connect доступны только через нативные адаптеры; Telegram Bot и Mini App не имеют прямого доступа к этим API.

## 4. Модель данных

Это логическая модель для проектирования миграций. Она намеренно не задаёт окончательный SQL до синхронизации с актуальной `pizza` и аудита всех writers лояльности.

### 4.1. Campaigns и версии

**fitness_campaigns**
- `id`, `name`, `description`, `active`, `current_version_id`;
- `created_at`, `created_by`, `updated_at`.

**fitness_campaign_versions** — неизменяемые условия:
- `id`, `campaign_id`, `version`;
- `min_distance_meters`;
- `activity_types`;
- `starts_at`, `ends_at`, `timezone`;
- `allowed_sources`;
- `verification_policy` (например: server_verified only; server_verified plus admin override);
- `max_rewards_per_user`, `limit_period` (day/week/month/campaign);
- `reward_type='filter_coffee'`;
- `reward_validity_seconds` (первый пилот: 48 часов согласно текущей fitness-документации);
- `created_at`, `created_by`.

Изменение любого условия создаёт новую версию. Опубликованная версия не редактируется задним числом.

### 4.2. Activities/evidence

Существующие `fitness_activities` и `fitness_device_evidence` нужно не заменять вслепую, а согласовать с provider-neutral activity model.

Минимальные логические данные:
- владелец `customer_id/cid`;
- источник и provider package;
- hash внешнего ID источника (если есть);
- fingerprint файла (для upload);
- время начала/окончания;
- дистанция и длительность;
- время приёма;
- machine verification state;
- нормализованные метаданные происхождения.

Raw GPX, FIT/TCX payload, GPS-маршрут и координаты не сохранять. Для внешних источников хранить только минимальные поля, необходимые для доверия, дедупликации и аудита.

Дедупликация:
- файл: SHA-256 исходных байтов; fingerprint не считать защитой от изменённого/пересобранного файла;
- provider record: server-side hash от customer + provider + source package + provider activity ID;
- уникальность provider ID ограничивать корректным scope источника; один и тот же ID у разных пакетов не должен случайно конфликтовать;
- дополнительное similarity matching — сигнал для review, не безусловный reject.

### 4.3. Claims и review

**fitness_campaign_claims**
- `id`, `activity_id`, `customer_id`, `campaign_id`, `campaign_version_id`;
- `status`, `created_at`, `updated_at`;
- уникальность активности в кампании/версии;
- сохранённый snapshot условий или неизменяемая ссылка на version row.

**fitness_claim_reviews**
- `id`, `claim_id`, `decision` (approve_override/reject/request_more_info);
- `reason`, `admin_id`, `created_at`;
- ссылка на предыдущее решение/корректировку при необходимости.

Ручное одобрение относится к claim, не переписывает `verification_state` activity.

### 4.4. Loyalty entitlement / gift ledger

Не создавать `fitness_balance` или отдельный спортивный кошелёк.

Целевая модель — общий журнал прав на бесплатные напитки, используемый всеми источниками подарков:
- `id`, `customer_id`;
- `source_type` (stamp, promo, fitness_campaign, other);
- `source_id` (уникальная ссылка на источник начисления);
- `allowed_product` (для спортивной награды — canonical `batch_brew`; для обычного подарка — общий кофе);
- `status` (available/redeemed/revoked/expired);
- `issued_at`, `expires_at`, `redeemed_at`, `redeemed_by`;
- `revoked_at`, `reversal_reason`.

Уникальность `(source_type, source_id)` обеспечивает идемпотентность выдачи. Один claim не может создать два entitlement.

`customers.free` сохраняется как совместимый агрегированный счётчик доступных подарков, но обновляется в той же транзакции, что и ledger. Перед миграцией необходимо найти и перевести все writers: минимум `loyalty.js` и `routes/promos.js`, а также остальные места прямого изменения `customers.free`. Старые остатки переносятся в ledger как legacy unrestricted gifts без потери количества.

При погашении сервер выбирает entitlement, который разрешает выбранную кассиром позицию. Спортивный entitlement разрешает только `batch_brew`; обычный legacy/unrestricted entitlement остаётся совместимым с текущими вариантами напитков. Клиентская строка `item` не является источником истины: сервер валидирует canonical product key и отображаемое название.

Текущая таблица `fitness_rewards` с RUN-кодами рассматривается как legacy compatibility path для уже выданных кодов. Новые кампании не должны выпускать отдельные RUN-коды или поддерживать отдельный спортивный баланс. Существующие активные коды нужно погасить по старому маршруту до удаления legacy path; удаление не входит в первый этап.

### 4.5. Отмена

- Неиспользованный entitlement можно отозвать атомарно: статус revoked + уменьшение `customers.free` + аудит.
- Уже погашенный entitlement нельзя «вернуть назад» удалением строки или отрицательным балансом; создаётся reversal/audit запись и, если нужен возврат пользователю, отдельная компенсирующая операция.
- Все корректировки требуют администратора и причины.
- История не удаляется при обычной отмене.

## 5. Статусы и переходы

Не смешивать состояние доказательства, решение review и результат кампании.

**Evidence state**
- `unverified` — получено/разобрано, источник не подтверждён;
- `pending_review` — ожидает ручной проверки;
- `verified` — только server-side verifier подтвердил разрешённое происхождение;
- `rejected` — доказательство недействительно;
- `needs_review` — противоречие/аномалия.

**Claim state**
- `pending_verification`;
- `pending_review`;
- `eligible`;
- `blocked_global_hold`;
- `limit_reached`;
- `rejected`;
- `reward_issued`;
- `reward_revoked`.

Ручной approve переводит claim в административно одобренное состояние, но не evidence в `verified`. Начисление разрешено только если:
1. global reward gate открыт;
2. версия кампании допускает соответствующий способ подтверждения/override;
3. claim eligible;
4. лимит кампании не исчерпан;
5. для этого claim ещё нет entitlement.

## 6. Campaign evaluation

- Активность должна начаться и закончиться в периоде кампании; для активности без надёжного `ended_at` применять документированное правило нормализации.
- Подача разрешена до `ends_at + 7 days` (календарные дни в timezone кампании); после срока заявка отклоняется как late.
- Кампания выбирается по времени активности, а не по времени ручного review.
- При получении заявки фиксируется конкретная `campaign_version_id`; новая версия не меняет уже принятую заявку.
- Одна активность может подходить нескольким кампаниям; оценка и лимит независимы для каждой.
- Лимит проверяется повторно внутри транзакции выдачи, с единым timezone/calendar policy.
- Для проекта по умолчанию использовать `Europe/Kaliningrad`; timezone сохранять в версии кампании.
- Минимальная дистанция — `distance_meters >= min_distance_meters`. Единый глобальный порог запрещён.
- Проверки времени, скорости, длительности, GPS discontinuity и формата — антифрод-фильтры, не доказательство происхождения.

## 7. Global reward gate и source trust

Global reward gate по умолчанию закрыт. Приём файлов/evidence может работать в режиме накопления заявок, но начисления остаются заблокированы.

Открывать gate можно только после того, как:
- минимум один источник имеет реализованный server-side verifier;
- проверка владения и целостности источника покрыта тестами;
- terms/policy источника письменно разрешают именно этот сценарий;
- утверждены assurance level и поля, которые сохраняются;
- есть операционный способ отключить источник и остановить новые начисления.

HealthKit/Health Connect device summaries сейчас не удовлетворяют этому gate. App Attest challenge primitive также не удовлетворяет ему. Strava исключена до письменного согласования.

Отдельные кампании могут быть настроены как server-verified only либо server-verified plus admin override. Даже второй режим не обходит global gate.

## 8. Telegram UX

Основные команды/экраны:
- `/fitness` — меню «Кофе за пробежку»;
- список доступных кампаний с порогом, периодом, типом активности, лимитом и видом награды;
- отправка поддерживаемого файла как Telegram Document;
- подтверждение приёма с номером заявки и статусом;
- «Мои активности» / «Мои заявки»;
- объяснение ожидания проверки, отказа и причины;
- уведомление о начислении и сроке использования;
- инструкция: показать профиль/QR кассиру и выбрать «Батч брю» для спортивного подарка.

Бот не должен обещать награду на основании успешного парсинга. Пока global gate закрыт, ответ прямо сообщает, что заявка сохранена, но выдача подарков временно не производится.

Mini App может позже показывать историю/статистику, но не требуется для подачи и проверки заявки.

## 9. Admin UX

Расширить существующую админку; не создавать отдельное приложение.

Нужны:
- список и фильтры кампаний;
- создание кампании и публикация новой версии;
- включение/выключение;
- список claims и evidence;
- просмотр агрегатов и provenance без показа лишних персональных/геолокационных данных;
- approve override / reject / request more info;
- обязательная причина ручного решения;
- история изменений кампании, решений и подарков;
- revoke неиспользованного entitlement;
- просмотр погашения и кассира.

Все операции защищены `adminGuard`; кассовое погашение — существующим staff-level guard, с серверной проверкой конкретного товара и entitlement.

## 10. API и события

Ниже — целевые контракты, не существующие маршруты. Сначала следует согласовать конкретное размещение в текущих routers и OpenAPI.

**Существующие маршруты, сохраняемые как intake/foundation:**
- `POST /api/fitness/evidence` — device summary intake, сейчас сохраняет unverified;
- `POST /api/fitness/attestation/challenges` — challenge primitive, не verifier;
- `POST /api/tg/webhook` — Telegram intake/commands;
- `POST /api/staff/redeem` — существующее списание общего подарка; потребуется server-side product/entitlement validation;
- legacy `POST /api/staff/fitness-rewards/{code}/redeem` — только для ранее выданных RUN-кодов.

**Целевые API (предлагаемые):**
- `GET /api/fitness/campaigns` — активные кампании;
- `GET /api/fitness/claims` — заявки текущего пользователя;
- `GET /api/admin/fitness/campaigns`;
- `POST /api/admin/fitness/campaigns`;
- `POST /api/admin/fitness/campaigns/:id/versions`;
- `POST /api/admin/fitness/campaigns/:id/toggle`;
- `GET /api/admin/fitness/claims`;
- `GET /api/admin/fitness/claims/:id`;
- `POST /api/admin/fitness/claims/:id/review`;
- `POST /api/admin/fitness/entitlements/:id/revoke`.

Пользовательские endpoints используют `userGuard`; admin endpoints — `adminGuard`. Не возвращать внутренние fingerprint, provider secrets, GPS и raw payload.

Коды ошибок должны различать invalid input, unauthenticated, forbidden, not found, duplicate, invalid transition, late submission, limit reached, verification pending, global hold и rate limit. Повтор одного и того же запроса с тем же idempotency key возвращает исходный результат, а не создаёт новое начисление.

**Транзакция issuance:** повторно проверить claim/version/gate/limit; вставить entitlement с unique source; увеличить `customers.free`; записать history/audit; commit. Уведомление отправить после commit через outbox/retryable job. Нельзя обещать exactly-once для внешнего Telegram send.

## 11. Безопасность и антифрод

- Ограничивать размер, количество точек/записей, время парсинга и допустимые XML features; парсить в памяти.
- Не сохранять raw file, route, coordinates и чувствительные provider payloads.
- Fingerprint защищает только от точного повторения файла.
- Дедуплицировать provider IDs на сервере в scope пользователя и источника.
- Использовать similarity/anomaly signals для review, не выдавать их за доказательство.
- Проверять activity type, время, длительность, дистанцию, скорость, временные разрывы и невозможные перемещения.
- Игнорировать client-supplied `verified`, reward fields и customer IDs; owner определяется серверной сессией/Telegram binding.
- Ограничивать частоту отправки, размер очереди и Telegram file fetch.
- Все админ-решения и изменения кампаний аудировать.
- Начисление/погашение/отзыв — транзакционно и с уникальными ограничениями.
- Не использовать Strava как обходной источник данных или способ передачи derived eligibility.

## 12. План реализации и критерии готовности

### Этап 0 — синхронизация PR
- Синхронизировать `feat/fitness-gpx-rewards` с актуальной `pizza` после отдельной оценки diverged history.
- Сохранить существующие изменения; разобрать конфликты; не удалять работающий intake.
- Повторить CI на новом HEAD.
- Не включать production flags и не мерджить без отдельного разрешения.

### Этап 1 — Telegram intake и provider-neutral model
- Сохранить безопасную загрузку Telegram.
- Разделить parser, evidence и campaign claim.
- Добавить provider-neutral normalized activity и дедупликацию.
- Оставить всё unverified; награды выключены.

**Готово:** корректные файлы создают одну запись; повтор не дублирует; никакой файл не начисляет награду.

### Этап 2 — Campaign engine
- CRUD кампаний и immutable versions.
- Проверка периода, 7-day grace window, дистанции, activity type и лимитов.
- Множественные независимые кампании для одной активности.

**Готово:** тесты доказывают воспроизводимый расчёт по зафиксированной версии.

### Этап 3 — Review и source verifier
- Админская очередь, ручной override/reject и audit.
- Реализация хотя бы одного допустимого server-verifiable source.
- Отдельный global gate; ручной override не может его обойти.

**Готово:** evidence state не подменяется ручным решением; без verifier issuance невозможно.

### Этап 4 — Loyalty entitlement
- Аудит всех writers `customers.free`.
- Общий gift ledger и backfill текущих остатков.
- Ограничение fitness entitlement на `batch_brew`.
- Server-side validation в кассовом redemption.
- Атомарная выдача, погашение и отзыв.

**Готово:** спортивный подарок виден в общем количестве подарков, но не может быть погашен как другой напиток; повторные операции безопасны.

### Этап 5 — Admin и Telegram UX
- Каталог кампаний, история заявок, статусы и уведомления.
- Админский CRUD/Review в существующей админке.
- E2E через реальный Telegram webhook test harness.

**Готово:** полный сценарий проверен от Telegram intake до кассового погашения.

### Этап 6 — ограниченный пилот
- Только после закрытия source/policy gate.
- Тестовая кампания, ограниченный круг пользователей, мониторинг дублей и кассовых ошибок.
- Production enablement — отдельное решение владельца продукта.

## 13. Тест-план

**Unit**
- parsers/normalizers, fingerprint, provider ID hashing;
- campaign version selection, timezone, grace window;
- multiple campaign evaluation;
- limits and status transitions;
- manual override audit and global hold;
- allowed product mapping;
- ledger selection, revoke/reversal.

**Integration/API**
- authenticated guest ownership;
- reject staff/unverified customer where required;
- duplicate file and provider record;
- same activity across multiple campaigns;
- old campaign version remains pinned;
- concurrent submissions and concurrent issuance at limit boundary;
- rollback if ledger insert/customer counter update fails;
- duplicate idempotency key;
- server rejects arbitrary product string;
- cashier can redeem filter entitlement only as «Батч брю»;
- legacy RUN code remains redeemable during compatibility period.

**Telegram/E2E**
- campaign list;
- document accepted/rejected;
- status message;
- repeat upload;
- global hold message;
- verified activity and admin override path after gate open;
- award notification retry without duplicate issuance;
- QR/cashier flow and double redemption.

CI must be reported against the exact tested commit SHA. No test is marked passed unless it was actually run.

## 14. Открытые вопросы

Бизнес-решения из текущего запроса закрыты. До реализации остаются технические spike/verification tasks, а не вопросы к владельцу:
1. Выбрать и реализовать первый server-verifiable source; HealthKit/App Attest нельзя считать готовым только по наличию native bridge/challenge.
2. Проверить условия хранения и поведение всех writers `customers.free`, затем выбрать безопасную миграцию gift ledger.
3. Подтвердить на актуальной ветке фактическое соответствие позиции «Батч брю» товару фильтр-кофе и серверную валидацию canonical product key.
4. После rebase PR заново сверить маршруты, схему БД, тесты и этот документ с актуальным HEAD.

**Решения пользователя, требующие повторного согласования, отсутствуют.** Любое изменение global hold, типа кофе, ручного override или срока подачи является изменением продукта и требует отдельного подтверждения.
