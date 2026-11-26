# F-003 — Deep OpenAPI Contract Audit

**Дата аудита:** 2026-11-26  
**Репозиторий:** [h0wller/zerno-app](https://github.com/h0wller/zerno-app)  
**Проверенная ветка:** `pizza`  
**Проверенный commit:** [`9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78`](https://github.com/h0wller/zerno-app/commit/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78)  
**Результат:** route/method parity — 79/79; обнаружены подтверждённые расхождения в схемах, заголовках, кодах ответов и описании guards.  
**Изменения приложения:** отсутствуют. Аудит выполнен только чтением GitHub API.

## 1. Executive summary

### Итог

На commit `9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78` OpenAPI содержит все 79 production operations, найденные в регистрациях Express-маршрутов. Не обнаружены лишние production operations, несовпадения HTTP methods/paths или повторяющиеся пары method/path в извлечённом реестре.

Это подтверждает только полноту списка операций. Это **не** подтверждает корректность контракта.

Подтверждены следующие классы расхождений:

1. Неверные типы идентификаторов в общих response schemas: `Customer.id` и `MenuItem.id` описаны как integer, тогда как сервер возвращает строковые prefixed IDs.
2. Неверные или неполные request schemas: consent, Telegram initData flow, staff QR, role activation code, order status, delay minutes, push subscription.
3. Несовпадение response contract: Telegram/SMS ветки регистрации, delivery promo lookup, chat botlog.
4. Пропущенные request bodies: создание промокода и необязательная device-cleanup часть logout.
5. Недостаточно описаны error responses и role-level authorization на нескольких группах операций.
6. CORS middleware не разрешает browser preflight для `X-Chat-Access-Token`, хотя этот заголовок объявлен OpenAPI security scheme. Влияние зависит от того, предполагается ли cross-origin browser access.

### Статус по доказательности

- **CONFIRMED:** route parity; перечисленные ниже несовпадения схем и поведения; пропущенные ответы/guards.
- **SUSPECTED:** CORS/preflight для cross-origin browser clients.
- **MATCHED:** отдельные контракты, для которых исходный код и соответствующие тестовые assertions согласуются (см. раздел 8). Тесты не запускались.
- **NOT VERIFIABLE:** фактический результат YAML parser/OpenAPI validator/Postman import, runtime responses и полный Telegram Update schema.

Предыдущий аудит от 2026-11-07 прямо ограничивал свою проверку route/guard и структурным reconciliation, не заявляя полную schema equivalence. Текущий аудит расширяет проверку до request/response details, но не подменяет запуск тестов или валидаторов.

## 2. Проверенная версия `pizza` и SHA

Ветка повторно прочитана через GitHub API перед подготовкой отчёта:

- `pizza` → `9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78`
- commit date: `2026-11-26T18:41:28Z`
- SHA совпал с ранее прочитанным в рамках этого аудита; drift между начальной и повторной проверкой не обнаружен.

### SHA обязательных документов

| Файл | Blob SHA |
|---|---|
| `AGENTS.md` | `6c0f670b86d7d4799c786553adc455d0caa98fec` |
| `PROJECT_RULES.md` | `85b13f0c66801c4694cc828aaa26f4d2f3dd9303` |
| `docs/read-if-u-ai.md` | `6021a0eac88a948c013a83993dc1589a2d243f71` |
| `docs/api.md` | `102ef4c2d55b8e3c0d322de2bb4837b37b2710e7` |
| `docs/openapi.yaml` | `b0bdc46b85d460ade050e0c0addd18d060014e27` |
| `docs/module-map.md` | `b265172cf4c3105dd95a651bb6f1034c33d3b6a3` |
| `docs/documentation-audit-2026-11-07.md` | `4dd5b5e2c0e45638201677775350b70a4054948b` |

Все семь документов прочитаны из ref `pizza`. В качестве источника истины для маршрутов использованы текущие регистрации в `server.js` и `server/routes/*.js`, а не только `docs/api.md`.

## 3. Методология

1. Прочитаны обязательные документы из раздела «Где смотреть» в `AGENTS.md`; учтено требование сверять API с серверными маршрутами и тестами.
2. Получен recursive Git tree commit `9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78`; найдены все файлы `server/routes/*.js`, middleware и тестовые файлы.
3. Прочитаны `server.js`, все восемь route modules, `server/middleware/{auth,cors,security,validate,index}.js), а также связанные domain/helper files.
4. Извлечены все Express route registrations и все OpenAPI path/method declarations. Параметры `:id` нормализованы к OpenAPI `{id}`.
5. Для каждой операции сверены guard, path/query/body/header inputs, content type, успешный ответ и явно реализованные error statuses.
6. Для существенных findings проверено наличие соответствующих integration/unit tests и что именно они утверждают.
7. Статусы findings назначены по доступным source/test evidence. Неоднозначные случаи не объявлялись ошибками.

### Ограничения методологии

- Не было локального checkout, shell, запуска приложения, SQLite или Vercel Sandbox.
- Не запускались YAML parser, OpenAPI validator, Postman import, npm scripts или Playwright.
- Содержимое тестов прочитано статически; наличие assertion не является доказательством успешного выполнения теста на этом commit.
- Внешние Telegram/SMS/FCM/Web Push provider responses не вызывались.

## 4. Реестр серверных маршрутов

Всего найдено 81 registration: 79 production operations и два test-only routes. В OpenAPI найдено 79 operations.

### 4.1. Inline routes в `server.js`

| Method | Path | Middleware / authorization | Inputs | Success / explicit errors |
|---|---|---|---|---|
| POST | `/api/clientlog` | public; `clientLogRateLimit`; JSON limit 4 KiB | JSON: `kind`, `msg` | 200 `{ok}`; 400 malformed JSON; 413 too large; 429 + `Retry-After` |
| POST | `/api/menu/upload` | `adminGuard`; JSON limit 6 MiB | JSON: `data` data URL; optional `id` | 200 `{ok,url}`; 400 invalid image/data; 413 limit; 500 save failure; guard 401/403 |
| GET | `/api/health` | public | — | 200 `{ok:true}` |
| GET | `/api/config` | public | — | 200 `{tgUsername,smsAuthEnabled}` |
| GET | `/api/tg/diag` | `adminGuard` | — | 200 diagnostics object; 401/403 |
| GET | `/api/menu` | public | — | 200 `{items,updatedAt}` |
| GET | `/api/menu/all` | `menuGuard` (cashier/dispatch/admin) | — | 200 `{items,updatedAt}`; 401/403 |
| GET | `/api/dmenu` | public | — | 200 `{items,updatedAt}` |
| POST | `/api/menu` | `adminGuard` | JSON menu fields: `id,cat,e,name,desc,comp,vol,price,tag,coffee,on,img,section,opts` | 200 `{ok,id}`; 401/403 |
| PUT | `/api/menu/reorder` | `adminGuard` | JSON: `brand`, `ids[]` | 200 `{ok}`; 400 empty list; 409 incomplete IDs; 401/403 |
| PUT | `/api/menu/:id` | `menuGuard`; non-admin only `on` for own section | path `id`; JSON menu fields or only `on` | 200 `{ok,...}`; 403 forbidden field/section; 404 unknown item; 401 |
| DELETE | `/api/menu/:id` | `adminGuard` | path `id` | 200 `{ok}`; 401/403 |

### 4.2. `server/routes/auth.js`

| Method | Path | Middleware / authorization | Inputs | Success / explicit errors |
|---|---|---|---|---|
| POST | `/api/auth/tg-link` | public; Telegram initData validation | JSON: `initData`; optional `phone,name,pin,consent,src` | 200 login/needPhone/needBotConfirm; 400 phone/consent; 401 invalid or stale initData; 409 duplicate/conflicting Telegram link |
| POST | `/api/auth/request-reg-otp` | public; persisted send limits | JSON: `phone,name,pin,consent,returnTo,via,src` | 200 Telegram or SMS variant; 400 invalid inputs; 409 existing phone; 429 limit; 503 SMS disabled/send failure |
| POST | `/api/auth/check-reg` | public; one-time poll token | JSON: `pollToken` | 200 `{confirmed:false}` or `{confirmed:true,token,customer}`; 400 invalid token |
| POST | `/api/auth/register` | public; `validate(RegisterSchema)` | JSON: `name,phone,consent`; optional `pin,code,src` | 200 `{token,customer}`; 400 validation/consent/domain validation; 403 invalid supplied SMS OTP; 409 existing phone; 429 lockout |
| POST | `/api/auth/tg-link/request` | `userGuard`; pending guest only | JSON: `returnTo` | 200 `{ok,tgUrl,expiresAt}`; 400 unsafe returnTo; 401/403; 409 active/no phone; 503 bot unavailable |
| POST | `/api/auth/activate-guest` | `userGuard` | JSON: 4-digit `code` | 200 `{customer}`; 400 format; 401; 403 invalid code; 409 already active; 429 lockout |
| POST | `/api/auth/login` | public; `validate(LoginSchema)` | JSON: `phone`; optional `pin,otp` | 200 token/customer/needPin; 400; 403; 404; 409; 429; 503 |
| POST | `/api/auth/setup-pin` | `userGuard` + `validate(SetupPinSchema)` | JSON: `pin`; schema also tolerates optional `phone` | 200 `{customer}`; 400; 401; 403 if PIN already exists |
| POST | `/api/auth/set-pin` | `userGuard` | JSON: `pin` | 200 `{customer}`; 400; 401 |
| POST | `/api/auth/request-otp` | public; persisted send limits | JSON: `phone` | 200 `{ok,via}`; 400; 404; 429; 503 |
| POST | `/api/auth/activate` | `userGuard` + `validate(ActivateCodeSchema)` | JSON: role code, 16–64 chars | 200 `{customer}`; 400; 401; 403; 409 admin self-demotion; 429 |
| POST | `/api/staff/activate-guest` | `pendingGuard` | JSON: `id` | 200 `{ok:true}`; 401/403; 404; 409 |
| GET | `/api/staff/pending` | `pendingGuard` | — | 200 `{pending[]}`; 401/403 |
| GET | `/api/admin/bonuses` | `adminGuard` | — | 200 bonus config; 401/403 |
| PUT | `/api/admin/bonuses` | `adminGuard` | JSON bonus config | 200 updated config; 401/403 |
| POST | `/api/bonus/install` | `userGuard` | — | 200 `{granted,code|null}`; 401 |
| POST | `/api/auth/deactivate` | `userGuard` | — | 200 `{customer}`; 401; 403 last admin |
| POST | `/api/exit` | `userGuard` | optional JSON: device `endpoint`, FCM `token` | 200 `{ok:true}`; 401 |
| GET | `/api/me` | `userGuard` | — | 200 `{customer}`; 401 |
| PUT | `/api/me` | `userGuard` | JSON: `name` | 200 `{customer}`; 400; 401 |
| DELETE | `/api/me` | `userGuard`; staff self-delete rejected | — | 200 deletion result; 401; 403 for staff |
| PUT | `/api/me/notify` | `userGuard` | JSON: `tg`, `web` | 200 `{customer}`; 401 |
| POST | `/api/redeem` | `userGuard` | — | 200 redemption result; 400 no gifts; 401 |

Test-only routes (not production OpenAPI operations):

- `POST /__test/otp`
- `POST /__test/otp/inspect`

Both are registered only when `NODE_ENV === 'test'`. The concise `docs/api.md` mentions the first but not the second.

### 4.3. `server/routes/chat.js`

| Method | Path | Middleware / authorization | Inputs | Success / explicit errors |
|---|---|---|---|---|
| POST | `/api/chat/send` | public route; either Bearer owner authorization or anonymous `X-Chat-Access-Token` capability | JSON: `key,text`; optional `human,ctx` | 200 `{ok}`; 400 invalid key/text/context; 401 missing auth/capability; 403 owner mismatch/anonymous staff-call; 429 + `Retry-After`; 503 rate-limit store full |
| POST | `/api/chat/botlog` | same owner/capability authorization | JSON: `key,text` | 200 `{ok}`; 400 invalid key/text; 401/403; 429; 503 |
| GET | `/api/chat/thread` | same owner/capability authorization | query: required `key`, optional `after` | 200 `{msgs[]}`; 400 key/cursor; 401/403; 429; 503 |
| GET | `/api/chat/list` | `chatGuard` + brand filtering | query: `closed=1` toggles closed view | 200 `{threads[]}`; 401/403 |
| GET | `/api/chat/dialog` | `chatGuard` + brand filtering | query: `key` | 200 `{msgs[]}`; 400 invalid key; 401/403; 404 no thread |
| POST | `/api/chat/reply` | `chatGuard` + brand filtering | JSON: `key,text` | 200 `{ok}`; 400 invalid text/key; 401/403; 404 no thread |
| POST | `/api/chat/close` | `chatGuard` + brand filtering | JSON: `key` | 200 `{ok}`; 400 invalid key; 401/403; 404 no thread |
| POST | `/api/chat/open` | `chatGuard` + brand filtering | JSON: `key` | 200 `{ok}`; 400 invalid key; 401/403; 404 no thread |

### 4.4. `server/routes/orders.js`

| Method | Path | Middleware / authorization | Inputs | Success / explicit errors |
|---|---|---|---|---|
| GET | `/api/delivery/info` | public | — | 200 delivery config |
| PUT | `/api/admin/weekpromo` | `adminGuard` | JSON: `text,threshold,gift,until,push,pmName,pmOn` | 200 `{ok}`; 401/403 |
| GET | `/api/delivery/addr` | public | query: `place,q` | 200 `{suggestions[]}` |
| POST | `/api/orders` | `verifiedCustomerGuard`; staff roles bypass guest verified requirement | JSON: `items[]`, optional `client_order_id,method,place,street,house,addr,slot,pay,comment,promo` | 200 `{order}`; 400; 401; 403 `CUSTOMER_NOT_VERIFIED`; 409 idempotency/business conflict; 410 promo exhausted/expired; 500 |
| GET | `/api/orders/mine` | `userGuard` | — | 200 `{orders[]}`; 401 |
| GET | `/api/orders` | `dispatchGuard` (cashier/dispatch/admin) | query: `status,staff,done` | 200 `{orders[]}`; 401/403 |
| POST | `/api/orders/:id/status` | `dispatchGuard` | path `id`; JSON: `status` | 200 `{ok}`; 400 unknown status; 401/403; 404; 409 invalid transition |
| POST | `/api/orders/:id/delay` | `dispatchGuard` | path `id`; JSON: `min,comment` | 200 `{ok}`; 400 invalid minutes; 401/403; 404 |
| POST | `/api/orders/delay-all` | `dispatchGuard` | JSON: `min,comment` | 200 `{ok,count}`; 400; 401/403 |

### 4.5. `server/routes/promos.js`

| Method | Path | Middleware / authorization | Inputs | Success / explicit errors |
|---|---|---|---|---|
| POST | `/api/promo/redeem` | `userGuard`; verified profile required | JSON: `code` | 200 `{customer,msg}`; 400; 401; 403 unverified; 404 unknown; 409 repeat; 410 expired/exhausted |
| GET | `/api/promo/info` | public | optional query: `code` | always 200; `{ok:false,error}` or `{ok:true,kind,value,code}` |
| GET | `/api/me/free-delivery` | `userGuard` | — | 200 `{code|null}`; 401 |
| GET | `/api/promos` | `adminGuard` | — | 200 `{promos[]}`; 401/403 |
| POST | `/api/promos` | `adminGuard` | JSON: `code,kind,value,days,maxuses` | 200 `{ok}`; 400 short code; 401/403; 409 duplicate |
| POST | `/api/promos/:id/toggle` | `adminGuard` | path `id` | 200 `{ok}`; 401/403 |
| DELETE | `/api/promos/:id` | `adminGuard` | path `id` | 200 `{ok}`; 401/403 |

### 4.6. `server/routes/push.js`

| Method | Path | Middleware / authorization | Inputs | Success / explicit errors |
|---|---|---|---|---|
| GET | `/api/vapid` | public | — | 200 `{publicKey}` |
| POST | `/api/push/subscribe` | `userGuard` | JSON: `sub` (must contain `endpoint`), optional `dev` | 200 `{ok}`; 400 invalid subscription; 401 |
| POST | `/api/push/test` | `userGuard` | optional header `x-smoke-test` | 200 delivery result or smoke skip; 503 no confirmed device delivery; 401 |
| POST | `/api/push/fcm` | `userGuard` | JSON: `token` | 200 `{ok}`; 400 empty token; 401 |
| GET | `/api/push/subs` | `adminGuard` | — | 200 `{subs,tg}`; 401/403 |
| POST | `/api/push/send` | `adminGuard` | JSON: `body` (trimmed and truncated to 2,000 chars) | 200 delivery counters; 400 empty body; 401/403 |
| POST | `/api/push/send-hours-update` | `adminGuard` | — | 200 delivery counters; 401/403 |
| POST | `/api/push/unsubscribe` | `userGuard` | JSON: at least one of `endpoint,token` | 200 `{ok}`; 400 empty tuple; 401 |
| POST | `/api/push/del` | `adminGuard` | JSON: `cid` | 200 `{ok}`; 401/403 |

### 4.7. `server/routes/staff.js`

| Method | Path | Middleware / authorization | Inputs | Success / explicit errors |
|---|---|---|---|---|
| GET | `/api/staff/customers` | `staffGuard` (cashier/admin) | query: `search` | 200 `{customers[]}`; 401/403 |
| GET | `/api/staff/customers/:id` | `staffGuard` | path `id` | 200 `{customer}`; 401/403; 404 |
| POST | `/api/staff/customers` | `staffGuard` | JSON: `name,phone,pin` | 200 `{customer,created,reused,pinSet,pinPreserved}`; 400; 401/403; 409 ambiguity/race |
| POST | `/api/staff/stamp` | `staffGuard` | JSON: `id` | 200 grant result; 401/403; 404 |
| POST | `/api/staff/redeem` | `staffGuard` | JSON: `id`, optional `item` | 200 redeem result; 400 no gifts; 401/403 |
| POST | `/api/staff/scan` | `staffGuard` | JSON: `code` QR | 200 `{customer}`; 401/403; 404 |
| GET | `/api/staff/log` | `staffGuard` | query: `scope`; only `coffee` applies a filter | 200 `{log[]}`; 401/403 |

### 4.8. `server/routes/stats.js` и `server/routes/tg.js`

| Method | Path | Middleware / authorization | Inputs | Success / explicit errors |
|---|---|---|---|---|
| GET | `/api/stats` | `adminGuard` | — | 200 stats object; 401/403 |
| GET | `/api/stats/redeems` | `adminGuard` | optional query `month=YYYY-MM` | 200 summary; 400 invalid month; 401/403 |
| GET | `/api/stats/orders` | `adminGuard` | optional query `days` (clamped to 1–30; default 14) | 200 stats object; 401/403 |
| POST | `/api/tg/webhook` | public route protected by `x-telegram-bot-api-secret-token` | header secret; JSON Telegram Update | 200 `{ok:true}`; 403 wrong secret; 503 secret not configured |

### 4.9. Общие transport/middleware правила

- Глобально: compression, security headers, CORS, canonical-host redirect, затем `express.json({limit:'10mb'})`.
- `/api/clientlog` использует отдельный JSON parser с лимитом 4 KiB и per-IP limit 60/min.
- `/api/menu/upload` использует отдельный JSON parser с лимитом 6 MiB; decoded image до 4 MiB, до 6 MP и 4,096 px на сторону; JPEG/PNG/WebP.
- Успешные API responses формируются через `res.json()`, то есть JSON response content type.
- Все описанные request bodies — JSON. В inspected routes нет multipart/form-data или raw binary API body.
- Bearer header: `Authorization`. Anonymous chat capability: `X-Chat-Access-Token`. Telegram webhook secret: `x-telegram-bot-api-secret-token`. Internal push smoke header: `x-smoke-test`.
- `Retry-After` явно выставляется clientlog/chat rate limit middleware; не следует переносить это поведение на auth lockouts без проверки конкретного handler.

## 5. Реестр расхождений

### 5.1. CONFIRMED

#### C-01 — `Customer.id` имеет неверный тип

- **OpenAPI:** `components.schemas.Customer.properties.id` объявлен `integer`.
- **Код:** `createCustomer()` формирует `id = uid('u')`; `uid()` возвращает префикс + 10 hex chars; `cust()` возвращает `c.id` без преобразования.
- **Следствие:** новые customer IDs — строки вида `u...`, не integer. Это затрагивает все responses с `Customer`.
- **Evidence:** [openapi.yaml L48-L72](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L48-L72), [customers.js L15-L26](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/domain/customers.js#L15-L26), [id-time.js L10-L13](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/utils/id-time.js#L10-L13), [helpers.js L7-L18](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/domain/helpers.js#L7-L18).
- **Tests:** auth integration tests проверяют наличие ID, но не его тип. Добавить contract assertion, что ID — string и соответствует фактическому prefixed format.

#### C-02 — `MenuItem.id` имеет неверный тип

- **OpenAPI:** `MenuItem.id` объявлен `integer`.
- **Код:** создание menu item использует `uid('p')`; `item(row)` отдаёт `row.id` без преобразования.
- **Следствие:** menu IDs также строковые; response schema `GET /api/menu` не соответствует фактическому значению.
- **Evidence:** [openapi.yaml L72-L91](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L72-L91), [server.js L274-L281](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server.js#L274-L281), [helpers.js L4-L7](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/domain/helpers.js#L4-L7), [id-time.js L10-L13](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/utils/id-time.js#L10-L13).
- **Tests:** проверка menu API response на строковый ID и contract-level schema assertion отсутствуют среди проверенных API tests. Добавить integration assertion на GET после создания.

#### C-03 — `POST /api/auth/register`: consent schema допускает отвергаемое значение и исключает принимаемое

- **OpenAPI:** `consent: integer, enum [0,1]`.
- **Код:** handler принимает только `1` или `true`; `0` и `false` возвращают 400. Zod schema допускает оба integer и boolean, но handler сужает допустимое множество.
- **Следствие:** generated clients могут отправить schema-valid `0`, который сервер отклонит; допустимый boolean `true` отсутствует в OpenAPI schema.
- **Evidence:** [openapi.yaml L169-L200](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L169-L200), [validate.js L25-L35](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/middleware/validate.js#L25-L35), [auth.js L248-L256](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/auth.js#L248-L256).
- **Tests:** [auth-otp-routes.test.mjs L117-L135](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/tests/integration/auth-otp-routes.test.mjs#L117-L135) проверяет missing consent и `true`, но не integer `1`, `0` или false. Добавить матрицу значений и синхронизировать schema.

#### C-04 — `POST /api/auth/request-reg-otp`: SMS response branch отсутствует в OpenAPI

- **OpenAPI:** успешный ответ требует `ok,tgUrl,pollToken,expiresAt`.
- **Код:** при `via='sms'` и `SMS_AUTH_ENABLED=true` сервер отправляет SMS и возвращает `{ok:true,via:'sms'}`; при выключенном SMS или ошибке отправки возвращает 503.
- **Следствие:** контракт не описывает один из явно разрешённых request variants и не объявляет фактический 503.
- **Evidence:** [openapi.yaml L201-L239](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L201-L239), [auth.js L178-L232](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/auth.js#L178-L232).
- **Tests:** [auth-sms-disabled.test.mjs L85-L118](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/tests/integration/auth-sms-disabled.test.mjs#L85-L118) проверяет disabled SMS и Telegram branch; enabled SMS response не покрыт. Добавить тест с включённым флагом и stub SMS adapter.

#### C-05 — `POST /api/auth/tg-link`: отсутствует условный consent и response 409

- **OpenAPI:** request schema перечисляет `initData,phone,name,pin`, но не `consent`; response statuses включают 200/400/401, но не 409.
- **Код:** если передан `phone`, handler требует `consent === 1 || consent === true`; несколько конфликтных ситуаций привязки Telegram возвращают 409.
- **Следствие:** клиент не может описать через контракт обязательное согласие при phone-link flow; один фактический response status отсутствует.
- **Evidence:** [openapi.yaml L370-L394](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L370-L394), [auth.js L81-L100](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/auth.js#L81-L100), [auth.js L107-L155](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/auth.js#L107-L155).
- **Tests:** Telegram auth tests покрывают основные link/confirm cases, но проверенную contract test suite не удалось подтвердить как проверяющую OpenAPI field parity. Добавить test на phone без consent, consent true/1 и конфликт link → 409.

#### C-06 — Role activation code constraints неполны; auth 429/401 responses пропущены

- **OpenAPI:** `POST /api/auth/activate` объявляет `code: string` без pattern/minLength/maxLength; не перечисляет 401 и 429.
- **Код:** `ActivateCodeSchema` требует `^[A-Za-z0-9_-]{16,64}$`; `userGuard` может вернуть 401; lockout handler возвращает 429.
- **Evidence:** [openapi.yaml L1153-L1168](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L1153-L1168), [validate.js L45-L49](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/middleware/validate.js#L45-L49), [auth.js L495-L516](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/auth.js#L495-L516), [auth middleware L33-L57](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/middleware/auth.js#L33-L57).
- **Tests:** `auth-otp-routes.test.mjs`, `auth-lockout-enforcement.test.mjs`, `staff-codes.test.mjs` и `security.test.mjs` покрывают части поведения. Добавить boundary tests 15/16/64/65 chars и проверить документированные статусы.

#### C-07 — `POST /api/auth/activate-guest`: code format и Retry-After header описаны неверно/неполно

- **OpenAPI:** `code` — просто string; описание 429 говорит, что `Retry-After` содержит время ожидания.
- **Код:** handler принимает только ровно 4 цифры; на lockout возвращает JSON 429, но не выставляет `Retry-After`.
- **Evidence:** [openapi.yaml L312-L333](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L312-L333), [auth.js L366-L384](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/auth.js#L366-L384).
- **Tests:** `auth-lockout-enforcement.test.mjs` проверяет lockout, но header contract в проверенных тестах не подтверждён. Добавить pattern `^[0-9]{4}$` и тест на наличие/отсутствие Retry-After; затем исправить код или документацию.

#### C-08 — `POST /api/staff/scan`: QR pattern не соответствует генерируемому QR

- **OpenAPI:** `code` требует 16–64 символа и pattern `^[A-Za-z0-9_-]{16,64}$`.
- **Код:** customer QR создаётся как `'Z-' + randomBytes(3).toString('hex').toUpperCase()`, то есть формат `Z-XXXXXX`; route напрямую ищет это значение в `customers.qr`.
- **Следствие:** валидный фактический QR не проходит опубликованную OpenAPI schema.
- **Evidence:** [openapi.yaml L812-L834](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L812-L834), [customers.js L15-L26](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/domain/customers.js#L15-L26), [staff.js L161-L164](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/staff.js#L161-L164).
- **Tests:** среди проверенных integration tests нет отдельного сценария `/api/staff/scan`. Добавить тест с реальным сгенерированным QR, unknown QR и auth matrix.

#### C-09 — `POST /api/orders/{id}/delay`: неверные min/max constraints

- **OpenAPI:** `min` integer с minimum 0, без maximum.
- **Код:** `parseDelayMinutes` принимает только integer от 1 до 180; 0 и значения выше 180 возвращают 400.
- **Evidence:** [openapi.yaml L740-L763](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L740-L763), [orders.js L589-L595](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/orders.js#L589-L595), [orders.js L601-L611](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/orders.js#L601-L611).
- **Tests:** `order-status.test.mjs` тестирует переходы статусов, но не delay minutes. Добавить integration matrix: отсутствует, 0, 1, 180, 181, дробное значение.

#### C-10 — `POST /api/orders/{id}/status`: отсутствует enum статусов

- **OpenAPI:** `status: string` без enum.
- **Код:** сервер принимает только ключи `new,accept,cook,way,done,cancel`; остальные значения дают 400.
- **Evidence:** [openapi.yaml L718-L739](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L718-L739), [orders.js L87-L94](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/orders.js#L87-L94), [orders.js L561-L568](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/orders.js#L561-L568).
- **Tests:** [order-status.test.mjs](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/tests/unit/order-status.test.mjs) покрывает переходы и invalid status logic. Добавить contract assertion на OpenAPI enum.

#### C-11 — `GET /api/promo/info`: query required и 404 не соответствуют handler

- **OpenAPI:** query `code` обязателен; неизвестный код описан как 404.
- **Код:** `code` может отсутствовать; отсутствие, unknown/inactive, неверный scope, expired и exhausted code возвращают `res.json({ok:false,error})`, то есть HTTP 200.
- **Evidence:** [openapi.yaml L1059-L1072](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L1059-L1072), [promos.js L71-L82](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/promos.js#L71-L82).
- **Tests:** среди просмотренных API integration tests отдельный promo-info route test не найден. Добавить тесты missing/unknown/inactive/wrong-scope/expired/exhausted/valid и зафиксировать intended HTTP semantics.

#### C-12 — `POST /api/promos`: отсутствует requestBody и ошибки в OpenAPI

- **OpenAPI:** операция не содержит `requestBody`; объявлен только 200.
- **Код:** handler читает `code,kind,value,days,maxuses`; возвращает 400 при коротком коде и 409 при duplicate code.
- **Evidence:** [openapi.yaml L1073-L1084](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L1073-L1084), [promos.js L94-L106](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/promos.js#L94-L106).
- **Tests:** `auth-otp-routes.test.mjs` создаёт промокод в batch-stamp scenario, но не проверяет request schema/error matrix. Добавить admin-auth, required code, kind/value/days/maxuses, 400/409 cases.

#### C-13 — `POST /api/exit`: отсутствует необязательный requestBody

- **OpenAPI:** operation не описывает body.
- **Код:** logout читает optional `endpoint` и `token`, чтобы удалить только device-scoped Web Push/FCM registrations; сам bearer session отзывается всегда.
- **Evidence:** [openapi.yaml L1178-L1184](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L1178-L1184), [auth.js L557-L575](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/auth.js#L557-L575).
- **Tests:** [auth-otp-routes.test.mjs L646-L701](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/tests/integration/auth-otp-routes.test.mjs#L646-L701) проверяет logout с endpoint/token и device isolation. Добавить optional JSON schema и contract assertion.

#### C-14 — `POST /api/push/subscribe`: неполная nested schema и пропущенные error responses

- **OpenAPI:** `sub` объявлен object, но его `endpoint` не required; response объявляет только 200.
- **Код:** handler возвращает 400, если `sub` отсутствует или `sub.endpoint` отсутствует; `userGuard` возвращает 401.
- **Evidence:** [openapi.yaml L1004-L1020](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L1004-L1020), [push.js L14-L24](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/push.js#L14-L24).
- **Tests:** push integration test покрывает валидные подписки, но не invalid nested sub. Добавить schema required endpoint и тесты missing sub/missing endpoint/unauthenticated.

#### C-15 — `POST /api/chat/botlog`: OpenAPI документирует несуществующий 409 и неверное precondition

- **OpenAPI:** описание говорит, что тред должен быть создан первым сообщением гостя; 409 заявлен для отсутствующего треда.
- **Код:** после успешной capability/owner authorization handler выполняет upsert `chat_meta` и вставляет bot message. Комментарий в коде прямо допускает race, когда bot response приходит раньше guest send response. Обработчик не возвращает 409 из-за отсутствующего `chat_meta`.
- **Evidence:** [openapi.yaml L890-L916](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L890-L916), [chat.js L100-L180](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/chat.js#L100-L180), [chat.js L240-L261](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/chat.js#L240-L261).
- **Tests:** [chat-access-control.test.mjs L142-L190](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/tests/integration/chat-access-control.test.mjs#L142-L190) проверяет forged botlog, но не первый botlog до guest message. Добавить race/first-write test; убрать 409 либо изменить handler, если 409 является намеренным контрактом.

#### C-16 — Error responses неполны для защищённых операций

OpenAPI часто объявляет BearerAuth, но не все ответы, которые реально возвращают guards/handlers. Примеры подтверждены кодом:

- `/api/auth/activate`: missing 401 и 429.
- `/api/auth/deactivate`, `/api/exit`: missing 401.
- `/api/staff/customers` GET/POST: missing 401/403; POST также missing 400/409.
- `/api/staff/stamp`: missing 401/403; `/api/staff/redeem`: missing 401/403.
- `/api/chat/list`: missing 401; `/api/chat/dialog`: missing 400/401/404; `/api/chat/reply`: missing 401/404; `/api/chat/close` и `/api/chat/open`: missing 400/401/404.
- `/api/push/subscribe`: missing 400/401; `/api/push/send`: missing 400; `/api/push/del`: missing 401/403.
- `/api/stats` и `/api/stats/orders`: missing 401/403.
- `/api/promo/redeem`: handler также возвращает 403, 404, 409 и 410, а OpenAPI показывает только 400.
- `/api/orders/{id}/delay`: missing 400 и 401.

Representative evidence: [auth middleware L24-L57](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/middleware/auth.js#L24-L57), [promos.js L15-L68](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/promos.js#L15-L68), [chat.js L100-L176](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/chat.js#L100-L176), [chat.js L287-L390](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/chat.js#L287-L390), [staff.js L19-L72](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/staff.js#L19-L72), [push.js L14-L142](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/push.js#L14-L142), [stats.js L10-L114](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/stats.js#L10-L114).

- **Tests:** Integration coverage exists for auth, chat guest access, push cleanup/test, orders and upload, but no complete route × status contract matrix. Add a reusable test matrix for public, user, staff, dispatch, admin, owner-chat and anonymous-capability access.
- **Disposition:** confirmed documentation gap. Do not infer that all omitted statuses are unreachable.

#### C-17 — Role-level authorization semantics are not explicit for multiple BearerAuth operations

BearerAuth correctly represents authentication, but it does not represent application roles. Tags such as `Staff` or `Admin` are not authorization rules.

Examples where source has role/brand guard but operation text does not fully explain it:

- `/api/promos` CRUD and `/api/promos/{id}` operations use `adminGuard`.
- `/api/stats`, `/api/stats/orders`, `/api/admin/weekpromo` use `adminGuard`.
- `/api/staff/customers`, `/api/staff/stamp`, `/api/staff/redeem` use `staffGuard` (cashier/admin).
- `/api/orders/{id}/status`, `/api/orders/{id}/delay`, `/api/orders/delay-all` use `dispatchGuard` (cashier/dispatch/admin).
- Staff chat list/dialog/reply/close/open use `chatGuard` plus brand isolation (cashier coffee; dispatch delivery; admin both).

Evidence: [auth.js middleware](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/middleware/auth.js#L24-L57), [promos.js](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/promos.js#L91-L115), [stats.js](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/stats.js#L10-L114), [orders.js](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/orders.js#L545-L627), [chat.js](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/chat.js#L287-L390), [staff.js](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/staff.js#L19-L179).

Tests: role tests exist in auth/staff code tests, but not a full role matrix for each operation. Add role matrix tests and explicit operation descriptions. BearerAuth should remain the security scheme; role guards belong in operation descriptions/extensions or documented reusable security guidance.

### 5.2. SUSPECTED

#### S-01 — CORS does not allow `X-Chat-Access-Token`

- OpenAPI defines `ChatAccessToken` as API key in header `X-Chat-Access-Token`.
- CORS middleware allows only `Content-Type, Authorization, X-Staff`.
- A cross-origin browser client sending anonymous chat capability will preflight with `Access-Control-Request-Headers: x-chat-access-token`; current allow-list does not include it.
- Same-origin PWA requests do not require CORS preflight, so this is not necessarily a production defect for the current first-party client.
- Evidence: [openapi.yaml L40-L44](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L40-L44), [cors.js L4-L9](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/middleware/cors.js#L4-L9), [chat.js L120-L139](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/chat.js#L120-L139).
- Tests: Node fetch integration tests bypass browser preflight. Add OPTIONS/preflight test if cross-origin browser use is supported; otherwise document same-origin-only expectation.

### 5.3. NOT VERIFIABLE

#### NV-01 — YAML syntax, duplicate mapping keys and OpenAPI validation result

- `tests/unit/openapi-telegram-auth.test.mjs` uses `parseDocument(source, { uniqueKeys: true })` and asserts parser errors/warnings are empty.
- This test was inspected but not executed. No claim is made that YAML parser or OpenAPI validator passes.
- Static extraction found 79 unique method/path pairs in the spec; it does not detect every possible duplicate YAML mapping key.
- Next test: run the existing parser test in CI and add a standards-compliant OpenAPI validator step.

#### NV-02 — Postman import and generated-client compatibility

- No Postman import or client generation was run.
- Prior audit explicitly left this unverified.
- Several response schemas are description-only; generated-client compatibility cannot be inferred from route parity.
- Next test: import the exact audited commit into Postman/OpenAPI tooling and validate generated request/response models.

#### NV-03 — Exact Telegram Update schema and provider-specific delivery behavior

- The webhook handler checks the Telegram secret header, acknowledges JSON and then branches on Telegram Update fields such as `callback_query` and `message`.
- OpenAPI intentionally uses a generic object with `additionalProperties: true`; the complete provider schema/version was not independently validated.
- SMS-enabled delivery, Telegram Bot API, Web Push and FCM were not invoked.
- Evidence: [tg.js L152-L175](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes/tg.js#L152-L175), [openapi.yaml L1511-L1532](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml#L1511-L1532).
- Tests: auth/Telegram integration tests exercise selected flows; they do not prove the full upstream Update schema or live provider delivery.

#### NV-04 — Runtime response bodies and default Express error serialization

- Source inspection confirms explicit `res.json()` payloads and explicit statuses listed above.
- Runtime serialization, uncaught exceptions, database failure paths and actual content negotiation were not exercised without application startup.
- No runtime output is claimed.

### 5.4. MATCHED (source + test assertions inspected; execution not performed)

| Contract area | Evidence in code | Test evidence | Limitation |
|---|---|---|---|
| Production route/method inventory | 79 route registrations ↔ 79 OpenAPI operations | No general route-parity test | Static inventory only |
| Order idempotency | `POST /api/orders`, optional `client_order_id`, fingerprint and conflict handling | `tests/integration/order-idempotency.test.mjs` covers replay, conflict, concurrency, cross-user isolation and verified-customer guard | Not executed |
| Guest/anonymous chat access | Bearer owner check or 256-bit capability; brand suffix checks | `tests/integration/chat-access-control.test.mjs` covers owner, foreign owner, missing/wrong capability, forged human call and rate limits | Staff chat routes and botlog-first race not covered |
| Upload and client diagnostics limits | `server.js` limited JSON parsers, image checks and per-IP clientlog limiter | `tests/integration/server-upload-clientlog-hardening.test.mjs` covers upload validation, 4 KiB body and rate limit | Not executed |
| Session TTL/logout | `authUser` checks `expires_at`; logout revokes exact bearer token | `tests/integration/session-ttl.test.mjs` covers expiry, logout and delete-all sessions | Not executed |
| Telegram registration polling | random one-time poll token and one-use retrieval | `tests/integration/auth-otp-routes.test.mjs` covers polling, replay and phone lookup isolation | SMS-enabled registration response remains uncovered |

## 6. Проверка тестового покрытия

### 6.1. Relevant integration tests inspected

- `tests/integration/auth-otp-routes.test.mjs`: registration consent, Telegram registration polling, pending activation, OTP login, push cleanup/test, promo redemption and cashier customer lookup.
- `tests/integration/auth-sms-disabled.test.mjs`: disabled SMS feature, Telegram registration branch and OTP request failure when Telegram is unavailable.
- `tests/integration/auth-lockout-enforcement.test.mjs` and `auth-lockout-persistence.test.mjs`: registration/login/activation lockouts and persistence.
- `tests/integration/chat-access-control.test.mjs`: owner and anonymous capability checks, malformed keys/cursors, rate limits, data cleanup.
- `tests/integration/order-idempotency.test.mjs`: order idempotency, replay/conflict, concurrency, guest verification and staff order access.
- `tests/integration/order-test-mode.test.mjs`: production order time/slot constraints.
- `tests/integration/server-upload-clientlog-hardening.test.mjs`: upload and clientlog body/rate limits.
- `tests/integration/session-ttl.test.mjs`: bearer expiry, logout and profile deletion.
- `tests/integration/weekday-lunch-order-pricing.test.mjs`: order pricing and promotion combinations.
- Unit tests inspected: `openapi-telegram-auth.test.mjs`, `auth-validation.test.mjs`, `order-status.test.mjs`, `staff-codes.test.mjs`, `security.test.mjs`.

### 6.2. Coverage gaps and recommended tests

| Finding | Existing coverage | Uncovered contract | Recommended test |
|---|---|---|---|
| C-01/C-02 IDs | Customer ID truthiness; menu unit tests | JSON scalar types and prefixed IDs | Create customer/menu item, assert string IDs and schema consistency |
| C-03 consent | Missing and boolean true | 1/0/false value matrix | Table-driven contract test for accepted/rejected values |
| C-04 SMS registration | SMS disabled + Telegram | SMS enabled response | Stub SMS adapter with flag on; assert `{ok,via:'sms'}` and status |
| C-05 Telegram link | Telegram auth flow | conditional consent field and 409 contract | phone without consent; consent true/1; conflicting Telegram link |
| C-06/C-07 role activation | weak code and lockout behavior | OpenAPI pattern boundaries and Retry-After header | 15/16/64/65 chars; 4-digit guest code; inspect response headers |
| C-08 QR scan | No dedicated route test found | Actual QR length/pattern and authorization | Generated QR succeeds; unknown QR 404; unauthenticated/guest denied |
| C-09 delay | Order status transitions only | delay minute bounds | 0/1/180/181/fraction/missing |
| C-10 status enum | Domain status transition unit tests | OpenAPI enum parity | Assert enum equals server status keys |
| C-11 promo info | No dedicated route test found | optional code and 200 false payload semantics | Missing/unknown/inactive/expired/exhausted/valid cases |
| C-12 promo create | Promo creation exercised indirectly | request schema and 400/409 responses | Required fields, short/duplicate code, role matrix |
| C-13 logout body | Device-scoped logout integration test | OpenAPI requestBody | Assert endpoint/token optional body contract |
| C-14 push subscribe | Valid subscription and cleanup | nested endpoint requirement and 400/401 | Missing sub, missing endpoint, missing bearer |
| C-15 botlog | Capability and forged botlog tests | First botlog before guest send; 409 claim | Race test where botlog arrives first |
| C-16/C-17 error/role matrix | Partial auth/chat/order coverage | Full operation × guard × status matrix | Parameterized contract matrix for public/user/staff/dispatch/admin/anonymous chat |
| S-01 CORS | Node fetch tests | Browser preflight | OPTIONS with `X-Chat-Access-Token` |

### 6.3. Contract-test gap

The existing OpenAPI unit test checks YAML parse errors/duplicate mapping keys and selected Telegram auth properties. It does **not** compare all route registrations with OpenAPI, verify every body/response schema, compare guards, or assert error responses for all operations.

Recommended follow-up test architecture:

1. Route inventory parity test: server route declarations vs OpenAPI method/path pairs.
2. Guard/role contract matrix test for protected operations.
3. Request schema parity tests for the confirmed findings above.
4. Response status/body schema assertions for explicit errors.
5. OpenAPI validation and duplicate-key parsing as separate CI checks.

## 7. Content types, headers and external integrations

### Content types

- Server-wide body parser is `express.json({limit:'10mb'})`.
- `/api/clientlog` and `/api/menu/upload` install route-specific JSON parsers before the global parser.
- Inspected requestBody declarations use `application/json`; no multipart or raw binary endpoint was found.
- Successful route responses use `res.json()`.
- OPTIONS preflight is handled by CORS middleware with 204 and is infrastructure behavior, not a business route in the 79-operation inventory.

### Headers

- Bearer authentication: `Authorization: Bearer ...`.
- Anonymous chat capability: `X-Chat-Access-Token` (CORS allow-list gap is S-01).
- Telegram webhook: `x-telegram-bot-api-secret-token`; no BearerAuth is used.
- Push smoke bypass: `x-smoke-test`; OpenAPI description mentions the behavior but does not declare the header parameter.
- `Retry-After` is set by clientlog/chat rate limit middleware; auth lockout responses inspected here do not consistently set it.

### External integrations

- Incoming webhook: Telegram Bot API → `POST /api/tg/webhook`; shared secret header, JSON Update.
- Outbound Telegram Bot API, SMS provider adapter, Web Push and FCM are server-side integrations invoked by route handlers/services; they are not inbound HTTP API operations in this repository.
- The OpenAPI webhook route correctly declares the secret header and JSON body, but the exact Telegram Update schema and live provider behavior remain NOT VERIFIABLE.

## 8. Приоритеты последующей коррекции

1. **P0 — типы shared response IDs:** исправить `Customer.id` и `MenuItem.id`; эти схемы влияют на множество операций.
2. **P0 — фактический request/response mismatch:** consent, Telegram link conditional consent, registration SMS branch, QR scan pattern, promo info status, chat botlog semantics.
3. **P1 — ограничения и enums:** role activation codes, 4-digit guest activation code, order status enum, delay minutes.
4. **P1 — missing request bodies:** promo creation и logout device cleanup; push subscription nested endpoint.
5. **P1 — error/authorization documentation:** полная матрица 401/403/400/404/409/410/429/503 и явные role descriptions.
6. **P2 — CORS decision:** подтвердить поддержку cross-origin browser clients; добавить header в allow-list или документировать same-origin-only API.
7. **P2 — automated validation:** route parity, OpenAPI validator, Postman import/client generation.

## 9. Финальный вердикт и ограничения

**Вердикт:** OpenAPI route inventory соответствует production router inventory по method/path (79/79), однако контракт нельзя считать полностью согласованным с сервером. Выявлены подтверждённые расхождения в нескольких shared schemas и конкретных операциях, а также системная неполнота error/role documentation.

Не заявляется, что YAML parser, OpenAPI validator, Postman или тесты прошли: они не запускались. Это source-based audit по GitHub API, не runtime verification.

**Изменения:** только этот отчёт в отдельной audit branch. `pizza`, server code, API, tests и `docs/openapi.yaml` не изменялись. PR не создавался; merge/deploy не выполнялись.

## 10. Основные источники

Все ссылки закреплены на audited commit `9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78`:

- [AGENTS.md](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/AGENTS.md)
- [PROJECT_RULES.md](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/PROJECT_RULES.md)
- [docs/read-if-u-ai.md](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/read-if-u-ai.md)
- [docs/api.md](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/api.md)
- [docs/openapi.yaml](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/openapi.yaml)
- [docs/module-map.md](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/module-map.md)
- [docs/documentation-audit-2026-11-07.md](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/docs/documentation-audit-2026-11-07.md)
- [server.js](https://github.com/h0wller/zerno-app/blob/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server.js)
- [server/routes](https://github.com/h0wller/zerno-app/tree/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/routes)
- [server/middleware](https://github.com/h0wller/zerno-app/tree/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/server/middleware)
- [tests/integration](https://github.com/h0wller/zerno-app/tree/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/tests/integration)
- [tests/unit](https://github.com/h0wller/zerno-app/tree/9e0007ad6cefa3a7bd4b2d82a158a4fcb9adbf78/tests/unit)
