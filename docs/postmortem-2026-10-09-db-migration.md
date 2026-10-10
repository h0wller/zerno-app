# Postmortem: Восстановление меню доставки (2026-10-09)

## TL;DR

Прод работал с `/var/www/data/zerno.db` (через `DB_PATH` в `.env`),
а миграции применялись к `/var/www/app/zerno.db` (fallback-файл).
Результат: 70 позиций доставки без фото в API при наличии файлов в git.

## Хронология

- 20:30 — Деплой v349, код свежий, бандл с модификаторами
- 20:45 — Миграция menu из локальной БД → 70|70 в `/var/www/app/zerno.db`
- 21:00 — API `/api/dmenu` отдаёт 0 напитков (RICH, Добрый, Соки)
- 21:08 — Обнаружение: `DB_PATH=/var/www/data/zerno.db` в `.env`
- 21:15 — Миграция в настоящую БД → напитки появились

## Корневая причина

`server/db/connection.js` использует `process.env.DB_PATH || path.join(rootDir, 'zerno.db')`.
pm2 стартует через `npm start` = `node --env-file=.env server.js` → читает `/var/www/data/zerno.db`.
Все диагностики шли в cwd `/var/www/app` → попадали в fallback-файл.

## Решение

1. Бэкап настоящей БД: `sqlite3 /var/www/data/zerno.db ".backup /root/real-prod-before-menu-sync.db"`
2. ATTACH-миграция: `DELETE FROM menu; INSERT ... FROM src.menu;`
3. Переименование decoy: `mv /var/www/app/zerno.db /var/www/app/zerno.db.unused-decoy`
4. Синхронизация meta: `menu_v=4`, `dmenu_v=1` (защита от пересида)

## Профилактика

- Добавить warning в `connection.js` при использовании fallback
- Добавить явный путь БД в `pm2 logs` при старте
- Документировать расположение продакшн-БД в README

## Связанные коммиты

- `0a09f1f` — bump (свежий код с модификаторами)
- `b878a6c` — deploy (reset --hard на сервере)
