// eslint.config.js
// Flat Config (ESLint v9+).
// Четыре контекста: сервер / скрипты+e2e / ESM-фронт / классические скрипты.
// Цель — ловить ИИ-слоп: копипастные ветки, раздутые функции, разорванные await.
//
// ВАЖНО (архитектура проекта): фронт и классические скрипты держат часть контрактов
// на window.* (state.js, catalog.js, ui.js): модули читают me/cart/api/$/esc/fmt/toast/
// syncOverlay/MENU/DMENU/API_BASE ГОЛЫМИ идентификаторами. Это состояние до полного
// ESM-этапа (см. docs/frontend-todo.md, Фаза 5). Поэтому no-undef и no-implicit-globals
// на фронте отключены осознанно. Контроль — через 20+ e2e-тестов Playwright.

import js from '@eslint/js';
import sonarjs from 'eslint-plugin-sonarjs';
import playwright from 'eslint-plugin-playwright';
import globals from 'globals';

// Браузерный контекст. Нужен и scripts/*.mjs — они передают код в page.evaluate().
const browserGlobals = {
  ...globals.browser,
  ...globals.serviceworker,
  Telegram: 'readonly',
  TelegramWebAppProxy: 'readonly',
  TelegramGameProxy: 'readonly',
  qrcode: 'readonly',
  jsQR: 'readonly'
};

// Node.js-контекст.
const nodeGlobals = { ...globals.node, ...globals.es2024 };

// Правила для «чистого» Node.js: только сервер.
const serverRules = {
  'no-unused-vars': ['warn', {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrors: 'none'                // catch(e){} — осознанный swallow
  }],
  'no-undef': 'error',
  'no-empty': ['error', { allowEmptyCatch: true }],
  'prefer-const': 'warn',
  'eqeqeq': ['warn', 'smart'],
  'no-return-await': 'warn',
  'no-useless-escape': 'off'            // \-, \/ внутри [] — валидные, но избыточные escape
};

// Правила для скриптов + e2e: Node + браузерный контекст (page.evaluate).
const scriptRules = {
  'no-unused-vars': ['warn', {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrors: 'none'
  }],
  'no-undef': 'off',                    // скрипты выполняют код в браузере через page.evaluate
  'no-empty': ['error', { allowEmptyCatch: true }],
  'prefer-const': 'warn',
  'no-useless-escape': 'off'
};

export default [
  // ── Игноры ──────────────────────────────────────────────────────────
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
      'public/dump-schema.mjs',            // throwaway, в .gitignore
      'scripts/fix-*.mjs',                 // одноразовые патч-скрипты
      'scripts/move-*.mjs',
      'scripts/reshoot*.mjs',              // скриншотер-песочница, в .gitignore
      'scripts/shoot*.mjs',
      'fix_views.py',
      'screens/**'
    ]
  },

  js.configs.recommended,

  // ── Сервер: Node 22, ESM ────────────────────────────────────────────
  {
    files: ['server/**/*.js', 'server.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: nodeGlobals
    },
    rules: serverRules
  },

  // ── Скрипты и e2e: Node + браузерный контекст (page.evaluate) ──────
  {
    files: ['scripts/**/*.mjs', 'test-api.mjs', 'playwright.config.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...nodeGlobals, ...browserGlobals }
    },
    rules: scriptRules
  },

  // ── Фронт: Vanilla JS ESM + SonarJS ────────────────────────────────
  {
    files: ['public/app/**/*.js', 'public/sw.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: browserGlobals
    },
    plugins: { sonarjs },
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none'
      }],
      'prefer-const': 'warn',

      // Отключено осознанно — см. комментарий в шапке файла.
      'no-undef': 'off',
      'no-implicit-globals': 'off',

      // Шум легаси — отключаем, чтобы не блокировать PR 1.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off',
      'no-func-assign': 'off',            // window.renderOrders = ... — патч-обёртки
      'no-redeclare': 'warn',

      'no-restricted-globals': [
        'warn',
        { name: 'event', message: 'Неявный window.event — используйте параметр e.' }
      ],

      // ── SonarJS: детекторы ИИ-слопа ─────────────────────────────
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

  // ── Классические скрипты из index.html (НЕ ESM-модули) ────────────
  // Подключены отдельными <script defer> в public/index.html и общаются с остальным
  // кодом через top-level глобалы (init, renderTimers, normStreet, ...) и window-шимы
  // ($, api, me, syncOverlay). Осознанная архитектура до ESM-этапа.
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
      'prefer-const': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off'
    }
  },

  // ── Playwright (e2e) ───────────────────────────────────────────────
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
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none'
      }],
      'no-empty': ['error', { allowEmptyCatch: true }],

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
  }
];