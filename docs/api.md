# API zerno-app (черновик v0.1, по клиентским вызовам и роутерам server.js)

Auth: заголовок Authorization: Bearer <token> (localStorage zt_user).
Гарды: userGuard (любой авторизованный), staffGuard (cashier/admin),
dispatchGuard (dispatch/cashier/admin), adminGuard (admin).

## Auth
| Метод | Путь | Тело | Ответ | Гард |
|---|---|---|---|---|
| POST | /api/auth/register | {name, phone, pin?, consent} | {token, customer} / 409 | — |
| POST | /api/auth/login | {phone, pin} | {token, customer} / 409 needPin | — |
| POST | /api/auth/otp-send ? | {phone} | {ok} | — |
| POST | /api/auth/otp-verify ? | {phone, code} | {token, customer} | — |
| GET  | /api/me | — | {customer} | userGuard |
| POST | /api/auth/setup-pin | {pin} | {ok} | userGuard |
| POST | /api/auth/activate-guest | {code} | {customer} | userGuard |
| POST | /api/auth/tg-link ? | initData | {customer, welcome} | userGuard |

## Меню
| GET | /api/menu | — | {items, updatedAt} | — |
| GET | /api/menu/all | — | {items} | adminGuard |
| PUT | /api/menu/:id | {on, price?, img?} | {ok} | adminGuard |
| GET | /api/dmenu ? | — | {items} | — |
| GET | /api/delivery/info | — | {hours, eta, links} | — |
| GET | /api/config | — | {tgUsername, ...} | — |

## Заказы
| POST | /api/orders | {brand, items, sum, ...} | {order} | — |
| GET  | /api/orders | — | {orders} | userGuard |
| GET  | /api/orders/all ? | — | {orders} | dispatchGuard |
| POST | /api/orders/:id/status | {status} | {order} | dispatchGuard |
| POST | /api/orders/:id/delay | {min, reason} | {order} | dispatchGuard |

## Штаmпы / касса (staff)
| POST | /api/staff/customers | {name, phone} | {customer} / 409 | staffGuard |
| GET  | /api/staff/customers?search= | — | {customers} | staffGuard |
| POST | /api/staff/stamp | {phone, delta, drink?} | {customer, last} | staffGuard |
| POST | /api/staff/redeem | {phone} | {customer} | staffGuard |
| POST | /api/staff/scan | {seed} | {customer} | staffGuard |
| GET  | /api/staff/log | — | {log} | staffGuard |
| GET  | /api/staff/pending | — | {list} | staffGuard |

## Чат
| POST | /api/chat/send | {text, ctx} | {msg} | — |
| GET  | /api/chat/thread?ctx= | — | {msgs} | — |
| GET  | /api/chat/list | — | {threads} | staffGuard |
| POST | /api/chat/reply | {ctx, text} | {msg} | staffGuard |
| POST | /api/chat/close | {ctx} | {ok} | staffGuard |

## Пуши / прочее
| GET  | /api/vapid | — | {publicKey} | — |
| POST | /api/push/subscribe | {sub} | {ok} | — |
| GET/POST | /api/promos | ... | ... | adminGuard |
| GET  | /api/stats ? | — | {dash} | adminGuard |
| GET  | /api/health | — | {ok:true} | — |
| POST | /api/clientlog | {kind, msg} | {ok} | — |