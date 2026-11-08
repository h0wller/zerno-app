# Anti-AI-Slop Guardrails

Шесть автоматических барьеров качества в `zerno-app`. Это описание текущей конфигурации, а не исторического плана внедрения.

## Что защищает от чего

| Барьер | Что ловит | Где конфиг |
|---|---|---|
| jscpd (light) | Повторяющиеся блоки в HTML/CSS/MD | `.jscpd.json` |
| jscpd (strict) | Повторяющиеся блоки в JS-логике | `.jscpd.strict.json` |
| Knip | Мёртвый код, неиспользуемые файлы и экспорты | `knip.json` |
| ESLint + SonarJS | Ошибки JS, когнитивную сложность и дубли | `eslint.config.js` |
| ESLint + Playwright | Ошибки в тестах, забытый `await`, `.only` и слабые assertions | `eslint.config.js` |
| dependency-cruiser | Нарушения слоёв, циклы и запрещённые зависимости | `.dependency-cruiser.js` |

## Когда запускаются

`.github/workflows/ci.yml` запускается:
- на каждом `pull_request` без фильтра по целевой ветке;
- на `push` в `main` и `pizza`.

В job `Code Quality & Guardrails` выполняются `check`, `pretest`, `lint:code`, `lint:dup`, `lint:dead`, `lint:layers` и `smoke`. E2E-группы и визуальный capture запускаются отдельными jobs после успешного quality gate.

## Локальный запуск

```bash
npm run lint:code    # ESLint, --max-warnings 50
npm run lint:dup     # jscpd light + strict
npm run lint:dead    # Knip
npm run lint:layers  # dependency-cruiser
npm run audit        # check + pretest + lint + smoke + E2E
```

Точные команды определяются корневым `package.json`. Текущий ESLint-порог — `--max-warnings 50`; это допускаемый предел предупреждений, а не целевой уровень качества.

## Классические скрипты

Четыре файла подключены отдельными классическими `<script defer>` в `public/index.html` и не входят в граф ESM-импортов `public/app/main.js`:

- `public/app/core/address-dict.js`
- `public/app/core/address-autocomplete.js`
- `public/app/core/address-book.js`
- `public/app/core/preorder-timer.js`

Они взаимодействуют с остальным кодом через глобалы и window-контракты.

При добавлении ещё одного классического скрипта обновите все три реестра:
1. `knip.json` → `entry`;
2. `.dependency-cruiser.js` → `no-orphans.from.pathNot`;
3. `eslint.config.js` → блок классических скриптов из `index.html`.

## Пороги и исторические baseline

- jscpd light: порог для повторов в разметке и стилях задан в `.jscpd.json`.
- jscpd strict: порог задан в `.jscpd.strict.json`.
- ESLint: текущий предел — 50 предупреждений из `package.json`.
- Knip и dependency-cruiser: конфигурация и исключения находятся в корневых config-файлах.

Таблица baseline от 2026-10-01 и значения 48/60 ESLint warnings — исторический снимок, не текущая настройка. Номера строк и списки технического долга из того отчёта также исторические; перед работой найдите символ по имени, а не по старому номеру строки. Фактические текущие показатели следует фиксировать только по свежему запуску на конкретном commit SHA.

## Исторический план внедрения

Старый план из четырёх PR, включая `continue-on-error: true`, бюджеты 200 → 100 → 0 и обещание перейти к `--max-warnings 0`, оставлен только как историческая запись. Он не описывает действующий pipeline и не должен использоваться как инструкция для текущей разработки.

## При красном CI

1. **jscpd** — проверить реальный повтор; вынести общую логику или документировать узкое обоснованное исключение.
2. **Knip** — удалить неиспользуемое либо добавить подтверждённый entry/ignore с комментарием.
3. **ESLint/SonarJS** — исправить проблему в исходнике; не снижать порог только ради зелёного CI.
4. **ESLint Playwright** — добавить корректное ожидание и проверку результата, убрать `.only`, не маскировать гонки произвольными задержками.
5. **dependency-cruiser** — исправить направление зависимости или цикл, не расширять allowlist без обоснования.
