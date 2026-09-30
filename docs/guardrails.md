# Anti-AI-Slop Guardrails

Пять автоматических барьеров против «ИИ-слопа» в `zerno-app`.
Запускаются в CI на каждом PR в `main` / push в `pizza`.

## Что защищает от чего

| Барьер | Что ловит | Где конфиг |
|---|---|---|
| jscpd (light) | Скопированные блоки в HTML/CSS/MD | `.jscpd.json` |
| jscpd (strict) | Скопированные блоки в JS-логике | `.jscpd.strict.json` |
| Knip | Мёртвый код, неиспользуемые файлы и экспорты | `knip.json` |
| ESLint + SonarJS | Когнитивная сложность, дубли строк, одинаковые ветки | `eslint.config.js` |
| ESLint + Playwright | Забытый `await`, `.only` в коммите, тесты без ассертов | `eslint.config.js` (tests) |
| dependency-cruiser | Нарушения слоёв, циклы, тест-хелперы в проде | `.dependency-cruiser.js` |

## Локальный запуск

```bash
npm run lint:code    # ESLint
npm run lint:dup     # jscpd (light + strict)
npm run lint:dead    # Knip
npm run lint:layers  # dependency-cruiser
npm run audit        # всё вместе + pretest/css-audit
```

## Классические скрипты (важно)

Пять файлов подключены отдельными `<script defer>` в `public/index.html`
и **не входят в граф импортов `main.js`**:

- `public/app/core/ptr.js`
- `public/app/core/address-dict.js`
- `public/app/core/address-autocomplete.js`
- `public/app/core/address-book.js`
- `public/app/core/preorder-timer.js`

Они общаются с остальным кодом через top-level глобалы и window-шимы.

**При добавлении шестого классического скрипта** — обновить три места:

1. `knip.json` → `entry`
2. `.dependency-cruiser.js` → `no-orphans.from.pathNot`
3. `eslint.config.js` → блок «Классические скрипты из index.html»

## Философия порогов

- **jscpd light**: 10% для вёрстки — карточки и медиа-запросы естественно повторяются.
- **jscpd strict**: 3% целевой для JS. **Стартовое значение — по факту первого прогона.**
- **SonarJS cognitive-complexity**: 25 — компромисс для легаси (`views.js`, `chat-core.js`
  содержат функции с CC 30+). После рефакторинга снизить до 15.
- **Knip** на первом прогоне найдёт много кандидатов — миграция на ESM не завершена.

## Калибровка порогов (baseline)

Перед включением в блокирующий CI замерить фактические значения:

```bash
# jscpd strict — фактический процент
npx jscpd --config .jscpd.strict.json --threshold 100 server/ public/app/

# ESLint — сколько предупреждений
npx eslint public/ server/ scripts/ --format=json | jq '[.[] | .warningCount] | add'

# depcruiser — orphan-warn (после правки pathNot должно быть 0)
npx depcruise --config .dependency-cruiser.js public server

# Knip — сколько в отчёте
npx knip
```

Зафиксировать полученные числа в этом файле (секция «Baseline на дату»)
и выставить стартовые пороги = факт + 1..2.

### Baseline (заполнить после первого прогона)

| Инструмент | Факт | Стартовый порог | Целевой |
|---|---|---|---|
| jscpd strict | _TBD_ | _TBD_ | 3% |
| ESLint warnings | _TBD_ | _TBD_ | 0 |
| Knip candidates | _TBD_ | — | 0 |

## Что делать при красном CI

1. **jscpd** — вынести дубль в общий модуль (`public/app/core/utils.js`
   или `server/utils/*`) или добавить `// jscpd:ignore-start/end` вокруг
   оправданного совпадения.
2. **Knip** — удалить мёртвое или добавить в `entry`/`ignore` с комментарием.
3. **ESLint sonarjs** — разбить функцию, вынести строковый литерал в константу,
   объединить одинаковые ветки.
4. **ESLint playwright** — добавить `await`/ассерт, убрать `.only`,
   не использовать `waitForTimeout`.
5. **dependency-cruiser** — разорвать цикл через общий модуль, перевернуть
   зависимость core↔ui, убрать импорт тестов в прод.

## Бюджет предупреждений ESLint

`--max-warnings` в `package.json` — трекер долга. Спускается по спринтам:

| Этап | Значение | Комментарий |
|---|---|---|
| PR 1 | 200 | Барьеры видны, CI зелёный при легаси-долге |
| +1 спринт | 100 | Половина расчищена |
| +2 спринта | 0 | Ключевые правила переводятся в `error` |

## Порядок внедрения (4 PR)

| PR | Что | CI |
|---|---|---|
| 1 | Конфиги + docs + калибровка | `continue-on-error: true` |
| 2 | OpenAPI-спецификация | без изменений |
| 3 | validate.js + 3 auth-роута + e2e-прогон | без изменений |
| 4 | quality-gates обязателен, `--max-warnings 0` | блокирующий |
