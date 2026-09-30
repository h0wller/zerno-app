#!/usr/bin/env node
// scripts/apply-guardrails.mjs
// Одноразовый bootstrap Anti-AI-Slop guardrails для zerno-app.
//
// Запуск (из корня проекта):
//   node scripts/apply-guardrails.mjs             # применить (создать/пропатчить)
//   node scripts/apply-guardrails.mjs --force     # перезаписать существующие конфиги
//   node scripts/apply-guardrails.mjs --dry-run   # показать план без изменений
//
// Идемпотентен: повторный запуск без --force не перезаписывает уже созданные файлы,
// а в package.json и ci.yml добавляет только отсутствующие фрагменты.

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// ─── Константы ────────────────────────────────────────────────────────

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const DRY = args.has('--dry-run');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m'
};

const log = {
  info: (m) => console.log(`${C.blue}ℹ${C.reset} ${m}`),
  ok:   (m) => console.log(`${C.green}✓${C.reset} ${m}`),
  warn: (m) => console.log(`${C.yellow}⚠${C.reset} ${m}`),
  err:  (m) => console.log(`${C.red}✗${C.reset} ${m}`),
  skip: (m) => console.log(`${C.dim}·${C.reset} ${m}`),
  title: (m) => console.log(`\n${C.bold}${C.cyan}── ${m} ──${C.reset}`)
};

// ─── Содержимое файлов ────────────────────────────────────────────────

const FILE_JSCPD_LIGHT = `{
  "$schema": "https://raw.githubusercontent.com/kucherenko/jscpd/master/packages/jscpd/schema.json",

  "// Вёрстка (HTML/CSS/MD) естественно повторяется: копипаста карточек,": "",
  "// медиа-запросов, шаблонов — не всегда слоп. Допускаем более высокий порог": "",
  "// и более крупные блоки. Плотный контроль логики — в .jscpd.strict.json.": "",
  "format": ["css", "html", "markdown"],
  "minTokens": 120,
  "threshold": 10,
  "reporters": ["console"],
  "absolute": true,
  "gitignore": true,
  "ignore": [
    "**/node_modules/**",
    "public/app/vendor/**",
    "public/app/ui/theme-v2.min.css",
    "public/jsqr.js",
    "public/qrcode.js",
    "public/qrcode.min.js",
    "public/debug.js",
    "**/*.db",
    "**/*.db-shm",
    "**/*.db-wal",
    "**/*.log",
    "logs/**",
    "tests/**",
    "screens/**",
    "artifacts/**",
    "test-results/**",
    "playwright-report/**",
    "fix_views.py"
  ]
}
`.replace(/^\s*"\/\/[^\n]*":\s*"",\n/gm, ''); // чистим placeholder-ключи выше

const FILE_JSCPD_STRICT = `{
  "$schema": "https://raw.githubusercontent.com/kucherenko/jscpd/master/packages/jscpd/schema.json",

  "// Логика сервера и ESM-модули фронта. threshold — стартовое целевое значение;": "",
  "// фактический уровень фиксируется после первого калибровочного прогона (см. docs/guardrails.md).": "",
  "format": ["javascript"],
  "minTokens": 40,
  "threshold": 3,
  "reporters": ["console"],
  "absolute": true,
  "gitignore": true,
  "ignore": [
    "**/node_modules/**",
    "public/app/vendor/**",
    "public/jsqr.js",
    "public/qrcode.js",
    "public/qrcode.min.js",
    "public/debug.js",

    "public/app/core/views.js",
    "public/app/ui/styles.js",

    "server/db/schema.js",
    "server/db/seed.js",

    "scripts/fetch-streets.mjs",
    "scripts/fix-*.mjs",
    "scripts/move-*.mjs",
    "tests/**"
  ]
}
`.replace(/^\s*"\/\/[^\n]*":\s*"",\n/gm, '');

const FILE_KNIP = `{
  "$schema": "https://unpkg.com/knip@5/schema.json",

  "entry": [
    "server.js",
    "public/app/main.js",
    "public/sw.js",

    "// ⚠️ Классические скрипты: подключены отдельными <script defer> в public/index.html": "",
    "// и не входят в граф импортов main.js. Без них Knip пометит их как мёртвый код.": "",
    "public/app/core/ptr.js",
    "public/app/core/address-dict.js",
    "public/app/core/address-autocomplete.js",
    "public/app/core/address-book.js",
    "public/app/core/preorder-timer.js",

    "test-api.mjs",
    "tests/*.spec.js",
    "scripts/contract-smoke.mjs",
    "scripts/css-audit.mjs",
    "scripts/fetch-streets.mjs",
    "scripts/probe-tg-webhook.mjs",
    "scripts/test-tg-suite.mjs",
    "scripts/tg-native-ux.mjs"
  ],

  "project": [
    "server/**/*.js",
    "public/app/**/*.js",
    "scripts/**/*.mjs",
    "tests/**/*.js"
  ],

  "ignore": [
    "public/app/vendor/**",
    "public/jsqr.js",
    "public/qrcode.js",
    "public/qrcode.min.js",
    "public/debug.js",
    "scripts/fix-*.mjs",
    "scripts/move-*.mjs",
    "fix_views.py"
  ],

  "ignoreDependencies": ["@capacitor/*"],

  "// Модули держат экспорты, которые читаются голым идентификатором из window-контракта.": "",
  "ignoreExportsUsedInFile": true
}
`.replace(/^\s*"\/\/[^\n]*":\s*"",\n/gm, '');

const FILE_ESLINT = `// eslint.config.js
// Flat Config (ESLint v9+). Три «слоя»: сервер / фронт / e2e + классические скрипты.
// Цель — ловить ИИ-слоп: копипастные ветки, раздутые функции, разорванные await.

import js from '@eslint/js';
import sonarjs from 'eslint-plugin-sonarjs';
import playwright from 'eslint-plugin-playwright';
import globals from 'globals';

// Фронт держит часть контрактов на window.* (state.js, catalog.js, catalog-cashier и т.д.).
// no-undef на ESM-фронте выключен осознанно: иначе ESLint зафлагает каждый window-контракт.
const browserGlobals = {
  ...globals.browser,
  ...globals.serviceworker,
  Telegram: 'readonly',
  TelegramWebAppProxy: 'readonly',
  TelegramGameProxy: 'readonly',
  qrcode: 'readonly',
  jsQR: 'readonly'
};

const nodeGlobals = { ...globals.node, ...globals.es2024 };

export default [
  {
    ignores: [
      'node_modules/**',
      'artifacts/**',
      'test-results/**',
      'playwright-report/**',
      'public/app/vendor/**',
      'public/jsqr.js',
      'public/qrcode.js',
      'public/qrcode.min.js',
      'public/app/ui/theme-v2.min.css',
      'public/debug.js',
      'scripts/fix-*.mjs',
      'scripts/move-*.mjs',
      'fix_views.py',
      'screens/**'
    ]
  },

  js.configs.recommended,

  // ── Сервер: Node 22, ESM ──────────────────────────────────────────
  {
    files: ['server/**/*.js', 'server.js', 'scripts/**/*.mjs', 'test-api.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: nodeGlobals
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'smart'],
      'no-return-await': 'warn'
    }
  },

  // ── Фронт: Vanilla JS ESM + SonarJS ──────────────────────────────
  {
    files: ['public/app/**/*.js', 'public/sw.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: browserGlobals
    },
    plugins: { sonarjs },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-implicit-globals': 'error',
      'prefer-const': 'warn',
      'no-restricted-globals': [
        'warn',
        { name: 'event', message: 'Неявный window.event — используйте параметр e.' }
      ],

      'sonarjs/cognitive-complexity': ['warn', 25],
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-all-duplicated-branches': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',
      'sonarjs/no-collapsible-if': 'warn',
      'sonarjs/no-redundant-boolean': 'warn',
      'sonarjs/no-useless-catch': 'warn',
      'sonarjs/no-inverted-boolean-check': 'warn',
      'sonarjs/prefer-immediate-return': 'warn',
      'sonarjs/no-nested-template-literals': 'warn'
    }
  },

  // ── Классические скрипты из index.html (НЕ ESM-модули) ──────────
  // Подключены отдельными <script defer> в public/index.html и общаются с остальным
  // кодом через top-level глобалы (init, renderTimers, normStreet, ...) и window-шимы
  // других модулей ($, api, me, syncOverlay). Осознанная архитектура до ESM-этапа.
  //
  // no-implicit-globals выключен: в sourceType:'script' КАЖДАЯ top-level function/var
  // считается неявным глобалом — их ~60 по пяти файлам.
  // no-undef выключен: $ / api / me / syncOverlay / cart — window-шимы из utils.js,
  // ui.js, state.js, catalog.js, которых нет в browserGlobals.
  //
  // sonarjs/* и no-unused-vars/prefer-const наследуются от общего блока
  // public/app/**/*.js (правила мерджатся, не перезаписываются).
  {
    files: [
      'public/app/core/ptr.js',
      'public/app/core/address-dict.js',
      'public/app/core/address-autocomplete.js',
      'public/app/core/address-book.js',
      'public/app/core/preorder-timer.js'
    ],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: browserGlobals
    },
    rules: {
      'no-implicit-globals': 'off',
      'no-undef': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'prefer-const': 'warn'
    }
  },

  // ── Playwright (e2e) ─────────────────────────────────────────────
  {
    files: ['tests/**/*.js', 'tests/**/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...nodeGlobals, ...browserGlobals }
    },
    plugins: { playwright },
    rules: {
      ...playwright.configs['flat/recommended'].rules,

      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': 'warn',
      'playwright/missing-playwright-await': 'error',
      'playwright/valid-expect': 'error',
      'playwright/expect-expect': 'error',
      'playwright/no-eval': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/no-element-handle': 'warn',
      'playwright/no-wait-for-timeout': 'warn',
      'playwright/no-conditional-in-test': 'warn'
    }
  },

  {
    files: ['playwright.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: nodeGlobals }
  }
];
`;

const FILE_DEPCRUISER = `// .dependency-cruiser.js
// Правила однонаправленности зависимостей. «Стрелка вверх» = нарушение.
//
// Архитектура:
//   server/  ← isolated runtime, никогда не знает про фронт
//   public/app/ui/  →  public/app/core/   (только «вниз»)
//   public/app/*.js →  public/app/core/   (модули фич поверх ядра)
//   tests/ scripts/ →  любой код, но никто не импортирует их в прод

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'no-server-to-frontend',
      severity: 'error',
      comment:
        'Сервер (server/) не может импортировать фронтенд-код (public/): ' +
        'это разные среды (Node.js vs браузер) — слои обязаны быть однонаправленными.',
      from: { path: '^server/' },
      to: { path: '^public/' }
    },

    {
      name: 'no-core-to-ui',
      severity: 'error',
      comment:
        'Ядро (public/app/core/) не должно импортировать UI-модули (public/app/ui/): ' +
        'UI знает про core, core про UI — нет.',
      from: { path: '^public/app/core/' },
      to: { path: '^public/app/ui/' }
    },

    {
      name: 'no-test-helpers-in-prod',
      severity: 'error',
      comment:
        'Тестовые хелперы/моки (tests/, scripts/) не должны попадать в прод-код: ' +
        'иначе прод тащит мок-данные и тест-утилиты.',
      from: { pathNot: '^(tests|scripts)/' },
      to: { path: '^(tests|scripts)/' }
    },

    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Циклические импорты ломают ESM: TDZ (Cannot access X before initialization). ' +
        'Разрывайте общий код в отдельный модуль, а не замыкайте граф.',
      from: {},
      to: { circular: true }
    },

    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        'Модуль не подключён ни к одному графу импортов — вероятный мёртвый код ' +
        'или забытая регистрация в main.js.',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)public/sw\\\\.js$',
          '(^|/)public/debug\\\\.js$',
          // ⚠️ Классические скрипты из index.html — вне графа импортов, но живые:
          '(^|/)public/app/core/(ptr|address-dict|address-autocomplete|address-book|preorder-timer)\\\\.js$',
          '\\\\.d\\\\.ts$'
        ]
      },
      to: {}
    }
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: 'node_modules|\\\\.min\\\\.js$|^public/app/vendor/'
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'browser']
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/[^/]+' },
      archi: { collapsePattern: '^(node_modules|public|server|scripts|tests)/[^/]+' },
      text: { highlightFocused: true }
    }
  }
};
`;

const FILE_VALIDATE = `// server/middleware/validate.js
// Лёгкий контракт-валидатор тел запросов. Ноль внешних зависимостей.
//
// Задача — не заменить JSON Schema, а поставить дешёвый барьер против слопа в API:
// неизвестные поля, отсутствующие required, не тот тип. Схемы — source of truth
// для docs/openapi.yaml.
//
// Внедряется инкрементально: сначала только auth-роуты (login/register/setup-pin).
// Для волатильных роутов (/orders, /chat/send) — opts.strict:false, чтобы фронт
// не отваливался на каждом новом поле.

const TYPE_CHECK = {
  string:  (v) => typeof v === 'string',
  number:  (v) => typeof v === 'number' && Number.isFinite(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === 'boolean',
  object:  (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  array:   (v) => Array.isArray(v)
};

function describeType(expected, actual) {
  if (Array.isArray(actual)) return expected + ' (получен array)';
  if (actual === null) return expected + ' (получен null)';
  return expected + ' (получен ' + typeof actual + ')';
}

export function validate(schema, opts = {}) {
  const strict = opts.strict !== false;
  const fields = Object.entries(schema);

  return function validateBody(req, res, next) {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Тело запроса должно быть объектом' });
    }

    for (const [key, rule] of fields) {
      const value = body[key];

      if (value === undefined || value === null || value === '') {
        if (rule.required) {
          return res.status(400).json({ error: 'Поле «' + key + '» обязательно' });
        }
        continue;
      }

      const check = TYPE_CHECK[rule.type];
      if (check && !check(value)) {
        return res.status(400).json({ error: 'Поле «' + key + '»: ожидалось ' + describeType(rule.type, value) });
      }

      if (rule.max && typeof value === 'string' && value.length > rule.max) {
        return res.status(400).json({ error: 'Поле «' + key + '»: длина превышает ' + rule.max });
      }
      if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
        return res.status(400).json({ error: 'Поле «' + key + '»: значение меньше ' + rule.min });
      }
      if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
        return res.status(400).json({ error: 'Поле «' + key + '»: значение больше ' + rule.max });
      }
      if (rule.enum && !rule.enum.includes(value)) {
        return res.status(400).json({ error: 'Поле «' + key + '»: допустимые значения — ' + rule.enum.join(', ') });
      }
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        return res.status(400).json({ error: 'Поле «' + key + '»: не соответствует формату' });
      }
    }

    if (strict) {
      const allowed = new Set(Object.keys(schema));
      for (const key of Object.keys(body)) {
        if (!allowed.has(key) && !key.startsWith('_')) {
          return res.status(400).json({ error: 'Неизвестное поле «' + key + '»' });
        }
      }
    }

    next();
  };
}
`;

const FILE_GUARDRAILS_DOC = `# Anti-AI-Slop Guardrails

Пять автоматических барьеров против «ИИ-слопа» в \`zerno-app\`.
Запускаются в CI на каждом PR в \`main\` / push в \`pizza\`.

## Что защищает от чего

| Барьер | Что ловит | Где конфиг |
|---|---|---|
| jscpd (light) | Скопированные блоки в HTML/CSS/MD | \`.jscpd.json\` |
| jscpd (strict) | Скопированные блоки в JS-логике | \`.jscpd.strict.json\` |
| Knip | Мёртвый код, неиспользуемые файлы и экспорты | \`knip.json\` |
| ESLint + SonarJS | Когнитивная сложность, дубли строк, одинаковые ветки | \`eslint.config.js\` |
| ESLint + Playwright | Забытый \`await\`, \`.only\` в коммите, тесты без ассертов | \`eslint.config.js\` (tests) |
| dependency-cruiser | Нарушения слоёв, циклы, тест-хелперы в проде | \`.dependency-cruiser.js\` |

## Локальный запуск

\`\`\`bash
npm run lint:code    # ESLint
npm run lint:dup     # jscpd (light + strict)
npm run lint:dead    # Knip
npm run lint:layers  # dependency-cruiser
npm run audit        # всё вместе + pretest/css-audit
\`\`\`

## Классические скрипты (важно)

Пять файлов подключены отдельными \`<script defer>\` в \`public/index.html\`
и **не входят в граф импортов \`main.js\`**:

- \`public/app/core/ptr.js\`
- \`public/app/core/address-dict.js\`
- \`public/app/core/address-autocomplete.js\`
- \`public/app/core/address-book.js\`
- \`public/app/core/preorder-timer.js\`

Они общаются с остальным кодом через top-level глобалы и window-шимы.

**При добавлении шестого классического скрипта** — обновить три места:

1. \`knip.json\` → \`entry\`
2. \`.dependency-cruiser.js\` → \`no-orphans.from.pathNot\`
3. \`eslint.config.js\` → блок «Классические скрипты из index.html»

## Философия порогов

- **jscpd light**: 10% для вёрстки — карточки и медиа-запросы естественно повторяются.
- **jscpd strict**: 3% целевой для JS. **Стартовое значение — по факту первого прогона.**
- **SonarJS cognitive-complexity**: 25 — компромисс для легаси (\`views.js\`, \`chat-core.js\`
  содержат функции с CC 30+). После рефакторинга снизить до 15.
- **Knip** на первом прогоне найдёт много кандидатов — миграция на ESM не завершена.

## Калибровка порогов (baseline)

Перед включением в блокирующий CI замерить фактические значения:

\`\`\`bash
# jscpd strict — фактический процент
npx jscpd --config .jscpd.strict.json --threshold 100 server/ public/app/

# ESLint — сколько предупреждений
npx eslint public/ server/ scripts/ --format=json | jq '[.[] | .warningCount] | add'

# depcruiser — orphan-warn (после правки pathNot должно быть 0)
npx depcruise --config .dependency-cruiser.js public server

# Knip — сколько в отчёте
npx knip
\`\`\`

Зафиксировать полученные числа в этом файле (секция «Baseline на дату»)
и выставить стартовые пороги = факт + 1..2.

### Baseline (заполнить после первого прогона)

| Инструмент | Факт | Стартовый порог | Целевой |
|---|---|---|---|
| jscpd strict | _TBD_ | _TBD_ | 3% |
| ESLint warnings | _TBD_ | _TBD_ | 0 |
| Knip candidates | _TBD_ | — | 0 |

## Что делать при красном CI

1. **jscpd** — вынести дубль в общий модуль (\`public/app/core/utils.js\`
   или \`server/utils/*\`) или добавить \`// jscpd:ignore-start/end\` вокруг
   оправданного совпадения.
2. **Knip** — удалить мёртвое или добавить в \`entry\`/\`ignore\` с комментарием.
3. **ESLint sonarjs** — разбить функцию, вынести строковый литерал в константу,
   объединить одинаковые ветки.
4. **ESLint playwright** — добавить \`await\`/ассерт, убрать \`.only\`,
   не использовать \`waitForTimeout\`.
5. **dependency-cruiser** — разорвать цикл через общий модуль, перевернуть
   зависимость core↔ui, убрать импорт тестов в прод.

## Бюджет предупреждений ESLint

\`--max-warnings\` в \`package.json\` — трекер долга. Спускается по спринтам:

| Этап | Значение | Комментарий |
|---|---|---|
| PR 1 | 200 | Барьеры видны, CI зелёный при легаси-долге |
| +1 спринт | 100 | Половина расчищена |
| +2 спринта | 0 | Ключевые правила переводятся в \`error\` |

## Порядок внедрения (4 PR)

| PR | Что | CI |
|---|---|---|
| 1 | Конфиги + docs + калибровка | \`continue-on-error: true\` |
| 2 | OpenAPI-спецификация | без изменений |
| 3 | validate.js + 3 auth-роута + e2e-прогон | без изменений |
| 4 | quality-gates обязателен, \`--max-warnings 0\` | блокирующий |
`;

const FILE_OPENAPI = `openapi: 3.0.3

info:
  title: zerno-app API
  version: 0.2.0
  description: |
    Контракт API PWA «…и кофе» / «Пятница». Собран из docs/api.md
    и фактических роутов server/routes/*.js. Источник правды — серверный код.
    При расхождении — правьте спеку и server/routes/* в одном PR.
  contact:
    name: Zerno App
    url: https://app.andcoffee.online

servers:
  - url: https://app.andcoffee.online
    description: Production
  - url: http://localhost:3000
    description: Local dev

tags:
  - name: Auth
  - name: Menu
  - name: Orders
  - name: Staff
  - name: Chat
  - name: Push
  - name: Admin
  - name: System

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      description: 'Authorization: Bearer <token из localStorage zt_user>'

  schemas:
    Customer:
      type: object
      required: [id, name, phone, stamps, free, cups, role]
      properties:
        id:          { type: integer, minimum: 1 }
        name:        { type: string, maxLength: 24 }
        phone:       { type: string, pattern: '^\\\\+7\\\\d{10}$' }
        stamps:      { type: integer, minimum: 0, maximum: 10 }
        free:        { type: integer, minimum: 0 }
        cups:        { type: integer, minimum: 0 }
        qr:          { type: string, description: 'Код Z-XXXXXX' }
        role:        { type: string, enum: [guest, cashier, dispatch, admin] }
        verified:    { type: integer, enum: [0, 1] }
        welcome:     { type: integer, enum: [0, 1] }
        tg:          { type: integer, enum: [0, 1] }
        # Добавлено после сверки с server/domain/helpers.js::cust()
        notify_tg:   { type: integer, enum: [0, 1] }
        notify_web:  { type: integer, enum: [0, 1] }
        history:
          type: array
          items:
            type: object
            properties:
              ts: { type: string, format: date-time }
              a:  { type: string }
              by: { type: string }
      additionalProperties: true

    MenuItem:
      type: object
      required: [id, cat, name, price]
      properties:
        id:      { type: integer }
        cat:     { type: string, enum: [coffee, drinks, food, pizza, rolls, snacks] }
        e:       { type: string }
        name:    { type: string, maxLength: 40 }
        desc:    { type: string, maxLength: 140 }
        comp:    { type: array, items: { type: string } }
        vol:     { type: string, maxLength: 14 }
        price:   { type: number, minimum: 0 }
        tag:     { type: string }
        coffee:  { type: integer, enum: [0, 1] }
        on:      { type: integer, enum: [0, 1] }
        img:     { type: string }
        section: { type: string, enum: [coffee, delivery] }
      additionalProperties: true

    Error:
      type: object
      required: [error]
      properties:
        error: { type: string }
        code:  { type: string }

  responses:
    Unauthorized:
      description: Токен отсутствует или недействителен
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    Forbidden:
      description: Недостаточно прав
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }

paths:
  /api/health:
    get:
      tags: [System]
      summary: Health-check
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties: { ok: { type: boolean } }

  /api/config:
    get:
      tags: [System]
      summary: Публичный bootstrap-конфиг
      responses:
        '200': { description: OK }

  /api/clientlog:
    post:
      tags: [System]
      summary: Лог клиентских событий
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [kind, msg]
              properties:
                kind: { type: string }
                msg:  { type: string, maxLength: 500 }
      responses: { '200': { description: OK } }

  /api/auth/register:
    post:
      tags: [Auth]
      summary: Регистрация нового гостя
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, phone, consent]
              properties:
                name:    { type: string, maxLength: 24 }
                phone:   { type: string }
                pin:     { type: string, pattern: '^\\\\d{4}$' }
                consent: { type: integer, enum: [0, 1] }
      responses:
        '200':
          description: Профиль создан
          content:
            application/json:
              schema:
                type: object
                properties:
                  token:    { type: string }
                  customer: { $ref: '#/components/schemas/Customer' }
        '409': { description: Профиль уже существует }

  /api/auth/login:
    post:
      tags: [Auth]
      summary: Вход по телефону и PIN
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [phone]
              properties:
                phone: { type: string }
                pin:   { type: string, pattern: '^\\\\d{4}$' }
      responses:
        '200': { description: OK }
        '409': { description: 'Требуется PIN (needPin)' }

  /api/auth/setup-pin:
    post:
      tags: [Auth]
      summary: Установить/сменить PIN
      security: [{ BearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [pin]
              properties: { pin: { type: string, pattern: '^\\\\d{4}$' } }
      responses: { '200': { description: OK } }

  /api/auth/activate-guest:
    post:
      tags: [Auth]
      summary: Активация гостя по коду от кассира
      security: [{ BearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [code]
              properties: { code: { type: string } }
      responses: { '200': { description: OK } }

  /api/auth/tg-link:
    post:
      tags: [Auth]
      summary: Привязка Telegram initData
      security: [{ BearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [initData]
              properties: { initData: { type: string } }
      responses: { '200': { description: OK } }

  /api/me:
    get:
      tags: [Auth]
      summary: Текущий пользователь
      security: [{ BearerAuth: [] }]
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties: { customer: { $ref: '#/components/schemas/Customer' } }
        '401': { $ref: '#/components/responses/Unauthorized' }

  /api/menu:
    get:
      tags: [Menu]
      summary: Публичное меню кофейни
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:     { type: array, items: { $ref: '#/components/schemas/MenuItem' } }
                  updatedAt: { type: string, format: date-time }

  /api/menu/all:
    get:
      tags: [Menu]
      summary: Всё меню, включая выключенные позиции (admin)
      security: [{ BearerAuth: [] }]
      responses:
        '200': { description: OK }
        '403': { $ref: '#/components/responses/Forbidden' }

  /api/dmenu:
    get:
      tags: [Menu]
      summary: Меню доставки «Пятница»
      responses: { '200': { description: OK } }

  /api/delivery/info:
    get:
      tags: [Menu]
      summary: Конфиг доставки (часы, ETA, ссылки)
      responses: { '200': { description: OK } }

  /api/orders:
    post:
      tags: [Orders]
      summary: Создание заказа
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [brand, items, sum]
              properties:
                brand: { type: string, enum: [coffee, delivery] }
                items: { type: array, items: { type: object } }
                sum:   { type: number, minimum: 0 }
              additionalProperties: true
      responses: { '200': { description: OK } }
    get:
      tags: [Orders]
      summary: Мои заказы
      security: [{ BearerAuth: [] }]
      responses:
        '200': { description: OK }
        '401': { $ref: '#/components/responses/Unauthorized' }

  /api/orders/all:
    get:
      tags: [Orders]
      summary: Все заказы (dispatch)
      security: [{ BearerAuth: [] }]
      responses:
        '200': { description: OK }
        '403': { $ref: '#/components/responses/Forbidden' }

  /api/staff/stamp:
    post:
      tags: [Staff]
      summary: Пробить штамп
      security: [{ BearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [phone]
              properties:
                phone: { type: string }
                delta: { type: integer }
                drink: { type: string }
      responses: { '200': { description: OK } }

  /api/staff/redeem:
    post:
      tags: [Staff]
      summary: Списать бесплатный кофе
      security: [{ BearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [phone]
              properties: { phone: { type: string } }
      responses: { '200': { description: OK } }

  /api/staff/scan:
    post:
      tags: [Staff]
      summary: Скан QR гостя
      security: [{ BearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [seed]
              properties: { seed: { type: string } }
      responses: { '200': { description: OK } }

  /api/chat/send:
    post:
      tags: [Chat]
      summary: Отправить сообщение в чат
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [text]
              properties:
                text: { type: string, maxLength: 2000 }
                ctx:  { type: string }
              additionalProperties: true
      responses: { '200': { description: OK } }

  /api/chat/thread:
    get:
      tags: [Chat]
      summary: Получить тред чата
      parameters:
        - in: query
          name: ctx
          schema: { type: string }
      responses: { '200': { description: OK } }

  /api/vapid:
    get:
      tags: [Push]
      summary: VAPID public key
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties: { publicKey: { type: string } }

  /api/push/subscribe:
    post:
      tags: [Push]
      summary: Подписка на web-push
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [sub]
              properties: { sub: { type: object } }
      responses: { '200': { description: OK } }

  /api/promos:
    get:
      tags: [Admin]
      summary: Список промокодов
      security: [{ BearerAuth: [] }]
      responses: { '200': { description: OK } }
    post:
      tags: [Admin]
      summary: Создать промокод
      security: [{ BearerAuth: [] }]
      responses: { '200': { description: OK } }

  /api/stats:
    get:
      tags: [Admin]
      summary: Дашборд владельца
      security: [{ BearerAuth: [] }]
      responses: { '200': { description: OK } }
`;

// ─── Утилиты ──────────────────────────────────────────────────────────

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function writeFile(filePath, content, opts = {}) {
  const abs = path.resolve(ROOT, filePath);
  const dir = path.dirname(abs);
  await fs.mkdir(dir, { recursive: true });

  const already = await exists(abs);

  if (already && !opts.force && !opts.append) {
    log.skip(`${filePath} — уже существует (пропущено; перезапись: --force)`);
    return { created: false, skipped: true };
  }

  if (DRY) {
    log.info(`[DRY] ${already ? 'перезапись' : 'создание'} ${filePath}`);
    return { created: true, dry: true };
  }

  if (already && opts.backup !== false) {
    const bak = `${abs}.bak`;
    await fs.copyFile(abs, bak);
    log.info(`Бэкап: ${path.relative(ROOT, bak)}`);
  }

  await fs.writeFile(abs, content, 'utf8');
  log.ok(`${filePath}`);
  return { created: true };
}

// ─── Патч package.json ────────────────────────────────────────────────

const PKG_SCRIPTS_TO_ADD = {
  'lint:code': 'eslint public/ server/ scripts/ --max-warnings 200',
  'lint:dup': 'jscpd --config .jscpd.json public/ && jscpd --config .jscpd.strict.json server/ public/app/',
  'lint:dead': 'knip',
  'lint:layers': 'depcruise --config .dependency-cruiser.js public server',
  'audit': 'npm run check && npm run pretest && npm run lint:code && npm run lint:dup && npm run lint:dead && npm run lint:layers'
};

const PKG_DEVDEPS_TO_ADD = {
  '@eslint/js': '^9.15.0',
  'dependency-cruiser': '^16.5.0',
  'eslint': '^9.15.0',
  'eslint-plugin-playwright': '^2.1.0',
  'eslint-plugin-sonarjs': '^3.0.1',
  'globals': '^15.12.0',
  'jscpd': '^4.0.5',
  'knip': '^5.40.0'
};

async function patchPackageJson() {
  const file = path.resolve(ROOT, 'package.json');
  if (!(await exists(file))) {
    log.err('package.json не найден — патч пропущен');
    return;
  }

  const raw = await fs.readFile(file, 'utf8');
  const pkg = JSON.parse(raw);

  pkg.scripts = pkg.scripts || {};
  pkg.devDependencies = pkg.devDependencies || {};

  let touchedScripts = 0;
  for (const [k, v] of Object.entries(PKG_SCRIPTS_TO_ADD)) {
    if (!pkg.scripts[k]) { pkg.scripts[k] = v; touchedScripts++; }
  }

  let touchedDeps = 0;
  for (const [k, v] of Object.entries(PKG_DEVDEPS_TO_ADD)) {
    if (!pkg.devDependencies[k]) { pkg.devDependencies[k] = v; touchedDeps++; }
  }

  if (!touchedScripts && !touchedDeps) {
    log.skip('package.json — все скрипты и зависимости уже на месте');
    return;
  }

  if (DRY) {
    log.info(`[DRY] package.json: +${touchedScripts} scripts, +${touchedDeps} devDeps`);
    return;
  }

  await fs.copyFile(file, `${file}.bak`);
  log.info(`Бэкап: ${path.relative(ROOT, file)}.bak`);

  await fs.writeFile(file, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  log.ok(`package.json — +${touchedScripts} scripts, +${touchedDeps} devDependencies`);
}

// ─── Патч .github/workflows/ci.yml ────────────────────────────────────

const CI_JOB_BLOCK = `  quality-gates:
    runs-on: ubuntu-latest
    # Параллельно server-checks: синтаксис server.js и API-самотесты
    # не влияют на статические проверки. Экономит время пайплайна.
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Anti-AI-Slop quality gates
        # Агрегатор: check + pretest(css-audit) + ESLint + jscpd + knip + depcruise
        run: npm run audit
        # PR 1: мягкий режим. В PR 4 убрать строку — audit станет блокирующим.
        continue-on-error: true`;

async function patchCiYml() {
  const file = path.resolve(ROOT, '.github/workflows/ci.yml');
  if (!(await exists(file))) {
    log.warn('.github/workflows/ci.yml не найден — патч пропущен');
    return;
  }

  const raw = await fs.readFile(file, 'utf8');

  // 1. Сохраняем стиль переводов строк файла (LF или CRLF).
  const isCRLF = raw.includes('\r\n');
  const NL = isCRLF ? '\r\n' : '\n';

  // 2. Идемпотентность: ищем строку 'quality-gates:' в любом месте файла.
  //    \s* съест CRLF-хвост благодаря флагу m, но для надёжности — простой регекс.
  if (/^\s*quality-gates:\s*$/m.test(raw.replace(/\r/g, ''))) {
    log.skip('ci.yml — job quality-gates уже существует');
    return;
  }

  // 3. Приводим блок к стилю файла.
  const jobBlock = CI_JOB_BLOCK.replace(/\n/g, NL);

  // 4. Несколько якорей по приоритету: e2e → contract → конец файла.
  //    Все регулярки чувствительны к NL-стилю и допускают смешанную отбивку.
  const anchorPatterns = [
    { name: 'before-e2e',      re: new RegExp(`(^|${NL})  e2e:`) },
    { name: 'before-contract', re: new RegExp(`(^|${NL})  contract:`) },
    { name: 'before-deploy',   re: new RegExp(`(^|${NL})  deploy:`) },
    { name: 'append-end',      re: null }
  ];

  let chosen = null;
  let insertAt = -1;

  for (const a of anchorPatterns) {
    if (!a.re) { chosen = a; break; }
    const m = raw.match(a.re);
    if (m) {
      // Начало совпадения + длина захваченного NL (если был) — встаём
      // точно перед строкой "  e2e:" или "  contract:".
      insertAt = m.index + (m[1] ? m[1].length : 0);
      chosen = a;
      break;
    }
  }

  if (DRY) {
    log.info(`[DRY] ci.yml — вставка job quality-gates (якорь: ${chosen.name}, NL: ${isCRLF ? 'CRLF' : 'LF'})`);
    return;
  }

  // 5. Бэкап.
  await fs.copyFile(file, `${file}.bak`);
  log.info(`Бэкап: ${path.relative(ROOT, file)}.bak`);

  // 6. Сборка итогового текста.
  let patched;
  if (chosen.name === 'append-end') {
    // Гарантируем один завершающий NL и добавляем блок + завершающий NL.
    const trimmed = raw.replace(/(\r?\n)*$/, '');
    patched = trimmed + NL + NL + jobBlock + NL;
  } else {
    // Вставляем "\n<block>\n" ровно перед якорем.
    // Пустая строка сверху и снизу — гарантированно корректный YAML.
    const insert = NL + jobBlock + NL;
    patched = raw.slice(0, insertAt) + insert + raw.slice(insertAt);
  }

  await fs.writeFile(file, patched, 'utf8');
  log.ok(`ci.yml — job quality-gates добавлен (якорь: ${chosen.name}, NL: ${isCRLF ? 'CRLF' : 'LF'})`);
}

// ─── main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`${C.bold}Anti-AI-Slop guardrails bootstrap${C.reset}`);
  console.log(`${C.dim}корень: ${ROOT}${C.reset}`);
  if (DRY) console.log(`${C.yellow}режим: --dry-run (ничего не пишется)${C.reset}`);
  if (FORCE) console.log(`${C.yellow}режим: --force (перезапись конфигов)${C.reset}`);
  console.log('');

  log.title('1. Новые файлы конфигураций');
  await writeFile('.jscpd.json', FILE_JSCPD_LIGHT);
  await writeFile('.jscpd.strict.json', FILE_JSCPD_STRICT);
  await writeFile('knip.json', FILE_KNIP);
  await writeFile('eslint.config.js', FILE_ESLINT);
  await writeFile('.dependency-cruiser.js', FILE_DEPCRUISER);

  log.title('2. Runtime и документация');
  await writeFile('server/middleware/validate.js', FILE_VALIDATE);
  await writeFile('docs/openapi.yaml', FILE_OPENAPI);
  await writeFile('docs/guardrails.md', FILE_GUARDRAILS_DOC);

  log.title('3. Патч package.json');
  await patchPackageJson();

  log.title('4. Патч .github/workflows/ci.yml');
  await patchCiYml();

  log.title('Готово');
  if (DRY) {
    console.log(`${C.yellow}--dry-run: ничего не изменено. Запустите без флага для применения.${C.reset}`);
    return;
  }

  console.log(`
${C.bold}Следующие шаги:${C.reset}

  1. ${C.cyan}npm install${C.reset}                       # поставить 8 новых devDependencies
  2. ${C.cyan}git add package-lock.json${C.reset}         # зафиксировать lockfile — иначе CI упадёт на npm ci
  3. ${C.cyan}node scripts/apply-guardrails.mjs --dry-run${C.reset}  # проверить идемпотентность (все SKIP)
  4. ${C.cyan}npm run lint:code${C.reset}                 # замер baseline warnings ESLint
  5. ${C.cyan}npx jscpd --config .jscpd.strict.json --threshold 100 server/ public/app/${C.reset}
                                        # замер baseline % jscpd
  6. ${C.cyan}npx knip${C.reset}                          # замер baseline мёртвого кода
  7. ${C.cyan}npx depcruise --config .dependency-cruiser.js public server${C.reset}
                                        # проверить: 0 orphan после правки pathNot
  8. Заполнить таблицу Baseline в docs/guardrails.md
  9. Скорректировать стартовые пороги:
       - eslint --max-warnings = факт + 10
       - jscpd strict threshold = факт + 1
  10. Коммит: ${C.cyan}git add -A && git commit -m "chore(guardrails): PR 1 — Anti-AI-Slop базовые конфиги"${C.reset}

${C.bold}Откат:${C.reset} все перезаписанные файлы сохранены как \`*.bak\` рядом с оригиналом.
Для полного отката: ${C.cyan}git checkout -- .${C.reset} и удалить новые файлы:
  .jscpd.json .jscpd.strict.json knip.json eslint.config.js .dependency-cruiser.js
  server/middleware/validate.js docs/openapi.yaml docs/guardrails.md
`);
}

main().catch((err) => {
  console.error(`${C.red}Ошибка:${C.reset} ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});