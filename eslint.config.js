// eslint.config.js — Flat Config (ESLint v9+)
import js from '@eslint/js';
import sonarjs from 'eslint-plugin-sonarjs';
import playwright from 'eslint-plugin-playwright';
import globals from 'globals';

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
      'public/dump-schema.mjs',
      'public/dist/**',
      'scripts/fix-*.mjs',
      'scripts/move-*.mjs',
      'scripts/reshoot*.mjs',
      'scripts/shoot*.mjs',
      'fix_views.py',
      'screens/**'
    ]
  },

  js.configs.recommended,

  // 1. Сервер: Node 22, ESM
  {
    files: ['server/**/*.js', 'server.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: nodeGlobals
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-undef': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'smart'],
      'no-useless-escape': 'off'
    }
  },

  // 2. Скрипты и тесты
  {
    files: ['scripts/**/*.mjs', 'test-api.mjs', 'playwright.config.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...nodeGlobals, ...browserGlobals }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-undef': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': 'warn',
      'no-useless-escape': 'off'
    }
  },

  // 3. Фронтенд: общие правила
  {
    files: ['public/app/**/*.js', 'public/sw.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: browserGlobals
    },
    plugins: { sonarjs },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'prefer-const': 'warn',
      'no-undef': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off',
      'no-func-assign': 'off',
      'no-redeclare': 'warn',

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

  // 4. Легаси-монолиты: фиксируем baseline сложности и мелких дублей
  {
    files: [
      'public/app/cart.js',
      'public/app/delivery.js',
      'public/app/core/views.js',
      'public/app/core/catalog.js',
      'public/app/core/auth.js',
      'public/app/core/preorder-timer.js',
      'public/app/chat-core.js',
      'public/app/core/deeplink.js',
      'public/app/core/overlay-core.js',
      'public/app/orders.js',
      'public/app/profile.js',
      'public/app/ui/cashier-log.js'
    ],
    rules: {
      'sonarjs/cognitive-complexity': ['warn', 105],
      'sonarjs/no-collapsible-if': 'off',
      'sonarjs/no-nested-template-literals': 'off',
      'sonarjs/no-identical-functions': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'no-func-assign': 'off'
    }
  },

  // 5. Статические словари адресов
  {
    files: [
      'public/app/address.js',
      'public/app/core/address-dict.js',
      'server/domain/address.js'
    ],
    rules: {
      'sonarjs/no-duplicate-string': 'off'
    }
  },

  // 6. Классические defer-скрипты: не трогаем аргументы обработчиков событий
  {
    files: [
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
      'no-unused-vars': 'off',
      'prefer-const': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off',
      'no-func-assign': 'off'
    }
  },

  // 7. Playwright e2e
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
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'playwright/no-focused-test': 'error',
      'playwright/missing-playwright-await': 'error',
      'playwright/valid-expect': 'error',
      'playwright/expect-expect': 'error',
      'playwright/no-eval': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/no-wait-for-timeout': 'warn'
    }
  }
];
